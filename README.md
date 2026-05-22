# 이번 판은 똥템으로 탑을 오르겠습니다 (climetop)

100층 로그라이크 탑 등정 RPG — Vue 3 + TypeScript + Capacitor.
PC 브라우저 / 안드로이드 동시 지원.

> 매 런 영구사망. 클리어 시점 장비 티어가 낮을수록 등급↑ 누적 보너스↑.
> 누적 골드 5만 도달 → 가장 최근 클리어 캐릭터로 "진짜 보스" 도전.

## 서사 — 이게 진짜 무슨 게임인가

겉으로는 "똥템으로 100층 탑을 오르는 로그라이크" 지만 진행하다 보면 진실이 드러난다.

- 탑 100층은 **주인공의 각성 꿈공간**이다. 100층을 도는 동안 보는 골렘·언데드·고블린 같은 몬스터들은 모두 꿈 몬스터.
- 현실에서는 **진짜 보스들이 시간의 신을 공격**하고 있다. 그들이 꿈공간으로 몬스터를 소환해 주인공을 같이 흔드는 중.
- **시간의 신**은 자기 힘을 깎아 주인공에게 능력을 부여한다 — 꿈공간에서 힘을 쌓아 결국 진짜 보스를 잡으라고.
- **적은 힘으로 많은 꿈몬스터를 잡을수록 (= 똥템 클리어)** 시간의 신은 더 여유롭다 → 다음 회차에 더 큰 능력치를 부여 (= 누적 보너스 풀 ↑).
- **진짜 보스 도전 실패 시** 시간의 신이 주인공을 **회귀**시키고 깎은 비율만큼 영구 시작 스탯을 추가한다.
- **게임 클리어** = 진짜 보스들을 모두 쓰러뜨리는 것.

이 서사는 인트로 만화 3컷으로 전달된다. 첫 플레이 시엔 1~2컷만 보여주고 (= "탑 올라가" 만 알려줌), **첫 진짜 보스를 잡으면 3번째 컷이 잠금 해제** 되며 진실이 공개된다. 자세히는 [docs/features/intro-comic.md](docs/features/intro-comic.md) · [docs/features/realboss.md](docs/features/realboss.md) 참조.

게임 시스템의 의미:

| 메커니즘 | 서사적 의미 |
|---|---|
| 똥템 클리어 등급 ↑ → 보너스 ↑ | 시간의 신의 여력 |
| 누적 보너스 풀 (영구) | 시간의 신이 부여한 힘 |
| 진짜 보스 도전 (5만 골드 누적) | 시간의 신이 현실로 통로를 여는 임계 |
| 진짜 보스 실패 → 영구 시작 보너스 | 시간의 신의 회귀 / 추가 능력치 부여 |
| `realBossDefeated = true` | 게임 클리어 (모든 진짜 보스 처치) |

---

## 빠른 시작

```bash
npm install
npm run dev              # PC 개발 서버 (http://localhost:5173)
npm run build            # 정적 빌드 → dist/
npm run sim              # 밸런스 시뮬레이터 (300~500런/케이스)
```

안드로이드:

```bash
npm run android:build    # build + cap sync (APK/AAB 직접 빌드는 Android Studio 또는 gradlew)
npm run android          # Android Studio 열기
npm run android:bundle   # Play Store 업로드용 AAB 만들기 (release 서명 필요)
```

상세 안드로이드 빌드/서명: [docs/features/release-signing.md](docs/features/release-signing.md) · AAB 출시 흐름: [docs/play-store/release-checklist.md](docs/play-store/release-checklist.md)

---

## 핵심 게임플레이 한 줄 요약

| 시스템 | 핵심 |
|---|---|
| 캐릭터 | 5스탯(힘/민첩/체력/마력/행운) 각 12 기본, 주사위 3회로 랜덤 분배(60pt) + 누적 보너스 분배 |
| 진행 | 100층 = 10챕터 × 10층. 11 테마(고블린/골렘/언데드/환영/흡혈귀/심해/기계/용암/암흑/천공/맹독)에서 무작위 10개 |
| 전투 | 게이지 누적 자동 턴제. 곱셈 데미지 모델, 19종 스킬 자동 발동, 6종 상태이상 |
| 장비 | 무기 15종(근접 9 + 활 3 + 마법 3) + 갑옷 4종. 4등급(노말/레어/스페셜/레전드) × 4특성티어(하급/보통/희귀/특별) |
| 스킬 | 물리공격 5, 물리방어 4, 마법공격 7, 마법방어 3 (총 19) — 무기/갑옷에 묶인 자동 스킬 + 갑옷 피격 자동 반응 |
| 진짜 보스 | 누적 클리어 골드 5만 도달 → 최근 클리어 캐릭터로 챕터 10 하드 보스 강화판 도전. 깎은 비율 × 60 → 영구 시작 스탯 |
| 챌린지 | 50개 풀에서 3개 랜덤 제시, 1개 선택. 즉시 보상형(25) + 리스크 베팅형(25) |

