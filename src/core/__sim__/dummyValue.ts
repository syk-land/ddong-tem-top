// ============================================================
// 더미 검증 시뮬레이터
// ============================================================
// 목적:
//   `computeItemValue()` 가 표시하는 장비 벨류(atkValue / defValue) 가
//   실제 전투 시뮬레이션 결과와 비례하는지 검증.
//
//   - 무기: 무방어 더미를 패서 실측 DPS 측정 → atkValue 와 비교
//   - 갑옷: 고정 공격력 더미에게 맞고 실측 피해량 측정 → defValue 와 비교
//
// 더미 monster:
//   - trait 없음, HP 무한 (DPS 측정 동안 안 죽음)
//   - acc/eva/def 는 챕터 5 baseline 과 동일 (computeItemValue 의 기본 가정)
//
// 사용: npm run sim:dummy

import { createCombatContext, makeMonster, advanceTick, checkActionReady, monsterAttack, consumeAction, playerBasicAttack } from '../combat'
import { computeEffectiveStats } from '../stats'
import { useSkill, pickAutoAction } from '../skills'
import { rollItem } from '../items'
import { computeItemValue } from '../itemValue'
import { WEAPON_KEYS } from '@/data/weapons'
import { ARMOR_KEYS } from '@/data/armor'
import type { Character, MonsterTemplate, Grade, Stats } from '@/types'
import { computeMaxHp, computeMaxMp } from '../character'

// computeItemValue 기본 가정과 동일: 챕터 5, 5스탯 각 12
const TEST_CHAPTER = 5
const TEST_STATS: Stats = { 힘: 12, 민첩: 12, 체력: 12, 마력: 12, 행운: 12 }
const GRADES: Grade[] = ['노말', '레어', '스페셜', '레전드']

// ── 무기 DPS 측정용 더미: 공격 없음, HP 무한 ──
const ATK_DUMMY_TEMPLATE: MonsterTemplate = {
  name: '훈련용_허수아비',
  hpMod: 100000,  // base HP × 100000 → 절대 안 죽음
  atkMod: 0,      // 공격력 0 → 플레이어 안 죽음
  defMod: 1.0,    // chapter 5 baseline def (= 8%)
}

// ── 갑옷 방어 측정용 더미: 일정한 공격, 죽지 않음 ──
const DEF_DUMMY_TEMPLATE: MonsterTemplate = {
  name: '연습용_공격형',
  hpMod: 100000,
  atkMod: 1.0,    // chapter 5 baseline atk (= 14)
  defMod: 1.0,
}

function makeChar(weaponKey: string, armorKey: string | null, grade: Grade): Character {
  const weapon = rollItem({ kind: 'weapon', forceBaseKey: weaponKey, forceGrade: grade, forceTraitTier: '보통' })
  const armor = armorKey
    ? rollItem({ kind: 'armor', forceBaseKey: armorKey, forceGrade: grade, forceTraitTier: '보통' })
    : null
  return {
    stats: { ...TEST_STATS },
    hp: computeMaxHp(TEST_STATS.체력),
    maxHp: computeMaxHp(TEST_STATS.체력),
    mp: computeMaxMp(TEST_STATS.마력),
    maxMp: computeMaxMp(TEST_STATS.마력),
    weapon,
    armor,
    gold: 0,
    statuses: [],
    actionGauge: 0,
  }
}

