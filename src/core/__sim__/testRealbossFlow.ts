// ============================================================
// 진짜보스 전체 플로우 E2E 검증
// ============================================================
// 1) 골드 누적 → isChallengeDue 발동
// 2) 도전 수락 → consumeChallengeTrigger 가 totalGoldEarned 리셋
// 3) startRealBoss 가 REAL_BOSS_ORDER[clearCount] 테마로 보스 생성
// 4) finishRealBossCombat 의 불변식 검증
//    - 부분 클리어: currentBossBestDrain = max() 갱신, permanentStartBonus 재계산
//    - 풀 클리어: realBossClearCount++ , currentBossBestDrain = 0 리셋
//    - 풀 클리어 시 totalBonusStats 보존 / 부분 시 리셋
// 5) HP 스케일링이 일반 몹/보스/진짜보스/소환몹 전부에 적용되는지

import { defaultMeta, accumulateClearGold, consumeChallengeTrigger, pushCharacterHistory } from '../meta'
import { isChallengeDue, pickNextRealBossTheme, makeRealBoss, REAL_BOSS_ORDER, REAL_BOSS_GOLD_THRESHOLD } from '../realboss'
import { makeMonster, createCombatContext } from '../combat'
import { CHAPTER_THEMES } from '@/data/chapters'
import type { MetaBonuses, Character, ChapterTheme } from '@/types'

let pass = 0, fail = 0
function ok(label: string, cond: boolean, detail?: string) {
  if (cond) { console.log(`  ✓ ${label}${detail ? ` ${detail}` : ''}`); pass++ }
  else { console.log(`  ✗ ${label}${detail ? ` ${detail}` : ''}`); fail++ }
}
function eq<T>(label: string, actual: T, expected: T) {
  ok(label, actual === expected, `[got ${String(actual)}, expect ${String(expected)}]`)
}

// 더미 캐릭터 생성 (히스토리 푸시 전용)
function makeDummyCharacter(): Character {
  return {
    stats: { 힘: 10, 민첩: 10, 체력: 10, 마력: 10, 행운: 10 },
    hp: 100, maxHp: 100, mp: 50, maxMp: 50,
    gold: 0,
    weapon: null, armor: null,
    statuses: [],
    actionGauge: 0,
  } as unknown as Character
}

// finishRealBossCombat 의 핵심 로직 재현 (game.ts 와 동기화 유지)
function applyRealBossResult(meta: MetaBonuses, ratio: number): { gain: number; fullClear: boolean } {
  const prev = meta.permanentStartBonus ?? 0
  const fullClear = ratio >= 0.9999
  if (fullClear) {
    meta.realBossDefeated = true
    meta.realBossClearCount = (meta.realBossClearCount ?? 0) + 1
    meta.currentBossBestDrain = 0
  } else if (ratio > (meta.currentBossBestDrain ?? 0)) {
    meta.currentBossBestDrain = ratio
  }
  meta.permanentStartBonus =
    (meta.realBossClearCount * 60) +
    Math.floor(60 * (meta.currentBossBestDrain ?? 0))
  meta.realBossCompleted = true
  meta.lastBossDrainRatio = ratio
  if (!fullClear) {
    meta.totalBonusStats = 0
    meta.allocations = {}
  }
  return { gain: Math.max(0, meta.permanentStartBonus - prev), fullClear }
}

console.log('\n========== A. isChallengeDue 발동 조건 ==========')
{
  const meta = defaultMeta()

  // 캐릭터 히스토리 없으면 발동 X
  ok('히스토리 0 + 골드 0 → false', !isChallengeDue(meta))

  // 히스토리 추가 후 골드 < 50k → 발동 X
  pushCharacterHistory(meta, makeDummyCharacter(), 1000, 'A', null, '고블린', true)
  meta.totalGoldEarned = 49999
  ok('히스토리 1 + 골드 49999 → false', !isChallengeDue(meta))

  // 골드 = 50k → 발동
  meta.totalGoldEarned = 50000
  ok(`히스토리 1 + 골드 ${REAL_BOSS_GOLD_THRESHOLD} → true`, isChallengeDue(meta))

  // 골드 > 50k → 발동
  meta.totalGoldEarned = 100000
  ok('히스토리 1 + 골드 100000 → true', isChallengeDue(meta))
}

