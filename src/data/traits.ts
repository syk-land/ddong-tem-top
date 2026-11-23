import type { TraitDef, TraitTier } from '@/types'

// ====== 무기 특성 풀 ======
// v8 정리:
//   하급 atk% = -0.5  (페널티 + 부가 페널티)
//   보통 atk% =  0    (중립 — 부가 효과로 차별화)
//   희귀 atk% = +0.5  (보너스 + 부가 효과)
//   특별 atk% = +0.5  (보너스 + 시그니처 부가 효과)
// → 등급 coef(1/2/4/6)와 합쳐져 차등 형성
// 부가 효과 없는 특성 제거. 상태이상 시리즈는 "원소의" 1종으로 통합.
export const WEAPON_TRAITS: Record<string, TraitDef> = {
  // 하급 (3종) — atk -50% + 부가 페널티 + 숨은 허점(Loophole) 기믹
  오래된: { name: '오래된', tier: '하급', price: 12, effects: { 공격력_pct: -0.5, 명중: -5 }, quirk: 'old_weapon' },
  녹슨:   { name: '녹슨',   tier: '하급', price: 10, effects: { 공격력_pct: -0.5, 회피: -5 }, quirk: 'rust_weapon' },
  무거운: { name: '무거운', tier: '하급', price: 10, effects: { 공격력_pct: -0.5, 속도_pct: -0.10 }, quirk: 'heavy_weapon' },

  // 보통 (3종) — atk 중립
  날카로운: { name: '날카로운', tier: '보통', price: 50, effects: { 공격력_pct: 0, 명중: 5 } },
  가벼운:   { name: '가벼운',   tier: '보통', price: 50, effects: { 공격력_pct: 0, 속도_pct: 0.10 } },
  단단한:   { name: '단단한',   tier: '보통', price: 50, effects: { 공격력_pct: 0, 방어력_pct: 0.20 } },

  // 희귀 (3종) — atk +50%
  뛰어난:   { name: '뛰어난',   tier: '희귀', price: 100, effects: { 공격력_pct: 0.5, 방어력_pct: 0.20 } },
  위대한:   { name: '위대한',   tier: '희귀', price: 120, effects: { 공격력_pct: 0.5, 명중: 5 } },
  마스터의: { name: '마스터의', tier: '희귀', price: 140, effects: { 공격력_pct: 0.5, 관통: 5 } },

  // 특별 (5종) — atk +50% + 시그니처 효과
  흡혈의: { name: '흡혈의', tier: '특별', price: 200, effects: { 공격력_pct: 0.5, lifesteal: 0.25 } },
  폭풍의: { name: '폭풍의', tier: '특별', price: 210, effects: { 공격력_pct: 0.5, 속도_pct: 0.20 } },
  신성한: { name: '신성한', tier: '특별', price: 190, effects: { 공격력_pct: 0.5, vs_undead_pct: 0.50 } },
  행운의: { name: '행운의', tier: '특별', price: 200, effects: { 공격력_pct: 0.5, 행운: 10 } },
  // 원소의: 6종 상태이상 클론 통합 — 각 5% 독립 발동 (전체 any-status ≈ 26%)
  원소의: { name: '원소의', tier: '특별', price: 220, effects: {
    공격력_pct: 0.5,
    burn_chance: 0.05, slow_chance: 0.05, shock_chance: 0.05,
    bleed_chance: 0.05, blind_chance: 0.05, poison_chance: 0.05,
  } },
}

// ====== 갑옷 특성 풀 ======
// v8 정리:
//   하급 def_pct = -0.5 + 부가 페널티
//   보통 def_pct = 0 또는 약간 + (부가 효과)
//   희귀 def_pct = +0.5 + 부가 효과
//   특별 def_pct = +0.5 + 시그니처 효과
// 부가효과 없는 특성 제거. 상태저항 시리즈 6종 → "원소저항의" 1종 통합 (반사 X, 저항만).
export const ARMOR_TRAITS: Record<string, TraitDef> = {
  // 하급 (3종) — def -50% + 추가 페널티 + 숨은 허점(Loophole) 기믹
  녹슨:   { name: '녹슨',   tier: '하급', price: 10, effects: { 방어력_pct: -0.5, 회피: -5 }, quirk: 'rust_armor' },
  무거운: { name: '무거운', tier: '하급', price: 10, effects: { 방어력_pct: -0.5, 속도_pct: -0.05 }, quirk: 'heavy_armor' },
  부서진: { name: '부서진', tier: '하급', price: 9,  effects: { 방어력_pct: -0.55 }, quirk: 'broken_armor' },  // 추가 방어 -5% (총 -55%)

  // 보통 (4종) — def 중립
  단단한: { name: '단단한', tier: '보통', price: 50, effects: { 방어력_pct: 0.15 } },
  매끈한: { name: '매끈한', tier: '보통', price: 50, effects: { 방어력_pct: 0, 회피: 8 } },
  가벼운: { name: '가벼운', tier: '보통', price: 55, effects: { 방어력_pct: 0, 속도_pct: 0.08 } },
  정밀한: { name: '정밀한', tier: '보통', price: 45, effects: { 방어력_pct: 0, 명중: 8 } },

  // 희귀 (4종) — def +50% + 부가 효과
  빛나는:   { name: '빛나는',   tier: '희귀', price: 130, effects: { 방어력_pct: 0.5, 마력: 10 } },
  비범한:   { name: '비범한',   tier: '희귀', price: 120, effects: { 방어력_pct: 0.5, 회피: 10 } },
  위대한:   { name: '위대한',   tier: '희귀', price: 110, effects: { 방어력_pct: 0.5, 명중: 5 } },
  마스터의: { name: '마스터의', tier: '희귀', price: 140, effects: { 방어력_pct: 0.5, 상태저항: 3 } },

  // 특별 (4종) — def +50% + 시그니처 효과
  반짝거리는: { name: '반짝거리는', tier: '특별', price: 220, effects: { 방어력_pct: 0.5, damage_reflect_pct: 0.10 } },
  신성한:     { name: '신성한',     tier: '특별', price: 190, effects: { 방어력_pct: 0.5, 상태저항: 5 } },
  행운의:     { name: '행운의',     tier: '특별', price: 200, effects: { 방어력_pct: 0.5, 행운: 10 } },
  // 원소저항의: 6종 저항 클론 통합 — 반사는 제거하고 저항만 (30% 각)
  원소저항의: { name: '원소저항의', tier: '특별', price: 230, effects: {
    방어력_pct: 0.5,
    resist_burn: 0.30, resist_slow: 0.30, resist_shock: 0.30,
    resist_bleed: 0.30, resist_blind: 0.30, resist_poison: 0.30,
  } },
}

// 특성 풀 (티어별)
function buildPool(traits: Record<string, TraitDef>): Record<TraitTier, string[]> {
  const pool: Record<TraitTier, string[]> = { 하급: [], 보통: [], 희귀: [], 특별: [] }
  for (const key in traits) {
    pool[traits[key].tier].push(key)
  }
  return pool
}

export const WEAPON_TRAIT_POOL = buildPool(WEAPON_TRAITS)
export const ARMOR_TRAIT_POOL = buildPool(ARMOR_TRAITS)
