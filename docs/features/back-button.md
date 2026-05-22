# 안드로이드 뒤로가기 / Esc

> Capacitor `backButton` → 모달 / 상점 우선 닫기. 데스크탑 Esc 동일.

코드: `src/main.ts` (`CapApp.addListener('backButton')`), `src/stores/game.ts` (`handleBackButton`)

---

## 우선순위

```
1. PickupModal (인벤토리 풀) → 신규 포기
2. DialogModal (alert/confirm) → 취소 / 마지막 버튼
3. InputModal (텍스트/숫자 입력) → null 취소
4. ListModal (리스트 선택) → null 취소
5. IntroComic (인트로 만화) → 닫기 (현재 페이지에서 종료)
6. Shop (상점) → 다음 층 진입
7. 처리된 모달 없음 → 기본 동작 (앱 종료 / 페이지 이전)
```

---

## 등록

### 안드로이드 (Capacitor)

`src/main.ts`:
```ts
import { App as CapApp } from '@capacitor/app'

CapApp.addListener('backButton', () => {
  const handled = game.handleBackButton()
  if (!handled) {
    CapApp.exitApp()   // 또는 기본 동작
  }
})
```

### 데스크탑 (브라우저)

`App.vue` 또는 `main.ts`:
```ts
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    const handled = game.handleBackButton()
    if (handled) e.preventDefault()
  }
})
```

---

## handleBackButton 로직

```ts
function handleBackButton(): boolean {
  // 1. 인벤토리 풀 모달
  if (this.pickupModal) {
    this.dismissPickup()
    return true
  }
  // 2. Dialog 모달
  if (this.dialogModal) {
    this.resolveDialog(this.dialogModal.cancelValue)
    return true
  }
  // 3. Input 모달
  if (this.inputModal) {
    this.resolveInput(null)
    return true
  }
  // 4. List 모달
  if (this.listModal) {
    this.resolveList(null)
    return true
  }
  // 5. 인트로 만화
  if (this.introVisible) {
    this.closeIntro()
    return true
  }
  // 6. 상점
  if (this.screen === 'shop') {
    this.leaveShop()
    return true
  }
  // 7. 처리 안 됨 — 기본 동작
  return false
}
```

---

## 알려진 제약

- **앱 종료 확인 없음**: 게임 진행 중 모달 없이 뒤로가기 → 즉시 종료 → "정말 종료할까요?" 확인 추가 여지
- 전투 화면에서 뒤로가기는 처리 안 됨 (자동 전투라 그대로 진행)
- 진짜 보스 화면도 뒤로가기로 나갈 수 없음 (도전 모드)
