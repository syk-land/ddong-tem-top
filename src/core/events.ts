import type { Character, ItemInstance, Stats, StatKey } from '@/types'
import { rollItem } from './items'
import { pickOne, randInt, clamp } from './rng'
import { WEAPON_TRAITS } from '@/data/traits'

// 9.14 + 신규 6종 특별 이벤트
export type SpecialEventKey =
  | 'crisis_adventurer'
  | 'wandering_smith'
  | 'cursed_gambler'
  | 'exchange_altar'
  | 'black_market'
  | 'greedy_collector'  // 신규

export const SPECIAL_EVENTS: SpecialEventKey[] = [
  'crisis_adventurer',
  'wandering_smith',
  'cursed_gambler',
  'exchange_altar',
  'black_market',
  'greedy_collector',
]

export const SPECIAL_EVENT_INFO: Record<SpecialEventKey, { name: string; description: string }> = {
  crisis_adventurer: {
    name: '위기에 빠진 모험가',
    description: '함정에 빠진 모험가를 발견했다. 구해줄지 결정해야 한다.',
  },
  wandering_smith: {
    name: '떠돌이 대장장이',
    description: '낯선 대장장이가 무기 강화를 제안한다.',
  },
  cursed_gambler: {
    name: '저주받은 도박사의 룰렛',
    description: '악마의 룰렛이 당신을 기다린다. 스탯을 걸어볼 텐가?',
  },
  exchange_altar: {
    name: '고대 신의 등가교환 제단',
    description: '한 스탯을 희생해 다른 스탯을 얻을 수 있다.',
  },
  black_market: {
    name: '암시장 스탯 브로커',
    description: '골드로 능력치를 살 수 있는 어둠의 상인.',
  },
  greedy_collector: {
    name: '탐욕의 수집가',
    description: '수집가가 당신의 가장 좋은 장비를 요구한다.',
  },
}

// 9.14.2: 위기에 빠진 모험가
export function resolveCrisisAdventurer(): 'ally' | 'villain' {
  return Math.random() < 0.70 ? 'ally' : 'villain'
}

// 9.14.3: 떠돌이 대장장이
export function smithSuccessChance(bet: number, weaponSell: number): number {
  return clamp(bet / (Math.max(1, weaponSell) * 2), 0, 0.90)
}

export function applySmithUpgrade(character: Character, bet: number): { success: boolean; newItem?: ItemInstance } {
  if (!character.weapon) return { success: false }
  if (character.gold < bet) return { success: false }
  character.gold -= bet

  const chance = smithSuccessChance(bet, character.weapon.sellPrice)
  const success = Math.random() < chance
  if (!success) return { success: false }

  // 등급 +1, 레전드는 특성 한 단계↑
  const grades = ['노말', '레어', '스페셜', '레전드'] as const
  const traitTiers = ['하급', '보통', '희귀', '특별'] as const
  const curGradeIdx = grades.indexOf(character.weapon.grade)

  // 현재 무기의 특성 티어 (forceTraitTier 명시 필요 — items.ts 가 forceTraitTier && forceGrade 둘 다 있어야 tier 강제)
  const curTraitTier = WEAPON_TRAITS[character.weapon.trait]?.tier ?? '보통'

  if (curGradeIdx < 3) {
    // 등급 +1 — 특성/베이스 그대로
    const newGrade = grades[curGradeIdx + 1]
    const newItem = rollItem({
      kind: 'weapon',
      forceBaseKey: character.weapon.baseKey,
      forceTraitName: character.weapon.trait,
      forceTraitTier: curTraitTier,
      forceGrade: newGrade,
    })
    character.weapon = newItem
    return { success: true, newItem }
  } else {
    // 레전드 → 특성 한 단계↑ (특성 이름은 새로 — pool 에서 무작위)
    const curTierIdx = traitTiers.indexOf(curTraitTier)
    if (curTierIdx >= 3) return { success: false }
    const newTier = traitTiers[curTierIdx + 1]
    const newItem = rollItem({
      kind: 'weapon',
      forceBaseKey: character.weapon.baseKey,
      forceTraitTier: newTier,
      forceGrade: '레전드',
    })
    character.weapon = newItem
    return { success: true, newItem }
  }
}

