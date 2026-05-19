import type { SkillDef } from '@/types'

// 19개 스킬 — 공격력/방어력 통합 밸런싱
// 마법 스킬: MP 소모 +50%, 데미지 ×1.35 (물리 대비 후반 우위)
export const SKILLS: Record<string, SkillDef> = {
  // === 물리 공격 5종 ===
  스매쉬: {
    key: '스매쉬', name: '스매쉬', mp: 8, kind: 'physical_atk',
    description: '공격력 × 2.0, 명중 -10',
  },
  피어스: {
    key: '피어스', name: '피어스', mp: 6, kind: 'physical_atk',
    description: '공격력 × 1.0, 관통 × 2.0 적용',
  },
  연속공격: {
    key: '연속공격', name: '연속공격', mp: 10, kind: 'physical_atk',
    description: '공격력 × 0.7 × (1 + 속도//20)회',
  },
  정밀타격: {
    key: '정밀타격', name: '정밀타격', mp: 7, kind: 'physical_atk',
    description: '공격력 × 1.2, 명중 +30, 크리 ×2',
  },
  급습: {
    key: '급습', name: '급습', mp: 9, kind: 'physical_atk',
    description: '공격력 × 1.5 × (1 + 행운 × 0.03)',
  },

  // === 물리 방어 4종 ===
  방어: {
    key: '방어', name: '방어', mp: 5, kind: 'physical_def',
    description: '10틱간 방어 × 2, 받은 피해 50% 반사',
  },
  회피: {
    key: '회피', name: '회피', mp: 6, kind: 'physical_def',
    description: '10틱간 회피 +30',
  },
  패링: {
    key: '패링', name: '패링', mp: 8, kind: 'physical_def',
    description: '10틱간 방어 +(속도×0.3 + 공격력×0.5), 받은 피해 50% 반사',
  },
  불굴의의지: {
    key: '불굴의의지', name: '불굴의 의지', mp: 10, kind: 'physical_def',
    description: '체력 × 5% 회복, 상태저항 +30 (10틱간)',
  },

  // === 마법 공격 7종 (MP ↑, 데미지 ↑) ===
  빙결의화살: {
    key: '빙결의화살', name: '빙결의 화살', mp: 12, kind: 'magic_atk', element: '물',
    description: '공격력 × 2.0, 30% 둔화',
  },
  화염구: {
    key: '화염구', name: '화염구', mp: 15, kind: 'magic_atk', element: '불',
    description: '공격력 × 2.4, 25% 점화',
  },
  폭풍칼날: {
    key: '폭풍칼날', name: '폭풍 칼날', mp: 14, kind: 'magic_atk', element: '바람',
    description: '공격력 × 0.95 × 3히트, 명중 +50',
  },
  바위충격: {
    key: '바위충격', name: '바위 충격', mp: 16, kind: 'magic_atk', element: '대지',
    description: '공격력 × 2.1, 40% 둔화 + 적 방어 -20% (20틱)',
  },
  번개창: {
    key: '번개창', name: '번개창', mp: 14, kind: 'magic_atk', element: '번개',
    description: '공격력 × 2.7, 15% 감전 + 적 게이지 -10',
  },
  그림자일격: {
    key: '그림자일격', name: '그림자 일격', mp: 16, kind: 'magic_atk', element: '암흑',
    description: '공격력 × 2.0, 적 명중 -20 (20틱)',
  },
  정화의광선: {
    key: '정화의광선', name: '정화의 광선', mp: 18, kind: 'magic_atk', element: '빛',
    description: '공격력 × 1.6, 자기 디버프 정화, 언데드/암흑 ×1.5',
  },

  // === 마법 방어 3종 ===
  배리어: {
    key: '배리어', name: '배리어', mp: 14, kind: 'magic_def',
    description: '10틱간 방어 + 공격력 × 1.0',
  },
  마력충전: {
    key: '마력충전', name: '마력 충전', mp: 0, kind: 'magic_def',
    description: 'MP 회복 = (행운 + 공격력) × 0.3',
  },
  저항의결계: {
    key: '저항의결계', name: '저항의 결계', mp: 20, kind: 'magic_def',
    description: '10틱간 상태저항 × 2, 방어 +30%',
  },
}
