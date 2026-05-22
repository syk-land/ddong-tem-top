# 인게임 튜토리얼

> 첫 플레이 시 9단계로 점진적 노출. 각 단계는 처음 만날 때 1회만 표시. 속도/자동진입 옵션이 단계와 함께 점진적으로 해금. 챕터 1 의 1~4층 + 챕터 2 의 1층은 강제 배치로 학습 순서 보장.

코드: `src/data/tutorial.ts`, `src/ui/components/TutorialOverlay.vue`, `src/stores/game.ts` (`triggerTutorial` / `completeTutorial` / `resetTutorial`), `src/core/tower.ts` (`TowerTutorialOpts`)
저장: `meta.tutorialSeen` (in `climetop:meta:v1`)

---

## 강제 배치

학습 단계와 매칭되는 시점이 항상 같은 노드에서 발화하도록 강제.

### 챕터 1 (`!tutorialSeen.second_combat` 일 때)

| 층 | 노드 | 발화 트리거 |
|---|---|---|
| 1 | 일반 몬스터 | `first_node` (Dungeon 진입) + `first_combat` (전투 진입) |
| 2 | 보물 (미믹 전투) | `first_treasure` (보물 노드의 드랍 시) |
| 3 | 상점 | `first_shop` (Shop 진입) — 구매·판매·새로고침만 |
| 4 | 일반 몬스터 | **`second_combat`** (전투 진입) — 2배속 해금 + 안내 |
| 5~9 | 자유 (회복샘 1 + 일반 몬스터 4, 셔플) | — |
| 10 | 보스 | — |

`second_combat` 를 본 후에는 강제 배치가 풀리고 통상 셔플 규칙으로 돌아감.

### 챕터 2 (`!tutorialSeen.first_chapter_clear` 일 때)

| 층 | 노드 | 발화 트리거 |
|---|---|---|
| 1 | 일반 몬스터 | **`first_chapter_clear`** (Dungeon 진입) — 4배속·자동진입 광고 해금 안내 |
| 2~9 | 자유 (회복샘 1 + 보물 1 + 상점 1 + 일반 몬스터 5, 셔플) | — |
| 10 | 보스 | — |

`first_chapter_clear` 를 본 후에는 강제 배치 풀림.

---

## 9 단계

각 단계 = `meta.tutorialSeen` 의 boolean 플래그. 처음 만날 때 1회 노출, 닫으면 영구 마킹.

| # | step | 트리거 시점 | 가르치는 것 | 서사 힌트 (작은 회색) |
|---|---|---|---|---|
| 1 | `creation_intro` | 첫 캐릭터 생성 화면 진입 (`clearCount + climbCount === 0`) | 주사위 / 5스탯 / 챌린지 선택 | "당신에게 힘이 부여되고 있다…" |
| 2 | `first_node` | 첫 던전 화면 진입 | 노드 카드 클릭법 | "이 풍경… 어쩐지 익숙하다." |
| 3 | `first_combat` | 첫 전투 (= 챕터 1 1층 일반) | HP/MP/게이지, 자동 스킬 발동 | "약하다. 왜 이렇게 약할까…" |
| 4 | `first_treasure` | 보물 노드 `receiveItem()` (= 챕터 1 2층) | 인벤토리, 아이템 비교 | — |
| 5 | `first_shop` | 첫 상점 진입 (= 챕터 1 3층) | 구매·판매·새로고침 (속도 안내 X) | — |
| 6 | **`second_combat`** | **챕터 1 4층 일반 전투** (`ch.chapter === 1 && currentFloor === 3 && floor.type === 'monster'`) | **2배속 잠금 해제 + 안내** | "시간이 조금 가까워진 느낌이다." |
| 7 | `first_chapter_clear` | **챕터 2 1층 진입** (`ch.chapter === 2 && currentFloor === 0`) | **4배속·자동진입 광고 해금 안내** | "탑은 더 높아진다. 누군가 너를 지켜보는 것 같다." |
| 8 | `meta_creation` | 사망/클리어 후 첫 캐릭터 생성 (`clearCount + climbCount >= 1`) | 누적 보너스 풀 분배 | "받은 힘이 너의 안에 쌓이고 있다." |
| 9 | `realboss_clear` | 첫 진짜 보스 결과 화면 (`drainRatio > 0`) | 영구 시작 보너스 | "깊은 곳에서 누군가가 너를 도와주고 있다." |

