// ============================================================
// 5티어 무기/방어구 (레어 + 하급 트레잇) + 노챌린지 조건에서
// 100층 클리어률 60% 이상을 위한 스탯 임계점 측정
//
// 조건:
//   - 무기: 무작위 (15종), tier 5 (레어 + 하급 트레잇) 고정
//   - 갑옷: 무작위 (마법무기 → 로브 강제), tier 5 고정
//   - 챌린지 없음 (메타 보너스 0)
//   - 100층 = 10챕터 × (6 일반몹 + 1 보스)
//   - 챕터 사이 풀 HP/MP, 각 floor 후 10% 회복
//
// 사용: npx tsx src/core/__sim__/clearStatThreshold.ts
// ============================================================

import {
  createCombatContext, makeMonster, advanceTick, checkActionReady,
  monsterAttack, consumeAction, playerBasicAttack,
} from '../combat'
import { computeEffectiveStats } from '../stats'
import { useSkill, pickAutoAction } from '../skills'
import { rollItem } from '../items'
import { computeMaxHp, computeMaxMp } from '../character'
import { CHAPTER_THEMES, ALL_THEME_KEYS } from '@/data/chapters'
import { WEAPON_KEYS, WEAPONS } from '@/data/weapons'
import { ARMOR_KEYS } from '@/data/armor'
import type { Character, Stats, ChapterTheme, MonsterTemplate, MonsterInstance, ItemInstance } from '@/types'

function makeChar(stats: Stats, w: ItemInstance, a: ItemInstance): Character {
  return {
    stats: { ...stats },
    hp: computeMaxHp(stats.체력), maxHp: computeMaxHp(stats.체력),
    mp: computeMaxMp(stats.마력), maxMp: computeMaxMp(stats.마력),
    weapon: w, armor: a, gold: 0, statuses: [], actionGauge: 0,
  }
}

function simCombat(c: Character, monster: MonsterInstance, maxTicks = 800): boolean {
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
  return ctx.victory
}

function simFullClear(stats: Stats): boolean {
  // 장비 추첨 (tier 5 = 레어 + 하급)
  const wKey = WEAPON_KEYS[Math.floor(Math.random() * WEAPON_KEYS.length)]
  const isMagic = WEAPONS[wKey].isMagic
  const w = rollItem({ kind: 'weapon', forceBaseKey: wKey, forceGrade: '레어', forceTraitTier: '하급' })
  const aKey = isMagic ? '로브' : ARMOR_KEYS[Math.floor(Math.random() * ARMOR_KEYS.length)]
  const a = rollItem({ kind: 'armor', forceBaseKey: aKey, forceGrade: '레어', forceTraitTier: '하급' })
  const c = makeChar(stats, w, a)

  // 챕터별 테마 (5개 풀에서 → 1~5 base, 6~10 hard)
  const pool = [...ALL_THEME_KEYS].sort(() => Math.random() - 0.5).slice(0, 5) as ChapterTheme[]
  const chapters: ChapterTheme[] = []
  for (let i = 0; i < 10; i++) chapters.push(pool[i < 5 ? i : i - 5])

  for (let ch = 1; ch <= 10; ch++) {
    const theme = chapters[ch - 1]
    const tdef = CHAPTER_THEMES[theme]
    // 6 일반몹 (각 1~2마리)
    for (let i = 0; i < 6; i++) {
      const cnt = 1 + Math.floor(Math.random() * 2)
      for (let m = 0; m < cnt; m++) {
        const tmpl: MonsterTemplate = tdef.normalMonsters[Math.floor(Math.random() * tdef.normalMonsters.length)]
        const mob = makeMonster(tmpl, ch, 'normal')
        if (!simCombat(c, mob)) return false
      }
      // floor 회복 10%
      c.hp = Math.min(c.maxHp, c.hp + Math.round(c.maxHp * 0.1))
      c.mp = Math.min(c.maxMp, c.mp + Math.round(c.maxMp * 0.1))
    }
    // 보스
    const boss = makeMonster(tdef.boss, ch, 'boss')
    if (!simCombat(c, boss)) return false
    // 챕터 사이 풀 회복
    c.hp = c.maxHp; c.mp = c.maxMp; c.statuses = []; c.actionGauge = 0
  }
  return true
}

function evenSplit(total: number): Stats {
  const per = Math.floor(total / 5)
  const rem = total - per * 5
  const s: Stats = { 힘: per, 민첩: per, 체력: per, 마력: per, 행운: per }
  const keys: (keyof Stats)[] = ['힘', '민첩', '체력', '마력', '행운']
  for (let i = 0; i < rem; i++) s[keys[i]] += 1
  return s
}

