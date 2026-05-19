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

  // 등급 +1, 레전드는 트레잇 한 단계↑
  const grades = ['노말', '레어', '스페셜', '레전드'] as const
  const traitTiers = ['하급', '보통', '희귀', '특별'] as const
  const curGradeIdx = grades.indexOf(character.weapon.grade)

  if (curGradeIdx < 3) {
    // 등급 +1
    const newGrade = grades[curGradeIdx + 1]
    const newItem = rollItem({
      kind: 'weapon',
      forceBaseKey: character.weapon.baseKey,
      forceTraitName: character.weapon.trait,
      forceGrade: newGrade,
    })
    character.weapon = newItem
    return { success: true, newItem }
  } else {
    // 레전드 → 트레잇 한 단계↑
    const curTier = WEAPON_TRAITS[character.weapon.trait]?.tier
    if (!curTier) return { success: false }
    const curTierIdx = traitTiers.indexOf(curTier)
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
  // 행운 보정
  const luckBonus = Math.max(0, luck)
  let pGreat = 0.05 + luckBonus * 0.01
  const pGood = 0.20
  const pNone = 0.30
  let pBad = Math.max(0, 0.25 - luckBonus * 0.005)
  let pTerrible = Math.max(0, 0.20 - luckBonus * 0.005)

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
  let newVal = cur + delta
  // 클램프
  if (['공격력', '방어력', '체력', '마력'].includes(stat)) {
    newVal = Math.max(3, newVal)
  } else {
    newVal = Math.max(0, newVal)
  }
  character.stats[stat] = newVal
  // 체력/마력 변경 시 max 갱신
  if (stat === '체력') {
    character.maxHp = newVal * 20 + 50
    character.hp = Math.min(character.hp, character.maxHp)
  }
  if (stat === '마력') {
    character.maxMp = newVal * 15 + 30
    character.mp = Math.min(character.mp, character.maxMp)
  }
}

// 9.14.5: 등가교환 제단 (스탯 -3 → 다른 스탯 +1)
export function exchangeStat(character: Character, from: StatKey, to: StatKey): boolean {
  if (from === to) return false
  if ((character.stats[from] ?? 0) < 6) return false  // 최소 3 유지
  applyRouletteResult(character, from, -3)
  applyRouletteResult(character, to, +1)
  return true
}

// 9.14.6: 암시장 브로커
export function blackMarketPrice(chapter: number, stat: StatKey): number {
  const base = 100 + 50 * chapter
  if (stat === '속도' || stat === '행운') return Math.round(base * 1.5)
  if (['명중률', '회피율', '관통', '관통', '상태저항'].includes(stat)) return Math.round(base * 0.7)
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

  // 무작위 스탯 +1
  const allStats: StatKey[] = ['공격력', '방어력', '체력', '마력', '속도', '행운', '명중률', '회피율', '관통', '상태저항']
  const stat = pickOne(allStats)
  applyRouletteResult(character, stat, +1)
  return { taken, randomStat: stat }
}
