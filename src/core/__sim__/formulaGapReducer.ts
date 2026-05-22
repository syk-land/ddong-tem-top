// ============================================================
// 격차 감소 공식 v3 — MP 게이팅 + 속도 분산 패널티 추가
//
// 신규공식 (기존) 위에 두 가지 보정 추가:
//   1) MP 게이팅 — 마법 빌드의 스킬 발동률을 MP 가용량으로 제한
//      보스전 ~200틱 가정, MP 풀 = maxMp (재생 X)
//      mpDiscount = min(1, maxMp / (skillUses × mpCost))
//
//   2) 속도 분산 패널티 — 느린 무기는 보스전 분산 ↑ → 클리어 변동성 ↑
//      penalty = clamp((ticks - 8) × 0.025, 0, 0.20)
//      stability = 1 - penalty
//      완드 (6틱): 1.00, 검 (10틱): 0.95, 마도서 (14틱): 0.85
//
//   atk_v3 = atk_new × mpDiscount × stability
//   def_v3 = def_new  (그대로)
//
// 검증:
//   1M 자동플레이 클리어 비율 (무기별) vs formula 평균값 — Pearson r 비교
//
// 사용: npx tsx src/core/__sim__/formulaGapReducer.ts
// ============================================================

import { rollItem } from '../items'
import { computeMaxHp, computeMaxMp } from '../character'
import { computeWeaponSkillProc } from '../buildBalance'
import { getNormalMonsterBaseline } from '@/data/chapters'
import { WEAPON_KEYS, WEAPONS } from '@/data/weapons'
import { ARMOR_KEYS, ARMORS } from '@/data/armor'
import { WEAPON_TRAITS, ARMOR_TRAITS } from '@/data/traits'
import { SKILLS } from '@/data/skills'
import type { Character, Stats, Grade, ItemInstance, TraitTier } from '@/types'

const GRADES: Grade[] = ['노말', '레어', '스페셜', '레전드']
const GRADE_CHAPTER: Record<Grade, number> = { '노말': 3, '레어': 6, '스페셜': 9, '레전드': 10 }

// 1M 자동플레이 클리어 비율 (앞서 측정)
const CLEAR_SHARE: Record<string, number> = {
  '숏보우': 9.7, '완드': 9.2, '롱보우': 8.6, '석궁': 7.4,
  '건틀릿': 6.8, '사슬낫': 6.8, '단검': 6.6, '검': 6.6,
  '스태프': 6.1, '창': 6.0, '마도서': 5.6, '철퇴': 5.4,
  '할버드': 5.3, '대검': 5.3, '양날도끼': 4.6,
}

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
    mp: computeMaxMp(stats.마력), maxMp: computeMaxMp(stats.마력),  // 실제 MP 모델
    weapon: w, armor: a, gold: 100, statuses: [], actionGauge: 0,
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

// 신규공식 (gap 있는 버전)
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
  const dmgWithArmor = dmgNoArmor * (1 - playerDefPct)
  const defPerTick = Math.max(0, dmgNoArmor - dmgWithArmor)
  return { atk: atkPerTick, def: defPerTick }
}

// 공식 v3 — MP 게이팅 + 속도 분산 패널티 + 명중 안정성 보너스
function formulaV3(c: Character, chapter: number): { atk: number; def: number } {
  if (!c.weapon || !c.armor) return { atk: 0, def: 0 }
  const wbase = WEAPONS[c.weapon.baseKey]
  const { atk: atkBase, def } = formulaNew(c, chapter)

  // 1) MP 게이팅 — 마법 무기, autoSkill 있고 MP 비용 있을 때
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
      const mpBudget = c.maxMp
      mpDiscount = mpNeed > mpBudget ? mpBudget / mpNeed : 1.0
    }
  }

  // 2) 속도 분산 패널티
  const wticks = Math.round(10 / wbase.speedCoef)
  const speedPenalty = Math.min(0.25, Math.max(0, (wticks - 8) * 0.030))
  const stability = 1 - speedPenalty

  // 3) 명중 안정성 보너스 — 무기 자체 accBonus 가 높을수록 hit RNG 변동 ↓
  //    숏보우/롱보우/석궁 accBonus +15~20 → "보너스 (1 + accBonus/100)"
  //    공식 hit_rate × basicHit 의 평균값은 동일하나, 안정성 → 클리어률 ↑
  const accBonus = wbase.accBonus ?? 0
  const accStability = 1 + Math.max(0, accBonus) * 0.012     // +1.2% per accBonus

  return { atk: atkBase * mpDiscount * stability * accStability, def }
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

function spearman(xs: number[], ys: number[]): number {
  function ranks(arr: number[]): number[] {
    const idx = arr.map((v, i) => ({ v, i })).sort((a, b) => a.v - b.v)
    const r = new Array(arr.length).fill(0)
    for (let i = 0; i < idx.length; i++) r[idx[i].i] = i + 1
    return r
  }
  return pearson(ranks(xs), ranks(ys))
}

