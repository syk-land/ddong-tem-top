// ============================================================
// 밸런스 시뮬레이터 v6 — 100층 종주 클리어률 측정
// ============================================================
// 목표:
//   보너스 없는 캐릭터(균등 10/10/10/10/10) 기준
//   레어 무기 + 레어 방어구 → 100층 종주 클리어률 50%
//   각 등급 한 단계 ↑ 마다 +5%
//
// "모든 무기별 각 방어구중 한두 개만 그 수준이면 OK"
//   → 각 무기 종류 × 각 갑옷 종류 × 등급 별 best 조합 측정
//
// 사용: npm run sim
//
// Vite 빌드에 포함 안 됨.

import { createCombatContext, makeMonster, advanceTick, checkActionReady, monsterAttack, consumeAction, playerBasicAttack } from '../combat'
import { useSkill, pickAutoAction } from '../skills'
import { rollItem } from '../items'
import { CHAPTER_THEMES } from '@/data/chapters'
import { WEAPON_KEYS } from '@/data/weapons'
import { ARMOR_KEYS } from '@/data/armor'
import type { Character, ChapterTheme, Grade, TraitTier } from '@/types'
import { computeMaxHp, computeMaxMp } from '../character'

// 균등 표준 빌드 — 보너스 없는 5스탯 각 10
function makeStandardCharacter(weaponKey: string, armorKey: string, grade: Grade, traitTier: TraitTier = '보통'): Character {
  const stats = {
    힘: 10, 민첩: 10, 체력: 10, 마력: 10, 행운: 10,
  }
  const weapon = rollItem({
    kind: 'weapon',
    forceBaseKey: weaponKey,
    forceGrade: grade,
    forceTraitTier: traitTier,
  })
  const armor = rollItem({
    kind: 'armor',
    forceBaseKey: armorKey,
    forceGrade: grade,
    forceTraitTier: traitTier,
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

// 1 챕터 보스전 — character 직접 받음(상태 누적 X, 매 챕터 fresh)
function simBossFight(chapter: number, theme: ChapterTheme, character: Character): boolean {
  const themeDef = CHAPTER_THEMES[theme]
  const bossTemplate = themeDef.boss
  const boss = makeMonster(bossTemplate, chapter, 'boss')
  // 풀 HP / MP 로 진입
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

const ALL_THEMES: ChapterTheme[] = ['고블린', '골렘', '언데드', '환영', '흡혈귀', '심해', '기계', '용암', '암흑', '천공', '맹독']

// 1런: 챕터 1~10 모든 보스 차례로 클리어 시도 (각 챕터 풀 HP/MP)
function simRunClear(weaponKey: string, armorKey: string, grade: Grade): boolean {
  const character = makeStandardCharacter(weaponKey, armorKey, grade)
  // 랜덤 10개 테마 셔플 (한 런 내 챕터 1~10 각각 1개)
  const themes = [...ALL_THEMES]
  for (let i = themes.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[themes[i], themes[j]] = [themes[j], themes[i]]
  }
  for (let ch = 1; ch <= 10; ch++) {
    const theme = themes[ch - 1]
    if (!simBossFight(ch, theme, character)) return false
  }
  return true
}

// (weapon, armor, grade) 조합 클리어률
function sim100Floor(weaponKey: string, armorKey: string, grade: Grade, runs: number): number {
  let wins = 0
  for (let i = 0; i < runs; i++) {
    if (simRunClear(weaponKey, armorKey, grade)) wins++
  }
  return wins / runs
}

function formatPct(p: number): string {
  return (p * 100).toFixed(0) + '%'
}

// 챕터별 보스 클리어률 측정 (단일 보스, character 매번 fresh)
function simBossPerChapter(weaponKey: string, armorKey: string, grade: Grade, runs: number): Map<string, number> {
  // key = "chN:테마" → wins
  const wins: Record<string, number> = {}
  const total: Record<string, number> = {}
  for (let i = 0; i < runs; i++) {
    for (let ch = 1; ch <= 10; ch++) {
      for (const theme of ALL_THEMES) {
        const k = `ch${ch}:${theme}`
        const character = makeStandardCharacter(weaponKey, armorKey, grade)
        const ok = simBossFight(ch, theme, character)
        total[k] = (total[k] ?? 0) + 1
        if (ok) wins[k] = (wins[k] ?? 0) + 1
      }
    }
  }
  const result = new Map<string, number>()
  for (const k of Object.keys(total)) {
    result.set(k, (wins[k] ?? 0) / total[k])
  }
  return result
}

export function runCli() {
  const RUNS = 500
  const GRADES: Grade[] = ['노말', '레어', '스페셜', '레전드']
  const MAGIC_REPS = ['완드_불', '스태프_불', '마도서_불']
  const PHYSICAL = WEAPON_KEYS.filter((k) => !k.includes('_'))
  const WEAPONS_TO_TEST = [...PHYSICAL, ...MAGIC_REPS]

  console.log(`\n=== Climetop 100층 종주 시뮬레이터 v6 — ${RUNS} runs/case ===`)
  console.log(`(보너스 없는 캐릭터: 5스탯 각 10, 보통 특성 고정)`)
  console.log(`목표: 레어+레어 best 50%, 등급 1단계 ↑ = +5~10%\n`)

  // 등급별 모든 무기 × 방어구 매트릭스
  const allResults: Record<string, Record<string, Record<string, number>>> = {}
  for (const grade of GRADES) {
    allResults[grade] = {}
    console.log(`\n## 등급: ${grade}`)
    console.log('무기         | ' + ARMOR_KEYS.map((a) => a.padStart(6)).join(' | '))
    console.log('-------------+' + ARMOR_KEYS.map(() => '--------').join('+'))
    for (const w of WEAPONS_TO_TEST) {
      allResults[grade][w] = {}
      const row: string[] = []
      for (const a of ARMOR_KEYS) {
        const rate = sim100Floor(w, a, grade, RUNS)
        allResults[grade][w][a] = rate
        row.push(formatPct(rate).padStart(6))
      }
      console.log(`${w.padEnd(12)} | ${row.join(' | ')}`)
    }
  }

  // 무기별 best armor 조합 — 사용자 목표: 무기별 best가 목표 수준 -5%이내
  console.log(`\n## 무기별 best 방어구 조합 클리어률 (목표: 노말 40 / 레어 50 / 스페셜 60 / 레전드 70, -5% 이내)`)
  console.log('무기         | ' + GRADES.map((g) => g.padStart(12)).join(' | '))
  console.log('-------------+' + GRADES.map(() => '--------------').join('+'))
  for (const w of WEAPONS_TO_TEST) {
    const cols: string[] = []
    for (const grade of GRADES) {
      let best = { a: '', rate: 0 }
      for (const a of ARMOR_KEYS) {
        const r = allResults[grade][w][a]
        if (r > best.rate) best = { a, rate: r }
      }
      cols.push(`${(best.a.padStart(4))} ${formatPct(best.rate).padStart(4)}`.padStart(12))
    }
    console.log(`${w.padEnd(12)} | ${cols.join(' | ')}`)
  }

  // 등급별 최고/최저 + 평균
  console.log(`\n## 등급별 best/avg`)
  for (const grade of GRADES) {
    let best = { w: '', a: '', rate: 0 }
    let sum = 0, n = 0
    for (const w of WEAPONS_TO_TEST) {
      for (const a of ARMOR_KEYS) {
        const r = allResults[grade][w][a]
        sum += r
        n++
        if (r > best.rate) best = { w, a, rate: r }
      }
    }
    console.log(`${grade.padEnd(5)} best=${best.w}+${best.a} ${formatPct(best.rate)} | avg=${formatPct(sum / n)}`)
  }

  // 보스별 클리어률 분석 (best 케이스 기준 — 레어 등급 + 평균 무기)
  console.log(`\n## 보스별 클리어률 (레어+레어 + 보통 무기 — '검+중갑' 기준, ${RUNS * 11}런)`)
  const bossRates = simBossPerChapter('검', '중갑', '레어', RUNS)
  // 정렬: 클리어률 낮은 순
  const sortedBosses = [...bossRates.entries()].sort((a, b) => a[1] - b[1])
  console.log('낮은 5개 (어려운 보스):')
  for (const [k, r] of sortedBosses.slice(0, 5)) {
    console.log(`  ${k.padEnd(15)} ${formatPct(r)}`)
  }
  console.log('높은 5개 (쉬운 보스):')
  for (const [k, r] of sortedBosses.slice(-5).reverse()) {
    console.log(`  ${k.padEnd(15)} ${formatPct(r)}`)
  }
  // 평균에서 +/- 15% 이상 벗어난 보스
  const avgBoss = [...bossRates.values()].reduce((a, b) => a + b, 0) / bossRates.size
  console.log(`\n## 평균 보스 클리어률 ${formatPct(avgBoss)} 에서 ±15%p 이상 벗어난 보스:`)
  const outliers = sortedBosses.filter(([_, r]) => Math.abs(r - avgBoss) > 0.15)
  for (const [k, r] of outliers) {
    const diff = ((r - avgBoss) * 100).toFixed(0)
    console.log(`  ${k.padEnd(15)} ${formatPct(r)} (${diff[0] === '-' ? '' : '+'}${diff}%p)`)
  }

  console.log('\n=== 완료 ===\n')
}

if (typeof process !== 'undefined' && process.argv?.[1]?.includes('runChapter')) {
  runCli()
}
