# 안드로이드 뒤로가기 = 취소 버튼

## 개요
Capacitor 환경(안드로이드 빌드)에서 하드웨어/제스처 뒤로가기를 누르면 떠있는 모달/오버레이를 우선순위로 닫는다. 닫을 게 없을 때만 디폴트(앱 종료) 동작.

## 우선순위
1. **`pendingPickup` 모달** — 신규 아이템 거부 (`resolvePickupRefuse`)
2. **`dialog`** (alert/confirm) — 취소 버튼 value(`false`) 또는 마지막 버튼 value로 닫음
3. **`inputDialog`** (prompt) — `null`
4. **`listDialog`** — `null`
5. **인트로 만화** — `closeIntroComic`
6. **상점 화면**(`screen === 'shop'`) — `leaveShop` (다음 층으로 이동)
7. 위 모두 없으면 `false` 반환 → `canGoBack=false`일 경우 `CapApp.exitApp()`

## 등록 위치
`src/main.ts`의 부팅 직후 IIFE:
- 동적 `import('@capacitor/app')` 성공 시 `CapApp.addListener('backButton', ...)` 연결
- 실패(웹/데스크탑) 시 `keydown Escape`를 동일 처리에 연결

## 관련 파일
- `src/main.ts` — 리스너 등록
- `src/stores/game.ts` — `handleBackButton()` 액션
- `package.json` — `@capacitor/app ^6.0.3`

## 제약 / 메모
- 데스크탑에서 ESC가 인풋 포커스를 빼앗는 다른 UI와 충돌하지 않도록 `handleBackButton` 이 true 반환할 때만 `preventDefault()` 호출.
- 모달/상점 외 화면에서는 뒤로가기를 막지 않아 안드로이드 디폴트(앱 종료)가 동작한다 — 게임 중 실수로 종료될 수 있으니 향후 "정말 종료할까요?" 확인을 추가할 여지가 있다.
