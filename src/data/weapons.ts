import type { WeaponBase, Element } from '@/types'

// 무기 베이스 — 특성별 밸런싱 (v5)
//   설계 원칙:
//     속도형: atk 낮음 + speedCoef 높음 + 관통 0     ← 빠른 평타 누적
//     균형형: atk 중간 + speedCoef 1.0 + 관통 약    ← 무난
//     중량형: atk 높음 + speedCoef 낮음 + 명중 페널티  ← 한 방 데미지
//     관통형: atk 균형 + 관통 큼 + 명중 우위         ← 방어 무력화
//     원거리: 관통/명중 우위 + 약간 낮은 atk
//
//   DPS (atk × speedCoef) 기준 모두 약 7~9 범위에 맞추되,
//   관통/명중/스킬로 변별성.
export const WEAPONS: Record<string, WeaponBase> = {
  // ── 속도형 ──
  단검: {
    key: '단검', category: 'melee', baseAtk: 5, speedCoef: 1.5,
    accBonus: 5, mpBonus: 0, magicPenBonus: 0, penBonus: 0, isMagic: false,
    autoSkill: '연속공격',
  },
  건틀릿: {
    key: '건틀릿', category: 'melee', baseAtk: 3, speedCoef: 1.7,
    accBonus: 0, mpBonus: 0, magicPenBonus: 0, penBonus: 0, isMagic: false,
    autoSkill: '연속공격',
  },
  // ── 균형형 ──
  검: {
    key: '검', category: 'melee', baseAtk: 10, speedCoef: 1.0,
    accBonus: 0, mpBonus: 0, magicPenBonus: 0, penBonus: 0, isMagic: false,
    autoSkill: '정밀타격',
  },
  사슬낫: {
    key: '사슬낫', category: 'melee', baseAtk: 9, speedCoef: 0.9,
    accBonus: 0, mpBonus: 0, magicPenBonus: 0, penBonus: 2, isMagic: false,
    autoSkill: '급습',
  },
  // ── 관통형 ──
  창: {
    key: '창', category: 'melee', baseAtk: 11, speedCoef: 0.9,
    accBonus: 5, mpBonus: 0, magicPenBonus: 0, penBonus: 5, isMagic: false,
    autoSkill: '피어스',
  },
  // ── 중량형 ──
  대검: {
    key: '대검', category: 'melee', baseAtk: 15, speedCoef: 0.75,
    accBonus: -5, mpBonus: 0, magicPenBonus: 0, penBonus: 0, isMagic: false,
    autoSkill: '스매쉬',
  },
  도끼: {
    key: '도끼', category: 'melee', baseAtk: 15, speedCoef: 0.75,
    accBonus: -5, mpBonus: 0, magicPenBonus: 0, penBonus: 3, isMagic: false,
    autoSkill: '스매쉬',
  },
  철퇴: {
    key: '철퇴', category: 'melee', baseAtk: 18, speedCoef: 0.65,
    accBonus: -10, mpBonus: 0, magicPenBonus: 0, penBonus: 0, isMagic: false,
    autoSkill: '스매쉬',
  },
  해머: {
    key: '해머', category: 'melee', baseAtk: 18, speedCoef: 0.65,
    accBonus: -10, mpBonus: 0, magicPenBonus: 0, penBonus: 5, isMagic: false,
    autoSkill: '스매쉬',
  },
  양날도끼: {
    key: '양날도끼', category: 'melee', baseAtk: 22, speedCoef: 0.55,
    accBonus: -15, mpBonus: 0, magicPenBonus: 0, penBonus: 0, isMagic: false,
    autoSkill: '스매쉬',
  },
  // ── 원거리 ──
  숏보우: {
    key: '숏보우', category: 'ranged', baseAtk: 8, speedCoef: 1.05,
    accBonus: 10, mpBonus: 0, magicPenBonus: 0, penBonus: 0, isMagic: false,
    autoSkill: '정밀타격',
  },
  롱보우: {
    key: '롱보우', category: 'ranged', baseAtk: 13, speedCoef: 0.85,
    accBonus: 5, mpBonus: 0, magicPenBonus: 0, penBonus: 3, isMagic: false,
    autoSkill: '피어스',
  },
  석궁: {
    key: '석궁', category: 'ranged', baseAtk: 13, speedCoef: 0.75,
    accBonus: 5, mpBonus: 0, magicPenBonus: 0, penBonus: 8, isMagic: false,
    autoSkill: '피어스',
  },
}

// 마법 무기 (속성별 7가지) × 3 타입 (완드 / 스태프 / 마도서)
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
  // 완드 — MP 효율 + 빠른 발사 (마법무기 약화 v6.1)
  WEAPONS[`완드_${el}`] = {
    key: `완드_${el}`, category: 'magic', baseAtk: 2, speedCoef: 1.05,
    accBonus: 5, mpBonus: -3, magicPenBonus: 0, penBonus: 0,
    isMagic: true, element: el, autoSkill: ELEMENT_SKILL[el],
  }
  // 스태프 — 균형 + 마법 관통
  WEAPONS[`스태프_${el}`] = {
    key: `스태프_${el}`, category: 'magic', baseAtk: 4, speedCoef: 0.75,
    accBonus: 5, mpBonus: 0, magicPenBonus: 3, penBonus: 0,
    isMagic: true, element: el, autoSkill: ELEMENT_SKILL[el],
  }
  // 마도서 — 강력 + MP 비싸고 명중 -
  WEAPONS[`마도서_${el}`] = {
    key: `마도서_${el}`, category: 'magic', baseAtk: 6, speedCoef: 0.8,
    accBonus: -10, mpBonus: 3, magicPenBonus: 5, penBonus: 0,
    isMagic: true, element: el, autoSkill: ELEMENT_SKILL[el],
  }
}

export const WEAPON_KEYS = Object.keys(WEAPONS)

// 표시용 이름
export function weaponDisplayName(key: string): string {
  return key.replace(/_/g, ' ')
}
