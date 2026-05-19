import type { TraitDef, TraitTier } from '@/types'

// ====== 무기 트레잇 풀 (27종) — 공격력/방어력/관통 통합 ======
export const WEAPON_TRAITS: Record<string, TraitDef> = {
  // 하급 5종
  낡은:   { name: '낡은',   tier: '하급', price: 10, effects: { 공격력_pct: -0.10 } },
  오래된: { name: '오래된', tier: '하급', price: 12, effects: { 공격력_pct: -0.08, 명중: -5 } },
  고장난: { name: '고장난', tier: '하급', price: 8,  effects: { 공격력_pct: -0.15, 명중: -5 } },
  녹슨:   { name: '녹슨',   tier: '하급', price: 10, effects: { 명중: -10 } },
  부서진: { name: '부서진', tier: '하급', price: 9,  effects: { 공격력_pct: -0.12 } },

  // 보통 5종
  날카로운:   { name: '날카로운',   tier: '보통', price: 50, effects: { 공격력_pct: 0.10 } },
  무거운:     { name: '무거운',     tier: '보통', price: 55, effects: { 공격력_pct: 0.15, 속도_pct: -0.10 } },
  가벼운:     { name: '가벼운',     tier: '보통', price: 50, effects: { 속도_pct: 0.15, 공격력_pct: -0.05 } },
  균형잡힌:   { name: '균형잡힌',   tier: '보통', price: 60, effects: { 공격력_pct: 0.05, 방어력_pct: 0.05, 속도_pct: 0.05 } },
  단단한:     { name: '단단한',     tier: '보통', price: 45, effects: { 방어력_pct: 0.20 } },

  // 희귀 5종
  뛰어난:     { name: '뛰어난',     tier: '희귀', price: 100, effects: { 공격력_pct: 0.15, 방어력_pct: 0.10 } },
  최고의:     { name: '최고의',     tier: '희귀', price: 130, effects: { 전스탯_pct: 0.10 } },
  굉장한:     { name: '굉장한',     tier: '희귀', price: 110, effects: { 공격력_pct: 0.25 } },
  위대한:     { name: '위대한',     tier: '희귀', price: 120, effects: { 공격력_pct: 0.30 } },  // 마공_pct 통합
  마스터의:   { name: '마스터의',   tier: '희귀', price: 140, effects: { 전스탯_pct: 0.15, 관통: 8 } },  // 관통 통합

  // 특별 12종
  흡혈의:     { name: '흡혈의',     tier: '특별', price: 200, effects: { 공격력_pct: 0.10, lifesteal: 0.25 } },
  저주의:     { name: '저주의',     tier: '특별', price: 220, effects: { 공격력_pct: 0.40, self_dot_pct: 0.05 }, fixed_self_dot: true },
  신성한:     { name: '신성한',     tier: '특별', price: 190, effects: { 공격력_pct: 0.15, vs_undead_pct: 0.50 } },
  폭풍의:     { name: '폭풍의',     tier: '특별', price: 210, effects: { 속도_pct: 0.20, 공격력_pct: 0.15 } },  // 마공_pct 통합
  화염의:     { name: '화염의',     tier: '특별', price: 200, effects: { 공격력_pct: 0.10, burn_chance: 0.30 } },
  빙결의:     { name: '빙결의',     tier: '특별', price: 200, effects: { 공격력_pct: 0.10, slow_chance: 0.30 } },
  행운의:     { name: '행운의',     tier: '특별', price: 200, effects: { 행운: 5, 공격력_pct: 0.05 } },
  마비의:     { name: '마비의',     tier: '특별', price: 200, effects: { 공격력_pct: 0.10, shock_chance: 0.25 } },
  출혈의:     { name: '출혈의',     tier: '특별', price: 200, effects: { 공격력_pct: 0.10, bleed_chance: 0.25 } },
  어둠의:     { name: '어둠의',     tier: '특별', price: 200, effects: { 공격력_pct: 0.10, blind_chance: 0.25 } },
  부식의:     { name: '부식의',     tier: '특별', price: 200, effects: { 공격력_pct: 0.10, poison_chance: 0.25 } },
  진귀한:     { name: '진귀한',     tier: '특별', price: 200, effects: {} },
}

// ====== 갑옷 트레잇 풀 (24종) — 방어 통합 ======
export const ARMOR_TRAITS: Record<string, TraitDef> = {
  // 하급 4종
  낡은:   { name: '낡은',   tier: '하급', price: 10, effects: { 방어력_pct: -0.10 } },
  녹슨:   { name: '녹슨',   tier: '하급', price: 10, effects: { 방어력_pct: -0.10, 회피: -10 } },
  부서진: { name: '부서진', tier: '하급', price: 9,  effects: { 방어력_pct: -0.15 } },
  해진:   { name: '해진',   tier: '하급', price: 8,  effects: { 방어력_pct: -0.13 } },

  // 보통 5종
  단단한: { name: '단단한', tier: '보통', price: 50, effects: { 방어력_pct: 0.15 } },
  두꺼운: { name: '두꺼운', tier: '보통', price: 55, effects: { 방어력_pct: 0.20 } },
  매끈한: { name: '매끈한', tier: '보통', price: 50, effects: { 회피: 10, 속도_pct: -0.05 } },
  가벼운: { name: '가벼운', tier: '보통', price: 55, effects: { 속도_pct: 0.10, 방어력_pct: -0.05 } },
  정밀한: { name: '정밀한', tier: '보통', price: 45, effects: { 명중: 10 } },

  // 희귀 5종
  정교한:   { name: '정교한',   tier: '희귀', price: 100, effects: { 방어력_pct: 0.25 } },
  빛나는:   { name: '빛나는',   tier: '희귀', price: 130, effects: { 마력: 15, 방어력_pct: 0.10 } },
  비범한:   { name: '비범한',   tier: '희귀', price: 120, effects: { 방어력_pct: 0.20, 회피: 15 } },
  위대한:   { name: '위대한',   tier: '희귀', price: 110, effects: { 방어력_pct: 0.35 } },
  마스터의: { name: '마스터의', tier: '희귀', price: 140, effects: { 전스탯_pct: 0.15, 상태저항: 5 } },

  // 특별 10종
  흡혈의:       { name: '흡혈의',       tier: '특별', price: 200, effects: { damage_taken_heal_pct: 0.05 } },
  저주의:       { name: '저주의',       tier: '특별', price: 220, effects: { 방어력_pct: 0.50, self_dot_pct: 0.03 }, fixed_self_dot: true },
  신성한:       { name: '신성한',       tier: '특별', price: 190, effects: { 방어력_pct: 0.20, 상태저항: 8 } },
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
