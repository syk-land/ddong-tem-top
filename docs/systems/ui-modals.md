# UI / 모달 시스템

코드: `src/App.vue` (라우팅), `src/ui/components/*Modal.vue`

---

## 화면 라우팅

`App.vue` 의 `currentScreen` 기반 단일 라우터. `game.screen` 값으로 분기:

| 값 | 컴포넌트 |
|---|---|
| `menu` | `MainMenu.vue` |
| `create` | `CharacterCreation.vue` |
| `dungeon` | `Dungeon.vue` |
| `combat` | `Combat.vue` |
| `shop` | `Shop.vue` |
| `victory` | `VictoryScreen.vue` |
| `gameover` | `GameOver.vue` |
| `realboss` | `RealBossChallenge.vue` |
| `realboss_result` | `RealBossResult.vue` |

추가 오버레이:
- `SplashScreen` (최초 로드 시)
- `IntroComic` (튜토리얼 만화, introVisible 시)
- `SpeedControl` (전역, 우하단 토글)

---

## 범용 모달 (4종)

### DialogModal — alert / confirm
```ts
game.alertModal(message, title?, imageUrl?)
game.confirmModal(message, { title?, okLabel?, cancelLabel?, danger?, imageUrl? }): boolean
```
- `buttons[]` 로 다중 옵션 가능.
- `imageUrl` 지정 시 상단 NPC 일러스트.

### InputModal — prompt
```ts
game.inputModal(message, { title?, defaultValue?, placeholder?, maxValue?, okLabel?, imageUrl? }): string | null
```

### ListModal — list select
```ts
game.listModal({ title?, message?, options: [{ label, value, sub?, class? }], cancelLabel?, imageUrl? }): unknown | null
```

### PickupModal — 인벤토리 가득
신규 아이템 입수 시 슬롯 가득이면 자동 표시:
- 신규 아이템 미리보기
- 인벤토리 슬롯 리스트 → 클릭으로 그 슬롯 폐기 + 신규 적재
- "신규 포기" 버튼

---

## 인트로 만화 (`IntroComic`)

3가지 흐름:
- `first` — 최초 실행 (splash 닫힘 후 자동): main → t1 → t2 → 메뉴
- `replay` — 설정에서 다시보기: main → t1 → t2 (도전 미완) / + t3 (도전 완료 시)
- `afterRealBoss` — 진짜 보스 결과 후: t1 → t2 → t3 → 캐릭터 생성

`game.introVisible`, `game.introPage`, `game.introFlow` 상태.
페이지 클릭 → `nextIntroPage()` → 다음 페이지 or 닫기.

이미지: `/images/TUTORIAL/{page}.png?v=3` (캐시 무효화).

---

## 속도 컨트롤 (`SpeedControl`)

전역 우하단 위젯. 펼침/접힘 상태.

- 1x / 2x / 4x 속도 토글
- 자동 진입 토글 (몬스터/보스/회복샘)
- 인트로 만화 다시보기 버튼
- 사운드 ON/OFF (BGM/SFX)

**4배속 / 자동 진입은 광고 시청 확인 모달 필요** (PoC):
```
"광고를 보고 4배속을 사용하시겠습니까?" [예 / 아니오]
```

캐릭터 생성 화면 진입 시 자동으로 1배속 / 자동 OFF 리셋.

---

## 안드로이드 뒤로가기

`game.handleBackButton()` 우선순위:
1. `pendingPickup` → 신규 거부
2. `dialog/inputDialog/listDialog` → 취소
3. `introVisible` → 닫음
4. `screen === 'shop'` → 상점 나가기
5. (그 외) → false 반환 (앱 종료)

Capacitor `App.addListener('backButton')` 에 연결.

---

## 색상 / 스타일 (`ui/colors.ts`)

- `gradeColorClass` — 노말/레어/스페셜/레전드 색상
- `tierColorClass(tier)` — T1~14 별 색상 (트레잇 티어 매핑)
- `statColorClass` — 5스탯 색상 (힘/민첩/체력/마력/행운)
- `themeColorClass` — 챕터 테마별 색상
- `rankColorClass` — F~EX 등급 색상
- `formatItemNameHTML(item)` — 아이템 이름 HTML 분해 (특성+등급+베이스)

Tailwind 커스텀 클래스 + CSS 변수 (`styles/main.css`).
