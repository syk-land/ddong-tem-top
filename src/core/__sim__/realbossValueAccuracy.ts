// ============================================================
// 진짜 보스 관점 itemValue 정확도 검증 — N회 자동 전투
//
// 측정:
//   - predicted = computeItemValue(weapon, char, { vsBoss: true }).atkValue
//                + computeItemValue(armor,  char, { vsBoss: true }).defValue
//   - actual    = makeRealBoss(theme, 0) 상대로 MAX_TICKS 자동 전투 후
//                 (보스 maxHp - 잔여 hp) / boss maxHp  ∈ [0, 1]
//
// 결과:
//   - Pearson / Spearman 상관계수
//   - 10분위(decile) 별 predicted vs actual 평균
//   - 100% 클리어 비율 (drain ≥ 0.9999)
//
// 사용: npx tsx src/core/__sim__/realbossValueAccuracy.ts
// ============================================================

import {
  createCombatContext, advanceTick, monsterAttack, consumeAction, playerBasicAttack,
} from '../combat'
import { computeEffectiveStats } from '../stats'
import { useSkill, pickAutoAction } from '../skills'
import { rollItem } from '../items'
import { computeItemValue } from '../itemValue'
import { computeMaxHp, computeMaxMp } from '../character'
import { makeRealBoss, REAL_BOSS_ORDER } from '../realboss'
import { pearson, spearman } from './_stats'
import type { Character, Stats, ItemInstance } from '@/types'

const N = 10_000
const MAX_TICKS = 600  // 한 전투 최대 600틱. 캐릭터 사망/보스 사망/시간 초과 중 먼저 발생

// 클리어 가능 캐릭터 분포 — 챕터 10 클리어자 수준의 스탯 (총합 60~180).
function randomStats(): Stats {
  const total = 60 + Math.floor(Math.random() * 120)
  const s: Stats = { 힘: 1, 민첩: 1, 체력: 1, 마력: 1, 행운: 1 }
  let rem = total - 5
  const keys: Array<keyof Stats> = ['힘', '민첩', '체력', '마력', '행운']
  while (rem > 0) {
    const k = keys[Math.floor(Math.random() * 5)]
    s[k] += 1
    rem -= 1
  }
  return s
}

function makeChar(stats: Stats, weapon: ItemInstance, armor: ItemInstance): Character {
  return {
    stats: { ...stats },
    hp: computeMaxHp(stats.체력),
    maxHp: computeMaxHp(stats.체력),
    mp: computeMaxMp(stats.마력),
    maxMp: computeMaxMp(stats.마력),
    weapon, armor,
    gold: 0,
    statuses: [],
    actionGauge: 0,
  }
}

function runRealBossFight(c: Character, themeIdx: number): number {
  c.hp = c.maxHp; c.mp = c.maxMp; c.statuses = []; c.actionGauge = 0
  const theme = REAL_BOSS_ORDER[themeIdx]
  const boss = makeRealBoss(theme, 0)
  const startHp = boss.maxHp
  const ctx = createCombatContext(c, [boss], 0)
  for (let t = 0; t < MAX_TICKS; t++) {
    advanceTick(ctx)
    if (ctx.ended) break
    if (boss.hp <= 0) break
    if (c.hp <= 0) break
    // 보스 행동
    if (boss.actionGauge >= boss.ticks) {
      monsterAttack(ctx, boss)
      consumeAction(boss, boss.ticks)
    }
    if (ctx.ended || c.hp <= 0) break
    // 플레이어 행동
    const eff = computeEffectiveStats(ctx.player)
    if (ctx.player.actionGauge >= eff.무기ticks) {
      const action = pickAutoAction(ctx, {})
      if (action.kind === 'skill') {
        if (!useSkill(ctx, action.key)) playerBasicAttack(ctx)
      } else playerBasicAttack(ctx)
      consumeAction(ctx.player, eff.무기ticks)
    }
  }
  const finalHp = Math.max(0, boss.hp)
  return Math.max(0, Math.min(1, (startHp - finalHp) / startHp))
}

