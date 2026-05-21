// ============================================================
// 등급별 적정 챕터 매칭 시뮬
//
// 목적:
//   ItemDetail.vue 의 공/방 표시값이 "이 등급은 챕터 X 까지가 적정" 이라는
//   감을 사용자에게 제대로 주는지 검증.
//
// 측정:
//   각 등급 (노말/레어/스페셜/레전드) × 챕터(1~10) 보스전 클리어률
//   (캐릭터 스탯 매번 무작위, 총 30~80pt 다양화, 무기/갑옷 같은 등급으로 랜덤)
//
// 출력:
//   1) 클리어률 매트릭스 (행=등급, 열=ch1~10)
//   2) 각 등급별 적정 챕터 = 클리어률 50% 가장 가까운 챕터 + 인접 챕터 분포
//   3) 적정 챕터에서 평균 표시 공/방 값 vs 실측 DPS/피해감소%
//
// 설계 의도 (BALANCE.md):
//   노말 best ≈ 0% (의도적 못 깸) — 1~2챕터에서 막힘
//   레어 best ≈ 50% (전체 클리어) — 5~7챕터까지 OK
//   스페셜 best ≈ 10% — 8~9챕터까지 OK
//   레전드 best ≈ 50% — 10챕터 클리어
//
// 사용: npx tsx src/core/__sim__/itemValueByGrade.ts
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
import { WEAPON_KEYS, WEAPONS } from '@/data/weapons'
import { ARMOR_KEYS } from '@/data/armor'
import type { Character, Stats, Grade, ChapterTheme, ItemInstance, TraitTier } from '@/types'

const THEMES: ChapterTheme[] = [
  '고블린', '골렘', '언데드', '환영', '흡혈귀',
  '심해', '기계', '용암', '암흑', '천공', '맹독',
]

const GRADES: Grade[] = ['노말', '레어', '스페셜', '레전드']

// 다양한 스탯 분배: 총 60~200pt 무작위 (총합 자체도 변동), 각 스탯 최소 1
function randomStats(): Stats {
  const totalBudget = 60 + Math.floor(Math.random() * 141)  // 60~200
  const s: Stats = { 힘: 0, 민첩: 0, 체력: 0, 마력: 0, 행운: 0 }
  const keys: (keyof Stats)[] = ['힘', '민첩', '체력', '마력', '행운']
  for (const k of keys) s[k] = 1
  let remaining = totalBudget - 5
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
    hp: computeMaxHp(stats.체력),
    maxHp: computeMaxHp(stats.체력),
    mp: computeMaxMp(stats.마력),
    maxMp: computeMaxMp(stats.마력),
    weapon: w, armor: a,
    gold: 100,
    statuses: [],
    actionGauge: 0,
  }
}

// 단일 보스전 — 클리어 여부 + 평균 DPS/피해감소 측정
function simBossFight(
  chapter: number,
  theme: ChapterTheme,
  c: Character,
): { win: boolean; dpsApprox: number; dmgTakenPerHit: number; ticks: number } {
  const themeDef = CHAPTER_THEMES[theme]
  const boss = makeMonster(themeDef.boss, chapter, 'boss')
  const startBossHp = boss.hp
  const startPlayerHp = c.hp
  c.hp = c.maxHp
  c.mp = c.maxMp
  c.statuses = []
  c.actionGauge = 0
  const ctx = createCombatContext(c, boss)
  const MAX_TICKS = 800
  let monsterHits = 0
  let monsterDmgDealt = 0

  while (!ctx.ended && ctx.tick < MAX_TICKS) {
    advanceTick(ctx)
    const playerEff = computeEffectiveStats(ctx.player)
    const ready = checkActionReady(ctx, playerEff.무기ticks)
    for (const m of ready.readyMonsters) {
      if (ctx.ended) break
      const beforeHp = ctx.player.hp
      monsterAttack(ctx, m)
      consumeAction(m, m.ticks)
      const taken = beforeHp - ctx.player.hp
      if (taken > 0) { monsterHits++; monsterDmgDealt += taken }
    }
    if (!ctx.ended && ctx.player.actionGauge >= playerEff.무기ticks) {
      const action = pickAutoAction(ctx, {})
      if (action.kind === 'skill') {
        if (!useSkill(ctx, action.key)) playerBasicAttack(ctx)
      } else playerBasicAttack(ctx)
      consumeAction(ctx.player, playerEff.무기ticks)
    }
  }
  void startPlayerHp
  const dmgDealt = startBossHp - boss.hp
  const dpsApprox = dmgDealt / Math.max(1, ctx.tick)
  const dmgTakenPerHit = monsterHits > 0 ? monsterDmgDealt / monsterHits : 0
  return { win: ctx.victory, dpsApprox, dmgTakenPerHit, ticks: ctx.tick }
}

