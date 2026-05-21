// ============================================================
// 전체 게임 자동플레이 시뮬레이터 — 클리어 시 무기/갑옷/특성 집계
//
// 규칙 (사용자 지정):
//   - 주사위: 1번만 (no reroll)
//   - 챌린지: 가장 높은 스탯 관련 챌린지 선택. 없으면 2번째/3번째 스탯.
//   - 암시장: 가장 높은 스탯을 가능한 만큼 구매
//   - 등가교환 제단: skip
//   - 대장간: 항상 최대 베팅
//
// 기타 정책 (기본값):
//   - 위기 모험가: 도움 (70% ally / 30% villain)
//   - 룰렛: skip
//   - 탐욕의 수집가: 거절
//   - 회복샘: 무조건 사용
//   - 보물상자: 열고 더 좋은 등급(tier↑)이면 장착
//   - 상점: 더 좋은 등급/공값 아이템이면 구매. 새로고침 X
//
// 사용:
//   RUNS=10000 npx tsx src/core/__sim__/autoplayClear.ts
//   RUNS=100000 npx tsx src/core/__sim__/autoplayClear.ts  (장시간)
// ============================================================

import {
  createCombatContext, makeMonster, advanceTick, checkActionReady,
  monsterAttack, consumeAction, playerBasicAttack,
} from '../combat'
import { computeEffectiveStats } from '../stats'
import { useSkill, pickAutoAction } from '../skills'
import { rollItem } from '../items'
import {
  applySmithUpgrade, applyRouletteResult, buyStatPoint,
} from '../events'
import { computeMaxHp, computeMaxMp } from '../character'
import { CHAPTER_THEMES, ALL_THEME_KEYS } from '@/data/chapters'
import { CHALLENGES } from '@/data/challenges'
import { WEAPONS } from '@/data/weapons'
import type {
  Character, Stats, StatKey, ChapterTheme, MonsterTemplate, MonsterInstance, ItemInstance,
} from '@/types'

function isMagicWeapon(c: Character): boolean {
  return c.weapon ? !!WEAPONS[c.weapon.baseKey]?.isMagic : false
}

// ── 캐릭터/챌린지 ──
function generateDice(): Stats {
  // 60pt 균등 랜덤 (RANDOM_STAT_KEYS 한 번씩 1pt 누적)
  const s: Stats = { 힘: 0, 민첩: 0, 체력: 0, 마력: 0, 행운: 0 }
  const keys: StatKey[] = ['힘', '민첩', '체력', '마력', '행운']
  let rem = 60
  while (rem > 0) {
    s[keys[Math.floor(Math.random() * keys.length)]] += 1
    rem--
  }
  return s
}

// 챌린지 매핑: 챌린지가 어느 스탯을 보너스로 주는지 → 그 스탯 카테고리
function challengeStat(c: typeof CHALLENGES[number]): StatKey | null {
  const bonus = c.instantBonus
  if (!bonus) return null
  let bestKey: StatKey | null = null
  let bestVal = 0
  for (const k of ['힘', '민첩', '체력', '마력', '행운'] as StatKey[]) {
    if ((bonus[k] ?? 0) > bestVal) { bestVal = bonus[k] ?? 0; bestKey = k }
  }
  return bestKey
}

function pickChallenge(diceStats: Stats): typeof CHALLENGES[number] | null {
  // 챌린지 후보 3개 무작위 추첨 (게임 동작 동일)
  const opts = [...CHALLENGES].sort(() => Math.random() - 0.5).slice(0, 3)
  // 스탯 정렬 (높은 순)
  const sortedStats: StatKey[] = (['힘', '민첩', '체력', '마력', '행운'] as StatKey[])
    .sort((a, b) => diceStats[b] - diceStats[a])
  // 1순위 스탯 관련 챌린지 → 2순위 → 3순위
  for (const sk of sortedStats) {
    const match = opts.find((c) => challengeStat(c) === sk)
    if (match) return match
  }
  return null  // none matched
}

function createChar(stats: Stats, bonus?: Partial<Stats>): Character {
  const final: Stats = { ...stats }
  if (bonus) {
    for (const k of Object.keys(bonus) as StatKey[]) {
      final[k] = (final[k] ?? 0) + (bonus[k] ?? 0)
    }
  }
  return {
    stats: final,
    hp: computeMaxHp(final.체력), maxHp: computeMaxHp(final.체력),
    mp: computeMaxMp(final.마력), maxMp: computeMaxMp(final.마력),
    weapon: rollItem({ kind: 'weapon', forceTraitTier: '하급', forceGrade: '노말' }),
    armor: null, gold: 50, statuses: [], actionGauge: 0,
  }
}

