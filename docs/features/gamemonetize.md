# GameMonetize 통합 (광고 SDK + 호스팅 트랙)

> Firebase Hosting 과 함께 동일 빌드로 GameMonetize 포털에도 배포.
> 자체 도메인은 자유 운영, GameMonetize 는 광고 수익 + 트래픽 확보.

코드: `src/lib/ads.ts`, `src/App.vue`, `src/ui/sound.ts`, `src/ui/images.ts`, `index.html`, `vite.config.ts`

---

## 두 트랙 동일 빌드 원칙

`vite.config.ts` 의 `base: './'` 로 모든 자산 URL 을 상대경로화. Firebase Hosting (도메인 루트) 과
GameMonetize CDN (`https://html5.gamemonetize.com/<gameId>/...` 서브디렉토리) 양쪽에서 같은
`dist/` 산출물이 그대로 동작.

```bash
# Firebase Hosting
npm run deploy

# GameMonetize 포털 업로드
npm run build
cd dist && zip -r ../climetop-gamemonetize.zip .
```

---

## SDK 로딩 & 이벤트 파이프라인

### `index.html`

```html
<script>
  window.SDK_OPTIONS = {
    gameId: '5w9to8lrnly4ouwgkjxiykiaiitznvwp',
    onEvent: function (a) {
      if (a && typeof a.name === 'string') {
        window.dispatchEvent(new CustomEvent('gm-sdk-event', { detail: a }))
      }
    },
  }
</script>
<script async src="https://api.gamemonetize.com/sdk.js"></script>
```

SDK 콜백을 그대로 받지 않고 `window` CustomEvent (`gm-sdk-event`) 로 전파 — `ads.ts` 가 이를 구독해
보상형 광고 결과 / 라이프사이클을 일관된 단일 진입점으로 처리.

### SDK 가 노출하는 함수 (실측)

**중요**: SDK 는 `window.sdk.showAd()` 가 아니라 **탑레벨 함수 `window.ShowAds()`** 로 노출됨
(구 GameDistribution SDK 네이밍 그대로). 진단 로그(`[ads-diag]`) 로 확인 완료.

| 함수 | 인자 | 용도 |
|---|---|---|
| `window.ShowAds()` | (없음) | 인터스티셜 |
| `window.ShowAds('rewarded')` | `'rewarded'` | 보상형 비디오 |
| `window.ShowAds2()` | — | 변형 (미사용) |
| `window.MobileInGame()` | — | 모바일 컨텍스트 (미사용) |

`ads.ts` 의 `callShowAd()` 가 `ShowAds` 우선 + `sdk.showAd` 폴백으로 단일 호출 진입점 제공.

### SDK 이벤트 → 우리 핸들러 매핑

| SDK 이벤트 | 우리 동작 |
|---|---|
| `SDK_READY` | `onReady` 콜백 → 프리롤 시도 |
| `SDK_GAME_PAUSE` | `onPause` → 게임 자동 틱 / BGM 일시정지 |
| `SDK_GAME_START` | `onResume` → 자동 틱 / BGM 재개 + (보상 settle 안 됐으면) reward 폴백 |
| `AD_FINISHED` / `AD_REWARDED` / `AD_COMPLETE` | 보상 지급 |
| `AD_CANCELED` / `AD_ERROR` / `SDK_REWARDED_NOT_AVAILABLE` | **보상 지급** (no-fill 은 사용자 잘못 X) |
| `AD_SKIPPED` | 보상 거부 (사용자가 명시적으로 스킵) |
| (8초 무응답) | 보상 지급 (SDK 침묵 = no-fill 로 간주) |

---

## 광고 사용처

`AdUseCase` 3종 (보상형) + 세션당 1회 인터스티셜.

| 종류 | 사용처 | 시그너처 |
|---|---|---|
| `revive` | 사망 시 부활 | `showRewardedAd('revive')` |
| `fastSpeed` | 전투 속도 4배속 해금 | `showRewardedAd('fastSpeed')` |
| `autoEnter` | 자동 진입 등반당 해금 | `showRewardedAd('autoEnter')` |
| 프리롤 | 게임 첫 진입 (`dismissSplash` 직후 또는 `SDK_READY`) | `showInterstitial()` |

### 프리롤 트리거 (다중 경로)

`App.vue` 에서 세 경로 동시 보장 — 어느 하나가 실패해도 다른 경로가 발동:

