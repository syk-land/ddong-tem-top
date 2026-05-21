// ============================================================
// 10개 랜덤 캐릭터에 대해 6가지 방식으로 per-tick 공/방 벨류 출력
//
// 방식:
//   기존공식:     itemValue.ts 의 atkValue/defValue (per-tick)
//   신규공식:     예측 100틱 누적 / 100 = per-tick (이론값)
//   100틱/100:    실측 100틱 누적 / 100 (RNG 분산 큼)
//   1000틱/1000:  실측 1000틱 누적 / 1000
//   10000틱/10000:실측 10000틱 누적 / 10000
//   100000틱/100000: 실측 100000틱 누적 / 100000 (RNG 거의 정리됨)
//
// 모두 per-tick 단위. 신규공식과 100000틱/100000 이 일치할수록 모델 정확.
//
// 조건:
//   - MP 무한 (스킬 게이팅 제거)
//   - 마법무기 → 로브 OR 빛나는 갑옷 강제
//   - 일반 사냥 = 챕터의 normal monster 무한 HP 더미
//
// 사용: npx tsx src/core/__sim__/itemValuePerTick.ts
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
    mp: 1e9, maxMp: 1e9,    // MP 무한
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

// 신규공식 — per-tick atk DPS + per-tick def 감소량 (일반 몬스터 baseline)
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
  // 스킬 (MP 무한 — proc rate 그대로)
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

  // 방어 per tick
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

// 실측 — 100000틱 한 번 돌리고 각 체크포인트에서 누적 dmg / N 으로 per-tick 값 산출
function measureAtCheckpoints(c: Character, chapter: number): { atkAt: Record<number, number>; defAt: Record<number, number> } {
  c.hp = c.maxHp; c.mp = c.maxMp; c.statuses = []; c.actionGauge = 0
  const theme = THEMES[Math.floor(Math.random() * THEMES.length)]
  const tdef = CHAPTER_THEMES[theme]
  const monster = makeMonster(tdef.normalMonsters[0], chapter, 'normal')
  monster.hp = 1e12; monster.maxHp = 1e12
  const ctx = createCombatContext(c, monster)
  let dmgDealt = 0
  let dmgTakenActual = 0
  let monsterHits = 0
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
      const hpBefore = ctx.player.hp
      monsterAttack(ctx, m)
      consumeAction(m, m.ticks)
      const taken = Math.max(0, hpBefore - ctx.player.hp)
      if (taken > 0) { dmgTakenActual += taken; monsterHits++ }
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
      const dmgWouldTake = monsterHits * enemy.atk
      defAt[t] = Math.max(0, (dmgWouldTake - dmgTakenActual)) / t
    }
  }
  return { atkAt, defAt }
}

function fmt(v: number): string {
  if (Math.abs(v) >= 100) return v.toFixed(1)
  if (Math.abs(v) >= 10) return v.toFixed(2)
  return v.toFixed(3)
}

function run() {
  const SAMPLES = 10
  console.log(`\n=== ${SAMPLES} 랜덤 캐릭터 — 6 방식 per-tick 공/방 비교 ===\n`)
  console.log(`조건: 스탯 60~200pt / MP 무한 / 마법무기→로브or빛나는 / 챕터 = 등급별 적정 / 일반 몬스터 무한 HP\n`)

  const t0 = Date.now()
  for (let i = 1; i <= SAMPLES; i++) {
    const g = GRADES[(i - 1) % GRADES.length]
    const chapter = GRADE_CHAPTER[g]
    const stats = randomStats()
    const wKey = WEAPON_KEYS[Math.floor(Math.random() * WEAPON_KEYS.length)]
    const isMagic = WEAPONS[wKey].isMagic
    const w = rollItem({ kind: 'weapon', forceBaseKey: wKey, forceGrade: g, forceTraitTier: rollTraitTier(g) })
    const a = isMagic
      ? rollArmorForMagic(g)
      : rollItem({ kind: 'armor', forceBaseKey: ARMOR_KEYS[Math.floor(Math.random() * ARMOR_KEYS.length)], forceGrade: g, forceTraitTier: rollTraitTier(g) })
    const c = makeChar(stats, w, a)

    const wPred = computeItemValue(w, c, { chapter })
    const aPred = computeItemValue(a, c, { chapter })
    const existAtkPerTick = wPred.atkValue + aPred.atkValue
    const enemy = getNormalMonsterBaseline(chapter)
    const aTrait = ARMOR_TRAITS[a.trait]
    const abase = ARMORS[a.baseKey as keyof typeof ARMORS]
    // 기존공식 def 를 per-tick 감소량으로 환산: existDefPct% × enemy_atk × enemy_attacks_per_tick × enemy_hit_rate
    // (단순화 — hit_rate 1 가정)
    void aTrait; void abase
    const existDefPct = wPred.defValue + aPred.defValue   // calibrated %
    const enemyDmgPerTick = enemy.atk / enemy.ticks
    const existDefPerTick = enemyDmgPerTick * (existDefPct / 100)

    const newF = newFormulaPerTick(c, chapter)
    const meas = measureAtCheckpoints(c, chapter)

    const statSum = Object.values(stats).reduce((s, v) => s + v, 0)
    console.log(`─── #${i} ${g} · ch${chapter} · 스탯합 ${statSum} (힘${stats.힘}/민${stats.민첩}/체${stats.체력}/마${stats.마력}/행${stats.행운})`)
    console.log(`     무기: ${w.trait} ${w.grade} ${w.baseKey}${isMagic ? ' (마법)' : ''}`)
    console.log(`     갑옷: ${a.trait} ${a.grade} ${a.baseKey}`)
    console.log(`              | 기존공식 |  신규공식 | 100틱/100 |1000틱/1000|10000틱/1만|100000틱/10만`)
    console.log(`     공 dmg/틱 | ${fmt(existAtkPerTick).padStart(8)} | ${fmt(newF.atk).padStart(9)} | ${fmt(meas.atkAt[100]).padStart(9)} | ${fmt(meas.atkAt[1000]).padStart(9)} | ${fmt(meas.atkAt[10000]).padStart(9)} | ${fmt(meas.atkAt[100000]).padStart(11)}`)
    console.log(`     방 dmg/틱 | ${fmt(existDefPerTick).padStart(8)} | ${fmt(newF.def).padStart(9)} | ${fmt(meas.defAt[100]).padStart(9)} | ${fmt(meas.defAt[1000]).padStart(9)} | ${fmt(meas.defAt[10000]).padStart(9)} | ${fmt(meas.defAt[100000]).padStart(11)}`)
  }
  console.log(`\n소요 ${((Date.now() - t0) / 1000).toFixed(1)}s`)
  console.log(`\n해석: 신규공식 ≈ 100000틱/10만 일수록 모델이 정확. 짧은 측정(100틱/100)은 RNG 분산 큼.`)
}

if (typeof process !== 'undefined' && process.argv?.[1]?.includes('itemValuePerTick')) {
  run()
}
