# Climetop 전체 시스템 문서 (v6)

> **v6 핵심 변경**:
> - 스탯 10종 → **5종** (힘/민첩/체력/마력/행운) 통합
> - 장비 효과는 모두 *파생값에 합연산* (스탯 직접 변동 X)
> - 등급 계수 고정 (1/2/4/6 굴림 없음)
> - "트레잇" → "**특성**" 명칭 통일
> - 클리어 보너스 분배: VictoryScreen → 캐릭터 생성으로 이동 (누적 풀 방식)
> - **밸런스 수치 전수 갱신** — [balance.md](./balance.md) 참조


게임 전체 시스템을 한눈에 보기 위한 통합 인덱스.
세부는 각 `docs/systems/*.md` 또는 `docs/features/*.md` 참조.

---

## 📖 게임 개요
[overview.md](./systems/overview.md) — 한 줄 요약 / 핵심 원칙 / 화면 흐름

---

## 🎮 코어 시스템

| # | 시스템 | 한 줄 요약 |
| --- | --- | --- |
| 1 | [스탯](./systems/stats.md) | 10스탯 모델 + EffectiveStats(v4 가산식) |
| 2 | [캐릭터 생성](./systems/character-creation.md) | 외형 자동 + 챌린지 1개 + 주사위 3회 + 도전 보너스 |
| 3 | [전투](./systems/combat.md) | 틱 + 액션게이지 + 자동 행동 + 자동 다음 층 |
| 4 | [스킬](./systems/skills.md) | 4종 분류 + 무기/갑옷 부여 + 확률 자동 픽업 |
| 5 | [아이템](./systems/items.md) | 16티어 × 4등급 × 무기/갑옷 + 트레잇 |
| 6 | [트레잇](./systems/traits.md) | 4티어(하급~특별) + 퍼센트/가산/특수 효과 |
| 7 | [상태이상](./systems/status-effects.md) | 6종(점화/출혈/독/둔화/암흑/감전) + 부여/저항/반사 |
| 8 | [챕터/몬스터](./systems/chapters.md) | 11개 테마 + 10챕터 + 보스 v4 밸런싱 |
| 9 | [몬스터 trait](./systems/monster-traits.md) | 부활/소환/반사/페이즈 등 행동 trait + 부팅 검증 |
| 10 | [챌린지](./systems/challenges.md) | instant/bet 2 카테고리 + 30+ 종 |
| 11 | [특별 이벤트](./systems/special-events.md) | 6종 NPC (대장장이/도박사/제단/암시장/수집가/모험가) |
| 12 | [상점](./systems/shop.md) | 4슬롯 + 새로고침 챠지 + 자동 장착 |
| 13 | [메타 보너스](./systems/meta-bonuses.md) | F~EX 등급별 1~10pt + 누적 + 도전 모드 |
| 14 | [사운드](./systems/sound.md) | SFX/BGM + Autoplay 우회 + 화면 전환 라우팅 |
| 15 | [UI 모달](./systems/ui-modals.md) | DialogModal / InputModal / ListModal / PickupModal |

---

## ✨ 신규 / 개편 기능 (이번 작업 분)

| # | 기능 | 한 줄 요약 |
| --- | --- | --- |
| 1 | [인트로 만화](./features/intro-comic.md) | 최초 자동 + 설정 다시보기, 도전 1회 클리어 후 마지막 컷 잠금 해제 |
| 2 | [진짜 보스 도전](./features/realboss.md) | 등반 5~10회 마다 최약 캐릭터 부활 → 다음 캐릭터 +스탯 |
| 3 | [캐릭터 외형 자동](./features/auto-avatar.md) | 4명 선택 제거 → 자동 1명 추첨 |
| 4 | [자동 진입](./features/auto-enter.md) | 일반/보스/치유샘만 자동 + 전투 종료 자동 다음 층 |
| 5 | [설정 패널 UX](./features/settings-panel.md) | 기본 접힘 + 5초 자동 접힘 + 모달 위에서 흐림 |
| 6 | [안드로이드 뒤로가기](./features/back-button.md) | 모달/상점 우선 닫기, Esc 키 동일 |
| 7 | [릴리스 서명 셋업](./features/release-signing.md) | keystore.properties 분리 + versionCode |
| 8 | [빈 슬롯 자동 장착](./features/auto-equip.md) | tier 가장 높은 아이템 자동 장착 |
| 9 | [데이터 리셋](./features/data-reset.md) | 4개 키 비우고 새로고침 |
| 10 | [이미지 워터마크 제거](./features/watermark-removal.md) | Pillow + clone stamp 인페인트 |

