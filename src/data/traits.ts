import type { TraitDef, TraitTier } from '@/types'

// ====== 무기 트레잇 풀 (27종) — v3 단계 차이 축소 ======
// 트레잇 단계는 부수 영향, 등급이 주 가치.
// % 차이 약화: 하급 -8% / 보통 0% / 희귀 +8% / 특별 +12~15% (부가 효과로 차별화)
export const WEAPON_TRAITS: Record<string, TraitDef> = {
  // 하급 5종 (페널티 약화)
  낡은:   { name: '낡은',   tier: '하급', price: 10, effects: { 공격력_pct: -0.08 } },
  오래된: { name: '오래된', tier: '하급', price: 12, effects: { 공격력_pct: -0.05, 명중: -3 } },
  고장난: { name: '고장난', tier: '하급', price: 8,  effects: { 공격력_pct: -0.10, 명중: -3 } },
  녹슨:   { name: '녹슨',   tier: '하급', price: 10, effects: { 명중: -8 } },
  부서진: { name: '부서진', tier: '하급', price: 9,  effects: { 공격력_pct: -0.08 } },

  // 보통 5종 (작은 +)
  날카로운:   { name: '날카로운',   tier: '보통', price: 50, effects: {} },
  무거운:     { name: '무거운',     tier: '보통', price: 55, effects: { 공격력_pct: 0.08, 속도_pct: -0.08 } },
  가벼운:     { name: '가벼운',     tier: '보통', price: 50, effects: { 속도_pct: 0.08 } },
  균형잡힌:   { name: '균형잡힌',   tier: '보통', price: 60, effects: { 공격력_pct: 0.03, 방어력_pct: 0.03, 속도_pct: 0.03 } },
  단단한:     { name: '단단한',     tier: '보통', price: 45, effects: { 방어력_pct: 0.10 } },

  // 희귀 5종 (적당한 +)
  뛰어난:     { name: '뛰어난',     tier: '희귀', price: 100, effects: { 공격력_pct: 0.08, 방어력_pct: 0.05 } },
  최고의:     { name: '최고의',     tier: '희귀', price: 130, effects: { 전스탯_pct: 0.05 } },
  굉장한:     { name: '굉장한',     tier: '희귀', price: 110, effects: { 공격력_pct: 0.12 } },
  위대한:     { name: '위대한',     tier: '희귀', price: 120, effects: { 공격력_pct: 0.15 } },
  마스터의:   { name: '마스터의',   tier: '희귀', price: 140, effects: { 전스탯_pct: 0.08, 관통: 5 } },

  // 특별 12종 (% 효과 약화 + 부가 효과는 그대로 — 특별 트레잇만의 매력)
  흡혈의:     { name: '흡혈의',     tier: '특별', price: 200, effects: { 공격력_pct: 0.08, lifesteal: 0.25 } },
  저주의:     { name: '저주의',     tier: '특별', price: 220, effects: { 공격력_pct: 0.25, self_dot_pct: 0.05 }, fixed_self_dot: true },
  신성한:     { name: '신성한',     tier: '특별', price: 190, effects: { 공격력_pct: 0.10, vs_undead_pct: 0.50 } },
  폭풍의:     { name: '폭풍의',     tier: '특별', price: 210, effects: { 속도_pct: 0.15, 공격력_pct: 0.08 } },
  화염의:     { name: '화염의',     tier: '특별', price: 200, effects: { 공격력_pct: 0.08, burn_chance: 0.30 } },
  빙결의:     { name: '빙결의',     tier: '특별', price: 200, effects: { 공격력_pct: 0.08, slow_chance: 0.30 } },
  행운의:     { name: '행운의',     tier: '특별', price: 200, effects: { 행운: 5, 공격력_pct: 0.05 } },
  마비의:     { name: '마비의',     tier: '특별', price: 200, effects: { 공격력_pct: 0.08, shock_chance: 0.25 } },
  출혈의:     { name: '출혈의',     tier: '특별', price: 200, effects: { 공격력_pct: 0.08, bleed_chance: 0.25 } },
  어둠의:     { name: '어둠의',     tier: '특별', price: 200, effects: { 공격력_pct: 0.08, blind_chance: 0.25 } },
  부식의:     { name: '부식의',     tier: '특별', price: 200, effects: { 공격력_pct: 0.08, poison_chance: 0.25 } },
  진귀한:     { name: '진귀한',     tier: '특별', price: 200, effects: {} },
}

