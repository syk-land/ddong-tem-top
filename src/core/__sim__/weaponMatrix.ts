// ============================================================
// 무기별 100층 클리어율 매트릭스
// 시작 시 무기 1자루 (등급 가변) 고정, 방어구는 레어 무작위.
// 캐릭터 stat = 균등 10/10/10/10/10.
// ============================================================

import {
  createCombatContext, makeMonster, advanceTick, checkActionReady,
  monsterAttack, consumeAction, playerBasicAttack,
} from '../combat'
import { useSkill, pickAutoAction } from '../skills'
import { rollItem } from '../items'
import { CHAPTER_THEMES } from '@/data/chapters'
import { ARMOR_KEYS } from '@/data/armor'
import { WEAPON_KEYS } from '@/data/weapons'
import type { Character, ChapterTheme, Grade, TraitTier, ItemInstance } from '@/types'
import { computeMaxHp, computeMaxMp } from '../character'

const ALL_THEMES: ChapterTheme[] = [
  '고블린', '골렘', '언데드', '환영', '흡혈귀',
  '심해', '기계', '용암', '암흑', '천공', '맹독',
]

function rollStartingArmor(): ItemInstance {
  const armorKey = ARMOR_KEYS[Math.floor(Math.random() * ARMOR_KEYS.length)]
  const traitTier: TraitTier = Math.random() < 0.5 ? '하급' : '보통'
  return rollItem({
    kind: 'armor',
    forceBaseKey: armorKey,
    forceGrade: '레어',
    forceTraitTier: traitTier,
  })
}

function makeFreshCharacter(weapon: ItemInstance, armor: ItemInstance): Character {
  const stats = { 힘: 10, 민첩: 10, 체력: 10, 마력: 10, 행운: 10 }
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

function simBossFight(chapter: number, theme: ChapterTheme, character: Character): boolean {
  const themeDef = CHAPTER_THEMES[theme]
  const boss = makeMonster(themeDef.boss, chapter, 'boss')
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

function simOneRun(weaponKey: string, weaponGrade: Grade, weaponTraitTier: TraitTier): boolean {
  const weapon = rollItem({
    kind: 'weapon',
    forceBaseKey: weaponKey,
    forceGrade: weaponGrade,
    forceTraitTier: weaponTraitTier,
  })
  const armor = rollStartingArmor()
  const character = makeFreshCharacter(weapon, armor)
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

interface WeaponResult {
  weapon: string
  rate: number
  wins: number
}

function runCli() {
  const RUNS = 500
  const GRADE: Grade = '레어'
  const TRAIT: TraitTier = '보통'  // 6 티어 고정
  console.log(`\n=== 무기별 100층 클리어율 (${GRADE}+${TRAIT}, 방어구=레어 무작위, ${RUNS}런/무기) ===`)
  console.log(`캐릭터: 균등 10/10/10/10/10, 무기 한 자루 고정 (챕터 진행 중 교체 없음)\n`)

  const t0 = Date.now()
  const results: WeaponResult[] = []
  for (const w of WEAPON_KEYS) {
    let wins = 0
    for (let i = 0; i < RUNS; i++) {
      if (simOneRun(w, GRADE, TRAIT)) wins++
    }
    results.push({ weapon: w, rate: wins / RUNS, wins })
  }
  const elapsed = ((Date.now() - t0) / 1000).toFixed(1)

  // 정렬: 클리어율 높은 순
  results.sort((a, b) => b.rate - a.rate)

  console.log('순위 | 무기              | 클리어율 | 클리어수')
  console.log('-----+-------------------+----------+---------')
  results.forEach((r, i) => {
    const pct = (r.rate * 100).toFixed(1) + '%'
    const bar = '█'.repeat(Math.round(r.rate * 30))
    console.log(`${(i + 1).toString().padStart(3)} | ${r.weapon.padEnd(17)} | ${pct.padStart(7)} | ${r.wins.toString().padStart(4)}/${RUNS} ${bar}`)
  })

  console.log(`\n소요: ${elapsed}s`)
  const totalAvg = results.reduce((s, r) => s + r.rate, 0) / results.length
  console.log(`전체 평균 클리어율: ${(totalAvg * 100).toFixed(1)}%`)
  const top5 = results.slice(0, 5)
  const bot5 = results.slice(-5)
  console.log(`\n## 클리어 가능 무기 (top 5):`)
  top5.forEach(r => console.log(`  ${r.weapon.padEnd(18)} ${(r.rate * 100).toFixed(1)}%`))
  console.log(`\n## 클리어 거의 불가 무기 (bottom 5):`)
  bot5.forEach(r => console.log(`  ${r.weapon.padEnd(18)} ${(r.rate * 100).toFixed(1)}%`))
}

if (typeof process !== 'undefined' && process.argv?.[1]?.includes('weaponMatrix')) {
  runCli()
}
