# 자동화 모드 (Auto Mode)

> `combatSpeed >= 5` 일 때 활성화되는 **vite 개발 서버 한정** 자동화 모드. 기본 100배 + 5~999 자유 조정. 자동 진입 / 자동 매수 / 자동 장착 / 특별이벤트 자동 거부 / 튜토리얼 보류로 사용자 개입 없이 등반이 끝까지 흘러간다.
>
> `npm run build` 로 만든 production 번들 (Firebase Hosting / GameMonetize 배포 포함) 에서는 빌드 타임 상수 `IS_DEV_SERVER === false` 가 인라인되어 **자동화 진입 경로가 모두 차단**된다 — getter 항상 false, UI `v-if` falsy, setCombatSpeed 가 5+ 입력을 4로 강제. 사용자는 기능에 도달할 수 없다. (메소드 본체와 UI 문자열은 번들에 그대로 남는다 — Vue 의 v-if 가 render function 내 변수 참조로 컴파일되어 minifier 가 dead 라고 추론 못 함. 더 강한 제거가 필요하면 자동화 섹션을 별도 컴포넌트로 분리 + dynamic import 해야 함.)

코드: `src/lib/platform.ts` (`IS_DEV_SERVER` 빌드 타임 상수), `src/stores/game.ts` (`isAutoMode`, `setCombatSpeed`, `autoUpgradeEquipment`, `autoShopFlow`, `receiveItem`, `runSpecialEvent`, `triggerTutorial`), `src/screens/Combat.vue` (tick 배치), `src/screens/Shop.vue` (onMounted), `src/screens/Dungeon.vue` (자동 진입 확장), `src/ui/components/SpeedControl.vue` (UI)

저장: `climetop:speed:v1` (정수, dev 서버 1~1000 / production 1~4 clamp)

---

## 빌드 타임 분기 — `IS_DEV_SERVER`

```ts
// src/lib/platform.ts
export const IS_DEV_SERVER: boolean = import.meta.env.DEV
```

Vite 가 빌드 시 boolean 상수로 인라인 → production 번들에서:
- `isAutoMode` getter 가 `false && ...` 로 평가되어 항상 false → 모든 `if (this.isAutoMode)` 분기가 도달 불가
- `SpeedControl` 의 자동화 버튼/숫자 입력 박스 `<div v-if="IS_DEV_SERVER && ...">` 가 항상 falsy → DOM 렌더 X
- `setCombatSpeed` / `init()` localStorage 복원 안의 `if (!IS_DEV_SERVER && speed > 4)` 가 안전망 — 옛 dev 서버에서 100배로 저장한 localStorage 가 production 빌드에 그대로 들어와도 4 로 강제 clamp

번들 사이즈 측면 한계: Pinia action 메소드는 객체 property 로 등록되고, Vue template 의 v-if 도 render function 안에서 `_ctx.IS_DEV_SERVER` 변수 참조로 컴파일된다. minifier 가 그게 module top-level boolean 상수임을 추론하지 못하므로 자동화 분기 함수 본체 (`autoUpgradeEquipment` / `autoShopFlow` / 자동화 분기 안의 모달 우회 로직) 와 UI 문자열은 번들에 남는다. 사용자에게는 보이지 않고 도달도 불가하지만, 코드는 적재된 상태. 실제 tree-shake 까지 필요하면 자동화 섹션을 별도 `AutoModeControls.vue` 로 분리 + `import.meta.env.DEV ? defineAsyncComponent(() => import(...)) : null` 패턴이 필요.

---

## 진입 / 노출 (dev 서버 한정)

`SpeedControl` 패널 아래쪽 점선 구분선 밑에 `🚀 100x (auto)` 버튼이 노출. 버튼을
누르면 즉시 `setCombatSpeed(100)` 이 호출되고, 그 옆에 5~999 범위의 숫자 입력
박스가 함께 나타나 사용자가 직접 배속을 조정할 수 있다.

노출 조건: `IS_DEV_SERVER && auth.isDevAccount` 모두 true.
- production 빌드: `IS_DEV_SERVER` 가 false 상수 → 블록 자체가 minifier 제거.
- dev 서버 + 비-dev 계정: 버튼 렌더 X.
- 게이팅 면제: 2/4 배속과 달리 광고/튜토리얼 게이트 없이 즉시 활성.

```ts
isAutoMode: (s): boolean => IS_DEV_SERVER && s.combatSpeed >= 5,
```

---