// ── 전투 ──
function simSingleCombat(c: Character, monster: MonsterInstance, maxTicks = 800): { win: boolean; ticks: number } {
  const ctx = createCombatContext(c, monster)
  while (!ctx.ended && ctx.tick < maxTicks) {
    advanceTick(ctx)
    const eff = computeEffectiveStats(ctx.player)
    const ready = checkActionReady(ctx, eff.무기ticks)
    for (const m of ready.readyMonsters) {
      if (ctx.ended) break
      monsterAttack(ctx, m)
      consumeAction(m, m.ticks)
    }
    if (!ctx.ended && ctx.player.actionGauge >= eff.무기ticks) {
      const action = pickAutoAction(ctx, {})
      if (action.kind === 'skill') {
        if (!useSkill(ctx, action.key)) playerBasicAttack(ctx)
      } else playerBasicAttack(ctx)
      consumeAction(ctx.player, eff.무기ticks)
    }
  }
  return { win: ctx.victory, ticks: ctx.tick }
}

function simNormalMonsters(c: Character, theme: ChapterTheme, chapter: number): boolean {
  const themeDef = CHAPTER_THEMES[theme]
  // 1~3마리 무작위 (encounterMin/Max 단순화)
  const count = 1 + Math.floor(Math.random() * 2)
  for (let i = 0; i < count; i++) {
    const tmpl: MonsterTemplate = themeDef.normalMonsters[Math.floor(Math.random() * themeDef.normalMonsters.length)]
    const m = makeMonster(tmpl, chapter, 'normal')
    if (c.hp <= 0) return false
    const r = simSingleCombat(c, m)
    if (!r.win) return false
  }
  return true
}

function simBoss(c: Character, theme: ChapterTheme, chapter: number): boolean {
  const themeDef = CHAPTER_THEMES[theme]
  const m = makeMonster(themeDef.boss, chapter, 'boss')
  return simSingleCombat(c, m).win
}

// ── 이벤트 (단순) ──
function highestStat(stats: Stats): StatKey {
  let best: StatKey = '힘'
  for (const k of ['힘', '민첩', '체력', '마력', '행운'] as StatKey[]) {
    if (stats[k] > stats[best]) best = k
  }
  return best
}

function doBlackMarket(c: Character, chapter: number) {
  // 가장 높은 스탯을 골드 닿는 한 계속 구매
  const target = highestStat(c.stats)
  while (buyStatPoint(c, chapter, target)) {
    // continue
  }
}

function doSmith(c: Character) {
  if (!c.weapon) return
  const maxBet = Math.min(c.gold, c.weapon.sellPrice * 2)
  if (maxBet > 0) applySmithUpgrade(c, maxBet)
}

// 마법 빌드 갑옷 교체 규칙: 로브 > 다른 갑옷 (tier 낮아도 OK)
//   - 마법무기 + 로브 미장착 → 로브 발견 시 무조건 교체
//   - 마법무기 + 로브 장착 → 더 높은 tier 로브만 교체 (다른 갑옷 skip)
//   - 일반 빌드 → tier 우선
function shouldEquipArmor(c: Character, it: ItemInstance): boolean {
  const cur = c.armor
  if (!cur) return true   // 슬롯 비었으면 일단 장착
  const magic = isMagicWeapon(c)
  if (magic) {
    // 마법 빌드
    if (cur.baseKey !== '로브' && it.baseKey === '로브') return true   // 로브 발견 → 무조건
    if (cur.baseKey === '로브' && it.baseKey !== '로브') return false  // 이미 로브 → 다른 갑옷 skip
    return it.tier > cur.tier   // 같은 종류면 tier 비교
  }
  return it.tier > cur.tier
}

function takeTreasure(c: Character, chapter: number) {
  const kind = Math.random() < 0.5 ? 'weapon' : 'armor'
  const it = rollItem({ kind, chapter, source: 'treasure' })
  if (kind === 'weapon') {
    const cur = c.weapon
    if (!cur || it.tier > cur.tier) c.weapon = it
  } else {
    if (shouldEquipArmor(c, it)) c.armor = it
  }
}