interface CellStat {
  runs: number
  wins: number
  sumPredAtk: number    // 표시값 (atkValue 합 — 무기+갑옷)
  sumPredDef: number
  sumActDps: number
  sumDmgTakenPerHit: number
  ticksSum: number
}

function emptyCell(): CellStat {
  return { runs: 0, wins: 0, sumPredAtk: 0, sumPredDef: 0, sumActDps: 0, sumDmgTakenPerHit: 0, ticksSum: 0 }
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// 특성 티어: 등급에 따라 자연스럽게 — 노말은 하급/보통, 레전드는 희귀/특별 비중↑
function rollTraitTier(grade: Grade): TraitTier {
  const r = Math.random()
  if (grade === '노말')   return r < 0.7 ? '하급' : '보통'
  if (grade === '레어')   return r < 0.4 ? '하급' : r < 0.85 ? '보통' : '희귀'
  if (grade === '스페셜') return r < 0.2 ? '보통' : r < 0.7 ? '희귀' : '특별'
  return r < 0.5 ? '희귀' : '특별'   // 레전드
}

function run() {
  const RUNS = 200
  console.log(`\n=== 등급 × 챕터 클리어률 매트릭스 (각 ${RUNS} 런, 스탯 60~200pt 랜덤 분배) ===\n`)

  // matrix[grade][chapter] = CellStat
  const matrix: Record<Grade, Record<number, CellStat>> = {} as any
  for (const g of GRADES) {
    matrix[g] = {}
    for (let ch = 1; ch <= 10; ch++) matrix[g][ch] = emptyCell()
  }

  const t0 = Date.now()
  for (const g of GRADES) {
    for (let ch = 1; ch <= 10; ch++) {
      const themes = shuffle(THEMES)
      for (let r = 0; r < RUNS; r++) {
        const stats = randomStats()
        // 무기/갑옷 랜덤 — 같은 등급
        const wKey = WEAPON_KEYS[Math.floor(Math.random() * WEAPON_KEYS.length)]
        const aKey = ARMOR_KEYS[Math.floor(Math.random() * ARMOR_KEYS.length)]
        // 마법 무기 + 로브 시너지 강제 X — 자연 랜덤
        const wTrait = rollTraitTier(g)
        const aTrait = rollTraitTier(g)
        const w = rollItem({ kind: 'weapon', forceBaseKey: wKey, forceGrade: g, forceTraitTier: wTrait })
        const a = rollItem({ kind: 'armor',  forceBaseKey: aKey, forceGrade: g, forceTraitTier: aTrait })
        const c = makeChar(stats, w, a)
        const wPred = computeItemValue(w, c, { chapter: ch })
        const aPred = computeItemValue(a, c, { chapter: ch })
        const theme = themes[r % themes.length]
        const res = simBossFight(ch, theme, c)
        const cell = matrix[g][ch]
        cell.runs++
        if (res.win) cell.wins++
        cell.sumPredAtk += wPred.atkValue + aPred.atkValue
        cell.sumPredDef += wPred.defValue + aPred.defValue
        cell.sumActDps += res.dpsApprox
        cell.sumDmgTakenPerHit += res.dmgTakenPerHit
        cell.ticksSum += res.ticks
      }
    }
    process.stdout.write(`  ${g} 완료\n`)
  }
  const elapsed = ((Date.now() - t0) / 1000).toFixed(1)

  // 1) 클리어률 매트릭스
  console.log(`\n## 클리어률 — 행: 등급, 열: 챕터 (보스전 단일)`)
  const header = '등급       | ' + Array.from({ length: 10 }, (_, i) => `ch${i + 1}`.padStart(5)).join(' | ')
  console.log(header)
  console.log('-----------+' + Array.from({ length: 10 }, () => '-------').join('+'))
  for (const g of GRADES) {
    const row = []
    for (let ch = 1; ch <= 10; ch++) {
      const cell = matrix[g][ch]
      const rate = cell.runs > 0 ? cell.wins / cell.runs : 0
      row.push(`${(rate * 100).toFixed(0)}%`.padStart(5))
    }
    console.log(`${g.padEnd(10)} | ${row.join(' | ')}`)
  }

  // 2) 적정 챕터 (클리어률 ≈ 50% 가장 가까운 챕터)
  console.log(`\n## 등급별 적정 챕터 (50% 클리어률 가장 근접)`)
  for (const g of GRADES) {
    let best = { ch: 1, gap: Infinity, rate: 0 }
    for (let ch = 1; ch <= 10; ch++) {
      const cell = matrix[g][ch]
      const rate = cell.runs > 0 ? cell.wins / cell.runs : 0
      const gap = Math.abs(rate - 0.5)
      if (gap < best.gap) best = { ch, gap, rate }
    }
    const cell = matrix[g][best.ch]
    const meanPredAtk = cell.sumPredAtk / cell.runs
    const meanPredDef = cell.sumPredDef / cell.runs
    const meanActDps = cell.sumActDps / cell.runs
    const meanDmgPerHit = cell.sumDmgTakenPerHit / cell.runs
    console.log(`  ${g.padEnd(6)} → 적정 ch${best.ch}  (${(best.rate * 100).toFixed(0)}%)  | 표시 공 ${meanPredAtk.toFixed(1)} / 실측 DPS ${meanActDps.toFixed(1)}  | 표시 방 ${meanPredDef.toFixed(1)} / 피격당 평균 ${meanDmgPerHit.toFixed(1)}`)
  }

  // 3) 의도 vs 실제 — 등급별 "기대 적정 챕터" 와 측정 적정 챕터 일치 여부
  console.log(`\n## 의도된 적정 챕터 vs 측정 적정 챕터`)
  const intended: Record<Grade, [number, number]> = {
    '노말':   [1, 3],
    '레어':   [4, 6],
    '스페셜': [7, 9],
    '레전드': [9, 10],
  }
  for (const g of GRADES) {
    const [lo, hi] = intended[g]
    let inWindow = 0, totalRange = 0
    for (let ch = lo; ch <= hi; ch++) {
      const cell = matrix[g][ch]
      const rate = cell.runs > 0 ? cell.wins / cell.runs : 0
      inWindow += rate
      totalRange += 1
    }
    const avgInWindow = totalRange > 0 ? inWindow / totalRange : 0
    const status = avgInWindow >= 0.4 && avgInWindow <= 0.7 ? '✅ 적정' : avgInWindow < 0.4 ? '⚠️ 약함' : '⚠️ 강함'
    console.log(`  ${g.padEnd(6)} (의도 ch${lo}~${hi})  평균 ${(avgInWindow * 100).toFixed(0)}%   ${status}`)
  }

  // 4) 표시값 일관성 — 같은 등급에서 챕터 무관하게 표시 공/방 값이 일관된지
  //    표시값은 chapter ref 영향 받음 (ch별 enemy def/eva 다름). 변화량 작아야 등급 직관 OK
  console.log(`\n## 등급별 표시 공/방 (적정 챕터 기준)`)
  for (const g of GRADES) {
    let best = { ch: 1, gap: Infinity }
    for (let ch = 1; ch <= 10; ch++) {
      const rate = matrix[g][ch].wins / Math.max(1, matrix[g][ch].runs)
      if (Math.abs(rate - 0.5) < best.gap) best = { ch, gap: Math.abs(rate - 0.5) }
    }
    const ch1 = matrix[g][1]
    const ch5 = matrix[g][5]
    const ch10 = matrix[g][10]
    const fmt = (c: CellStat) => `공 ${(c.sumPredAtk / Math.max(1, c.runs)).toFixed(1)}/방 ${(c.sumPredDef / Math.max(1, c.runs)).toFixed(1)}`
    console.log(`  ${g.padEnd(6)}  ch1: ${fmt(ch1).padEnd(20)}  ch5: ${fmt(ch5).padEnd(20)}  ch10: ${fmt(ch10)}`)
  }

  console.log(`\n총 ${GRADES.length * 10 * RUNS} 보스전, 소요 ${elapsed}s`)
}

if (typeof process !== 'undefined' && process.argv?.[1]?.includes('itemValueByGrade')) {
  run()
}
