// ============================================================
// 통합 검증 — 챌린지 정의 + REAL_BOSS_ORDER + makeMonster + makeRealBoss
// ============================================================

import { CHALLENGES, type ChallengeDef } from '@/data/challenges'
import { REAL_BOSS_ORDER, pickNextRealBossTheme, makeRealBoss } from '../realboss'
import { makeMonster } from '../combat'
import { CHAPTER_THEMES } from '@/data/chapters'
import type { ChapterTheme } from '@/types'

let passCount = 0
let failCount = 0

function assert(label: string, ok: boolean, detail?: string) {
  if (ok) {
    console.log(`  ✓ ${label}${detail ? ` (${detail})` : ''}`)
    passCount++
  } else {
    console.log(`  ✗ ${label}${detail ? ` (${detail})` : ''}`)
    failCount++
  }
}

console.log('\n========== 1. 64개 챌린지 정의 정합성 ==========')
{
  console.log(`총 챌린지: ${CHALLENGES.length}`)
  assert('CHALLENGES.length === 64', CHALLENGES.length === 64, `${CHALLENGES.length}`)

  const keys = new Set<string>()
  let dupes = 0
  for (const c of CHALLENGES) {
    if (keys.has(c.key)) dupes++
    keys.add(c.key)
  }
  assert('키 중복 없음', dupes === 0, `${dupes}개 중복`)

  const requiredFields: (keyof ChallengeDef)[] = ['key', 'category', 'name', 'group', 'description', 'reward', 'penalty']
  let missing = 0
  for (const c of CHALLENGES) {
    for (const f of requiredFields) {
      if (!c[f]) {
        missing++
        console.log(`    ⚠ ${c.key}: ${f} 누락`)
      }
    }
  }
  assert('필수 필드 모두 존재', missing === 0, `${missing}개 누락`)

  const instantCount = CHALLENGES.filter(c => c.category === 'instant').length
  const riskCount = CHALLENGES.filter(c => c.category === 'risk').length
  assert('instant + risk = 64', instantCount + riskCount === 64, `${instantCount} + ${riskCount}`)

  const groups = new Set(CHALLENGES.map(c => c.group))
  assert('그룹 수 > 0', groups.size > 0, `${groups.size}개 그룹`)
}

console.log('\n========== 2. REAL_BOSS_ORDER 순서 검증 ==========')
{
  const expected: ChapterTheme[] = [
    '고블린', '기계', '천공', '골렘', '환영',
    '언데드', '흡혈귀', '심해', '용암', '암흑', '맹독',
  ]
  assert('REAL_BOSS_ORDER.length === 11', REAL_BOSS_ORDER.length === 11)
  for (let i = 0; i < expected.length; i++) {
    assert(`REAL_BOSS_ORDER[${i}] === ${expected[i]}`, REAL_BOSS_ORDER[i] === expected[i], REAL_BOSS_ORDER[i])
  }
}

console.log('\n========== 3. pickNextRealBossTheme 순환 ==========')
{
  assert('pickNextRealBossTheme(0) === 고블린', pickNextRealBossTheme(0) === '고블린')
  assert('pickNextRealBossTheme(1) === 기계', pickNextRealBossTheme(1) === '기계')
  assert('pickNextRealBossTheme(10) === 맹독', pickNextRealBossTheme(10) === '맹독')
  assert('pickNextRealBossTheme(11) === 고블린 (순환)', pickNextRealBossTheme(11) === '고블린')
  assert('pickNextRealBossTheme(22) === 고블린 (순환 2)', pickNextRealBossTheme(22) === '고블린')
  assert('pickNextRealBossTheme(13) === 천공 (순환)', pickNextRealBossTheme(13) === '천공')
}

