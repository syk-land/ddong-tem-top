# 인게임 튜토리얼

> 첫 플레이 시 15단계로 점진적 노출. 각 단계는 처음 만날 때 1회만 표시. 속도/자동진입 옵션이 단계와 함께 점진적으로 해금. 챕터 1 의 1~4층 + 챕터 2 의 1층은 강제 배치로 학습 순서 보장. 단계 활성 동안 **게임이 자동 일시정지** 되고 백드롭은 **투명** (게임 화면이 그대로 보이고 타겟만 스포트라이트 + 박동 화살표로 강조). 인벤·상태 학습은 **챕터 1 3층(상점 노드 도착 직후)** 에 한 곳에 모여서 흐른다 — 보물에서 받은 뒤 자동으로 3층으로 advance 한 다음 그 자리에서 인벤→장착→닫기→상태→상세→닫기→상점 진입까지 일직선으로 학습.

코드: `src/data/tutorial.ts`, `src/ui/components/TutorialOverlay.vue`, `src/stores/game.ts` (`triggerTutorial` / `completeTutorial` / `resetTutorial`), `src/core/tower.ts` (`TowerTutorialOpts`)
저장: `meta.tutorialSeen` (in `climetop:meta:v1`)

---

## 강제 배치

학습 단계와 매칭되는 시점이 항상 같은 노드에서 발화하도록 강제.

### 챕터 1 (`!tutorialSeen.second_combat` 일 때)

| 층 | 노드 | 발화 트리거 |
|---|---|---|
| 1 | 일반 몬스터 | `first_node` (Dungeon 진입) + `first_combat` (전투 진입) |
| 2 | 보물 (미믹 전투) | `prompt_enter_treasure` (도착 시) — "열기" 버튼 안내 |
| 3 | 상점 | 보물에서 받은 즉시 advance → 도착 시 `first_treasure` ("인벤" 버튼) → `first_inventory` (장착+닫기) → `prompt_status` ("상태" 버튼) → `first_status` (스탯+상세+닫기) → `prompt_enter_shop` ("진입" 버튼) → 상점 진입 시 `first_shop` (구매·판매·새로고침) |
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

## 15 단계

각 단계 = `meta.tutorialSeen` 의 boolean 플래그. 처음 만날 때 1회 노출, 닫으면 영구 마킹.

| # | step | 트리거 시점 | 가르치는 것 | 서사 힌트 (작은 회색) |
|---|---|---|---|---|
| 1 | `menu_start` | 인트로 만화 종료 직후, first flow | "새 캐릭터 시작" 버튼 안내 | "탑이 너를 부르고 있다." |
| 2 | `creation_intro` | 첫 캐릭터 생성 진입 (`clearCount + climbCount === 0`) | 주사위 / 5스탯 / 챌린지 (페이지별 다른 영역) | "당신에게 힘이 부여되고 있다…" |
| 3 | `first_node` | 첫 던전 화면 진입 | "진입" 버튼 클릭법 | "이 풍경… 어쩐지 익숙하다." |
| 4 | `first_combat` | 첫 전투 (= 챕터 1 1층 일반) | HP/MP/게이지, 자동 스킬 발동 | "약하다. 왜 이렇게 약할까…" |
| 5a | **`prompt_enter_treasure`** | 챕터 1 2층 (보물) 도착 | 던전 카드 "열기" 버튼 안내 (CTA 위임 → openTreasure) | — |
| 5b | `first_treasure` | 보물 받고 advance → 챕터 1 3층(상점) 도착 onMounted | 상단 "인벤" 버튼 안내 (CTA 위임 → 인벤 모달) | — |
| 6 | `first_inventory` | 인벤 모달 첫 진입 (3층 상점 노드에서만) | (p1) 장비 카드 → (p2) 장착 버튼 → (p3) 인벤토리 모달의 **닫기 ✕ 버튼** 안내 (게임 UI 측 X) | — |
| 7 | `prompt_status` | 인벤 모달 닫힘 + `first_inventory` 마킹된 직후 | "상태" 버튼 가리키기 (CTA 위임 → 상태 모달 열림) | — |
| 8 | `first_status` | 상태창 모달 첫 진입 | (p1) 스탯 → (p2) 상세 능력치 탭 → (p3) 상태창 모달의 **닫기 ✕ 버튼** 안내 (게임 UI 측 X) | — |
| 9a | **`prompt_enter_shop`** | `first_status` 닫힘 직후 (= 챕터 1 3층 상점 노드) | "진입" 버튼 안내 (CTA 위임 → 상점 진입) | — |
| 9b | `first_shop` | 첫 상점 진입 (= 챕터 1 3층) | 매물(p1) + 판매(p2) + 새로고침(p3) | — |
| 10 | `second_combat` | 챕터 1 4층 일반 전투 | 2배속 잠금 해제 + 안내 | "시간이 조금 가까워진 느낌이다." |
| 11 | `first_chapter_clear` | 챕터 2 1층 진입 | 4배속·자동진입 광고 해금 안내 | "탑은 더 높아진다. 누군가 너를 지켜보는 것 같다." |
| 12 | `meta_creation` | 사망/클리어 후 첫 캐릭터 생성 (`clearCount + climbCount >= 1`) | 누적 보너스 풀 분배 | "받은 힘이 너의 안에 쌓이고 있다." |
| 13 | `realboss_clear` | 첫 진짜 보스 결과 화면 (`drainRatio > 0`) | "회귀하셨습니다" + 영구 시작 보너스 + 완전 처치 시 누적 보존 안내 | "깊은 곳에서 누군가가 너를 도와주고 있다." |

