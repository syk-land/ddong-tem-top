import type { ShopState, ShopRefreshState, ItemInstance, Character } from '@/types'
import { rollItem } from './items'
import { hasRelic } from './junkSynergy'

export function getItemBuyPrice(item: ItemInstance, character?: Character | null): number {
  if (character && hasRelic(character, 'lead_dice')) {
    return Math.max(1, Math.round(item.buyPrice * 0.85))
  }
  return item.buyPrice
}

export function getShopTemperCost(chapter: number, character?: Character | null): number {
  const base = 60 + chapter * 35
  if (character && hasRelic(character, 'lead_dice')) {
    return Math.max(1, Math.round(base * 0.85))
  }
  return base
}

// 8.1 슬롯 수: 3 + (챕터-1) // 3
export function shopSlotCount(chapter: number): number {
  return 3 + Math.floor((chapter - 1) / 3)
}

// 8.3 인벤토리 무작위 추첨 (무기/갑옷 50:50)
//   tutorialForceAcc: 첫 상점 학습용 — 모든 매물에 명중 트레이트 강제.
//     명중 회피 미스 누적으로 튜토리얼이 늘어지지 않게.
//     무기 → "날카로운" (+5 명중), 갑옷 → "정밀한" (+8 명중) — 트레이트 등급
//     '보통' 이지만 grade(노말~레전드) 는 자유라 매물 다양성은 유지됨.
export function generateShopInventory(chapter: number, opts: { tutorialForceAcc?: boolean } = {}): ItemInstance[] {
  const count = shopSlotCount(chapter)
  const items: ItemInstance[] = []
  for (let i = 0; i < count; i++) {
    const kind = Math.random() < 0.5 ? 'weapon' : 'armor'
    const forceTraitName = opts.tutorialForceAcc
      ? (kind === 'weapon' ? '날카로운' : '정밀한')
      : undefined
    items.push(rollItem({ kind, chapter, source: 'shop', forceTraitName }))
  }
  return items
}

export function createShop(chapter: number, opts: { tutorialForceAcc?: boolean } = {}): ShopState {
  return {
    inventory: generateShopInventory(chapter, opts),
    slotCount: shopSlotCount(chapter),
    temperUsed: false,
  }
}

export function refreshShop(shop: ShopState, refresh: ShopRefreshState, chapter: number, opts: { tutorialForceAcc?: boolean } = {}): boolean {
  if (refresh.charges <= 0) return false

  // 3-충전 페널티 플래그
  if (refresh.eventBoostActive && refresh.charges === refresh.cap && refresh.cap === 3) {
    refresh.usedAtMax = true
  }
  refresh.charges -= 1
  shop.inventory = generateShopInventory(chapter, opts)
  return true
}

// 이벤트로 부스트 (위기 모험가 동료 등에서 사용 가능)
export function applyRefreshBoost(refresh: ShopRefreshState) {
  if (!refresh.eventBoostActive) {
    refresh.cap = 3
    refresh.eventBoostActive = true
    refresh.charges = Math.min(refresh.charges + 1, refresh.cap)
  }
}
