// ============================================================
// 전략 시뮬: "공 높은 장비만 사기" — 매 챕터 상점에서 전투력(공) 최상위 무기 구매
// 방어구는 시작 시 레어 등급 (5~6 티어) 무작위 한 벌 고정.
// 100층 (= 10챕터 종주) 클리어율 측정.
//
// 사용: npx tsx src/core/__sim__/strategyAtkFirst.ts
// ============================================================

import {
  createCombatContext, makeMonster, advanceTick, checkActionReady,
  monsterAttack, consumeAction, playerBasicAttack,
} from '../combat'
import { useSkill, pickAutoAction } from '../skills'
import { rollItem } from '../items'
import { computeItemValue } from '../itemValue'
import { CHAPTER_THEMES } from '@/data/chapters'
import { ARMOR_KEYS } from '@/data/armor'
import type { Character, ChapterTheme, Grade, TraitTier, ItemInstance } from '@/types'
import { computeMaxHp, computeMaxMp } from '../character'

const ALL_THEMES: ChapterTheme[] = [
  '고블린', '골렘', '언데드', '환영', '흡혈귀',
  '심해', '기계', '용암', '암흑', '천공', '맹독',
]

// 시작 방어구: 레어 등급 + 하급/보통 trait (티어 5 or 6) 중 무작위
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

// 매 챕터 "상점"에서 무기 N개 매물 → atkValue 최상위 선택
function pickBestWeaponFromShop(chapter: number, character: Character, listings = 3): ItemInstance {
  const candidates: ItemInstance[] = []
  for (let i = 0; i < listings; i++) {
    candidates.push(rollItem({ kind: 'weapon', chapter, source: 'shop' }))
  }
  let bestAtk = -Infinity
  let best = candidates[0]
  for (const c of candidates) {
    const v = computeItemValue(c, character, { chapter }).atkValue
    if (v > bestAtk) { bestAtk = v; best = c }
  }
  return best
}

function makeFreshCharacter(armor: ItemInstance): Character {
  const stats = { 힘: 10, 민첩: 10, 체력: 10, 마력: 10, 행운: 10 }
  return {
    stats,
    hp: computeMaxHp(stats.체력),
    maxHp: computeMaxHp(stats.체력),
    mp: computeMaxMp(stats.마력),
    maxMp: computeMaxMp(stats.마력),
    weapon: null,
    armor,
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

interface RunResult {
  cleared: boolean
  lastChapter: number   // 패배한 챕터 (clear 시 10)
}

function simOneRun(): RunResult {
  const armor = rollStartingArmor()
  const character = makeFreshCharacter(armor)
  // 챕터별 보스 테마 셔플
  const themes = [...ALL_THEMES]
  for (let i = themes.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[themes[i], themes[j]] = [themes[j], themes[i]]
  }
  for (let ch = 1; ch <= 10; ch++) {
    // 챕터 시작 시 상점 매물 3개 중 atkValue 최고 선택 → 현재 무기 대비 교체
    const offered = pickBestWeaponFromShop(ch, character, 3)
    const currentAtk = character.weapon ? computeItemValue(character.weapon, character, { chapter: ch }).atkValue : -Infinity
    const offeredAtk = computeItemValue(offered, character, { chapter: ch }).atkValue
    if (offeredAtk > currentAtk) {
      character.weapon = offered
    }
    if (!simBossFight(ch, themes[ch - 1], character)) {
      return { cleared: false, lastChapter: ch }
    }
  }
  return { cleared: true, lastChapter: 10 }
}

function runCli() {
  const RUNS = 2000
  let wins = 0
  const failHist = new Array(11).fill(0)  // 패배한 챕터 분포
  console.log(`\n=== "전투력(공) 최우선 + 레어(5~6티어) 방어구 아무거나" 전략 시뮬 ===`)
  console.log(`runs=${RUNS}, 매 챕터 상점 매물 3개 중 최고 atkValue 무기 채택, 방어구는 시작 1회 고정\n`)
  const t0 = Date.now()
  for (let i = 0; i < RUNS; i++) {
    const r = simOneRun()
    if (r.cleared) wins++
    else failHist[r.lastChapter]++
  }
  const elapsed = ((Date.now() - t0) / 1000).toFixed(1)
  const clearRate = wins / RUNS
  console.log(`100층 클리어율: ${(clearRate * 100).toFixed(1)}% (${wins}/${RUNS})`)
  console.log(`소요: ${elapsed}s`)
  console.log(`\n패배 챕터 분포:`)
  for (let ch = 1; ch <= 10; ch++) {
    const pct = (failHist[ch] / RUNS * 100).toFixed(1)
    const bar = '█'.repeat(Math.round(failHist[ch] / RUNS * 50))
    console.log(`  ch${ch} 패배 ${failHist[ch].toString().padStart(4)} (${pct.padStart(5)}%) ${bar}`)
  }
  const winBar = '█'.repeat(Math.round(wins / RUNS * 50))
  console.log(`  100층 클리어  ${wins.toString().padStart(4)} (${(clearRate * 100).toFixed(1).padStart(5)}%) ${winBar}`)
}

if (typeof process !== 'undefined' && process.argv?.[1]?.includes('strategyAtkFirst')) {
  runCli()
}