## 튜토리얼 학습 환경 (루즈함 방지)

`!tutorialSeen.first_treasure` / `!tutorialSeen.first_shop` / `!tutorialSeen.first_chapter_clear`
동안 게임이 학습용으로 보조됨:

- **보물상자 미믹 우회**: 챕터 1 2층 보물 노드가 `openTreasure` 진입 시
  미믹 분기 건너뛰고 **무기 1 + 갑옷 1 무조건 드랍** → 인벤 학습에 필요한 카드 보장
- **명중 트레이트 강제**:
  - 보물 드랍: 무기 = `날카로운` (+5 명중), 갑옷 = `정밀한` (+8 명중)
  - 첫 상점 매물: 동일하게 `forceTraitName` 으로 강제 (`createShop` / `refreshShop`
    에 `tutorialForceAcc` 옵션) → 회피 미스 누적으로 전투가 늘어지지 않음
- **첫 상점 100G 지급**: 첫 진입 시 `grantTutorialShopBonus()` 호출로 1회 +100G —
  구매 학습 시 골드 부족 방지
- **챕터 1 보스 약화**: `startMonsterFight` 의 보스 분기에서 `chapterNum === 1`
  이고 `!first_chapter_clear` 면 `hp ×0.5`, `atk ×0.7` 적용 — 첫 챕터 보스를
  사용자가 무조건 잡고 진행할 수 있도록
- **2층 보물 → 3층 상점으로 자동 advance 후 학습 통합**: (이전엔 2층에서 학습을
  마쳐야 advance 가 풀리는 구조였는데, 보물 노드 위에 인벤 안내 화살표가 떠도 자연
  스럽지 않았다. 이제 보물 받자마자 advance → 3층 상점 노드에 도착한 직후 학습
  사이클이 시작된다.)
  - `openTreasure` 튜토리얼 분기: `receiveItem` 직후 즉시 `advance()` 호출 → 3층 진입
  - 3층 onMounted: `pendingTreasureTutorial` 가 set 돼 있으면 `first_treasure`
    트리거 → 인벤 버튼 안내 시작
  - 연쇄: `first_treasure` → `first_inventory` → `prompt_status` → `first_status` →
    `prompt_enter_shop` → 사용자가 "진입" 누르면 `first_shop`
  - `clearItemAnnounce` 가 보물·일반 드롭 모두에서 닫힐 때 `advance()` 호출 →
    autoEnter 여부와 무관하게 사용자가 "확인" 누른 시점에 다음 층으로 진행
- **튜토리얼 챌린지 게이팅**: `first_chapter_clear` 전에는
  `pickThreeRandomChallenges({ eventOnly: true })` 로 도박/룰렛/제단/모험가/대장장이/
  거울/환영/꿈/신탁 키워드의 특별이벤트 챌린지만 풀에 둠. 상점/장비 차단 챌린지도
  보조 옵션 (`excludeShop`, `excludeItemRestrict`) 으로 같이 배제.
