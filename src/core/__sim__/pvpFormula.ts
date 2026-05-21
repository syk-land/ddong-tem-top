// ============================================================
// 캐릭터 vs 캐릭터 PvP 시뮬레이터 + 공식 탐색
// ============================================================
// 목적:
//   "두 캐릭터를 소환해서 무기/갑옷/스탯을 바꿔가며 시뮬을 돌렸을 때,
//    실제 승부 결과를 가장 잘 예측하는 단일 전투력 공식 찾기"
//
// 절차:
//   1. 랜덤 페어 N개 + 구조화 시나리오에서 PvP 단판 시뮬 (5회 평균)
//   2. 후보 공식 6종: 캐릭터 → 점수
//   3. 각 공식의 (a) 승자 예측 정확도, (b) 점수차 ↔ HP차 상관계수 측정
//
// 사용: npm run sim:pvp

import { computeEffectiveStats, type EffectiveStats } from '../stats'
import { computeItemValue } from '../itemValue'
import { rollItem } from '../items'
import { computeMaxHp, computeMaxMp } from '../character'
import { WEAPONS, WEAPON_KEYS } from '@/data/weapons'
import { ARMOR_KEYS } from '@/data/armor'
import type { Character, Grade, Stats, TraitTier } from '@/types'

// itemValue.ts 와 동기화 — 스킬 multiplier & 발동률
const SKILL_MULT: Record<string, { mult: number; magic: boolean }> = {
  스매쉬: { mult: 2.0, magic: false },
  피어스: { mult: 1.0, magic: false },
  연속공격: { mult: 1.4, magic: false },
  정밀타격: { mult: 1.5, magic: false },
  급습: { mult: 1.65, magic: false },
  빙결의화살: { mult: 2.2, magic: true },
  화염구: { mult: 6.5, magic: true },
  폭풍칼날: { mult: 3.15, magic: true },
  바위충격: { mult: 4.8, magic: true },
  번개창: { mult: 5.5, magic: true },
  그림자일격: { mult: 2.2, magic: true },
  정화의광선: { mult: 1.8, magic: true },
}
const BASE_PROC: Record<string, number> = {
  건틀릿: 0.18, 단검: 0.22, 사슬낫: 0.30, 완드: 0.25, 숏보우: 0.25,
  검: 0.35, 창: 0.40, 철퇴: 0.50, 스태프: 0.40, 롱보우: 0.40,
  대검: 0.55, 양날도끼: 0.65, 할버드: 0.70, 마도서: 0.55, 석궁: 0.50,
}

function clamp(v: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, v)) }

// ============================================================
// PvP 단판 시뮬레이션
// ============================================================
//   - 두 캐릭터가 동시에 게이지 누적 → 임계 도달 시 공격
//   - 명중/크리/스킬 발동/관통/방어%/흡혈 모두 반영
//   - 상태이상 DoT 는 제외 (단순화, 노이즈 감소 위해)
function simPvp(a: Character, b: Character, MAX_TICKS = 800): {
  winner: -1 | 0 | 1   // +1 = A 승, -1 = B 승, 0 = 무승부
  ticks: number
  hpA: number          // A HP fraction (0~1)
  hpB: number          // B HP fraction
} {
  // shallow copy + 전투용 상태 초기화
  const cA: Character = { ...a, hp: a.maxHp, mp: a.maxMp, actionGauge: 0, statuses: [] }
  const cB: Character = { ...b, hp: b.maxHp, mp: b.maxMp, actionGauge: 0, statuses: [] }
  cA.stats = { ...a.stats }
  cB.stats = { ...b.stats }

  let t = 0
  for (; t < MAX_TICKS; t++) {
    const effA = computeEffectiveStats(cA)
    const effB = computeEffectiveStats(cB)

    // 게이지 누적
    cA.actionGauge += effA.게이지가속 * effA.armorSpeedMult
    cB.actionGauge += effB.게이지가속 * effB.armorSpeedMult

    // A 행동
    if (cA.actionGauge >= effA.무기ticks && cB.hp > 0) {
      attackOnce(cA, cB, effA, effB)
      cA.actionGauge -= effA.무기ticks
      if (cB.hp <= 0) break
    }
    // B 행동
    if (cB.actionGauge >= effB.무기ticks && cA.hp > 0) {
      attackOnce(cB, cA, effB, effA)
      cB.actionGauge -= effB.무기ticks
      if (cA.hp <= 0) break
    }
    if (cA.hp <= 0 || cB.hp <= 0) break
  }

  const aliveA = cA.hp > 0
  const aliveB = cB.hp > 0
  let winner: -1 | 0 | 1 = 0
  if (aliveA && !aliveB) winner = 1
  else if (aliveB && !aliveA) winner = -1
  else if (aliveA && aliveB) {
    const fa = cA.hp / cA.maxHp
    const fb = cB.hp / cB.maxHp
    if (fa > fb + 0.05) winner = 1
    else if (fb > fa + 0.05) winner = -1
  }
  return {
    winner,
    ticks: t,
    hpA: Math.max(0, cA.hp / cA.maxHp),
    hpB: Math.max(0, cB.hp / cB.maxHp),
  }
}

