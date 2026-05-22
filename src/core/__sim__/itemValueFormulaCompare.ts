// ============================================================
// 6 공식 vs 실제 챕터 클리어율 — 어느 공식이 가장 정확한가?
//
// 비교 후보 (캐릭터 + 장비 한 세트에 대해 score 산출):
//   1) 기존공식        : itemValue.ts 의 atkValue + defValue (calibrated)
//   2) 신규공식        : predict100Tick (chapter-relative closed-form) / 100
//   3) 100틱/100        : 100틱 실측 / 100
//   4) 1000틱/1000      : 1000틱 실측 / 1000
//   5) 10000틱/10000    : 10000틱 실측 / 10000
//   6) 100000틱/100000  : 100000틱 실측 / 100000
//
// 정확도 측정:
//   각 캐릭터: 5번 보스전 → 승률 (ground truth, 0.0~1.0)
//   각 공식: score = (atk + def) per-tick
//   Pearson r, Spearman ρ (score vs 승률) — 높을수록 좋은 공식
//   AUC: score 가 클리어/패배 이진 분류를 얼마나 잘하는지
//
// 조건:
//   - 스탯 60~200pt 무작위, 등급/장비 무작위
//   - MP 무한 / 마법무기 → 로브 or 빛나는 강제 (이전 사용자 요청)
//   - 챕터 = 등급별 적정 (노말 ch3, 레어 ch6, 스페셜 ch9, 레전드 ch10)
//
// 사용: npx tsx src/core/__sim__/itemValueFormulaCompare.ts
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
} from './_stats'
import { computeEffectiveStats } from '../stats'
import { useSkill, pickAutoAction } from '../skills'
import { rollItem } from '../items'
import { computeItemValue } from '../itemValue'
import { computeMaxHp, computeMaxMp } from '../character'
import { CHAPTER_THEMES, getNormalMonsterBaseline } from '@/data/chapters'
import { WEAPON_KEYS, WEAPONS } from '@/data/weapons'
import { ARMOR_KEYS, ARMORS } from '@/data/armor'
import { WEAPON_TRAITS, ARMOR_TRAITS } from '@/data/traits'
import { computeWeaponSkillProc } from '../buildBalance'
import type { Character, Stats, Grade, ChapterTheme, ItemInstance, TraitTier } from '@/types'

const THEMES: ChapterTheme[] = [
  '고블린', '골렘', '언데드', '환영', '흡혈귀',
  '심해', '기계', '용암', '암흑', '천공', '맹독',
]
const GRADES: Grade[] = ['노말', '레어', '스페셜', '레전드']
const GRADE_CHAPTER: Record<Grade, number> = { '노말': 3, '레어': 6, '스페셜': 9, '레전드': 10 }
const CHECKPOINTS = [100, 1000, 10000, 100000]
const MAX_TICKS = 100000

function clampN(v: number, lo: number, hi: number): number { return Math.max(lo, Math.min(hi, v)) }
function randomStats(): Stats {
  const total = 60 + Math.floor(Math.random() * 141)
  const s: Stats = { 힘: 0, 민첩: 0, 체력: 0, 마력: 0, 행운: 0 }
  const keys: (keyof Stats)[] = ['힘', '민첩', '체력', '마력', '행운']
  for (const k of keys) s[k] = 1
  let rem = total - 5
  while (rem > 0) {
    s[keys[Math.floor(Math.random() * keys.length)]] += 1
    rem -= 1
  }
  return s
}
function rollTraitTier(grade: Grade): TraitTier {
  const r = Math.random()
  if (grade === '노말')   return r < 0.7 ? '하급' : '보통'
  if (grade === '레어')   return r < 0.4 ? '하급' : r < 0.85 ? '보통' : '희귀'
  if (grade === '스페셜') return r < 0.2 ? '보통' : r < 0.7 ? '희귀' : '특별'
  return r < 0.5 ? '희귀' : '특별'
}
function makeChar(stats: Stats, w: ItemInstance, a: ItemInstance): Character {
  return {
    stats: { ...stats },
    hp: computeMaxHp(stats.체력), maxHp: computeMaxHp(stats.체력),
    mp: 1e9, maxMp: 1e9,
    weapon: w, armor: a, gold: 100, statuses: [], actionGauge: 0,
  }
}
function rollArmorForMagic(grade: Grade): ItemInstance {
  if (Math.random() < 0.5) {
    return rollItem({ kind: 'armor', forceBaseKey: '로브', forceGrade: grade, forceTraitTier: rollTraitTier(grade) })
  } else {
    const aKey = ARMOR_KEYS[Math.floor(Math.random() * ARMOR_KEYS.length)]
    return rollItem({ kind: 'armor', forceBaseKey: aKey, forceGrade: grade, forceTraitName: '빛나는' })
  }
}

