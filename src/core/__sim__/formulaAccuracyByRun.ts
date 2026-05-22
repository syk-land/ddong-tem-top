// ============================================================
// 표시값 정확도 검증 — 자동플레이 런 결과 (클리어/도달챕터) 대비 표시값
//
// 각 자동플레이 런 마지막 상태에서 3가지 공식 값 계산:
//   1) 기존공식 (현재 itemValue.ts)
//   2) 신규공식 (closed-form per-tick, chapter-relative)
//   3) v3 공식 (신규 + MP 게이팅 + 속도 안정성 + 명중 안정성)
//
// 정확도 측정:
//   - AUC (binary 클리어/실패 분류)
//   - Pearson (표시값 vs 도달챕터 1~10)
//   - 클리어/실패 평균 분리도
//
// 자동플레이 규칙은 autoplayClear.ts 와 동일 (사용자 지정 규칙)
//
// 사용: RUNS=30000 npx tsx src/core/__sim__/formulaAccuracyByRun.ts
// ============================================================

import {
  createCombatContext, makeMonster, advanceTick, checkActionReady,
  monsterAttack, consumeAction, playerBasicAttack,
} from '../combat'
import { computeEffectiveStats } from '../stats'
import { useSkill, pickAutoAction } from '../skills'
import { rollItem } from '../items'
import { applySmithUpgrade, buyStatPoint } from '../events'
import { computeMaxHp, computeMaxMp } from '../character'
import { computeItemValue } from '../itemValue'
import { computeWeaponSkillProc } from '../buildBalance'
import { CHAPTER_THEMES, ALL_THEME_KEYS, getNormalMonsterBaseline } from '@/data/chapters'
import { CHALLENGES } from '@/data/challenges'
import { WEAPONS } from '@/data/weapons'
import { ARMORS } from '@/data/armor'
import { WEAPON_TRAITS, ARMOR_TRAITS } from '@/data/traits'
import { SKILLS } from '@/data/skills'
import type {
  Character, Stats, StatKey, ChapterTheme, MonsterTemplate, MonsterInstance, ItemInstance,
} from '@/types'

function clampN(v: number, lo: number, hi: number): number { return Math.max(lo, Math.min(hi, v)) }
function isMagicWeapon(c: Character): boolean {
  return c.weapon ? !!WEAPONS[c.weapon.baseKey]?.isMagic : false
}

function generateDice(): Stats {
  const s: Stats = { 힘: 0, 민첩: 0, 체력: 0, 마력: 0, 행운: 0 }
  const keys: StatKey[] = ['힘', '민첩', '체력', '마력', '행운']
  let rem = 60
  while (rem > 0) {
    s[keys[Math.floor(Math.random() * keys.length)]] += 1
    rem--
  }
  return s
}

function challengeStat(c: typeof CHALLENGES[number]): StatKey | null {
  const bonus = c.instantBonus
  if (!bonus) return null
  let bestKey: StatKey | null = null
  let bestVal = 0
  for (const k of ['힘', '민첩', '체력', '마력', '행운'] as StatKey[]) {
    if ((bonus[k] ?? 0) > bestVal) { bestVal = bonus[k] ?? 0; bestKey = k }
  }
  return bestKey
}

function pickChallenge(diceStats: Stats): typeof CHALLENGES[number] | null {
  const opts = [...CHALLENGES].sort(() => Math.random() - 0.5).slice(0, 3)
  const sortedStats: StatKey[] = (['힘', '민첩', '체력', '마력', '행운'] as StatKey[])
    .sort((a, b) => diceStats[b] - diceStats[a])
  for (const sk of sortedStats) {
    const match = opts.find((c) => challengeStat(c) === sk)
    if (match) return match
  }
  return null
}

function createChar(stats: Stats, bonus?: Partial<Stats>): Character {
  const final: Stats = { ...stats }
  if (bonus) for (const k of Object.keys(bonus) as StatKey[]) final[k] = (final[k] ?? 0) + (bonus[k] ?? 0)
  return {
    stats: final,
    hp: computeMaxHp(final.체력), maxHp: computeMaxHp(final.체력),
    mp: computeMaxMp(final.마력), maxMp: computeMaxMp(final.마력),
    weapon: rollItem({ kind: 'weapon', forceTraitTier: '하급', forceGrade: '노말' }),
    armor: null, gold: 50, statuses: [], actionGauge: 0,
  }
}