function attackOnce(attacker: Character, defender: Character, effA: EffectiveStats, effB: EffectiveStats) {
  // 명중 굴림
  const hitRate = clamp((effA.명중률 - effB.회피율) / 100, 0, 1.0)
  if (Math.random() >= hitRate) return  // miss

  // 스킬 발동 여부
  const wKey = attacker.weapon?.baseKey
  const skillKey = wKey ? WEAPONS[wKey]?.autoSkill : undefined
  const baseProc = wKey ? (BASE_PROC[wKey] ?? 0.30) : 0
  const procRate = clamp(baseProc * (1 + effA.행운 * 0.005), 0.05, 0.85)
  const skillInfo = skillKey ? SKILL_MULT[skillKey] : undefined
  const useSkill = !!skillInfo && Math.random() < procRate
  const mult = useSkill ? skillInfo!.mult : 1.0
  const isMagicHit = useSkill ? skillInfo!.magic : (effA.isMagicWeapon)

  // 공격력 (마법 vs 물리)
  const atkStat = isMagicHit && effA.마법공격력 > 0 ? effA.마법공격력 : effA.공격력
  const effDef = Math.max(0, effB.방어력_effective - effA.관통) / 100
  let dmg = Math.max(1, atkStat * mult * (1 - effDef))

  // 크리
  if (Math.random() < effA.크리확률) dmg *= effA.크리배수

  defender.hp -= Math.round(dmg)

  // 흡혈
  if (effA.lifesteal > 0) {
    attacker.hp = Math.min(attacker.maxHp, attacker.hp + Math.round(dmg * effA.lifesteal))
  }
}

// ============================================================
// 후보 공식들 — 캐릭터 → 단일 "전투력 점수"
// ============================================================
type Formula = (c: Character) => number

const FORMULAS: Record<string, Formula> = {
  // F1: 현재 computeItemValue (atkV + defV) 만
  'F1_itemValue': (c) => {
    const w = computeItemValue(c.weapon, c, { chapter: 5 })
    const a = computeItemValue(c.armor, c, { chapter: 5 })
    return w.atkValue + a.defValue
  },

  // F2: F1 + maxHp × 0.05 (HP 가산)
  'F2_itemValue+HP': (c) => {
    const w = computeItemValue(c.weapon, c, { chapter: 5 })
    const a = computeItemValue(c.armor, c, { chapter: 5 })
    return w.atkValue + a.defValue + c.maxHp * 0.05
  },

  // F3: 단순 tier 합
  'F3_tier_sum': (c) =>
    (c.weapon?.tier ?? 0) + (c.armor?.tier ?? 0),

  // F4: 효과 DPS × 생존 계수 (간단)
  'F4_DPS×HP': (c) => {
    const eff = computeEffectiveStats(c)
    const atk = eff.isMagicWeapon ? eff.마법공격력 : eff.공격력
    const dps = atk * eff.게이지가속 * eff.armorSpeedMult / eff.무기ticks
    const survival = c.maxHp / Math.max(0.1, 1 - eff.방어력_effective / 100)
    return dps * survival / 1000
  },

  // F5: 명중률·크리 고려 DPS × 생존 HP
  'F5_DPS_acc_crit×HP': (c) => {
    const eff = computeEffectiveStats(c)
    const atk = eff.isMagicWeapon ? eff.마법공격력 : eff.공격력
    // 평균 적 회피 10, 방어 10% 기준
    const hitRate = clamp((eff.명중률 - 10) / 100, 0, 1)
    const effDef = Math.max(0, 10 - eff.관통) / 100
    const dmgPerHit = Math.max(1, atk * (1 - effDef)) * hitRate
    const critBoost = 1 + eff.크리확률 * (eff.크리배수 - 1)
    const dps = dmgPerHit * critBoost * eff.게이지가속 * eff.armorSpeedMult / eff.무기ticks
    const survival = c.maxHp / Math.max(0.1, 1 - eff.방어력_effective / 100)
    return dps * survival / 1000
  },

  // F6: TTK 비율 — 평균 적 잡는 시간 vs 평균 적에게 죽는 시간
  'F6_TTK_ratio': (c) => {
    const eff = computeEffectiveStats(c)
    const atk = eff.isMagicWeapon ? eff.마법공격력 : eff.공격력
    // 평균 적: HP 170, def 10, eva 10, atk 18, ticks 10
    const hitRate = clamp((eff.명중률 - 10) / 100, 0, 1)
    const effDef = Math.max(0, 10 - eff.관통) / 100
    const dmgPerHit = Math.max(1, atk * (1 - effDef)) * hitRate
    const critBoost = 1 + eff.크리확률 * (eff.크리배수 - 1)
    const dps = dmgPerHit * critBoost * eff.게이지가속 * eff.armorSpeedMult / eff.무기ticks
    const ttkThem = 170 / Math.max(0.01, dps)

    const incomingPerTick = Math.max(1, 18 * (1 - eff.방어력_effective / 100)) / 10
    const ttkUs = c.maxHp / incomingPerTick

    return (ttkUs / Math.max(0.01, ttkThem)) * 100
  },
}

