# 빈 장비 슬롯 자동 장착

## 개요
무기 또는 갑옷 슬롯이 비어있고 인벤토리에 같은 종류 아이템이 있으면 자동으로 가장 좋은 것(`tier` 우선)을 장착한다.

## 호출 시점
- **상점에서 장착품 판매**(`sellEquipped`) — 슬롯이 막 빈 직후
- **드랍/구매로 인벤토리 적재**(`receiveItem`) — 적재 후 빈 슬롯에 자동 이동
- `unequipToInventory`는 트리거 안 함 (사용자가 명시적으로 슬롯을 비웠으므로 의도 충돌)

## 알고리즘
```
for slot in [weapon, armor]:
    if 슬롯 비어있음:
        후보 = 인벤토리에서 kind=슬롯 + 챌린지 canEquipItem OK
        bestIdx = 후보 중 tier 가장 큰 (동률은 인벤토리 앞쪽)
        bestIdx 있으면:
            character[slot] = item
            challengeContext.onEquipItem(item, null)
            inventory.splice(bestIdx, 1)
            changed = true
if changed: recomputeDerivedStats()
```

## 챌린지 호환
- `canEquipItem(item, challengeContext)`로 거부되는 아이템은 자동 장착 후보에서 제외
- "저주의 동반자" 같은 추적형 챌린지의 `onEquipItem` 훅도 정상 호출

## 관련 파일
- `src/stores/game.ts` — `autoEquipFromInventory / sellEquipped / receiveItem`
- `src/core/challengeRuntime.ts` — `canEquipItem / onEquipItem`

## 제약 / 메모
- 미니멀리스트 챌린지(인벤토리 0칸)에서는 `receiveItem` 자체가 적재 안 함 → 자동 장착도 트리거 안 됨 (정상).
- 자동 장착으로 떠난 아이템은 인벤토리에서 빠지므로, 곧바로 같은 슬롯에 새 아이템이 들어와도 충돌 없음.