function run() {
  const RUNS = parseInt(process.env.RUNS || '500')
  const budgets = [60, 80, 100, 120, 150, 200, 250, 300, 400, 500, 700, 1000]
  console.log(`\n=== 5티어 무기/갑옷 (레어+하급) + 노챌린지 — 100층 클리어률 vs 스탯 ===`)
  console.log(`각 budget × ${RUNS} 런, 균등 분배 (총합/5씩)\n`)
  console.log(`총스탯 | 분배(균등) | 클리어률 | (60% 임계)`)
  console.log('-------+-----------+----------+----------')
  const t0 = Date.now()
  let prevRate = 0, threshold = -1
  for (const b of budgets) {
    const stats = evenSplit(b)
    let wins = 0
    for (let i = 0; i < RUNS; i++) {
      if (simFullClear(stats)) wins++
    }
    const rate = wins / RUNS
    const dist = `${stats.힘}/${stats.민첩}/${stats.체력}/${stats.마력}/${stats.행운}`
    const marker = rate >= 0.60 ? '✅' : (rate >= 0.50 ? '🟡' : '')
    console.log(`${b.toString().padStart(5)} | ${dist.padEnd(10)} | ${(rate * 100).toFixed(1).padStart(7)}% | ${marker}`)
    if (threshold < 0 && prevRate < 0.60 && rate >= 0.60) threshold = b
    prevRate = rate
  }
  console.log(`\n소요: ${((Date.now() - t0) / 1000).toFixed(1)}s`)
  if (threshold > 0) console.log(`\n60% 임계 budget (균등 분배): 약 ${threshold} pt`)
  else console.log(`\n60% 임계 도달 못함 — 더 큰 스탯 budget 필요 (or 분배 최적화)`)

  // 분배 형태별 비교 (60% 근처 budget 에서)
  if (threshold > 0) {
    console.log(`\n## ${threshold}pt 에서 분배별 비교`)
    const builds: { name: string; stats: Stats }[] = [
      { name: '균등', stats: evenSplit(threshold) },
      { name: '힘몰빵', stats: { 힘: threshold - 40, 민첩: 10, 체력: 10, 마력: 10, 행운: 10 } },
      { name: '민첩몰빵', stats: { 힘: 10, 민첩: threshold - 40, 체력: 10, 마력: 10, 행운: 10 } },
      { name: '체력몰빵', stats: { 힘: 10, 민첩: 10, 체력: threshold - 40, 마력: 10, 행운: 10 } },
      { name: '마력몰빵', stats: { 힘: 10, 민첩: 10, 체력: 10, 마력: threshold - 40, 행운: 10 } },
      { name: '행운몰빵', stats: { 힘: 10, 민첩: 10, 체력: 10, 마력: 10, 행운: threshold - 40 } },
      { name: '힘+체력', stats: { 힘: (threshold - 20) / 2 | 0, 민첩: 10, 체력: (threshold - 20) / 2 | 0, 마력: 0, 행운: 10 } },
      { name: '마+체력', stats: { 힘: 0, 민첩: 10, 체력: (threshold - 20) / 2 | 0, 마력: (threshold - 20) / 2 | 0, 행운: 10 } },
    ]
    for (const b of builds) {
      let wins = 0
      for (let i = 0; i < RUNS; i++) if (simFullClear(b.stats)) wins++
      const rate = wins / RUNS
      const d = `${b.stats.힘}/${b.stats.민첩}/${b.stats.체력}/${b.stats.마력}/${b.stats.행운}`
      console.log(`  ${b.name.padEnd(10)} ${d.padEnd(20)}  ${(rate * 100).toFixed(1)}%`)
    }
  }
}

if (typeof process !== 'undefined' && process.argv?.[1]?.includes('clearStatThreshold')) {
  run()
}

// 민첩 위주 빌드 — 60% 도달 최저 budget 탐색
function runAgilityFocused() {
  const RUNS = parseInt(process.env.RUNS || '500')
  console.log(`\n\n=== 민첩 위주 빌드 — 60% 클리어 최저 budget 탐색 ===\n`)
  console.log(`분배: 힘10/체력10/마력10/행운10 + 나머지 모두 민첩`)
  console.log(`총스탯 | 민첩 | 클리어률`)
  console.log('-------+------+--------')
  const budgets = [60, 80, 100, 120, 140, 160, 180, 200, 250, 300]
  for (const b of budgets) {
    const agi = Math.max(0, b - 40)  // 10×4 다른 스탯
    const stats: Stats = { 힘: 10, 민첩: agi, 체력: 10, 마력: 10, 행운: 10 }
    let wins = 0
    for (let i = 0; i < RUNS; i++) if (simFullClear(stats)) wins++
    const rate = wins / RUNS
    const marker = rate >= 0.60 ? '✅' : (rate >= 0.50 ? '🟡' : '')
    console.log(`${b.toString().padStart(5)} | ${agi.toString().padStart(4)} | ${(rate * 100).toFixed(1).padStart(6)}% ${marker}`)
  }
}

if (typeof process !== 'undefined' && process.argv?.[1]?.includes('clearStatThreshold')) {
  runAgilityFocused()
}