console.log('\n========== 4. makeMonster HP 스케일링 실제 적용 ==========')
{
  const template = CHAPTER_THEMES['고블린'].normalMonsters[0]
  const m0 = makeMonster(template, 1, 'normal', 0)
  const m1 = makeMonster(template, 1, 'normal', 1)
  const m5 = makeMonster(template, 1, 'normal', 5)
  console.log(`    HP at 0/1/5 clears: ${m0.hp}/${m1.hp}/${m5.hp}`)

  // m1.hp = m0.hp * 1.9 (approx, with rounding)
  const ratio1 = m1.hp / m0.hp
  const ratio5 = m5.hp / m0.hp
  assert(`1회 ratio ≈ 1.9 (실제 ${ratio1.toFixed(3)})`, Math.abs(ratio1 - 1.9) < 0.02)
  assert(`5회 ratio ≈ 5.5 (실제 ${ratio5.toFixed(3)})`, Math.abs(ratio5 - 5.5) < 0.02)
}

console.log('\n========== 5. makeRealBoss 누적 HP 적용 ==========')
{
  const b0 = makeRealBoss('고블린', 0)
  const b1 = makeRealBoss('고블린', 1)
  const b3 = makeRealBoss('고블린', 3)
  console.log(`    진짜보스 HP at 0/1/3 clears: ${b0.hp}/${b1.hp}/${b3.hp}`)

  // b1.hp ≈ b0.hp * 1.9 (정확히는 makeMonster 안에서 ×1.9, 그 다음 makeRealBoss 가 ×3.0 추가)
  // 따라서 ratio = 1.9 (외부 곱은 동일)
  const ratio1 = b1.hp / b0.hp
  const ratio3 = b3.hp / b0.hp
  assert(`진짜보스 1회 ratio ≈ 1.9 (실제 ${ratio1.toFixed(3)})`, Math.abs(ratio1 - 1.9) < 0.02)
  assert(`진짜보스 3회 ratio ≈ 3.7 (실제 ${ratio3.toFixed(3)})`, Math.abs(ratio3 - 3.7) < 0.02)
}

console.log('\n========== 6. 모든 ChapterTheme 가 진짜보스로 생성 가능 ==========')
{
  let errors = 0
  for (const theme of REAL_BOSS_ORDER) {
    try {
      const boss = makeRealBoss(theme, 0)
      if (!boss || !boss.template || boss.hp <= 0) {
        errors++
        console.log(`    ⚠ ${theme}: 생성 실패`)
      }
    } catch (e) {
      errors++
      console.log(`    ⚠ ${theme}: ${(e as Error).message}`)
    }
  }
  assert('11개 테마 모두 진짜보스 생성 OK', errors === 0, `${errors}개 실패`)
}

console.log('\n========== 7. CHAPTERS 테마 vs REAL_BOSS_ORDER 정합성 ==========')
{
  // 게임의 10챕터는 11개 테마 중 일부를 사용. REAL_BOSS_ORDER 의 모든 테마는 CHAPTER_THEMES 에 정의돼야 함
  let missing = 0
  for (const theme of REAL_BOSS_ORDER) {
    if (!CHAPTER_THEMES[theme]) {
      missing++
      console.log(`    ⚠ ${theme}: CHAPTER_THEMES 에 없음`)
    }
  }
  assert('REAL_BOSS_ORDER 의 모든 테마가 CHAPTER_THEMES 에 존재', missing === 0)

  // 각 테마에 boss / hardBoss 존재
  let noBoss = 0
  for (const theme of REAL_BOSS_ORDER) {
    const def = CHAPTER_THEMES[theme]
    if (!def?.boss && !def?.hardBoss) {
      noBoss++
      console.log(`    ⚠ ${theme}: boss/hardBoss 모두 없음`)
    }
  }
  assert('각 테마에 boss 또는 hardBoss 존재', noBoss === 0)
}

console.log('\n========== 결과 요약 ==========')
console.log(`Pass: ${passCount}`)
console.log(`Fail: ${failCount}`)
if (failCount > 0) {
  console.log('\n❌ 일부 테스트 실패')
  process.exit(1)
} else {
  console.log('\n✅ 모든 통합 테스트 통과')
}