function simSingleCombat(c: Character, monster: MonsterInstance, maxTicks = 800): boolean {
  const ctx = createCombatContext(c, monster)
  while (!ctx.ended && ctx.tick < maxTicks) {
    advanceTick(ctx)
    const eff = computeEffectiveStats(ctx.player)
    const ready = checkActionReady(ctx, eff.무기ticks)
    for (const m of ready.readyMonsters) {
      if (ctx.ended) break
      monsterAttack(ctx, m)
      consumeAction(m, m.ticks)
    }
    if (!ctx.ended && ctx.player.actionGauge >= eff.무기ticks) {
      const action = pickAutoAction(ctx, {})
      if (action.kind === 'skill') {
        if (!useSkill(ctx, action.key)) playerBasicAttack(ctx)
      } else playerBasicAttack(ctx)
      consumeAction(ctx.player, eff.무기ticks)
    }
  }
  return ctx.victory
}

function simNormalMonsters(c: Character, theme: ChapterTheme, chapter: number): boolean {
  const tdef = CHAPTER_THEMES[theme]
  const count = 1 + Math.floor(Math.random() * 2)
  for (let i = 0; i < count; i++) {
    const tmpl: MonsterTemplate = tdef.normalMonsters[Math.floor(Math.random() * tdef.normalMonsters.length)]
    const m = makeMonster(tmpl, chapter, 'normal')
    if (c.hp <= 0) return false
    if (!simSingleCombat(c, m)) return false
  }
  return true
}

function simBoss(c: Character, theme: ChapterTheme, chapter: number): boolean {
  const m = makeMonster(CHAPTER_THEMES[theme].boss, chapter, 'boss')
  return simSingleCombat(c, m)
}

function highestStat(stats: Stats): StatKey {
  let best: StatKey = '힘'
  for (const k of ['힘', '민첩', '체력', '마력', '행운'] as StatKey[]) if (stats[k] > stats[best]) best = k
  return best
}

function doBlackMarket(c: Character, chapter: number) {
  const t = highestStat(c.stats)
  while (buyStatPoint(c, chapter, t)) {}
}
function doSmith(c: Character) {
  if (!c.weapon) return
  const m = Math.min(c.gold, c.weapon.sellPrice * 2)
  if (m > 0) applySmithUpgrade(c, m)
}
function shouldEquipArmor(c: Character, it: ItemInstance): boolean {
  const cur = c.armor
  if (!cur) return true
  const magic = isMagicWeapon(c)
  if (magic) {
    if (cur.baseKey !== '로브' && it.baseKey === '로브') return true
    if (cur.baseKey === '로브' && it.baseKey !== '로브') return false
    return it.tier > cur.tier
  }
  return it.tier > cur.tier
}
function takeTreasure(c: Character, chapter: number) {
  const k = Math.random() < 0.5 ? 'weapon' : 'armor'
  const it = rollItem({ kind: k, chapter, source: 'treasure' })
  if (k === 'weapon') { if (!c.weapon || it.tier > c.weapon.tier) c.weapon = it }
  else if (shouldEquipArmor(c, it)) c.armor = it
}
function autoShop(c: Character, chapter: number) {
  const slots = Math.min(3 + Math.floor((chapter - 1) / 3), 6)
  const inv: ItemInstance[] = []
  for (let i = 0; i < slots; i++) inv.push(rollItem({ kind: Math.random() < 0.5 ? 'weapon' : 'armor', chapter, source: 'shop' }))
  const magic = isMagicWeapon(c)
  inv.sort((a, b) => {
    const aB = (magic && a.kind === 'armor' && a.baseKey === '로브') ? 100 : 0
    const bB = (magic && b.kind === 'armor' && b.baseKey === '로브') ? 100 : 0
    return (b.tier + bB) - (a.tier + aB)
  })
  for (const it of inv) {
    if (c.gold < it.buyPrice) continue
    if (it.kind === 'weapon') { if (!c.weapon || it.tier > c.weapon.tier) { c.gold -= it.buyPrice; c.weapon = it } }
    else if (shouldEquipArmor(c, it)) { c.gold -= it.buyPrice; c.armor = it }
  }
}
function doHealingSpring(c: Character) { c.hp = c.maxHp; c.mp = c.maxMp }
function doSpecialEvent(c: Character, chapter: number) {
  const evs = ['smith', 'blackmarket', 'crisis', 'roulette', 'altar', 'collector']
  const ev = evs[Math.floor(Math.random() * evs.length)]
  if (ev === 'smith') doSmith(c)
  else if (ev === 'blackmarket') doBlackMarket(c, chapter)
  else if (ev === 'crisis') {
    if (Math.random() < 0.7) c.gold += 50
    else {
      const m = makeMonster(CHAPTER_THEMES['고블린'].normalMonsters[0], chapter, 'normal')
      simSingleCombat(c, m, 400)
    }
  }
}

