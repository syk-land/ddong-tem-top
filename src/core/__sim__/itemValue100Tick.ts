// ============================================================
// 100틱 예측 모델 vs 현재 DPS 모델 비교
//
// 현재 (calibrated DPS):
//   atkValue = DPS × 칼리브 (fixed ch5 enemy 기준)
//   defValue = damage reduction% × 칼리브 (% 단위)
//
// 신규 (100-tick total, chapter-relative):
//   atkValue_new = 100틱 동안 현재 챕터 적에게 가하는 예상 누적 데미지
//   defValue_new = 100틱 동안 현재 챕터 적이 가하는 공격에 대한 누적 감소 데미지
//
// 측정 방식:
//   각 캐릭터 × 챕터 조합에서:
//     1) 두 모델의 예측치 계산
//     2) 실제 100틱 전투 (보스 HP 무한, 양방향 공격) 에서 누적 dmg/감소량 측정
//     3) Pearson r, ±10% 내 비율로 정확도 비교
//
// 사용: npx tsx src/core/__sim__/itemValue100Tick.ts
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
import {
  CHAPTER_THEMES, getBossBaseline, getNormalMonsterBaseline,
} from '@/data/chapters'
import { WEAPON_KEYS, WEAPONS } from '@/data/weapons'
import { ARMOR_KEYS, ARMORS } from '@/data/armor'
import { WEAPON_TRAITS, ARMOR_TRAITS } from '@/data/traits'
import { computeWeaponSkillProc } from '../buildBalance'
import { SKILLS } from '@/data/skills'
import type { Character, Stats, Grade, ChapterTheme, ItemInstance, TraitTier } from '@/types'

const THEMES: ChapterTheme[] = [
  '고블린', '골렘', '언데드', '환영', '흡혈귀',
  '심해', '기계', '용암', '암흑', '천공', '맹독',
]
const GRADES: Grade[] = ['노말', '레어', '스페셜', '레전드']
const GRADE_CHAPTER: Record<Grade, number> = { '노말': 3, '레어': 6, '스페셜': 9, '레전드': 10 }
const TICKS = 100

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

function makeChar(stats: Stats, w: ItemInstance, a: ItemInstance): Character {
  return {
    stats: { ...stats },
    hp: computeMaxHp(stats.체력), maxHp: computeMaxHp(stats.체력),
    mp: computeMaxMp(stats.마력), maxMp: computeMaxMp(stats.마력),
    weapon: w, armor: a, gold: 100, statuses: [], actionGauge: 0,
  }
}

function rollTraitTier(grade: Grade): TraitTier {
  const r = Math.random()
  if (grade === '노말')   return r < 0.7 ? '하급' : '보통'
  if (grade === '레어')   return r < 0.4 ? '하급' : r < 0.85 ? '보통' : '희귀'
  if (grade === '스페셜') return r < 0.2 ? '보통' : r < 0.7 ? '희귀' : '특별'
  return r < 0.5 ? '희귀' : '특별'
}

// ── 신규 100틱 예측 모델 (현재 챕터 적 baseline 사용) ──
const SKILL_MULT: Record<string, { mult: number; magic: boolean }> = {
  스매쉬: { mult: 2.0, magic: false }, 피어스: { mult: 1.0, magic: false },
  연속공격: { mult: 1.4, magic: false }, 정밀타격: { mult: 1.5, magic: false },
  급습: { mult: 1.65, magic: false }, 빙결의화살: { mult: 2.2, magic: true },
  화염구: { mult: 6.5, magic: true }, 폭풍칼날: { mult: 3.15, magic: true },
  바위충격: { mult: 4.8, magic: true }, 번개창: { mult: 5.5, magic: true },
  그림자일격: { mult: 2.2, magic: true }, 정화의광선: { mult: 1.8, magic: true },
}

