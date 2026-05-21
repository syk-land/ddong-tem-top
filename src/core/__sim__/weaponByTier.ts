// ============================================================
// 무기 × 티어(6~12) × 스탯빌드 매트릭스 시뮬
// 각 (빌드, 무기, 티어) 조합 100런, 방어구 = 레어 무작위 (5~6 티어)
// ============================================================

import {
  createCombatContext, makeMonster, advanceTick, checkActionReady,
  monsterAttack, consumeAction, playerBasicAttack,
} from '../combat'
import { computeEffectiveStats } from '../stats'
import { useSkill, pickAutoAction } from '../skills'
import { rollItem } from '../items'
import { CHAPTER_THEMES } from '@/data/chapters'
import { ARMOR_KEYS } from '@/data/armor'
import { WEAPON_KEYS } from '@/data/weapons'
import { tierToCombo } from '../items'
import type { Character, ChapterTheme, TraitTier, ItemInstance, Stats } from '@/types'
import { computeMaxHp, computeMaxMp } from '../character'

const ALL_THEMES: ChapterTheme[] = [
  '고블린', '골렘', '언데드', '환영', '흡혈귀',
  '심해', '기계', '용암', '암흑', '천공', '맹독',
]

function rollStartingArmor(): ItemInstance {
  const armorKey = ARMOR_KEYS[Math.floor(Math.random() * ARMOR_KEYS.length)]
  const traitTier: TraitTier = Math.random() < 0.5 ? '하급' : '보통'
  return rollItem({
    kind: 'armor',
    forceBaseKey: armorKey,
    forceGrade: '레어',
    forceTraitTier: traitTier,
  })
}

function makeCharacter(stats: Stats, weapon: ItemInstance, armor: ItemInstance): Character {
  return {
    stats,
    hp: computeMaxHp(stats.체력),
    maxHp: computeMaxHp(stats.체력),
    mp: computeMaxMp(stats.마력),
    maxMp: computeMaxMp(stats.마력),
    weapon, armor,
    gold: 100,
    statuses: [],
    actionGauge: 0,
  }
}

function simBossFight(chapter: number, theme: ChapterTheme, character: Character): boolean {
  const themeDef = CHAPTER_THEMES[theme]
  const boss = makeMonster(themeDef.boss, chapter, 'boss')
  character.hp = character.maxHp
  character.mp = character.maxMp
  character.statuses = []
  character.actionGauge = 0
  const ctx = createCombatContext(character, boss)
  const MAX_TICKS = 800
  while (!ctx.ended && ctx.tick < MAX_TICKS) {
    advanceTick(ctx)
    const playerEff = computeEffectiveStats(ctx.player)
    const ready = checkActionReady(ctx, playerEff.무기ticks)
    for (const m of ready.readyMonsters) {
      if (ctx.ended) break
      monsterAttack(ctx, m)
      consumeAction(m, m.ticks)
    }
    if (!ctx.ended && ctx.player.actionGauge >= playerEff.무기ticks) {
      const action = pickAutoAction(ctx, {})
      if (action.kind === 'skill') {
        if (!useSkill(ctx, action.key)) playerBasicAttack(ctx)
      } else {
        playerBasicAttack(ctx)
      }
      consumeAction(ctx.player, playerEff.무기ticks)
    }
  }
  return ctx.victory
}

function simOneRun(stats: Stats, weaponKey: string, tier: number): boolean {
  const { trait_tier, grade } = tierToCombo(tier)
  const weapon = rollItem({
    kind: 'weapon',
    forceBaseKey: weaponKey,
    forceGrade: grade,
    forceTraitTier: trait_tier,
  })
  const armor = rollStartingArmor()
  const character = makeCharacter(stats, weapon, armor)
  const themes = [...ALL_THEMES]
  for (let i = themes.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[themes[i], themes[j]] = [themes[j], themes[i]]
  }
  for (let ch = 1; ch <= 10; ch++) {
    if (!simBossFight(ch, themes[ch - 1], character)) return false
  }
  return true
}

interface Build { label: string; stats: Stats }

