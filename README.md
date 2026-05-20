# 이번 판은 똥템으로 탑을 오르겠습니다 (climetop)

100층 로그라이크 탑 등정 RPG — Vue 3 + TypeScript + Capacitor.
PC 브라우저 / 안드로이드 동시 지원.

> 매 런 영구사망. 클리어 시점 장비가 약할수록 등급↑ 누적 보너스↑.
> 누적 골드 5만 도달 → 가장 최근 클리어 캐릭터로 "진짜 보스" 도전.

---

## 빠른 시작

```bash
npm install
npm run dev         # PC 개발 서버 (http://localhost:5173)
npm run build       # 정적 빌드 → dist/
npm run sim         # 밸런스 시뮬레이터 (300~500런/케이스)
```

안드로이드:

```bash
npm run android:build  # build + cap sync
npm run android        # Android Studio 열기
```

---

## 핵심 게임플레이 한 줄 요약

| 시스템 | 핵심 |
|---|---|
| 캐릭터 | 5스탯(힘/민첩/체력/마력/행운) 각 10 기본, 주사위 3회로 랜덤 분배(50pt) + 누적 보너스 분배 |
| 진행 | 100층 = 10챕터 × 10층. 11 테마(고블린/골렘/언데드/환영/흡혈귀/심해/기계/용암/암흑/천공/맹독)에서 무작위 10개 |
| 전투 | 게이지 누적 자동 턴제. 속도→공격 빈도, 공격력×관통/방어 계산, 19종 스킬 자동 발동 |
| 장비 | 무기 13 + 마법 21(3타입×7속성) + 갑옷 4. 4등급(노말/레어/스페셜/레전드) × 4특성티어(하급/보통/희귀/특별) |
| 스킬 | 물리공격 5, 물리방어 4, 마법공격 7, 마법방어 3 (총 19) — 무기/갑옷에 묶인 자동 스킬 |
| 진짜 보스 | 누적 클리어 골드 5만 도달 → 최근 클리어 캐릭터로 챕터 10 하드 보스 강화판 도전. 깎은 비율 × 60 → 영구 시작 스탯 |
| 챌린지 | 50개 풀에서 3개 랜덤 제시, 1개 선택. 즉시 보상형(25) + 리스크 베팅형(25) |

---

## 기술 스택

- **Vue 3** + **TypeScript** + **Vite** (개발/빌드)
- **Pinia** (Pinia options API 단일 store `useGameStore`)
- **Tailwind CSS** + 커스텀 CSS 변수
- **Capacitor 6** (Android 패키징)

상태 직렬화는 `localStorage` 사용 (세이브 슬롯 1개):
- `climetop:meta:v1` — 누적 보너스/진짜 보스 상태
- `climetop:run:v1` — 진행 중 런
- `climetop:creation:v1` — 캐릭터 생성 진행 상태

---

## 디렉토리

```
src/
├── data/           정적 게임 데이터 (무기/갑옷/특성/스킬/상태이상/챕터/챌린지)
├── core/           게임 로직
│   ├── stats.ts          5스탯 → 실효 스탯 산출
│   ├── combat.ts         전투 컨텍스트 + tick 진행
│   ├── skills.ts         19종 스킬 실행
│   ├── items.ts          아이템 생성/등급/특성
│   ├── itemValue.ts      아이템 공격/방어 벨류 휴리스틱
│   ├── status.ts         상태이상 (점화/둔화/감전 등)
│   ├── tower.ts          100층 + 챕터/플로어 생성
│   ├── events.ts         특별 이벤트 (대장장이/룰렛/제단/암시장)
│   ├── shop.ts           상점 + 새로고침
│   ├── monsterTraits.ts  몬스터 trait 시스템 (40+ 행동)
│   ├── challengeRuntime.ts 챌린지 추적/판정
│   ├── meta.ts           누적 보너스 저장
│   ├── realboss.ts       진짜 보스 도전
│   ├── buildBalance.ts   무기/갑옷 자동 스킬 발동률 휴리스틱
│   └── __sim__/          밸런스 시뮬레이터
├── stores/         Pinia 스토어 (game.ts 단일)
├── screens/        화면 (MainMenu / CharacterCreation / Dungeon / Combat / Shop / VictoryScreen / GameOver / RealBossChallenge / RealBossResult / SplashScreen)
├── ui/
│   ├── components/ 재사용 컴포넌트 (ItemDetail, HpMpBar, DialogModal 등)
│   ├── images.ts   이미지 URL 헬퍼
│   ├── colors.ts   등급/티어/상태 색상 매핑
│   └── sound.ts    BGM/SFX
├── types/          TypeScript 타입
└── styles/main.css Tailwind 진입점
```

---

## 문서

- **[DOCS.md](DOCS.md)** — 게임 전체 디자인 + 시스템 종합 문서 (단일 진실 공급원)
- **[BALANCE.md](BALANCE.md)** — 밸런스 수치표 + 시뮬레이터 결과
- **[docs/systems/](docs/systems/)** — 시스템별 세부 문서 (스탯, 전투, 아이템, 스킬, 챌린지 등)

---

## 라이센스

개인 프로젝트.
