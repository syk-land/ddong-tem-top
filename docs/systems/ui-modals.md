# UI 모달 시스템

## 개요
브라우저 native `alert / confirm / prompt`를 대체하는 Promise 기반 모달 4종. game store 안에서 단일 인스턴스로 관리되어 동시에 여러 모달이 뜨지 않음.

## 4종 모달

### 1. DialogModal (alert / confirm)
```ts
await game.alertModal(message, title?, imageUrl?)
await game.confirmModal(message, { title, okLabel, cancelLabel, danger, imageUrl })
```
- 버튼 배열 자유 구성 (`showDialog({buttons: [...]})`)
- value 반환 — 어떤 버튼이 눌렸는지

### 2. InputModal (prompt)
```ts
const text = await game.showInputDialog({
  title, message, defaultValue, placeholder, maxValue, okLabel, imageUrl,
})
```
- 숫자 입력 시 `maxValue`로 상한 표시
- 취소 → null

### 3. ListModal (선택지)
```ts
const choice = await game.showListDialog<T>({
  title, message, options: [{ label, value: T, sub, class }, ...], cancelLabel,
})
```
- 동적 옵션 리스트
- 취소 → null

### 4. PickupModal (인벤토리 풀 알림)
```ts
this.pendingPickup = item  // 자동 표시
// 사용자 선택:
this.resolvePickupDiscardSlot(idx)  // 슬롯 idx 폐기 + 새 거 적재
this.resolvePickupRefuse()           // 거부
```

## 안드로이드 뒤로가기 우선순위
[back-button](../features/back-button.md) 참조:
1. pendingPickup
2. dialog
3. inputDialog
4. listDialog
5. introVisible
6. screen === 'shop'

각각 취소 값으로 닫음.

## 관련 파일
- `src/ui/components/DialogModal.vue` (alert/confirm)
- `src/ui/components/InputModal.vue` (prompt)
- `src/ui/components/ListModal.vue` (list)
- `src/ui/components/PickupModal.vue` (인벤토리 풀)
- `src/stores/game.ts` — `showDialog / resolveDialog / alertModal / confirmModal / showInputDialog / showListDialog / resolvePickupDiscardSlot / resolvePickupRefuse / handleBackButton`
