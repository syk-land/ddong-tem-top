// ============================================================
// 스탯별 무기 클리어율 시뮬
// 각 5스탯(힘/민첩/체력/마력/행운) × 레벨(20/30) 조합으로 무기 100층 종주
// 방어구는 레어 무작위, 무기는 고정(레어+보통)
// ============================================================

import {
  createCombatContext, makeMonster, advanceTick, checkActionReady,
  monsterAttack, consumeAction, playerBasicAttack,
} from '../combat'
import { useSkill, pickAutoAction } from '../skills'
import { rollItem } from '../items'
import { CHAPTER_THEMES } from '@/data/chapters'
import { ARMOR_KEYS } from '@/data/armor'
import { WEAPON_KEYS, WEAPONS } from '@/data/weapons'
import type { Character, ChapterTheme, Grade, TraitTier, ItemInstance, Stats } from '@/types'
import { computeMaxHp, computeMaxMp } from '../character'

const ALL_THEMES: ChapterTheme[] = [
  '고블린', '골렘', '언데드', '환영', '흡혈귀',
  '심해', '기계', '용암', '암흑', '천공', '맹독',
]

function rollStartingArmor(forceKey?: string): ItemInstance {
  const armorKey = forceKey ?? ARMOR_KEYS[Math.floor(Math.random() * ARMOR_KEYS.length)]
  const traitTier: TraitTier = Math.random() < 0.5 ? '하급' : '보통'
  return rollItem({
    kind: 'armor',
    forceBaseKey: armorKey,
    forceGrade: '레어',
    forceTraitTier: traitTier,
  })
}

const MAGIC_WEAPON_KEYS = WEAPON_KEYS.filter(k => WEAPONS[k].isMagic)

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
    const ready = checkActionReady(ctx)
    for (const m of ready.readyMonsters) {
      if (ctx.ended) break
      monsterAttack(ctx, m)
      consumeAction(m)
    }
    if (!ctx.ended && ctx.player.actionGauge >= 100) {
      const action = pickAutoAction(ctx, {})
      if (action.kind === 'skill') {
        if (!useSkill(ctx, action.key)) playerBasicAttack(ctx)
      } else {
        playerBasicAttack(ctx)
      }
      consumeAction(ctx.player)
    }
  }
  return ctx.victory
}

