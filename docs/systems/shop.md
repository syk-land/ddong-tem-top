# 상점 시스템 — 황금고블린

코드: `src/core/shop.ts`, `src/screens/Shop.vue`

---

## 매물

- 챕터당 1~2회 등장.
- 매물 3종: 무기/갑옷 무작위 (`rollItem({source: 'shop', chapter})`).
- 챕터별 등급 풀 점진 상향:
  - 챕터 1~3: 노말 중심
  - 챕터 4~6: 레어 늘어남
  - 챕터 7~9: 스페셜 등장
  - 챕터 10: 레전드 가능

---

## 가격 (`item.buyPrice`)

`itemValue.ts:computeItemValue` 의 atkValue + defValue 기반 휴리스틱:
```
price = round((atkValue + defValue) × grade_multiplier × trait_multiplier)
```

판매가 (`buyback`) ≈ 구매가 × 0.4 (대장장이 베팅 등에서도 사용).

---

## 새로고침

```ts
ShopRefreshState {
  charges: number   // 남은 새로고침 횟수
  cap: number       // 최대 (기본 1, 황금고블린 이벤트로 3까지)
  usedAtMax: boolean
  eventBoostActive: boolean
}
```

- 챕터 진입 시 `charges = cap` 으로 충전 (`tower.ts:135`).
- 새로고침 1회 비용: `chapter × 10G` 정도 (점진 상승).
- 새로고침 시 매물 전체 재추첨.

---

## 구매 / 판매

### 구매
- 자동 장착 (`buyItemAndEquip`) — 같은 슬롯에 기존 장비 있으면 인벤토리로.
- 인벤토리 가득(15칸 기본) 시 `PickupModal` 띄움 — 신규 거부 or 기존 슬롯 교체.
- 챌린지 `noShop` (불매운동/진정한무소유) 활성 시 진입 불가.

### 판매
- 장착 무기/갑옷 → `+buybackG 판매` 버튼.
- 인벤토리 → 개별 판매 or 전부 판매.
- 챌린지 `noBuyback` (파괴주의자) → 판매 불가.

---

## 챌린지 상호작용

| 챌린지 | 효과 |
|---|---|
| 불매운동, 진정한무소유 | 상점 진입 불가 (`noShop`) |
| 리롤금지령 | 새로고침 불가 (`noShopRefresh`) |
| 정가매입 | 할인 효과 X (`noShopDiscount`) |
| 명품거부증 | 1회라도 구매 시 실패 (`trackNoShopBuy`) |
| 짠돌이의탑 | 누적 소비 300 초과 시 실패 (`trackTotalSpendUnder300`) |
| 황금고블린파트너 | 매 챕터 새로고침 사용 (`trackUseRefreshEveryChapter`) |
| **고집불통** | **새로고침 1회라도 사용 시 실패** (`trackNoRefreshEver`) |
| 파괴주의자 | buyback 불가 (`noBuyback`) |
