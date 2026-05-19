import type { WeaponBase, Element } from '@/types'

// 13개 무기 베이스 — 가산식 v3 밸런싱 (기존 ×1.3~1.5 상향)
// baseAtk가 그대로 종합 공격계수 베이스로 사용됨 (stat에 가산)
export const WEAPONS: Record<string, WeaponBase> = {
  단검: {
    key: '단검', category: 'melee', baseAtk: 5, speedCoef: 1.5,
    accBonus: 0, mpBonus: 0, magicPenBonus: 0, isMagic: false,
    autoSkill: '연속공격',
  },
  건틀릿: {
    key: '건틀릿', category: 'melee', baseAtk: 4, speedCoef: 2.0,
    accBonus: 0, mpBonus: 0, magicPenBonus: 0, isMagic: false,
    autoSkill: '연속공격',
  },
  검: {
    key: '검', category: 'melee', baseAtk: 8, speedCoef: 1.0,
    accBonus: 0, mpBonus: 0, magicPenBonus: 0, isMagic: false,
    autoSkill: '정밀타격',
  },
  창: {
    key: '창', category: 'melee', baseAtk: 8, speedCoef: 1.0,
    accBonus: 5, mpBonus: 0, magicPenBonus: 0, isMagic: false,
    autoSkill: '피어스',
  },
  대검: {
    key: '대검', category: 'melee', baseAtk: 12, speedCoef: 0.7,
    accBonus: -5, mpBonus: 0, magicPenBonus: 0, isMagic: false,
    autoSkill: '스매쉬',
  },
  도끼: {
    key: '도끼', category: 'melee', baseAtk: 12, speedCoef: 0.7,
    accBonus: -5, mpBonus: 0, magicPenBonus: 0, isMagic: false,
    autoSkill: '스매쉬',
  },
  철퇴: {
    key: '철퇴', category: 'melee', baseAtk: 14, speedCoef: 0.6,
    accBonus: -10, mpBonus: 0, magicPenBonus: 0, isMagic: false,
    autoSkill: '스매쉬',
  },
  해머: {
    key: '해머', category: 'melee', baseAtk: 14, speedCoef: 0.6,
    accBonus: -10, mpBonus: 0, magicPenBonus: 0, isMagic: false,
    autoSkill: '스매쉬',
  },
  양날도끼: {
    key: '양날도끼', category: 'melee', baseAtk: 16, speedCoef: 0.5,
    accBonus: -15, mpBonus: 0, magicPenBonus: 0, isMagic: false,
    autoSkill: '스매쉬',
  },
  사슬낫: {
    key: '사슬낫', category: 'melee', baseAtk: 10, speedCoef: 1.0,
    accBonus: 0, mpBonus: 0, magicPenBonus: 0, isMagic: false,
    autoSkill: '급습',
  },
  숏보우: {
    key: '숏보우', category: 'ranged', baseAtk: 7, speedCoef: 0.9,
    accBonus: 10, mpBonus: 0, magicPenBonus: 0, isMagic: false,
    autoSkill: '정밀타격',
  },
  롱보우: {
    key: '롱보우', category: 'ranged', baseAtk: 12, speedCoef: 0.6,
    accBonus: 5, mpBonus: 0, magicPenBonus: 0, isMagic: false,
    autoSkill: '피어스',
  },
  석궁: {
    key: '석궁', category: 'ranged', baseAtk: 12, speedCoef: 0.6,
    accBonus: 5, mpBonus: 0, magicPenBonus: 0, isMagic: false,
    autoSkill: '피어스',
  },
}

// 마법 무기 (속성별, 7가지) — 가산식 v3
const ELEMENTS: Element[] = ['물', '불', '바람', '대지', '번개', '암흑', '빛']

const ELEMENT_SKILL: Record<Element, string> = {
  물: '빙결의화살',
  불: '화염구',
  바람: '폭풍칼날',
  대지: '바위충격',
  번개: '번개창',
  암흑: '그림자일격',
  빛: '정화의광선',
  무: '정밀타격',
}

for (const el of ELEMENTS) {
  WEAPONS[`완드_${el}`] = {
    key: `완드_${el}`, category: 'magic', baseAtk: 6, speedCoef: 1.2,
    accBonus: 10, mpBonus: -2, magicPenBonus: 0, isMagic: true, element: el,
    autoSkill: ELEMENT_SKILL[el],
  }
  WEAPONS[`스태프_${el}`] = {
    key: `스태프_${el}`, category: 'magic', baseAtk: 11, speedCoef: 0.7,
    accBonus: 10, mpBonus: 0, magicPenBonus: 5, isMagic: true, element: el,
    autoSkill: ELEMENT_SKILL[el],
  }
  WEAPONS[`마도서_${el}`] = {
    key: `마도서_${el}`, category: 'magic', baseAtk: 14, speedCoef: 1.0,
    accBonus: -10, mpBonus: 2, magicPenBonus: 0, isMagic: true, element: el,
    autoSkill: ELEMENT_SKILL[el],
  }
}

export const WEAPON_KEYS = Object.keys(WEAPONS)

// 표시용 이름
export function weaponDisplayName(key: string): string {
  return key.replace(/_/g, ' ')
}