1. **스플래시 클릭** → `dismissSplash()` → `schedulePreroll()`
2. **`SDK_READY` 이벤트** → `onReady` 콜백 → `schedulePreroll()`
3. **`onMounted` 시점에 이미 SDK ready** → 즉시 `schedulePreroll()`

`schedulePreroll()` 자체는 `sessionStorage('gm_preroll_done')` 가드로 세션당 1회 실제 호출.
플래그는 `showInterstitial` 호출 직전에 박혀서 폴링 실패 시 다른 트리거가 재시도 가능.
폴링은 10초까지 SDK ready 대기.

---

## 검증/활성화 라이프사이클

| 단계 | 의미 | 트리거 |
|---|---|---|
| **New** | 업로드 직후. 광고 인벤토리 0 | zip 업로드 |
| **Verified** | SDK 통합 정상. 검증 통과 | 콘솔에서 "Verify Game" → "ShowBanner" 클릭 |
| **Active** | 실광고 송출 시작 | "Request Activation" 통과 (누적 트래픽 기준) |

### "New" 상태의 특성

- 광고 fill 0 — 모든 `ShowAds` 호출이 12초 safety timer 후 `AD_CANCELED`
- SDK 가 첫 no-fill 받은 후 같은 세션 추가 호출에 **침묵** (이벤트 미발사)
- 우리 코드는 8초 timeout 안전망 → 사용자에게는 보상 지급으로 UX 유지

### "Active" 상태로의 승급

- 누적 ad request 트래픽이 일정 임계치 이상
- 24~48시간 모니터링 기간
- 자연 트래픽 (다중 IP/세션) 권장 — 같은 세션 반복 클릭은 SDK 가 dedup

---

## 자산 경로 정책

GameMonetize CDN 호환을 위한 두 가지 절대 원칙:

### 1. 모든 자산 URL 은 상대경로

```ts
// ❌ 금지 — Firebase 에선 OK 지만 GM 서브디렉토리 호스팅에서 404
const url = '/sound/Beneath_the_Wet_Stone.mp3'

// ✅ BASE_URL prefix
const url = `${import.meta.env.BASE_URL}sound/Beneath_the_Wet_Stone.mp3`
// 또는 ${A}/images/... 패턴 (A = BASE_URL.replace(/\/$/, ''))
```

`vite.config.ts` 의 `base: './'` 가 자동 처리하는 부분(빌드 산출물의 `<script>` / `<link>`) 외에,
런타임에서 동적으로 조립하는 자산 URL 도 모두 BASE_URL prefix 필요.

### 2. 파일명은 ASCII 만

**GameMonetize CDN 이 zip 추출 시 한글 파일명을 다른 인코딩으로 해석해 디스크에 저장**해
URL UTF-8 percent-encoded 요청이 모두 404. zip 자체는 UTF-8 정상이어도 무관.

- `public/images/**` 전체 ASCII 파일명 (174개 리네임 완료, 한글 잔재 0건)
- `src/ui/images.ts` 의 매핑 테이블 — 키는 한글 (게임 데이터 키), VALUE 는 ASCII 파일명
  - `WEAPON_FILE`: `검 → 'sword'`, `대검 → 'greatsword'` …
  - `ARMOR_FILE`: `판금 → 'plate'`, `로브 → 'robe'` …
  - `MONSTER_FILE_MAP`: `'고블린 전사' → 'goblinwarrior'` …
  - `STAT_FILE`: `힘 → 'patk'`, `민첩 → 'spd'` …
  - `STATUS_FILE`: `점화 → 'burn'`, `독 → 'poison'` …
  - `NPC_FILE`: `대장장이 → 'smith'`, `상점 → 'shop'` …
  - `THEME_FILE`: `고블린 → 'goblin'`, `흡혈귀 → 'vampire'` … (BACKGROUND/REALBOSS 공용)
  - `SKILL_FILE`: `화염구 → 'fireball'`, `폭풍칼날 → 'stormblade'` … (전체 19종)

UI/숫자 등급은 ASCII 접미사: `A등급.webp` → `A_grade.webp` (`rankIconUrl` 갱신).
배경 wide 변형은 `_wide` 통일: `고블린WIDE.webp` / `심해wide.webp` → `goblin_wide.webp` / `deepsea_wide.webp`.

---