function autoShop(c: Character, chapter: number) {
  const slots = Math.min(3 + Math.floor((chapter - 1) / 3), 6)
  const inventory: ItemInstance[] = []
  for (let i = 0; i < slots; i++) {
    const k = Math.random() < 0.5 ? 'weapon' : 'armor'
    inventory.push(rollItem({ kind: k, chapter, source: 'shop' }))
  }
  const magic = isMagicWeapon(c)
  // 우선순위 점수: 마법빌드 + 로브 = 큰 가산점, 그 외 tier 기준
  inventory.sort((a, b) => {
    const aBonus = (magic && a.kind === 'armor' && a.baseKey === '로브') ? 100 : 0
    const bBonus = (magic && b.kind === 'armor' && b.baseKey === '로브') ? 100 : 0
    return (b.tier + bBonus) - (a.tier + aBonus)
  })
  for (const it of inventory) {
    if (c.gold < it.buyPrice) continue
    if (it.kind === 'weapon') {
      const cur = c.weapon
      if (!cur || it.tier > cur.tier) {
        c.gold -= it.buyPrice
        c.weapon = it
      }
    } else {
      if (shouldEquipArmor(c, it)) {
        c.gold -= it.buyPrice
        c.armor = it
      }
    }
  }
}

function doHealingSpring(c: Character) {
  c.hp = c.maxHp
  c.mp = c.maxMp
}

// 특별 이벤트 — 가중 무작위, 사용자 규칙 적용
function doSpecialEvent(c: Character, chapter: number) {
  const events = ['smith', 'blackmarket', 'crisis', 'roulette', 'altar', 'collector']
  const ev = events[Math.floor(Math.random() * events.length)]
  if (ev === 'smith') {
    doSmith(c)
  } else if (ev === 'blackmarket') {
    doBlackMarket(c, chapter)
  } else if (ev === 'crisis') {
    // 단순: 70% 동료, 30% 함정. 동료면 골드+, 적이면 평타 전투 1회
    if (Math.random() < 0.7) c.gold += 50
    else {
      // 동급 보스 1마리와 전투
      const themeDef = CHAPTER_THEMES['고블린']
      const m = makeMonster(themeDef.normalMonsters[0], chapter, 'normal')
      simSingleCombat(c, m, 400)
    }
  } else if (ev === 'roulette' || ev === 'altar') {
    // skip
  } else if (ev === 'collector') {
    // 거절 — 아무것도 안 함
  }
}

// ── 한 런 전체 자동 ──
interface RunResult {
  cleared: boolean
  diceStats: Stats
  challengeKey: string | null
  finalWeapon: { baseKey: string; trait: string; grade: string } | null
  finalArmor: { baseKey: string; trait: string; grade: string } | null
  reachedChapter: number
}

