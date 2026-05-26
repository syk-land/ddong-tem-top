// ============================================================
// 전체 클리어 소요 시간 측정 — autoplayClear 와 동일 자동플레이 정책으로
// 챕터 1→10 클리어까지 누적 전투 tick 을 측정.
// 1 tick = 100ms(1배속). 4배속 = 25ms/tick.
// ============================================================

import {
  createCombatContext, makeMonster, advanceTick, checkActionReady,
  monsterAttack, consumeAction, playerBasicAttack,
} from '../combat'
import { computeEffectiveStats } from '../stats'
import { useSkill, pickAutoAction } from '../skills'
import { rollItem } from '../items'
import {
  applySmithUpgrade, buyStatPoint,
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

function generateDice(): Stats {
  const s: Stats = { 힘: 0, 민첩: 0, 체력: 0, 마력: 0, 행운: 0 }
  const keys: StatKey[] = ['힘', '민첩', '체력', '마력', '행운']
  let rem = 60
  while (rem > 0) {
    s[keys[Math.floor(Math.random() * keys.length)]] += 1
    rem--
  }
  return s
}

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
  const opts = [...CHALLENGES].sort(() => Math.random() - 0.5).slice(0, 3)
  const sortedStats: StatKey[] = (['힘', '민첩', '체력', '마력', '행운'] as StatKey[])
    .sort((a, b) => diceStats[b] - diceStats[a])
  for (const sk of sortedStats) {
    const match = opts.find((c) => challengeStat(c) === sk)
    if (match) return match
  }
  return null
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

interface CombatResult { win: boolean; ticks: number }
function simSingleCombat(c: Character, monster: MonsterInstance, maxTicks = 800): CombatResult {
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

function simNormalMonsters(c: Character, theme: ChapterTheme, chapter: number): CombatResult {
  const themeDef = CHAPTER_THEMES[theme]
  const count = 1 + Math.floor(Math.random() * 2)
  let totalTicks = 0
  for (let i = 0; i < count; i++) {
    const tmpl: MonsterTemplate = themeDef.normalMonsters[Math.floor(Math.random() * themeDef.normalMonsters.length)]
    const m = makeMonster(tmpl, chapter, 'normal')
    if (c.hp <= 0) return { win: false, ticks: totalTicks }
    const r = simSingleCombat(c, m)
    totalTicks += r.ticks
    if (!r.win) return { win: false, ticks: totalTicks }
  }
  return { win: true, ticks: totalTicks }
}

function simBoss(c: Character, theme: ChapterTheme, chapter: number): CombatResult {
  const themeDef = CHAPTER_THEMES[theme]
  const m = makeMonster(themeDef.boss, chapter, 'boss')
  return simSingleCombat(c, m)
}

function highestStat(stats: Stats): StatKey {
  let best: StatKey = '힘'
  for (const k of ['힘', '민첩', '체력', '마력', '행운'] as StatKey[]) {
    if (stats[k] > stats[best]) best = k
  }
  return best
}

function doBlackMarket(c: Character, chapter: number) {
  const target = highestStat(c.stats)
  while (buyStatPoint(c, chapter, target)) { /* continue */ }
}

function doSmith(c: Character) {
  if (!c.weapon) return
  const maxBet = Math.min(c.gold, c.weapon.sellPrice * 2)
  if (maxBet > 0) applySmithUpgrade(c, maxBet)
}

function shouldEquipArmor(c: Character, it: ItemInstance): boolean {
  const cur = c.armor
  if (!cur) return true
  const magic = isMagicWeapon(c)
  if (magic) {
    if (cur.baseKey !== '로브' && it.baseKey === '로브') return true
    if (cur.baseKey === '로브' && it.baseKey !== '로브') return false
    return it.tier > cur.tier
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
  inventory.sort((a, b) => {
    const aBonus = (magic && a.kind === 'armor' && a.baseKey === '로브') ? 100 : 0
    const bBonus = (magic && b.kind === 'armor' && b.baseKey === '로브') ? 100 : 0
    return (b.tier + bBonus) - (a.tier + aBonus)
  })
  for (const it of inventory) {
    if (c.gold < it.buyPrice) continue
    if (it.kind === 'weapon') {
      const cur = c.weapon
      if (!cur || it.tier > cur.tier) { c.gold -= it.buyPrice; c.weapon = it }
    } else {
      if (shouldEquipArmor(c, it)) { c.gold -= it.buyPrice; c.armor = it }
    }
  }
}

function doHealingSpring(c: Character) {
  c.hp = c.maxHp; c.mp = c.maxMp
}

function doSpecialEvent(c: Character, chapter: number): number {
  const events = ['smith', 'blackmarket', 'crisis', 'roulette', 'altar', 'collector']
  const ev = events[Math.floor(Math.random() * events.length)]
  let extraTicks = 0
  if (ev === 'smith') {
    doSmith(c)
  } else if (ev === 'blackmarket') {
    doBlackMarket(c, chapter)
  } else if (ev === 'crisis') {
    if (Math.random() < 0.7) c.gold += 50
    else {
      const themeDef = CHAPTER_THEMES['고블린']
      const m = makeMonster(themeDef.normalMonsters[0], chapter, 'normal')
      const r = simSingleCombat(c, m, 400)
      extraTicks += r.ticks
    }
  }
  return extraTicks
}

interface RunMetric {
  cleared: boolean
  reachedChapter: number
  combatTicks: number             // 누적 전투 tick
  combatCount: number             // 전투 횟수 (단일 simSingleCombat 호출)
  bossTicks: number               // 보스 전투 tick
  normalTicks: number             // 일반/특별 이벤트 전투 tick
  shopFloors: number
  treasureFloors: number
  healingFloors: number
  specialFloors: number
  bossFloors: number              // 클리어한 보스 수
}

function autoplayRunMetric(): RunMetric {
  const dice = generateDice()
  const challenge = pickChallenge(dice)
  const c = createChar(dice, challenge?.instantBonus)
  if (challenge?.instantStartGold) c.gold += challenge.instantStartGold

  const themePool = [...ALL_THEME_KEYS].sort(() => Math.random() - 0.5).slice(0, 5) as ChapterTheme[]
  const chapters: ChapterTheme[] = []
  for (let i = 0; i < 10; i++) chapters.push(themePool[i < 5 ? i : i - 5])

  const m: RunMetric = {
    cleared: false, reachedChapter: 0,
    combatTicks: 0, combatCount: 0, bossTicks: 0, normalTicks: 0,
    shopFloors: 0, treasureFloors: 0, healingFloors: 0, specialFloors: 0, bossFloors: 0,
  }

  for (let ch = 1; ch <= 10; ch++) {
    m.reachedChapter = ch
    const theme = chapters[ch - 1]
    const floorTypes: string[] = ['shop', 'treasure', 'healing', 'monster', 'monster', 'monster', 'monster', 'monster', 'monster']
    if (Math.random() < 0.05) {
      const monIdx = floorTypes.findIndex((t, i) => t === 'monster' && i > 3)
      if (monIdx >= 0) floorTypes[monIdx] = 'special'
    }
    for (let i = floorTypes.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[floorTypes[i], floorTypes[j]] = [floorTypes[j], floorTypes[i]]
    }
    for (let floor = 0; floor < 9; floor++) {
      const ft = floorTypes[floor]
      if (ft === 'monster') {
        const r = simNormalMonsters(c, theme, ch)
        m.combatTicks += r.ticks
        m.normalTicks += r.ticks
        // 전투 1마리당 카운트 하기 어려워 평균적으로 1.5 추가 처리
        m.combatCount += 1
        if (!r.win) return m
      } else if (ft === 'shop') {
        autoShop(c, ch); m.shopFloors++
      } else if (ft === 'treasure') {
        takeTreasure(c, ch); m.treasureFloors++
      } else if (ft === 'healing') {
        doHealingSpring(c); m.healingFloors++
      } else if (ft === 'special') {
        const extra = doSpecialEvent(c, ch); m.combatTicks += extra; m.normalTicks += extra; m.specialFloors++
      }
      c.hp = Math.min(c.maxHp, c.hp + Math.round(c.maxHp * 0.1))
      c.mp = Math.min(c.maxMp, c.mp + Math.round(c.maxMp * 0.1))
    }
    const br = simBoss(c, theme, ch)
    m.combatTicks += br.ticks
    m.bossTicks += br.ticks
    m.combatCount += 1
    if (!br.win) return m
    m.bossFloors++
    c.hp = c.maxHp; c.mp = c.maxMp; c.actionGauge = 0; c.statuses = []
  }
  m.cleared = true
  return m
}

function run() {
  const RUNS = parseInt(process.env.RUNS || '5000')
  console.log(`\n=== 전체 클리어 소요 시간 측정 — ${RUNS} 런 ===`)
  console.log(`BASE_INTERVAL=100ms / 1tick = 100ms (1배속), 25ms (4배속)\n`)

  const t0 = Date.now()
  const results: RunMetric[] = []
  for (let i = 0; i < RUNS; i++) {
    results.push(autoplayRunMetric())
    if ((i + 1) % 500 === 0) {
      const el = ((Date.now() - t0) / 1000).toFixed(0)
      process.stdout.write(`  진행 ${i + 1}/${RUNS} (${el}s)\r`)
    }
  }
  console.log(`\n  측정 소요 ${((Date.now() - t0) / 1000).toFixed(1)}s\n`)

  const cleared = results.filter((r) => r.cleared)
  console.log(`전체 클리어률: ${cleared.length}/${results.length} (${(cleared.length / results.length * 100).toFixed(1)}%)`)
  console.log(`(중도 실패 런 제외하고 '클리어한 런' 만으로 시간 통계 산출)\n`)

  if (cleared.length === 0) {
    console.log('클리어한 런이 없어 시간 측정 불가')
    return
  }

  // 통계 함수
  const stat = (arr: number[]) => {
    const sorted = [...arr].sort((a, b) => a - b)
    const mean = arr.reduce((s, x) => s + x, 0) / arr.length
    const p = (q: number) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * q))]
    return { mean, p25: p(0.25), p50: p(0.5), p75: p(0.75), p90: p(0.9), min: sorted[0], max: sorted[sorted.length - 1] }
  }

  const ticks = cleared.map((r) => r.combatTicks)
  const bossTicks = cleared.map((r) => r.bossTicks)
  const normalTicks = cleared.map((r) => r.normalTicks)
  const combatCounts = cleared.map((r) => r.combatCount)

  const tStat = stat(ticks)
  const bStat = stat(bossTicks)
  const nStat = stat(normalTicks)
  const cStat = stat(combatCounts)

  console.log(`## 누적 전투 tick (1게임 전체)`)
  console.log(`  mean=${tStat.mean.toFixed(0)} / p25=${tStat.p25} / p50=${tStat.p50} / p75=${tStat.p75} / p90=${tStat.p90}`)
  console.log(`  min=${tStat.min} / max=${tStat.max}`)
  console.log(`\n## 보스 전투 tick (10보스 합산)`)
  console.log(`  mean=${bStat.mean.toFixed(0)} / p50=${bStat.p50} / p90=${bStat.p90}`)
  console.log(`\n## 일반 + 특별이벤트 전투 tick`)
  console.log(`  mean=${nStat.mean.toFixed(0)} / p50=${nStat.p50} / p90=${nStat.p90}`)
  console.log(`\n## 1게임 당 전투 횟수 (simSingleCombat 호출 - 일반층은 묶음 1회로 카운트)`)
  console.log(`  mean=${cStat.mean.toFixed(1)} / p50=${cStat.p50}`)

  // 시간 변환
  console.log(`\n=== 실시간 환산 (전투 시간만, 인터미션 제외) ===`)
  const speeds = [1, 2, 4]
  for (const sp of speeds) {
    const msPerTick = 100 / sp
    const mean_s = tStat.mean * msPerTick / 1000
    const p50_s = tStat.p50 * msPerTick / 1000
    const p90_s = tStat.p90 * msPerTick / 1000
    console.log(`  ${sp}배속: 평균 ${(mean_s / 60).toFixed(1)}분 (${mean_s.toFixed(0)}s) | 중앙값 ${(p50_s / 60).toFixed(1)}분 | p90 ${(p90_s / 60).toFixed(1)}분`)
  }

  // 인터미션 추정 (유저 입력 기반)
  // - 일반 몬스터 층 진입 결과창: 클리어 후 자동전환에 ~1.5s
  // - 상점 1회: 6장비 검토 + 구매 → 약 12s
  // - 보물상자: 약 4s
  // - 회복샘: 약 2s
  // - 특별이벤트: 약 8s
  // - 보스 사전 준비/연출: 약 5s
  const shopFloors = cleared.reduce((s, r) => s + r.shopFloors, 0) / cleared.length
  const treasureFloors = cleared.reduce((s, r) => s + r.treasureFloors, 0) / cleared.length
  const healingFloors = cleared.reduce((s, r) => s + r.healingFloors, 0) / cleared.length
  const specialFloors = cleared.reduce((s, r) => s + r.specialFloors, 0) / cleared.length
  const bossFloors = cleared.reduce((s, r) => s + r.bossFloors, 0) / cleared.length
  const normalMonsterFloors = 90 - shopFloors - treasureFloors - healingFloors - specialFloors - bossFloors  // 1게임 = 100층, 보스는 10층

  const intermissionS =
    shopFloors * 12 +
    treasureFloors * 4 +
    healingFloors * 2 +
    specialFloors * 8 +
    bossFloors * 5 +
    normalMonsterFloors * 1.5 +
    10 /* 캐릭터 생성/주사위/챌린지 선택 */

  console.log(`\n## 인터미션 추정 (UI 인터랙션 시간 — 배속 영향 없음)`)
  console.log(`  shop ${shopFloors.toFixed(1)}×12s + treasure ${treasureFloors.toFixed(1)}×4s + healing ${healingFloors.toFixed(1)}×2s`)
  console.log(`  + special ${specialFloors.toFixed(1)}×8s + boss ${bossFloors.toFixed(1)}×5s + normal-floor 자동전환 ${normalMonsterFloors.toFixed(1)}×1.5s + 초기 10s`)
  console.log(`  → 총 인터미션 ≈ ${(intermissionS / 60).toFixed(1)}분 (${intermissionS.toFixed(0)}s)`)

  console.log(`\n=== 총 소요 시간 (전투+인터미션) ===`)
  for (const sp of speeds) {
    const msPerTick = 100 / sp
    const mean_s = tStat.mean * msPerTick / 1000 + intermissionS
    const p50_s = tStat.p50 * msPerTick / 1000 + intermissionS
    const p90_s = tStat.p90 * msPerTick / 1000 + intermissionS
    console.log(`  ${sp}배속: 평균 ${(mean_s / 60).toFixed(1)}분 / 중앙값 ${(p50_s / 60).toFixed(1)}분 / p90 ${(p90_s / 60).toFixed(1)}분`)
  }
}

if (typeof process !== 'undefined' && process.argv?.[1]?.includes('measureClearTime')) {
  run()
}
