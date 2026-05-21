// ============================================================
// 같은 등급 · 같은 트레잇 일 때 무기별 표시 벨류 평균
//
// 목적: 무기 간 표시값 격차 시각화. 같은 조건에서 어떤 무기가
//       표시상 가장 강하게/약하게 보이는지.
//
// 조건:
//   - 등급 4종 (노말/레어/스페셜/레전드) × 트레잇 보통 고정
//   - 무기 15종 × 100 랜덤 캐릭터 (스탯 60~200pt, 무작위 분배)
//   - 갑옷 무작위 (마법무기 → 로브 OR 빛나는 트레잇 강제)
//   - 챕터 = 등급별 적정 (노말 ch3, 레어 ch6, 스페셜 ch9, 레전드 ch10)
//   - 표시값 = 현재 itemValue.ts (calibrated) + 신규공식 (closed-form) 둘 다
//
// 사용: npx tsx src/core/__sim__/itemValueByWeapon.ts
// ============================================================

import { rollItem } from '../items'
import { computeItemValue } from '../itemValue'
import { computeMaxHp, computeMaxMp } from '../character'
import { getNormalMonsterBaseline } from '@/data/chapters'
import { WEAPON_KEYS, WEAPONS } from '@/data/weapons'
import { ARMOR_KEYS, ARMORS } from '@/data/armor'
import { WEAPON_TRAITS, ARMOR_TRAITS } from '@/data/traits'
import { computeWeaponSkillProc } from '../buildBalance'
import type { Character, Stats, Grade, ItemInstance } from '@/types'

const GRADES: Grade[] = ['노말', '레어', '스페셜', '레전드']
const GRADE_CHAPTER: Record<Grade, number> = { '노말': 3, '레어': 6, '스페셜': 9, '레전드': 10 }
const FIXED_WEAPON_TRAIT = '날카로운'    // 보통 tier (공+0, 명중+5)
const FIXED_ARMOR_TRAIT = '단단한'       // 보통 tier (방+15%)

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
    mp: 1e9, maxMp: 1e9,   // MP 무한
    weapon: w, armor: a, gold: 100, statuses: [], actionGauge: 0,
  }
}

// 신규공식 (per-tick atk + per-tick def)
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

function pickRandomArmor(grade: Grade, isMagic: boolean): ItemInstance {
  // 마법무기 → 로브 OR 빛나는 트레잇 강제
  if (isMagic) {
    if (Math.random() < 0.5) {
      return rollItem({ kind: 'armor', forceBaseKey: '로브', forceGrade: grade, forceTraitName: FIXED_ARMOR_TRAIT })
    } else {
      const aKey = ARMOR_KEYS[Math.floor(Math.random() * ARMOR_KEYS.length)]
      return rollItem({ kind: 'armor', forceBaseKey: aKey, forceGrade: grade, forceTraitName: '빛나는' })
    }
  }
  const aKey = ARMOR_KEYS[Math.floor(Math.random() * ARMOR_KEYS.length)]
  return rollItem({ kind: 'armor', forceBaseKey: aKey, forceGrade: grade, forceTraitName: FIXED_ARMOR_TRAIT })
}

function run() {
  const PER_WEAPON = 200
  console.log(`\n=== 무기별 표시값 평균 — 트레잇=${FIXED_WEAPON_TRAIT} 고정, ${PER_WEAPON} 랜덤 캐릭/무기 ===\n`)
  console.log(`조건: 스탯 60~200pt / MP 무한 / 마법무기→로브or빛나는 갑옷 / 갑옷 트레잇=${FIXED_ARMOR_TRAIT}`)
  console.log(`기존공식 = itemValue.ts (calibrated)`)
  console.log(`신규공식 = closed-form per-tick (chapter-relative)\n`)

  for (const g of GRADES) {
    const ch = GRADE_CHAPTER[g]
    console.log(`\n## 등급 ${g} (적정 ch${ch})`)
    console.log(`무기       | 분류   | 기존 공   기존 방  | 신규 공   신규 방`)
    console.log('-----------+--------+--------+--------+--------+--------')
    const rows: { weapon: string; cat: string; existAtk: number; existDef: number; newAtk: number; newDef: number; isMagic: boolean }[] = []
    for (const wKey of WEAPON_KEYS) {
      const wbase = WEAPONS[wKey]
      const isMagic = wbase.isMagic
      let sumEA = 0, sumED = 0, sumNA = 0, sumND = 0
      for (let i = 0; i < PER_WEAPON; i++) {
        const stats = randomStats()
        const w = rollItem({ kind: 'weapon', forceBaseKey: wKey, forceGrade: g, forceTraitName: FIXED_WEAPON_TRAIT })
        const a = pickRandomArmor(g, isMagic)
        const c = makeChar(stats, w, a)
        const wPred = computeItemValue(w, c, { chapter: ch })
        const aPred = computeItemValue(a, c, { chapter: ch })
        sumEA += wPred.atkValue + aPred.atkValue
        sumED += wPred.defValue + aPred.defValue
        const nf = newFormulaPerTick(c, ch)
        sumNA += nf.atk
        sumND += nf.def
      }
      const ea = sumEA / PER_WEAPON, ed = sumED / PER_WEAPON
      const na = sumNA / PER_WEAPON, nd = sumND / PER_WEAPON
      const cat = isMagic ? '마법' : (wbase.category === 'ranged' ? '활' : '근접')
      rows.push({ weapon: wKey, cat, existAtk: ea, existDef: ed, newAtk: na, newDef: nd, isMagic })
    }
    // 공 평균 내림차순 정렬 (신규공식 기준)
    rows.sort((a, b) => b.newAtk - a.newAtk)
    for (const r of rows) {
      console.log(`${r.weapon.padEnd(10)} | ${r.cat.padEnd(6)} | ${r.existAtk.toFixed(1).padStart(6)} | ${r.existDef.toFixed(1).padStart(6)} | ${r.newAtk.toFixed(2).padStart(6)} | ${r.newDef.toFixed(3).padStart(6)}`)
    }
  }
}

if (typeof process !== 'undefined' && process.argv?.[1]?.includes('itemValueByWeapon')) {
  run()
}