function autoplayRun(): RunResult {
  // 1) 주사위 + 챌린지
  const dice = generateDice()
  const challenge = pickChallenge(dice)
  const c = createChar(dice, challenge?.instantBonus)
  if (challenge?.instantStartGold) c.gold += challenge.instantStartGold

  // 2) 챕터별 themes (게임처럼 5개 골라 1~5/6~10에 매핑)
  const themePool = [...ALL_THEME_KEYS].sort(() => Math.random() - 0.5).slice(0, 5) as ChapterTheme[]
  const chapters: ChapterTheme[] = []
  for (let i = 0; i < 10; i++) chapters.push(themePool[i < 5 ? i : i - 5])

  let reachedChapter = 0
  for (let ch = 1; ch <= 10; ch++) {
    reachedChapter = ch
    const theme = chapters[ch - 1]
    // 9 일반 층 (실제 게임: 1 shop, 1 treasure, 1 healing, 6 monster, 5% 특별이벤트)
    const floorTypes: string[] = ['shop', 'treasure', 'healing', 'monster', 'monster', 'monster', 'monster', 'monster', 'monster']
    // 5% 확률로 monster 1칸 → special_event
    if (Math.random() < 0.05) {
      const monIdx = floorTypes.findIndex((t, i) => t === 'monster' && i > 3)
      if (monIdx >= 0) floorTypes[monIdx] = 'special'
    }
    // 셔플
    for (let i = floorTypes.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[floorTypes[i], floorTypes[j]] = [floorTypes[j], floorTypes[i]]
    }
    for (let floor = 0; floor < 9; floor++) {
      const ft = floorTypes[floor]
      if (ft === 'monster') {
        if (!simNormalMonsters(c, theme, ch)) return {
          cleared: false, diceStats: dice, challengeKey: challenge?.key ?? null,
          finalWeapon: c.weapon ? { baseKey: c.weapon.baseKey, trait: c.weapon.trait, grade: c.weapon.grade } : null,
          finalArmor: c.armor ? { baseKey: c.armor.baseKey, trait: c.armor.trait, grade: c.armor.grade } : null,
          reachedChapter,
        }
      } else if (ft === 'shop') {
        autoShop(c, ch)
      } else if (ft === 'treasure') {
        takeTreasure(c, ch)
      } else if (ft === 'healing') {
        doHealingSpring(c)
      } else if (ft === 'special') {
        doSpecialEvent(c, ch)
      }
      // 층 진행 후 HP/MP 10% 회복
      c.hp = Math.min(c.maxHp, c.hp + Math.round(c.maxHp * 0.1))
      c.mp = Math.min(c.maxMp, c.mp + Math.round(c.maxMp * 0.1))
    }
    // 10층 보스
    if (!simBoss(c, theme, ch)) return {
      cleared: false, diceStats: dice, challengeKey: challenge?.key ?? null,
      finalWeapon: c.weapon ? { baseKey: c.weapon.baseKey, trait: c.weapon.trait, grade: c.weapon.grade } : null,
      finalArmor: c.armor ? { baseKey: c.armor.baseKey, trait: c.armor.trait, grade: c.armor.grade } : null,
      reachedChapter,
    }
    // 챕터 클리어 시 풀 회복
    c.hp = c.maxHp
    c.mp = c.maxMp
    c.actionGauge = 0
    c.statuses = []
  }
  return {
    cleared: true, diceStats: dice, challengeKey: challenge?.key ?? null,
    finalWeapon: c.weapon ? { baseKey: c.weapon.baseKey, trait: c.weapon.trait, grade: c.weapon.grade } : null,
    finalArmor: c.armor ? { baseKey: c.armor.baseKey, trait: c.armor.trait, grade: c.armor.grade } : null,
    reachedChapter: 10,
  }
}

