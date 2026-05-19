// ============================================================
// 밸런스 시뮬레이터 — v4 공식 검증용
// ============================================================
// 표준 빌드 × 챕터 1~10 × N런 시뮬레이션해서 다음을 측정:
//   - 보스 클리어 성공률
//   - 평균 보스 TTK (틱)
//   - 플레이어 평균 HP 잔존율
//   - 플레이어 사망 사유 분포
//
// 사용:
//   npx tsx src/core/__sim__/runChapter.ts
//   또는 import 해서 results 활용
//
// 이 파일은 게임 런타임에서 사용되지 않음 (dev-only). Vite 빌드에 포함 안 됨.

import { createCombatContext, makeMonster, advanceTick, checkActionReady, monsterAttack, consumeAction, playerBasicAttack } from '../combat'
import { useSkill, pickAutoAction } from '../skills'
import { rollItem } from '../items'
import { CHAPTER_THEMES, getBossBaseline } from '@/data/chapters'
import type { Character, ChapterTheme } from '@/types'
import { computeMaxHp, computeMaxMp } from '../character'

// 균등 표준 빌드 생성기
function makeStandardCharacter(chapter: number, gradeQuality: 'normal' | 'rare' | 'special' = 'rare'): Character {
  const stats = {
    공격력: 13, 방어력: 13, 체력: 12, 마력: 12,
    속도: 10, 행운: 0,
    명중률: 0, 회피율: 0,
    관통: 0, 상태저항: 0,
  }
  // 챕터 N에 어울리는 장비 (rare 정도)
  const weapon = rollItem({
    kind: 'weapon',
    chapter,
    source: 'shop',
    forceTraitTier: '보통',
    forceGrade: gradeQuality === 'special' ? '스페셜' : gradeQuality === 'normal' ? '노말' : '레어',
  })
  const armor = rollItem({
    kind: 'armor',
    chapter,
    source: 'shop',
    forceTraitTier: '보통',
    forceGrade: gradeQuality === 'special' ? '스페셜' : gradeQuality === 'normal' ? '노말' : '레어',
  })
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

// 보스 전투 시뮬 (한 챕터)
function simBossFight(chapter: number, theme: ChapterTheme, gradeQuality: 'normal' | 'rare' | 'special'): {
  victory: boolean
  tick: number
  hpRemainingPct: number
} {
  const character = makeStandardCharacter(chapter, gradeQuality)
  const themeDef = CHAPTER_THEMES[theme]
  const bossTemplate = themeDef.boss
  const boss = makeMonster(bossTemplate, chapter, 'boss')
  const ctx = createCombatContext(character, boss)
  const MAX_TICKS = 800  // 800틱 = 약 80초 게임 시간 — 그 이상이면 TLE 판정

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

  return {
    victory: ctx.victory,
    tick: ctx.tick,
    hpRemainingPct: character.hp / character.maxHp,
  }
}

// 챕터별 N런 통계 집계
export interface ChapterSimResult {
  chapter: number
  theme: ChapterTheme
  runs: number
  clearRate: number      // 0~1
  avgTick: number        // 승리 케이스 평균 틱
  avgHpRemaining: number // 승리 케이스 평균 HP%
  timeoutRate: number    // 800틱 초과 비율
}

export function simulateChapter(chapter: number, theme: ChapterTheme, runs = 100, gradeQuality: 'normal' | 'rare' | 'special' = 'rare'): ChapterSimResult {
  let victories = 0
  let timeouts = 0
  let totalTick = 0
  let totalHpPct = 0
  for (let i = 0; i < runs; i++) {
    const r = simBossFight(chapter, theme, gradeQuality)
    if (r.victory) {
      victories++
      totalTick += r.tick
      totalHpPct += r.hpRemainingPct
    } else if (r.tick >= 800) {
      timeouts++
    }
  }
  return {
    chapter, theme, runs,
    clearRate: victories / runs,
    avgTick: victories > 0 ? totalTick / victories : 0,
    avgHpRemaining: victories > 0 ? totalHpPct / victories : 0,
    timeoutRate: timeouts / runs,
  }
}

// 모든 챕터 × 모든 테마 × N런
export function simulateAll(runs = 100, gradeQuality: 'normal' | 'rare' | 'special' = 'rare'): ChapterSimResult[] {
  const themes: ChapterTheme[] = ['고블린', '골렘', '언데드', '환영', '흡혈귀', '심해', '기계', '용암', '암흑', '천공', '맹독']
  const out: ChapterSimResult[] = []
  for (let ch = 1; ch <= 10; ch++) {
    for (const theme of themes) {
      out.push(simulateChapter(ch, theme, runs, gradeQuality))
    }
  }
  return out
}

// CLI 진입점
function formatPct(p: number): string {
  return (p * 100).toFixed(1) + '%'
}

export function runCli() {
  const RUNS = 100
  console.log(`\n=== climetop 밸런스 시뮬레이터 (v4) — ${RUNS} runs/case ===\n`)

  for (const quality of ['normal', 'rare', 'special'] as const) {
    console.log(`\n## 장비 등급: ${quality}`)
    console.log('챕터 | 테마       | 클리어률 | 평균 TTK | 평균 HP% | 타임아웃')
    console.log('-----+------------+----------+----------+----------+---------')
    const results = simulateAll(RUNS, quality)
    for (const r of results) {
      console.log(
        `  ${String(r.chapter).padStart(2)} | ${r.theme.padEnd(10)} | ${formatPct(r.clearRate).padStart(8)} | ${r.avgTick.toFixed(0).padStart(8)} | ${formatPct(r.avgHpRemaining).padStart(8)} | ${formatPct(r.timeoutRate).padStart(7)}`,
      )
    }
  }
  console.log('\n=== 완료 ===\n')
}

// process.argv 로 직접 실행 시 (node/tsx) CLI 호출
//   브라우저 빌드에는 포함되지 않음 (Vite tree-shake)
if (typeof process !== 'undefined' && process.argv?.[1]?.includes('runChapter')) {
  runCli()
}
