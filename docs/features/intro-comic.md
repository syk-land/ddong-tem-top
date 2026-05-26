# 인트로 만화

> 게임 서사를 전달하는 3 컷 정적 만화. 첫 플레이는 표면 컨셉만, **진짜 보스 클리어 후 진실 공개**.

코드: `src/ui/components/IntroComic.vue`, `src/stores/game.ts` (introFlow / introPage / nextIntroPage)
이미지: `public/images/TUTORIAL/1.png`, `2.png`, `3.png`

---

## 3 페이지 구성

| page | 이미지 | 내용 (서사) |
|---|---|---|
| 1 | `TUTORIAL/1.png` | 1컷 — 똥템 탑 등반 / 시간의 신 첫 등장 |
| 2 | `TUTORIAL/2.png` | 2컷 — 100층 도달 후 시간의 신과 조우 |
| 3 | `TUTORIAL/3.png` | 3컷 — **진실 공개**: 진짜 보스들이 시간의 신을 공격 중, 현실로 나가야 함 |

> 옛 버전엔 `main.png` 표지 컷 (page 0) 이 있었으나 제거됨. 모든 flow 는 t1 부터 시작.

---

## 흐름 (`introFlow`)

`introFlow` 는 3가지 시퀀스:

### `first` — 최초 플레이
```
page: 1 (t1) → 2 (t2) → menu
```
**t3 (3컷) 은 표시 안 됨.** 표면 컨셉만 전달.

### `afterRealBoss` — 진짜 보스 1차 클리어 직후
```
page: 1 (t1) → 2 (t2) → 3 (t3) → create
```
**t3 잠금 해제** → 진실 공개. 곧장 다음 캐릭터 생성으로.

### `replay` — 설정에서 다시 보기
```
page: 1 → 2 → (3, realBossDefeated 시에만) → menu
```
본인이 본 만큼만 다시 재생. t3 는 `meta.realBossDefeated === true` 일 때만.

---

## 진입 트리거

| 트리거 | flow | 진입 위치 |
|---|---|---|
| 첫 실행 (`tutorialSeen` 없음) | `first` | 앱 시작 → 메인 메뉴 직전 |
| `RealBossResult` 에서 완전 클리어 (`drainRatio === 1`) | `afterRealBoss` | RealBossResult → 자동 |
| `SettingsScreen` 의 "인트로 다시 보기" | `replay` | 사용자 클릭 |

---

## 상호작용

- 화면 어디든 클릭/탭 → 다음 페이지
- 마지막 페이지 → "시작하기" CTA
- 중간 페이지 → "다음 페이지로 (터치)" 안내
- 뒤로가기 / Esc → 만화 닫기 (현재 페이지에서 종료)
- 페이지 사이는 즉시 전환 (페이드 없음 — 향후 개선 여지)

---

## 저장

```ts
localStorage["climetop:tutorialSeen:v1"] = "1"
```

`SettingsScreen` 의 "모든 데이터 리셋" 시 같이 삭제 → 인트로 만화 재표시.

---

## 서사 ↔ 시스템 연결

t3 잠금 해제는 단순 미관 보상이 아니라 **게임의 진짜 목적을 드러내는 장치**:

| 시점 | 플레이어가 아는 것 |
|---|---|
| `first` 직후 | "100층 똥템으로 등반하면 보너스 받음" |
| 첫 진짜 보스 도전 (t3 못 봄) | "어? 갑자기 진짜 보스라는 게 등장" — 미스터리 |
| `afterRealBoss` t3 공개 | "사실 탑은 꿈이었고, 진짜 보스를 모두 잡는 게 목적" |
| 두 번째 진짜 보스 ~ | 진실을 알고 다시 사이클 시작 |

자세한 서사: [DOCS §0](../../DOCS.md#0-게임-서사-진짜-스토리)