function pickArmor(grade: Grade, isMagic: boolean): ItemInstance {
  // 자동플레이와 동일: 마법 → 로브 우선 (50% 로브 / 50% 빛나는)
  if (isMagic && Math.random() < 0.6) {
    return rollItem({ kind: 'armor', forceBaseKey: '로브', forceGrade: grade, forceTraitTier: rollTraitTier(grade) })
  }
  const aKey = ARMOR_KEYS[Math.floor(Math.random() * ARMOR_KEYS.length)]
  return rollItem({ kind: 'armor', forceBaseKey: aKey, forceGrade: grade, forceTraitTier: rollTraitTier(grade) })
}

function run() {
  const SAMPLES_PER_WEAPON = 500
  console.log(`\n=== 격차 감소 공식 v3 검증 — 1M 자동플레이 클리어 vs 공식 ===\n`)
  console.log(`v3 = 신규공식 × MP 게이팅 × 속도 안정성`)
  console.log(`샘플: 무기 15종 × 등급 4종 × ${SAMPLES_PER_WEAPON} 랜덤 캐릭\n`)

  // 무기별 평균 score (모든 등급/스탯에 걸쳐 평균)
  const weaponNewScore: Record<string, number> = {}
  const weaponV3Score: Record<string, number> = {}
  for (const wKey of WEAPON_KEYS) {
    const isMagic = WEAPONS[wKey].isMagic
    let sumNew = 0, sumV3 = 0, n = 0
    for (const g of GRADES) {
      const ch = GRADE_CHAPTER[g]
      for (let i = 0; i < SAMPLES_PER_WEAPON; i++) {
        const stats = randomStats()
        const w = rollItem({ kind: 'weapon', forceBaseKey: wKey, forceGrade: g, forceTraitTier: rollTraitTier(g) })
        const a = pickArmor(g, isMagic)
        const c = makeChar(stats, w, a)
        const fNew = formulaNew(c, ch)
        const fV3 = formulaV3(c, ch)
        sumNew += fNew.atk + fNew.def
        sumV3 += fV3.atk + fV3.def
        n++
      }
    }
    weaponNewScore[wKey] = sumNew / n
    weaponV3Score[wKey] = sumV3 / n
  }

  console.log(`## 무기별 — 1M 클리어 vs 공식 평균 점수`)
  console.log(`무기       | 1M클리어%| 신규공식  | v3 공식  | 신규/클리어 | v3/클리어`)
  console.log('-----------+----------+-----------+----------+-------------+-----------')
  const wkeys = [...WEAPON_KEYS].sort((a, b) => (CLEAR_SHARE[b] ?? 0) - (CLEAR_SHARE[a] ?? 0))
  for (const w of wkeys) {
    const cs = CLEAR_SHARE[w] ?? 0
    const sn = weaponNewScore[w]
    const sv = weaponV3Score[w]
    console.log(`${w.padEnd(10)} | ${cs.toFixed(1).padStart(7)}% | ${sn.toFixed(2).padStart(8)} | ${sv.toFixed(2).padStart(7)} | ${(sn / cs).toFixed(2).padStart(11)} | ${(sv / cs).toFixed(2).padStart(8)}`)
  }

  // Pearson / Spearman r
  const csArr = wkeys.map((w) => CLEAR_SHARE[w])
  const snArr = wkeys.map((w) => weaponNewScore[w])
  const svArr = wkeys.map((w) => weaponV3Score[w])

  console.log(`\n## 정확도 — 1M 클리어 % 와의 상관`)
  console.log(`  신규공식 : Pearson ${pearson(snArr, csArr).toFixed(3)} | Spearman ${spearman(snArr, csArr).toFixed(3)}`)
  console.log(`  v3 공식  : Pearson ${pearson(svArr, csArr).toFixed(3)} | Spearman ${spearman(svArr, csArr).toFixed(3)}`)

  // 무기 카테고리별 평균 비교
  console.log(`\n## 카테고리별 평균 점수 (비교용)`)
  const cats: Record<string, string[]> = {
    '마법': [], '활': [], '근접빠름(6~9틱)': [], '근접중간(10~13틱)': [], '근접느림(14+틱)': [],
  }
  for (const w of WEAPON_KEYS) {
    const wb = WEAPONS[w]
    const ticks = Math.round(10 / wb.speedCoef)
    if (wb.isMagic) cats['마법'].push(w)
    else if (wb.category === 'ranged') cats['활'].push(w)
    else if (ticks <= 9) cats['근접빠름(6~9틱)'].push(w)
    else if (ticks <= 13) cats['근접중간(10~13틱)'].push(w)
    else cats['근접느림(14+틱)'].push(w)
  }
  console.log(`카테고리           | 1M클리어 평균 % | 신규 평균 | v3 평균`)
  console.log('-------------------+----------------+-----------+--------')
  for (const [name, list] of Object.entries(cats)) {
    if (list.length === 0) continue
    const cs = list.reduce((s, w) => s + (CLEAR_SHARE[w] ?? 0), 0) / list.length
    const sn = list.reduce((s, w) => s + weaponNewScore[w], 0) / list.length
    const sv = list.reduce((s, w) => s + weaponV3Score[w], 0) / list.length
    console.log(`${name.padEnd(18)} | ${cs.toFixed(2).padStart(13)}% | ${sn.toFixed(2).padStart(8)}  | ${sv.toFixed(2).padStart(7)}`)
  }
}

if (typeof process !== 'undefined' && process.argv?.[1]?.includes('formulaGapReducer')) {
  run()
}
