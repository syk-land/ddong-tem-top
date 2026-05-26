# 캐릭터 외형 & 이름

> 거지템 모에 10명 중 외형 선택, 추천 이름은 자동, 사용자 이름 1개 영구 저장. 마지막 선택은 다음 캐릭터 생성 시 자동 복원.

코드: `src/screens/CharacterCreation.vue`, `src/screens/Combat.vue`, `src/screens/Dungeon.vue`, `src/stores/game.ts`, `src/ui/images.ts`
이미지:
- `public/images/USER/01.webp ~ 10.webp` (전신, 캐릭터 생성/던전용)
- `public/images/USER_BUST/01.webp ~ 10.webp` (흉상, 전투용)

---

## 10명 캐릭터

| ID | 추천 이름 | 외형 키워드 |
|---|---|---|
| 01 | 아이리스 | 은발 트윈테일, 푸른 눈, 누더기 흰 셔츠 + 갈색 천 치마 |
| 02 | 히나타 | 빨간 사이드포니, 호박색 눈, 거친 천 + 녹슨 칼 |
| 03 | 쿠로네 | 흑발 후드 망토, 보라색 눈, 누더기 검은 천 |
| 04 | 루미네 | 금발 트윈브레이드, 분홍 눈, 누더기 흰 사제복 + 머리 천 |
| 05 | 미코 | 갈색 잔머리, 초록 눈, 누더기 짐승 가죽 + 부러진 활 |
| 06 | 레온 | 금발 단발, 파란 눈, 양철 냄비 헬멧 + 나무막대 검 + 도마 방패 |
| 07 | 카이 | 흑발 잔머리, 노란 눈, 상의 탈의 + 천 붕대 (격투가) |
| 08 | 사이 | 민트 머리, 보라 눈, 깨진 안경 + 더러운 가운 + 빈 플라스크 |
| 09 | 노아르 | 보라 머리, 빨간 눈, 누더기 검은 망토 + 녹슨 낫 |
| 10 | 타카시 | 흑발 사무라이 상투, 회색 눈, 너덜한 회색 유카타 + 대나무 막대 |

모두 **인간**, 모두 **거지템 (찢어진 옷, 나무 / 녹슨 무기)**. 클래스 식별이 아닌 외형만의 다양성.

---

## 사용처별 컷

| 화면 | 컷 | 함수 |
|---|---|---|
| 캐릭터 생성 — 메인 카드 | 흉상 (작게) | `userBustUrl(key)` |
| 캐릭터 생성 — 변경 모달 | 전신 (크게) | `userAvatarUrl(key)` |
| 던전 진입 화면 — 캐릭터 카드 좌측 | **전신** (세로 풀하이트, `w-32 sm:w-40 min-h-[200px] object-cover`) | `playerImageUrl(runAvatar)` |
| 전투 화면 — 플레이어 카드 좌측 | **흉상** (`w-32 h-32 sm:w-36 sm:h-36 object-cover`) | `playerBustUrl(runAvatar)` |
| 메인 메뉴 — 이어하기 카드 | 전신 (썸네일) | `playerImageUrl(savedAvatarKey)` |

흉상↔전신 컷 두 종을 분리 운용해서, 좁은 정사각 컴포넌트(전투 / 헤더)에선 잘려도 얼굴이 보이도록 한다.

---

## 외형 선택 흐름

```
[캐릭터 생성 진입]
   ├─ selectedAvatar 결정
   │   ├─ 진행 중 폼 캐시 (climetop:creation:v1.selectedAvatar) 있음 → 그것 사용
   │   ├─ 영구 LS (climetop:lastAvatar:v1) 있음 → 그것 사용
   │   └─ 둘 다 없음 → 랜덤 1명
   │
   ├─ 메인 카드: 흉상 + 이름 + 변경 버튼
   │
   ├─ "변경" 버튼 → 모달
   │     ├─ 전신 1명씩, 좌우 ‹ › 페이저 (순환)
   │     ├─ 페이지 인디케이터 (10개 점 + N / 10)
   │     ├─ "취소" / "이 캐릭터 선택"
   │     └─ 선택 시 selectAvatar(key) → climetop:lastAvatar:v1 영구 저장
   │
   └─ "탑 진입" → runAvatar = selectedAvatar → 런 시작
```