function predict100Tick(c: Character, chapter: number, vsBoss: boolean): { atk100: number; def100: number } {
  if (!c.weapon || !c.armor) return { atk100: 0, def100: 0 }
  const wbase = WEAPONS[c.weapon.baseKey]
  const abase = ARMORS[c.armor.baseKey as keyof typeof ARMORS]
  const wTrait = WEAPON_TRAITS[c.weapon.trait]
  const aTrait = ARMOR_TRAITS[c.armor.trait]
  if (!wbase || !abase || !wTrait || !aTrait) return { atk100: 0, def100: 0 }
  const stats = c.stats
  const enemy = vsBoss ? getBossBaseline(chapter) : getNormalMonsterBaseline(chapter)
  const enemyDef = enemy.def
  const enemyEva = enemy.eva
  const enemyAcc = enemy.acc
  const enemyAtk = enemy.atk
  const enemyTicks = enemy.ticks

  // 공격력
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
  const hitRate = clampN((acc - enemyEva) / 100, 0, 1)
  const pen = (wbase.penBonus ?? 0) + (wbase.magicPenBonus ?? 0) + (c.weapon.effects.관통 ?? 0)
  const effDef = Math.max(0, enemyDef - pen) / 100
  const basicHit = Math.max(1, totalAtk * (1 - effDef)) * hitRate

  // 스킬 (현재 combat 동일 — computeWeaponSkillProc)
  const skillKey = wbase.autoSkill
  const skillInfo = skillKey ? SKILL_MULT[skillKey] : undefined
  let avgHit = basicHit
  if (skillKey && skillInfo) {
    let procRate = computeWeaponSkillProc(c, stats.행운)
    const skill = SKILLS[skillKey]
    if (skill) {
      let mpCost = skill.mp
      if ((skill.kind === 'magic_atk' || skill.kind === 'magic_def') && wbase.isMagic) {
        mpCost = Math.max(0, mpCost + (wbase.mpBonus ?? 0))
      }
      const ticks = Math.round(10 / wbase.speedCoef)
      const wSpeedPct = c.weapon.effects.속도_pct ?? 0
      const aSpeedPct = c.armor.effects.속도_pct ?? 0
      let armorSpeed = abase.speedMult ?? 1
      if (abase.key === '로브' && wbase.isMagic) armorSpeed *= 1.15
      const gauge = (1 + stats.민첩 / 100) * (1 + wSpeedPct + aSpeedPct) * armorSpeed
      const attacksIn100 = (100 * gauge) / ticks
      const wantUses = attacksIn100 * procRate
      const afford = mpCost > 0 ? c.maxMp / mpCost : wantUses
      const eff = Math.min(wantUses, afford)
      procRate = attacksIn100 > 0 ? eff / attacksIn100 : 0
    }
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
  const dps = avgHit * critBoost * attacksPerTick
  const atk100 = dps * TICKS

  // 방어: 100틱 동안 적이 가하는 공격에 대한 감소량
  const defPctTrait = (aTrait.effects.방어력_pct ?? 0) + (aTrait.effects.전스탯_pct ?? 0)
  const armorDef = abase.baseDef * c.armor.coef * (1 + defPctTrait)
  const hpDef = stats.체력 * 0.3 * c.armor.coef
  const playerDefPct = clampN(armorDef + hpDef, 0, 99) / 100
  const playerEva = 5 + (wbase.evaBonus ?? 0) + (c.weapon.effects.회피 ?? 0) + (c.armor.effects.회피 ?? 0)
    + (abase.evasion ?? 0) + stats.민첩 * 0.5 + stats.행운 * 0.1
  const enemyHitRate = clampN((enemyAcc - playerEva) / 100, 0, 1)
  const enemyAttacksIn100 = TICKS / enemyTicks
  // 방어 없을 때 받는 dmg = enemy_atk × hit_rate × attacks
  const dmgNoArmor = enemyAtk * enemyHitRate * enemyAttacksIn100
  // 방어 있을 때 = same × (1 - def%)
  const dmgWithArmor = dmgNoArmor * (1 - playerDefPct)
  const def100 = Math.max(0, dmgNoArmor - dmgWithArmor)
  return { atk100, def100 }
}

// ── 실제 100틱 측정 ──
function measure100Tick(c: Character, chapter: number, vsBoss: boolean): { actAtk100: number; actDef100: number } {
  c.hp = c.maxHp; c.mp = c.maxMp; c.statuses = []; c.actionGauge = 0
  const theme = THEMES[Math.floor(Math.random() * THEMES.length)]
  const tdef = CHAPTER_THEMES[theme]
  const monsterTemplate = vsBoss ? tdef.boss : tdef.normalMonsters[0]
  const monster = makeMonster(monsterTemplate, chapter, vsBoss ? 'boss' : 'normal')
  monster.hp = 1e12; monster.maxHp = 1e12   // 무한 HP — 100틱 풀 측정
  const ctx = createCombatContext(c, monster)
  let playerDmgDealt = 0
  let dmgTakenActual = 0
  let monsterHits = 0
  for (let t = 0; t < TICKS; t++) {
    if (ctx.ended) break
    advanceTick(ctx)
    const eff = computeEffectiveStats(ctx.player)
    const ready = checkActionReady(ctx, eff.무기ticks)
    for (const m of ready.readyMonsters) {
      if (ctx.ended) break
      const hpBefore = ctx.player.hp
      monsterAttack(ctx, m)
      consumeAction(m, m.ticks)
      const taken = Math.max(0, hpBefore - ctx.player.hp)
      if (taken > 0) { dmgTakenActual += taken; monsterHits++ }
      // 사망 방지 — HP 풀 유지
      ctx.player.hp = ctx.player.maxHp
    }
    if (!ctx.ended && ctx.player.actionGauge >= eff.무기ticks) {
      const before = monster.hp
      const action = pickAutoAction(ctx, {})
      if (action.kind === 'skill') {
        if (!useSkill(ctx, action.key)) playerBasicAttack(ctx)
      } else playerBasicAttack(ctx)
      consumeAction(ctx.player, eff.무기ticks)
      playerDmgDealt += before - monster.hp
    }
  }
  // 방어 없을 때 받았을 데미지 (분리 측정) — 동일 hit rate, monster atk 그대로
  const enemy = vsBoss ? getBossBaseline(chapter) : getNormalMonsterBaseline(chapter)
  const enemyAttacksFired = monsterHits + (monsterHits > 0 ? 0 : 0)   // 사용 X — actAtk - actually-taken
  void enemyAttacksFired
  // 100틱 동안 적이 명중한 횟수 × 적 평타 = 방어 없었을 때 받았을 데미지
  const dmgWouldTake = monsterHits * enemy.atk
  const actDef100 = Math.max(0, dmgWouldTake - dmgTakenActual)
  return { actAtk100: playerDmgDealt, actDef100 }
}

interface Row {
  grade: Grade
  chapter: number
  // 현재 모델
  curAtk: number
  curDef: number
  // 신규 모델
  newAtk100: number
  newDef100: number
  // 실측
  actAtk100: number
  actDef100: number
}

function leastSquaresK(predicted: number[], actual: number[]): number {
  let num = 0, den = 0
  for (let i = 0; i < predicted.length; i++) {
    num += predicted[i] * actual[i]
    den += predicted[i] * predicted[i]
  }
  return den > 0 ? num / den : 1
}

function pearson(xs: number[], ys: number[]): number {
  const n = xs.length
  const mx = xs.reduce((a, b) => a + b, 0) / n
  const my = ys.reduce((a, b) => a + b, 0) / n
  let num = 0, dx = 0, dy = 0
  for (let i = 0; i < n; i++) {
    num += (xs[i] - mx) * (ys[i] - my); dx += (xs[i] - mx) ** 2; dy += (ys[i] - my) ** 2
  }
  return num / Math.sqrt(dx * dy || 1)
}

function pctWithin(pred: number[], act: number[], k: number, tol: number): number {
  let hit = 0
  for (let i = 0; i < pred.length; i++) {
    const p = pred[i] * k
    const a = act[i]
    if (a < 0.5) continue
    if (Math.abs(p - a) / a < tol) hit++
  }
  return hit / pred.length
}

function run() {
  const PER_GRADE = 250
  const TOTAL = PER_GRADE * GRADES.length
  console.log(`\n=== 100틱 누적 예측 모델 vs 현재 DPS 모델 비교 — ${TOTAL} 런 ===\n`)
  console.log(`현재 모델: itemValue.ts (calibrated DPS / reduction%, ch5 baseline)`)
  console.log(`신규 모델: 100틱 동안 현재 챕터 보스에 가하는 누적 dmg / 감소 dmg\n`)

  const rows: Row[] = []
  const t0 = Date.now()
  for (const g of GRADES) {
    for (let i = 0; i < PER_GRADE; i++) {
      const stats = randomStats()
      const wKey = WEAPON_KEYS[Math.floor(Math.random() * WEAPON_KEYS.length)]
      const aKey = ARMOR_KEYS[Math.floor(Math.random() * ARMOR_KEYS.length)]
      const w = rollItem({ kind: 'weapon', forceBaseKey: wKey, forceGrade: g, forceTraitTier: rollTraitTier(g) })
      const a = rollItem({ kind: 'armor',  forceBaseKey: aKey, forceGrade: g, forceTraitTier: rollTraitTier(g) })
      const c = makeChar(stats, w, a)
      const chapter = GRADE_CHAPTER[g]
      // 현재 모델
      const wPred = computeItemValue(w, c, { chapter })
      const aPred = computeItemValue(a, c, { chapter })
      const curAtk = wPred.atkValue + aPred.atkValue    // DPS (calibrated)
      const curDef = wPred.defValue + aPred.defValue    // reduction%
      // 신규 모델
      const { atk100, def100 } = predict100Tick(c, chapter, true)
      // 실측
      const { actAtk100, actDef100 } = measure100Tick(c, chapter, true)
      rows.push({ grade: g, chapter, curAtk, curDef, newAtk100: atk100, newDef100: def100, actAtk100, actDef100 })
    }
    process.stdout.write(`  ${g} 완료\n`)
  }
  const elapsed = ((Date.now() - t0) / 1000).toFixed(1)

  // ── 비교 ──
  console.log(`\n## 정확도 비교 (실측 100틱 dmg / 감소량 기준)`)
  // 현재 모델 — atkValue 는 DPS 이므로 ×100 으로 100틱 환산 비교
  const curAtkArr = rows.map((r) => r.curAtk * TICKS)
  const newAtkArr = rows.map((r) => r.newAtk100)
  const actAtkArr = rows.map((r) => r.actAtk100)
  // 현재 모델 — defValue 는 % 이므로 100틱 보스 baseline 으로 환산
  const curDefArr = rows.map((r) => {
    const enemy = getBossBaseline(r.chapter)
    const dmgNoArmor = enemy.atk * (TICKS / enemy.ticks)
    return dmgNoArmor * (r.curDef / 100)   // % → 누적
  })
  const newDefArr = rows.map((r) => r.newDef100)
  const actDefArr = rows.map((r) => r.actDef100)

  function report(label: string, pred: number[], act: number[]) {
    const k = leastSquaresK(pred, act)
    const pc = pearson(pred, act)
    const within10 = pctWithin(pred, act, k, 0.10)
    const within25 = pctWithin(pred, act, k, 0.25)
    // calibration 후 실측 평균과 일치도
    const meanPred = pred.reduce((a, b) => a + b, 0) / pred.length
    const meanAct = act.reduce((a, b) => a + b, 0) / act.length
    console.log(`  ${label}:  Pearson ${pc.toFixed(3)}  | k=${k.toFixed(3)} | ±10% ${(within10 * 100).toFixed(0)}% | ±25% ${(within25 * 100).toFixed(0)}% | 평균 pred ${meanPred.toFixed(1)} / act ${meanAct.toFixed(1)}`)
  }
  report('공 — 현재 (DPS×100)        ', curAtkArr, actAtkArr)
  report('공 — 신규 (100틱 예측)      ', newAtkArr, actAtkArr)
  report('방 — 현재 (% × 100틱 환산)  ', curDefArr, actDefArr)
  report('방 — 신규 (100틱 감소 예측) ', newDefArr, actDefArr)

  // ── 등급별 평균 ──
  console.log(`\n## 등급별 평균 — 신규 모델 (적정 챕터 보스)`)
  console.log(`등급     | 예측 공100  실측 공100  비율  | 예측 방100  실측 방100  비율`)
  console.log('---------+-------------+----------+------+-----------+-----------+--------')
  for (const g of GRADES) {
    const recs = rows.filter((r) => r.grade === g)
    const mp = recs.reduce((s, r) => s + r.newAtk100, 0) / recs.length
    const ma = recs.reduce((s, r) => s + r.actAtk100, 0) / recs.length
    const md = recs.reduce((s, r) => s + r.newDef100, 0) / recs.length
    const mda = recs.reduce((s, r) => s + r.actDef100, 0) / recs.length
    console.log(`${g.padEnd(8)} | ${mp.toFixed(1).padStart(10)} | ${ma.toFixed(1).padStart(9)} | ${(mp / Math.max(0.01, ma)).toFixed(2).padStart(4)} | ${md.toFixed(1).padStart(9)} | ${mda.toFixed(1).padStart(9)} | ${(md / Math.max(0.01, mda)).toFixed(2).padStart(5)}`)
  }

  // ── 챕터 의존성 비교 ──
  console.log(`\n## 챕터별 적용 — 같은 캐릭터·장비로 ch3 vs ch10 (랜덤 100 캐릭)`)
  for (let trial = 0; trial < 1; trial++) {
    const sampleChars: Character[] = []
    const N = 100
    for (let i = 0; i < N; i++) {
      const stats = randomStats()
      const w = rollItem({ kind: 'weapon', forceBaseKey: WEAPON_KEYS[Math.floor(Math.random() * WEAPON_KEYS.length)], forceGrade: '레어', forceTraitTier: '보통' })
      const a = rollItem({ kind: 'armor',  forceBaseKey: ARMOR_KEYS[Math.floor(Math.random() * ARMOR_KEYS.length)], forceGrade: '레어', forceTraitTier: '보통' })
      sampleChars.push(makeChar(stats, w, a))
    }
    function avg(chapter: number, mode: 'cur' | 'new'): { atk: number; def: number } {
      let sumA = 0, sumD = 0
      for (const c of sampleChars) {
        if (mode === 'cur') {
          const wPred = computeItemValue(c.weapon!, c, { chapter })
          const aPred = computeItemValue(c.armor!, c, { chapter })
          sumA += (wPred.atkValue + aPred.atkValue) * TICKS
          sumD += (wPred.defValue + aPred.defValue)
        } else {
          const { atk100, def100 } = predict100Tick(c, chapter, true)
          sumA += atk100; sumD += def100
        }
      }
      return { atk: sumA / N, def: sumD / N }
    }
    const cur3 = avg(3, 'cur'), cur10 = avg(10, 'cur')
    const new3 = avg(3, 'new'), new10 = avg(10, 'new')
    console.log(`  같은 100 캐릭 (레어 무기/갑옷 보통 트레잇):`)
    console.log(`    현재 모델: ch3 공 ${cur3.atk.toFixed(0)}/방 ${cur3.def.toFixed(0)} → ch10 공 ${cur10.atk.toFixed(0)}/방 ${cur10.def.toFixed(0)}  (변화 ${((cur10.atk / cur3.atk - 1) * 100).toFixed(0)}% / ${((cur10.def / cur3.def - 1) * 100).toFixed(0)}%)`)
    console.log(`    신규 모델: ch3 공 ${new3.atk.toFixed(0)}/방 ${new3.def.toFixed(0)} → ch10 공 ${new10.atk.toFixed(0)}/방 ${new10.def.toFixed(0)}  (변화 ${((new10.atk / new3.atk - 1) * 100).toFixed(0)}% / ${((new10.def / new3.def - 1) * 100).toFixed(0)}%)`)
  }

  console.log(`\n총 ${TOTAL} 보스전 (100틱), 소요 ${elapsed}s`)
}

if (typeof process !== 'undefined' && process.argv?.[1]?.includes('itemValue100Tick')) {
  run()
}