function simOneRun(stats: Stats, weaponKey: string, armorOverride?: string): boolean {
  const weapon = rollItem({
    kind: 'weapon',
    forceBaseKey: weaponKey,
    forceGrade: '레어',
    forceTraitTier: '보통',
  })
  const armor = rollStartingArmor(armorOverride)
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

const STAT_KEYS: (keyof Stats)[] = ['힘', '민첩', '체력', '마력', '행운']

interface Build {
  label: string
  stats: Stats
  // 빌드 제약 (없으면 ARMOR_KEYS 전체 / WEAPON_KEYS 전체)
  armorOverride?: string         // 방어구 종류 고정
  weaponFilter?: (key: string) => boolean  // 측정할 무기 필터
  weaponLabel?: string           // 제약 표시용
}

function makeBuilds(): Build[] {
  const builds: Build[] = []
  // 균등 빌드 (10/15/20)
  builds.push({ label: '균등10', stats: { 힘:10, 민첩:10, 체력:10, 마력:10, 행운:10 } })
  builds.push({ label: '균등15', stats: { 힘:15, 민첩:15, 체력:15, 마력:15, 행운:15 } })
  builds.push({ label: '균등20', stats: { 힘:20, 민첩:20, 체력:20, 마력:20, 행운:20 } })
  // 각 스탯 +10 (= 20) — 나머지 10
  for (const k of STAT_KEYS) {
    const s: Stats = { 힘:10, 민첩:10, 체력:10, 마력:10, 행운:10 }
    s[k] = 20
    builds.push({ label: `${k}20`, stats: s })
  }
  // 각 스탯 +20 (= 30) — 나머지 10
  for (const k of STAT_KEYS) {
    const s: Stats = { 힘:10, 민첩:10, 체력:10, 마력:10, 행운:10 }
    s[k] = 30
    builds.push({ label: `${k}30`, stats: s })
  }
  // 마력 빌드 제약 버전 — 로브 + 마법무기만
  const magicConstraint = {
    armorOverride: '로브',
    weaponFilter: (k: string) => WEAPONS[k].isMagic,
    weaponLabel: '로브+마법무기',
  }
  for (const v of [20, 30]) {
    const s: Stats = { 힘:10, 민첩:10, 체력:10, 마력:10, 행운:10 }
    s.마력 = v
    builds.push({ label: `마력${v}+로브마법`, stats: s, ...magicConstraint })
  }
  return builds
}

function runCli() {
  const RUNS = 200
  const builds = makeBuilds()
  console.log(`\n=== 스탯별 무기 클리어율 매트릭스 (각 조합 ${RUNS}런) ===`)
  console.log(`무기: 레어+보통 고정, 방어구: 레어 무작위, 챕터 진행 중 교체 없음\n`)

  const t0 = Date.now()
  // results[buildLabel][weaponKey] = rate
  const results: Record<string, Record<string, number>> = {}
  for (const b of builds) {
    results[b.label] = {}
    const weaponsForBuild = b.weaponFilter ? WEAPON_KEYS.filter(b.weaponFilter) : WEAPON_KEYS
    for (const w of weaponsForBuild) {
      let wins = 0
      for (let i = 0; i < RUNS; i++) {
        if (simOneRun(b.stats, w, b.armorOverride)) wins++
      }
      results[b.label][w] = wins / RUNS
    }
  }
  const elapsed = ((Date.now() - t0) / 1000).toFixed(1)

  // 빌드별 best 5 + 평균 클리어율
  console.log('## 빌드별 best 5 무기')
  console.log('빌드    | 평균  | Top 1                | Top 2                | Top 3                | Top 4                | Top 5')
  console.log('--------+-------+----------------------+----------------------+----------------------+----------------------+----------------------')
  for (const b of builds) {
    const entries = Object.entries(results[b.label]).sort((a, b) => b[1] - a[1])
    const avg = entries.reduce((s, e) => s + e[1], 0) / entries.length
    const top5 = entries.slice(0, 5).map(([w, r]) => `${w} ${(r*100).toFixed(0)}%`.padEnd(20))
    const tag = b.weaponLabel ? ` [${b.weaponLabel}]` : ''
    console.log(`${b.label.padEnd(15)} | ${(avg*100).toFixed(1).padStart(4)}% | ${top5.join(' | ')}${tag}`)
  }

  // 무기별: 어떤 빌드에서 가장 강한가?
  console.log(`\n## 무기별 최적 빌드 (랭킹 1위)`)
  console.log('무기              | 최적 빌드 | 그 빌드 클리어율 | 균등10 클리어율')
  console.log('------------------+-----------+------------------+-----------------')
  for (const w of WEAPON_KEYS) {
    let best = { build: '', rate: 0 }
    for (const b of builds) {
      const r = results[b.label][w]
      if (r === undefined) continue
      if (r > best.rate) best = { build: b.label, rate: r }
    }
    const baseline = results['균등10'][w] ?? 0
    console.log(`${w.padEnd(17)} | ${best.build.padEnd(15)} | ${(best.rate*100).toFixed(1).padStart(8)}%       | ${(baseline*100).toFixed(1).padStart(7)}%`)
  }

  // 각 스탯이 어떤 무기에 가장 큰 효과?
  console.log(`\n## 스탯 +20 → 클리어율 가장 크게 끌어올린 무기 (top 3)`)
  for (const k of STAT_KEYS) {
    const buildLabel = `${k}30`
    const deltas: { w: string; delta: number; base: number; new_: number }[] = []
    for (const w of WEAPON_KEYS) {
      const base = results['균등10'][w]
      const new_ = results[buildLabel][w]
      deltas.push({ w, delta: new_ - base, base, new_ })
    }
    deltas.sort((a, b) => b.delta - a.delta)
    console.log(`\n  ${k} 30 vs 균등 10:`)
    for (const d of deltas.slice(0, 5)) {
      const arrow = d.delta >= 0 ? '↑' : '↓'
      console.log(`    ${d.w.padEnd(15)} ${(d.base*100).toFixed(1)}% → ${(d.new_*100).toFixed(1)}% (${arrow}${(d.delta*100).toFixed(1)}%p)`)
    }
  }

  console.log(`\n소요: ${elapsed}s, 총 ${builds.length * WEAPON_KEYS.length * RUNS}런`)
}

if (typeof process !== 'undefined' && process.argv?.[1]?.includes('weaponByStat')) {
  runCli()
}