// 신규공식 (per-tick atk + per-tick def 감소량)
const SKILL_MULT: Record<string, { mult: number; magic: boolean }> = {
  스매쉬: { mult: 2.0, magic: false }, 피어스: { mult: 1.0, magic: false },
  연속공격: { mult: 1.4, magic: false }, 정밀타격: { mult: 1.5, magic: false },
  급습: { mult: 1.65, magic: false }, 빙결의화살: { mult: 2.2, magic: true },
  화염구: { mult: 6.5, magic: true }, 폭풍칼날: { mult: 3.15, magic: true },
  바위충격: { mult: 4.8, magic: true }, 번개창: { mult: 5.5, magic: true },
  그림자일격: { mult: 2.2, magic: true }, 정화의광선: { mult: 1.8, magic: true },
}

function formulaNew(c: Character, chapter: number): { atk: number; def: number } {
  if (!c.weapon || !c.armor) return { atk: 0, def: 0 }
  const wbase = WEAPONS[c.weapon.baseKey]
  const abase = ARMORS[c.armor.baseKey as keyof typeof ARMORS]
  const wTrait = WEAPON_TRAITS[c.weapon.trait]
  const aTrait = ARMOR_TRAITS[c.armor.trait]
  if (!wbase || !abase || !wTrait || !aTrait) return { atk: 0, def: 0 }
  const stats = c.stats
  const enemy = getNormalMonsterBaseline(chapter)
  const atkPct = (wTrait.effects.공격력_pct ?? 0) + (wTrait.effects.전스탯_pct ?? 0)
  const atkMultBase = wbase.baseAtk * c.weapon.coef * (1 + atkPct)
  const isLobe = abase.key === '로브'
  const magicSyn = isLobe && wbase.isMagic ? 1.5 : 1.0
  const physStat = wbase.category === 'ranged' ? stats.힘 + stats.민첩 * 0.3 : stats.힘
  const totalAtk = wbase.isMagic
    ? stats.마력 * atkMultBase * 1.5 * magicSyn
    : physStat * atkMultBase * 3.0
  const acc = 60 + (wbase.accBonus ?? 0) + (c.weapon.effects.명중 ?? 0) + (c.armor.effects.명중 ?? 0)
    + stats.민첩 * 0.5 + stats.행운 * 0.1
  const hitRate = clampN((acc - enemy.eva) / 100, 0, 1)
  const pen = (wbase.penBonus ?? 0) + (wbase.magicPenBonus ?? 0) + (c.weapon.effects.관통 ?? 0)
  const effDef = Math.max(0, enemy.def - pen) / 100
  const basicHit = Math.max(1, totalAtk * (1 - effDef)) * hitRate
  const skillKey = wbase.autoSkill
  const skillInfo = skillKey ? SKILL_MULT[skillKey] : undefined
  let avgHit = basicHit
  if (skillKey && skillInfo) {
    const procRate = computeWeaponSkillProc(c, stats.행운)
    const skillHit = Math.max(1, totalAtk * skillInfo.mult * (1 - effDef)) * hitRate
    avgHit = (1 - procRate) * basicHit + procRate * skillHit
  }
  const critChance = clampN(stats.민첩 * 0.003, 0, 1)
  const critMult = 1.3 + stats.행운 / 100
  const critBoost = 1 + critChance * (critMult - 1)
  const wticks = Math.round(10 / wbase.speedCoef)
  let armorSpeed = abase.speedMult ?? 1
  if (abase.key === '로브' && wbase.isMagic) armorSpeed *= 1.15
  const wSpeedPct = c.weapon.effects.속도_pct ?? 0
  const aSpeedPct = c.armor.effects.속도_pct ?? 0
  const gaugePerTick = (1 + stats.민첩 / 100) * (1 + wSpeedPct + aSpeedPct) * armorSpeed
  const attacksPerTick = gaugePerTick / wticks
  const atkPerTick = avgHit * critBoost * attacksPerTick
  const defPctTrait = (aTrait.effects.방어력_pct ?? 0) + (aTrait.effects.전스탯_pct ?? 0)
  const armorDef = abase.baseDef * c.armor.coef * (1 + defPctTrait)
  const hpDef = stats.체력 * 0.3 * c.armor.coef
  const playerDefPct = clampN(armorDef + hpDef, 0, 99) / 100
  const playerEva = 5 + (wbase.evaBonus ?? 0) + (c.weapon.effects.회피 ?? 0) + (c.armor.effects.회피 ?? 0)
    + (abase.evasion ?? 0) + stats.민첩 * 0.5 + stats.행운 * 0.1
  const enemyHitRate = clampN((enemy.acc - playerEva) / 100, 0, 1)
  const enemyAttacksPerTick = 1 / enemy.ticks
  const dmgNoArmor = enemy.atk * enemyHitRate * enemyAttacksPerTick
  const defPerTick = Math.max(0, dmgNoArmor * playerDefPct)
  return { atk: atkPerTick, def: defPerTick }
}