console.log('\n========== B. accumulateClearGold + consumeChallengeTrigger ==========')
{
  const meta = defaultMeta()
  pushCharacterHistory(meta, makeDummyCharacter(), 1000, 'A', null, '고블린', true)

  accumulateClearGold(meta, 20000)
  eq('골드 20000 누적', meta.totalGoldEarned, 20000)
  accumulateClearGold(meta, 35000)
  eq('골드 55000 (20+35) 누적', meta.totalGoldEarned, 55000)
  ok('이제 isChallengeDue true', isChallengeDue(meta))

  // 도전 수락 시점에 consumeChallengeTrigger 호출
  consumeChallengeTrigger(meta)
  eq('totalGoldEarned 리셋', meta.totalGoldEarned, 0)
  eq('runsSinceLastChallenge 리셋', meta.runsSinceLastChallenge, 0)
  ok('isChallengeDue false (재발동 차단)', !isChallengeDue(meta))
}

console.log('\n========== C. REAL_BOSS_ORDER 기반 보스 순서 + 클리어 누적 ==========')
{
  const meta = defaultMeta()
  pushCharacterHistory(meta, makeDummyCharacter(), 1000, 'A', null, '고블린', true)

  // 0회 클리어 → 고블린
  let theme = pickNextRealBossTheme(meta.realBossClearCount)
  eq('첫 도전 테마 = 고블린', theme, '고블린' as ChapterTheme)

  // 풀클 → 1회
  applyRealBossResult(meta, 1.0)
  eq('1회 클리어 후 clearCount', meta.realBossClearCount, 1)
  theme = pickNextRealBossTheme(meta.realBossClearCount)
  eq('두 번째 도전 테마 = 기계', theme, '기계' as ChapterTheme)

  // 2회 클리어 → 천공
  applyRealBossResult(meta, 1.0)
  theme = pickNextRealBossTheme(meta.realBossClearCount)
  eq('세 번째 도전 테마 = 천공', theme, '천공' as ChapterTheme)

  // 11회 클리어 → 순환해서 다시 고블린
  for (let i = 0; i < 9; i++) applyRealBossResult(meta, 1.0)
  eq('11회 클리어', meta.realBossClearCount, 11)
  theme = pickNextRealBossTheme(meta.realBossClearCount)
  eq('12번째 도전 테마 = 고블린 (순환)', theme, '고블린' as ChapterTheme)
  eq('11회 클리어 후 permanentStartBonus = 660', meta.permanentStartBonus, 660)
}

console.log('\n========== D. 부분 클리어 시 totalBonusStats 리셋 (회귀 서사) ==========')
{
  const meta = defaultMeta()
  meta.totalBonusStats = 50
  meta.allocations = { 힘: 30, 민첩: 20 }

  // 부분 클리어 → 회귀 → 리셋
  applyRealBossResult(meta, 0.46)
  eq('부분 클리어 후 totalBonusStats 리셋', meta.totalBonusStats, 0)
  eq('부분 클리어 후 allocations 리셋', Object.keys(meta.allocations).length, 0)
}

console.log('\n========== E. 풀 클리어 시 totalBonusStats 보존 ==========')
{
  const meta = defaultMeta()
  meta.totalBonusStats = 50
  meta.allocations = { 힘: 30, 민첩: 20 }

  applyRealBossResult(meta, 1.0)
  eq('풀 클리어 후 totalBonusStats 보존', meta.totalBonusStats, 50)
  ok('풀 클리어 후 allocations 보존', meta.allocations?.힘 === 30 && meta.allocations?.민첩 === 20)
}

console.log('\n========== F. realBossDefeated 플래그 ==========')
{
  const meta = defaultMeta()

  // 부분 클리어로는 false
  applyRealBossResult(meta, 0.5)
  ok('0.5 부분 클리어 → realBossDefeated false', !meta.realBossDefeated)

  // 풀 클리어로 true
  applyRealBossResult(meta, 1.0)
  ok('1.0 풀 클리어 → realBossDefeated true', meta.realBossDefeated)
}

console.log('\n========== G. lastBossDrainRatio 추적 ==========')
{
  const meta = defaultMeta()
  applyRealBossResult(meta, 0.3)
  eq('lastBossDrainRatio = 0.3', meta.lastBossDrainRatio, 0.3)
  applyRealBossResult(meta, 0.2)
  eq('lastBossDrainRatio = 0.2 (최신 시도값 그대로)', meta.lastBossDrainRatio, 0.2)
}