## 진단 로그 (`[ads-diag]`, `[ads]`)

`ads.ts` 와 `App.vue` 가 콘솔에 흘리는 진단:

| 로그 | 의미 |
|---|---|
| `[ads-diag] window keys matching ...` | 첫 ad 호출 시 1회 — SDK 가 어느 이름으로 노출됐는지 dump |
| `[ads] showRewardedAd called {...}` | 보상형 진입 — `sdkReady` 값 같이 출력 |
| `[ads] calling SDK ShowAds (rewarded)` | 실제 SDK 호출 시점 |
| `[ads] gm-sdk-event <NAME> <message>` | SDK 가 발사한 모든 이벤트 (message 포함) |
| `[ads] rewarded ad finished {result, useCase}` | 보상형 settle |
| `[ads] preroll: scheduling — polling SDK ready up to 10s` | 프리롤 폴링 시작 |
| `[ads] preroll: SDK ready → firing interstitial` | 프리롤 실제 호출 시점 |
| `[ads] preroll: skipped — sessionStorage flag already set` | 세션 가드로 스킵 |

---

## 트러블슈팅 체크리스트

| 증상 | 원인 / 확인 |
|---|---|
| `[ads] sdkReady: false` 지속 | SDK 가 다른 객체 이름. `[ads-diag]` 출력에서 `hasShowAd: true` 키 찾아 `isSdkReady` / `callShowAd` 조정 |
| 모든 보상이 즉시 지급 (광고 없이) | `isSdkReady()` 가 false → SDK 객체 못 찾음. 또는 BYPASS_ADS 가 true (`ads.ts:33`) |
| 30초/8초 후 보상 거부 | SDK 침묵 — no-fill 이거나 SDK 가 호출을 dedup. 정상. 8초 timeout 후 보상 지급되도록 처리됨 |
| 이미지 404 (`%XX%XX%XX.webp`) | 한글 파일명 잔재. `grep -r '[가-힣]*.webp' src/` 로 확인 |
| 사운드 404 (`/sound/...`) | 절대경로 사용. `${import.meta.env.BASE_URL}sound/...` 로 교체 |
| 프리롤 안 뜸 | 콘솔에서 `[ads] preroll: skipped — sessionStorage flag already set` 확인. 새 탭 / 시크릿 창으로 테스트 |
| Verify 통과 안 됨 | 설명/이미지 누락 여부 콘솔에서 확인. 그래도 막히면 `mentolatux@gamemonetize.com` 문의 |
| Request Activation 비활성 | 누적 트래픽 부족. 다중 세션/IP/시간 필요. 재업로드 자제 (카운터 리셋) |

---

## 검증 통과 절차 (실측)

GameMonetize 콘솔에서:

1. 게임 편집 페이지 — Name / Category / Description (1000자) / 이미지 3종 (512×384, 512×512, 512×340) 완전 입력
2. zip 업로드 (이번 빌드 `climetop-gamemonetize.zip`)
3. "Verify Game" 버튼 → iframe 으로 게임 열림
4. **iframe 내 콘솔의 "ShowBanner()" 등 테스트 광고 버튼 클릭** → SDK 통합 확인
5. 검증 통과 → "Verified" 라벨
6. "Request Activation" 클릭 → GM 측 리뷰 → "Active" 승급

활성화 후엔 우리 코드의 `showRewardedAd` / `showInterstitial` 호출이 실광고로 변환되며,
`AD_FINISHED` / `AD_REWARDED` 이벤트가 정상 발사되어 보상 흐름이 의도대로 동작.

---

## 관련 커밋 (이력)

| 커밋 | 내용 |
|---|---|
| `f840030` | 사운드 절대경로 수정 + 챌린지 한글 i18n 버그 + 광고 진단 로그 |
| `b86cbf2` | 한글 파일명 174개 ASCII 전수 리네임 + 매핑 갱신 |
| `c9597fb` | `window` SDK 객체 탐색 진단 로그 추가 |
| `34eea53` | SDK 호출 경로 `window.sdk.showAd` → `window.ShowAds` |
| `b91244d` | no-fill `AD_CANCELED` 시 보상 지급 (UX 폴백) |
| `7e97c55` | 프리롤 발동 안정성 강화 — 다중 트리거 + 10초 폴링 |
| `683491f` | rewarded timeout 30s → 8s + timeout 시 보상 지급 |
