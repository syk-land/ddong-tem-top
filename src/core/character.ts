import type { Character, Stats, StatKey } from '@/types'
import { RANDOM_STAT_KEYS } from '@/types'
import { randInt, pickOne, randFloat } from './rng'
import { rollItem } from './items'

// v9.x: 5스탯 (힘/민첩/체력/마력/행운) 무작위 분배
// 총 60pt: 각 stat 최소 0, 최대 cap 없음
export function generateRandomStats(): Stats {
  const stats: Stats = {
    힘: 0, 민첩: 0, 체력: 0, 마력: 0, 행운: 0,
  }

  let remaining = 60
  while (remaining > 0) {
    const key = pickOne(RANDOM_STAT_KEYS)
    stats[key] += 1
    remaining -= 1
  }
  return stats
}

// 스탯 → 실수치 변환 (v3 재밸런싱)
// v10: HP/MP 풀 ×2 — 한 방에 끝나지 않도록 체력 여유 확보
// 체력 1pt = +20 HP (변경 전 +10).
// effectiveStats 의 체력/마력은 trait 보정으로 소수가 될 수 있어 반환 시 정수화.
export function computeMaxHp(체력: number): number {
  return Math.round(체력 * 20 + 100)
}

// 마력 1pt = +30 MP + 모든 공격 데미지 +1 가산 (stats.ts에서 처리). 변경 전 +15
export function computeMaxMp(마력: number): number {
  return Math.round(마력 * 30 + 60)
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

// v9.x: 시작 균등 스탯 — 5스탯 각 12pt (총 60pt)
export function uniformStartingStats(): Stats {
  return {
    힘: 12, 민첩: 12, 체력: 12, 마력: 12, 행운: 12,
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

// v10: 클리어 등급 — 도달 챕터 + 티어 총합 기반
//   미클리어(중간 사망):
//     도달 챕터 4~6     → F (1pt)
//     도달 챕터 7~9     → E (2pt)
//     도달 챕터 1~3     → 등급 없음
//   클리어 (10챕터 100층 돌파) — 티어 총합 (무기+갑옷, 2~32 범위) 백분위:
//     상위 10% (30~32)  → D   (3pt)   ← "고티어 장비로 클리어"
//     10~20% (27~29)    → C   (4pt)
//     20~30% (24~26)    → B   (5pt)
//     30~40% (21~23)    → A   (6pt)
//     40~50% (18~20)    → S   (7pt)
//     50~60% (15~17)    → SS  (8pt)
//     60~70% (12~14)    → SSS (9pt)
//     70%+  (~11 이하)  → EX  (10pt)  ← "똥템 클리어"
export function getClearRank(
  score: number,
  opts: { reachedChapter?: number; cleared?: boolean } = {},
): { rank: string; bonus: number } {
  const cleared = opts.cleared ?? true   // 기본: 클리어 가정 (ItemDetail/projected 용)
  const reached = opts.reachedChapter ?? 10
  if (!cleared) {
    if (reached >= 7) return { rank: 'E', bonus: 2 }
    if (reached >= 4) return { rank: 'F', bonus: 1 }
    return { rank: '-', bonus: 0 }
  }
  // 클리어 — 티어 총합 백분위 (낮을수록 = 똥템 = 좋은 등급)
  if (score >= 30) return { rank: 'D',   bonus: 3 }
  if (score >= 27) return { rank: 'C',   bonus: 4 }
  if (score >= 24) return { rank: 'B',   bonus: 5 }
  if (score >= 21) return { rank: 'A',   bonus: 6 }
  if (score >= 18) return { rank: 'S',   bonus: 7 }
  if (score >= 15) return { rank: 'SS',  bonus: 8 }
  if (score >= 12) return { rank: 'SSS', bonus: 9 }
  return { rank: 'EX', bonus: 10 }
}

// v6: 점수 = 무기 티어 + 갑옷 티어 (장비 없으면 1로 카운트). 낮을수록 좋음 (역설).
export function computeClearScore(c: Character, _chapter: number): number {
  const weaponTier = c.weapon?.tier ?? 1
  const armorTier = c.armor?.tier ?? 1
  return weaponTier + armorTier
}
