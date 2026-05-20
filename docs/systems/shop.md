# 상점 시스템

## 개요
챕터의 특정 층에서 등장. 4개 슬롯의 아이템을 골드로 구매하거나 장착품/인벤토리를 판매.

## 인벤토리 구성
- 슬롯 수: 4 (`shop.slotCount`)
- 챕터 N에 따라 등급/티어 분포 가중치 변화 (높은 챕터일수록 좋은 등급 등장)
- 무기 / 갑옷 비율 무작위

## 새로고침 (`refreshShop`)
- 챠지 시스템: 시작 시 `cap`만큼 보유, 사용 시 차감
- 챕터 종료 시 회복 또는 베이스 새로고침
- "위기 모험가" 동료 이벤트 → 다음 새로고침 슬롯 +1 (`applyRefreshBoost`)
- 챌린지 "리롤 금지령" → 새로고침 차단 (`noShopRefresh`)

## 구매 흐름
1. `buyItem(item)` — 인벤토리에 적재만
2. `buyItemAndEquip(item)` — 즉시 장착 (기존 장비는 인벤토리로 스왑, 가득이면 폐기 동의)
3. 챌린지 `onShopBuy` 훅 호출
4. 인벤 가득이면 `pendingPickup` 모달

## 판매
- `sellEquipped(slot)` — 장착품 판매 → buyback 가격 회수 → [자동 장착](../features/auto-equip.md)
- `sellFromInventory(idx)` — 인벤토리 슬롯 판매
- `sellAllFromInventory()` — 일괄 판매

## 챌린지 가드
- `shopForbidden` — 상점 진입 차단 (불매 운동)
- 가격 제약 — 일부 챌린지는 상한 가격
- `canEquipItem` — 구매+장착 시 트레잇 호환성 검사

## 안드로이드 뒤로가기
상점에서 [뒤로가기](../features/back-button.md) 누르면 `leaveShop` 호출 → 다음 층.

## 관련 파일
- `src/core/shop.ts` — `createShop / refreshShop / applyRefreshBoost`
- `src/stores/game.ts` — `buyItem / buyItemAndEquip / sellEquipped / leaveShop / refreshShopAction`
- `src/screens/Shop.vue`
- `src/ui/images.ts` — `shopIconUrl`
- `public/images/NPC/상점.png`
