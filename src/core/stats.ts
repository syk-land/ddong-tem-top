import type { Character, TraitEffect, ArmorType } from '@/types'
import { getWeaponBase, getArmorBase } from './items'
import { WEAPON_TRAITS, ARMOR_TRAITS } from '@/data/traits'
import { clamp } from './rng'

// 통합 effective stats — 공격력/방어력/관통이 단일로 합쳐짐
export interface EffectiveStats {
  공격력: number              // 물리 (평타 + 물리 스킬)
  마법공격력: number          // 마법 스킬 전용 — (s.공격력 + weaponAtkCoef) × 마력계수
  마력계수: number            // 마력 15 = 1.0, 1pt당 ±0.07 (clamp 0.1~3.0)
  방어력_effective: number   // stat × 0.5 + armor_base × 2.0 × (1 + trait_pct)
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
  isMagicWeapon: boolean      // 마법 무기 (스킬 분기용)
  // 패시브
  lifesteal: number
  damageTakenHealPct: number
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

function addPct(stat: number, pct: number | undefined): number {
  return pct ? stat * (1 + pct) : stat
}

export function computeEffectiveStats(c: Character): EffectiveStats {
  const s = c.stats
  const weapon = c.weapon
  const armor = c.armor

  const wbase = weapon ? getWeaponBase(weapon.baseKey) : null
  const abase = armor ? getArmorBase(armor.baseKey as ArmorType) : null

  const weffects: TraitEffect = weapon?.effects ?? {}
  const aeffects: TraitEffect = armor?.effects ?? {}

  // 트레잇 % — 가산식 모델용 unscaled 값 lookup (공격력/방어력 공식 전용)
  //   공격력 / 방어력 계산: base × (coef + trait%_base)
  //   기타 효과 (명중/회피/lifesteal/status_chance 등): weffects/aeffects 의 coef-scaled 값 그대로 사용
  const wTraitDef = weapon ? WEAPON_TRAITS[weapon.trait] : null
  const aTraitDef = armor ? ARMOR_TRAITS[armor.trait] : null
  const atkPctBase = (wTraitDef?.effects.공격력_pct ?? 0) + (wTraitDef?.effects.전스탯_pct ?? 0)
  const defPctBase = (aTraitDef?.effects.방어력_pct ?? 0) + (aTraitDef?.effects.전스탯_pct ?? 0)
  const speedPct = (weffects.속도_pct ?? 0) + (aeffects.속도_pct ?? 0)

  const acc =
    s.명중률 +
    (weffects.명중 ?? 0) +
    (aeffects.명중 ?? 0) +
    (wbase?.accBonus ?? 0)
  const eva =
    s.회피율 +
    (weffects.회피 ?? 0) +
    (aeffects.회피 ?? 0) +
    (abase?.evasion ?? 0)

  const luck =
    s.행운 +
    (weffects.행운 ?? 0) +
    (aeffects.행운 ?? 0)

  const pen = s.관통 + (weffects.관통 ?? 0)
  const stRes = s.상태저항 + (weffects.상태저항 ?? 0) + (aeffects.상태저항 ?? 0)

  // 공격력 — v4 가산식 모델: 등급보너스(coef) + 특성보너스(unscaled trait%)
  //   실효 공격력 = stat 공격력 + stat 마력 + 무기 종합 공격계수
  //   무기 종합 공격계수 = baseAtk × (coef + 트레잇 공격력_pct_base)
  //   마법공격력 = 공격력 + mpBonus  (갑옷/트레잇 마력 보너스가 마법 스킬만 증폭)
  const baseWeaponAtk = wbase?.baseAtk ?? 0
  const weaponCoef = weapon?.coef ?? 0
  const weaponAtkCoef = baseWeaponAtk * (weaponCoef + atkPctBase)
  const finalAtk = s.공격력 + s.마력 + weaponAtkCoef

  // 방어력 — v4 가산식 모델: 등급보너스(coef) + 특성보너스(unscaled trait%)
  //   실효 방어력 = stat 방어력 × 2.0 + 갑옷 종합 방어계수
  //   갑옷 종합 방어계수 = baseDef × 2.0 × (coef + 트레잇 방어력_pct_base)
  const armorBaseDef = abase?.baseDef ?? 0
  const armorCoefVal = armor?.coef ?? 0
  const armorDefCoef = armorBaseDef * 2.0 * (armorCoefVal + defPctBase)
  const defEff = s.방어력 * 2.0 + armorDefCoef

  // 속도
  const armorSpeedMult = abase?.speedMult ?? 1.0
  const speedEff = s.속도 * (1 + speedPct) * armorSpeedMult

  // 마력 보너스 (갑옷 mpBonus + 갑옷 트레잇 마력 + 무기 트레잇 마력)
  //   원래 트레잇 _마력 값은 items.scaleEffects 에서 coef 곱해진 상태로 저장됨
  const mpBonus = (aeffects.마력 ?? 0) + (weffects.마력 ?? 0) + (abase?.mpBonus ?? 0)
  const totalMagicStat = s.마력 + mpBonus
  // 마력계수: 마력 15 = 1.0 (100%), 1pt당 ±0.07. 극단값 방지 위해 [0.1, 3.0] 클램프.
  const magicCoef = clamp(1 + (totalMagicStat - 15) * 0.07, 0.1, 3.0)
  // 마법공격력 — 마법 스킬 전용. (s.공격력 + weaponAtkCoef) × 마력계수.
  // s.마력 가산은 계수로 대체 — 마력이 강한 캐릭터일수록 계수가 1.0 초과로 커짐.
  const finalMagicAtk = (s.공격력 + weaponAtkCoef) * magicCoef

  return {
    공격력: finalAtk,
    마법공격력: finalMagicAtk,
    마력계수: magicCoef,
    방어력_effective: defEff,
    속도: speedEff,
    체력: s.체력,
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