- **인벤·상태 학습은 챕터 1 3층 상점 노드에서만 트리거**: `triggerTutorial` 가드 —
  `first_treasure` / `first_inventory` / `prompt_status` / `first_status` 는
  `chapter === 1 && currentFloor === 2 && floor.type === 'shop'` 일 때만 발화.
  사용자가 다른 층/챕터에서 모달 열어도 학습 X. `prompt_enter_treasure` 는 챕터 1
  2층 + `floor.type === 'treasure'`, `prompt_enter_shop` 은 챕터 1 3층 +
  `floor.type === 'shop'` 에서만.
- **자동화 모드 보류**: `combatSpeed >= 5` (= `isAutoMode`) 일 때는 어떤 단계도
  새로 트리거되지 않음. 안내 모달이 자동 진입/자동 매수를 막지 않도록.
  자세한 내용은 [auto-mode.md](./auto-mode.md).
- **아이템 획득 모달 떠 있으면 자동 진입 보류**: `game.advance()` 가
  `itemAnnounceQueue.length > 0` 이면 return. autoEnter 모드여도 사용자가 보상 카드를
  보지 못한 채 다음 층으로 넘어가지 않음. `clearItemAnnounce` 가 큐 비운 직후
  자동 재시도.

## 페이지 흐름 — 타겟 직접 클릭 / 자동 스크롤 / cooldown / 스킵

- **타겟 직접 클릭 모드** (타겟이 `<button>`/`<a>`/`role=button` 일 때):
  - 카드 안에 CTA 버튼을 두지 않고 "↑ 강조된 버튼을 눌러주세요" 안내 텍스트만 표시
  - 부모 z-[60] div 에 `pointer-events-none` 적용 (`targetActionEl` 있을 때) →
    사용자 클릭이 타겟까지 도달. 카드 element 만 `pointer-events-auto` 로 받음.
  - 타겟 element 에 **capture phase** click 리스너 부착 → 사용자가 타겟을 누르는 그
    한 번의 클릭이 ① 튜토리얼 진행(pageIdx++ 또는 completeTutorial) + ② 원래 동작
    (주사위 굴림 / 모달 열림 / 페이지 이동) 을 동시에 수행. `stopPropagation` 안 하므로
    원래 핸들러까지 그대로 흘러감.
  - 타겟이 panel/div 등 클릭 가능 요소가 아니면 카드의 "알겠어요" CTA 로 fallback
  - **`noAutoAction` 옵션**: 타겟이 버튼이어도 자동 클릭 위임을 끔. 누르면 자원이
    소모되는 버튼 (예: `first_shop` p3 의 새로고침) — 강조만 하고 진행은 카드 CTA 로.
- **1초 cooldown**: 단계가 바뀐 직후 의도하지 않은 클릭으로 두 단계가 연쇄 진행되던
  문제. `cooldownUntil` 변수 — step/pageIdx 변경 시 1초 갱신. 그 동안 클릭은
  `advance` 도 막고 원 click 도 `preventDefault + stopPropagation` 으로 차단.
- **전체 스킵 버튼**: `TutorialOverlay` 안 `fixed top-[40px] left-1 z-[101]`
  (SpeedControl 아래) 버튼. 확인 모달 후 `game.skipAllTutorials()` → 모든
  `tutorialSeen` true 마킹 + `pendingTreasureTutorial` / `pendingTutorialTreasureAdvance`
  클리어 + `persistMeta`.
- **자동 스크롤 (모드별)**:
  - `scrollMode: 'center'` (기본) — 타겟 중앙 Y 가 viewport 중앙 ±25% 안에 없으면
    `block: 'center'` 로 강제 스크롤
  - `scrollMode: 'end'` — 타겟 하단이 viewport 하단 80% ~ 100% 안에 없으면
    `block: 'end'` 로 스크롤. 페이지 최 하단까지 내려가서 안내해야 할 때
    (예: `meta_creation` 의 누적 보너스 분배 패널 — 페이지 끝에 위치)
  - 360ms 스크롤 애니메이션 후 정확한 좌표 재측정
- **학습 사이클 — 인벤 → 상태창**: `InventoryModal` 의 `props.open` watcher 가
  닫힘 시점에 `first_inventory` 가 이미 마킹됐다면 자동으로 `prompt_status` 트리거 →
  던전의 "상태" 버튼을 가리킴 → CTA "상태" 클릭 위임으로 상태 모달 열기 →
  모달 첫 open 에서 `first_status` 트리거 (모달 안 내용 안내)

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
  - **타겟 주변 강조 테두리** (`.tutorial-spotlight`):
    - 안쪽 검정 윤곽 (`inset 2px`) + 시안 두꺼운 ring (4~6px) + 바깥 검정 윤곽
      (`2px`) + 시안 외곽 글로우 (`24~36px`) 의 4중 box-shadow
    - 1.2s 사이클로 ring 두께와 글로우가 살짝 부풀었다 줄어드는 박동 → 화살표
      박동과 함께 타겟이 살아 움직이듯 강조
  - 좌우는 타겟 X중앙 기준 카드 중앙 정렬, 화면 경계 안에 clamp
  - resize / scroll 시 자동 재계산
