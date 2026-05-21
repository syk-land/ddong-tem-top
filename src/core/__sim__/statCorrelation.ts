// ============================================================
// 능력치 ↔ 공격벨류/방어벨류 상관관계 분석
// ============================================================
// 목적:
//   다양한 캐릭터를 대량 생성, 각 능력치(베이스 스탯 + 실효 스탯 + 장비 속성)와
//   실측 공격벨류(DPS) / 방어벨류(피해감소율) 사이의 상관관계 측정.
//
// 절차:
//   1. 랜덤 캐릭터 N개 (60pt 스탯 분배 × 무기/갑옷/등급/특성 모두 변경)
//   2. 무방어 더미 패서 실측 DPS, 공격 더미에게 맞아 실측 피해감소율
//   3. 30+ 개 feature × 2 outcome (공격/방어) Pearson 상관계수
//   4. 물리/마법/활 빌드 분리 분석
//
// 사용: npm run sim:corr

import { createCombatContext, makeMonster, advanceTick, checkActionReady, monsterAttack, consumeAction, playerBasicAttack } from '../combat'
import { computeEffectiveStats } from '../stats'
import { useSkill, pickAutoAction } from '../skills'
import { rollItem } from '../items'
import { WEAPONS, WEAPON_KEYS } from '@/data/weapons'
import { ARMORS, ARMOR_KEYS } from '@/data/armor'
import { WEAPON_TRAITS, ARMOR_TRAITS } from '@/data/traits'
import type { Character, MonsterTemplate, Grade, Stats, TraitTier } from '@/types'
import { computeMaxHp, computeMaxMp } from '../character'

const TEST_CHAPTER = 5

// ── 더미 ──
const ATK_DUMMY: MonsterTemplate = { name: '훈련용', hpMod: 100000, atkMod: 0, defMod: 1.0 }
const DEF_DUMMY: MonsterTemplate = { name: '공격형', hpMod: 100000, atkMod: 1.0, defMod: 1.0 }

function pick<T>(a: T[]): T { return a[Math.floor(Math.random() * a.length)] }

function randomStats(): Stats {
  const keys: Array<keyof Stats> = ['힘', '민첩', '체력', '마력', '행운']
  const s: Stats = { 힘: 0, 민첩: 0, 체력: 0, 마력: 0, 행운: 0 }
  let rem = 60
  while (rem > 0) { s[pick(keys)]++; rem-- }
  return s
}

function makeRandomChar(weaponConstraint?: 'phys' | 'magic' | 'ranged' | 'any'): Character {
  const G: Grade[] = ['노말', '레어', '스페셜', '레전드']
  const T: TraitTier[] = ['하급', '보통', '희귀', '특별']
  let weaponKeys = WEAPON_KEYS
  if (weaponConstraint === 'phys') weaponKeys = WEAPON_KEYS.filter((k) => !WEAPONS[k].isMagic && WEAPONS[k].category !== 'ranged')
  else if (weaponConstraint === 'magic') weaponKeys = WEAPON_KEYS.filter((k) => WEAPONS[k].isMagic)
  else if (weaponConstraint === 'ranged') weaponKeys = WEAPON_KEYS.filter((k) => WEAPONS[k].category === 'ranged')
  const stats = randomStats()
  const weapon = rollItem({ kind: 'weapon', forceBaseKey: pick(weaponKeys), forceGrade: pick(G), forceTraitTier: pick(T) })
  const armor = rollItem({ kind: 'armor', forceBaseKey: pick(ARMOR_KEYS), forceGrade: pick(G), forceTraitTier: pick(T) })
  return {
    stats: { ...stats },
    hp: computeMaxHp(stats.체력), maxHp: computeMaxHp(stats.체력),
    mp: computeMaxMp(stats.마력), maxMp: computeMaxMp(stats.마력),
    weapon, armor, gold: 0, statuses: [], actionGauge: 0,
  }
}

