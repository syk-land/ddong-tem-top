import type { Character, TraitEffect, ArmorType } from '@/types'
import { getWeaponBase, getArmorBase } from './items'
import { WEAPON_TRAITS, ARMOR_TRAITS } from '@/data/traits'
import { clamp } from './rng'

// v8 5스탯 기반 통합 EffectiveStats
//   힘    → 공격력(× 7.0), 관통%(× 0.5)
//   민첩  → 속도(× 0.5), 명중(× 0.5), 회피(× 0.5)
//   체력  → 방어력(× 3.5), HP(× 10 + 50), 상태저항(× 0.5)
//   마력  → MP(× 15 + 30), 마력계수, 상태저항(× 0.5)
//   행운  → 명중/회피/관통%/상태저항 각 × 0.3 가산
//
// v8 변경:
//   - 관통은 % 방어 무시 (절대값 차감 X) → combat.ts/computeDamage 참조
//   - 힘 30 + 행운 10 = 18% 방어 무시 (스탯 기여)
//   - 무기 관통% 0~30이 일반적 (할버드/석궁 최대 30%)
//
// 장비/특성은 스탯 직접 변동 없음.
// 모든 효과는 derive 된 파생값(공격력/방어력/명중/회피/관통/저항/마력 등)에 가산.
export interface EffectiveStats {
  공격력: number
  마법공격력: number
  마력계수: number
  방어력_effective: number
  속도: number
  체력: number
  마력: number
  행운: number
  명중률: number
  회피율: number
  관통: number
  상태저항: number
  // 무기 정보
  weaponAtk: number
  weaponSpeedCoef: number
  weaponElement?: string
  weaponMpBonus: number
  weaponAccBonus: number
  isMagicWeapon: boolean
  // 패시브
  lifesteal: number
  damageTakenHealPct: number
  damageReflectPct: number
  selfDotPct: number
  vsUndeadPct: number
  // 상태이상 발동률
  burnChance: number
  slowChance: number
  shockChance: number
  bleedChance: number
  blindChance: number
  poisonChance: number
  resists: Partial<Record<'burn' | 'slow' | 'shock' | 'bleed' | 'blind' | 'poison', number>>
  reflects: Partial<Record<'burn' | 'slow' | 'shock' | 'bleed' | 'blind' | 'poison', number>>
}