## 부수 효과 (`setCombatSpeed`)

```ts
// 1) tutorial 게이팅 (1/2/4 만 해당, 5+ 는 게이팅 면제)
if (speed === 2 && !meta.tutorialSeen.second_combat) speed = 1
if (speed === 4 && !meta.tutorialSeen.first_chapter_clear) speed = 1

// 2) clamp — 1 ≤ speed ≤ 1000, 정수
speed = Math.max(1, Math.min(1000, Math.round(speed)))

// 3) production 안전망 — dev 서버 아니면 5+ 진입 자체 차단 (4로 clamp)
if (!IS_DEV_SERVER && speed > 4) speed = 4

// 4) 자동화 모드 진입 시 autoEnter 강제 on
if (speed >= 5 && !autoEnter) setAutoEnter(true)
```

- `autoEnter` 는 자동화 모드에서 강제로 켜진다 (꺼져 있으면 켜고, 켜져 있으면 유지).
- 1/2/4 로 다시 내릴 때는 `autoEnter` 를 끄지 않음 — 사용자 의도 기준.
- production 빌드는 (3) 의 안전망으로 5+ 가 절대 들어가지 않으므로 (4) 분기에 도달 X.

---

## 자동 동작 5종

### ① Combat 자동 진입 + 자동 tick 배치 처리

`Combat.vue` 의 `startAutoTick` 가 `setInterval` 최소 가드(10ms) 를 우회하기 위해
**한 콜에서 여러 tick 을 호출** 한다.

```ts
const interval = Math.max(10, Math.round(BASE_INTERVAL / speed))   // 최소 10ms
const callsPerSec      = 1000 / interval
const targetTicksPerSec = speed * (1000 / BASE_INTERVAL)
const ticksPerCall      = Math.max(1, Math.round(targetTicksPerSec / callsPerSec))
```

- 1~6 배속: interval 만 단축 (`ticksPerCall === 1`, 기존 동작)
- 7배 이상: interval 은 10ms 로 고정, `ticksPerCall` 이 증가 → setInterval 가드를
  넘어 가속 가능
- 같은 프레임에 데미지 팝업/로그가 누적되지만, 자동 모드 사용자는 결과만 보는
  흐름이라 허용

### ② Dungeon 자동 진입 — 상점·특별이벤트 포함

평소엔 `AUTO_ENTER_TYPES = {monster, boss, healing_spring, treasure}` 만 자동 진입.
자동화 모드에서는 상점·특별이벤트도 포함된 확장 집합을 사용한다.

```ts
const AUTO_ENTER_TYPES_AUTOMODE = new Set([
  ...AUTO_ENTER_TYPES, 'shop', 'special_event'
])
const allowed = game.isAutoMode ? AUTO_ENTER_TYPES_AUTOMODE : AUTO_ENTER_TYPES
```

- 상점 진입 → `Shop.vue` onMounted 가 `autoShopFlow` 호출 → 자동 매수 + 자동 이탈
- 특별이벤트 진입 → `runSpecialEvent` 가 즉시 거부 + advance (아래 ⑤)

### ③ receiveItem — 자동 업그레이드 + 가득 시 worst 교체

기본 흐름은 인벤이 가득 차면 `PickupModal` 을 띄워 사용자에게 폐기/교체 선택을
받지만, 자동화 모드에서는 모달을 우회한다.

- **인벤 여유 있음**: 인벤에 push → `autoUpgradeEquipment()` 호출 → 더 좋은
  장비면 자동 swap. `ItemAnnounceModal` 도 띄우지 않음 (= 사용자가 확인 누른 것과
  동일 결과).
- **인벤 가득 참**: 같은 `kind` (weapon/armor) 인벤 슬롯 중 `computeItemValue`
  점수(`atkValue` for weapon / `defValue` for armor) 가 가장 낮은 것을 새
  아이템으로 교체. 단 새 아이템이 가장 약하면 폐기 (인벤에 추가하지 않음).

```ts
autoUpgradeEquipment()
  for slot in [weapon, armor]:
    인벤에서 slot 타입 중 현재 장착품보다 atk/defValue 가 더 높은 후보 탐색
    canEquipItem 챌린지 가드 통과한 것만
    bestIdx 가 있으면 swap: character[slot] ↔ inventory[bestIdx]
                          교체된 옛 장비는 인벤 push (cap 유지)
```

### ④ Shop 자동 매수 사이클 (`autoShopFlow`)

