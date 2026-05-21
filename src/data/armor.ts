import type { ArmorBase } from '@/types'

// 갑옷 4종 — 특성별 밸런싱 (v5)
//   판금: 최대 방어 + 매우 느려짐 (탱커, 보스전 안정)
//   중갑: 균형 (대중적 선택, 페널티 거의 없음)
//   가죽갑: 낮은 방어 + 속도/회피 (회피 빌드)
//   로브: 매우 낮은 방어 + 마력 +8 (마법 빌드 — 마법무기 시너지 ×1.7)
export const ARMORS: Record<string, ArmorBase> = {
  판금: {
    key: '판금',
    baseDef: 12,
    speedMult: 0.75,
    evasion: 0,
    mpBonus: 0,
  },
  중갑: {
    key: '중갑',
    baseDef: 7,
    speedMult: 0.95,
    evasion: 0,
    mpBonus: 0,
  },
  가죽갑: {
    key: '가죽갑',
    baseDef: 4,
    speedMult: 1.10,
    evasion: 5,
    mpBonus: 0,
    autoSkill: '회피',
  },
  로브: {
    key: '로브',
    baseDef: 1,
    speedMult: 1.05,
    evasion: 0,
    mpBonus: 8,
    autoSkill: '방어',
  },
}

export const ARMOR_KEYS = Object.keys(ARMORS)
