import type { Character, Stats, StatKey } from '@/types'
import { RANDOM_STAT_KEYS } from '@/types'
import { randInt, pickOne, randFloat } from './rng'
import { rollItem } from './items'

// v6: 5스탯 (힘/민첩/체력/마력/행운) 무작위 분배
// 총 50pt: min 3 × 5 = 15 + 35pt 자유 분배 (각 최대 20)
export function generateRandomStats(): Stats {
  const stats: Stats = {
    힘: 3, 민첩: 3, 체력: 3, 마력: 3, 행운: 3,
  }

  let remaining = 35
  while (remaining > 0) {
    const key = pickOne(RANDOM_STAT_KEYS)
    if (stats[key] < 20) {
      stats[key] += 1
      remaining -= 1
    }
  }
  return stats
}

// 스탯 → 실수치 변환 (v3 재밸런싱)
// 체력 1pt = +10 HP (받는 dmg 평균 10 기준 +1 hit 회피)
export function computeMaxHp(체력: number): number {
  return 체력 * 10 + 50
}

// 마력 1pt = +15 MP + 모든 공격 데미지 +1 가산 (stats.ts에서 처리)
export function computeMaxMp(마력: number): number {
  return 마력 * 15 + 30
}

// 2.4 시작 장비: 무기만 (하급 노말, coef 0.5~1.0)
export function createStartingWeapon() {
  return rollItemForce({ kind: 'weapon', trait_tier: '하급', grade: '노말' })
}

// rollItem with constraints helper
function rollItemForce(opts: { kind: 'weapon' | 'armor'; trait_tier: '하급' | '보통' | '희귀' | '특별'; grade: '노말' | '레어' | '스페셜' | '레전드' }) {
  return rollItem({
    kind: opts.kind,
    forceTraitTier: opts.trait_tier,
    forceGrade: opts.grade,
  })
}

// v6: 시작 균등 스탯 — 5스탯 각 10pt (총 50pt)
export function uniformStartingStats(): Stats {
  return {
    힘: 10, 민첩: 10, 체력: 10, 마력: 10, 행운: 10,
  }
}

export function createCharacter(
  bonusStats: Partial<Stats> = {},
  customStats?: Stats,
  pendingStartBonus = 0,
): Character {
  // customStats 가 주어지면 그대로 사용 (주사위 결과), 아니면 균등 시작
  const stats = customStats ?? uniformStartingStats()

  // 메타 보너스 적용 (자유 분배)
  for (const key in bonusStats) {
    const k = key as StatKey
    stats[k] = (stats[k] ?? 0) + (bonusStats[k] ?? 0)
  }

  // v6 도전 보너스: 5스탯에 1/5 균등 + 나머지(0~4)는 힘 → 민첩 → 체력 → 마력 → 행운 순서로 1pt씩
  if (pendingStartBonus > 0) {
    const five: StatKey[] = ['힘', '민첩', '체력', '마력', '행운']
    const base = Math.floor(pendingStartBonus / 5)
    const rem = pendingStartBonus - base * 5
    for (const k of five) stats[k] += base
    for (let i = 0; i < rem; i++) {
      stats[five[i]] += 1
    }
  }

  const maxHp = computeMaxHp(stats.체력)
  const maxMp = computeMaxMp(stats.마력)

  return {
    stats,
    hp: maxHp,
    maxHp,
    mp: maxMp,
    maxMp,
    weapon: createStartingWeapon(),
    armor: null,
    gold: 50,
    statuses: [],
    actionGauge: 0,
  }
}

// v6: 클리어 등급 — 아이템 티어 합계 기반 (점수 낮을수록 등급 ↑)
//   EX (0~5), SSS (6~8), SS (9~11), S (12~14), A (15~17),
//   B (18~20), C (21~23), D (24~26), E (27~29), F (30+)
// 3티어 증가할 때마다 1등급 하락.
export function getClearRank(score: number): { rank: string; bonus: number } {
  if (score <= 5)  return { rank: 'EX',  bonus: 10 }
  if (score <= 8)  return { rank: 'SSS', bonus: 9 }
  if (score <= 11) return { rank: 'SS',  bonus: 8 }
  if (score <= 14) return { rank: 'S',   bonus: 7 }
  if (score <= 17) return { rank: 'A',   bonus: 6 }
  if (score <= 20) return { rank: 'B',   bonus: 5 }
  if (score <= 23) return { rank: 'C',   bonus: 4 }
  if (score <= 26) return { rank: 'D',   bonus: 3 }
  if (score <= 29) return { rank: 'E',   bonus: 2 }
  return { rank: 'F', bonus: 1 }
}

// v6: 점수 = 무기 티어 + 갑옷 티어 (장비 없으면 1로 카운트). 낮을수록 좋음 (역설).
export function computeClearScore(c: Character, _chapter: number): number {
  const weaponTier = c.weapon?.tier ?? 1
  const armorTier = c.armor?.tier ?? 1
  return weaponTier + armorTier
}
