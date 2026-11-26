import type { Character, ItemInstance, Stats, StatKey } from '@/types'
import { rollItem } from './items'
import { pickOne, randInt, clamp } from './rng'
import { WEAPON_TRAITS, ARMOR_TRAITS } from '@/data/traits'

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
export function smithSuccessChance(bet: number, sellPrice: number): number {
  return clamp(bet / (Math.max(1, sellPrice) * 2), 0, 0.90)
}

// 60/40 슬롯 추첨 — 보유한 슬롯이 한쪽 뿐이면 자동으로 그 쪽
export function pickSmithSlot(character: Character): 'weapon' | 'armor' | null {
  const hasW = !!character.weapon
  const hasA = !!character.armor
  if (!hasW && !hasA) return null
  if (!hasW) return 'armor'
  if (!hasA) return 'weapon'
  return Math.random() < 0.60 ? 'weapon' : 'armor'
}

export function applySmithUpgrade(
  character: Character,
  bet: number,
  slot: 'weapon' | 'armor' = 'weapon',
): { success: boolean; newItem?: ItemInstance } {
  const cur = slot === 'weapon' ? character.weapon : character.armor
  if (!cur) return { success: false }
  if (character.gold < bet) return { success: false }
  character.gold -= bet

  const chance = smithSuccessChance(bet, cur.sellPrice)
  const success = Math.random() < chance
  if (!success) return { success: false }

  // 등급 +1, 레전드는 특성 한 단계↑
  const grades = ['노말', '레어', '스페셜', '레전드'] as const
  const traitTiers = ['하급', '보통', '희귀', '특별'] as const
  const curGradeIdx = grades.indexOf(cur.grade)
  const traitDefMap = slot === 'weapon' ? WEAPON_TRAITS : ARMOR_TRAITS
  const curTraitTier = traitDefMap[cur.trait]?.tier ?? '보통'

  if (curGradeIdx < 3) {
    const newGrade = grades[curGradeIdx + 1]
    const newItem = rollItem({
      kind: slot,
      forceBaseKey: cur.baseKey,
      forceTraitName: cur.trait,
      forceTraitTier: curTraitTier,
      forceGrade: newGrade,
    })
    if (slot === 'weapon') character.weapon = newItem
    else character.armor = newItem
    return { success: true, newItem }
  } else {
    const curTierIdx = traitTiers.indexOf(curTraitTier)
    if (curTierIdx >= 3) return { success: false }
    const newTier = traitTiers[curTierIdx + 1]
    const newItem = rollItem({
      kind: slot,
      forceBaseKey: cur.baseKey,
      forceTraitTier: newTier,
      forceGrade: '레전드',
    })
    if (slot === 'weapon') character.weapon = newItem
    else character.armor = newItem
    return { success: true, newItem }
  }
}

// v12: 부식 연성 — 등급/티어(1~16)를 그대로 유지한 채 장비 배율과 허점 위력을 강화 (최대 +3)
export function applySmithTemper(
  character: Character,
  bet: number,
  slot: 'weapon' | 'armor' = 'weapon',
): { success: boolean; newItem?: ItemInstance } {
  const cur = slot === 'weapon' ? character.weapon : character.armor
  if (!cur) return { success: false }
  const curLv = cur.temperLevel ?? 0
  if (curLv >= 3) return { success: false }
  if (character.gold < bet) return { success: false }
  character.gold -= bet

  const chance = smithSuccessChance(bet, cur.sellPrice * (1 + curLv * 0.5))
  if (Math.random() >= chance) return { success: false }

  const tempered: ItemInstance = {
    ...JSON.parse(JSON.stringify(cur)),
    temperLevel: curLv + 1,
  }
  if (slot === 'weapon') character.weapon = tempered
  else character.armor = tempered
  return { success: true, newItem: tempered }
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
//   장착 무기/갑옷 + 인벤토리 전체를 후보로 두고 tier 가장 높은 1개를 가져간다.
//   동률이면 (장착 무기 → 장착 갑옷 → 인벤 idx 0…) 순으로 우선.
//   호출부가 인벤에서 splice 할 수 있게 fromInventoryIndex 를 반환.
export function greedyCollectorTake(
  character: Character,
  inventory: ItemInstance[] = [],
): { taken: ItemInstance | null; randomStat?: StatKey; fromInventoryIndex?: number } {
  type Cand = { item: ItemInstance; source: 'weapon' | 'armor' | 'inventory'; idx: number }
  const candidates: Cand[] = []
  if (character.weapon) candidates.push({ item: character.weapon, source: 'weapon', idx: -1 })
  if (character.armor)  candidates.push({ item: character.armor,  source: 'armor',  idx: -1 })
  inventory.forEach((it, i) => candidates.push({ item: it, source: 'inventory', idx: i }))
  if (candidates.length === 0) return { taken: null }

  // 가장 높은 tier 우선, 동률은 입력 순서(= 장착 우선) 유지를 위해 stable 정렬.
  let best = candidates[0]
  for (let i = 1; i < candidates.length; i++) {
    if (candidates[i].item.tier > best.item.tier) best = candidates[i]
  }

  if (best.source === 'weapon') character.weapon = null
  else if (best.source === 'armor') character.armor = null
  // inventory 제거는 호출부에서 splice (run 컨텍스트 필요)

  // 무작위 스탯 +1 (v6 5스탯)
  const allStats: StatKey[] = ['힘', '민첩', '체력', '마력', '행운']
  const stat = pickOne(allStats)
  applyRouletteResult(character, stat, +1)
  return {
    taken: best.item,
    randomStat: stat,
    fromInventoryIndex: best.source === 'inventory' ? best.idx : undefined,
  }
}