// ============================================================
// 캐릭터 생성 헬퍼
// ============================================================
function makeChar(
  weaponKey: string, armorKey: string, weaponGrade: Grade, armorGrade: Grade,
  weaponTrait: TraitTier, armorTrait: TraitTier, stats: Stats,
): Character {
  const weapon = rollItem({ kind: 'weapon', forceBaseKey: weaponKey, forceGrade: weaponGrade, forceTraitTier: weaponTrait })
  const armor = rollItem({ kind: 'armor', forceBaseKey: armorKey, forceGrade: armorGrade, forceTraitTier: armorTrait })
  return {
    stats: { ...stats },
    hp: computeMaxHp(stats.체력),
    maxHp: computeMaxHp(stats.체력),
    mp: computeMaxMp(stats.마력),
    maxMp: computeMaxMp(stats.마력),
    weapon, armor, gold: 0, statuses: [], actionGauge: 0,
  }
}

function pick<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)] }

function randomChar(): Character {
  const GRADES: Grade[] = ['노말', '레어', '스페셜', '레전드']
  const TIERS: TraitTier[] = ['하급', '보통', '희귀', '특별']
  // 60pt 무작위 분배
  const keys: Array<keyof Stats> = ['힘', '민첩', '체력', '마력', '행운']
  const stats: Stats = { 힘: 0, 민첩: 0, 체력: 0, 마력: 0, 행운: 0 }
  let rem = 60
  while (rem > 0) { stats[pick(keys)]++; rem-- }
  return makeChar(
    pick(WEAPON_KEYS), pick(ARMOR_KEYS),
    pick(GRADES), pick(GRADES),
    pick(TIERS), pick(TIERS),
    stats,
  )
}