// 9.14.4: 도박사 룰렛
export interface RouletteResult {
  outcome: '대성공' | '성공' | '무효' | '실패' | '대실패'
  delta: number
}

export function spinRoulette(luck: number): RouletteResult {
  // 행운 보정 — 행운 10 (균등 캐릭) 기준 EV ≈ +0.85 (대부분 이득)
  const luckBonus = Math.max(0, luck)
  let pGreat = 0.10 + luckBonus * 0.012
  const pGood = 0.25
  const pNone = 0.30
  let pBad = Math.max(0, 0.20 - luckBonus * 0.006)
  let pTerrible = Math.max(0, 0.15 - luckBonus * 0.006)

  // 정규화
  const total = pGreat + pGood + pNone + pBad + pTerrible
  pGreat /= total
  pBad /= total
  pTerrible /= total

  const roll = Math.random()
  let acc = 0
  acc += pGreat; if (roll < acc) return { outcome: '대성공', delta: 5 }
  acc += pGood; if (roll < acc) return { outcome: '성공', delta: 2 }
  acc += pNone; if (roll < acc) return { outcome: '무효', delta: 0 }
  acc += pBad; if (roll < acc) return { outcome: '실패', delta: -2 }
  return { outcome: '대실패', delta: -5 }
}

export function applyRouletteResult(character: Character, stat: StatKey, delta: number) {
  const cur = character.stats[stat] ?? 0
  // v9.x: 최소 0
  const newVal = Math.max(0, cur + delta)
  character.stats[stat] = newVal
  // 체력/마력 변경 시 max 갱신
  if (stat === '체력') {
    character.maxHp = newVal * 10 + 50
    character.hp = Math.min(character.hp, character.maxHp)
  }
  if (stat === '마력') {
    character.maxMp = newVal * 15 + 30
    character.mp = Math.min(character.mp, character.maxMp)
  }
}

// 9.14.5: 등가교환 제단 (스탯 -3 → 다른 스탯 +2)
export function exchangeStat(character: Character, from: StatKey, to: StatKey): boolean {
  if (from === to) return false
  if ((character.stats[from] ?? 0) < 3) return false  // v9.x: -3 가능하려면 from ≥ 3
  applyRouletteResult(character, from, -3)
  applyRouletteResult(character, to, +2)
  return true
}

// 9.14.6: 암시장 브로커 — v6 5스탯
//   행운은 가장 비쌈(파생 효과 다양), 민첩 중간, 나머지 표준.
export function blackMarketPrice(chapter: number, stat: StatKey): number {
  const base = 100 + 50 * chapter
  if (stat === '행운') return Math.round(base * 1.5)
  if (stat === '민첩') return Math.round(base * 1.2)
  return base
}

export function buyStatPoint(character: Character, chapter: number, stat: StatKey): boolean {
  const price = blackMarketPrice(chapter, stat)
  if (character.gold < price) return false
  character.gold -= price
  applyRouletteResult(character, stat, +1)
  return true
}

// 신규: 탐욕의 수집가
export function greedyCollectorTake(character: Character): { taken: ItemInstance | null; randomStat?: StatKey } {
  // 가장 높은 tier 장비 선택
  const w = character.weapon
  const a = character.armor
  let taken: ItemInstance | null = null
  if (w && a) {
    taken = w.tier >= a.tier ? w : a
  } else {
    taken = w || a
  }
  if (!taken) return { taken: null }
  if (taken === w) character.weapon = null
  else character.armor = null

  // 무작위 스탯 +1 (v6 5스탯)
  const allStats: StatKey[] = ['힘', '민첩', '체력', '마력', '행운']
  const stat = pickOne(allStats)
  applyRouletteResult(character, stat, +1)
  return { taken, randomStat: stat }
}
