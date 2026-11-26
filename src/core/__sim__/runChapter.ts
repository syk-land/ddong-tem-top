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
import { computeItemValue } from '../itemValue'
import { makeRealBoss, computeParadoxBlessing } from '../realboss'
import { CHAPTER_THEMES } from '@/data/chapters'
import { WEAPON_KEYS } from '@/data/weapons'
import { ARMOR_KEYS } from '@/data/armor'
import type { Character, ChapterTheme, Grade, Stats, TraitTier, CharacterRecord } from '@/types'
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
  const RUNS = 500
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

// v9: 마법 빌드 전용 측정 — 마법 무기 + 로브 고정, 균등 vs 고마력
export function runCliMagic() {
  const RUNS = 500
  const GRADES: Grade[] = ['스페셜', '레전드']
  const MAGIC_WEAPONS = ['완드', '스태프', '마도서']
  const BUILDS: { name: string; stats: Stats }[] = [
    { name: '균등',   stats: { 힘: 12, 민첩: 12, 체력: 12, 마력: 12, 행운: 12 } },
    { name: '고마력', stats: { 힘: 10, 민첩: 10, 체력: 10, 마력: 20, 행운: 10 } },
  ]

  console.log(`\n=== 마법 빌드 측정 — 마법무기 + 로브 / ${RUNS}런 ===\n`)
  for (const grade of GRADES) {
    console.log(`## 등급: ${grade}`)
    console.log('무기     | ' + BUILDS.map((b) => b.name.padStart(8)).join(' | ') + ' |    평균')
    console.log('---------+' + BUILDS.map(() => '----------').join('+') + '+--------')
    for (const w of MAGIC_WEAPONS) {
      const rates: number[] = []
      const cells: string[] = []
      for (const b of BUILDS) {
        let wins = 0
        for (let i = 0; i < RUNS; i++) {
          const char = makeCharacterWithStats(w, '로브', grade, b.stats)
          if (simRunClear2(char)) wins++
        }
        const r = wins / RUNS
        rates.push(r)
        cells.push(formatPct(r).padStart(8))
      }
      const avg = rates.reduce((a, b) => a + b, 0) / rates.length
      console.log(`${w.padEnd(8)} | ${cells.join(' | ')} | ${formatPct(avg).padStart(6)}`)
    }
    console.log()
  }
  console.log('=== 마법 측정 완료 ===\n')
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

// ============================================================
// Custom 시뮬 — 분배 6종 (균등 + 스탯별 몰빵) × 등급페어 2종 × 갑옷 4종
//   사용: SIM_MODE=custom npm run sim
// ============================================================
const CUSTOM_BUILDS: { name: string; stats: Stats }[] = [
  { name: '균등',     stats: { 힘: 12, 민첩: 12, 체력: 12, 마력: 12, 행운: 12 } },
  { name: '힘몰빵',   stats: { 힘: 40, 민첩: 5,  체력: 5,  마력: 5,  행운: 5  } },
  { name: '민첩몰빵', stats: { 힘: 5,  민첩: 40, 체력: 5,  마력: 5,  행운: 5  } },
  { name: '체력몰빵', stats: { 힘: 5,  민첩: 5,  체력: 40, 마력: 5,  행운: 5  } },
  { name: '마력몰빵', stats: { 힘: 5,  민첩: 5,  체력: 5,  마력: 40, 행운: 5  } },
  { name: '행운몰빵', stats: { 힘: 5,  민첩: 5,  체력: 5,  마력: 5,  행운: 40 } },
]

const GRADE_PAIRS: { name: string; wGrade: Grade; aGrade: Grade }[] = [
  { name: '스페셜·스페셜', wGrade: '스페셜', aGrade: '스페셜' },
  { name: '레전드·레전드', wGrade: '레전드', aGrade: '레전드' },
]

function makeCharCustom(wKey: string, aKey: string, wGrade: Grade, aGrade: Grade, stats: Stats): Character {
  const weapon = rollItem({ kind: 'weapon', forceBaseKey: wKey, forceGrade: wGrade, forceTraitTier: '보통' })
  const armor  = rollItem({ kind: 'armor',  forceBaseKey: aKey, forceGrade: aGrade, forceTraitTier: '보통' })
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

export function runCliCustom() {
  const RUNS = 200
  console.log(`\n=== Custom 시뮬 — 분배 ${CUSTOM_BUILDS.length}종 × 등급페어 ${GRADE_PAIRS.length}종 × 갑옷 ${ARMOR_KEYS.length}종 × ${RUNS} runs ===`)
  console.log(`(총 60pt, 무기는 매 판 랜덤 추첨, 트레잇=보통 고정)\n`)

  for (const pair of GRADE_PAIRS) {
    console.log(`\n## 무기 ${pair.wGrade} · 갑옷 ${pair.aGrade}`)
    const header = '분배       | ' + ARMOR_KEYS.map((a) => a.padStart(8)).join(' | ') + ' |    평균'
    console.log(header)
    console.log('-----------+' + ARMOR_KEYS.map(() => '----------').join('+') + '+---------')
    for (const build of CUSTOM_BUILDS) {
      const cells: number[] = []
      for (const armorKey of ARMOR_KEYS) {
        let wins = 0
        for (let i = 0; i < RUNS; i++) {
          const wKey = WEAPON_KEYS[Math.floor(Math.random() * WEAPON_KEYS.length)]
          const char = makeCharCustom(wKey, armorKey, pair.wGrade, pair.aGrade, build.stats)
          if (simRunClear2(char)) wins++
        }
        cells.push(wins / RUNS)
      }
      const avg = cells.reduce((a, b) => a + b, 0) / cells.length
      const cellsStr = cells.map((r) => formatPct(r).padStart(8)).join(' | ')
      console.log(`${build.name.padEnd(10)} | ${cellsStr} | ${formatPct(avg).padStart(7)}`)
    }
  }
  console.log('\n=== Custom 완료 ===\n')
}

export function runCliCustomMagic() {
  const RUNS = 200
  const MAGIC_WEAPONS = ['완드', '스태프', '마도서']
  const FIXED_ARMOR = '로브'
  console.log(`\n=== Custom 시뮬 (마법 빌드 강제) — 분배 ${CUSTOM_BUILDS.length}종 × 등급페어 ${GRADE_PAIRS.length}종 × ${RUNS} runs ===`)
  console.log(`(무기 ${MAGIC_WEAPONS.join('/')} 매 판 랜덤, 갑옷 로브 고정, trait=보통, magicSynergy=1.7 발동)\n`)

  for (const pair of GRADE_PAIRS) {
    console.log(`\n## 무기 ${pair.wGrade} · 갑옷 ${pair.aGrade}`)
    console.log('분배       | 클리어률')
    console.log('-----------+---------')
    for (const build of CUSTOM_BUILDS) {
      let wins = 0
      for (let i = 0; i < RUNS; i++) {
        const wKey = MAGIC_WEAPONS[Math.floor(Math.random() * MAGIC_WEAPONS.length)]
        const char = makeCharCustom(wKey, FIXED_ARMOR, pair.wGrade, pair.aGrade, build.stats)
        if (simRunClear2(char)) wins++
      }
      console.log(`${build.name.padEnd(10)} | ${formatPct(wins / RUNS).padStart(7)}`)
    }
  }
  console.log('\n=== Custom 마법 완료 ===\n')
}

export function runCliCustomBow() {
  const RUNS = 200
  const BOW_WEAPONS = ['숏보우', '롱보우', '석궁']
  const BOW_BUILDS = CUSTOM_BUILDS.filter((b) => b.name === '균등' || b.name === '민첩몰빵')
  console.log(`\n=== Custom 시뮬 (활 빌드 강제) — 분배 ${BOW_BUILDS.length}종 × 등급페어 ${GRADE_PAIRS.length}종 × 갑옷 ${ARMOR_KEYS.length}종 × ${RUNS} runs ===`)
  console.log(`(무기 ${BOW_WEAPONS.join('/')} 매 판 랜덤, ranged 카테고리 — 물리 atk = (힘 + 민첩×0.5) × ...)\n`)

  for (const pair of GRADE_PAIRS) {
    console.log(`\n## 무기 ${pair.wGrade} · 갑옷 ${pair.aGrade}`)
    const header = '분배       | ' + ARMOR_KEYS.map((a) => a.padStart(8)).join(' | ') + ' |    평균'
    console.log(header)
    console.log('-----------+' + ARMOR_KEYS.map(() => '----------').join('+') + '+---------')
    for (const build of BOW_BUILDS) {
      const cells: number[] = []
      for (const armorKey of ARMOR_KEYS) {
        let wins = 0
        for (let i = 0; i < RUNS; i++) {
          const wKey = BOW_WEAPONS[Math.floor(Math.random() * BOW_WEAPONS.length)]
          const char = makeCharCustom(wKey, armorKey, pair.wGrade, pair.aGrade, build.stats)
          if (simRunClear2(char)) wins++
        }
        cells.push(wins / RUNS)
      }
      const avg = cells.reduce((a, b) => a + b, 0) / cells.length
      const cellsStr = cells.map((r) => formatPct(r).padStart(8)).join(' | ')
      console.log(`${build.name.padEnd(10)} | ${cellsStr} | ${formatPct(avg).padStart(7)}`)
    }
  }
  console.log('\n=== Custom 활 완료 ===\n')
}

type SimScenario = {
  build: string
  stats: Stats
  weapons: string[]
  fixedArmor?: string
}

export function runCliCustomMix() {
  const RUNS = 200
  const MAGIC_KEYS = ['완드', '스태프', '마도서']
  const BOW_KEYS = ['숏보우', '롱보우', '석궁']
  const NON_MAGIC_KEYS = WEAPON_KEYS.filter((k) => !MAGIC_KEYS.includes(k))

  const SCENARIOS: SimScenario[] = [
    { build: '균등 (전체)',      stats: { 힘: 12, 민첩: 12, 체력: 12, 마력: 12, 행운: 12 }, weapons: WEAPON_KEYS },
    { build: '힘몰빵 (전체)',    stats: { 힘: 40, 민첩: 5,  체력: 5,  마력: 5,  행운: 5  }, weapons: WEAPON_KEYS },
    { build: '체력몰빵 (전체)',  stats: { 힘: 5,  민첩: 5,  체력: 40, 마력: 5,  행운: 5  }, weapons: WEAPON_KEYS },
    { build: '행운몰빵 (전체)',  stats: { 힘: 5,  민첩: 5,  체력: 5,  마력: 5,  행운: 40 }, weapons: WEAPON_KEYS },
    { build: '민첩 (마법X)',     stats: { 힘: 5,  민첩: 40, 체력: 5,  마력: 5,  행운: 5  }, weapons: NON_MAGIC_KEYS },
    { build: '민첩 (활)',        stats: { 힘: 5,  민첩: 40, 체력: 5,  마력: 5,  행운: 5  }, weapons: BOW_KEYS },
    { build: '마력 (마법+로브)', stats: { 힘: 5,  민첩: 5,  체력: 5,  마력: 40, 행운: 5  }, weapons: MAGIC_KEYS, fixedArmor: '로브' },
  ]

  console.log(`\n=== Custom MIX — 분배별 조건 무기 × 등급페어 ${GRADE_PAIRS.length}종 × ${RUNS} runs ===\n`)
  for (const pair of GRADE_PAIRS) {
    console.log(`\n## 무기 ${pair.wGrade} · 갑옷 ${pair.aGrade}`)
    const header = '분배              | ' + ARMOR_KEYS.map((a) => a.padStart(8)).join(' | ') + ' |    평균'
    console.log(header)
    console.log('------------------+' + ARMOR_KEYS.map(() => '----------').join('+') + '+---------')
    for (const sc of SCENARIOS) {
      const cells: number[] = []
      for (const armorKey of ARMOR_KEYS) {
        if (sc.fixedArmor && sc.fixedArmor !== armorKey) {
          cells.push(NaN)
          continue
        }
        let wins = 0
        for (let i = 0; i < RUNS; i++) {
          const wKey = sc.weapons[Math.floor(Math.random() * sc.weapons.length)]
          const char = makeCharCustom(wKey, armorKey, pair.wGrade, pair.aGrade, sc.stats)
          if (simRunClear2(char)) wins++
        }
        cells.push(wins / RUNS)
      }
      const valid = cells.filter((v) => !Number.isNaN(v))
      const avg = valid.length > 0 ? valid.reduce((a, b) => a + b, 0) / valid.length : 0
      const cellsStr = cells.map((r) => Number.isNaN(r) ? '       -'.padStart(8) : formatPct(r).padStart(8)).join(' | ')
      console.log(`${sc.build.padEnd(17)} | ${cellsStr} | ${formatPct(avg).padStart(7)}`)
    }
  }
  console.log('\n=== MIX 완료 ===\n')
}

// 무기/갑옷 더미 측정 — 1~3챕터 몬스터 풀에서 랜덤 소환 + 1000틱 동안 데미지/피격량 측정
//   목적: itemValue 점수가 실제 효율과 일치하는지 검증
function pickRandomLowChapterMonster(chapter: number) {
  const themes = ALL_THEMES
  const theme = themes[Math.floor(Math.random() * themes.length)]
  const def = CHAPTER_THEMES[theme]
  const tmpl = def.normalMonsters[Math.floor(Math.random() * def.normalMonsters.length)]
  return makeMonster(tmpl, chapter, 'normal')
}

function measureWeaponDps(character: Character, ticks: number): number {
  let totalDmg = 0
  let mob = pickRandomLowChapterMonster(1 + Math.floor(Math.random() * 3))
  const ctx = createCombatContext(character, mob)
  character.hp = character.maxHp
  character.mp = character.maxMp
  character.actionGauge = 0
  for (let t = 0; t < ticks; t++) {
    if (ctx.player.hp <= 0) {
      character.hp = character.maxHp
      character.mp = character.maxMp
    }
    advanceTick(ctx)
    const playerEff = computeEffectiveStats(ctx.player)
    if (ctx.player.actionGauge >= playerEff.무기ticks) {
      const beforeHp = ctx.monsters[0]?.hp ?? 0
      const action = pickAutoAction(ctx, {})
      if (action.kind === 'skill') {
        if (!useSkill(ctx, action.key)) playerBasicAttack(ctx)
      } else {
        playerBasicAttack(ctx)
      }
      consumeAction(ctx.player, playerEff.무기ticks)
      const afterHp = ctx.monsters[0]?.hp ?? 0
      totalDmg += Math.max(0, beforeHp - afterHp)
      if (ctx.monsters[0] && ctx.monsters[0].hp <= 0) {
        const newMob = pickRandomLowChapterMonster(1 + Math.floor(Math.random() * 3))
        ctx.monsters[0] = newMob
        ctx.ended = false
      }
    }
  }
  return totalDmg
}

function measureArmorTake(character: Character, ticks: number): number {
  // 적 hp 무한, 적이 계속 player 공격. player hp 회복 매 틱
  let mob = pickRandomLowChapterMonster(1 + Math.floor(Math.random() * 3))
  mob.hp = 999999  // 무한 hp
  mob.maxHp = 999999
  const ctx = createCombatContext(character, mob)
  character.hp = character.maxHp
  character.mp = character.maxMp
  character.actionGauge = 0
  let totalTaken = 0
  for (let t = 0; t < ticks; t++) {
    const beforeHp = character.hp
    advanceTick(ctx)
    const ready = checkActionReady(ctx, computeEffectiveStats(character).무기ticks)
    for (const m of ready.readyMonsters) {
      monsterAttack(ctx, m)
      consumeAction(m, m.ticks)
    }
    const afterHp = character.hp
    const taken = Math.max(0, beforeHp - afterHp)
    totalTaken += taken
    // player 즉시 풀회복 (방어 dmg만 측정)
    character.hp = character.maxHp
    character.mp = character.maxMp
  }
  return totalTaken
}

// 등급별 측정 챕터 풀 (사용자 지정): 노말 1~3 / 레어 4~7 / 스페셜 7~9 / 레전드 10~
const GRADE_CHAPTER_RANGE: Record<Grade, [number, number]> = {
  노말: [1, 3],
  레어: [4, 7],
  스페셜: [7, 9],
  레전드: [10, 11],
}

function measureWeaponDpsRanged(character: Character, ticks: number, chMin: number, chMax: number): number {
  const pick = () => {
    const ch = chMin + Math.floor(Math.random() * (chMax - chMin + 1))
    return pickRandomLowChapterMonster(ch)
  }
  let totalDmg = 0
  const ctx = createCombatContext(character, pick())
  character.hp = character.maxHp
  character.mp = character.maxMp
  character.actionGauge = 0
  for (let t = 0; t < ticks; t++) {
    if (ctx.player.hp <= 0) {
      character.hp = character.maxHp
      character.mp = character.maxMp
    }
    advanceTick(ctx)
    const playerEff = computeEffectiveStats(ctx.player)
    if (ctx.player.actionGauge >= playerEff.무기ticks) {
      const beforeHp = ctx.monsters[0]?.hp ?? 0
      const action = pickAutoAction(ctx, {})
      if (action.kind === 'skill') {
        if (!useSkill(ctx, action.key)) playerBasicAttack(ctx)
      } else {
        playerBasicAttack(ctx)
      }
      consumeAction(ctx.player, playerEff.무기ticks)
      const afterHp = ctx.monsters[0]?.hp ?? 0
      totalDmg += Math.max(0, beforeHp - afterHp)
      if (ctx.monsters[0] && ctx.monsters[0].hp <= 0) {
        ctx.monsters[0] = pick()
        ctx.ended = false
      }
    }
  }
  return totalDmg
}

function measureArmorTakeRanged(character: Character, ticks: number, chMin: number, chMax: number): number {
  const ch = chMin + Math.floor(Math.random() * (chMax - chMin + 1))
  const mob = pickRandomLowChapterMonster(ch)
  mob.hp = 999999
  mob.maxHp = 999999
  const ctx = createCombatContext(character, mob)
  character.hp = character.maxHp
  character.mp = character.maxMp
  character.actionGauge = 0
  let totalTaken = 0
  for (let t = 0; t < ticks; t++) {
    const beforeHp = character.hp
    advanceTick(ctx)
    const ready = checkActionReady(ctx, computeEffectiveStats(character).무기ticks)
    for (const m of ready.readyMonsters) {
      monsterAttack(ctx, m)
      consumeAction(m, m.ticks)
    }
    const afterHp = character.hp
    totalTaken += Math.max(0, beforeHp - afterHp)
    character.hp = character.maxHp
    character.mp = character.maxMp
  }
  return totalTaken
}

export function runCliCustomDummy() {
  const TICKS = 1000
  const RUNS = 5
  const stats: Stats = { 힘: 12, 민첩: 12, 체력: 12, 마력: 12, 행운: 12 }
  const grades: Grade[] = ['노말', '레어', '스페셜', '레전드']

  console.log(`\n=== 더미 측정 — 균등 60pt, ${TICKS}틱 × ${RUNS}런 ===`)
  console.log(`(등급별 챕터: 노말 1~3 / 레어 4~7 / 스페셜 7~9 / 레전드 10~)\n`)

  // 무기 측정 (갑옷: 같은 등급 단단한 중갑)
  for (const g of grades) {
    const [chMin, chMax] = GRADE_CHAPTER_RANGE[g]
    console.log(`\n## 무기 — ${g} (챕터 ${chMin}~${chMax}, 갑옷: 중갑 ${g})`)
    console.log('무기      | atkValue | dps (총dmg/틱) | 1000틱 누적')
    console.log('----------+----------+----------------+-------------')
    for (const w of WEAPON_KEYS) {
      const dmgs: number[] = []
      const sample = makeCharCustom(w, '중갑', g, g, stats)
      const atkV = computeItemValue(sample.weapon, sample).atkValue
      for (let r = 0; r < RUNS; r++) {
        const char = makeCharCustom(w, '중갑', g, g, stats)
        dmgs.push(measureWeaponDpsRanged(char, TICKS, chMin, chMax))
      }
      const avg = dmgs.reduce((a, b) => a + b, 0) / dmgs.length
      console.log(`${w.padEnd(8)}  | ${atkV.toFixed(1).padStart(8)} | ${(avg / TICKS).toFixed(2).padStart(14)} | ${avg.toFixed(0).padStart(11)}`)
    }
  }

  // 갑옷 측정 (무기: 같은 등급 단단한 검)
  for (const g of grades) {
    const [chMin, chMax] = GRADE_CHAPTER_RANGE[g]
    console.log(`\n## 갑옷 — ${g} (챕터 ${chMin}~${chMax}, 무기: 검 ${g})`)
    console.log('갑옷      | defValue | 받는dmg/틱     | 1000틱 누적')
    console.log('----------+----------+----------------+-------------')
    for (const a of ARMOR_KEYS) {
      const dmgs: number[] = []
      const sample = makeCharCustom('검', a, g, g, stats)
      const defV = computeItemValue(sample.armor, sample).defValue
      for (let r = 0; r < RUNS; r++) {
        const char = makeCharCustom('검', a, g, g, stats)
        dmgs.push(measureArmorTakeRanged(char, TICKS, chMin, chMax))
      }
      const avg = dmgs.reduce((a, b) => a + b, 0) / dmgs.length
      console.log(`${a.padEnd(8)}  | ${defV.toFixed(1).padStart(8)} | ${(avg / TICKS).toFixed(2).padStart(14)} | ${avg.toFixed(0).padStart(11)}`)
    }
  }

  console.log('\n=== Dummy 완료 ===\n')
}

// 장비 점수 vs 실제 성능 검증
//   각 (무기·등급) 조합과 (갑옷·등급) 조합을 같은 균등 캐릭(60pt)으로 시뮬 → itemValue 와 클리어률 비교
//   itemValue 점수 순위와 클리어률 순위가 일치해야 정상
export function runCliCustomEquip() {
  const RUNS = 100
  const stats: Stats = { 힘: 12, 민첩: 12, 체력: 12, 마력: 12, 행운: 12 }
  const grades: Grade[] = ['노말', '레어', '스페셜', '레전드']

  console.log(`\n=== 장비 점수 vs 클리어률 검증 (균등 60pt, ${RUNS}런) ===\n`)

  // 무기 비교 (갑옷 = 중갑 단단한 레어 고정)
  console.log(`## 무기 비교 (갑옷: 중갑 단단한 레어 고정)`)
  console.log('무기      | 등급     | atkValue | 클리어률')
  console.log('----------+----------+----------+---------')
  const weaponsToTest = ['단검', '검', '대검', '롱보우', '스태프', '마도서']
  for (const w of weaponsToTest) {
    for (const g of grades) {
      let wins = 0
      const sample = makeCharCustom(w, '중갑', g, '레어', stats)
      const wValue = computeItemValue(sample.weapon, sample).atkValue
      for (let i = 0; i < RUNS; i++) {
        const char = makeCharCustom(w, '중갑', g, '레어', stats)
        if (simRunClear2(char)) wins++
      }
      const winRate = wins / RUNS
      console.log(`${w.padEnd(8)}  | ${g.padEnd(6)} | ${wValue.toFixed(1).padStart(8)} | ${formatPct(winRate).padStart(7)}`)
    }
    console.log('----------+----------+----------+---------')
  }

  // 갑옷 비교 (무기 = 검 단단한 레어 고정)
  console.log(`\n## 갑옷 비교 (무기: 검 단단한 레어 고정)`)
  console.log('갑옷      | 등급     | defValue | atkValue | 합 score | 클리어률')
  console.log('----------+----------+----------+----------+----------+---------')
  for (const a of ARMOR_KEYS) {
    for (const g of grades) {
      let wins = 0
      const sample = makeCharCustom('검', a, '레어', g, stats)
      const aValue = computeItemValue(sample.armor, sample)
      const sum = aValue.atkValue + aValue.defValue
      for (let i = 0; i < RUNS; i++) {
        const char = makeCharCustom('검', a, '레어', g, stats)
        if (simRunClear2(char)) wins++
      }
      const winRate = wins / RUNS
      console.log(`${a.padEnd(8)}  | ${g.padEnd(6)} | ${aValue.defValue.toFixed(1).padStart(8)} | ${aValue.atkValue.toFixed(1).padStart(8)} | ${sum.toFixed(1).padStart(8)} | ${formatPct(winRate).padStart(7)}`)
    }
    console.log('----------+----------+----------+----------+----------+---------')
  }

  console.log('\n=== Equip 완료 ===\n')
}

export function runCliV12Verify() {
  const RUNS = 120
  console.log(`\n=== Climetop v12 Verification Sim (${RUNS} runs/case) ===\n`)

  // 1) Representative weapon/armor special & legend check with new skill imprints
  const cases: Array<{ w: string; a: string; stats: Stats; label: string }> = [
    { w: '단검', a: '가죽갑', stats: { 힘: 16, 민첩: 16, 체력: 12, 마력: 8, 행운: 8 }, label: '단검+가죽(민첩힘)' },
    { w: '검', a: '중갑', stats: { 힘: 18, 민첩: 10, 체력: 15, 마력: 9, 행운: 8 }, label: '검+중갑(힘탱)' },
    { w: '대검', a: '판금', stats: { 힘: 18, 민첩: 10, 체력: 15, 마력: 9, 행운: 8 }, label: '대검+판금(힘탱)' },
    { w: '롱보우', a: '가죽갑', stats: { 힘: 14, 민첩: 16, 체력: 14, 마력: 8, 행운: 8 }, label: '롱보우+가죽(원거리)' },
    { w: '완드', a: '로브', stats: { 힘: 8, 민첩: 12, 체력: 12, 마력: 18, 행운: 10 }, label: '완드+로브(마법형)' },
    { w: '스태프', a: '로브', stats: { 힘: 8, 민첩: 12, 체력: 12, 마력: 18, 행운: 10 }, label: '스태프+로브(마법형)' },
    { w: '마도서', a: '로브', stats: { 힘: 8, 민첩: 12, 체력: 12, 마력: 18, 행운: 10 }, label: '마도서+로브(마법형)' },
  ]
  for (const grade of ['스페셜', '레전드'] as Grade[]) {
    console.log(`## ${grade} 클리어률`)
    for (const c of cases) {
      let wins = 0
      for (let i = 0; i < RUNS; i++) {
        const ch = makeCharacterWithStats(c.w, c.a, grade, c.stats)
        if (simRunClear2(ch)) wins++
      }
      console.log(`  ${c.label.padEnd(20)}: ${formatPct(wins / RUNS)}`)
    }
  }

  // 2) Newly unlocked 4 magic skills check on 스태프 + 로브 레전드
  console.log(`\n## 해금 마법 스킬 4종 (스태프+로브 레전드, ${RUNS}런)`)
  const magicStats: Stats = { 힘: 8, 민첩: 12, 체력: 12, 마력: 18, 행운: 10 }
  for (const sk of ['빙결의화살', '폭풍칼날', '그림자일격', '정화의광선']) {
    let wins = 0
    for (let i = 0; i < RUNS; i++) {
      const w = rollItem({ kind: 'weapon', forceBaseKey: '스태프', forceGrade: '레전드', forceTraitTier: '보통', forceSkillKey: sk })
      const a = rollItem({ kind: 'armor', forceBaseKey: '로브', forceGrade: '레전드', forceTraitTier: '보통', forceSkillKey: '저항의결계' })
      const ch: Character = {
        stats: { ...magicStats },
        hp: computeMaxHp(magicStats.체력),
        maxHp: computeMaxHp(magicStats.체력),
        mp: computeMaxMp(magicStats.마력),
        maxMp: computeMaxMp(magicStats.마력),
        weapon: w,
        armor: a,
        gold: 100,
        statuses: [],
        actionGauge: 0,
      }
      if (simRunClear2(ch)) wins++
    }
    console.log(`  ${sk.padEnd(10)}: ${formatPct(wins / RUNS)}`)
  }

  // 3) Junk Gear + Corrosion Tempering +3 + Relics vs 100층 (60pt 기준) & Real Boss R0/R1
  console.log(`\n## 똥템 빌드 (녹슨 노말 + 부식연성 +3 + 유물 2종, 60pt 기준) 검증`)
  const junkStats: Stats = { 힘: 16, 민첩: 12, 체력: 14, 마력: 8, 행운: 10 }
  let junkTowerWins = 0
  let totalDrainR0 = 0
  let totalDrainR1 = 0
  for (let i = 0; i < RUNS; i++) {
    const w = rollItem({ kind: 'weapon', forceBaseKey: '단검', forceGrade: '노말', forceTraitTier: '하급', forceTraitName: '녹슨' })
    w.temperLevel = 3
    const a = rollItem({ kind: 'armor', forceBaseKey: '가죽갑', forceGrade: '노말', forceTraitTier: '하급', forceTraitName: '녹슨', forceSkillKey: '불굴의의지' })
    a.temperLevel = 3
    const ch: Character = {
      stats: { ...junkStats },
      hp: computeMaxHp(junkStats.체력),
      maxHp: computeMaxHp(junkStats.체력),
      mp: computeMaxMp(junkStats.마력),
      maxMp: computeMaxMp(junkStats.마력),
      weapon: w,
      armor: a,
      relics: ['beggar_bowl', 'cursed_anvil_shard'],
      gold: 500,
      statuses: [],
      actionGauge: 0,
    }
    if (simRunClear2(ch)) junkTowerWins++

    // RealBoss Round 0 (고블린) & Round 1 (기계) with Paradox Blessing
    const rec: CharacterRecord = {
      stats: { ...junkStats },
      score: w.tier + a.tier,
      rank: 'EX',
      cleared: true,
      avatarKey: '01',
      weapon: w,
      armor: a,
      relics: ['beggar_bowl', 'cursed_anvil_shard'],
      gold: 500,
      hp: ch.maxHp,
      maxHp: ch.maxHp,
      mp: ch.maxMp,
      maxMp: ch.maxMp,
      lastChapterTheme: '고블린',
      recordedAt: 0,
    }
    const blessing = computeParadoxBlessing(rec)
    const scaled: Stats = {
      힘: Math.round(junkStats.힘 * blessing.statMult),
      민첩: Math.round(junkStats.민첩 * blessing.statMult),
      체력: Math.round(junkStats.체력 * blessing.statMult),
      마력: Math.round(junkStats.마력 * blessing.statMult),
      행운: Math.round(junkStats.행운 * blessing.statMult),
    }
    const runRb = (theme: ChapterTheme, round: number) => {
      const rbHero: Character = {
        stats: scaled,
        hp: computeMaxHp(scaled.체력),
        maxHp: computeMaxHp(scaled.체력),
        mp: computeMaxMp(scaled.마력),
        maxMp: computeMaxMp(scaled.마력),
        weapon: w,
        armor: a,
        relics: ['beggar_bowl', 'cursed_anvil_shard'],
        gold: 500,
        statuses: [],
        actionGauge: 0,
      }
      const boss = makeRealBoss(theme, round)
      const ctx = createCombatContext(rbHero, [boss], round, { paradoxPenBonus: blessing.bonusPen })
      while (!ctx.ended && ctx.tick < 800) {
        advanceTick(ctx)
        const pe = computeEffectiveStats(ctx.player)
        const ready = checkActionReady(ctx, pe.무기ticks)
        for (const m of ready.readyMonsters) {
          if (ctx.ended) break
          monsterAttack(ctx, m)
          consumeAction(m, m.ticks)
        }
        if (!ctx.ended && ctx.player.actionGauge >= pe.무기ticks) {
          const act = pickAutoAction(ctx, {})
          if (act.kind === 'skill') {
            if (!useSkill(ctx, act.key)) playerBasicAttack(ctx)
          } else {
            playerBasicAttack(ctx)
          }
          consumeAction(ctx.player, pe.무기ticks)
        }
      }
      return Math.max(0, Math.min(1, (boss.maxHp - Math.max(0, boss.hp)) / boss.maxHp))
    }
    totalDrainR0 += runRb('고블린', 0)
    totalDrainR1 += runRb('기계', 1)
  }
  console.log(`  100층 클리어률: ${formatPct(junkTowerWins / RUNS)}`)
  console.log(`  진짜보스 R0(고블린) 평균 깎은 비율: ${formatPct(totalDrainR0 / RUNS)}`)
  console.log(`  진짜보스 R1(기계) 평균 깎은 비율: ${formatPct(totalDrainR1 / RUNS)}`)
  console.log('\n=== v12 검증 완료 ===\n')
}

if (typeof process !== 'undefined' && process.argv?.[1]?.includes('runChapter')) {
  if (process.env.SIM_MODE === 'v12_verify') {
    runCliV12Verify()
  } else if (process.env.SIM_MODE === 'custom_dummy') {
    runCliCustomDummy()
  } else if (process.env.SIM_MODE === 'custom_equip') {
    runCliCustomEquip()
  } else if (process.env.SIM_MODE === 'custom_mix') {
    runCliCustomMix()
  } else if (process.env.SIM_MODE === 'custom_bow') {
    runCliCustomBow()
  } else if (process.env.SIM_MODE === 'custom_magic') {
    runCliCustomMagic()
  } else if (process.env.SIM_MODE === 'custom') {
    runCliCustom()
  } else {
    runCliV9()
    runCliMagic()
  }
}