function formulaV3(c: Character, chapter: number): { atk: number; def: number } {
  if (!c.weapon || !c.armor) return { atk: 0, def: 0 }
  const wbase = WEAPONS[c.weapon.baseKey]
  const { atk: atkBase, def } = formulaNew(c, chapter)
  let mpDiscount = 1.0
  const skillKey = wbase.autoSkill
  if (wbase.isMagic && skillKey) {
    const skill = SKILLS[skillKey]
    if (skill && skill.mp > 0) {
      const FIGHT_TICKS = 200
      const wticks = Math.round(10 / wbase.speedCoef)
      const gauge = (1 + c.stats.민첩 / 100)
      const attacksInFight = (FIGHT_TICKS * gauge) / wticks
      const procRate = computeWeaponSkillProc(c, c.stats.행운)
      const wantSkillUses = attacksInFight * procRate
      let mpCost = skill.mp
      if ((skill.kind === 'magic_atk' || skill.kind === 'magic_def') && wbase.isMagic) {
        mpCost = Math.max(0, mpCost + (wbase.mpBonus ?? 0))
      }
      const mpNeed = wantSkillUses * mpCost
      mpDiscount = mpNeed > c.maxMp ? c.maxMp / mpNeed : 1.0
    }
  }
  const wticks = Math.round(10 / wbase.speedCoef)
  const stability = 1 - Math.min(0.25, Math.max(0, (wticks - 8) * 0.030))
  const accBonus = wbase.accBonus ?? 0
  const accStability = 1 + Math.max(0, accBonus) * 0.012
  return { atk: atkBase * mpDiscount * stability * accStability, def }
}

interface Sample {
  reachedChapter: number   // 1~10
  cleared: number          // 0 or 1
  exist_atk: number
  exist_def: number
  new_atk: number
  new_def: number
  v3_atk: number
  v3_def: number
  maxHp: number            // 체력 stat 반영된 maxHp
  maxMp: number
}

