import type { WeaponBase } from '@/types'

// v9 — 무기 곱셈 모델 iso-DPS 그리드
//   공격 공식: dmg = stat.공격력 × baseAtk, 공격 주기 = n틱
//   설계 원칙:
//     baseAtk = ticks / 10  → 모든 무기 raw DPS 동일 (stat × 0.1 dmg/tick)
//     검 = baseAtk 1.0 / 10틱 (균형 baseline, 명중 0 / 회피 0)
//     속도형 baseline:  0.8 / 8틱  (+ 명중/회피 보너스)
//     한방형 baseline:  1.2 / 12틱 (- 명중/회피 디메리트)
//
//   명중/회피 = (10 - ticks) → 1틱당 ±1 (10틱 = 0, 빠를수록 +, 느릴수록 -)
//   v9 튜닝: 무기별 평균 클리어률 평탄화 위해 ±2 → ±1 로 축소
//
//   무기 차별화는 raw DPS가 아니라:
//     - 명중/회피 보정 (속도형 = 안정타 / 한방형 = 일격 도박)
//     - 틱당 누적 패턴 (속도형 = 잦은 발동, 한방형 = 큰 한방 + 스킬 배수 효과)
//     - penBonus / mpBonus / magicPenBonus 같은 카테고리별 부가 효과
//     - autoSkill / 트레잇과의 시너지
//
//   speedCoef = 10 / ticks (검 10틱 = 1.0 기준)
//   autoSkill 은 추후 랜덤 부여 시스템으로 대체 예정 — 현재는 placeholder.
export const WEAPONS: Record<string, WeaponBase> = {
  // ── 속도형 근접 (baseline 0.8 / 8틱) ──
  건틀릿: {
    key: '건틀릿', category: 'melee', baseAtk: 0.7, speedCoef: 1.429, // 7틱
    accBonus: 3, evaBonus: 3, mpBonus: 0, magicPenBonus: 0, penBonus: 0, isMagic: false,
    autoSkill: '연속공격',
  },
  단검: {
    key: '단검', category: 'melee', baseAtk: 0.8, speedCoef: 1.250, // 8틱
    accBonus: 2, evaBonus: 2, mpBonus: 0, magicPenBonus: 0, penBonus: 10, isMagic: false,
    autoSkill: '연속공격',
  },
  사슬낫: {
    key: '사슬낫', category: 'melee', baseAtk: 0.75, speedCoef: 1.111, // 9틱
    accBonus: 1, evaBonus: 1, mpBonus: 0, magicPenBonus: 0, penBonus: 15, isMagic: false,
    autoSkill: '급습',
  },

  // ── 균형형 근접 (baseline 1.0 / 10틱) ──
  검: {
    key: '검', category: 'melee', baseAtk: 1.0, speedCoef: 1.000, // 10틱
    accBonus: 0, evaBonus: 0, mpBonus: 0, magicPenBonus: 0, penBonus: 10, isMagic: false,
    autoSkill: '정밀타격',
  },
  창: {
    key: '창', category: 'melee', baseAtk: 1.1, speedCoef: 0.909, // 11틱
    accBonus: -1, evaBonus: -1, mpBonus: 0, magicPenBonus: 0, penBonus: 15, isMagic: false,
    autoSkill: '피어스',
  },

  // ── 한방형 근접 (baseline 1.2 / 12틱) ──
  철퇴: {
    key: '철퇴', category: 'melee', baseAtk: 1.2, speedCoef: 0.833, // 12틱
    accBonus: -2, evaBonus: -2, mpBonus: 0, magicPenBonus: 0, penBonus: 5, isMagic: false,
    autoSkill: '스매쉬',
  },
  대검: {
    key: '대검', category: 'melee', baseAtk: 1.45, speedCoef: 0.769, // 13틱
    accBonus: -3, evaBonus: -3, mpBonus: 0, magicPenBonus: 0, penBonus: 0, isMagic: false,
    autoSkill: '스매쉬',
  },
  양날도끼: {
    key: '양날도끼', category: 'melee', baseAtk: 1.4, speedCoef: 0.714, // 14틱
    accBonus: -4, evaBonus: -4, mpBonus: 0, magicPenBonus: 0, penBonus: 15, isMagic: false,
    autoSkill: '스매쉬',
  },
  할버드: {
    key: '할버드', category: 'melee', baseAtk: 1.7, speedCoef: 0.667, // 15틱
    accBonus: -5, evaBonus: -5, mpBonus: 0, magicPenBonus: 0, penBonus: 30, isMagic: false,
    autoSkill: '피어스',
  },

  // ── 원거리 (활) ──
  숏보우: {
    key: '숏보우', category: 'ranged', baseAtk: 0.8, speedCoef: 1.250, // 8틱
    accBonus: 2, evaBonus: 2, mpBonus: 0, magicPenBonus: 0, penBonus: 0, isMagic: false,
    autoSkill: '정밀타격',
  },
  롱보우: {
    key: '롱보우', category: 'ranged', baseAtk: 1.1, speedCoef: 0.909, // 11틱
    accBonus: -1, evaBonus: -1, mpBonus: 0, magicPenBonus: 0, penBonus: 10, isMagic: false,
    autoSkill: '피어스',
  },
  석궁: {
    key: '석궁', category: 'ranged', baseAtk: 1.7, speedCoef: 0.667, // 15틱
    accBonus: -5, evaBonus: -5, mpBonus: 0, magicPenBonus: 0, penBonus: 30, isMagic: false,
    autoSkill: '피어스',
  },

  // ── 마법 (속성/스킬은 랜덤 부여 — 추후 시스템) ──
  완드: {
    key: '완드', category: 'magic', baseAtk: 0.7, speedCoef: 1.429, // 7틱
    accBonus: 3, evaBonus: 3, mpBonus: -3, magicPenBonus: 0, penBonus: 0, isMagic: true,
    autoSkill: '화염구',
  },
  스태프: {
    key: '스태프', category: 'magic', baseAtk: 0.85, speedCoef: 1.000, // 10틱
    accBonus: 0, evaBonus: 0, mpBonus: 0, magicPenBonus: 10, penBonus: 0, isMagic: true,
    autoSkill: '번개창',
  },
  마도서: {
    key: '마도서', category: 'magic', baseAtk: 1.3, speedCoef: 0.769, // 13틱
    accBonus: -3, evaBonus: -3, mpBonus: 3, magicPenBonus: 15, penBonus: 0, isMagic: true,
    autoSkill: '바위충격',
  },
}

export const WEAPON_KEYS = Object.keys(WEAPONS)

// 표시용 이름 (현재는 그대로, 추후 속성 prefix 등 붙을 수 있음)
export function weaponDisplayName(key: string): string {
  return key
}

// 무기 → 표시 틱 (speedCoef 1.0 = 10틱 기준)
export function weaponTicks(speedCoef: number): number {
  return Math.round(10 / speedCoef)
}
