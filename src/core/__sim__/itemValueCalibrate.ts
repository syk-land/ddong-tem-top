// ============================================================
// 표시 공/방 값 calibration — 챕터 클리어 후 남은 체력 기반 검증
//
// 절차:
//   1) 1000런: 랜덤 스탯(60~200pt) + 랜덤 장비 + 등급별 적정 챕터 보스전
//   2) 측정: 예측 atkValue / defValue vs 실측 DPS / 피해감소%
//   3) 최소제곱으로 calibration 상수 k_atk, k_def 도출
//   4) "남은 체력" 모델 — 보정값으로 HP 잔량 예측 vs 실측 비교
//
// 클리어 후 HP 잔량 모델:
//   ticks_kill = boss_maxHp / (atk_calib)
//   monster_hits = ticks_kill / monster_ticks
//   dmg_taken = monster_hits × boss_atk × (1 − def_calib/100)
//   hp_remain_pct = (maxHp − dmg_taken) / maxHp × 100
//
// 사용: npx tsx src/core/__sim__/itemValueCalibrate.ts
// ============================================================

import {
  createCombatContext, makeMonster, advanceTick, checkActionReady,
  monsterAttack, consumeAction, playerBasicAttack,
} from '../combat'
import { computeEffectiveStats } from '../stats'
import { useSkill, pickAutoAction } from '../skills'
import { rollItem } from '../items'
import { computeItemValue } from '../itemValue'
import { computeMaxHp, computeMaxMp } from '../character'
import { CHAPTER_THEMES } from '@/data/chapters'
import { WEAPON_KEYS } from '@/data/weapons'
import { ARMOR_KEYS } from '@/data/armor'
import type { Character, Stats, Grade, ChapterTheme, ItemInstance, TraitTier } from '@/types'

const THEMES: ChapterTheme[] = [
  '고블린', '골렘', '언데드', '환영', '흡혈귀',
  '심해', '기계', '용암', '암흑', '천공', '맹독',
]
const GRADES: Grade[] = ['노말', '레어', '스페셜', '레전드']

// 등급별 적정 챕터 (이전 시뮬에서 ~50% 클리어 부근)
const GRADE_CHAPTER: Record<Grade, number> = {
  '노말': 3,
  '레어': 6,
  '스페셜': 9,
  '레전드': 10,
}

function randomStats(): Stats {
  const total = 60 + Math.floor(Math.random() * 141)  // 60~200
  const s: Stats = { 힘: 0, 민첩: 0, 체력: 0, 마력: 0, 행운: 0 }
  const keys: (keyof Stats)[] = ['힘', '민첩', '체력', '마력', '행운']
  for (const k of keys) s[k] = 1
  let remaining = total - 5
  while (remaining > 0) {
    const k = keys[Math.floor(Math.random() * keys.length)]
    s[k] += 1
    remaining -= 1
  }
  return s
}

function makeChar(stats: Stats, w: ItemInstance, a: ItemInstance): Character {
  return {
    stats: { ...stats },
    hp: computeMaxHp(stats.체력), maxHp: computeMaxHp(stats.체력),
    mp: computeMaxMp(stats.마력), maxMp: computeMaxMp(stats.마력),
    weapon: w, armor: a, gold: 100, statuses: [], actionGauge: 0,
  }
}

function rollTraitTier(grade: Grade): TraitTier {
  const r = Math.random()
  if (grade === '노말')   return r < 0.7 ? '하급' : '보통'
  if (grade === '레어')   return r < 0.4 ? '하급' : r < 0.85 ? '보통' : '희귀'
  if (grade === '스페셜') return r < 0.2 ? '보통' : r < 0.7 ? '희귀' : '특별'
  return r < 0.5 ? '희귀' : '특별'
}

interface RunRecord {
  grade: Grade
  chapter: number
  maxHp: number
  predAtk: number
  predDef: number
  win: boolean
  hpRemain: number
  hpRemainPct: number
  ticks: number
  actualDps: number
  monsterDmgTotal: number
  monsterHits: number
  bossAtk: number
  bossHp: number
  bossTicks: number
  actualReductionPct: number
}

