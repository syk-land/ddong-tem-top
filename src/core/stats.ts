import type { Character, TraitEffect, ArmorType } from '@/types'
import { getWeaponBase, getArmorBase } from './items'
import { WEAPON_TRAITS, ARMOR_TRAITS } from '@/data/traits'
import { clamp } from './rng'
import { getPlayerSynergy, getTemperMult, hasRelic } from './junkSynergy'

// v9 곱셈 모델 + 명중/회피 %p + 방어 % + 게이지 시스템
//   공격 게이지: 매 틱 += 1 × (1 + 민첩/100) × armorSpeedMult, 임계값 = 무기 ticks
//   명중률 (성공률) = clamp((acc − eva) / 100, 0, 1.0)
//   acc/eva: 베이스(60/5) + 무기 + 트레잇 + 민첩×0.5 + 행운×0.1
//   크리 확률 = 민첩 × 0.003 (cap 100%)
//   크리 배수 = 1.3 + 행운/100
//
//   공격력 (물리) = 힘 × baseAtk × coef × (1 + trait_atk_pct)
//   공격력 (마법) = 마력 × baseAtk × coef × (1 + trait_atk_pct)
//   방어%        = baseDef × coef × (1 + trait_def_pct) + 체력 × 0.3 × coef
//   데미지       = max(1, atk × (1 − 실효방어%))
//   관통         = 적 방어% 절대값 차감 (%p)
//
// 5스탯 역할:
//   힘    → 물리 공격력 × baseAtk × coef × (1+atk_pct)
//   민첩  → 게이지 가속(+%), 명중/회피, 크리 확률
//   체력  → HP(× 10 + 50), 방어%(+0.3% per pt)
//   마력  → MP(× 15 + 30), 마법 공격력
//   행운  → 명중/회피, 크리 데미지 배수(+1%/pt)
export interface EffectiveStats {
  공격력: number              // 물리 atk
  마법공격력: number          // 마법 atk (isMagic 무기일 때)
  방어력_effective: number    // v9: % 단위 (0~100+)
  속도: number                // (deprecated) — 게이지가속 사용
  게이지가속: number          // 1 + 민첩/100
  armorSpeedMult: number      // 갑옷 속도 보정 (게이지에 곱)
  무기ticks: number           // 게이지 임계값
  체력: number
  민첩: number
  마력: number
  행운: number
  명중률: number              // %p (성공률 계산에 사용)
  회피율: number              // %p
  관통: number                // %p (방어% 직접 차감)
  상태저항: number
  크리확률: number            // 0~1.0
  크리배수: number            // 1.3 + 행운/100
  // 무기 정보 (UI/시뮬용)
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
  const atkPct = (wTraitDef?.effects.공격력_pct ?? 0) + (wTraitDef?.effects.전스탯_pct ?? 0)
  const defPct = (aTraitDef?.effects.방어력_pct ?? 0) + (aTraitDef?.effects.전스탯_pct ?? 0)
  const speedPct = (weffects.속도_pct ?? 0) + (aeffects.속도_pct ?? 0)

  // ── 공격력 (곱셈 모델): stat × baseAtk × coef × (1 + atk_pct) × ATK_K ──
  //   ATK_K: 균등 빌드(노말+보통)에서도 atk이 적 HP에 의미 있는 비율 갖도록 보정
  //   마법은 스킬 multiplier (4~7) 가 추가로 곱해지므로 ATK_K 작게
  //   로브 + 마법무기 시너지: 마법 atk ×1.5 (마법 빌드 = 마법무기+로브 강제)
  //   활(ranged) 무기: 물리 atk 의 스탯 항을 (힘 + 민첩 × 0.3) 로 적용 — 민첩 빌드 활용
  const ATK_K_PHYS = 3.0
  const ATK_K_MAGIC = 1.5
  const hasAnvil = hasRelic(c, 'cursed_anvil_shard')
  const syn = getPlayerSynergy(c)
  const baseAtk = wbase?.baseAtk ?? 0
  const weaponCoef = (weapon?.coef ?? 0) * getTemperMult(weapon, hasAnvil)
  const atkMultBase = baseAtk * weaponCoef * (1 + atkPct)
  const magicSynergy = (abase?.key === '로브' && wbase?.isMagic) ? 1.5 : 1.0
  const physStat = wbase?.category === 'ranged' ? s.힘 + s.민첩 * 0.3 : s.힘
  let finalAtk = physStat * atkMultBase * ATK_K_PHYS
  let finalMagicAtk = wbase?.isMagic ? s.마력 * atkMultBase * ATK_K_MAGIC * magicSynergy : 0