`first_treasure` 는 일반 몬스터 드랍에서는 발화하지 않음 — 보물 노드를 만나야 학습 시점이 됨.

서사 힌트는 **시간의 신 / 진짜 보스를 직접 언급하지 않음** — 분위기만 만들어 t3 리본 (진짜 보스 클리어 후 인트로 만화 3컷 해금) 의 의미를 보존한다.

---

## 속도 게이팅

`SpeedControl.vue` 패널이 튜토리얼 진행도에 따라 옵션을 점진적 노출:

| 단계 | 보이는 옵션 |
|---|---|
| `second_combat` 전 | **1배속만** (`speeds = [1]`) |
| `second_combat` 후, `first_chapter_clear` 전 | 1·2배속 (`speeds = [1, 2]`) — 자동진입 버튼 숨김 |
| `first_chapter_clear` 후 | 1·2·4배속 + 자동진입 (4배속·자동진입은 별도 광고 해금 유지) |

`game.canUseSpeed2x` / `game.canShowSpeed4x` / `game.canShowAutoEnter` 게터로 노출 제어.

`setCombatSpeed(speed)` 도 안전망: 게이팅된 속도로 호출 시 1배속으로 폴백 (localStorage 강제 조작 방어).

---

## 옛 세이브 처리

`loadMeta` 마이그레이션에서 `tutorialSeen` 필드가 없고 (`clearCount > 0` 또는 `climbCount > 0`) 이면 **모든 단계 true 로 마킹** — 이미 플레이 중인 사용자는 갑자기 튜토리얼이 다시 뜨지 않음.

예외: `realboss_clear` 는 `realBossDefeated` 가 false 이면 그대로 false 로 둠 — 옛 사용자가 진짜 보스 처음 깰 때 자연스럽게 나오도록.

새 단계 `second_combat` 도 마이그레이션 시 모든 옛 사용자가 본 것으로 마킹 → 갑작스러운 노출 없음.

---

## UX

### 오버레이 디자인 (`TutorialOverlay.vue`)
- **타겟 지정** (`page.target = CSS selector`) 시:
  - 타겟 요소의 `getBoundingClientRect()` 기준으로 카드를 위/아래 자동 배치
    (타겟이 화면 위쪽 절반이면 아래에, 아래쪽이면 위에)
  - 카드 전체는 부드러운 **위·아래 부유** (translateY ±6px, 1.8s 사인)
  - 화살표는 카드 위에 **별도 박동** — `↑` 방향이면 위로, `↓` 방향이면 아래로
    (translateY ±10px, 0.9s 사인). 카드 부유에 합성되어 "타겟을 향해 가리키는"
    시각적 강조.
  - 타겟 주변 시안 ring + glow 스포트라이트 (`ring-cyan-300/90`)
  - 좌우는 타겟 X중앙 기준 카드 중앙 정렬, 화면 경계 안에 clamp
  - resize / scroll 시 자동 재계산
- **상호작용 차단**: 백드롭 `bg-black/65` 가 전체 inset-0 을 덮어 게임 UI 클릭
  완전 차단. 백드롭 클릭 자체는 `@click.stop` 으로 흡수만 하고 진행시키지 않음 →
  무의식 클릭으로 튜토리얼이 닫히지 않음. 진행은 **명시적 "다음 →" 버튼 / × 닫기 /
  안드로이드 뒤로가기 / Esc** 로만.
- **타겟 없을 때** (`page.target` 없음):
  - 화면 중앙 / 모바일은 하단에 정적 카드 (부유 X)
