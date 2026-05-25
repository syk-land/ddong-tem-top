// ============================================================
// 진짜 보스 11종 누적 클리어 가능성 — 자동 전투 시뮬레이션
//
// 시나리오:
//   - 챔피언 = 100층 클리어 가능 수준 (평균 stats 총합 ≈ 150)
//   - 보너스 스탯 전부 체력 분배 (사용자 요청)
//   - clearCount 가 늘수록 permanentStartBonus +60pt 누적 → 모두 체력
//   - 진짜보스 (clearCount=N, N=0..10) 11종 순차 도전
//   - 각 보스 N_PER_BOSS 회 시뮬 → 평균 drain / full clear% 측정
//
// 출력:
//   - 보스 순서대로 stat / 평균 drain / 100% 클리어 비율
//   - 첫 100% 클리어 가능 보스 인덱스 (도달 가능 시점)
//
// 사용: npx tsx src/core/__sim__/realbossProgression.ts
// ============================================================

import {
  createCombatContext, advanceTick, monsterAttack, consumeAction, playerBasicAttack,
} from '../combat'
import { computeEffectiveStats } from '../stats'
import { useSkill, pickAutoAction } from '../skills'
import { rollItem } from '../items'
import { makeRealBoss, REAL_BOSS_ORDER } from '../realboss'
import { computeMaxHp, computeMaxMp } from '../character'
import type { Character, Stats, ItemInstance } from '@/types'

const N_PER_BOSS = 100         // 보스당 평가 fight 수 (drain/clear%)
const NSEQ = 50000             // 평균 첫 클리어 측정용 도전 시퀀스 수 (높을수록 정확)
const MAX_ATTEMPTS = 300       // 한 시퀀스에서 안전장치 (이만큼 시도해도 클리어 못 하면 abort)
const MAX_TICKS = 1500         // 한 전투 최대 틱 (캐릭터/보스 사망 또는 시간 초과)
const BASE_STAT_TOTAL = 150    // 100층 클리어 평균 챔피언 (균등 분배 시 각 30)

type ChampionBuild = 'evenly' | 'str_focus'  // 균등 / 50% 힘 + 50% 균등