// 무기 DPS 실측: 더미 패고 단위 틱당 평균 데미지 측정
function measureWeaponDps(weaponKey: string, armorKey: string, grade: Grade, ticks: number, runs: number): number {
  let totalDpt = 0
  for (let r = 0; r < runs; r++) {
    const char = makeChar(weaponKey, armorKey, grade)
    char.hp = 1e9; char.maxHp = 1e9  // 플레이어 무사 보장
    const dummy = makeMonster(ATK_DUMMY_TEMPLATE, TEST_CHAPTER, 'normal')
    dummy.hp = 1e9; dummy.maxHp = 1e9
    const ctx = createCombatContext(char, dummy)

    const initialDummyHp = dummy.hp
    let t = 0
    while (t < ticks && !ctx.ended) {
      advanceTick(ctx)
      const eff = computeEffectiveStats(ctx.player)
      const ready = checkActionReady(ctx, eff.무기ticks)
      // 더미 공격력 0 — 행동은 스킵 (sanity)
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
    const damageDealt = initialDummyHp - dummy.hp
    totalDpt += damageDealt / t
  }
  return totalDpt / runs
}

// 갑옷 피해감소 실측: 더미에게 맞고 받은 평균 데미지/공격 측정
// armorKey === null 이면 baseline 측정용 (방어 0 인 상태)
function measureArmorDmgTaken(weaponKey: string, armorKey: string | null, grade: Grade, monsterAttacks: number, runs: number): number {
  let totalDmgPerAtk = 0
  for (let r = 0; r < runs; r++) {
    const char = makeChar(weaponKey, armorKey, grade)
    char.hp = 1e9; char.maxHp = 1e9
    const dummy = makeMonster(DEF_DUMMY_TEMPLATE, TEST_CHAPTER, 'normal')
    dummy.hp = 1e9; dummy.maxHp = 1e9
    const ctx = createCombatContext(char, dummy)

    const initialPlayerHp = char.hp
    let attacks = 0
    let safety = 0
    while (attacks < monsterAttacks && safety < monsterAttacks * 200 && !ctx.ended) {
      advanceTick(ctx)
      const eff = computeEffectiveStats(ctx.player)
      const ready = checkActionReady(ctx, eff.무기ticks)
      for (const m of ready.readyMonsters) {
        monsterAttack(ctx, m)
        consumeAction(m, m.ticks)
        attacks++
      }
      // 플레이어도 행동 — 평타로 더미 깎기만 (스킬 MP 소모로 변수 줄임)
      if (ctx.player.actionGauge >= eff.무기ticks) {
        playerBasicAttack(ctx)
        consumeAction(ctx.player, eff.무기ticks)
      }
      safety++
    }
    if (attacks === 0) continue
    const damageTaken = initialPlayerHp - char.hp
    totalDmgPerAtk += damageTaken / attacks
  }
  return totalDmgPerAtk / runs
}

function formatNum(n: number, w = 7, d = 1): string {
  return n.toFixed(d).padStart(w)
}

function formatPct(p: number, w = 6): string {
  return (p * 100).toFixed(1).padStart(w - 1) + '%'
}

// ============================================================
// 무기 검증: 등급별 atkValue vs 실측 DPS
// ============================================================
function runWeaponValidation() {
  const TICKS = 600
  const RUNS = 8
  // 갑옷은 영향 최소화 위해 균형형 '중갑' 고정
  const FIXED_ARMOR = '중갑'

  console.log(`\n=== 무기 벨류 검증 (TICKS=${TICKS}, RUNS=${RUNS}) ===`)
  console.log(`(스탯=균등 12 / 갑옷=${FIXED_ARMOR} / chapter=${TEST_CHAPTER} / trait=보통)`)
  console.log(`atkV = computeItemValue.atkValue, DPS = 실측 평균 데미지/틱\n`)

  const header = '무기      | 항목  |' + GRADES.map((g) => g.padStart(9)).join(' |')
  console.log(header)
  console.log('----------+-------+' + GRADES.map(() => '----------').join('+'))

  // 등급간 비율도 확인할 수 있도록 추가 분석용 데이터 저장
  type Row = { weapon: string; atkV: Record<Grade, number>; dps: Record<Grade, number> }
  const rows: Row[] = []

  for (const w of WEAPON_KEYS) {
    const row: Row = { weapon: w, atkV: {} as any, dps: {} as any }
    for (const g of GRADES) {
      const char = makeChar(w, FIXED_ARMOR, g)
      const br = computeItemValue(char.weapon, char, { chapter: TEST_CHAPTER })
      row.atkV[g] = br.atkValue
      row.dps[g] = measureWeaponDps(w, FIXED_ARMOR, g, TICKS, RUNS)
    }
    rows.push(row)

    const atkVcells = GRADES.map((g) => formatNum(row.atkV[g], 9, 1)).join(' |')
    const dpsCells  = GRADES.map((g) => formatNum(row.dps[g],  9, 1)).join(' |')
    const ratioCells = GRADES.map((g) => {
      const r = row.atkV[g] > 0 ? row.dps[g] / row.atkV[g] : 0
      return formatNum(r, 9, 2)
    }).join(' |')
    console.log(`${w.padEnd(9)} | atkV  |${atkVcells}`)
    console.log(`${''.padEnd(9)} | DPS   |${dpsCells}`)
    console.log(`${''.padEnd(9)} | 실측/V|${ratioCells}`)
    console.log('----------+-------+' + GRADES.map(() => '----------').join('+'))
  }

  // 무기별 "등급간 비율 일치도" — 노말 대비 다른 등급의 배수
  console.log(`\n## 등급간 배수 (노말 기준): 표시 atkV 배수 vs 실측 DPS 배수`)
  console.log('무기      | 항목   |' + GRADES.slice(1).map((g) => g.padStart(11)).join(' |'))
  console.log('----------+--------+' + GRADES.slice(1).map(() => '------------').join('+'))
  for (const row of rows) {
    const valMul = GRADES.slice(1).map((g) => row.atkV['노말'] > 0 ? row.atkV[g] / row.atkV['노말'] : 0)
    const dpsMul = GRADES.slice(1).map((g) => row.dps['노말'] > 0 ? row.dps[g] / row.dps['노말'] : 0)
    const diff   = valMul.map((v, i) => Math.abs(v - dpsMul[i]) / Math.max(0.01, v))
    const valStr = valMul.map((v) => formatNum(v, 11, 2)).join(' |')
    const dpsStr = dpsMul.map((v) => formatNum(v, 11, 2)).join(' |')
    const diffStr = diff.map((v) => formatPct(v, 11)).join(' |')
    console.log(`${row.weapon.padEnd(9)} | atkV×  |${valStr}`)
    console.log(`${''.padEnd(9)} | DPS ×  |${dpsStr}`)
    console.log(`${''.padEnd(9)} | 오차   |${diffStr}`)
    console.log('----------+--------+' + GRADES.slice(1).map(() => '------------').join('+'))
  }
}

// ============================================================
// 갑옷 검증: 등급별 defValue vs 실측 피해 감소
// ============================================================
function runArmorValidation() {
  const ATTACKS = 200
  const RUNS = 6
  // 무기는 영향 최소화 위해 '검' 고정 (baseline)
  const FIXED_WEAPON = '검'

  console.log(`\n=== 갑옷 벨류 검증 (몬스터 공격 ${ATTACKS}회, RUNS=${RUNS}) ===`)
  console.log(`(스탯=균등 12 / 무기=${FIXED_WEAPON} / chapter=${TEST_CHAPTER} / trait=보통)`)
  console.log(`defV = computeItemValue.defValue, dmg/atk = 실측 평균 피해/공격, 감소% = 무방어 baseline 대비\n`)

  // 무방어 baseline (armor=null) 측정 — 등급 무관
  const baselineDmg = measureArmorDmgTaken(FIXED_WEAPON, null, '노말', ATTACKS, RUNS)
  console.log(`# 무방어 baseline 피해/공격: ${baselineDmg.toFixed(2)}\n`)

  console.log('갑옷    | 항목   |' + GRADES.map((g) => g.padStart(10)).join(' |'))
  console.log('--------+--------+' + GRADES.map(() => '-----------').join('+'))

  type Row = { armor: string; defV: Record<Grade, number>; dmg: Record<Grade, number>; reduction: Record<Grade, number> }
  const rows: Row[] = []
  for (const a of ARMOR_KEYS) {
    const row: Row = { armor: a, defV: {} as any, dmg: {} as any, reduction: {} as any }
    for (const g of GRADES) {
      const char = makeChar(FIXED_WEAPON, a, g)
      const br = computeItemValue(char.armor, char, { chapter: TEST_CHAPTER })
      row.defV[g] = br.defValue
      const dmg = measureArmorDmgTaken(FIXED_WEAPON, a, g, ATTACKS, RUNS)
      row.dmg[g] = dmg
      row.reduction[g] = (baselineDmg - dmg) / baselineDmg
    }
    rows.push(row)

    const defV = GRADES.map((g) => formatNum(row.defV[g], 10, 1)).join(' |')
    const dmg  = GRADES.map((g) => formatNum(row.dmg[g],  10, 2)).join(' |')
    const red  = GRADES.map((g) => formatPct(row.reduction[g], 10)).join(' |')
    console.log(`${a.padEnd(7)} | defV   |${defV}`)
    console.log(`${''.padEnd(7)} | dmg/atk|${dmg}`)
    console.log(`${''.padEnd(7)} | 감소%  |${red}`)
    console.log('--------+--------+' + GRADES.map(() => '-----------').join('+'))
  }

  // 등급간 비율: 표시 defV 배수 vs 실측 감소량 배수 (노말 기준)
  console.log(`\n## 등급간 배수 (노말 기준): 표시 defV 배수 vs 실측 피해감소량 배수`)
  console.log('갑옷    | 항목   |' + GRADES.slice(1).map((g) => g.padStart(11)).join(' |'))
  console.log('--------+--------+' + GRADES.slice(1).map(() => '------------').join('+'))
  for (const row of rows) {
    const defMul = GRADES.slice(1).map((g) => row.defV['노말'] > 0 ? row.defV[g] / row.defV['노말'] : 0)
    const redMul = GRADES.slice(1).map((g) => row.reduction['노말'] > 0 ? row.reduction[g] / row.reduction['노말'] : 0)
    const diff   = defMul.map((v, i) => Math.abs(v - redMul[i]) / Math.max(0.01, v))
    const defStr = defMul.map((v) => formatNum(v, 11, 2)).join(' |')
    const redStr = redMul.map((v) => formatNum(v, 11, 2)).join(' |')
    const diffStr = diff.map((v) => formatPct(v, 11)).join(' |')
    console.log(`${row.armor.padEnd(7)} | defV×  |${defStr}`)
    console.log(`${''.padEnd(7)} | 감소×  |${redStr}`)
    console.log(`${''.padEnd(7)} | 오차   |${diffStr}`)
    console.log('--------+--------+' + GRADES.slice(1).map(() => '------------').join('+'))
  }
}

// ============================================================
// 종합 일치도: 모든 (무기/갑옷 × 등급) 데이터 한 줄 요약
// ============================================================
function summary() {
  console.log(`\n=== 요약: 표시 벨류가 실측 성능과 일치하는지 ===`)
  console.log(`  - 무기: atkV 비율 vs 실측 DPS 비율 (노말 → 다른 등급 배수)`)
  console.log(`  - 갑옷: defV 비율 vs 실측 피해감소 비율`)
  console.log(`  → 오차 < 15% 이면 표시 벨류가 실제 성능을 잘 반영`)
  console.log(`  → 오차 ≥ 15% 면 computeItemValue 휴리스틱과 실측치 괴리`)
}

export function runDummyValidation() {
  console.log(`\n############################################################`)
  console.log(`# 장비 등급별 더미 검증 (computeItemValue vs 실측)`)
  console.log(`############################################################`)
  runWeaponValidation()
  runArmorValidation()
  summary()
  console.log(`\n=== 완료 ===\n`)
}

if (typeof process !== 'undefined' && process.argv?.[1]?.includes('dummyValue')) {
  runDummyValidation()
}