- 페이지 인디케이터 (단계가 여러 페이지일 때)
- 본문 + 서사 힌트 (작은 italic, `text-zinc-500`)
- CTA 버튼: "다음 →" / 마지막 페이지엔 "알겠어요"
- 우상단 × 닫기 (이 단계만 닫기)

### 타겟 매핑

각 화면 요소에 `data-tutorial-target="키"` 속성을 마크해서 단계가 가리킬 수 있게 함.

| step | target selector | 가리키는 요소 |
|---|---|---|
| `creation_intro` | (없음) | 화면 중앙 정적 카드 |
| `first_node` | `[data-tutorial-target="floor-current"]` | Dungeon 의 현재 진입 가능 노드 |
| `first_combat` | `[data-tutorial-target="combat-bars"]` | Combat 의 HP/MP 바 컨테이너 |
| `first_treasure` | (없음) | 모달 위에서 화면 중앙 |
| `first_shop` | `[data-tutorial-target="shop-slot"]` | Shop 의 매물 리스트 패널 |
| `second_combat` | `[data-tutorial-target="speed-control"]` | SpeedControl 패널 (좌상단) |
| `first_chapter_clear` | `[data-tutorial-target="speed-control"]` | SpeedControl 패널 |
| `meta_creation` | `[data-tutorial-target="bonus-alloc"]` | 누적 보너스 자유 분배 패널 |
| `realboss_clear` | (없음) | 화면 중앙 (결과 화면 위에 띄움) |

### 닫기 동작
- 안드로이드 뒤로가기 / Esc → `completeTutorial()` 호출 (가장 우선)
- 백드롭 클릭 → 다음 페이지 또는 닫기
- CTA 클릭 → 다음 페이지 또는 닫기

### 다시 보기
`SettingsScreen.vue` 의 "튜토리얼 다시 보기" 버튼 → `game.resetTutorial()`:
- `tutorialSeen` 전부 false 로 리셋
- 속도 1배속·자동진입 OFF 로 초기화 (재학습 흐름 보장)
- 메인 메뉴로 이동

---

## 코드 매핑

| 파일 | 역할 |
|---|---|
| `src/types/index.ts` | `TutorialSeen` / `TutorialStep` 타입, `MetaBonuses.tutorialSeen` 필드 |
| `src/data/tutorial.ts` | 8 단계 문구 정의 (`TUTORIAL_STEPS`) |
| `src/core/meta.ts` | 기본값 + 옛 세이브 자동 마킹 |
| `src/stores/game.ts` | `tutorialActive` 상태, `triggerTutorial/completeTutorial/resetTutorial`, 속도 게이팅 게터 |
| `src/ui/components/TutorialOverlay.vue` | 오버레이 UI |
| `src/App.vue` | 오버레이 글로벌 마운트 |
| `src/screens/CharacterCreation.vue` | `creation_intro` / `meta_creation` 트리거 |
| `src/screens/Dungeon.vue` | `first_node` 트리거 |
| `src/screens/Combat.vue` | `first_combat` 트리거 |
| `src/screens/Shop.vue` | `first_shop` 트리거 |
| `src/screens/RealBossResult.vue` | `realboss_clear` 트리거 |
| `src/ui/components/SpeedControl.vue` | 속도/자동진입 게이팅 표시 |
| `src/screens/SettingsScreen.vue` | "튜토리얼 다시 보기" 버튼 |

---

## 알려진 제약 / 향후

- **튜토리얼 진행 중 자동 진입 안 됨**: `first_chapter_clear` 전엔 옵션 자체가 숨김 — 첫 챕터는 사용자 손으로 진행.
- **서사 힌트의 점진적 강도**: 시간의 신 직접 언급은 인트로 만화 t3 에만. 튜토리얼은 "누군가" 정도로만.
- **인트로 만화와의 독립성**: 인트로 만화 `tutorialSeen:v1` 키와 튜토리얼 `meta.tutorialSeen` 필드는 별개. 데이터 리셋은 둘 다 초기화.
- **타겟이 동적으로 사라지면**: 단계 도중 DOM 에서 사라지면 카드가 갱신될 때 중앙으로 폴백 (안전).