// 챔피언 캐릭터 — 100층 클리어 가능 stats (60 × 라운드, 라운드=clearCount+1).
//   evenly:    5스탯 균등 분배
//   str_focus: 50% 힘 + 50% 나머지 4스탯 균등
function makeChampionChar(clearCount: number, build: ChampionBuild = 'evenly'): Character {
  const total = 60 * (clearCount + 1)  // 라운드 N 캐릭터 = 총 60N pt
  let stats: Stats
  if (build === 'str_focus') {
    const focused = Math.floor(total * 0.5)
    const rem = total - focused
    const each = Math.floor(rem / 4)
    const rem2 = rem - each * 4
    stats = { 힘: focused, 민첩: each, 체력: each, 마력: each, 행운: each }
    const others: Array<keyof Stats> = ['민첩', '체력', '마력', '행운']
    for (let i = 0; i < rem2; i++) stats[others[i]] += 1
  } else {
    const each = Math.floor(total / 5)
    const rem = total - each * 5
    stats = { 힘: each, 민첩: each, 체력: each, 마력: each, 행운: each }
    const keys: Array<keyof Stats> = ['힘', '민첩', '체력', '마력', '행운']
    for (let i = 0; i < rem; i++) stats[keys[i]] += 1
  }

  // 챔피언 장비: 100층 클리어자 평균 — 레전드 + 특별 trait 가정
  const weapon = rollItem({ kind: 'weapon', forceGrade: '레전드', forceTraitTier: '특별' })
  const armor  = rollItem({ kind: 'armor',  forceGrade: '레전드', forceTraitTier: '특별' })
  return {
    stats,
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

const CURRENT_BUILD: ChampionBuild = (process.env.BUILD as ChampionBuild) || 'evenly'

function runFight(c: Character, themeIdx: number, clearCount: number): { drain: number; alive: boolean; ticks: number } {
  c.hp = c.maxHp; c.mp = c.maxMp; c.statuses = []; c.actionGauge = 0
  const theme = REAL_BOSS_ORDER[themeIdx]
  const boss = makeRealBoss(theme, clearCount)
  const startHp = boss.maxHp
  const ctx = createCombatContext(c, [boss], clearCount)
  let ticksUsed = 0
  for (let t = 0; t < MAX_TICKS; t++) {
    ticksUsed = t
    advanceTick(ctx)
    if (ctx.ended) break
    if (boss.hp <= 0) break
    if (c.hp <= 0) break
    if (boss.actionGauge >= boss.ticks) {
      monsterAttack(ctx, boss)
      consumeAction(boss, boss.ticks)
    }
    if (ctx.ended || c.hp <= 0) break
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
  const drain = Math.max(0, Math.min(1, (startHp - finalHp) / startHp))
  return { drain, alive: c.hp > 0, ticks: ticksUsed }
}

function main() {
  console.log(`[realbossProgression] N_PER_BOSS=${N_PER_BOSS}, NSEQ=${NSEQ}, BUILD=${CURRENT_BUILD}`)
  console.log(`챔피언 stats 총합 = 60 × 라운드 (= 60×(clearCount+1)) / 분배: ${CURRENT_BUILD === 'evenly' ? '균등 5등분' : '50% 힘 + 50% 나머지 4스탯 균등'}`)
  console.log(`장비: 레전드 + 특별 trait 강제 추첨`)
  console.log()

  console.log(`보스 순서: ${REAL_BOSS_ORDER.join(' → ')}`)
  console.log()
  console.log(`Idx  Boss        Boss HP    ATK   DEF   drain(avg)  clear%  avg ticks  평균첫클리어  p95`)
  console.log(`──────────────────────────────────────────────────────────────────────────────────────────`)

  let firstClearAt = -1
  let lastClearAt = -1
  for (let cc = 0; cc < REAL_BOSS_ORDER.length; cc++) {
    // 1) 100회 평가 fight — drain 분포 + clear% + 평균 ticks 측정
    const drains: number[] = []
    const ticksAll: number[] = []
    let fullClears = 0
    for (let n = 0; n < N_PER_BOSS; n++) {
      const c = makeChampionChar(cc, CURRENT_BUILD)
      const r = runFight(c, cc, cc)
      drains.push(r.drain)
      ticksAll.push(r.ticks)
      if (r.drain >= 0.9999) fullClears++
    }
    const avg = drains.reduce((a, b) => a + b, 0) / drains.length
    const avgTicks = ticksAll.reduce((a, b) => a + b, 0) / ticksAll.length

    // 2) NSEQ 개 도전 시퀀스 — 각 시퀀스에서 첫 클리어까지 몇 번 도전했는지 측정
    const seqAttempts: number[] = []
    for (let s = 0; s < NSEQ; s++) {
      let attempts = 0
      while (attempts < MAX_ATTEMPTS) {
        attempts++
        const c = makeChampionChar(cc, CURRENT_BUILD)
        const r = runFight(c, cc, cc)
        if (r.drain >= 0.9999) break
      }
      seqAttempts.push(attempts)
    }
    seqAttempts.sort((a, b) => a - b)
    const avgFirst = seqAttempts.reduce((a, b) => a + b, 0) / seqAttempts.length
    const medFirst = seqAttempts[Math.floor(seqAttempts.length / 2)]
    const p95First = seqAttempts[Math.floor(seqAttempts.length * 0.95)]

    const theme = REAL_BOSS_ORDER[cc]
    // 검증용 — 실제 makeRealBoss 가 산출하는 stat
    const sampleBoss = makeRealBoss(theme, cc)
    console.log(`${(cc + 1).toString().padStart(2)}   ${theme.padEnd(8)}  ${sampleBoss.maxHp.toString().padStart(6)}    ${sampleBoss.atk.toString().padStart(3)}   ${sampleBoss.def.toString().padStart(3)}    ${(avg * 100).toFixed(1).padStart(5)}%   ${fullClears.toString().padStart(3)}/${N_PER_BOSS}    ${avgTicks.toFixed(0).padStart(4)}      ${avgFirst.toFixed(1).padStart(5)}회   ${p95First.toString().padStart(3)}회`)
    if (fullClears > 0 && firstClearAt < 0) firstClearAt = cc + 1
    if (fullClears > 0) lastClearAt = cc + 1
  }

  console.log()
  console.log('=== 진단 ===')
  if (firstClearAt < 0) {
    console.log(`❌ 11종 보스 모두 100% 클리어 불가능 — 챔피언 stats/장비 부족 또는 보스 OP`)
  } else {
    console.log(`✅ 첫 100% 클리어 가능 보스: ${firstClearAt} (${REAL_BOSS_ORDER[firstClearAt - 1]})`)
    console.log(`   마지막 100% 클리어 가능 보스: ${lastClearAt} (${REAL_BOSS_ORDER[lastClearAt - 1]})`)
    if (lastClearAt === REAL_BOSS_ORDER.length) {
      console.log(`   → 11종 보스 모두 진행 가능 (전부 100% 클리어 발생)`)
    } else {
      console.log(`   ⚠ ${lastClearAt}번 보스까지 클리어 가능. ${lastClearAt + 1}~${REAL_BOSS_ORDER.length}번은 불가`)
    }
  }
}

main()