const SKILL_MULT: Record<string, { mult: number; magic: boolean }> = {
  스매쉬: { mult: 2.0, magic: false }, 피어스: { mult: 1.0, magic: false },
  연속공격: { mult: 1.4, magic: false }, 정밀타격: { mult: 1.5, magic: false },
  급습: { mult: 1.65, magic: false }, 빙결의화살: { mult: 2.2, magic: true },
  화염구: { mult: 6.5, magic: true }, 폭풍칼날: { mult: 3.15, magic: true },
  바위충격: { mult: 4.8, magic: true }, 번개창: { mult: 5.5, magic: true },
  그림자일격: { mult: 2.2, magic: true }, 정화의광선: { mult: 1.8, magic: true },
}

function newFormulaPerTick(c: Character, chapter: number): { atk: number; def: number } {
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
  const dmgWithArmor = dmgNoArmor * (1 - playerDefPct)
  const defPerTick = Math.max(0, dmgNoArmor - dmgWithArmor)
  return { atk: atkPerTick, def: defPerTick }
}

// 100000틱 일반사냥 측정 — 체크포인트마다 누적/N 기록
function measureAtCheckpoints(c: Character, chapter: number): { atkAt: Record<number, number>; defAt: Record<number, number> } {
  c.hp = c.maxHp; c.mp = c.maxMp; c.statuses = []; c.actionGauge = 0
  const theme = THEMES[Math.floor(Math.random() * THEMES.length)]
  const tdef = CHAPTER_THEMES[theme]
  const monster = makeMonster(tdef.normalMonsters[0], chapter, 'normal')
  monster.hp = 1e12; monster.maxHp = 1e12
  const ctx = createCombatContext(c, monster)
  let dmgDealt = 0, dmgTaken = 0, mHits = 0
  const atkAt: Record<number, number> = {}
  const defAt: Record<number, number> = {}
  const enemy = getNormalMonsterBaseline(chapter)
  const ckpts = new Set(CHECKPOINTS)
  for (let t = 1; t <= MAX_TICKS; t++) {
    if (ctx.ended) break
    advanceTick(ctx)
    const eff = computeEffectiveStats(ctx.player)
    const ready = checkActionReady(ctx, eff.무기ticks)
    for (const m of ready.readyMonsters) {
      if (ctx.ended) break
      const hpB = ctx.player.hp
      monsterAttack(ctx, m)
      consumeAction(m, m.ticks)
      const taken = Math.max(0, hpB - ctx.player.hp)
      if (taken > 0) { dmgTaken += taken; mHits++ }
      ctx.player.hp = ctx.player.maxHp
    }
    if (!ctx.ended && ctx.player.actionGauge >= eff.무기ticks) {
      const before = monster.hp
      const action = pickAutoAction(ctx, {})
      if (action.kind === 'skill') {
        if (!useSkill(ctx, action.key)) playerBasicAttack(ctx)
      } else playerBasicAttack(ctx)
      consumeAction(ctx.player, eff.무기ticks)
      dmgDealt += before - monster.hp
    }
    if (ckpts.has(t)) {
      atkAt[t] = dmgDealt / t
      const wouldTake = mHits * enemy.atk
      defAt[t] = Math.max(0, wouldTake - dmgTaken) / t
    }
  }
  return { atkAt, defAt }
}

