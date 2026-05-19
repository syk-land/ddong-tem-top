import type {
  ItemInstance, Grade, TraitTier, TraitEffect, TraitDef,
  ArmorType,
} from '@/types'
import { GRADE_COEF_RANGE, GRADE_PRICE_MULT, TRAIT_TIER_LEVEL, GRADE_LEVEL } from '@/types'
import { WEAPONS, WEAPON_KEYS } from '@/data/weapons'
import { ARMORS, ARMOR_KEYS } from '@/data/armor'
import { WEAPON_TRAITS, WEAPON_TRAIT_POOL, ARMOR_TRAITS, ARMOR_TRAIT_POOL } from '@/data/traits'
import { randFloat, pickOne, weightedChoice, clamp, uniqueId } from './rng'

// 16-tier 인덱스 — v3 등급 우선 공식
// tier = (grade_level - 1) × 4 + trait_level
//   하급-노말 1   보통-노말 2   희귀-노말 3   특별-노말 4
//   하급-레어 5   보통-레어 6   ...           특별-레어 8
//   하급-스페셜 9 ...                          특별-스페셜 12
//   하급-레전드 13                              특별-레전드 16
// → 등급이 주, 트레잇이 부 (특별-노말 ≈ 하급-레어 인접 tier로 매칭)
export function tierIndex(traitTier: TraitTier, grade: Grade): number {
  return (GRADE_LEVEL[grade] - 1) * 4 + TRAIT_TIER_LEVEL[traitTier]
}

export function tierToCombo(tier: number): { trait_tier: TraitTier; grade: Grade } {
  const t = clamp(tier, 1, 16)
  const gradeLevel = Math.floor((t - 1) / 4) + 1
  const traitLevel = ((t - 1) % 4) + 1
  const traitTiers: TraitTier[] = ['하급', '보통', '희귀', '특별']
  const grades: Grade[] = ['노말', '레어', '스페셜', '레전드']
  return {
    trait_tier: traitTiers[traitLevel - 1],
    grade: grades[gradeLevel - 1],
  }
}

// 4.7 드랍 분포 (소스별)
export type DropSource = 'shop' | 'monster' | 'boss' | 'treasure'

export function getTierDistribution(chapter: number, source: DropSource): Map<number, number> {
  const dist = new Map<number, number>()
  let entries: { tier: number; prob: number }[] = []

  if (source === 'shop' || source === 'monster') {
    entries = [
      { tier: chapter, prob: 0.60 },
      { tier: chapter + 1, prob: 0.30 },
      { tier: chapter + 2, prob: 0.10 },
    ]
  } else if (source === 'boss') {
    entries = [
      { tier: chapter + 1, prob: 0.50 },
      { tier: chapter + 2, prob: 0.35 },
      { tier: chapter + 3, prob: 0.10 },
      { tier: chapter + 4, prob: 0.04 },
      { tier: chapter + 5, prob: 0.01 },
    ]
  } else if (source === 'treasure') {
    const tiers: number[] = []
    for (let t = chapter - 5; t <= chapter + 6; t++) tiers.push(t)
    const p = 1.0 / tiers.length
    entries = tiers.map((t) => ({ tier: t, prob: p }))
  }

  // 클램프 후 확률 누적
  for (const e of entries) {
    const t = clamp(e.tier, 1, 16)
    dist.set(t, (dist.get(t) ?? 0) + e.prob)
  }
  return dist
}

// 트레잇 효과에 grade coef 스케일링
export function scaleEffects(base: TraitEffect, coef: number, traitDef?: TraitDef): TraitEffect {
  const scaled: TraitEffect = {}
  for (const key in base) {
    const k = key as keyof TraitEffect
    const val = base[k]
    if (val === undefined) continue
    // 저주의 자해는 grade coef 미적용
    if (traitDef?.fixed_self_dot && k === 'self_dot_pct') {
      scaled[k] = val
      continue
    }
    // 속도 % 트레잇은 grade coef 0.5~2.0 클램프
    if (k === '속도_pct') {
      const speedCoef = clamp(coef, 0.5, 2.0)
      scaled[k] = val * speedCoef
      continue
    }
    if (typeof val === 'number') {
      scaled[k] = val * coef
    }
  }
  return scaled
}