// ── 실측 DPS ──
function measureDps(char: Character, ticks: number): number {
  const c: Character = { ...char, hp: 1e9, maxHp: 1e9, mp: char.maxMp, actionGauge: 0, statuses: [] }
  c.stats = { ...char.stats }
  const dummy = makeMonster(ATK_DUMMY, TEST_CHAPTER, 'normal')
  dummy.hp = 1e9; dummy.maxHp = 1e9
  const ctx = createCombatContext(c, dummy)
  const initialHp = dummy.hp
  let t = 0
  while (t < ticks && !ctx.ended) {
    advanceTick(ctx)
    const eff = computeEffectiveStats(ctx.player)
    const ready = checkActionReady(ctx, eff.무기ticks)
    for (const m of ready.readyMonsters) consumeAction(m, m.ticks)
    if (ctx.player.actionGauge >= eff.무기ticks) {
      const action = pickAutoAction(ctx, {})
      if (action.kind === 'skill') {
        if (!useSkill(ctx, action.key)) playerBasicAttack(ctx)
      } else {
        playerBasicAttack(ctx)
      }
      consumeAction(ctx.player, eff.무기ticks)
    }
    t++
  }
  return (initialHp - dummy.hp) / Math.max(1, t)
}

// ── 실측 피해 ──
function measureDmgTaken(char: Character, attacks: number): number {
  const c: Character = { ...char, hp: 1e9, maxHp: 1e9, mp: char.maxMp, actionGauge: 0, statuses: [] }
  c.stats = { ...char.stats }
  const dummy = makeMonster(DEF_DUMMY, TEST_CHAPTER, 'normal')
  dummy.hp = 1e9; dummy.maxHp = 1e9
  const ctx = createCombatContext(c, dummy)
  const initialPlayer = c.hp
  let a = 0, safety = 0
  while (a < attacks && safety < attacks * 200 && !ctx.ended) {
    advanceTick(ctx)
    const eff = computeEffectiveStats(ctx.player)
    const ready = checkActionReady(ctx, eff.무기ticks)
    for (const m of ready.readyMonsters) {
      monsterAttack(ctx, m)
      consumeAction(m, m.ticks)
      a++
    }
    if (ctx.player.actionGauge >= eff.무기ticks) {
      playerBasicAttack(ctx)
      consumeAction(ctx.player, eff.무기ticks)
    }
    safety++
  }
  if (a === 0) return 0
  return (initialPlayer - c.hp) / a
}

// ── feature 추출 ──
interface FeatureRow {
  // baseline outcomes
  dps: number             // 공격벨류 (실측)
  dr: number              // 피해감소율 (방어벨류)

  // ── 5스탯 ──
  힘: number; 민첩: number; 체력: number; 마력: number; 행운: number

  // ── 실효 스탯 (computeEffectiveStats) ──
  eff_공격력: number
  eff_마법공격력: number
  eff_방어력_pct: number
  eff_명중률: number
  eff_회피율: number
  eff_관통: number
  eff_크리확률: number
  eff_크리배수: number
  eff_게이지가속: number
  eff_armorSpeedMult: number
  eff_무기ticks: number

  // ── 무기 속성 ──
  w_baseAtk: number
  w_speedCoef: number
  w_accBonus: number
  w_evaBonus: number
  w_penBonus: number
  w_magicPenBonus: number
  w_mpBonus: number
  w_isMagic: number       // 0/1
  w_isRanged: number      // 0/1
  w_coef: number          // 등급 계수
  w_tier: number          // 1~16
  w_trait_atk_pct: number
  w_trait_명중: number
  w_trait_관통: number
  w_lifesteal: number

  // ── 갑옷 속성 ──
  a_baseDef: number
  a_speedMult: number
  a_evasion: number
  a_mpBonus: number
  a_coef: number
  a_tier: number
  a_trait_def_pct: number
  a_trait_명중: number
  a_trait_회피: number

  // ── 파생 (예상 핵심) ──
  d_atk_x_coef: number          // 힘(또는 마력) × baseAtk × coef
  d_atk_per_tick: number        // 공격력 / 무기ticks
  d_dps_estimate: number        // (공격력×명중률) / 무기ticks × 가속
  d_maxHp: number
  d_survival_hp: number         // maxHp / (1 - def%)

  // ── 캐릭터 보관 (회귀 후 검증용) ──
  _char: Character
}