export function computeEffectiveStats(c: Character): EffectiveStats {
  const s = c.stats
  const weapon = c.weapon
  const armor = c.armor

  const wbase = weapon ? getWeaponBase(weapon.baseKey) : null
  const abase = armor ? getArmorBase(armor.baseKey as ArmorType) : null

  const weffects: TraitEffect = weapon?.effects ?? {}
  const aeffects: TraitEffect = armor?.effects ?? {}

  // 특성 unscaled %
  const wTraitDef = weapon ? WEAPON_TRAITS[weapon.trait] : null
  const aTraitDef = armor ? ARMOR_TRAITS[armor.trait] : null
  const atkPctBase = (wTraitDef?.effects.공격력_pct ?? 0) + (wTraitDef?.effects.전스탯_pct ?? 0)
  const defPctBase = (aTraitDef?.effects.방어력_pct ?? 0) + (aTraitDef?.effects.전스탯_pct ?? 0)
  const speedPct = (weffects.속도_pct ?? 0) + (aeffects.속도_pct ?? 0)

  // ── 파생 base (5스탯에서) — 스탯 비중 매우 높음 (장비 격차 평탄화)
  // v7.2: 민첩 속도 0.7 → 0.5, 체력 방어 5.0 → 3.5 추가 너프
  // v7.3: 힘 atkBase 5.0 → 7.0 (균등 baseline 회복)
  //       + 마법 무기 사용 시 마력 × 3.0 추가 가산 (마법 빌드 본질 강화)
  const isMagicW = wbase?.isMagic ?? false
  const atkBase = s.힘 * 7.0 + (isMagicW ? s.마력 * 3.0 : 0)
  const penBase = s.힘 * 0.5 + s.행운 * 0.3
  const speedBase = s.민첩 * 0.5
  const accBase = s.민첩 * 0.5 + s.행운 * 0.3
  const evaBase = s.민첩 * 0.5 + s.행운 * 0.3
  const defBase = s.체력 * 3.5
  const resistBase = s.체력 * 0.5 + s.마력 * 0.5 + s.행운 * 0.3
  const hpStat = s.체력           // HP 계산은 character.ts 가 담당
  const mpStat = s.마력
  const luckStat = s.행운

  // ── 무기 / 갑옷 기여 ──
  const baseWeaponAtk = wbase?.baseAtk ?? 0
  const weaponCoef = weapon?.coef ?? 0
  const weaponAtkCoef = baseWeaponAtk * (weaponCoef + atkPctBase)
  const finalAtk = atkBase + weaponAtkCoef

  const armorBaseDef = abase?.baseDef ?? 0
  const armorCoefVal = armor?.coef ?? 0
  const armorDefCoef = armorBaseDef * 2.0 * (armorCoefVal + defPctBase)
  const defEff = defBase + armorDefCoef

  // 속도 — 무기 speedCoef 까지 포함 (실제 매 틱 actionGauge 누적량과 일치)
  let armorSpeedMult = abase?.speedMult ?? 1.0
  // v6: 로브 + 마법 무기 조합 → 추가 속도 부스트 (시너지)
  if (abase?.key === '로브' && wbase?.isMagic) {
    armorSpeedMult *= 1.15
  }
  const weaponSpeedCoefForCalc = wbase?.speedCoef ?? 1.0
  const speedEff = speedBase * (1 + speedPct) * armorSpeedMult * weaponSpeedCoefForCalc

  // 명중 / 회피 — 베이스 + 무기/갑옷 base + 특성 가산
  const acc = accBase
    + (weffects.명중 ?? 0)
    + (aeffects.명중 ?? 0)
    + (wbase?.accBonus ?? 0)
  const eva = evaBase
    + (weffects.회피 ?? 0)
    + (aeffects.회피 ?? 0)
    + (abase?.evasion ?? 0)
    + (wbase?.evaBonus ?? 0)

  // 관통 — 힘/행운 기반 + 무기 penBonus / magicPenBonus / 특성
  const pen = penBase
    + (weffects.관통 ?? 0)
    + (wbase?.penBonus ?? 0)
    + (wbase?.magicPenBonus ?? 0)

  // 상태저항 — 체력/마력/행운 + 특성
  const stRes = resistBase
    + (weffects.상태저항 ?? 0)
    + (aeffects.상태저항 ?? 0)

  // 마력 보너스 → 마력계수 (장비/특성 마력은 마력계수에만 영향, 스탯엔 안 들어감)
  // v7.1: 마법 빌드 추가 강화 — 1pt당 0.07 → 0.10, 상한 2.5 → 3.0
  //       마법 빌드가 여전히 평균 7.8%로 부진. 마력 20 → magicCoef 1.5 (옛 1.35)
  const mpBonus = (aeffects.마력 ?? 0) + (weffects.마력 ?? 0) + (abase?.mpBonus ?? 0)
  const totalMagicStat = mpStat + mpBonus
  const magicCoef = clamp(1 + (totalMagicStat - 15) * 0.10, 0.1, 3.0)
  // 마법공격력 = (atkBase + 무기 종합) × 마력계수
  const finalMagicAtk = (atkBase + weaponAtkCoef) * magicCoef

  // 행운 가산 (특성)
  const luck = luckStat + (weffects.행운 ?? 0) + (aeffects.행운 ?? 0)

  return {
    공격력: finalAtk,
    마법공격력: finalMagicAtk,
    마력계수: magicCoef,
    방어력_effective: defEff,
    속도: speedEff,
    체력: hpStat,
    마력: totalMagicStat,
    행운: luck,
    명중률: acc,
    회피율: eva,
    관통: pen,
    상태저항: stRes,

    weaponAtk: baseWeaponAtk,
    weaponSpeedCoef: wbase?.speedCoef ?? 1.0,
    weaponElement: wbase?.element,
    weaponMpBonus: wbase?.mpBonus ?? 0,
    weaponAccBonus: wbase?.accBonus ?? 0,
    isMagicWeapon: wbase?.isMagic ?? false,

    lifesteal: weffects.lifesteal ?? 0,
    damageTakenHealPct: aeffects.damage_taken_heal_pct ?? 0,
    damageReflectPct: aeffects.damage_reflect_pct ?? 0,
    selfDotPct: (weffects.self_dot_pct ?? 0) + (aeffects.self_dot_pct ?? 0),
    vsUndeadPct: weffects.vs_undead_pct ?? 0,

    burnChance: weffects.burn_chance ?? 0,
    slowChance: weffects.slow_chance ?? 0,
    shockChance: weffects.shock_chance ?? 0,
    bleedChance: weffects.bleed_chance ?? 0,
    blindChance: weffects.blind_chance ?? 0,
    poisonChance: weffects.poison_chance ?? 0,

    resists: {
      burn: aeffects.resist_burn ?? 0,
      slow: aeffects.resist_slow ?? 0,
      shock: aeffects.resist_shock ?? 0,
      bleed: aeffects.resist_bleed ?? 0,
      blind: aeffects.resist_blind ?? 0,
      poison: aeffects.resist_poison ?? 0,
    },
    reflects: {
      burn: aeffects.reflect_burn ?? 0,
      slow: aeffects.reflect_slow ?? 0,
      shock: aeffects.reflect_shock ?? 0,
      bleed: aeffects.reflect_bleed ?? 0,
      blind: aeffects.reflect_blind ?? 0,
      poison: aeffects.reflect_poison ?? 0,
    },
  }
}