function run() {
  const RUNS = parseInt(process.env.RUNS || '10000')
  console.log(`\n=== 자동플레이 시뮬레이터 — ${RUNS} 런 ===\n`)
  console.log(`규칙: 주사위 1번만 / 챌린지=최고스탯 매칭 / 암시장=최고스탯 풀매수 / 제단=skip / 대장간=max bet\n`)

  const t0 = Date.now()
  const results: RunResult[] = []
  for (let i = 0; i < RUNS; i++) {
    results.push(autoplayRun())
    if ((i + 1) % 1000 === 0) {
      const elapsed = ((Date.now() - t0) / 1000).toFixed(0)
      process.stdout.write(`  진행 ${i + 1}/${RUNS} (${elapsed}s)\r`)
    }
  }
  const elapsed = ((Date.now() - t0) / 1000).toFixed(1)
  console.log(`\n  소요 ${elapsed}s\n`)

  const cleared = results.filter((r) => r.cleared)
  console.log(`## 전체 클리어률: ${cleared.length}/${results.length} (${(cleared.length / results.length * 100).toFixed(1)}%)`)

  // 도달 챕터 분포
  const reachCount: Record<number, number> = {}
  for (const r of results) reachCount[r.reachedChapter] = (reachCount[r.reachedChapter] ?? 0) + 1
  console.log(`\n## 도달 챕터 분포`)
  for (let ch = 1; ch <= 10; ch++) {
    const cnt = reachCount[ch] ?? 0
    console.log(`  ch${ch.toString().padStart(2)}: ${cnt.toString().padStart(6)} (${(cnt / results.length * 100).toFixed(1)}%)`)
  }

  // 클리어한 캐릭터의 무기 분포
  console.log(`\n## 클리어 시 무기 분포 (n=${cleared.length})`)
  const wCount: Record<string, number> = {}
  const wGradeCount: Record<string, Record<string, number>> = {}
  for (const r of cleared) {
    if (!r.finalWeapon) continue
    const w = r.finalWeapon
    wCount[w.baseKey] = (wCount[w.baseKey] ?? 0) + 1
    if (!wGradeCount[w.baseKey]) wGradeCount[w.baseKey] = {}
    wGradeCount[w.baseKey][w.grade] = (wGradeCount[w.baseKey][w.grade] ?? 0) + 1
  }
  const wRanked = Object.entries(wCount).sort((a, b) => b[1] - a[1])
  console.log(`무기       | 클리어수 | 비율  | 등급 분포`)
  console.log('-----------+----------+-------+----------')
  for (const [k, v] of wRanked) {
    const grades = wGradeCount[k]
    const gstr = ['노말', '레어', '스페셜', '레전드'].map((g) => `${g}${grades[g] ?? 0}`).join('/')
    console.log(`${k.padEnd(10)} | ${v.toString().padStart(7)}  | ${(v / cleared.length * 100).toFixed(1).padStart(5)}% | ${gstr}`)
  }

  // 무기 트레잇 분포
  console.log(`\n## 클리어 시 무기 트레잇 (TOP 10)`)
  const wTraitCount: Record<string, number> = {}
  for (const r of cleared) {
    if (!r.finalWeapon) continue
    const key = `${r.finalWeapon.trait}-${r.finalWeapon.baseKey}`
    wTraitCount[key] = (wTraitCount[key] ?? 0) + 1
  }
  const wtRanked = Object.entries(wTraitCount).sort((a, b) => b[1] - a[1]).slice(0, 10)
  for (const [k, v] of wtRanked) {
    console.log(`  ${k.padEnd(20)} ${v.toString().padStart(5)}  ${(v / cleared.length * 100).toFixed(1)}%`)
  }

  // 갑옷 분포
  console.log(`\n## 클리어 시 갑옷 분포`)
  const aCount: Record<string, number> = {}
  const aGradeCount: Record<string, Record<string, number>> = {}
  for (const r of cleared) {
    if (!r.finalArmor) continue
    const a = r.finalArmor
    aCount[a.baseKey] = (aCount[a.baseKey] ?? 0) + 1
    if (!aGradeCount[a.baseKey]) aGradeCount[a.baseKey] = {}
    aGradeCount[a.baseKey][a.grade] = (aGradeCount[a.baseKey][a.grade] ?? 0) + 1
  }
  const aRanked = Object.entries(aCount).sort((a, b) => b[1] - a[1])
  console.log(`갑옷       | 클리어수 | 비율  | 등급 분포`)
  console.log('-----------+----------+-------+----------')
  for (const [k, v] of aRanked) {
    const grades = aGradeCount[k]
    const gstr = ['노말', '레어', '스페셜', '레전드'].map((g) => `${g}${grades[g] ?? 0}`).join('/')
    console.log(`${k.padEnd(10)} | ${v.toString().padStart(7)}  | ${(v / cleared.length * 100).toFixed(1).padStart(5)}% | ${gstr}`)
  }

  // 무기+갑옷 조합 TOP 10
  console.log(`\n## 클리어 시 무기+갑옷 조합 TOP 10`)
  const comboCount: Record<string, number> = {}
  for (const r of cleared) {
    if (!r.finalWeapon || !r.finalArmor) continue
    const key = `${r.finalWeapon.baseKey} + ${r.finalArmor.baseKey}`
    comboCount[key] = (comboCount[key] ?? 0) + 1
  }
  const cRanked = Object.entries(comboCount).sort((a, b) => b[1] - a[1]).slice(0, 10)
  for (const [k, v] of cRanked) {
    console.log(`  ${k.padEnd(28)} ${v.toString().padStart(5)}  ${(v / cleared.length * 100).toFixed(1)}%`)
  }

  // 챌린지 분포
  console.log(`\n## 클리어 시 챌린지 분포 (TOP 10)`)
  const chCount: Record<string, number> = {}
  for (const r of cleared) {
    const k = r.challengeKey ?? '(none)'
    chCount[k] = (chCount[k] ?? 0) + 1
  }
  const chRanked = Object.entries(chCount).sort((a, b) => b[1] - a[1]).slice(0, 10)
  for (const [k, v] of chRanked) {
    console.log(`  ${k.padEnd(20)} ${v.toString().padStart(5)}  ${(v / cleared.length * 100).toFixed(1)}%`)
  }
}

if (typeof process !== 'undefined' && process.argv?.[1]?.includes('autoplayClear')) {
  run()
}
