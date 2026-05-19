import type { ShopState, ShopRefreshState, ItemInstance } from '@/types'
import { rollItem } from './items'

// 8.1 슬롯 수: 3 + (챕터-1) // 3
export function shopSlotCount(chapter: number): number {
  return 3 + Math.floor((chapter - 1) / 3)
}

// 8.3 인벤토리 무작위 추첨 (무기/갑옷 50:50)
export function generateShopInventory(chapter: number): ItemInstance[] {
  const count = shopSlotCount(chapter)
  const items: ItemInstance[] = []
  for (let i = 0; i < count; i++) {
    const kind = Math.random() < 0.5 ? 'weapon' : 'armor'
    items.push(rollItem({ kind, chapter, source: 'shop' }))
  }
  return items
}

export function createShop(chapter: number): ShopState {
  return {
    inventory: generateShopInventory(chapter),
    slotCount: shopSlotCount(chapter),
  }
}

export function refreshShop(shop: ShopState, refresh: ShopRefreshState, chapter: number): boolean {
  if (refresh.charges <= 0) return false

  // 3-충전 페널티 플래그
  if (refresh.eventBoostActive && refresh.charges === refresh.cap && refresh.cap === 3) {
    refresh.usedAtMax = true
  }
  refresh.charges -= 1
  shop.inventory = generateShopInventory(chapter)
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