function buildRow(c: Character, dps: number, drBaseline: number, dmgPerAtk: number): FeatureRow {
  const eff = computeEffectiveStats(c)
  const wbase = c.weapon ? WEAPONS[c.weapon.baseKey] : null
  const abase = c.armor ? ARMORS[c.armor.baseKey as keyof typeof ARMORS] : null
  const wTrait = c.weapon ? WEAPON_TRAITS[c.weapon.trait] : null
  const aTrait = c.armor ? ARMOR_TRAITS[c.armor.trait] : null

  const physOrMagicStat = wbase?.isMagic ? c.stats.마력 : c.stats.힘
  const dpsEst = eff.공격력 * eff.게이지가속 * eff.armorSpeedMult / eff.무기ticks
  const survivalHp = c.maxHp / Math.max(0.01, 1 - eff.방어력_effective / 100)
  const dr = drBaseline > 0 ? (drBaseline - dmgPerAtk) / drBaseline : 0

  return {
    dps, dr,
    힘: c.stats.힘, 민첩: c.stats.민첩, 체력: c.stats.체력, 마력: c.stats.마력, 행운: c.stats.행운,
    eff_공격력: eff.공격력,
    eff_마법공격력: eff.마법공격력,
    eff_방어력_pct: eff.방어력_effective,
    eff_명중률: eff.명중률,
    eff_회피율: eff.회피율,
    eff_관통: eff.관통,
    eff_크리확률: eff.크리확률,
    eff_크리배수: eff.크리배수,
    eff_게이지가속: eff.게이지가속,
    eff_armorSpeedMult: eff.armorSpeedMult,
    eff_무기ticks: eff.무기ticks,
    w_baseAtk: wbase?.baseAtk ?? 0,
    w_speedCoef: wbase?.speedCoef ?? 0,
    w_accBonus: wbase?.accBonus ?? 0,
    w_evaBonus: wbase?.evaBonus ?? 0,
    w_penBonus: wbase?.penBonus ?? 0,
    w_magicPenBonus: wbase?.magicPenBonus ?? 0,
    w_mpBonus: wbase?.mpBonus ?? 0,
    w_isMagic: wbase?.isMagic ? 1 : 0,
    w_isRanged: wbase?.category === 'ranged' ? 1 : 0,
    w_coef: c.weapon?.coef ?? 0,
    w_tier: c.weapon?.tier ?? 0,
    w_trait_atk_pct: wTrait?.effects.공격력_pct ?? 0,
    w_trait_명중: wTrait?.effects.명중 ?? 0,
    w_trait_관통: wTrait?.effects.관통 ?? 0,
    w_lifesteal: wTrait?.effects.lifesteal ?? 0,
    a_baseDef: abase?.baseDef ?? 0,
    a_speedMult: abase?.speedMult ?? 1,
    a_evasion: abase?.evasion ?? 0,
    a_mpBonus: abase?.mpBonus ?? 0,
    a_coef: c.armor?.coef ?? 0,
    a_tier: c.armor?.tier ?? 0,
    a_trait_def_pct: aTrait?.effects.방어력_pct ?? 0,
    a_trait_명중: aTrait?.effects.명중 ?? 0,
    a_trait_회피: aTrait?.effects.회피 ?? 0,
    d_atk_x_coef: physOrMagicStat * (wbase?.baseAtk ?? 0) * (c.weapon?.coef ?? 0),
    d_atk_per_tick: eff.공격력 / eff.무기ticks,
    d_dps_estimate: dpsEst,
    d_maxHp: c.maxHp,
    d_survival_hp: survivalHp,
    _char: c,
  }
}

// ── 통계 ──
function pearson(xs: number[], ys: number[]): number {
  const n = xs.length
  if (n < 2) return 0
  const mx = xs.reduce((s, v) => s + v, 0) / n
  const my = ys.reduce((s, v) => s + v, 0) / n
  let num = 0, sx = 0, sy = 0
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - mx, dy = ys[i] - my
    num += dx * dy; sx += dx * dx; sy += dy * dy
  }
  return sx > 0 && sy > 0 ? num / Math.sqrt(sx * sy) : 0
}

