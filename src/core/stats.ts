import type { Character, TraitEffect, ArmorType } from '@/types'
import { getWeaponBase, getArmorBase } from './items'

// 통합 effective stats — 공격력/방어력/관통이 단일로 합쳐짐
export interface EffectiveStats {
  공격력: number
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

  // 트레잇 % 합산
  const atkPct = (weffects.공격력_pct ?? 0) + (weffects.전스탯_pct ?? 0)
  const defPct = (aeffects.방어력_pct ?? 0) + (aeffects.전스탯_pct ?? 0)
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

  // 공격력 — 가산식 (stat은 trait %에 영향 받지 않음)
  //   실효 공격력 = stat 공격력 + stat 마력 + 무기 종합 공격계수
  //   무기 종합 공격계수 = baseAtk × (1 + 트레잇 공격력_pct)
  const baseWeaponAtk = wbase?.baseAtk ?? 0
  const weaponAtkCoef = baseWeaponAtk * (1 + atkPct)
  const finalAtk = s.공격력 + s.마력 + weaponAtkCoef

  // 방어력 — 가산식 (stat은 trait %에 영향 받지 않음)
  //   실효 방어력 = stat 방어력 × 2.0 + 갑옷 종합 방어계수
  //   갑옷 종합 방어계수 = baseDef × 2.0 × (1 + 트레잇 방어력_pct)
  const armorBaseDef = abase?.baseDef ?? 0
  const armorDefCoef = armorBaseDef * 2.0 * (1 + defPct)
  const defEff = s.방어력 * 2.0 + armorDefCoef

  // 속도
  const armorSpeedMult = abase?.speedMult ?? 1.0
  const speedEff = s.속도 * (1 + speedPct) * armorSpeedMult

  // 마력 보너스
  const mpBonus = (aeffects.마력 ?? 0) + (abase?.mpBonus ?? 0)

  return {
    공격력: finalAtk,
    방어력_effective: defEff,
    속도: speedEff,
    체력: s.체력,
    마력: s.마력 + mpBonus,
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