function simRun(grade: Grade): RunRecord {
  const stats = randomStats()
  const wKey = WEAPON_KEYS[Math.floor(Math.random() * WEAPON_KEYS.length)]
  const aKey = ARMOR_KEYS[Math.floor(Math.random() * ARMOR_KEYS.length)]
  const w = rollItem({ kind: 'weapon', forceBaseKey: wKey, forceGrade: grade, forceTraitTier: rollTraitTier(grade) })
  const a = rollItem({ kind: 'armor',  forceBaseKey: aKey, forceGrade: grade, forceTraitTier: rollTraitTier(grade) })
  const c = makeChar(stats, w, a)
  const chapter = GRADE_CHAPTER[grade]
  const wPred = computeItemValue(w, c, { chapter })
  const aPred = computeItemValue(a, c, { chapter })
  const predAtk = wPred.atkValue + aPred.atkValue
  const predDef = wPred.defValue + aPred.defValue

  const theme = THEMES[Math.floor(Math.random() * THEMES.length)]
  const themeDef = CHAPTER_THEMES[theme]
  const boss = makeMonster(themeDef.boss, chapter, 'boss')
  const bossAtk = boss.atk, bossHp = boss.hp, bossTicks = boss.ticks
  const startBossHp = bossHp
  c.hp = c.maxHp; c.mp = c.maxMp; c.statuses = []; c.actionGauge = 0
  const ctx = createCombatContext(c, boss)
  const MAX_TICKS = 800
  let monsterHits = 0, monsterDmg = 0
  while (!ctx.ended && ctx.tick < MAX_TICKS) {
    advanceTick(ctx)
    const eff = computeEffectiveStats(ctx.player)
    const ready = checkActionReady(ctx, eff.무기ticks)
    for (const m of ready.readyMonsters) {
      if (ctx.ended) break
      const beforeHp = ctx.player.hp
      monsterAttack(ctx, m)
      consumeAction(m, m.ticks)
      const taken = beforeHp - ctx.player.hp
      if (taken > 0) { monsterHits++; monsterDmg += taken }
    }
    if (!ctx.ended && ctx.player.actionGauge >= eff.무기ticks) {
      const action = pickAutoAction(ctx, {})
      if (action.kind === 'skill') {
        if (!useSkill(ctx, action.key)) playerBasicAttack(ctx)
      } else playerBasicAttack(ctx)
      consumeAction(ctx.player, eff.무기ticks)
    }
  }
  const dmgDealt = startBossHp - boss.hp
  const actualDps = dmgDealt / Math.max(1, ctx.tick)
  const actualReductionPct = monsterHits > 0 ? (1 - (monsterDmg / monsterHits) / bossAtk) * 100 : 100
  return {
    grade, chapter, maxHp: c.maxHp, predAtk, predDef,
    win: ctx.victory, hpRemain: Math.max(0, ctx.player.hp),
    hpRemainPct: (ctx.player.hp / c.maxHp) * 100,
    ticks: ctx.tick, actualDps, monsterDmgTotal: monsterDmg, monsterHits,
    bossAtk, bossHp, bossTicks, actualReductionPct,
  }
}

function leastSquaresK(predicted: number[], actual: number[]): number {
  let num = 0, den = 0
  for (let i = 0; i < predicted.length; i++) {
    num += predicted[i] * actual[i]
    den += predicted[i] * predicted[i]
  }
  return den > 0 ? num / den : 1
}

function mean(arr: number[]): number {
  return arr.length === 0 ? 0 : arr.reduce((s, v) => s + v, 0) / arr.length
}

function predHpRemain(rec: RunRecord, kAtk: number, kDef: number): number {
  const atk = rec.predAtk * kAtk
  const def = Math.min(99, rec.predDef * kDef)
  const ticksKill = rec.bossHp / Math.max(1, atk)
  const monsterHits = Math.max(0, ticksKill / rec.bossTicks)
  const dmgTaken = monsterHits * rec.bossAtk * Math.max(0, 1 - def / 100)
  return Math.max(0, (rec.maxHp - dmgTaken) / rec.maxHp * 100)
}