- **상호작용 차단 & 게임 일시정지**:
  - 백드롭은 **투명** (`bg-transparent`) 이라 게임 화면이 그대로 보임 — 타겟은
    시안 ring + 박동 화살표로만 강조
  - **4-segment 백드롭** (타겟이 클릭 가능 버튼일 때): 상/하/좌/우 4개 사각형으로
    분할해 타겟 사각형만 빈 영역으로 남기고, 그 외 영역의 클릭은
    `pointer-events-auto` + `@click.stop.prevent` 로 모두 흡수. 예전엔 부모 div
    하나에 `pointer-events: none` 을 줘서 통과시켰는데, 모달 백드롭/인접 버튼이
    같이 눌리는 문제가 있었다 — 이제 타겟 사각형만 정확히 노출.
  - 타겟이 없거나 비-버튼 / `noAutoAction` 인 경우는 단일 백드롭으로 모든 클릭 흡수.
  - 카드 wrapper 는 `pointer-events-none` — 카드와 타겟이 시각적으로 겹쳐도 타겟
    클릭이 통과한다. 카드 내부의 CTA 버튼만 `pointer-events-auto` 로 개별 활성화.
    **닫기 X 는 제거** — 사용자가 튜토리얼 단계를 임의 종료할 수 있는 경로는 좌상단
    "튜토리얼 전체 건너뛰기" 단일 경로만 남김.
  - 진행은 **명시적 "다음 →" 버튼 / 타겟 직접 클릭 / 브라우저 뒤로가기 / Esc** 로만
  - 단계 활성 동안 **게임 자동 일시정지**: `tickStep` 이 `tutorialActive` 시
    no-op, Combat.vue 의 자동 틱 watcher 가 `paused || tutorialActive` 로 멈춤,
    Dungeon 의 자동 진입 카운트다운도 `tutorialActive` 시 보류
- **타겟 없을 때** (`page.target` 없음):
  - 화면 중앙 / 모바일은 하단에 정적 카드 (부유 X)
- 페이지 인디케이터 (단계가 여러 페이지일 때)
- 본문 + 서사 힌트 (작은 italic, `text-zinc-500`)
- CTA 버튼 (마지막 페이지):
  - 타겟이 클릭 가능한 `<button>` / `<a>` / `role="button"` 이면 **그 버튼 라벨이
    CTA 로 자동 노출** → 누르면 (1) `completeTutorial()` (2) `target.click()` 위임 →
    튜토리얼 닫기 + 그 버튼의 원래 동작이 한 번에 실행
  - 라벨이 너무 길거나 부가 텍스트가 섞여 있으면 타겟에
    `data-tutorial-cta-label="짧은 라벨"` 속성을 추가해 직접 지정 가능
  - 타겟이 패널(div) 이거나 없으면 그대로 **"알겠어요"** (위임 없음)
  - `page.cta` 명시 시 그게 최우선
- 중간 페이지는 "다음 →"
- 우상단 × 닫기 — **제거됨** (사용자가 튜토리얼 단계를 우회로 닫는 경로 차단). 종료가 필요하면 좌상단 "튜토리얼 전체 건너뛰기" 사용

### 타겟 매핑

각 화면 요소에 `data-tutorial-target="키"` 속성을 마크해서 단계가 가리킬 수 있게 함. **모든 단계가 타겟을 갖도록 매핑됨** → 박동 화살표 + 박동 ring 스포트라이트가 어디서나 일관되게 발동.