console.log('\n========== H. 일반 몬스터 HP 스케일링 (combat 통합) ==========')
{
  const template = CHAPTER_THEMES['고블린'].normalMonsters[0]
  const m0 = makeMonster(template, 1, 'normal', 0)
  const m3 = makeMonster(template, 1, 'normal', 3)
  ok(`0회: hp=${m0.hp}, 3회: hp=${m3.hp}, ratio ≈ 3.7`,
     Math.abs(m3.hp / m0.hp - 3.7) < 0.02)

  const bossTpl = CHAPTER_THEMES['고블린'].boss
  const b0 = makeMonster(bossTpl, 1, 'boss', 0)
  const b3 = makeMonster(bossTpl, 1, 'boss', 3)
  ok(`보스 0회 vs 3회 HP ratio ≈ 3.7`, Math.abs(b3.hp / b0.hp - 3.7) < 0.02)
}

console.log('\n========== I. 진짜보스 HP 누적 (makeRealBoss) ==========')
{
  const b0 = makeRealBoss('고블린', 0)
  const b1 = makeRealBoss('고블린', 1)
  const b5 = makeRealBoss('고블린', 5)
  ok(`진짜보스 HP: 0회 ${b0.hp} / 1회 ${b1.hp} / 5회 ${b5.hp}`,
     Math.abs(b1.hp / b0.hp - 1.9) < 0.02 && Math.abs(b5.hp / b0.hp - 5.5) < 0.02)
}

console.log('\n========== J. createCombatContext realBossClearCount 전파 ==========')
{
  const player = { hp: 100, maxHp: 100, mp: 50, maxMp: 50, gold: 0, statuses: [], actionGauge: 0,
    stats: { 힘: 10, 민첩: 10, 체력: 10, 마력: 10, 행운: 10 }, weapon: null, armor: null } as any
  const m = makeMonster(CHAPTER_THEMES['고블린'].normalMonsters[0], 1, 'normal', 2)
  const ctx = createCombatContext(player, m, 2)
  eq('CombatContext.realBossClearCount === 2', ctx.realBossClearCount, 2)
}

console.log('\n========== K. 진짜보스 도전 → 부분 클리어 → 재도전 (실제 시나리오) ==========')
{
  const meta = defaultMeta()
  pushCharacterHistory(meta, makeDummyCharacter(), 1000, 'A', null, '고블린', true)

  // 사이클 1: 골드 누적 → 도전 → 부분 (40%) → 다음 사이클
  accumulateClearGold(meta, 50000)
  ok('isChallengeDue 첫 도전', isChallengeDue(meta))
  consumeChallengeTrigger(meta)
  eq('도전 시작 시 골드 0', meta.totalGoldEarned, 0)

  applyRealBossResult(meta, 0.40)
  eq('40% bonus', meta.permanentStartBonus, 24)  // floor(60*0.4)
  eq('clearCount 0 유지 (풀클 아님)', meta.realBossClearCount, 0)

  // 사이클 2: 다시 5만 누적 → 도전 → 30% (베스트 미달, 보상 변동 X)
  accumulateClearGold(meta, 50000)
  ok('isChallengeDue 두번째', isChallengeDue(meta))
  consumeChallengeTrigger(meta)
  applyRealBossResult(meta, 0.30)
  eq('30% (베스트 미달) bonus 유지 24', meta.permanentStartBonus, 24)
  eq('currentBossBestDrain 0.4 유지', meta.currentBossBestDrain, 0.40)

  // 사이클 3: 60% (베스트 갱신)
  accumulateClearGold(meta, 50000)
  consumeChallengeTrigger(meta)
  applyRealBossResult(meta, 0.60)
  eq('60% (베스트 갱신) bonus 36', meta.permanentStartBonus, 36)  // floor(60*0.6)
  eq('currentBossBestDrain 0.6', meta.currentBossBestDrain, 0.60)

  // 사이클 4: 100% (풀클)
  accumulateClearGold(meta, 50000)
  consumeChallengeTrigger(meta)
  applyRealBossResult(meta, 1.0)
  eq('풀클 후 bonus 60', meta.permanentStartBonus, 60)
  eq('풀클 후 clearCount 1', meta.realBossClearCount, 1)
  eq('풀클 후 currentBossBestDrain 0 리셋', meta.currentBossBestDrain, 0)
  ok('풀클 후 realBossDefeated true', meta.realBossDefeated)

  // 사이클 5: 다음 보스 (기계) 도전
  accumulateClearGold(meta, 50000)
  const theme = pickNextRealBossTheme(meta.realBossClearCount)
  eq('두 번째 도전 테마 = 기계', theme, '기계' as ChapterTheme)
}

console.log('\n========== 결과 요약 ==========')
console.log(`Pass: ${pass}`)
console.log(`Fail: ${fail}`)
if (fail > 0) { console.log('\n❌ 일부 실패'); process.exit(1) }
else { console.log('\n✅ 전체 플로우 검증 통과') }
