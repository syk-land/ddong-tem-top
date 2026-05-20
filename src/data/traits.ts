import type { TraitDef, TraitTier } from '@/types'

// ====== 무기 특성 풀 ======
// v5 표준화:
//   하급 atk% = -0.5  (페널티)
//   보통 atk% =  0    (중립)
//   희귀 atk% = +0.5  (소량 보너스)
//   특별 atk% = +1.5  (큰 보너스)
// → 등급 coef(1/2/4/6)와 합쳐져 "특별 특성 ≈ 다음 등급 하급 특성" 격차 형성
// 부가 효과(흡혈 / burn / 명중 / 회피 등)는 특성 정체성으로 유지.
export const WEAPON_TRAITS: Record<string, TraitDef> = {
  // 하급 5종 (-0.5 페널티)
  낡은:   { name: '낡은',   tier: '하급', price: 10, effects: { 공격력_pct: -0.5 } },
  오래된: { name: '오래된', tier: '하급', price: 12, effects: { 공격력_pct: -0.5, 명중: -3 } },
  고장난: { name: '고장난', tier: '하급', price: 8,  effects: { 공격력_pct: -0.5, 명중: -5 } },
  녹슨:   { name: '녹슨',   tier: '하급', price: 10, effects: { 공격력_pct: -0.5, 회피: -3 } },
  부서진: { name: '부서진', tier: '하급', price: 9,  effects: { 공격력_pct: -0.5 } },

  // 보통 5종 (0 중립 — 부가 효과로 차별화)
  날카로운:   { name: '날카로운',   tier: '보통', price: 50, effects: { 공격력_pct: 0, 명중: 5 } },
  무거운:     { name: '무거운',     tier: '보통', price: 55, effects: { 공격력_pct: 0, 속도_pct: -0.1 } },
  가벼운:     { name: '가벼운',     tier: '보통', price: 50, effects: { 공격력_pct: 0, 속도_pct: 0.1 } },
  균형잡힌:   { name: '균형잡힌',   tier: '보통', price: 60, effects: { 전스탯_pct: 0 } },
  단단한:     { name: '단단한',     tier: '보통', price: 45, effects: { 공격력_pct: 0, 방어력_pct: 0.2 } },

  // 희귀 5종 (+0.5 보너스)
  뛰어난:     { name: '뛰어난',     tier: '희귀', price: 100, effects: { 공격력_pct: 0.5, 방어력_pct: 0.2 } },
  최고의:     { name: '최고의',     tier: '희귀', price: 130, effects: { 전스탯_pct: 0.5 } },
  굉장한:     { name: '굉장한',     tier: '희귀', price: 110, effects: { 공격력_pct: 0.5 } },
  위대한:     { name: '위대한',     tier: '희귀', price: 120, effects: { 공격력_pct: 0.5, 명중: 5 } },
  마스터의:   { name: '마스터의',   tier: '희귀', price: 140, effects: { 전스탯_pct: 0.5, 관통: 5 } },

  // 특별 12종 (+1.5 큰 보너스 + 부가 효과)
  흡혈의:     { name: '흡혈의',     tier: '특별', price: 200, effects: { 공격력_pct: 0.5, lifesteal: 0.25 } },
  저주의:     { name: '저주의',     tier: '특별', price: 220, effects: { 공격력_pct: 0.5, self_dot_pct: 0.05 }, fixed_self_dot: true },
  신성한:     { name: '신성한',     tier: '특별', price: 190, effects: { 공격력_pct: 0.5, vs_undead_pct: 0.50 } },
  폭풍의:     { name: '폭풍의',     tier: '특별', price: 210, effects: { 공격력_pct: 0.5, 속도_pct: 0.15 } },
  화염의:     { name: '화염의',     tier: '특별', price: 200, effects: { 공격력_pct: 0.5, burn_chance: 0.30 } },
  빙결의:     { name: '빙결의',     tier: '특별', price: 200, effects: { 공격력_pct: 0.5, slow_chance: 0.30 } },
  행운의:     { name: '행운의',     tier: '특별', price: 200, effects: { 공격력_pct: 0.5, 행운: 5 } },
  마비의:     { name: '마비의',     tier: '특별', price: 200, effects: { 공격력_pct: 0.5, shock_chance: 0.25 } },
  출혈의:     { name: '출혈의',     tier: '특별', price: 200, effects: { 공격력_pct: 0.5, bleed_chance: 0.25 } },
  어둠의:     { name: '어둠의',     tier: '특별', price: 200, effects: { 공격력_pct: 0.5, blind_chance: 0.25 } },
  부식의:     { name: '부식의',     tier: '특별', price: 200, effects: { 공격력_pct: 0.5, poison_chance: 0.25 } },
  진귀한:     { name: '진귀한',     tier: '특별', price: 200, effects: { 공격력_pct: 0.5 } },
}

