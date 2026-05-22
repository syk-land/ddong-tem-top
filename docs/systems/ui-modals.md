# UI / 모달 시스템

> 화면 라우팅 + 11 종 공통 모달 컴포넌트.

코드: `src/App.vue`, `src/screens/*.vue`, `src/ui/components/*.vue`

---

## 화면 라우팅

`App.vue` 의 `screen` 상태 기반 단일 라우터:

```
'splash' | 'menu' | 'create' | 'dungeon' | 'combat' | 'shop'
| 'victory' | 'gameover' | 'realboss' | 'realboss_result' | 'settings'
```

| 값 | 컴포넌트 | 진입 |
|---|---|---|
| splash | `SplashScreen.vue` | 첫 로드 (클릭 시 닫힘) |
| menu | `MainMenu.vue` | 기본 |
| create | `CharacterCreation.vue` | "새 캐릭터" |
| dungeon | `Dungeon.vue` | 탑 진행 |
| combat | `Combat.vue` | 전투 노드 진입 |
| shop | `Shop.vue` | 상점 노드 진입 |
| victory | `VictoryScreen.vue` | 100층 클리어 |
| gameover | `GameOver.vue` | HP 0 |
| realboss | `RealBossChallenge.vue` | 진짜 보스 도전 |
| realboss_result | `RealBossResult.vue` | 도전 결과 |
| settings | `SettingsScreen.vue` | 메뉴 → 설정 |

**인트로 만화**: `introVisible` 오버레이 (별도 라우팅 값 아님).

---

## 모달 컴포넌트 (`src/ui/components/`)

### 시스템 모달

| 컴포넌트 | 역할 |
|---|---|
| `DialogModal` | alert / confirm 대체 (제목 / 메시지 / 버튼 배열) |
| `InputModal` | 텍스트 / 숫자 입력 (Enter 제출, Esc 취소) |
| `ListModal` | 리스트 선택 (NPC 이벤트용, sub 텍스트 지원) |
| `PickupModal` | 인벤토리 가득 시 슬롯 선택 폐기 또는 신규 포기 |

### 게임 정보 모달

| 컴포넌트 | 역할 |
|---|---|
| `InventoryModal` | 착용 중 / 보관함 탭. 장착 / 폐기 / 해제 버튼 |
| `ItemDetail` | 아이템 전투력 분해 (공격/방어 클릭 시 구성 요소 상세) |
| `StatusModal` | 5스탯 + 능력치 + 상태이상 + 장착 장비 + 활성 챌린지 |
| `StatusBadges` | 상태이상 목록 (점화/출혈/독/둔화/암흑/감전) — 아이콘 + 스택 + 지속시간 |

### 게이지 / 패널

| 컴포넌트 | 역할 |
|---|---|
| `HpMpBar` | 게이지 바 (25% 이하 깜빡임, 0% 숨김) |
| `SpeedControl` | 전역 제어판 (속도 1/2/4× / 자동 진입 / 사운드 슬라이더 / 인트로 재생) |
| `GrowthPenaltyPanel` | 클리어 등급 예상 (6챕터부터 표시) — 다음 회차 보너스 미리보기 |
| `IntroComic` | 인트로 만화 페이지 (탭 / 클릭 진행) |
| `ItemName` | 아이템 이름 칩 (등급 색상 + 특성 prefix) |

---

## 모달 우선순위 (뒤로가기 / Esc)

자세히: [../features/back-button.md](../features/back-button.md)

```
1. PickupModal (인벤토리 풀)   → 신규 포기
2. DialogModal                   → 취소 / 마지막 버튼
3. InputModal                    → null 취소
4. ListModal                     → null 취소
5. IntroComic                    → 닫기
6. Shop                          → 다음 층 진입
7. 모달 없음                     → 기본 동작 (앱 종료 / 페이지 이전)
```

웹 환경: Esc 키도 동일 처리. 모달 처리 시 `preventDefault()`.

---

## 설정 패널 UX

- `SpeedControl` 패널은 화면 우측 상단 고정
- 기본 접힘, 클릭 시 펼침
- 펼침 상태에서 모달 위로 자동 흐려짐 (`settings-panel.md` 참고)
- 5초 이상 방치 시 자동 접힘
- 펼침 여부는 `climetop:speedControl:expanded:v2` 에 저장

---

## 데이터 흐름

```ts
// useGameStore 의 상태
const game = useGameStore()
game.screen          // 현재 화면
game.activeModal     // 활성 모달 (ModalDescriptor | null)
game.showDialog({ title, message, buttons })   // alert/confirm
game.showInput({ title, placeholder })          // 입력
game.showList({ items })                        // 선택
game.showPickup({ inventory, newItem })         // 인벤토리 풀
```

모달은 Promise 기반 — `await game.showDialog(...)` 로 사용.
