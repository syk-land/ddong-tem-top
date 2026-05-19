import type { Character, Stats, StatKey } from '@/types'
import { RANDOM_STAT_KEYS } from '@/types'
import { randInt, pickOne, randFloat } from './rng'
import { rollItem } from './items'

// 2.2 캐릭터 생성: 4스탯 무작위 분배 (각 최소 3, 최대 20)
// 총 50pt: min 3×4 = 12 + 38pt 자유 분배
export function generateRandomStats(): Stats {
  const stats: Stats = {
    공격력: 3, 방어력: 3, 체력: 3, 마력: 3,
    속도: 10, 행운: 0,
    명중률: 0, 회피율: 0,
    관통: 0,
    상태저항: 0,
  }

  let remaining = 38
  while (remaining > 0) {
    const key = pickOne(RANDOM_STAT_KEYS)
    if (stats[key] < 20) {
      stats[key] += 1
      remaining -= 1
    }
  }
  return stats
}

// 스탯 → 실수치 변환 (균등 1.0 가치 기준)
// 체력 1pt = +5 HP = 평균 받는 dmg 5 기준 +1 hit 회피
export function computeMaxHp(체력: number): number {
  return 체력 * 5 + 50
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

// 시작 균등 스탯 (주사위 굴림 전 베이스 — 4스탯)
// 총 50pt: 50/4 = 12.5 → 공격력/방어력 13, 체력/마력 12
export function uniformStartingStats(): Stats {
  return {
    공격력: 13, 방어력: 13, 체력: 12, 마력: 12,
    속도: 10, 행운: 0,
    명중률: 0, 회피율: 0,
    관통: 0,
    상태저항: 0,
  }
}

export function createCharacter(bonusStats: Partial<Stats> = {}, customStats?: Stats): Character {
  // customStats 가 주어지면 그대로 사용 (주사위 결과), 아니면 균등 시작
  const stats = customStats ?? uniformStartingStats()

  // 메타 보너스 적용 (자유 분배)
  for (const key in bonusStats) {
    const k = key as StatKey
    stats[k] = (stats[k] ?? 0) + (bonusStats[k] ?? 0)
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

// 클리어 등급 보너스 점수에 따른 분배 가능 포인트 계산용
export function getClearRank(score: number): { rank: string; bonus: number } {
  if (score >= 90) return { rank: 'EX', bonus: 10 }
  if (score >= 80) return { rank: 'SSS', bonus: 9 }
  if (score >= 70) return { rank: 'SS', bonus: 8 }
  if (score >= 60) return { rank: 'S', bonus: 7 }
  if (score >= 50) return { rank: 'A', bonus: 6 }
  if (score >= 40) return { rank: 'B', bonus: 5 }
  if (score >= 30) return { rank: 'C', bonus: 4 }
  if (score >= 20) return { rank: 'D', bonus: 3 }
  if (score >= 10) return { rank: 'E', bonus: 2 }
  return { rank: 'F', bonus: 1 }
}

export function computeClearScore(c: Character, chapter: number): number {
  // Equipment Score: (17 - 평균 16티어) / 16 × 100
  const weaponTier = c.weapon?.tier ?? 1
  const armorTier = c.armor?.tier ?? 1
  const avgTier = (weaponTier + armorTier) / 2
  const equipmentScore = ((17 - avgTier) / 16) * 100

  // Gold Score: 남은 골드 / 1890 × 100 (cap 100)
  const goldScore = Math.min(100, (c.gold / 1890) * 100)

  // HP Score: 남은 HP / 최대 HP × 100
  const hpScore = (c.hp / c.maxHp) * 100

  return Math.round((equipmentScore + goldScore + hpScore) / 3)
}