function autoplayAndEval(): Sample | null {
  const dice = generateDice()
  const challenge = pickChallenge(dice)
  const c = createChar(dice, challenge?.instantBonus)
  if (challenge?.instantStartGold) c.gold += challenge.instantStartGold
  const pool = [...ALL_THEME_KEYS].sort(() => Math.random() - 0.5).slice(0, 5) as ChapterTheme[]
  const chapters: ChapterTheme[] = []
  for (let i = 0; i < 10; i++) chapters.push(pool[i < 5 ? i : i - 5])

  let reachedChapter = 0
  let died = false
  for (let ch = 1; ch <= 10 && !died; ch++) {
    reachedChapter = ch
    const theme = chapters[ch - 1]
    const ftypes = ['shop', 'treasure', 'healing', 'monster', 'monster', 'monster', 'monster', 'monster', 'monster']
    if (Math.random() < 0.05) {
      const i = ftypes.findIndex((t, i) => t === 'monster' && i > 3)
      if (i >= 0) ftypes[i] = 'special'
    }
    for (let i = ftypes.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[ftypes[i], ftypes[j]] = [ftypes[j], ftypes[i]]
    }
    for (const ft of ftypes) {
      if (ft === 'monster') { if (!simNormalMonsters(c, theme, ch)) { died = true; break } }
      else if (ft === 'shop') autoShop(c, ch)
      else if (ft === 'treasure') takeTreasure(c, ch)
      else if (ft === 'healing') doHealingSpring(c)
      else if (ft === 'special') doSpecialEvent(c, ch)
      c.hp = Math.min(c.maxHp, c.hp + Math.round(c.maxHp * 0.1))
      c.mp = Math.min(c.maxMp, c.mp + Math.round(c.maxMp * 0.1))
    }
    if (!died && !simBoss(c, theme, ch)) died = true
    if (!died) { c.hp = c.maxHp; c.mp = c.maxMp; c.statuses = []; c.actionGauge = 0 }
  }
  if (!c.weapon || !c.armor) return null
  // 표시값 계산 — 종료 시점 장비 + 캐릭터 스탯, 챕터는 도달 챕터 기준
  const chForCalc = reachedChapter
  const wExist = computeItemValue(c.weapon, c, { chapter: chForCalc })
  const aExist = computeItemValue(c.armor, c, { chapter: chForCalc })
  const fNew = formulaNew(c, chForCalc)
  const fV3 = formulaV3(c, chForCalc)
  return {
    reachedChapter,
    cleared: died ? 0 : 1,
    exist_atk: wExist.atkValue + aExist.atkValue,
    exist_def: wExist.defValue + aExist.defValue,
    new_atk: fNew.atk, new_def: fNew.def,
    v3_atk: fV3.atk, v3_def: fV3.def,
    maxHp: c.maxHp,
    maxMp: c.maxMp,
  }
}

// ── 통계 ──
function pearson(xs: number[], ys: number[]): number {
  const n = xs.length
  if (n === 0) return 0
  const mx = xs.reduce((a, b) => a + b, 0) / n
  const my = ys.reduce((a, b) => a + b, 0) / n
  let num = 0, dx = 0, dy = 0
  for (let i = 0; i < n; i++) { num += (xs[i] - mx) * (ys[i] - my); dx += (xs[i] - mx) ** 2; dy += (ys[i] - my) ** 2 }
  return num / Math.sqrt(dx * dy || 1)
}
function spearman(xs: number[], ys: number[]): number {
  function ranks(arr: number[]): number[] {
    const idx = arr.map((v, i) => ({ v, i })).sort((a, b) => a.v - b.v)
    const r = new Array(arr.length).fill(0)
    for (let i = 0; i < idx.length; i++) r[idx[i].i] = i + 1
    return r
  }
  return pearson(ranks(xs), ranks(ys))
}
// AUC for binary classification (sampled — too slow for full nested loop with 30k samples)
function auc(scores: number[], labels: number[], maxPairs = 5_000_000): number {
  const pos: number[] = [], neg: number[] = []
  for (let i = 0; i < scores.length; i++) {
    if (labels[i] > 0.5) pos.push(scores[i])
    else neg.push(scores[i])
  }
  if (pos.length === 0 || neg.length === 0) return 0.5
  // Sample pairs
  const total = pos.length * neg.length
  if (total <= maxPairs) {
    let wins = 0
    for (const p of pos) for (const n of neg) {
      if (p > n) wins++
      else if (p === n) wins += 0.5
    }
    return wins / total
  }
  let wins = 0
  for (let i = 0; i < maxPairs; i++) {
    const p = pos[Math.floor(Math.random() * pos.length)]
    const n = neg[Math.floor(Math.random() * neg.length)]
    if (p > n) wins++
    else if (p === n) wins += 0.5
  }
  return wins / maxPairs
}