상점 onMounted 가 자동화 모드면 `autoShopFlow()` 호출 + `return` (튜토리얼 100G
지급 / `first_shop` 트리거 모두 건너뜀).

```
autoShopFlow():
  for round in 0..MAX_ROUNDS(8):
    매수 라운드:
      현재 장착품의 atk/defValue 계산
      shop 매물 중 (현재보다 더 좋고 && 골드 충분) 후보 추림
      후보 0 → break
      가치 높은 순 정렬 → buyItem(top) → 실패 시 break
      buyItem 안의 receiveItem 이 자동 swap 까지 처리
    새로고침:
      challenge 가 새로고침 금지 면 break
      refreshShop(...) 직접 호출 (alertModal 우회), 충전 잔량 떨어지면 false → break
      round++
  saveRun + leaveShop
```

- 무한 매수/새로고침 방지: `MAX_ROUNDS = 8`, `buySafety = 32` 이중 cap
- 챌린지 `shopRefreshForbidden(ctx)` 면 새로고침 skip
- 매수가 끝나면 `leaveShop()` 으로 자동 이탈 → Dungeon 으로 복귀 → 다음 층 자동 진입

### ⑤ 특별이벤트 자동 거부

`runSpecialEvent` 진입 즉시 모달도 띄우지 않고 `advance()` 호출 + return.

```ts
async runSpecialEvent(chapter) {
  if (this.isAutoMode) { this.advance(); return }
  ...
}
```

- PVP 결과·룰렛·대장장이·암시장·수집가·도박꾼 등 **모든 보너스 포기**
- "등반 흐름을 끊지 않는 게 우선" 이라는 trade-off

---

## 튜토리얼 보류

`triggerTutorial` 초입에 `isAutoMode` 가드:

```ts
triggerTutorial(step) {
  if (meta.tutorialSeen[step]) return
  if (this.tutorialActive) return
  if (this.isAutoMode) return   // ← 추가
  ...
}
```

- 자동화 모드 동안에는 어떤 단계도 새로 트리거되지 않음 → 안내 모달이 자동 진입
  /자동 매수를 막지 않는다.
- 이미 열려 있던 카드는 그대로 둠 (사용자가 직접 닫음).
- 5배 미만으로 내리면 다시 발화 가능.

---

## 탐욕의 수집가도 자동 거부

위 ⑤ 의 결과로 자동화 모드에서는 탐욕의 수집가 이벤트가 발생해도 사용자에게
"양도/거절" 모달이 뜨지 않고 즉시 advance — `eventGreedyCollector` 분기는 도달하지
않는다.

(통상 모드에서는 후보 탐색 범위가 장착 + 인벤 전체로 확장됐다 — 동일 트랜잭션의
다른 변경. [special-events.md](../systems/special-events.md) 참고.)

---

## 데이터 리셋과의 관계

`MainMenu.vue` 의 데이터 리셋은 `climetop:` 프리픽스 모든 키 일괄 삭제 → 자동화
모드로 들어가 있던 속도 (`climetop:speed:v1`) / autoEnter 토글 등 모두 초기화.

```ts
for (let i = 0; i < localStorage.length; i++) {
  const k = localStorage.key(i)
  if (k && k.startsWith('climetop:')) toRemove.push(k)
}
```

(이전엔 하드코딩된 4개 키만 지웠는데, 자동화 모드 등 추가 키가 늘면서 빠지는
경우가 생겨 prefix 일괄 삭제로 통합.)

---

## 알려진 제약 / 향후

- **dev 전용**: `auth.isDevAccount` 가 false 면 UI 노출 없음. 일반 사용자가
  localStorage 강제 조작으로 speed=100 을 넣어 init() 에서 복원하는 경로는 막지
  않음 (의도적으로 dev 본인 디바이스에서 reload 후에도 복원되도록).
- **시각 효과 누적**: 매우 높은 배속(예: 500) 에서는 한 콜에 50+ tick 이 처리되어
  데미지 팝업이 동시에 쌓임 — 시각 디버깅용으로 부적합.
- **상점 매수 우선순위가 단순**: 현재 장착품보다 더 좋고 가장 비싼 게 아닌, 가장
  가치가 높은 매물부터. 골드 효율(value/cost) 정렬은 향후 검토.
- **특별이벤트 보너스 전부 포기**: 대장장이 +1 강화 같은 안전한 양보다 포기를
  택함. 선택적 자동 수락 정책 (예: 대장장이는 수락) 은 후속 작업.