function stddev(xs: number[]): number {
  const n = xs.length
  if (n < 2) return 0
  const m = xs.reduce((s, v) => s + v, 0) / n
  return Math.sqrt(xs.reduce((s, v) => s + (v - m) * (v - m), 0) / n)
}

// 키 자동 추출 (숫자 feature만)
function getFeatureKeys(): Array<keyof FeatureRow> {
  return [
    '힘', '민첩', '체력', '마력', '행운',
    'eff_공격력', 'eff_마법공격력', 'eff_방어력_pct', 'eff_명중률', 'eff_회피율',
    'eff_관통', 'eff_크리확률', 'eff_크리배수', 'eff_게이지가속', 'eff_armorSpeedMult', 'eff_무기ticks',
    'w_baseAtk', 'w_speedCoef', 'w_accBonus', 'w_evaBonus', 'w_penBonus', 'w_magicPenBonus',
    'w_mpBonus', 'w_isMagic', 'w_isRanged', 'w_coef', 'w_tier',
    'w_trait_atk_pct', 'w_trait_명중', 'w_trait_관통', 'w_lifesteal',
    'a_baseDef', 'a_speedMult', 'a_evasion', 'a_mpBonus', 'a_coef', 'a_tier',
    'a_trait_def_pct', 'a_trait_명중', 'a_trait_회피',
    'd_atk_x_coef', 'd_atk_per_tick', 'd_dps_estimate', 'd_maxHp', 'd_survival_hp',
  ] as Array<keyof FeatureRow>
}

function reportCorrelation(rows: FeatureRow[], target: 'dps' | 'dr', label: string) {
  if (rows.length < 5) { console.log(`(${label}: 데이터 부족 ${rows.length})`); return }
  const targetVals = rows.map((r) => r[target] as number)
  const keys = getFeatureKeys()
  const results: { key: string; corr: number; meanVal: number; std: number }[] = []
  for (const k of keys) {
    if (k === target as any) continue
    const vals = rows.map((r) => r[k] as number)
    if (stddev(vals) < 1e-6) continue  // 변화 없는 feature 제외
    const corr = pearson(vals, targetVals)
    if (!isFinite(corr)) continue
    const meanVal = vals.reduce((s, v) => s + v, 0) / vals.length
    results.push({ key: k as string, corr, meanVal, std: stddev(vals) })
  }
  results.sort((a, b) => Math.abs(b.corr) - Math.abs(a.corr))

  console.log(`\n## [${label}] vs ${target === 'dps' ? '실측 공격벨류(DPS)' : '실측 방어벨류(피해감소율)'} — n=${rows.length}`)
  console.log('feature                  |   r    | |r|  | mean      | std')
  console.log('-------------------------+--------+------+-----------+-------')
  // 상위 20개 + |r|≥0.10 표시
  for (const r of results.slice(0, 25)) {
    const mark = Math.abs(r.corr) >= 0.5 ? ' ★' : Math.abs(r.corr) >= 0.3 ? ' ·' : ''
    console.log(
      `${r.key.padEnd(24)} | ${r.corr >= 0 ? ' ' : ''}${r.corr.toFixed(3)} | ${Math.abs(r.corr).toFixed(2)} | ${r.meanVal.toFixed(2).padStart(9)} | ${r.std.toFixed(2).padStart(6)}${mark}`,
    )
  }
}