---

## 🗂 전체 파일 맵

### `src/core/` — 게임 로직
| 파일 | 역할 |
| --- | --- |
| `stats.ts` | EffectiveStats 계산 |
| `character.ts` | 캐릭터 생성, 클리어 점수/등급 |
| `combat.ts` | 전투 컨텍스트, 틱, 몬스터/플레이어 행동 |
| `skills.ts` | 스킬 사용, 자동 픽업 |
| `items.ts` | 아이템 굴림, 트레잇 스케일링 |
| `traits.ts` (data) | 트레잇 정의 |
| `status.ts` | 상태이상 부여/갱신/DoT |
| `tower.ts` | 챕터 구성, 층 진행 |
| `events.ts` | 6종 특별 이벤트 핵심 로직 |
| `shop.ts` | 상점 생성/새로고침 |
| `meta.ts` | 메타 저장/마이그레이션/히스토리 |
| `realboss.ts` | 도전 모드 |
| `challengeRuntime.ts` | 챌린지 컨텍스트/훅/평가 |
| `monsterTraits.ts` | 몬스터 trait 레지스트리 |
| `monsterSfx.ts` | 몬스터별 사운드 매핑 |
| `buildBalance.ts` | 무기 스킬 발동률 등 빌드 밸런싱 |
| `rng.ts` | 난수 헬퍼 |
| `__sim__/` | 밸런스 시뮬레이터 |

### `src/data/` — 정적 정의
| 파일 | 역할 |
| --- | --- |
| `chapters.ts` | 11개 챕터 테마 + 몬스터 베이스라인 |
| `weapons.ts` | 무기 13종 |
| `armor.ts` | 갑옷 4종 |
| `traits.ts` | WEAPON_TRAITS / ARMOR_TRAITS |
| `skills.ts` | 19종 스킬 정의 |
| `statuses.ts` | 6종 상태이상 |
| `challenges.ts` | 30+ 챌린지 |

### `src/screens/` — 화면
MainMenu / CharacterCreation / Dungeon / Combat / Shop / GameOver / VictoryScreen / SplashScreen / RealBossChallenge / RealBossResult

### `src/ui/` — UI 컴포넌트 + 헬퍼
`components/` (모달, HpMpBar, ItemDetail, InventoryModal, StatusBadges, SpeedControl, IntroComic, ...) + `images.ts / sound.ts / colors.ts`

### `src/stores/` — 상태
`game.ts` — 모든 게임 상태 + 액션을 단일 Pinia store에 집중

### `src/types/index.ts` — 모든 인터페이스 / 상수

---

## 📦 LocalStorage 키 일람

| 키 | 내용 |
| --- | --- |
| `climetop:meta:v1` | MetaBonuses 전체 (누적 보너스, 히스토리, 도전 카운터 등) |
| `climetop:run:v1` | 진행 중 런 (TowerRun) |
| `climetop:creation:v1` | 캐릭터 생성 임시 상태 |
| `climetop:tutorialSeen:v1` | 인트로 만화 자동 표시 여부 |
| `climetop:speed:v1` | 게임 속도 1/2/4 |
| `climetop:autoEnter:v1` | 자동 진입 토글 |
| `climetop:speedControl:expanded:v2` | 설정 패널 펼침 |
| (sound 모듈 내부) | SFX/BGM ON 및 볼륨 |

데이터 리셋([data-reset](./features/data-reset.md))은 게임 진행과 시청 키만 비우고 사용자 선호(속도/자동/사운드)는 유지.

---

## 🏗 빌드 & 배포

### 웹 / 개발
```bash
npm install
npm run dev        # vite 5173
npm run build      # vue-tsc + vite build → dist/
```

### 안드로이드
```bash
npm run build
npx cap sync android
# Android Studio Build > Generate Signed Bundle / APK
# 또는: cd android && gradlew.bat assembleRelease
```
[release-signing](./features/release-signing.md) — 키스토어 셋업 + versionCode 관리

---

## 향후 정리 메모

- 사망 캐릭터 히스토리 적재 여부 결정
- 안드로이드 뒤로가기 종료 시 확인 모달
- 인트로 만화 컷 사이 페이드 효과
- t1/t2 인페인트 자국 재처리 자동화
- BALANCE.md / tower-rpg-design.md 와 이 문서들의 일관성 점검