// 보스전 — 클리어 여부
function simBossFight(c: Character, chapter: number): boolean {
  c.hp = c.maxHp; c.mp = c.maxMp; c.statuses = []; c.actionGauge = 0
  const theme = THEMES[Math.floor(Math.random() * THEMES.length)]
  const tdef = CHAPTER_THEMES[theme]
  const boss = makeMonster(tdef.boss, chapter, 'boss')
  const ctx = createCombatContext(c, boss)
  const MAX = 800
  while (!ctx.ended && ctx.tick < MAX) {
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

// 통계 — _stats.ts 사용

interface Sample {
  scores: { atk: number; def: number }[]   // 6 공식, 순서 = LABELS
  winRate: number                            // 0.0~1.0
  cleared: number                            // 0 or 1 (≥0.5 = 1)
}

const FORMULA_LABELS = [
  '기존공식        ',
  '신규공식        ',
  '100틱/100       ',
  '1000틱/1000     ',
  '10000틱/10000   ',
  '100000틱/100000 ',
]

function run() {
  const SAMPLES = parseInt(process.env.SAMPLES || '500')
  const BOSS_FIGHTS = parseInt(process.env.BOSS_FIGHTS || '5')
  const BOOTS = parseInt(process.env.BOOTS || '1000')
  const CRN = process.env.CRN !== '0'
  const SEED_BASE = parseInt(process.env.SEED || '1')
  console.log(`\n=== 6 공식 정확도 비교 — ${SAMPLES} 캐릭터 × ${BOSS_FIGHTS} 보스전 ===`)
  console.log(`    CRN=${CRN ? 'ON' : 'OFF'} (seed base ${SEED_BASE}), Bootstrap=${BOOTS}\n`)
  console.log(`Ground truth: 각 캐릭터 ${BOSS_FIGHTS} 보스전 승률`)
  console.log(`Score: (atk + def) per-tick`)
  console.log(`조건: 스탯 60~200pt / MP 무한 / 마법무기→로브or빛나는 / 챕터=등급별 적정\n`)

  const samples: Sample[] = []
  const t0 = Date.now()

  function evalOne(i: number): Sample {
    const g = GRADES[i % GRADES.length]
    const chapter = GRADE_CHAPTER[g]
    const stats = randomStats()
    const wKey = WEAPON_KEYS[Math.floor(Math.random() * WEAPON_KEYS.length)]
    const isMagic = WEAPONS[wKey].isMagic
    const w = rollItem({ kind: 'weapon', forceBaseKey: wKey, forceGrade: g, forceTraitTier: rollTraitTier(g) })
    const a = isMagic
      ? rollArmorForMagic(g)
      : rollItem({ kind: 'armor', forceBaseKey: ARMOR_KEYS[Math.floor(Math.random() * ARMOR_KEYS.length)], forceGrade: g, forceTraitTier: rollTraitTier(g) })
    const c = makeChar(stats, w, a)

    // 1) 기존공식
    const wPred = computeItemValue(w, c, { chapter })
    const aPred = computeItemValue(a, c, { chapter })
    const enemy = getNormalMonsterBaseline(chapter)
    const enemyDmgPerTick = enemy.atk / enemy.ticks
    const f1 = {
      atk: wPred.atkValue + aPred.atkValue,
      def: enemyDmgPerTick * ((wPred.defValue + aPred.defValue) / 100),
    }
    // 2) 신규공식
    const f2 = newFormulaPerTick(c, chapter)
    // 3~6) 100/1000/10000/100000틱 측정
    const meas = measureAtCheckpoints(c, chapter)
    const f3 = { atk: meas.atkAt[100] ?? 0, def: meas.defAt[100] ?? 0 }
    const f4 = { atk: meas.atkAt[1000] ?? 0, def: meas.defAt[1000] ?? 0 }
    const f5 = { atk: meas.atkAt[10000] ?? 0, def: meas.defAt[10000] ?? 0 }
    const f6 = { atk: meas.atkAt[100000] ?? 0, def: meas.defAt[100000] ?? 0 }

    // Ground truth — 보스전 N회
    let wins = 0
    for (let f = 0; f < BOSS_FIGHTS; f++) {
      const cFresh = makeChar(stats, w, a)
      if (simBossFight(cFresh, chapter)) wins++
    }
    const winRate = wins / BOSS_FIGHTS

    return {
      scores: [f1, f2, f3, f4, f5, f6],
      winRate,
      cleared: winRate >= 0.5 ? 1 : 0,
    }
  }

  for (let i = 0; i < SAMPLES; i++) {
    const s = CRN ? withSeededRng(SEED_BASE + i, () => evalOne(i)) : evalOne(i)
    samples.push(s)
    if ((i + 1) % 50 === 0) process.stdout.write(`  진행 ${i + 1}/${SAMPLES} (${((Date.now() - t0) / 1000).toFixed(0)}s)\r`)
  }
  console.log(`\n  소요 ${((Date.now() - t0) / 1000).toFixed(1)}s`)

  // 각 공식별 정확도 — Bootstrap 95% CI
  const wrArr = samples.map((s) => s.winRate)
  const clArr = samples.map((s) => s.cleared)
  const scoresByFormula: number[][] = []
  for (let f = 0; f < 6; f++) {
    scoresByFormula.push(samples.map((s) => s.scores[f].atk + s.scores[f].def))
  }

  console.log(`\n## 정확도 (score = atk + def vs 승률 / 클리어)  — 95% CI, ${BOOTS} bootstrap`)
  console.log(`공식             | Pearson r                 | Spearman ρ                | AUC`)
  console.log('-----------------+---------------------------+---------------------------+---------------------------')
  for (let f = 0; f < 6; f++) {
    const scores = scoresByFormula[f]
    const pCI = bootstrapCI(samples.length, pearsonStat(scores, wrArr), { nBoot: BOOTS, seed: 1 })
    const sCI = bootstrapCI(samples.length, spearmanStat(scores, wrArr), { nBoot: BOOTS, seed: 2 })
    const aCI = bootstrapCI(samples.length, aucStat(scores, clArr), { nBoot: BOOTS, seed: 3 })
    console.log(`${FORMULA_LABELS[f]} | ${fmtCI(pCI).padStart(25)} | ${fmtCI(sCI).padStart(25)} | ${fmtCI(aCI).padStart(25)}`)
  }

  // Paired diff — 같은 캐릭터에 대한 공식 간 차이 (CRN ON 시 효과 큼)
  console.log(`\n## 공식 간 차이 — paired bootstrap (ΔPearson r vs 승률)`)
  console.log(`비교                         | ΔPearson r`)
  console.log('-----------------------------+---------------------------')
  // 기존공식(0) 을 baseline 으로 다른 공식들과 비교
  for (let f = 1; f < 6; f++) {
    const d = pairedBootstrapDiff(
      samples.length,
      pearsonStat(scoresByFormula[f], wrArr),
      pearsonStat(scoresByFormula[0], wrArr),
      { nBoot: BOOTS, seed: 100 + f },
    )
    console.log(`  ${FORMULA_LABELS[f]}  − 기존공식 | ${fmtCI(d).padStart(25)}`)
  }

  // atk only / def only 도 비교 (어느 게 더 클리어 결정적인지)
  console.log(`\n## atk 만 (def 영향 무시) — Pearson r vs 승률`)
  for (let f = 0; f < 6; f++) {
    const scores = samples.map((s) => s.scores[f].atk)
    const wr = samples.map((s) => s.winRate)
    console.log(`  ${FORMULA_LABELS[f]} | Pearson ${pearson(scores, wr).toFixed(3)}`)
  }
  console.log(`\n## def 만 (atk 영향 무시) — Pearson r vs 승률`)
  for (let f = 0; f < 6; f++) {
    const scores = samples.map((s) => s.scores[f].def)
    const wr = samples.map((s) => s.winRate)
    console.log(`  ${FORMULA_LABELS[f]} | Pearson ${pearson(scores, wr).toFixed(3)}`)
  }

  // 가중치 grid search — score = atk × α + def × (1-α)
  console.log(`\n## 최적 atk:def 가중치 (각 공식별 best Pearson)`)
  for (let f = 0; f < 6; f++) {
    let best = { alpha: 0, p: -1 }
    for (let alpha = 0; alpha <= 1.001; alpha += 0.05) {
      const scores = samples.map((s) => s.scores[f].atk * alpha + s.scores[f].def * (1 - alpha))
      const p = pearson(scores, samples.map((s) => s.winRate))
      if (p > best.p) best = { alpha, p }
    }
    console.log(`  ${FORMULA_LABELS[f]} | atk:def = ${(best.alpha * 100).toFixed(0)}:${((1 - best.alpha) * 100).toFixed(0)} | Pearson ${best.p.toFixed(3)}`)
  }

  // 등급별 평균 승률
  console.log(`\n## 등급별 평균 승률 (sanity)`)
  for (const g of GRADES) {
    const idx = (i: number) => GRADES[i % GRADES.length] === g
    const recs = samples.filter((_, i) => idx(i))
    const avg = recs.reduce((s, r) => s + r.winRate, 0) / recs.length
    console.log(`  ${g.padEnd(6)} (n=${recs.length}, ch${GRADE_CHAPTER[g]}) — 평균 승률 ${(avg * 100).toFixed(0)}%`)
  }

  console.log(`\n## 추천`)
  // 최고 (atk+def) Pearson 공식 출력
  let winnerIdx = 0, winnerP = -1
  for (let f = 0; f < 6; f++) {
    const scores = samples.map((s) => s.scores[f].atk + s.scores[f].def)
    const p = pearson(scores, samples.map((s) => s.winRate))
    if (p > winnerP) { winnerP = p; winnerIdx = f }
  }
  console.log(`  최고 정확도 공식: ${FORMULA_LABELS[winnerIdx].trim()}  (Pearson ${winnerP.toFixed(3)})`)
  console.log(`  비용 참고: 기존/신규 = O(1) 산술, N틱 = 60ms × N/1000 (UI 렌더링 시간)`)
}

if (typeof process !== 'undefined' && process.argv?.[1]?.includes('itemValueFormulaCompare')) {
  run()
}