// ====== 갑옷 특성 풀 ======
// v5 표준화: 하급 -0.5 / 보통 0 / 희귀 +0.5 / 특별 +1.5 (def_pct 기준)
export const ARMOR_TRAITS: Record<string, TraitDef> = {
  // 하급 4종 (-0.5)
  낡은:   { name: '낡은',   tier: '하급', price: 10, effects: { 방어력_pct: -0.5 } },
  녹슨:   { name: '녹슨',   tier: '하급', price: 10, effects: { 방어력_pct: -0.5, 회피: -5 } },
  부서진: { name: '부서진', tier: '하급', price: 9,  effects: { 방어력_pct: -0.5 } },
  해진:   { name: '해진',   tier: '하급', price: 8,  effects: { 방어력_pct: -0.5 } },

  // 보통 5종 (0)
  단단한: { name: '단단한', tier: '보통', price: 50, effects: { 방어력_pct: 0.15 } },
  두꺼운: { name: '두꺼운', tier: '보통', price: 55, effects: { 방어력_pct: 0, 속도_pct: -0.05 } },
  매끈한: { name: '매끈한', tier: '보통', price: 50, effects: { 방어력_pct: 0, 회피: 8 } },
  가벼운: { name: '가벼운', tier: '보통', price: 55, effects: { 방어력_pct: 0, 속도_pct: 0.08 } },
  정밀한: { name: '정밀한', tier: '보통', price: 45, effects: { 방어력_pct: 0, 명중: 8 } },

  // 희귀 5종 (+0.5)
  정교한:   { name: '정교한',   tier: '희귀', price: 100, effects: { 방어력_pct: 0.5 } },
  빛나는:   { name: '빛나는',   tier: '희귀', price: 130, effects: { 방어력_pct: 0.5, 마력: 10 } },
  비범한:   { name: '비범한',   tier: '희귀', price: 120, effects: { 방어력_pct: 0.5, 회피: 10 } },
  위대한:   { name: '위대한',   tier: '희귀', price: 110, effects: { 방어력_pct: 0.5, 명중: 5 } },
  마스터의: { name: '마스터의', tier: '희귀', price: 140, effects: { 전스탯_pct: 0.5, 상태저항: 3 } },

  // 특별 10종 (+1.5 + 부가 효과)
  흡혈의:       { name: '흡혈의',       tier: '특별', price: 200, effects: { 방어력_pct: 0.5, damage_taken_heal_pct: 0.05 } },
  저주의:       { name: '저주의',       tier: '특별', price: 220, effects: { 방어력_pct: 0.5, self_dot_pct: 0.03 }, fixed_self_dot: true },
  신성한:       { name: '신성한',       tier: '특별', price: 190, effects: { 방어력_pct: 0.5, 상태저항: 5 } },
  화염저항의:   { name: '화염저항의',   tier: '특별', price: 200, effects: { 방어력_pct: 0.5, resist_burn: 0.50, reflect_burn: 0.25 } },
  빙결저항의:   { name: '빙결저항의',   tier: '특별', price: 200, effects: { 방어력_pct: 0.5, resist_slow: 0.50, reflect_slow: 0.25 } },
  마비저항의:   { name: '마비저항의',   tier: '특별', price: 200, effects: { 방어력_pct: 0.5, resist_shock: 0.50, reflect_shock: 0.25 } },
  출혈저항의:   { name: '출혈저항의',   tier: '특별', price: 200, effects: { 방어력_pct: 0.5, resist_bleed: 0.50, reflect_bleed: 0.25 } },
  어둠저항의:   { name: '어둠저항의',   tier: '특별', price: 200, effects: { 방어력_pct: 0.5, resist_blind: 0.50, reflect_blind: 0.25 } },
  부식저항의:   { name: '부식저항의',   tier: '특별', price: 200, effects: { 방어력_pct: 0.5, resist_poison: 0.50, reflect_poison: 0.25 } },
  행운의:       { name: '행운의',       tier: '특별', price: 200, effects: { 방어력_pct: 0.5, 행운: 5 } },
  진귀한:       { name: '진귀한',       tier: '특별', price: 200, effects: { 방어력_pct: 0.5 } },
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