// ====== 갑옷 트레잇 풀 (24종) — v3 단계 차이 축소 ======
export const ARMOR_TRAITS: Record<string, TraitDef> = {
  // 하급 4종
  낡은:   { name: '낡은',   tier: '하급', price: 10, effects: { 방어력_pct: -0.08 } },
  녹슨:   { name: '녹슨',   tier: '하급', price: 10, effects: { 방어력_pct: -0.08, 회피: -5 } },
  부서진: { name: '부서진', tier: '하급', price: 9,  effects: { 방어력_pct: -0.10 } },
  해진:   { name: '해진',   tier: '하급', price: 8,  effects: { 방어력_pct: -0.08 } },

  // 보통 5종
  단단한: { name: '단단한', tier: '보통', price: 50, effects: { 방어력_pct: 0.08 } },
  두꺼운: { name: '두꺼운', tier: '보통', price: 55, effects: { 방어력_pct: 0.10 } },
  매끈한: { name: '매끈한', tier: '보통', price: 50, effects: { 회피: 8, 속도_pct: -0.03 } },
  가벼운: { name: '가벼운', tier: '보통', price: 55, effects: { 속도_pct: 0.08 } },
  정밀한: { name: '정밀한', tier: '보통', price: 45, effects: { 명중: 8 } },

  // 희귀 5종
  정교한:   { name: '정교한',   tier: '희귀', price: 100, effects: { 방어력_pct: 0.12 } },
  빛나는:   { name: '빛나는',   tier: '희귀', price: 130, effects: { 마력: 10, 방어력_pct: 0.05 } },
  비범한:   { name: '비범한',   tier: '희귀', price: 120, effects: { 방어력_pct: 0.10, 회피: 10 } },
  위대한:   { name: '위대한',   tier: '희귀', price: 110, effects: { 방어력_pct: 0.15 } },
  마스터의: { name: '마스터의', tier: '희귀', price: 140, effects: { 전스탯_pct: 0.08, 상태저항: 3 } },

  // 특별 10종 (% 약화, 부가 효과는 보존)
  흡혈의:       { name: '흡혈의',       tier: '특별', price: 200, effects: { damage_taken_heal_pct: 0.05 } },
  저주의:       { name: '저주의',       tier: '특별', price: 220, effects: { 방어력_pct: 0.30, self_dot_pct: 0.03 }, fixed_self_dot: true },
  신성한:       { name: '신성한',       tier: '특별', price: 190, effects: { 방어력_pct: 0.10, 상태저항: 5 } },
  화염저항의:   { name: '화염저항의',   tier: '특별', price: 200, effects: { resist_burn: 0.50, reflect_burn: 0.25 } },
  빙결저항의:   { name: '빙결저항의',   tier: '특별', price: 200, effects: { resist_slow: 0.50, reflect_slow: 0.25 } },
  마비저항의:   { name: '마비저항의',   tier: '특별', price: 200, effects: { resist_shock: 0.50, reflect_shock: 0.25 } },
  출혈저항의:   { name: '출혈저항의',   tier: '특별', price: 200, effects: { resist_bleed: 0.50, reflect_bleed: 0.25 } },
  어둠저항의:   { name: '어둠저항의',   tier: '특별', price: 200, effects: { resist_blind: 0.50, reflect_blind: 0.25 } },
  부식저항의:   { name: '부식저항의',   tier: '특별', price: 200, effects: { resist_poison: 0.50, reflect_poison: 0.25 } },
  행운의:       { name: '행운의',       tier: '특별', price: 200, effects: { 행운: 5 } },
  진귀한:       { name: '진귀한',       tier: '특별', price: 200, effects: {} },
}

// 트레잇 풀 (티어별)
function buildPool(traits: Record<string, TraitDef>): Record<TraitTier, string[]> {
  const pool: Record<TraitTier, string[]> = { 하급: [], 보통: [], 희귀: [], 특별: [] }
  for (const key in traits) {
    pool[traits[key].tier].push(key)
  }
  return pool
}

export const WEAPON_TRAIT_POOL = buildPool(WEAPON_TRAITS)
export const ARMOR_TRAIT_POOL = buildPool(ARMOR_TRAITS)