---

## 기술 스택

- **Vue 3** + **TypeScript** + **Vite** (개발/빌드)
- **Pinia** (단일 store `useGameStore` — `src/stores/game.ts`)
- **Tailwind CSS** + 커스텀 CSS 변수
- **Capacitor 6** (Android 패키징)
- **Firebase Auth + Firestore** (Google 로그인 + 클라우드 진행도 백업)
- **AdMob 보상형 광고** — `@capacitor-community/admob` (부활/4배속/자동진입 3종)

상태 직렬화는 `localStorage` (단일 슬롯). 클라우드는 옵션. 주요 키:
- `climetop:meta:v1` — 누적 보너스 / 진짜 보스 상태 (`MetaBonuses`)
- `climetop:run:v1` — 진행 중 런 (`TowerRun`)
- `climetop:creation:v1` — 캐릭터 생성 임시 상태
- `climetop:autoEnter:v1` · `climetop:speed:v1` · `climetop:tutorialSeen:v1` · `climetop:sound:v1`

---

## 디렉토리

```
src/
├── data/           정적 게임 데이터 (무기/갑옷/특성/스킬/상태이상/챕터/챌린지)
├── core/           게임 로직
│   ├── stats.ts          5스탯 → 실효 스탯 산출
│   ├── combat.ts         전투 컨텍스트 + tick 진행
│   ├── skills.ts         19종 스킬 실행
│   ├── status.ts         상태이상 (점화/출혈/독/둔화/암흑/감전)
│   ├── items.ts          아이템 생성/등급/특성
│   ├── itemValue.ts      아이템 공/방 벨류 휴리스틱 (자동 평가)
│   ├── tower.ts          100층 + 챕터/플로어 생성
│   ├── events.ts         특별 이벤트 6종 (대장장이/룰렛/제단/암시장/모험가/수집가)
│   ├── shop.ts           상점 + 새로고침
│   ├── monsterTraits.ts  몬스터 trait (31종)
│   ├── monsterSfx.ts     몬스터 효과음 카테고리 분류
│   ├── challengeRuntime.ts 챌린지 추적/판정
│   ├── meta.ts           누적 보너스 저장 / 캐릭터 히스토리
│   ├── realboss.ts       진짜 보스 도전
│   ├── buildBalance.ts   무기/갑옷 자동 스킬 발동률 휴리스틱
│   ├── scoreThresholds.ts 클리어 등급 임계값
│   └── __sim__/          밸런스 시뮬레이터 (`npm run sim`)
├── stores/         Pinia 스토어 (game.ts + auth.ts)
├── screens/        화면 (MainMenu / CharacterCreation / Dungeon / Combat / Shop / VictoryScreen / GameOver / RealBossChallenge / RealBossResult / SettingsScreen / SplashScreen)
├── ui/
│   ├── components/ 재사용 컴포넌트 (ItemDetail, HpMpBar, DialogModal 등 14종)
│   ├── images.ts   이미지 URL 헬퍼
│   ├── colors.ts   등급/티어/상태 색상 매핑
│   └── sound.ts    BGM (2종) / SFX (Web Audio API)
├── lib/            외부 SDK 래퍼 (firebase / auth / cloudSync / ads)
├── types/          TypeScript 타입
└── styles/main.css Tailwind 진입점
```

---

## 문서

- **[DOCS.md](DOCS.md)** — 게임 전체 디자인 + 시스템 종합 문서 (단일 진실 공급원)
- **[BALANCE.md](BALANCE.md)** — 밸런스 수치표 + v9 시뮬레이터 결과 (가장 정확한 수치 출처)
- **[docs/systems/](docs/systems/)** — 시스템별 세부 문서 (스탯, 전투, 아이템, 스킬, 챌린지 등)
- **[docs/features/](docs/features/)** — 기능/변경 이력 문서 (인트로 만화, 진짜 보스, 자동 진입 등)
- **[docs/play-store/](docs/play-store/)** — Play Store 등록 자료 (체크리스트, 스토어 등록 정보, 개인정보 처리방침)

---

## 라이센스

개인 프로젝트.
- BGM `splash` 트랙: `public/sounds/Beneath_the_Wet_Stone.mp3` — 별도 라이선스 확인 필요
- 그 외 SFX: Web Audio API procedural