// 가격 계산 (4.6)
export function calculatePrices(traitDef: TraitDef, grade: Grade) {
  const basePrice = traitDef.price
  const sell = Math.round(basePrice * GRADE_PRICE_MULT[grade])
  return {
    sell,
    buy: Math.round(sell * 1.5),
    buyback: Math.round(sell * 0.4),
  }
}

// 아이템 1개 추첨
export interface RollOptions {
  kind: 'weapon' | 'armor'
  chapter?: number
  source?: DropSource
  forceTier?: number
  forceTraitTier?: TraitTier
  forceGrade?: Grade
  forceBaseKey?: string  // 특정 무기/갑옷 강제
  forceTraitName?: string
}

export function rollItem(opts: RollOptions): ItemInstance {
  let { kind, chapter = 1, source = 'shop' } = opts

  // 1) 베이스 (무기/갑옷 종류) 추첨
  let baseKey: string
  if (opts.forceBaseKey) {
    baseKey = opts.forceBaseKey
  } else if (kind === 'weapon') {
    baseKey = pickOne(WEAPON_KEYS)
  } else {
    baseKey = pickOne(ARMOR_KEYS)
  }

  // 2) 티어 추첨
  let tier: number
  if (opts.forceTier !== undefined) {
    tier = clamp(opts.forceTier, 1, 16)
  } else if (opts.forceTraitTier && opts.forceGrade) {
    tier = tierIndex(opts.forceTraitTier, opts.forceGrade)
  } else {
    const dist = getTierDistribution(chapter, source)
    const entries = Array.from(dist.entries()).map(([t, p]) => ({ value: t, weight: p }))
    tier = weightedChoice(entries)
  }

  // 6챕터 이전엔 스페셜/레전드 등급 차단 → 노말/레어만 등장
  //   tier % 4 == 1 → 노말 (유지)
  //   tier % 4 == 2 → 레어 (유지)
  //   tier % 4 == 3 → 스페셜 → -1 (레어로 다운)
  //   tier % 4 == 0 → 레전드 → -2 (레어로 다운)
  // forceTier/forceGrade로 명시 지정한 경우는 그대로 둠 (대장장이 업그레이드 등)
  if (
    chapter < 6 &&
    opts.forceTier === undefined &&
    opts.forceGrade === undefined
  ) {
    const mod = tier % 4
    if (mod === 3) tier -= 1
    else if (mod === 0) tier -= 2
  }

  const { trait_tier, grade } = tierToCombo(tier)

  // 3) 트레잇 추첨
  const traitPool = kind === 'weapon' ? WEAPON_TRAIT_POOL : ARMOR_TRAIT_POOL
  const traitDefs = kind === 'weapon' ? WEAPON_TRAITS : ARMOR_TRAITS
  let traitName: string
  if (opts.forceTraitName) {
    traitName = opts.forceTraitName
  } else {
    traitName = pickOne(traitPool[trait_tier])
  }
  const traitDef = traitDefs[traitName]
  if (!traitDef) {
    throw new Error(`Unknown ${kind} trait: ${traitName}`)
  }

  // 4) 등급 coef 굴림 (스탯에만 적용)
  const [lo, hi] = GRADE_COEF_RANGE[grade]
  const coef = randFloat(lo, hi)

  // 5) 효과 스케일링
  const effects = scaleEffects(traitDef.effects, coef, traitDef)

  // 6) 가격
  const { sell, buy, buyback } = calculatePrices(traitDef, grade)

  return {
    id: uniqueId(),
    kind,
    baseKey,
    trait: traitName,
    grade,
    coef: Math.round(coef * 100) / 100,
    tier,
    sellPrice: sell,
    buyPrice: buy,
    buyback,
    effects,
  }
}

// 표시용 이름 (예: "흡혈의 레전드 단검")
export function itemDisplayName(item: ItemInstance): string {
  const baseDisplay = item.baseKey.replace(/_/g, ' ')
  return `${item.trait} ${item.grade} ${baseDisplay}`
}

// 무기/갑옷 base 데이터 조회
export function getWeaponBase(key: string) { return WEAPONS[key] }
export function getArmorBase(key: ArmorType) { return ARMORS[key] }

// 트레잇 def 조회
export function getWeaponTraitDef(name: string): TraitDef | undefined { return WEAPON_TRAITS[name] }
export function getArmorTraitDef(name: string): TraitDef | undefined { return ARMOR_TRAITS[name] }