  // ── 방어% (곱셈 모델): baseDef × coef × (1 + def_pct) + 체력 × 0.3 × coef ──
  // v9.x: 체력 방어 기여에도 갑옷 coef 곱 적용 (좋은 갑옷일수록 같은 체력이 더 큰 방어로)
  const armorBaseDef = abase?.baseDef ?? 0
  const armorCoefVal = (armor?.coef ?? 0) * getTemperMult(armor, hasAnvil)
  const armorDefPct = armorBaseDef * armorCoefVal * (1 + defPct)
  let defEffPct = armorDefPct + s.체력 * 0.3 * armorCoefVal

  // v12 공명·유물 보정: 부식 장인 / 거지의 밥그릇
  if (syn.hasCursedArtisan) {
    finalAtk *= 1.12
    finalMagicAtk *= 1.12
    defEffPct *= 1.12
  }
  if (hasRelic(c, 'beggar_bowl')) {
    const tierSum = (weapon?.tier ?? 1) + (armor?.tier ?? 1)
    if (tierSum <= 10) {
      finalAtk *= 1.15
      finalMagicAtk *= 1.15
      defEffPct *= 1.12
    }
  }

  // ── 게이지 가속 & 갑옷 속도 ──
  let armorSpeedMult = abase?.speedMult ?? 1.0
  // v6 합기: 로브 + 마법 무기 조합 → 추가 속도 부스트
  if (abase?.key === '로브' && wbase?.isMagic) armorSpeedMult *= 1.15
  const gaugeMult = (1 + s.민첩 / 100) * (1 + speedPct)
  const weaponTicks = wbase ? Math.round(10 / wbase.speedCoef) : 10

  // ── 명중/회피 (%p) — 베이스 + 무기 + 트레잇 + 민첩×0.5 + 행운×0.1 ──
  const ACC_BASE = 60
  const EVA_BASE = 5
  const acc = ACC_BASE
    + (wbase?.accBonus ?? 0)
    + (weffects.명중 ?? 0)
    + (aeffects.명중 ?? 0)
    + s.민첩 * 0.5
    + s.행운 * 0.1
  const eva = EVA_BASE
    + (wbase?.evaBonus ?? 0)
    + (weffects.회피 ?? 0)
    + (aeffects.회피 ?? 0)
    + (abase?.evasion ?? 0)
    + (hasRelic(c, 'tattered_cloak') ? 10 : 0)
    + s.민첩 * 0.5
    + s.행운 * 0.1

  // 관통 (%p) — 무기 penBonus + magicPenBonus + 트레잇 + 유물/공명
  const pen = (weffects.관통 ?? 0)
    + (wbase?.penBonus ?? 0)
    + (wbase?.magicPenBonus ?? 0)
    + (hasAnvil ? 12 : 0)
    + (syn.hasArcaneJunk ? 20 : 0)

  // 상태저항 — 체력/마력/행운 + 특성
  const stRes = s.체력 * 0.5 + s.마력 * 0.5 + s.행운 * 0.3
    + (weffects.상태저항 ?? 0)
    + (aeffects.상태저항 ?? 0)

  // 마력/행운 가산 (특성 + 납 주사위)
  const mpBonus = (aeffects.마력 ?? 0) + (weffects.마력 ?? 0) + (abase?.mpBonus ?? 0)
  const totalMagicStat = s.마력 + mpBonus
  const luck = s.행운 + (weffects.행운 ?? 0) + (aeffects.행운 ?? 0) + (hasRelic(c, 'lead_dice') ? 8 : 0)

  // 크리
  const critChance = clamp(s.민첩 * 0.003, 0, 1.0)
  const critMult = 1.3 + luck / 100

  return {
    공격력: finalAtk,
    마법공격력: finalMagicAtk,
    방어력_effective: defEffPct,
    속도: gaugeMult * armorSpeedMult,        // (deprecated) — combat 은 게이지가속 + armorSpeedMult 사용
    게이지가속: gaugeMult,
    armorSpeedMult,
    무기ticks: weaponTicks,
    체력: s.체력,
    민첩: s.민첩,
    마력: totalMagicStat,
    행운: luck,
    명중률: acc,
    회피율: eva,
    관통: pen,
    상태저항: stRes,
    크리확률: critChance,
    크리배수: critMult,

    weaponAtk: baseAtk,
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