function run() {
  const PER_GRADE = 250  // 4 등급 × 250 = 1000런
  const TOTAL = PER_GRADE * GRADES.length
  console.log(`\n=== 표시 공/방 calibration — ${TOTAL} 런 (등급별 적정 챕터) ===\n`)
  console.log(`적정 챕터: 노말=ch${GRADE_CHAPTER.노말} / 레어=ch${GRADE_CHAPTER.레어} / 스페셜=ch${GRADE_CHAPTER.스페셜} / 레전드=ch${GRADE_CHAPTER.레전드}\n`)

  const records: RunRecord[] = []
  const t0 = Date.now()
  for (const g of GRADES) {
    for (let i = 0; i < PER_GRADE; i++) records.push(simRun(g))
    process.stdout.write(`  ${g} 완료 (${PER_GRADE}런)\n`)
  }
  const elapsed = ((Date.now() - t0) / 1000).toFixed(1)

  // ── 표시값 vs 실측 calibration (최소제곱) ──
  const predAtkArr = records.map((r) => r.predAtk)
  const actDpsArr  = records.map((r) => r.actualDps)
  const predDefArr = records.map((r) => r.predDef)
  const actRedArr  = records.map((r) => r.actualReductionPct)

  const kAtk = leastSquaresK(predAtkArr, actDpsArr)
  const kDef = leastSquaresK(predDefArr, actRedArr)

  console.log(`\n## 표시값 → 실측 calibration 상수 (최소제곱)`)
  console.log(`  k_atk = ${kAtk.toFixed(4)}    (표시 atkValue × ${kAtk.toFixed(3)} ≈ 실측 DPS)`)
  console.log(`  k_def = ${kDef.toFixed(4)}    (표시 defValue × ${kDef.toFixed(3)} ≈ 실측 피해감소%)`)

  // ── 등급별 평균 비교 ──
  console.log(`\n## 등급별 표시 vs 실측 (calibration 적용 전/후)`)
  console.log(`등급     | 표시 공  → ×${kAtk.toFixed(2)} = 보정 공 | 실측 DPS | 표시 방  → ×${kDef.toFixed(2)} = 보정 방 | 실측 피해감소%`)
  console.log('---------+--------+---------+---------+---------+----------+----------+')
  for (const g of GRADES) {
    const recs = records.filter((r) => r.grade === g)
    const ma = mean(recs.map((r) => r.predAtk))
    const mac = ma * kAtk
    const mdps = mean(recs.map((r) => r.actualDps))
    const md = mean(recs.map((r) => r.predDef))
    const mdc = md * kDef
    const mred = mean(recs.map((r) => r.actualReductionPct))
    console.log(`${g.padEnd(8)} | ${ma.toFixed(1).padStart(6)} → ${mac.toFixed(1).padStart(6)}  | ${mdps.toFixed(1).padStart(7)} | ${md.toFixed(1).padStart(6)} → ${mdc.toFixed(1).padStart(6)}  | ${mred.toFixed(1).padStart(7)}`)
  }

  // ── 챕터 클리어 후 남은 체력 검증 ──
  console.log(`\n## 챕터 클리어 후 남은 HP — 예측 (보정 적용) vs 실측 (클리어 케이스만)`)
  const cleared = records.filter((r) => r.win)
  console.log(`  클리어률 전체 ${cleared.length} / ${records.length} (${(cleared.length / records.length * 100).toFixed(0)}%)`)
  for (const g of GRADES) {
    const recs = cleared.filter((r) => r.grade === g)
    if (recs.length === 0) { console.log(`  ${g}: 클리어 0`); continue }
    const actualHpPct = mean(recs.map((r) => r.hpRemainPct))
    const predicted = mean(recs.map((r) => predHpRemain(r, kAtk, kDef)))
    const errs = recs.map((r) => Math.abs(predHpRemain(r, kAtk, kDef) - r.hpRemainPct))
    const meanErr = mean(errs)
    const within10 = errs.filter((e) => e < 10).length / errs.length
    console.log(`  ${g.padEnd(6)} (n=${recs.length})  실측 ${actualHpPct.toFixed(0)}% / 예측 ${predicted.toFixed(0)}%  | 평균 오차 ${meanErr.toFixed(1)}%p / ±10%p 이내 ${(within10 * 100).toFixed(0)}%`)
  }

  // ── 통계 ──
  console.log(`\n## 표시값 정확도 (보정 적용 전)`)
  function pearson(xs: number[], ys: number[]): number {
    const n = xs.length
    const mx = mean(xs), my = mean(ys)
    let num = 0, dx = 0, dy = 0
    for (let i = 0; i < n; i++) {
      num += (xs[i] - mx) * (ys[i] - my)
      dx += (xs[i] - mx) ** 2; dy += (ys[i] - my) ** 2
    }
    return num / Math.sqrt(dx * dy || 1)
  }
  console.log(`  공: Pearson ${pearson(predAtkArr, actDpsArr).toFixed(3)}`)
  console.log(`  방: Pearson ${pearson(predDefArr, actRedArr).toFixed(3)}`)

  console.log(`\n## 권장 코드 패치 (src/core/itemValue.ts)`)
  console.log(`  atkValue 계산부 마지막에 × ${kAtk.toFixed(3)} 적용 (또는 atkParts.value 들에 동일 곱)`)
  console.log(`  defValue 계산부 마지막에 × ${kDef.toFixed(3)} 적용`)

  console.log(`\n총 ${records.length} 보스전, 소요 ${elapsed}s`)
  return { kAtk, kDef }
}

if (typeof process !== 'undefined' && process.argv?.[1]?.includes('itemValueCalibrate')) {
  run()
}
