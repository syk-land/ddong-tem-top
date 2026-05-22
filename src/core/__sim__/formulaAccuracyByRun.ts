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
import { withSeededRng } from './_seededRng'
import {
  pearson, spearman, auc,
  bootstrapCI, pairedBootstrapDiff,
  pearsonStat, spearmanStat, aucStat,
  fmtCI,
  percentiles, logisticFit, logisticThreshold,
} from './_stats'
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

// ── 빌드 락인 — dice 60pt 기준, 마력 우선 > 민첩 > 그 외 ──
type BuildType = 'magic' | 'ranged' | 'melee' | 'any'

function determineBuild(stats: Stats, lock: boolean): BuildType {
  if (!lock) return 'any'
  const max = Math.max(stats.힘, stats.민첩, stats.체력, stats.마력, stats.행운)
  if (stats.마력 === max) return 'magic'
  if (stats.민첩 === max) return 'ranged'
  return 'melee'
}

function weaponMatchesBuild(baseKey: string, build: BuildType): boolean {
  if (build === 'any') return true
  const w = WEAPONS[baseKey]
  if (!w) return false
  if (build === 'magic') return !!w.isMagic
  if (build === 'ranged') return w.category === 'ranged' && !w.isMagic
  return !w.isMagic && w.category !== 'ranged' // melee
}