function run() {
  const RUNS = parseInt(process.env.RUNS || '30000')
  console.log(`\n=== 표시값 정확도 검증 — 자동플레이 ${RUNS} 런, 클리어/실패 분리 ===\n`)
  const t0 = Date.now()
  const samples: Sample[] = []
  for (let i = 0; i < RUNS; i++) {
    const s = autoplayAndEval()
    if (s) samples.push(s)
    if ((i + 1) % 5000 === 0) process.stdout.write(`  진행 ${i + 1}/${RUNS} (${((Date.now() - t0) / 1000).toFixed(0)}s)\r`)
  }
  console.log(`\n  소요 ${((Date.now() - t0) / 1000).toFixed(1)}s, 유효 샘플 ${samples.length}\n`)

  const cleared = samples.filter((s) => s.cleared > 0.5)
  const failed = samples.filter((s) => s.cleared < 0.5)
  console.log(`클리어 ${cleared.length} / 실패 ${failed.length} (클리어률 ${(cleared.length / samples.length * 100).toFixed(1)}%)`)

  // 평균 표시값 분리도 (클리어 vs 실패)
  console.log(`\n## 평균 표시값 — 클리어 vs 실패 (분리도 = 클리어/실패)`)
  console.log(`공식         | 클리어 평균(atk+def) | 실패 평균    | 분리도`)
  console.log('-------------+---------------------+-------------+-------')
  function meanScore(arr: Sample[], k: 'exist' | 'new' | 'v3'): number {
    if (k === 'exist') return arr.reduce((s, x) => s + x.exist_atk + x.exist_def, 0) / Math.max(1, arr.length)
    if (k === 'new')   return arr.reduce((s, x) => s + x.new_atk + x.new_def, 0) / Math.max(1, arr.length)
    return arr.reduce((s, x) => s + x.v3_atk + x.v3_def, 0) / Math.max(1, arr.length)
  }
  for (const fkey of ['exist', 'new', 'v3'] as const) {
    const mc = meanScore(cleared, fkey)
    const mf = meanScore(failed, fkey)
    const label = fkey === 'exist' ? '기존공식       ' : fkey === 'new' ? '신규공식       ' : 'v3 공식        '
    console.log(`${label}| ${mc.toFixed(2).padStart(17)} | ${mf.toFixed(2).padStart(11)} | ${(mc / mf).toFixed(2)}x`)
  }

  // AUC, Pearson with reachedChapter
  console.log(`\n## 분류 정확도 — score = atk + def`)
  console.log(`공식         | AUC (cleared)  | Pearson r (vs 도달챕터) | Spearman ρ`)
  console.log('-------------+----------------+-------------------------+-----------')
  function scoreOf(s: Sample, k: 'exist' | 'new' | 'v3'): number {
    if (k === 'exist') return s.exist_atk + s.exist_def
    if (k === 'new')   return s.new_atk + s.new_def
    return s.v3_atk + s.v3_def
  }
  for (const fkey of ['exist', 'new', 'v3'] as const) {
    const scores = samples.map((s) => scoreOf(s, fkey))
    const labels = samples.map((s) => s.cleared)
    const chapters = samples.map((s) => s.reachedChapter)
    const a = auc(scores, labels)
    const pc = pearson(scores, chapters)
    const sp = spearman(scores, chapters)
    const label = fkey === 'exist' ? '기존공식       ' : fkey === 'new' ? '신규공식       ' : 'v3 공식        '
    console.log(`${label}| ${a.toFixed(3).padStart(13)}  | ${pc.toFixed(3).padStart(21)} | ${sp.toFixed(3).padStart(10)}`)
  }

  // 도달 챕터별 평균 표시값 (각 공식)
  console.log(`\n## 도달 챕터별 평균 표시값 (score = atk + def)`)
  console.log(`도달ch | n      | 기존공식 | 신규공식 | v3 공식`)
  console.log('-------+--------+----------+----------+--------')
  for (let ch = 1; ch <= 10; ch++) {
    const recs = samples.filter((s) => s.reachedChapter === ch)
    if (recs.length === 0) continue
    const me = meanScore(recs, 'exist')
    const mn = meanScore(recs, 'new')
    const mv = meanScore(recs, 'v3')
    console.log(`  ${ch.toString().padStart(2)}  | ${recs.length.toString().padStart(6)} | ${me.toFixed(2).padStart(8)} | ${mn.toFixed(2).padStart(8)} | ${mv.toFixed(2).padStart(7)}`)
  }

  // atk only / def only AUC
  console.log(`\n## atk 만 / def 만 AUC`)
  for (const part of ['atk', 'def'] as const) {
    console.log(`\n  [${part} only]`)
    for (const fkey of ['exist', 'new', 'v3'] as const) {
      const scores = samples.map((s) => {
        const key = `${fkey}_${part}` as keyof Sample
        return s[key] as number
      })
      const labels = samples.map((s) => s.cleared)
      const a = auc(scores, labels)
      const label = fkey === 'exist' ? '기존공식' : fkey === 'new' ? '신규공식' : 'v3 공식 '
      console.log(`    ${label} | AUC ${a.toFixed(3)}`)
    }
  }

  // ── def 스케일 보정 + 비선형 조합 — 최적 공식 탐색 ──
  console.log(`\n## def 스케일 보정 — atk + def × K 미세 탐색`)
  const labels = samples.map((s) => s.cleared)
  const chaptersArr = samples.map((s) => s.reachedChapter)
  function searchK(fkey: 'new' | 'v3'): { k: number; auc: number; pearson: number } {
    let best = { k: 1, auc: 0, pearson: 0 }
    for (let k = 5; k <= 200; k += 5) {
      const scores = samples.map((s) => {
        if (fkey === 'new') return s.new_atk + s.new_def * k
        return s.v3_atk + s.v3_def * k
      })
      const a = auc(scores, labels)
      if (a > best.auc) best = { k, auc: a, pearson: pearson(scores, chaptersArr) }
    }
    return best
  }
  const bN = searchK('new')
  const bV = searchK('v3')
  console.log(`  신규공식 v4 = atk + def × ${bN.k}   → AUC ${bN.auc.toFixed(3)} | Pearson ${bN.pearson.toFixed(3)}`)
  console.log(`  v3 공식 v4  = atk + def × ${bV.k}   → AUC ${bV.auc.toFixed(3)} | Pearson ${bV.pearson.toFixed(3)}`)

  // 비선형 조합 — sqrt, multiplicative, geometric mean
  console.log(`\n## 비선형 조합 (신규공식 기반)`)
  const variants: { name: string; score: (s: Sample) => number }[] = [
    { name: 'atk × def (곱)               ', score: (s) => s.new_atk * s.new_def },
    { name: '√(atk × def) (기하평균)       ', score: (s) => Math.sqrt(s.new_atk * s.new_def) },
    { name: '√atk + √(def × 50)           ', score: (s) => Math.sqrt(s.new_atk) + Math.sqrt(s.new_def * 50) },
    { name: 'atk + def × 50 (베이스)       ', score: (s) => s.new_atk + s.new_def * 50 },
    { name: 'atk × (1 + def × 30)         ', score: (s) => s.new_atk * (1 + s.new_def * 30) },
    { name: 'atk^0.7 × def^0.3 × 100      ', score: (s) => Math.pow(s.new_atk, 0.7) * Math.pow(Math.max(0.001, s.new_def * 30), 0.3) * 100 },
    { name: 'atk × def_norm (def/atk_avg) ', score: (s) => s.new_atk * (1 + s.new_def / 0.5) },
  ]
  for (const v of variants) {
    const scores = samples.map(v.score)
    const a = auc(scores, labels)
    const pc = pearson(scores, chaptersArr)
    console.log(`  ${v.name}  AUC ${a.toFixed(3)} | Pearson ${pc.toFixed(3)}`)
  }

  // 평균 비율 기반 자동 보정 (atk_mean / def_mean)
  function avgScale(fkey: 'new' | 'v3'): number {
    const aSum = samples.reduce((s, x) => s + (fkey === 'new' ? x.new_atk : x.v3_atk), 0)
    const dSum = samples.reduce((s, x) => s + (fkey === 'new' ? x.new_def : x.v3_def), 0)
    return aSum / Math.max(0.0001, dSum)
  }
  for (const fkey of ['new', 'v3'] as const) {
    const auto = avgScale(fkey)
    const scores = samples.map((s) => {
      const ak = fkey === 'new' ? s.new_atk : s.v3_atk
      const df = fkey === 'new' ? s.new_def : s.v3_def
      return ak + df * auto
    })
    const a = auc(scores, labels)
    const pc = pearson(scores, samples.map((s) => s.reachedChapter))
    const label = fkey === 'new' ? '신규공식' : 'v3 공식 '
    console.log(`  [auto K = atk_avg/def_avg = ${auto.toFixed(1)}] ${label} → AUC ${a.toFixed(3)} | Pearson ${pc.toFixed(3)}`)
  }

  // ── v5: maxHp 추가 + 3변수 grid search ──
  console.log(`\n## v5 공식 — atk + def×K + maxHp×M (3변수 grid search)`)
  function search3D(fkey: 'new' | 'v3'): { K: number; M: number; auc: number; pearson: number } {
    let best = { K: 0, M: 0, auc: 0, pearson: 0 }
    const KS = [10, 25, 50, 75, 100, 150]
    const MS = [0, 0.005, 0.01, 0.02, 0.04, 0.08, 0.15, 0.3, 0.5]
    for (const K of KS) {
      for (const M of MS) {
        const scores = samples.map((s) => {
          const a = fkey === 'new' ? s.new_atk : s.v3_atk
          const d = fkey === 'new' ? s.new_def : s.v3_def
          return a + d * K + s.maxHp * M
        })
        const au = auc(scores, labels)
        if (au > best.auc) {
          best = { K, M, auc: au, pearson: pearson(scores, chaptersArr) }
        }
      }
    }
    return best
  }
  const v5N = search3D('new')
  const v5V = search3D('v3')
  console.log(`  v5 신규 = atk + def×${v5N.K} + maxHp×${v5N.M.toFixed(3)} → AUC ${v5N.auc.toFixed(3)} | Pearson ${v5N.pearson.toFixed(3)}`)
  console.log(`  v5 v3   = atk + def×${v5V.K} + maxHp×${v5V.M.toFixed(3)} → AUC ${v5V.auc.toFixed(3)} | Pearson ${v5V.pearson.toFixed(3)}`)

  // 곱셈 + maxHp 조합
  console.log(`\n## 비선형 + maxHp 조합 (신규공식 기반)`)
  const v5variants: { name: string; score: (s: Sample) => number }[] = [
    { name: 'atk × maxHp                  ', score: (s) => s.new_atk * s.maxHp },
    { name: '(atk + def×50) × maxHp / 100 ', score: (s) => (s.new_atk + s.new_def * 50) * s.maxHp / 100 },
    { name: 'atk × maxHp × (1 + def × 30) ', score: (s) => s.new_atk * s.maxHp * (1 + s.new_def * 30) },
    { name: '√(atk × maxHp)               ', score: (s) => Math.sqrt(s.new_atk * s.maxHp) },
    { name: '√atk + √(def×50) + √maxHp×3  ', score: (s) => Math.sqrt(s.new_atk) + Math.sqrt(s.new_def * 50) + Math.sqrt(s.maxHp) * 3 },
    // 클리어 임계 모델: atk × HP > Boss_HP × Boss_atk / (1-def)  → 단순화
    { name: 'atk × HP × (1 + def × 30)    ', score: (s) => s.new_atk * s.maxHp * (1 + s.new_def * 30) },
  ]
  for (const v of v5variants) {
    const scores = samples.map(v.score)
    const a = auc(scores, labels)
    const pc = pearson(scores, chaptersArr)
    console.log(`  ${v.name}  AUC ${a.toFixed(3)} | Pearson ${pc.toFixed(3)}`)
  }

  // 비교 최종 — 모든 공식 AUC 한 줄
  console.log(`\n## 최종 비교 (AUC vs cleared)`)
  console.log(`  기존공식 (현재 UI)             : AUC 0.978`)
  console.log(`  신규공식 (raw atk+def)         : AUC 0.930`)
  console.log(`  v3공식  (raw atk+def)          : AUC 0.917`)
  console.log(`  신규공식 v4 (atk + def×${bN.k})  : AUC ${bN.auc.toFixed(3)} ${bN.auc >= 0.978 ? '✅ 1등' : ''}`)
  console.log(`  v3공식  v4 (atk + def×${bV.k})   : AUC ${bV.auc.toFixed(3)} ${bV.auc >= 0.978 ? '✅ 1등' : ''}`)
  console.log(`  v5 신규 +HP                    : AUC ${v5N.auc.toFixed(3)} ${v5N.auc >= 0.978 ? '✅ 1등' : ''}`)
  console.log(`  v5 v3   +HP                    : AUC ${v5V.auc.toFixed(3)} ${v5V.auc >= 0.978 ? '✅ 1등' : ''}`)
}

if (typeof process !== 'undefined' && process.argv?.[1]?.includes('formulaAccuracyByRun')) {
  run()
}