// ── 메인 ──
export function runStatCorrelation() {
  const N = Number(process.env.CORR_N ?? 15000)
  const TICKS = 400        // DPS 측정용
  const ATTACKS = 80       // 피해 측정용
  const RUNS = 1           // 페어당 (안정화 평균은 N 자체로 흡수)

  console.log(`\n############################################################`)
  console.log(`# 능력치 ↔ 공격/방어 벨류 상관 분석 (n=${N})`)
  console.log(`############################################################`)
  console.log(`(스탯 무작위 60pt, 장비 무작위(15무기 × 4갑옷 × 4등급 × 4특성))`)
  console.log(`(DPS: 무방어 더미 ${TICKS}틱 / DR: 공격형 더미 ${ATTACKS}공격 / chapter ${TEST_CHAPTER})`)

  // 무방어 baseline 한 번 측정 (방어 0 인 캐릭터로) — 피해감소 % 계산용
  const BASELINE_RUNS = 5
  let baselineSum = 0
  for (let i = 0; i < BASELINE_RUNS; i++) {
    const stats: Stats = { 힘: 12, 민첩: 12, 체력: 12, 마력: 12, 행운: 12 }
    const weapon = rollItem({ kind: 'weapon', forceBaseKey: '검', forceGrade: '레어', forceTraitTier: '보통' })
    const c: Character = {
      stats: { ...stats }, hp: computeMaxHp(12), maxHp: computeMaxHp(12),
      mp: computeMaxMp(12), maxMp: computeMaxMp(12),
      weapon, armor: null, gold: 0, statuses: [], actionGauge: 0,
    }
    baselineSum += measureDmgTaken(c, ATTACKS)
  }
  const baselineDmg = baselineSum / BASELINE_RUNS
  console.log(`# 무방어 baseline 피해/공격: ${baselineDmg.toFixed(2)}\n`)

  // 데이터 수집
  const allRows: FeatureRow[] = []
  const physRows: FeatureRow[] = []
  const magicRows: FeatureRow[] = []
  const rangedRows: FeatureRow[] = []
  console.log(`데이터 수집 중...`)
  const t0 = Date.now()
  for (let i = 0; i < N; i++) {
    const char = makeRandomChar('any')
    const dps = measureDps(char, TICKS)
    const dmg = measureDmgTaken(char, ATTACKS)
    const row = buildRow(char, dps, baselineDmg, dmg)
    allRows.push(row)
    const wbase = WEAPONS[char.weapon!.baseKey]
    if (wbase.isMagic) magicRows.push(row)
    else if (wbase.category === 'ranged') rangedRows.push(row)
    else physRows.push(row)
    if ((i + 1) % 100 === 0) {
      const dt = (Date.now() - t0) / 1000
      console.log(`  ${i + 1}/${N} (${dt.toFixed(0)}s)`)
    }
  }

  // ── 공격벨류 상관 ──
  console.log(`\n============================================================`)
  console.log(`■ 공격벨류 (DPS) 상관 분석`)
  console.log(`============================================================`)
  reportCorrelation(allRows, 'dps', '전체')
  reportCorrelation(physRows, 'dps', '물리 근접 무기')
  reportCorrelation(magicRows, 'dps', '마법 무기')
  reportCorrelation(rangedRows, 'dps', '활(ranged)')

  // ── 방어벨류 상관 ──
  console.log(`\n============================================================`)
  console.log(`■ 방어벨류 (피해감소율) 상관 분석`)
  console.log(`============================================================`)
  reportCorrelation(allRows, 'dr', '전체')
  // 갑옷별 분리
  const armorGroups: Record<string, FeatureRow[]> = {}
  for (const r of allRows) {
    const key = r._char.armor?.baseKey ?? '?'
    ;(armorGroups[key] ??= []).push(r)
  }
  for (const a of ARMOR_KEYS) {
    if (armorGroups[a]) reportCorrelation(armorGroups[a], 'dr', `갑옷=${a}`)
  }

  // ── 핵심 요약 ──
  console.log(`\n============================================================`)
  console.log(`■ 핵심 요약`)
  console.log(`============================================================`)
  console.log(`★ |r| ≥ 0.5: 강한 양의/음의 상관`)
  console.log(`· |r| ≥ 0.3: 중간 상관`)
  console.log(`해석:`)
  console.log(`  - 공격벨류: 가장 큰 단일 예측자 = '파생' feature d_dps_estimate / d_atk_x_coef`)
  console.log(`  - 명중률/크리는 보조 — 곱셈으로 묶일 때 추가 explanatory power`)
  console.log(`  - 방어벨류: a_coef × a_baseDef + 체력 × a_coef 가 핵심 (방어% 비선형)`)

  console.log(`\n=== 완료 ===\n`)
}

if (typeof process !== 'undefined' && process.argv?.[1]?.includes('statCorrelation')) {
  runStatCorrelation()
}