const ALL_WEAPON_KEYS = Object.keys(WEAPONS)
function pickWeaponForBuild(build: BuildType): string {
  const pool = ALL_WEAPON_KEYS.filter((k) => weaponMatchesBuild(k, build))
  return pool[Math.floor(Math.random() * pool.length)]
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

function createChar(stats: Stats, bonus: Partial<Stats> | undefined, build: BuildType): Character {
  const final: Stats = { ...stats }
  if (bonus) for (const k of Object.keys(bonus) as StatKey[]) final[k] = (final[k] ?? 0) + (bonus[k] ?? 0)
  const forceBaseKey = build === 'any' ? undefined : pickWeaponForBuild(build)
  return {
    stats: final,
    hp: computeMaxHp(final.체력), maxHp: computeMaxHp(final.체력),
    mp: computeMaxMp(final.마력), maxMp: computeMaxMp(final.마력),
    weapon: rollItem({ kind: 'weapon', forceBaseKey, forceTraitTier: '하급', forceGrade: '노말' }),
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
function takeTreasure(c: Character, chapter: number, build: BuildType) {
  const k = Math.random() < 0.5 ? 'weapon' : 'armor'
  const it = rollItem({ kind: k, chapter, source: 'treasure' })
  if (k === 'weapon') {
    if (!weaponMatchesBuild(it.baseKey, build)) return // 빌드 안 맞는 무기는 버림
    if (!c.weapon || it.tier > c.weapon.tier) c.weapon = it
  }
  else if (shouldEquipArmor(c, it)) c.armor = it
}
function autoShop(c: Character, chapter: number, build: BuildType) {
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
    if (it.kind === 'weapon') {
      if (!weaponMatchesBuild(it.baseKey, build)) continue // 빌드 안 맞으면 패스
      if (!c.weapon || it.tier > c.weapon.tier) { c.gold -= it.buyPrice; c.weapon = it }
    }
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
  maxHp: number
  maxMp: number
  isRanged: number         // 0 or 1
  isMagic: number          // 0 or 1
  defPct: number           // 0~0.99 actual def percentage
}

function autoplayAndEval(buildLock: boolean): Sample | null {
  const dice = generateDice()
  const build = determineBuild(dice, buildLock)
  const challenge = pickChallenge(dice)
  const c = createChar(dice, challenge?.instantBonus, build)
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
      else if (ft === 'shop') autoShop(c, ch, build)
      else if (ft === 'treasure') takeTreasure(c, ch, build)
      else if (ft === 'healing') doHealingSpring(c)
      else if (ft === 'special') doSpecialEvent(c, ch)
      c.hp = Math.min(c.maxHp, c.hp + Math.round(c.maxHp * 0.1))
      c.mp = Math.min(c.maxMp, c.mp + Math.round(c.maxMp * 0.1))
    }
    if (!died && !simBoss(c, theme, ch)) died = true
    if (!died) { c.hp = c.maxHp; c.mp = c.maxMp; c.statuses = []; c.actionGauge = 0 }
  }
  if (!c.weapon || !c.armor) return null
  const wbase = WEAPONS[c.weapon.baseKey]
  const abase = ARMORS[c.armor.baseKey as keyof typeof ARMORS]
  const aTrait = ARMOR_TRAITS[c.armor.trait]
  // 표시값 계산 — 종료 시점 장비 + 캐릭터 스탯, 챕터는 도달 챕터 기준
  const chForCalc = reachedChapter
  const wExist = computeItemValue(c.weapon, c, { chapter: chForCalc })
  const aExist = computeItemValue(c.armor, c, { chapter: chForCalc })
  const fNew = formulaNew(c, chForCalc)
  const fV3 = formulaV3(c, chForCalc)
  // defPct 계산 (formula 외부에서도 직접 사용 가능하도록)
  let defPct = 0
  if (abase && aTrait) {
    const defPctTrait = (aTrait.effects.방어력_pct ?? 0) + (aTrait.effects.전스탯_pct ?? 0)
    const armorDef = abase.baseDef * c.armor.coef * (1 + defPctTrait)
    const hpDef = c.stats.체력 * 0.3 * c.armor.coef
    defPct = clampN(armorDef + hpDef, 0, 99) / 100
  }
  return {
    reachedChapter,
    cleared: died ? 0 : 1,
    exist_atk: wExist.atkValue + aExist.atkValue,
    exist_def: wExist.defValue + aExist.defValue,
    new_atk: fNew.atk, new_def: fNew.def,
    v3_atk: fV3.atk, v3_def: fV3.def,
    maxHp: c.maxHp,
    maxMp: c.maxMp,
    isRanged: wbase?.category === 'ranged' ? 1 : 0,
    isMagic: wbase?.isMagic ? 1 : 0,
    defPct,
  }
}

// 통계 — pearson/spearman/auc 는 _stats.ts 사용 (O(n log n) AUC)

function run() {
  const RUNS = parseInt(process.env.RUNS || '30000')
  const BOOTS = parseInt(process.env.BOOTS || '1000')
  const CRN = process.env.CRN !== '0' // 기본 ON. CRN=0 으로 비활성화
  const BUILD_LOCK = process.env.BUILD_LOCK !== '0' // 기본 ON. 마력→마법/민첩→원거리/그외→근접 락
  const SEED_BASE = parseInt(process.env.SEED || '1')
  console.log(`\n=== 표시값 정확도 검증 — 자동플레이 ${RUNS} 런, 클리어/실패 분리 ===`)
  console.log(`    CRN=${CRN ? 'ON' : 'OFF'} (seed base ${SEED_BASE}), BUILD_LOCK=${BUILD_LOCK ? 'ON' : 'OFF'}, Bootstrap=${BOOTS}\n`)
  const t0 = Date.now()
  const samples: Sample[] = []
  for (let i = 0; i < RUNS; i++) {
    const s = CRN
      ? withSeededRng(SEED_BASE + i, () => autoplayAndEval(BUILD_LOCK))
      : autoplayAndEval(BUILD_LOCK)
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

  // AUC, Pearson with reachedChapter — Bootstrap 95% CI
  console.log(`\n## 분류 정확도 — score = atk + def  (95% CI, ${BOOTS} bootstrap)`)
  console.log(`공식         | AUC (cleared)             | Pearson r (vs 도달챕터)   | Spearman ρ`)
  console.log('-------------+---------------------------+---------------------------+---------------------------')
  function scoreOf(s: Sample, k: 'exist' | 'new' | 'v3'): number {
    if (k === 'exist') return s.exist_atk + s.exist_def
    if (k === 'new')   return s.new_atk + s.new_def
    return s.v3_atk + s.v3_def
  }
  const cleared01 = samples.map((s) => s.cleared)
  const chaptersArrAll = samples.map((s) => s.reachedChapter)
  const scoreByFormula: Record<'exist' | 'new' | 'v3', number[]> = {
    exist: samples.map((s) => scoreOf(s, 'exist')),
    new:   samples.map((s) => scoreOf(s, 'new')),
    v3:    samples.map((s) => scoreOf(s, 'v3')),
  }
  for (const fkey of ['exist', 'new', 'v3'] as const) {
    const scores = scoreByFormula[fkey]
    const aCI = bootstrapCI(samples.length, aucStat(scores, cleared01), { nBoot: BOOTS, seed: 1 })
    const pCI = bootstrapCI(samples.length, pearsonStat(scores, chaptersArrAll), { nBoot: BOOTS, seed: 2 })
    const sCI = bootstrapCI(samples.length, spearmanStat(scores, chaptersArrAll), { nBoot: BOOTS, seed: 3 })
    const label = fkey === 'exist' ? '기존공식       ' : fkey === 'new' ? '신규공식       ' : 'v3 공식        '
    console.log(`${label}| ${fmtCI(aCI).padStart(25)} | ${fmtCI(pCI).padStart(25)} | ${fmtCI(sCI).padStart(25)}`)
  }

  // Paired diff — 같은 캐릭터(샘플)에 대한 공식 차이의 CI
  // CRN ON 이면 paired sampling 의 효과가 극대화됨 (variance 상쇄).
  console.log(`\n## 공식 간 차이 — paired bootstrap (CI 가 0 미포함 = 유의한 차이)`)
  console.log(`비교             | ΔAUC                        | ΔPearson (도달챕터)`)
  console.log('-----------------+-----------------------------+-----------------------------')
  const pairs: { name: string; a: 'exist' | 'new' | 'v3'; b: 'exist' | 'new' | 'v3' }[] = [
    { name: 'v3 − 기존공식    ', a: 'v3', b: 'exist' },
    { name: 'v3 − 신규공식    ', a: 'v3', b: 'new'   },
    { name: '신규공식 − 기존  ', a: 'new', b: 'exist' },
  ]
  for (const p of pairs) {
    const sA = scoreByFormula[p.a]
    const sB = scoreByFormula[p.b]
    const dAuc = pairedBootstrapDiff(
      samples.length,
      aucStat(sA, cleared01),
      aucStat(sB, cleared01),
      { nBoot: BOOTS, seed: 11 },
    )
    const dPea = pairedBootstrapDiff(
      samples.length,
      pearsonStat(sA, chaptersArrAll),
      pearsonStat(sB, chaptersArrAll),
      { nBoot: BOOTS, seed: 12 },
    )
    console.log(`${p.name}| ${fmtCI(dAuc).padStart(27)} | ${fmtCI(dPea).padStart(27)}`)
  }

  // ===== 클리어 임계값 분석 =====
  //   (1) 클리어한 캐릭터의 score 분포 percentile
  //   (2) 로지스틱 회귀로 P(clear) = 0.5/0.9/0.99 인 score 라인
  //   (3) 챕터 N 이상 도달한 캐릭터의 score 분포 percentile
  //   (4) atk-only / def-only 도 동일 분석
  const PCT = [0, 0.05, 0.25, 0.50, 0.75, 0.95, 1.0]
  const PCT_LABEL = ['min', '5%', '25%', '50%', '75%', '95%', 'max']

  function reportPercentile(label: string, arr: number[]) {
    if (arr.length === 0) {
      console.log(`  ${label.padEnd(22)} | n=0`)
      return
    }
    const ps = percentiles(arr, PCT)
    const cells = ps.map((v) => v.toFixed(1).padStart(7)).join(' | ')
    console.log(`  ${label.padEnd(22)} | n=${arr.length.toString().padStart(5)} | ${cells}`)
  }

  function logisticReport(label: string, scores: number[], labels: number[]) {
    const fit = logisticFit(scores, labels)
    const p50 = logisticThreshold(fit, 0.5)
    const p90 = logisticThreshold(fit, 0.9)
    const p99 = logisticThreshold(fit, 0.99)
    const note = fit.converged ? '수렴' : `미수렴(${fit.iter}회)`
    console.log(
      `  ${label.padEnd(20)} | β₀=${fit.b0.toFixed(3).padStart(8)}  β₁=${fit.b1.toFixed(4).padStart(8)}` +
      ` | P=0.5 → ${p50.toFixed(2).padStart(7)} | P=0.9 → ${p90.toFixed(2).padStart(7)}` +
      ` | P=0.99 → ${p99.toFixed(2).padStart(7)} (${note})`
    )
  }

  console.log(`\n## 클리어 임계값 — 클리어한 캐릭터의 score 분포 percentile`)
  console.log(`  공식 (score = atk + def)  | n     |  ${PCT_LABEL.map((l) => l.padStart(7)).join(' | ')}`)
  console.log('  -----------------------+-------+' + '---------+'.repeat(PCT.length))
  for (const fkey of ['exist', 'new', 'v3'] as const) {
    const label = fkey === 'exist' ? '기존공식' : fkey === 'new' ? '신규공식' : 'v3 공식'
    const clearedScores = samples.filter((s) => s.cleared > 0.5).map((s) => scoreOf(s, fkey))
    reportPercentile(label, clearedScores)
  }

  console.log(`\n## 로지스틱 회귀 임계 — P(clear) = 0.5 / 0.9 / 0.99 인 score`)
  console.log(`  ※ "이 score 면 절반/대부분/거의 확실히 클리어" 라는 임계`)
  for (const fkey of ['exist', 'new', 'v3'] as const) {
    const label = fkey === 'exist' ? '기존공식 (atk+def)' : fkey === 'new' ? '신규공식 (atk+def)' : 'v3 공식 (atk+def)'
    const scores = scoreByFormula[fkey]
    logisticReport(label, scores, cleared01)
  }

  console.log(`\n## 챕터별 도달 임계 — 챕터 ≥ N 도달한 캐릭터의 score 분포 (기존공식)`)
  console.log(`  도달챕터 ≥  | n     | ${PCT_LABEL.map((l) => l.padStart(7)).join(' | ')}`)
  console.log('  ----------+-------+' + '---------+'.repeat(PCT.length))
  for (let chMin = 1; chMin <= 10; chMin++) {
    const sub = samples.filter((s) => s.reachedChapter >= chMin)
    reportPercentile(`챕터 ≥ ${chMin}`, sub.map((s) => s.exist_atk + s.exist_def))
  }

  console.log(`\n## 챕터별 도달 임계 — v3 공식`)
  console.log(`  도달챕터 ≥  | n     | ${PCT_LABEL.map((l) => l.padStart(7)).join(' | ')}`)
  console.log('  ----------+-------+' + '---------+'.repeat(PCT.length))
  for (let chMin = 1; chMin <= 10; chMin++) {
    const sub = samples.filter((s) => s.reachedChapter >= chMin)
    reportPercentile(`챕터 ≥ ${chMin}`, sub.map((s) => s.v3_atk + s.v3_def))
  }

  // atk only / def only — 공격력만, 방어력만 임계
  console.log(`\n## atk-only 임계 (클리어한 캐릭터의 atk 분포)`)
  console.log(`  공식                  | n     | ${PCT_LABEL.map((l) => l.padStart(7)).join(' | ')}`)
  console.log('  ----------------------+-------+' + '---------+'.repeat(PCT.length))
  for (const fkey of ['exist', 'new', 'v3'] as const) {
    const label = fkey === 'exist' ? '기존공식 atk' : fkey === 'new' ? '신규공식 atk' : 'v3 공식 atk'
    const cleared = samples.filter((s) => s.cleared > 0.5)
    const arr = cleared.map((s) => fkey === 'exist' ? s.exist_atk : fkey === 'new' ? s.new_atk : s.v3_atk)
    reportPercentile(label, arr)
  }

  console.log(`\n## def-only 임계 (클리어한 캐릭터의 def 분포)`)
  console.log(`  공식                  | n     | ${PCT_LABEL.map((l) => l.padStart(7)).join(' | ')}`)
  console.log('  ----------------------+-------+' + '---------+'.repeat(PCT.length))
  for (const fkey of ['exist', 'new', 'v3'] as const) {
    const label = fkey === 'exist' ? '기존공식 def' : fkey === 'new' ? '신규공식 def' : 'v3 공식 def'
    const cleared = samples.filter((s) => s.cleared > 0.5)
    const arr = cleared.map((s) => fkey === 'exist' ? s.exist_def : fkey === 'new' ? s.new_def : s.v3_def)
    reportPercentile(label, arr)
  }

  console.log(`\n## 로지스틱 임계 — atk-only / def-only`)
  for (const fkey of ['exist', 'new', 'v3'] as const) {
    const lbl = fkey === 'exist' ? '기존' : fkey === 'new' ? '신규' : 'v3 '
    const atkScores = samples.map((s) => fkey === 'exist' ? s.exist_atk : fkey === 'new' ? s.new_atk : s.v3_atk)
    const defScores = samples.map((s) => fkey === 'exist' ? s.exist_def : fkey === 'new' ? s.new_def : s.v3_def)
    logisticReport(`${lbl} atk-only`, atkScores, cleared01)
    logisticReport(`${lbl} def-only`, defScores, cleared01)
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

  // ── v6: 4 변수 (atk + def + maxHp + maxMp) + 카테고리 보너스 ──
  console.log(`\n## v6 공식 — atk × (1+ranged_bonus) + def×K + maxHp×M + maxMp×P`)
  function search4D(): { K: number; M: number; P: number; R: number; auc: number; pearson: number } {
    let best = { K: 0, M: 0, P: 0, R: 0, auc: 0, pearson: 0 }
    const KS = [30, 50, 70, 100]
    const MS = [0.02, 0.04, 0.06, 0.10]
    const PS = [0, 0.005, 0.01, 0.02, 0.05]
    const RS = [0, 0.10, 0.20, 0.30]  // ranged bonus
    for (const K of KS) for (const M of MS) for (const P of PS) for (const R of RS) {
      const scores = samples.map((s) => {
        const cat = 1 + R * s.isRanged
        return s.new_atk * cat + s.new_def * K + s.maxHp * M + s.maxMp * P
      })
      const au = auc(scores, labels)
      if (au > best.auc) best = { K, M, P, R, auc: au, pearson: pearson(scores, chaptersArr) }
    }
    return best
  }
  const v6 = search4D()
  console.log(`  v6 = atk × (1+${v6.R}×ranged) + def×${v6.K} + maxHp×${v6.M.toFixed(3)} + maxMp×${v6.P.toFixed(3)}`)
  console.log(`     → AUC ${v6.auc.toFixed(3)} | Pearson ${v6.pearson.toFixed(3)}`)

  // ── v7: 곱셈형 (effective HP) 시너지 ──
  console.log(`\n## v7 — 곱셈형 / Effective HP / 비선형`)
  const v7variants: { name: string; score: (s: Sample) => number }[] = [
    { name: 'atk + maxHp / (1 - defPct)        ', score: (s) => s.new_atk + s.maxHp / Math.max(0.01, 1 - s.defPct) * 0.04 },
    { name: 'atk × (maxHp × (1 + def×30)) / 100', score: (s) => s.new_atk * s.maxHp * (1 + s.new_def * 30) / 100 },
    { name: '(atk + def×50) + EHP×0.04          ', score: (s) => (s.new_atk + s.new_def * 50) + (s.maxHp / Math.max(0.01, 1 - s.defPct)) * 0.04 },
    { name: 'log(atk × EHP)                     ', score: (s) => Math.log(Math.max(0.01, s.new_atk * s.maxHp / Math.max(0.01, 1 - s.defPct))) },
    { name: 'atk + def×50 + HP×0.04 + ranged×3 ', score: (s) => s.new_atk + s.new_def * 50 + s.maxHp * 0.04 + s.isRanged * 3 },
    { name: 'v5 + 마법 부족 페널티               ', score: (s) => {
      const base = s.new_atk + s.new_def * 50 + s.maxHp * 0.04
      const magicPenalty = s.isMagic && s.maxMp < 200 ? 0.85 : 1.0
      return base * magicPenalty
    } },
  ]
  for (const v of v7variants) {
    const scores = samples.map(v.score)
    const a = auc(scores, labels)
    const pc = pearson(scores, chaptersArr)
    console.log(`  ${v.name}  AUC ${a.toFixed(3)} | Pearson ${pc.toFixed(3)}`)
  }

  // ── v8: EHP (Effective HP) 정제 — atk × HP × def_mult 변형들 ──
  console.log(`\n## v8 — Effective HP 변형 (EHP = maxHp / (1 - defPct))`)
  function ehp(s: Sample): number {
    return s.maxHp / Math.max(0.01, 1 - s.defPct)
  }
  // 1) 가중 거듭제곱 grid search — atk^α × ehp^β
  console.log(`  거듭제곱 grid: atk^α × EHP^β`)
  let bestPow = { a: 0, b: 0, auc: 0, pearson: 0 }
  for (let a = 0.3; a <= 1.6; a += 0.1) {
    for (let b = 0.3; b <= 1.6; b += 0.1) {
      const scores = samples.map((s) => Math.pow(Math.max(0.01, s.new_atk), a) * Math.pow(Math.max(0.01, ehp(s)), b))
      const au = auc(scores, labels)
      if (au > bestPow.auc) bestPow = { a, b, auc: au, pearson: pearson(scores, chaptersArr) }
    }
  }
  console.log(`    best: atk^${bestPow.a.toFixed(1)} × EHP^${bestPow.b.toFixed(1)} → AUC ${bestPow.auc.toFixed(3)} | Pearson ${bestPow.pearson.toFixed(3)}`)

  // 2) atk × (maxHp + K × def 기여) — 선형 EHP 근사
  console.log(`  선형 EHP 근사 — atk × (maxHp + K × maxHp × defPct)`)
  let bestLin = { K: 0, auc: 0, pearson: 0 }
  for (const K of [0, 0.5, 1, 1.5, 2, 3, 5, 8, 12, 20]) {
    const scores = samples.map((s) => s.new_atk * (s.maxHp + K * s.maxHp * s.defPct))
    const au = auc(scores, labels)
    if (au > bestLin.auc) bestLin = { K, auc: au, pearson: pearson(scores, chaptersArr) }
  }
  console.log(`    best: atk × maxHp × (1 + ${bestLin.K} × defPct) → AUC ${bestLin.auc.toFixed(3)} | Pearson ${bestLin.pearson.toFixed(3)}`)

  // 3) log 분해: α log(atk) + β log(maxHp) + γ log(EHP/maxHp)
  console.log(`  log 분해 — α·log(atk) + β·log(maxHp) + γ·log(1/(1-def))`)
  let bestLog = { a: 0, b: 0, g: 0, auc: 0, pearson: 0 }
  for (let a = 0.5; a <= 2.0; a += 0.25) {
    for (let b = 0.5; b <= 2.0; b += 0.25) {
      for (let g = 0; g <= 2.0; g += 0.25) {
        const scores = samples.map((s) => {
          return a * Math.log(Math.max(0.01, s.new_atk))
               + b * Math.log(Math.max(0.01, s.maxHp))
               + g * Math.log(Math.max(1.01, 1 / Math.max(0.01, 1 - s.defPct)))
        })
        const au = auc(scores, labels)
        if (au > bestLog.auc) bestLog = { a, b, g, auc: au, pearson: pearson(scores, chaptersArr) }
      }
    }
  }
  console.log(`    best: ${bestLog.a}·log(atk) + ${bestLog.b}·log(HP) + ${bestLog.g}·log(1/(1-def)) → AUC ${bestLog.auc.toFixed(3)} | Pearson ${bestLog.pearson.toFixed(3)}`)

  // 4) v9 — Pearson 도 같이 최적화 (AUC × 0.5 + Pearson × 0.5)
  console.log(`  v9 — atk × HP^α × (1+def×K)^γ 종합 최적화`)
  let bestV9 = { a: 0, K: 0, g: 0, auc: 0, pearson: 0, combined: 0 }
  for (let a = 0.6; a <= 1.4; a += 0.1) {
    for (const K of [10, 20, 30, 50, 80]) {
      for (let g = 0.3; g <= 1.5; g += 0.2) {
        const scores = samples.map((s) => s.new_atk * Math.pow(s.maxHp, a) * Math.pow(1 + s.new_def * K, g))
        const au = auc(scores, labels)
        const pc = pearson(scores, chaptersArr)
        const comb = au * 0.5 + Math.abs(pc) * 0.5
        if (comb > bestV9.combined) bestV9 = { a, K, g, auc: au, pearson: pc, combined: comb }
      }
    }
  }
  console.log(`    best: atk × HP^${bestV9.a.toFixed(1)} × (1+def×${bestV9.K})^${bestV9.g.toFixed(1)} → AUC ${bestV9.auc.toFixed(3)} | Pearson ${bestV9.pearson.toFixed(3)}`)

  // 비교 최종
  console.log(`\n## 최종 비교 (AUC | Pearson)`)
  console.log(`  기존공식 (현재 UI)              : 0.978 | 0.682`)
  console.log(`  v5 (atk + def×50 + HP×0.04)    : ${v5N.auc.toFixed(3)} | ${v5N.pearson.toFixed(3)}`)
  console.log(`  v6 (+ MP, ranged)              : ${v6.auc.toFixed(3)} | ${v6.pearson.toFixed(3)}`)
  console.log(`  v8 거듭제곱 (atk^${bestPow.a.toFixed(1)}×EHP^${bestPow.b.toFixed(1)}) : ${bestPow.auc.toFixed(3)} | ${bestPow.pearson.toFixed(3)}`)
  console.log(`  v8 선형 EHP 근사 K=${bestLin.K}        : ${bestLin.auc.toFixed(3)} | ${bestLin.pearson.toFixed(3)}`)
  console.log(`  v8 log 분해                     : ${bestLog.auc.toFixed(3)} | ${bestLog.pearson.toFixed(3)}`)
  console.log(`  v9 종합 최적화                  : ${bestV9.auc.toFixed(3)} | ${bestV9.pearson.toFixed(3)}`)
}

if (typeof process !== 'undefined' && process.argv?.[1]?.includes('formulaAccuracyByRun')) {
  run()
}