function main() {
  console.log(`[realbossValueAccuracy] N=${N}, MAX_TICKS=${MAX_TICKS}`)
  console.log(`보스 themes: ${REAL_BOSS_ORDER.join(', ')}`)
  console.log()

  const predicted: number[] = []
  const actual: number[] = []
  const tStart = Date.now()
  for (let i = 0; i < N; i++) {
    const stats = randomStats()
    const w = rollItem({ kind: 'weapon' })
    const a = rollItem({ kind: 'armor' })
    const c = makeChar(stats, w, a)

    const wv = computeItemValue(w, c, { chapter: 10, vsBoss: true })
    const av = computeItemValue(a, c, { chapter: 10, vsBoss: true })
    const pred = wv.atkValue + av.defValue

    const themeIdx = Math.floor(Math.random() * REAL_BOSS_ORDER.length)
    const drain = runRealBossFight(c, themeIdx)

    predicted.push(pred)
    actual.push(drain)

    if ((i + 1) % 1000 === 0) {
      const elapsed = (Date.now() - tStart) / 1000
      console.log(`  ${i + 1} / ${N}  (${elapsed.toFixed(1)}s)`)
    }
  }

  const elapsed = (Date.now() - tStart) / 1000
  console.log(`\n[done] ${N} 회 시뮬 완료 ${elapsed.toFixed(1)}s`)
  console.log()

  // ── 통계 ──
  const r = pearson(predicted, actual)
  const rho = spearman(predicted, actual)
  const fullClear = actual.filter((d) => d >= 0.9999).length
  const partial = actual.filter((d) => d > 0 && d < 0.9999).length
  const zeroDrain = actual.filter((d) => d <= 0.0001).length
  const meanDrain = actual.reduce((a, b) => a + b, 0) / actual.length
  const medianDrain = [...actual].sort((a, b) => a - b)[Math.floor(actual.length / 2)]

  console.log('=== 상관 분석 ===')
  console.log(`Pearson  r  = ${r.toFixed(4)}  (1.0 = 완전 일치)`)
  console.log(`Spearman ρ  = ${rho.toFixed(4)}  (순위 일치도)`)
  console.log()
  console.log('=== 깎은 비율 분포 ===')
  console.log(`평균  drain = ${(meanDrain * 100).toFixed(1)}%`)
  console.log(`중앙값      = ${(medianDrain * 100).toFixed(1)}%`)
  console.log(`100% 클리어 = ${fullClear} / ${N}  (${(fullClear / N * 100).toFixed(1)}%)`)
  console.log(`부분 클리어 = ${partial} / ${N}`)
  console.log(`0% (HP 못 깎음) = ${zeroDrain} / ${N}`)
  console.log()

  // ── 10분위 분석: predicted 분위별 actual 평균 ──
  const sortedIdx = predicted
    .map((p, i) => ({ p, i }))
    .sort((a, b) => a.p - b.p)
    .map((x) => x.i)
  const decSize = Math.floor(N / 10)
  console.log('=== predicted 10분위별 actual drain ===')
  console.log(`decile  predicted_avg     actual_drain_avg     fullClear%`)
  for (let d = 0; d < 10; d++) {
    const slice = sortedIdx.slice(d * decSize, (d + 1) * decSize)
    const pAvg = slice.reduce((a, i) => a + predicted[i], 0) / slice.length
    const aAvg = slice.reduce((a, i) => a + actual[i], 0) / slice.length
    const fc = slice.filter((i) => actual[i] >= 0.9999).length
    console.log(`  ${d + 1}     ${pAvg.toFixed(2).padStart(10)}        ${(aAvg * 100).toFixed(1).padStart(5)}%             ${(fc / slice.length * 100).toFixed(1)}%`)
  }
}

main()