// ============================================================
// 평가
// ============================================================
function pearsonCorrelation(xs: number[], ys: number[]): number {
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

interface MatchRecord {
  scoreDiff: Record<string, number>  // formula → (scoreA - scoreB)
  outcome: -1 | 0 | 1                // PvP 다회 다수결
  hpMargin: number                   // 평균 hpA - hpB
}

function runMatches(pairs: Array<[Character, Character]>, runsPerPair: number, label: string): MatchRecord[] {
  const records: MatchRecord[] = []
  for (const [a, b] of pairs) {
    let aWins = 0, bWins = 0, totalMargin = 0
    for (let r = 0; r < runsPerPair; r++) {
      const res = simPvp(a, b)
      if (res.winner === 1) aWins++
      else if (res.winner === -1) bWins++
      totalMargin += (res.hpA - res.hpB)
    }
    const outcome: -1 | 0 | 1 = aWins > bWins ? 1 : bWins > aWins ? -1 : 0
    const scoreDiff: Record<string, number> = {}
    for (const [k, fn] of Object.entries(FORMULAS)) {
      scoreDiff[k] = fn(a) - fn(b)
    }
    records.push({ scoreDiff, outcome, hpMargin: totalMargin / runsPerPair })
  }
  return records
}

function evaluateRecords(records: MatchRecord[], label: string) {
  const decided = records.filter((r) => r.outcome !== 0)
  console.log(`\n--- ${label}: ${decided.length}/${records.length} 결정난 매치 ---`)
  if (decided.length === 0) { console.log('(no decisive matches)'); return }

  console.log('공식                     | 정확도   |   상관 | rank')
  console.log('-------------------------+----------+--------+------')
  type Row = { key: string; acc: number; corr: number }
  const rows: Row[] = []
  for (const key of Object.keys(FORMULAS)) {
    let correct = 0
    for (const r of decided) {
      const pred = r.scoreDiff[key] > 0 ? 1 : r.scoreDiff[key] < 0 ? -1 : 0
      if (pred === r.outcome) correct++
    }
    const acc = correct / decided.length
    const xs = decided.map((r) => r.scoreDiff[key])
    const ys = decided.map((r) => r.hpMargin)
    const corr = pearsonCorrelation(xs, ys)
    rows.push({ key, acc, corr })
  }
  rows.sort((a, b) => b.acc - a.acc)
  rows.forEach((row, i) => {
    console.log(
      `${row.key.padEnd(24)} | ${(row.acc * 100).toFixed(1).padStart(6)}% | ${row.corr.toFixed(3).padStart(6)} | ${(i + 1)}위`,
    )
  })
}

// ============================================================
// 시나리오 생성
// ============================================================
function scenarioRandomPairs(n: number): Array<[Character, Character]> {
  const out: Array<[Character, Character]> = []
  for (let i = 0; i < n; i++) out.push([randomChar(), randomChar()])
  return out
}

// 시나리오 B: 같은 스탯(균등 12), 장비만 다름 — 장비 벨류 검증
function scenarioGearVaried(n: number): Array<[Character, Character]> {
  const STAT: Stats = { 힘: 12, 민첩: 12, 체력: 12, 마력: 12, 행운: 12 }
  const GRADES: Grade[] = ['노말', '레어', '스페셜', '레전드']
  const TIERS: TraitTier[] = ['하급', '보통', '희귀', '특별']
  const out: Array<[Character, Character]> = []
  for (let i = 0; i < n; i++) {
    const a = makeChar(pick(WEAPON_KEYS), pick(ARMOR_KEYS), pick(GRADES), pick(GRADES), pick(TIERS), pick(TIERS), STAT)
    const b = makeChar(pick(WEAPON_KEYS), pick(ARMOR_KEYS), pick(GRADES), pick(GRADES), pick(TIERS), pick(TIERS), STAT)
    out.push([a, b])
  }
  return out
}

// 시나리오 C: 동일 장비(중간 등급), 스탯만 다름 — 스탯 벨류 검증
function scenarioStatsVaried(n: number): Array<[Character, Character]> {
  function randStats(): Stats {
    const keys: Array<keyof Stats> = ['힘', '민첩', '체력', '마력', '행운']
    const stats: Stats = { 힘: 0, 민첩: 0, 체력: 0, 마력: 0, 행운: 0 }
    let rem = 60
    while (rem > 0) { stats[pick(keys)]++; rem-- }
    return stats
  }
  const out: Array<[Character, Character]> = []
  for (let i = 0; i < n; i++) {
    const a = makeChar('검', '중갑', '레어', '레어', '보통', '보통', randStats())
    const b = makeChar('검', '중갑', '레어', '레어', '보통', '보통', randStats())
    out.push([a, b])
  }
  return out
}

// 시나리오 D: 무기만 다름 (동일 스탯/갑옷) — 무기 벨류 검증
function scenarioWeaponOnly(n: number): Array<[Character, Character]> {
  const STAT: Stats = { 힘: 12, 민첩: 12, 체력: 12, 마력: 12, 행운: 12 }
  const GRADES: Grade[] = ['노말', '레어', '스페셜', '레전드']
  const TIERS: TraitTier[] = ['하급', '보통', '희귀', '특별']
  const out: Array<[Character, Character]> = []
  for (let i = 0; i < n; i++) {
    const a = makeChar(pick(WEAPON_KEYS), '중갑', pick(GRADES), '레어', pick(TIERS), '보통', STAT)
    const b = makeChar(pick(WEAPON_KEYS), '중갑', pick(GRADES), '레어', pick(TIERS), '보통', STAT)
    out.push([a, b])
  }
  return out
}

// 시나리오 E: 갑옷만 다름
function scenarioArmorOnly(n: number): Array<[Character, Character]> {
  const STAT: Stats = { 힘: 12, 민첩: 12, 체력: 12, 마력: 12, 행운: 12 }
  const GRADES: Grade[] = ['노말', '레어', '스페셜', '레전드']
  const TIERS: TraitTier[] = ['하급', '보통', '희귀', '특별']
  const out: Array<[Character, Character]> = []
  for (let i = 0; i < n; i++) {
    const a = makeChar('검', pick(ARMOR_KEYS), '레어', pick(GRADES), '보통', pick(TIERS), STAT)
    const b = makeChar('검', pick(ARMOR_KEYS), '레어', pick(GRADES), '보통', pick(TIERS), STAT)
    out.push([a, b])
  }
  return out
}

// ============================================================
// 메인
// ============================================================
export function runPvpFormulaSearch() {
  const N_PAIRS = 250
  const RUNS_PER_PAIR = 5

  console.log(`\n############################################################`)
  console.log(`# 캐릭터 vs 캐릭터 PvP — 공식 탐색 (${N_PAIRS}페어 × ${RUNS_PER_PAIR}회)`)
  console.log(`############################################################`)

  const overallRecords: MatchRecord[] = []
  type Section = { label: string; pairs: Array<[Character, Character]> }
  const sections: Section[] = [
    { label: 'A. 완전 무작위 (장비+스탯 모두 다양)', pairs: scenarioRandomPairs(N_PAIRS) },
    { label: 'B. 장비만 다양 (스탯 균등 12)', pairs: scenarioGearVaried(N_PAIRS) },
    { label: 'C. 스탯만 다양 (검+중갑 레어 보통)', pairs: scenarioStatsVaried(N_PAIRS) },
    { label: 'D. 무기만 다양 (갑옷=중갑 레어)', pairs: scenarioWeaponOnly(N_PAIRS) },
    { label: 'E. 갑옷만 다양 (무기=검 레어)', pairs: scenarioArmorOnly(N_PAIRS) },
  ]

  for (const sec of sections) {
    const rec = runMatches(sec.pairs, RUNS_PER_PAIR, sec.label)
    evaluateRecords(rec, sec.label)
    overallRecords.push(...rec)
  }

  console.log(`\n############################################################`)
  console.log(`# 종합: 5개 시나리오 통합 (${overallRecords.length} 매치)`)
  console.log(`############################################################`)
  evaluateRecords(overallRecords, '종합')

  // 종합 순위 + 추천 공식
  const decided = overallRecords.filter((r) => r.outcome !== 0)
  type Score = { key: string; acc: number; corr: number }
  const scores: Score[] = Object.keys(FORMULAS).map((key) => {
    let correct = 0
    for (const r of decided) {
      const pred = r.scoreDiff[key] > 0 ? 1 : r.scoreDiff[key] < 0 ? -1 : 0
      if (pred === r.outcome) correct++
    }
    const acc = correct / decided.length
    const xs = decided.map((r) => r.scoreDiff[key])
    const ys = decided.map((r) => r.hpMargin)
    return { key, acc, corr: pearsonCorrelation(xs, ys) }
  })
  scores.sort((a, b) => b.acc - a.acc)
  console.log(`\n## 정확도 순위:`)
  scores.forEach((s, i) => {
    console.log(`  ${i + 1}. ${s.key.padEnd(24)} 정확도 ${(s.acc * 100).toFixed(1)}% / 상관 ${s.corr.toFixed(3)}`)
  })
  // 추천: 정확도 + 상관 종합 점수 (acc × corr)
  const ranked = [...scores].sort((a, b) => b.acc * b.corr - a.acc * a.corr)
  console.log(`\n## ★ 추천 공식: ${ranked[0].key}`)
  console.log(`   (정확도 ${(ranked[0].acc * 100).toFixed(1)}% × 상관 ${ranked[0].corr.toFixed(3)} = ${(ranked[0].acc * ranked[0].corr).toFixed(3)})`)
  console.log('\n공식 설명:')
  console.log('  F1_itemValue:         현재 computeItemValue(atkV + defV)')
  console.log('  F2_itemValue+HP:      F1 + maxHp × 0.05')
  console.log('  F3_tier_sum:          무기 tier + 갑옷 tier (순수 등급)')
  console.log('  F4_DPS×HP:            (공격력 / 무기ticks × 게이지가속) × maxHp / (1 - def%)')
  console.log('  F5_DPS_acc_crit×HP:   F4 + 명중률/크리 반영 (평균 적 회피 10/방어 10 기준)')
  console.log('  F6_TTK_ratio:         ttk_us / ttk_them (평균 적 잡는 시간 vs 죽는 시간)')

  console.log(`\n=== 완료 ===\n`)
}

if (typeof process !== 'undefined' && process.argv?.[1]?.includes('pvpFormula')) {
  runPvpFormulaSearch()
}