function makeBuilds(): Build[] {
  const base: Stats = { 힘:10, 민첩:10, 체력:10, 마력:10, 행운:10 }
  const m = (k: keyof Stats, v: number): Stats => ({ ...base, [k]: v })
  return [
    { label: '균등12', stats: { 힘:12, 민첩:12, 체력:12, 마력:12, 행운:12 } },
    { label: '힘20',  stats: m('힘', 20) },
    { label: '민첩20', stats: m('민첩', 20) },
    { label: '체력20', stats: m('체력', 20) },
    { label: '마력20', stats: m('마력', 20) },
    { label: '행운20', stats: m('행운', 20) },
  ]
}

const TIERS = [6, 7, 8, 9, 10, 11, 12]

function runCli() {
  const RUNS = 100
  const builds = makeBuilds()
  console.log(`\n=== 무기×티어(6~12)×빌드 매트릭스 (각 셀 ${RUNS}런) ===`)
  console.log(`방어구=레어 무작위, 무기 한 자루 고정\n`)

  const t0 = Date.now()
  // results[buildLabel][weaponKey] = avg over tiers
  // detail[buildLabel][weaponKey][tier] = rate
  const detail: Record<string, Record<string, Record<number, number>>> = {}
  for (const b of builds) {
    detail[b.label] = {}
    for (const w of WEAPON_KEYS) {
      detail[b.label][w] = {}
      for (const t of TIERS) {
        let wins = 0
        for (let i = 0; i < RUNS; i++) {
          if (simOneRun(b.stats, w, t)) wins++
        }
        detail[b.label][w][t] = wins / RUNS
      }
    }
  }
  const elapsed = ((Date.now() - t0) / 1000).toFixed(1)

  // 빌드별 무기별 티어 평균 클리어율 매트릭스
  for (const b of builds) {
    console.log(`\n## ${b.label} — 무기별 티어 6~12 평균 클리어율`)
    // 정렬용 평균 계산
    const rows = WEAPON_KEYS.map(w => {
      const rates = TIERS.map(t => detail[b.label][w][t])
      const avg = rates.reduce((s, r) => s + r, 0) / TIERS.length
      return { w, avg, rates }
    })
    rows.sort((a, b) => b.avg - a.avg)
    const tierHeader = TIERS.map(t => `T${t}`.padStart(5)).join(' | ')
    console.log(`순위 | 무기              | 평균   | ${tierHeader}`)
    console.log(`-----+-------------------+--------+${'-'.repeat(tierHeader.length)}`)
    rows.forEach((r, i) => {
      const tierVals = r.rates.map(rate => `${(rate*100).toFixed(0)}%`.padStart(5)).join(' | ')
      console.log(`${(i+1).toString().padStart(3)} | ${r.w.padEnd(17)} | ${(r.avg*100).toFixed(1).padStart(5)}% | ${tierVals}`)
    })
    // 빌드 전체 평균
    const overall = rows.reduce((s, r) => s + r.avg, 0) / rows.length
    console.log(`> 빌드 전체 평균: ${(overall*100).toFixed(1)}%`)
  }

  console.log(`\n=== 소요: ${elapsed}s, 총 ${builds.length * WEAPON_KEYS.length * TIERS.length * RUNS}런 ===`)

  // 무기간 균등도 (분산) — 각 빌드에서 무기별 평균의 표준편차
  console.log(`\n## 무기 균등도 (빌드별, 표준편차 / 분포)`)
  for (const b of builds) {
    const avgs = WEAPON_KEYS.map(w => {
      const rates = TIERS.map(t => detail[b.label][w][t])
      return rates.reduce((s, r) => s + r, 0) / TIERS.length
    })
    const mean = avgs.reduce((s, r) => s + r, 0) / avgs.length
    const variance = avgs.reduce((s, r) => s + (r - mean) ** 2, 0) / avgs.length
    const sd = Math.sqrt(variance)
    const min = Math.min(...avgs)
    const max = Math.max(...avgs)
    console.log(`  ${b.label.padEnd(7)} mean=${(mean*100).toFixed(1)}% sd=${(sd*100).toFixed(1)}%p  범위 [${(min*100).toFixed(1)}% ~ ${(max*100).toFixed(1)}%]`)
  }
}

if (typeof process !== 'undefined' && process.argv?.[1]?.includes('weaponByTier')) {
  runCli()
}
