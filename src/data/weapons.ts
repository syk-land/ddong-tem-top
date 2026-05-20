import type { WeaponBase } from '@/types'

// v8 — 무기 단순화 (15종)
//   설계 원칙:
//     속도형 (6~9틱):  낮은 atk + 빠른 공속 + 명중/관통으로 차별화
//     균형형 (10~13틱): 중간 atk + 1.0± 공속 + 약간의 명중 보너스
//     중량형 (14~20틱): 높은 atk + 느린 공속 + 명중 페널티
//
//   관통은 % 방어 무시 (0~100). 후반에도 비율 데미지 보장.
//   목표 DP10T ≈ 4.5 (적 방어 30 기준).
//
//   speedCoef = 10 / ticks (검 10틱 = 1.0 기준)
//   autoSkill 은 추후 랜덤 부여 시스템으로 대체 예정 — 현재는 placeholder.
export const WEAPONS: Record<string, WeaponBase> = {
  // ── 속도형 ──
  건틀릿: {
    key: '건틀릿', category: 'melee', baseAtk: 6, speedCoef: 1.667, // 6틱
    accBonus: 10, mpBonus: 0, magicPenBonus: 0, penBonus: 0, isMagic: false,
    autoSkill: '연속공격',
  },
  단검: {
    key: '단검', category: 'melee', baseAtk: 7, speedCoef: 1.429, // 7틱
    accBonus: 5, mpBonus: 0, magicPenBonus: 0, penBonus: 10, isMagic: false,
    autoSkill: '연속공격',
  },
  사슬낫: {
    key: '사슬낫', category: 'melee', baseAtk: 8, speedCoef: 1.111, // 9틱
    accBonus: 0, mpBonus: 0, magicPenBonus: 0, penBonus: 25, isMagic: false,
    autoSkill: '급습',
  },

  // ── 균형형 ──
  검: {
    key: '검', category: 'melee', baseAtk: 10, speedCoef: 1.000, // 10틱
    accBonus: 5, mpBonus: 0, magicPenBonus: 0, penBonus: 10, isMagic: false,
    autoSkill: '정밀타격',
  },
  창: {
    key: '창', category: 'melee', baseAtk: 10, speedCoef: 0.909, // 11틱
    accBonus: 5, mpBonus: 0, magicPenBonus: 0, penBonus: 15, isMagic: false,
    autoSkill: '피어스',
  },
  철퇴: {
    key: '철퇴', category: 'melee', baseAtk: 13, speedCoef: 0.769, // 13틱
    accBonus: 5, mpBonus: 0, magicPenBonus: 0, penBonus: 5, isMagic: false,
    autoSkill: '스매쉬',
  },

  // ── 중량형 ──
  대검: {
    key: '대검', category: 'melee', baseAtk: 16, speedCoef: 0.714, // 14틱
    accBonus: -5, mpBonus: 0, magicPenBonus: 0, penBonus: 0, isMagic: false,
    autoSkill: '스매쉬',
  },
  양날도끼: {
    key: '양날도끼', category: 'melee', baseAtk: 17, speedCoef: 0.667, // 15틱
    accBonus: -10, mpBonus: 0, magicPenBonus: 0, penBonus: 15, isMagic: false,
    autoSkill: '스매쉬',
  },
  할버드: {
    key: '할버드', category: 'melee', baseAtk: 20, speedCoef: 0.500, // 20틱
    accBonus: -10, mpBonus: 0, magicPenBonus: 0, penBonus: 30, isMagic: false,
    autoSkill: '피어스',
  },

  // ── 원거리 (활) ──
  숏보우: {
    key: '숏보우', category: 'ranged', baseAtk: 7, speedCoef: 1.429, // 7틱
    accBonus: 10, mpBonus: 0, magicPenBonus: 0, penBonus: 0, isMagic: false,
    autoSkill: '정밀타격',
  },
  롱보우: {
    key: '롱보우', category: 'ranged', baseAtk: 10, speedCoef: 0.909, // 11틱
    accBonus: 10, mpBonus: 0, magicPenBonus: 0, penBonus: 10, isMagic: false,
    autoSkill: '피어스',
  },
  석궁: {
    key: '석궁', category: 'ranged', baseAtk: 13, speedCoef: 0.667, // 15틱
    accBonus: 5, mpBonus: 0, magicPenBonus: 0, penBonus: 30, isMagic: false,
    autoSkill: '피어스',
  },

  // ── 마법 (속성/스킬은 랜덤 부여 — 추후 시스템) ──
  완드: {
    key: '완드', category: 'magic', baseAtk: 6, speedCoef: 1.667, // 6틱
    accBonus: 5, mpBonus: -3, magicPenBonus: 0, penBonus: 0, isMagic: true,
    autoSkill: '화염구',
  },
  스태프: {
    key: '스태프', category: 'magic', baseAtk: 10, speedCoef: 1.000, // 10틱
    accBonus: 0, mpBonus: 0, magicPenBonus: 10, penBonus: 0, isMagic: true,
    autoSkill: '번개창',
  },
  마도서: {
    key: '마도서', category: 'magic', baseAtk: 14, speedCoef: 0.769, // 13틱
    accBonus: -10, mpBonus: 3, magicPenBonus: 15, penBonus: 0, isMagic: true,
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