| step | target selector | 가리키는 요소 | CTA 위임 |
|---|---|---|---|
| `menu_start` | `[data-tutorial-target="new-character-btn"]` | "새 캐릭터 시작" 버튼 | ✅ → "새 캐릭터 시작" |
| `creation_intro` (page 1) | `[data-tutorial-target="dice-roll-btn"]` | 🎲 주사위 굴리기 버튼 | ✅ → "주사위 굴리기" (중간 페이지 위임 — 한 번 굴리고 페이지 2로) |
| `creation_intro` (page 2) | `[data-tutorial-target="challenge-area"]` | 챌린지 패널 (div, 화면 아래 — 자동 스크롤) | "알겠어요" |
| `first_node` | `[data-tutorial-target="enter-floor-btn"]` | Dungeon 의 "진입" 버튼 | ✅ → "진입" |
| `first_combat` | `[data-tutorial-target="combat-bars"]` | HP/MP 바 컨테이너 | "알겠어요" |
| `prompt_enter_treasure` | `[data-tutorial-target="enter-floor-btn"]` | Dungeon 의 "열기" 버튼 (보물 노드 시 라벨이 "열기" 로 표시) | ✅ → "열기" |
| `first_treasure` | `[data-tutorial-target="inventory-btn"]` | Dungeon 의 "인벤" 버튼 | ✅ → "인벤" |
| `first_inventory` (p1) | `[data-tutorial-target="inventory-item-card"]` | 인벤 첫 아이템 카드 | "알겠어요" |
| `first_inventory` (p2) | `[data-tutorial-target="inventory-equip-btn"]` | 첫 아이템의 "장착" 버튼 | ✅ → "장착" |
| `first_inventory` (p3) | `[data-tutorial-target="inventory-close"]` | 인벤 모달 우상단 ✕ | ✅ → "✕" |
| `prompt_status` | `[data-tutorial-target="status-btn"]` | Dungeon "상태" 버튼 | ✅ → "상태" |
| `first_status` (p1) | `[data-tutorial-target="status-stats"]` | 상태창 본문 패널 | "알겠어요" |
| `first_status` (p2) | `[data-tutorial-target="status-detail-tab"]` | "상세 능력치" 탭 버튼 | ✅ → "상세 능력치" |
| `first_status` (p3) | `[data-tutorial-target="status-close"]` | 상태창 모달 우상단 ✕ | ✅ → "✕" |
| `prompt_enter_shop` | `[data-tutorial-target="enter-floor-btn"]` | Dungeon 의 "진입" 버튼 (3층 상점 노드) | ✅ → "진입" |
| `first_shop` (p1) | `[data-tutorial-target="shop-slot"]` | 상점 매물 패널 | "알겠어요" |
| `first_shop` (p2) | `[data-tutorial-target="shop-sell"]` | 장착 중 (판매) 패널 | "알겠어요" |
| `first_shop` (p3) | `[data-tutorial-target="shop-refresh"]` | "🔄 새로고침" 버튼 | ✅ → "🔄 새로고침 (n)" |
| `second_combat` | `[data-tutorial-target="speed-control"]` | SpeedControl 패널 (div) | "알겠어요" |
| `first_chapter_clear` | `[data-tutorial-target="speed-control"]` | SpeedControl 패널 (div) | "알겠어요" |
| `meta_creation` | `[data-tutorial-target="bonus-alloc"]` | 보너스 분배 패널 (div) | "알겠어요" |
| `realboss_clear` | `[data-tutorial-target="realboss-bonus"]` | 보상 카드 (div) | "알겠어요" |

### first_treasure 트리거 지연

receiveItem 시점 (Combat 화면) 엔 인벤 버튼이 DOM 에 없으므로 그 자리에 직접 트리거하지 않고 `pendingTreasureTutorial = true` 만 set. 보물에서 받은 직후 즉시 `advance()` 가 호출되고, 다음 층(3층 상점) 의 Dungeon onMounted 에서 인벤 버튼이 마운트된 상태에서 `first_treasure` 가 발화 → 타겟 화살표 + 박동 ring 정상 작동.

이때 Dungeon 컴포넌트는 floor 변경 시 재mount 되지 않으므로 (같은 라우트 내 상태만 갱신), `clearItemAnnounce` 안에서 `triggerTutorial('first_treasure')` 를 직접 호출해 동일 효과를 낸다. `triggerTutorial` 가드가 `chapter === 1 && currentFloor === 2 && floor.type === 'shop'` 인지 한 번 더 확인하므로 잘못된 위치에서 발화하지 않는다.

### 닫기 동작
- 브라우저 뒤로가기 / Esc → `completeTutorial()` 호출 (가장 우선)
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
| `src/data/tutorial.ts` | 15 단계 문구 정의 (`TUTORIAL_STEPS`) |
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