UI:
- 메인 카드: 흉상 96px(sm 96px) + 이름(✎ 버튼으로 편집) + "외형" 버튼
- 모달: 전신 최대 320px, 좌우 화살표는 fixed position, sky 액센트

---

## 이름 시스템

**유저 캐릭터 이름은 1개**, 캐릭터별이 아님.

| 상태 | 표시 |
|---|---|
| 사용자가 이름을 직접 정하지 않음 | 현재 선택된 아바타의 **추천 이름** (위 표) |
| 외형만 바꿈 | 새 선택 아바타의 **추천 이름**으로 자동 갱신 |
| 사용자가 이름 편집 (`✎`) | **입력한 이름 고정** — 이후 외형 바꿔도 그대로 |
| 입력 다이얼로그에 빈 문자열 저장 | 추천 이름으로 폴백 (LS 삭제) |

코드:
- `game.setPlayerName(name)` — LS `climetop:playerName:v1` 에 저장 (또는 빈값이면 삭제)
- `game.characterName(key)` — `playerName ?? defaultCharacterName(key)` 반응형 표시용
- 최대 12자 (`NAME_MAX_LEN`)

---

## LS 키

| 키 | 타입 | 의미 | 비고 |
|---|---|---|---|
| `climetop:lastAvatar:v1` | `string` (01~10) | **사용자가 마지막에 확정한 외형** | 영구. 다음 진입 시 자동 복원 |
| `climetop:playerName:v1` | `string` | **사용자가 정한 이름** (한 개) | 영구. 미설정 시 추천 이름 |
| `climetop:creation:v1` | JSON | 진행 중 캐릭터 생성 폼 캐시 | `selectedAvatar` 포함, "탑 진입" 시 초기화 |
| `climetop:run:v1` | JSON | 진행 중 런 | `avatarKey` (= 그 런의 외형) 포함 |

---

## 옛 아바타 키 마이그레이션

옛 빌드에서는 `F_r*_c*` / `M_r*_c*` 형식의 21개 키였음. 새 빌드는 `01`~`10`. 호환:

- `isValidAvatarKey(k)`: 옛 키는 모두 invalid
- `init()` / `loadGame()` 진입 시 저장된 `avatarKey` 가 invalid → `resolveInitialAvatar(null)` 로 신 키 마이그레이션 + 세이브 재기록
- `playerBustUrl` / `playerImageUrl` 폴백: 옛 `user.png` 전신 시트 대신 `USER_BUST/01.webp` 흉상 사용 (방어선)

→ 옛 세이브를 이어해도 전투 화면에서 흉상이 정상 출력.

---

## 분할 / 변환 파이프라인

원본은 5×2 그리드 1장:
- `씹덕전신.png` (3264×1312) → 10명 전신 + 검은 패널 테두리
- `씹덕흉상.png` (3264×1312) → 10명 흉상

분할 스크립트: `scripts/split-moe-grid.cjs`
- 셀 추출 (`CROP_MARGIN=40px`) — 검은 테두리 + AA 안전 통과
- 전신만 raw 픽셀 스캔으로 **캐릭터 bbox 직접 검출** (밝기 60~240 + non-black 30% / non-white 5% 행/열만 컨텐츠로 간주)
- 흉상은 패널을 거의 꽉 채우므로 bbox 스킵
- **WebP 출력** (`quality: 88`) — `public/images/USER/{ID}.webp` / `public/images/USER_BUST/{ID}.webp`

전체 이미지 WebP 일괄 변환: `scripts/convert-all-to-webp.cjs`
- `public/images/` 하위 모든 `.png` → `.webp` + 원본 PNG 삭제
- 일반 일러스트 -90% ~ -95% 용량 절감

---

## 진짜 보스 부활 시

진짜 보스 도전에서 가장 최근 클리어 캐릭터를 부활할 때, 그 캐릭터의 아바타도 같이 부활.

```ts
characterHistory[lastIdx].avatar
```

`RealBossChallenge.vue` 에서 `playerImageUrl(weak.avatarKey)` 로 그때 썼던 외형 그대로 출력.
