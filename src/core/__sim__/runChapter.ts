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
import { computeEffectiveStats } from '../stats'
import { useSkill, pickAutoAction } from '../skills'
import { rollItem } from '../items'
import { CHAPTER_THEMES } from '@/data/chapters'
import { WEAPON_KEYS } from '@/data/weapons'
import { ARMOR_KEYS } from '@/data/armor'
import type { Character, ChapterTheme, Grade, Stats, TraitTier } from '@/types'
import { computeMaxHp, computeMaxMp } from '../character'

// v9: 총 60pt 스탯 분배 다양화 (한쪽 극단 X — 각 stat 8~20 범위)
const STAT_BUILDS: { name: string; stats: Stats }[] = [
  { name: '균등',     stats: { 힘: 12, 민첩: 12, 체력: 12, 마력: 12, 행운: 12 } },
  { name: '힘탱',     stats: { 힘: 18, 민첩: 10, 체력: 15, 마력: 9,  행운: 8  } },
  { name: '속도형',   stats: { 힘: 10, 민첩: 18, 체력: 10, 마력: 10, 행운: 12 } },
  { name: '체력딜',   stats: { 힘: 15, 민첩: 10, 체력: 18, 마력: 9,  행운: 8  } },
  { name: '마법형',   stats: { 힘: 8,  민첩: 12, 체력: 12, 마력: 18, 행운: 10 } },
  { name: '행운형',   stats: { 힘: 14, 민첩: 10, 체력: 12, 마력: 8,  행운: 16 } },
]

// 균등 표준 빌드 — 보너스 없는 5스탯 각 10
function makeStandardCharacter(weaponKey: string, armorKey: string, grade: Grade, traitTier: TraitTier = '보통'): Character {
  return makeCharacterWithStats(weaponKey, armorKey, grade, { 힘: 10, 민첩: 10, 체력: 10, 마력: 10, 행운: 10 }, traitTier)
}

function makeCharacterWithStats(weaponKey: string, armorKey: string, grade: Grade, stats: Stats, traitTier: TraitTier = '보통'): Character {
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
    stats: { ...stats },
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
    const playerEff = computeEffectiveStats(ctx.player)
    const ready = checkActionReady(ctx, playerEff.무기ticks)
    for (const m of ready.readyMonsters) {
      if (ctx.ended) break
      monsterAttack(ctx, m)
      consumeAction(m, m.ticks)
    }
    if (!ctx.ended && ctx.player.actionGauge >= playerEff.무기ticks) {
      const action = pickAutoAction(ctx, {})
      if (action.kind === 'skill') {
        if (!useSkill(ctx, action.key)) playerBasicAttack(ctx)
      } else {
        playerBasicAttack(ctx)
      }
      consumeAction(ctx.player, playerEff.무기ticks)
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
  const RUNS = 300
  const GRADES: Grade[] = ['노말', '레어', '스페셜', '레전드']
  // 전체 무기 시뮬: 물리 13종 + 마법 21종(3타입×7속성) = 34종
  const WEAPONS_TO_TEST = WEAPON_KEYS

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

// v9: 스탯 분배 다양화 시뮬 — 사용자 목표 (스페셜 ~10%, 레전드 ~50%, 노말/레어 0%) 측정용
export function runCliV9() {
  const RUNS = 50
  const GRADES: Grade[] = ['스페셜', '레전드']     // 노말/레어는 0% 의도 → 측정 skip

  console.log(`\n=== Climetop v9 시뮬 — 스탯 분배 ${STAT_BUILDS.length}종 × ${RUNS} runs ===`)
  console.log(`(총 스탯 60pt, 각 stat 8~20 범위, 트레잇 보통 고정)`)
  console.log(`목표: 스페셜+스페셜 ~10% / 레전드+레전드 ~50% / 노말·레어 0%\n`)

  type WeaponResult = { weapon: string; gradeRates: Record<Grade, { perBuild: Record<string, number>; bestArmor: Record<string, string>; avg: number; best: number }> }
  const results: WeaponResult[] = []

  for (const w of WEAPON_KEYS) {
    const wr: WeaponResult = { weapon: w, gradeRates: {} as any }
    for (const grade of GRADES) {
      const perBuild: Record<string, number> = {}
      const bestArmorPerBuild: Record<string, string> = {}
      for (const build of STAT_BUILDS) {
        // 각 빌드에 best 갑옷 자동 선택
        let best = { armor: '', rate: 0 }
        for (const a of ARMOR_KEYS) {
          let wins = 0
          for (let i = 0; i < RUNS; i++) {
            const char = makeCharacterWithStats(w, a, grade, build.stats)
            if (simRunClear2(char)) wins++
          }
          const rate = wins / RUNS
          if (rate > best.rate) best = { armor: a, rate }
        }
        perBuild[build.name] = best.rate
        bestArmorPerBuild[build.name] = best.armor
      }
      const rates = Object.values(perBuild)
      const avg = rates.reduce((a, b) => a + b, 0) / rates.length
      const best = Math.max(...rates)
      wr.gradeRates[grade] = { perBuild, bestArmor: bestArmorPerBuild, avg, best }
    }
    results.push(wr)
  }

  // 출력 — 무기별 등급별 stat-build 평균 + best
  for (const grade of GRADES) {
    console.log(`\n## 등급: ${grade} — 무기별 빌드별 클리어률`)
    const header = '무기         | ' + STAT_BUILDS.map((b) => b.name.padStart(8)).join(' | ') + ' |    평균 |    best'
    console.log(header)
    console.log('-------------+' + STAT_BUILDS.map(() => '----------').join('+') + '+---------+--------')
    for (const wr of results) {
      const g = wr.gradeRates[grade]
      const row = STAT_BUILDS.map((b) => formatPct(g.perBuild[b.name]).padStart(8)).join(' | ')
      console.log(`${wr.weapon.padEnd(12)} | ${row} | ${formatPct(g.avg).padStart(7)} | ${formatPct(g.best).padStart(6)}`)
    }
  }

  // 등급별 전체 평균 (모든 무기 평균)
  console.log(`\n## 등급별 전체 평균 (15무기 × ${STAT_BUILDS.length}빌드 평균)`)
  for (const grade of GRADES) {
    const allAvg = results.map((r) => r.gradeRates[grade].avg).reduce((a, b) => a + b, 0) / results.length
    const allBest = results.map((r) => r.gradeRates[grade].best).reduce((a, b) => a + b, 0) / results.length
    console.log(`${grade.padEnd(5)}: 무기별 평균의 평균=${formatPct(allAvg)} | 무기별 best의 평균=${formatPct(allBest)}`)
  }

  console.log('\n=== v9 완료 ===\n')
}

function simRunClear2(character: Character): boolean {
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

if (typeof process !== 'undefined' && process.argv?.[1]?.includes('runChapter')) {
  runCliV9()
}
