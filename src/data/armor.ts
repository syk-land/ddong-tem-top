import type { ArmorBase } from '@/types'

// 갑옷 4종 — 방어 통합 + 사용자 밸런싱
// 판금: 높은 방어 + 속도 ↓
// 중갑: 평균
// 가죽갑: 낮은 방어 + 속도 ↑ + 회피
// 로브: 매우 낮은 방어 + 마력 ↑
export const ARMORS: Record<string, ArmorBase> = {
  판금: {
    key: '판금',
    baseDef: 10,
    speedMult: 0.65,
    evasion: 0,
    mpBonus: 0,
  },
  중갑: {
    key: '중갑',
    baseDef: 6,
    speedMult: 0.90,
    evasion: 0,
    mpBonus: 0,
  },
  가죽갑: {
    key: '가죽갑',
    baseDef: 3,
    speedMult: 1.20,
    evasion: 12,
    mpBonus: 0,
    autoSkill: '회피',
  },
  로브: {
    key: '로브',
    baseDef: 1.5,
    speedMult: 1.0,
    evasion: 0,
    mpBonus: 30,
    autoSkill: '방어',
  },
}

export const ARMOR_KEYS = Object.keys(ARMORS)
