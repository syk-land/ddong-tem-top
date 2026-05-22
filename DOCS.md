# Climetop — 게임 전체 문서

> 100층 로그라이크 탑 등정 RPG.
> 단일 진실 공급원(SSOT) — 게임 디자인, 시스템 구조, 데이터 명세를 한 문서에 통합.
> 수치 우선순위: **소스 코드 > BALANCE.md > 이 문서**.

---

## 목차

0. [게임 서사 (진짜 스토리)](#0-게임-서사-진짜-스토리)
1. [게임 개요](#1-게임-개요)
2. [게임 흐름](#2-게임-흐름)
3. [캐릭터 시스템](#3-캐릭터-시스템)
4. [전투 시스템](#4-전투-시스템)
5. [아이템 시스템](#5-아이템-시스템)
6. [스킬 시스템](#6-스킬-시스템)
7. [상태이상 시스템](#7-상태이상-시스템)
8. [챕터 & 몬스터](#8-챕터--몬스터)
9. [특별 이벤트](#9-특별-이벤트)
10. [상점](#10-상점)
11. [챌린지 시스템](#11-챌린지-시스템)
12. [누적 보너스 & 진짜 보스](#12-누적-보너스--진짜-보스)
13. [클리어 등급](#13-클리어-등급)
14. [데이터 / 저장](#14-데이터--저장)
15. [UI / 사운드](#15-ui--사운드)
16. [밸런스 시뮬레이터](#16-밸런스-시뮬레이터)

---

## 0. 게임 서사 (진짜 스토리)

> 이 게임의 컨셉은 "똥템으로 100층 탑 올라가기"가 아니다. 그건 표면적인 후크일 뿐, **첫 진짜 보스 클리어 직후 진실이 공개**된다.

### 진짜 스토리

- 탑 100층은 **주인공의 각성 꿈공간**이다. 안에서 마주치는 몬스터(고블린·골렘·언데드·환영·흡혈귀·심해·기계·용암·암흑·천공·맹독)는 모두 꿈 몬스터.
- 현실에서는 **진짜 보스들이 시간의 신을 공격**하고 있다. 그들이 자기 부하 몬스터를 주인공의 꿈공간으로 소환해서 같이 흔드는 중.
- **시간의 신**은 자기 힘을 깎아 주인공에게 능력을 부여한다 — 꿈공간에서 힘을 쌓아 결국 현실로 나가서 진짜 보스를 잡으라는 의도.
- **적은 힘(똥템)으로 많은 꿈몬스터를 잡을수록** 시간의 신은 더 여유로워진다 → 다음 회차에 더 큰 보너스 스탯 부여.
- **진짜 보스 도전 실패** → 시간의 신이 주인공을 **회귀시키고** 깎은 비율만큼 영구 시작 스탯을 부여한다.
- **게임 클리어** = 진짜 보스들을 **모두** 쓰러뜨려서 시간의 신을 구하는 것.

### 서사 ↔ 시스템 매핑

| 게임 시스템 | 서사적 의미 |
|---|---|
| 100층 탑 (10챕터 × 10층) | 주인공의 각성 꿈공간 |
| 11 챕터 테마의 몬스터 | 진짜 보스가 소환한 꿈 몬스터 |
| 클리어 등급 (똥템일수록 EX~SSS) | 적은 힘으로 잡았다 = 시간의 신의 여력 |
| 클리어 등급 보너스 (10~3pt) | 시간의 신이 부여한 힘 |
| 누적 보너스 풀 `totalBonusStats` | 영구 누적된 시간의 신의 능력치 |
| 진짜 보스 (`isChallengeDue` = 누적 골드 5만) | 시간의 신이 현실로 통로를 여는 임계 |
| 진짜 보스 부활 캐릭터 (`pickLatestRecord`) | 가장 최근에 가장 강해진 자아를 현실로 끌어냄 |
| 진짜 보스 깎은 비율 × 60pt 보상 | 회귀 시 시간의 신이 추가로 주는 능력치 |
| `realBossDefeated = true` | 진짜 보스 1차 격파 (스토리 진행) |
| 인트로 만화 t1, t2, **t3** | t1·t2 = 표면 컨셉 / **t3 = 진실 공개**, 진짜 보스 클리어 후 해금 |
| `runsSinceLastChallenge`, `nextChallengeAt` | 시간의 신이 다음 통로를 여는 간격 |

### 인트로 만화 전달 흐름

`src/ui/components/IntroComic.vue` 의 `introFlow`:

- **`first`** (최초 플레이): `t1 → t2 → menu` — "탑을 올라가라" 만 알려줌
- **`afterRealBoss`** (진짜 보스 처치 직후): `t1 → t2 → t3 → create` — **t3에서 진실 공개**
- **`replay`** (설정에서 다시보기): 본인이 본 만큼만 (t3 는 `realBossDefeated` 시에만)

### 진행 사이클

```
[똥템 캐릭터 만들기]
    │
    ↓
[꿈공간 100층 등반]  ─ 잘 통과할수록 (똥템·고난도 챌린지) → 보너스 ↑
    │
    ↓
[5만 골드 누적] ─ 시간의 신이 현실 통로를 엶
    │
    ↓
[진짜 보스 도전] ─ 가장 강해진 최근 캐릭터 부활
    │
    ├─ 100% 처치 → realBossDefeated = true → 인트로 t3 공개 → 다음 진짜 보스
    └─ 부분 처치 → 시간의 신이 회귀시킴 + 깎은 비율 × 60pt 영구 시작 보너스
                  └→ 다시 꿈공간으로 (이번엔 더 강함)
```

이 사이클이 게임 끝까지 반복된다. **모든 진짜 보스를 잡으면 게임 클리어**.

---

## 1. 게임 개요

**장르**: 텍스트 + 일러스트 기반 자동 전투 로그라이크 RPG.
**플랫폼**: PC 브라우저 (Vue 3 + Vite), Android (Capacitor 6).
**런 단위**: 1회 100층(=10챕터×10층). 영구사망. 사망 시 메타 누적 보너스만 영구 보존.

### 컨셉
- "똥템으로 탑을 오른다" — 저티어/저등급 장비로 클리어할수록 등급↑ → 다음 캐릭터 보너스↑.
- 자동 전투 — 사용자는 캐릭터 생성/장비/이벤트 선택만, 전투는 게이지 누적 기반 자동 진행.
- 누적 골드 5만 → "진짜 보스" 도전 → 최종 게임 클리어 목표.

---

## 2. 게임 흐름

```
[Splash 스플래시]
    ↓
[Intro 만화 — 최초 1회]
    ↓
[MainMenu] ─┬─ 이어하기 → [Dungeon]
            ├─ 새 캐릭터 ┌─[진짜 보스 due?]─→ [RealBossChallenge] → [RealBossResult] → [Intro 만화 t3] ─┐
            │            │                                                                                │
            │            ↓                                                                                ↓
            │       [CharacterCreation]                                                            [CharacterCreation]
            │            │ 챌린지 3개 중 1개 + 주사위 3회 + 누적 보너스 분배
            │            ↓
            │       [Dungeon] 탑 진입
            ├─ 설정 → [SettingsScreen]
            └─ 로그인(옵션) → Firebase Auth → 클라우드 동기화

[Dungeon] 10챕터 × 10층
    │
    ├ 일반 몬스터  → [Combat] → 골드/드랍
    ├ 보스         → [Combat] → 보스 드랍 + 챕터 종료
    ├ 상점         → [Shop]
    ├ 보물상자     → [Combat: 미믹]
    ├ 회복샘       → HP/MP 회복
    └ 특별 이벤트  → [Modal] (대장장이/룰렛/제단/암시장/모험가/수집가)
    │
    ├ 100층 클리어 → [VictoryScreen] → 등급/보너스 산정 → 메타 적립 → [MainMenu]
    └ HP 0        → [GameOver] → (광고 부활 1회 옵션) → [MainMenu]
```

---

## 3. 캐릭터 시스템

### 3.1 5스탯

소스: `src/core/stats.ts`

| 스탯 | 파생 | 비고 |
|---|---|---|
| **힘** (STR) | 물리 공격력 = `STR × baseAtk × coef × (1+특성%) × 3.0` | 물리 데미지의 핵 |
| **민첩** (AGI) | 게이지 가속 `1 + AGI/100`, 명중/회피 `+AGI×0.5`, 크리율 `AGI×0.3%` | 속도와 안정성 |
| **체력** (CON) | 최대 HP `CON×10+50`, 방어% `+CON×0.3×armorCoef`, 상태저항 `+CON×0.5` | 탱킹 |
| **마력** (MAG) | 최대 MP `MAG×15+30`, 마법 공격력 `MAG×baseAtk×coef×1.5` (로브 시너지 ×1.5) | MP / 마법 데미지 |
| **행운** (LUCK) | 크리 배수 `+LUCK/100`, 명중/회피 `+LUCK×0.1`, 스킬 발동률 `×(1+LUCK×0.005)` | 광역 보정 |

기본 시작 = 5스탯 각 12 (총 60pt). 균등 또는 주사위 굴림.

### 3.2 주사위 시스템

- 캐릭터 생성에서 최대 **3회** 주사위 굴림.
- 한 번 굴리면: 5스탯에 **60pt 랜덤 분배** (각 최소 0).
- 안 굴리면 균등 12/12/12/12/12.
- 굴림 결과는 다음 캐릭터 생성까지 `localStorage`에 보존.
- 자세히: [docs/systems/character-creation.md](docs/systems/character-creation.md)

### 3.3 시작 보너스

- **누적 보너스 풀** (`totalBonusStats`) — 매 클리어 시 1~10 + 챌린지 metaBonus 적립. 다음 캐릭터 생성에서 5스탯 자유 분배 (분배해도 풀은 차감되지 않음, 영구 누적).
- **영구 시작 보너스** (`permanentStartBonus`) — 진짜 보스에서 깎은 비율 × 60pt 만큼 자동 적립. 다음 캐릭터 5스탯 균등 자동 분배.

---

## 4. 전투 시스템

상세: [docs/systems/combat.md](docs/systems/combat.md) · 수치: [BALANCE.md](BALANCE.md)

### 4.1 게이지 누적 (v9)

```
누적량/틱 = 1 × (1 + 민첩/100) × armorSpeedMult × speedModifier
공격 발동: 게이지 ≥ 무기 ticks (적 일반 10 / 보스 8 / 미믹 12)
행동 후 게이지 -= 무기 ticks
```

### 4.2 데미지 계산 (곱셈 모델, v9)

```
물리 atk = STR × baseAtk × coef × (1 + trait_atk_pct) × 3.0
마법 atk = MAG × baseAtk × coef × (1 + trait_atk_pct) × 1.5 × magicSynergy
         where magicSynergy = (로브 + 마법무기) ? 1.5 : 1.0
물리 atk(활) = (STR + AGI×0.3) × baseAtk × coef × ... × 3.0

방어% = baseDef × coef × (1 + trait_def_pct) + CON × 0.3 × armorCoef
실효방어% = max(0, 방어% − 관통%)
받는 데미지 = max(1, atk × (1 − 실효방어%/100))
```

### 4.3 명중/크리

```
플레이어 acc = 60 + 무기 + 트레잇 + AGI×0.5 + LUCK×0.1
플레이어 eva = 5  + 무기 + 트레잇 + 갑옷 evasion + AGI×0.5 + LUCK×0.1
적 acc      = 30 + 챕터×3
적 eva      = 5  + 챕터×1
명중률      = clamp((acc − eva) / 100, 0, 1.0)

크리 확률 = clamp(AGI × 0.003, 0, 1.0)
크리 배수 = 1.3 + LUCK/100
```

### 4.4 갑옷 자동 반응 (피격 시)

- 발동률 = `0.10 + 행운 × 0.005`
- **가죽갑(회피)**: 데미지 0 무효
- **로브(방어)**: 데미지 50% 차감 + 차감량만큼 MP 소모
- **판금(철벽)**: 데미지 그대로 + 공격자에게 `평타 atk × 0.5` 카운터 반사
- **중갑**: 자동 반응 없음 (대신 speedMult 1.00)

### 4.5 흡혈/자해/회복 간섭

- **흡혈** (`lifesteal`): 데미지의 일부만큼 HP 회복.
- **자해** (`self_dot_pct`): 매 10틱마다 maxHp × 비율 만큼 자기 피해.
- **회복 간섭** (몬스터 trait): `heal_reduction` ×0.5 / `heal_pollution` ×0.3 / `heal_reverse` ×-1

---

## 5. 아이템 시스템

상세: [docs/systems/items.md](docs/systems/items.md) · [docs/systems/traits.md](docs/systems/traits.md)

### 5.1 무기 15종 (`src/data/weapons.ts`)

iso-DPS 그리드 — `baseAtk = ticks / 10` 으로 모든 무기 raw DPS 동등.

| 카테고리 | 무기 | baseAtk | speedCoef | 명중/회피 | penBonus | autoSkill |
|---|---|---|---|---|---|---|
| 속도 근접 | 건틀릿 | 0.7 | 1.429 (7틱) | +3 | 0 | 연속공격 |
| 속도 근접 | 단검 | 0.85 | 1.250 (8틱) | +2 | 10 | 연속공격 |
| 속도 근접 | 사슬낫 | 0.75 | 1.111 (9틱) | +1 | 10 | 급습 |
| 균형 근접 | 검 | 0.9 | 1.000 (10틱) | 0 | 5 | 정밀타격 |
| 균형 근접 | 창 | 1.2 | 0.909 (11틱) | -1 | 15 | 피어스 |
| 한방 근접 | 철퇴 | 1.15 | 0.833 (12틱) | -2 | 5 | 스매쉬 |
| 한방 근접 | 대검 | 1.4 | 0.769 (13틱) | -3 | 0 | 스매쉬 |
| 한방 근접 | 양날도끼 | 1.3 | 0.714 (14틱) | -4 | 15 | 스매쉬 |
| 한방 근접 | 할버드 | 1.9 | 0.667 (15틱) | -5 | 30 | 피어스 |
| 속도 활 | 숏보우 | 0.77 | 1.250 (8틱) | +2 | 0 | 정밀타격 |
| 균형 활 | 롱보우 | 1.2 | 0.909 (11틱) | -1 | 10 | 피어스 |
| 한방 활 | 석궁 | 1.95 | 0.667 (15틱) | -5 | 30 | 피어스 |
| 속도 마법 | 완드 | 0.8 | 1.429 (7틱) | +3 | mpBonus -3 | 화염구 |
| 균형 마법 | 스태프 | 0.85 | 1.000 (10틱) | 0 | magicPen 10 | 번개창 |
| 한방 마법 | 마도서 | 1.4 | 0.769 (13틱) | -3 | magicPen 10, mpBonus +3 | 바위충격 |

활 무기는 `physStat = STR + AGI × 0.3` 사용 (민첩 빌드 활용처).

### 5.2 갑옷 4종 (`src/data/armor.ts`)

| 갑옷 | baseDef | speedMult | evasion | mpBonus | 자동 반응 |
|---|---|---|---|---|---|
| 판금 | 12 | ×0.75 | 0 | 0 | 철벽 (카운터) |
| 중갑 | 7 | ×1.00 | 0 | 0 | — |
| 가죽갑 | 4 | ×1.10 | 0 | 0 | 회피 (무효) |
| 로브 | 1 | ×1.05 | 0 | +8 | 방어 (MP 흡수) |

로브 + 마법무기 = **속도 ×1.15 + 마법 atk ×1.5** 시너지.

### 5.3 등급 4종 (등급계수 coef)

| 등급 | coef | 가격 |
|---|---|---|
| 노말 | 1.5 | ×0.5 |
| 레어 | 2.3 | ×1.0 |
| 스페셜 | 3.0 | ×3.0 |
| 레전드 | 4.3 | ×6.0 |

### 5.4 특성 티어 4종 (`src/data/traits.ts`)

- **하급** (atk -50% / def -50% + 페널티) — 오래된 / 녹슨 / 무거운 / 부서진
- **보통** (중립 + 부가 효과) — 날카로운 / 가벼운 / 단단한 / 매끈한 / 정밀한
- **희귀** (atk +50% / def +50% + 부가 효과) — 뛰어난 / 위대한 / 마스터의 / 빛나는 / 비범한
- **특별** (atk/def +50% + 시그니처) — 흡혈의 / 폭풍의 / 신성한 / 행운의 / 원소의 / 반짝거리는 / 원소저항의

**등급×특성 16티어**: `tier = (grade_lv - 1) × 4 + trait_lv ∈ [1, 16]` — 낮을수록 똥템.

### 5.5 아이템 벨류 (`itemValue.ts`)

자동 평가 점수. 상점/인벤토리 카드에 "공 N.N" / "방 N.N" + 교체 시 Δ로 표시. 공식 요지:
- **공격벨류**: dps + 스킬 기여 + 명중률 보정 (속도/MP 페널티)
- **방어벨류**: (틱당 감소량 × 50) + (maxHP × 0.02) + 회피/저항/반사 가산

### 5.6 클리어 점수 (티어 합산)

`score = 무기 티어 + 갑옷 티어` (낮을수록 좋음). 등급별 임계값은 [BALANCE.md](BALANCE.md) §13 / `src/core/scoreThresholds.ts`.

---

## 6. 스킬 시스템 (19종)

상세: [docs/systems/skills.md](docs/systems/skills.md)

### 6.1 물리 공격 5
| 스킬 | MP | 효과 |
|---|---|---|
| 스매쉬 | 8 | 공격력 ×2.0, 명중 -10 |
| 피어스 | 6 | 공격력 ×1.0, 관통 ×2.0 |
| 연속공격 | 10 | 공격력 ×0.7 × (1+AGI/20)회 |
| 정밀타격 | 7 | 공격력 ×1.2, 명중 +30, 크리 ×2 |
| 급습 | 9 | 공격력 ×1.5 × (1+LUCK×0.03) |

### 6.2 물리 방어 4
| 스킬 | MP | 효과 (10틱 지속) |
|---|---|---|
| 방어 | 5 | 방어 ×2, 피해 50% 반사 |
| 회피 | 6 | 회피 +30 |
| 패링 | 8 | 방어 +(AGI×0.3 + ATK×0.5), 반사 50% |
| 불굴의의지 | 10 | HP ×5% 회복, 상태저항 +30 |

### 6.3 마법 공격 7
| 스킬 | MP | 배율 | 부가 |
|---|---|---|---|
| 빙결의화살 | 40 | ×2.2 | 30% 둔화, 관통 3 |
| 화염구 | 50 | ×6.5 | 25% 점화, 광역 |
| 폭풍칼날 | 45 | ×1.05 × 3히트 | 명중 +50 |
| 바위충격 | 55 | ×4.8 | 40% 둔화 + 방어 -20% |
| 번개창 | 45 | ×5.5 | 감전 + 게이지 -10 + 연쇄 |
| 그림자일격 | 50 | ×2.2 | 적 명중 -20 |
| 정화의광선 | 60 | ×1.8 | 디버프 정화, 언데드/암흑 ×1.5 |

### 6.4 마법 방어 3
| 스킬 | MP | 효과 |
|---|---|---|
| 배리어 | 14 | 10틱간 방어 + 공격력 |
| 마력충전 | 0 | MP +(LUCK + ATK) × 0.3 |
| 저항의결계 | 20 | 10틱간 상태저항 ×2 |

### 6.5 자동 발동률

`buildBalance.ts` — 무기/갑옷 베이스 발동률 + 등급/특성/행운 보정. 최종 `[0.05, 0.85]` 클램프.

---

## 7. 상태이상 시스템 (6종)

상세: [docs/systems/status-effects.md](docs/systems/status-effects.md)

| 상태 | base | 지속(틱) | DoT 간격 | 효과 |
|---|---|---|---|---|
| 점화 | 0.15 | 40 | 10 | DoT = ATK × 0.15 × stackMult / 10틱 |
| 출혈 | 0.20 | 20 | 10 | DoT = ATK × 0.20 × stackMult |
| 독 | 0.08 | 30 | 10 | DoT = ATK × 0.08 × stackMult |
| 둔화 | -0.40 | 20 | — | 속도 += max(-0.90, -0.40 × stackMult) |
| 암흑 | -25 | 30 | — | 명중 += max(-75, -25 × stackMult) |
| 감전 | 0.20 | 20 | — | 받는 피해 ×(1 + min(1.0, 0.20 × stackMult)) |

- **MAX_STACKS = 5**, `stackMultiplier = 1.3^(stack-1)`
- 재적용 시: 지속 갱신, 스택 +1, 스냅샷 ATK 최대값 보존

---

## 8. 챕터 & 몬스터

상세: [docs/systems/chapters.md](docs/systems/chapters.md) · [docs/systems/monster-traits.md](docs/systems/monster-traits.md)

### 8.1 11 테마

고블린 · 골렘 · 언데드 · 환영 · 흡혈귀 · 심해 · 기계 · 용암 · 암흑 · 천공 · 맹독

각 테마는 일반 몬스터 풀 + 챕터 보스 + 강화 보스(hardBoss, 챕터 6~10).

### 8.2 챕터 구성

1런 = 10챕터 (11 테마에서 무작위 5 base + 5 hard 선정). 챕터 6+ 는 hardBoss.

각 챕터 10층 노드 분포 (1~9층):
- 일반 몬스터 6
- 상점 1
- 보물 1
- 회복샘 1 (4층 이상에만 배치)
- 특별 이벤트 5% 확률 (챕터당 최대 1회)

10층은 항상 보스. 매 층 진행 시 HP/MP +10%, 챕터 클리어 시 +100%.

### 8.3 몬스터 trait (31종)

`monsterTraits.ts` — 매 틱/피격/사망/HP 임계마다 발동. 대표:
- **Tier A**: 회피 30% · 비행 회피 20% · 크리 면역 40% · 선제권 · 첫피·첫공 무효 · 명중 디버프 · 둔화/출혈/흡혈/감전/독 누적
- **Tier B**: 물리 반사 30% · 화염 반사 50% · 원소 카운터 30% · 출혈 시 크리 ×1.5 · 복합공격 50% · 자폭
- **보스 전용**: 미니언 소환 · 마법 면역 95% · 부활 · 최대 HP 저주 · 3분열 · 결박 · 레이저 차징 · 화염 오라 · 전(全) 반사 · 시야 차단 · 침묵 등

---

## 9. 특별 이벤트 (6종)

소스: `src/core/events.ts` · 상세: [docs/systems/special-events.md](docs/systems/special-events.md)

| 이벤트 | 효과 |
|---|---|
| 위기에 빠진 모험가 | 70% 동료(상점 새로고침 부스트), 30% 적(첫 전투 스킵) |
| 떠돌이 대장장이 | 골드 베팅 → 무기/갑옷 강화 도박. 성공률 = `bet/(판매가×2)`, 최대 90% |
| 저주받은 도박사 룰렛 | 5단계 결과 (대성공 +5 / 성공 +2 / 무효 0 / 실패 -2 / 대실패 -5), 행운 +10 기준 EV ≈ +0.85 |
| 등가교환 제단 | 스탯 -3 → 다른 스탯 +2 |
| 암시장 스탯 브로커 | 골드로 스탯 영구 +1 (행운 ×1.5 / 민첩 ×1.2 / 나머지 기본 가격) |
| 탐욕의 수집가 | 최고 티어 장비 갈취, 무작위 스탯 +1 |

---

## 10. 상점

소스: `src/core/shop.ts` · 상세: [docs/systems/shop.md](docs/systems/shop.md)

- 슬롯 = `3 + floor((chapter-1)/3)` ∈ [3, 6]
- 무기/갑옷 50:50 무작위
- 새로고침: 챕터당 초기 1충전 (최대 2, 이벤트 부스트 시 3)
- 챌린지로 진입 자체가 불가능할 수 있음 (`황금고블린 추방` 등)

---

## 11. 챌린지 시스템 (40개)

소스: `src/data/challenges.ts` + `src/core/challengeRuntime.ts` · 상세: [docs/systems/challenges.md](docs/systems/challenges.md)

### 11.1 구조
- 캐릭터 생성에서 풀에서 **3개 랜덤 제시** (즉시 2 + 리스크 1).
- 1개 선택 (선택 안 해도 시작 가능).
- 보상/페널티는 시작 또는 클리어 시점에 적용.

### 11.2 분류
- **즉시 보상형 (instant) 22개** — 시작 시 스탯/골드 보너스 + 제약.
- **리스크 베팅형 (risk) 18개** — 100층(또는 50층) 클리어 시 metaBonus 적립. 위반 시 챌린지 실패.

### 11.3 대표 챌린지
- 과유불급 (즉시): 체력 +10 / 공격력 200 초과 시 즉사
- 무소유의 장 (베팅): 50층 클리어 시 스탯 +10 / 레전드 장비 금지
- 마법 혐오증 (즉시): 체력 +6 / 마법 무기 장착 불가
- 평화주의자 (베팅): 스탯 +15 / 공격 스킬 사용 금지
- 로브의 길 (즉시): 마력 +14 / 마법무기 + 로브 강제
- 명사수 (즉시): 활(원거리) 무기만 / 민첩 +8

`ChallengeFlags` 객체로 모든 제약을 정형화. 자세한 목록은 `src/data/challenges.ts`.

### 11.4 클리어 보너스 합산
```
clearBonus = rank.bonus (1~10) + sum(challenge.metaBonus if !failed)
```

---

## 12. 누적 보너스 & 진짜 보스

소스: `src/core/meta.ts` + `src/core/realboss.ts` · 상세: [docs/systems/meta-bonuses.md](docs/systems/meta-bonuses.md) · [docs/features/realboss.md](docs/features/realboss.md)

### 12.1 누적 보너스 풀 (`totalBonusStats`)
- 클리어 시 `commitClearBonus` 로 적립 (1~10 + 챌린지).
- 다음 캐릭터 생성에서 5스탯 자유 분배.
- **분배해도 풀은 차감되지 않음** — 누적은 영구.
- **진짜 보스 완전 클리어 시 일부 리셋** (`finishRealBossCombat`).

### 12.2 진짜 보스 도전 조건
- 매 클리어 시 남은 골드를 `totalGoldEarned` 에 누적.
- **5만 도달 + 5회 이상 클리어** 시 다음 메인 메뉴 진입 시 도전 모드로 전환.

### 12.3 도전 진행
- **가장 최근 클리어 캐릭터**를 부활 (장비/스탯 그대로).
- 그 캐릭터가 도달한 마지막 챕터 테마의 **챕터 10 하드 보스를 강화**:
  - HP × 3.0
  - ATK × 9.0 (v6.1)
  - DEF × 1.6
- 전투 종료 후 깎은 비율 산정.

### 12.4 보상
- **영구 시작 스탯 보너스**: `floor(60 × 깎은 비율)` pt → 다음 캐릭터에 5스탯 균등 자동 분배.
- **완클(100%)**: `realBossDefeated = true` (게임 클리어, 인트로 만화 t3 표시).

---

## 13. 클리어 등급

소스: `src/core/scoreThresholds.ts`. 100층 클리어 시 무기 티어 + 갑옷 티어 합산. 낮을수록 좋음.

| 합산 티어 | 등급 | 보너스 |
|---|---|---|
| ≤ 11 | EX | 10pt |
| 12 ~ 14 | SSS | 9pt |
| 15 ~ 17 | SS | 8pt |
| 18 ~ 20 | S | 7pt |
| 21 ~ 23 | A | 6pt |
| 24 ~ 26 | B | 5pt |
| 27 ~ 29 | C | 4pt |
| ≥ 30 | D | 3pt |
| 미클리어 | E / F | — (도달 챕터 기반) |

---

## 14. 데이터 / 저장

상세: [docs/features/firebase-auth.md](docs/features/firebase-auth.md) · [docs/features/data-reset.md](docs/features/data-reset.md)

### 14.1 localStorage 키
| 키 | 내용 |
|---|---|
| `climetop:meta:v1` | 누적 보너스 / 진짜 보스 상태 (`MetaBonuses`) |
| `climetop:run:v1` | 진행 중 런 (`TowerRun`) |
| `climetop:creation:v1` | 캐릭터 생성 진행 상태 (주사위/챌린지 선택) |
| `climetop:speed:v1` | 게임 속도 (1/2/4) |
| `climetop:autoEnter:v1` | 자동 진입 토글 |
| `climetop:tutorialSeen:v1` | 인트로 만화 시청 완료 |
| `climetop:sound:v1` | 사운드 설정 (SFX/BGM enabled/volume) |
| `climetop:speedControl:expanded:v2` | 설정 패널 펼침 상태 |

### 14.2 Firestore (로그인 시)
| 컬렉션/문서 | 내용 |
|---|---|
| `users/{uid}` | 프로필 (displayName/photoURL/email/nickname) |
| `meta/{uid}` | 게임 진행도 (`MetaBonuses` 전체) |
| `leaderboard/{uid}` | 본인 최고 점수 + nickname + clearCount |

규칙: 본인 doc 만 write, 리더보드는 모두 read. 자세한 규칙은 `firestore.rules`.

---

## 15. UI / 사운드

상세: [docs/systems/ui-modals.md](docs/systems/ui-modals.md) · [docs/systems/sound.md](docs/systems/sound.md)

### 15.1 화면 라우팅

`App.vue`에서 `screen` 상태 기반 단일 라우터:
`splash` / `menu` / `create` / `dungeon` / `combat` / `shop` / `victory` / `gameover` / `realboss` / `realboss_result` / `settings`.

### 15.2 모달 (11종, `src/ui/components/`)
DialogModal · InputModal · ListModal · PickupModal · InventoryModal · ItemDetail · StatusModal · StatusBadges · HpMpBar · SpeedControl · GrowthPenaltyPanel · IntroComic

### 15.3 사운드 (`src/ui/sound.ts`)
- **BGM 2종**: `splash` (MP3, 메뉴/사망/보스도전) / `gemini` (procedural C major, 런 진행 중)
- **SFX**: Web Audio API oscillator + envelope. 평타/스킬(19종)/크리/피격/사망/골드/회복 등.
- **몬스터 SFX**: 6 카테고리 (soft/bone/metal/beast/fire/magical), `core/monsterSfx.ts` 에서 이름·trait·element 우선순위로 자동 분류.

### 15.4 이미지 경로 (`src/ui/images.ts`)
- `/images/MONSTER/*.png` 몬스터 일러스트
- `/images/REALBOSS/{테마}.png` 진짜 보스 일러스트
- `/images/USER/*.png` 사용자 아바타 (자동 랜덤 선택, 21개)
- `/images/BACKGROUND/{테마}.png` 챕터 배경
- `/images/NPC/*.png` 상점/이벤트 NPC

---

## 16. 밸런스 시뮬레이터

`npm run sim` → `src/core/__sim__/runChapter.ts`. 자세한 수치 및 결과는 [BALANCE.md](BALANCE.md) §8~9.

### 16.1 측정
- v9 빌드 6종 (균등 / 힘탱 / 속도형 / 체력딜 / 마법형 / 행운형)
- 15무기 × 4갑옷 × 2등급 (스페셜/레전드) × 500런

### 16.2 현황 (v9.x, 2026-05)
- 레전드 best 평균 50% (목표 45~50%) ✓
- 마법 빌드 (로브+마법무기) 32~34% ✓
- 무기별 클리어률 격차 ±15% 이내 ✓

---

## 부록 A. 핵심 코드 파일 매핑

| 시스템 | 파일 |
|---|---|
| 5스탯 → 실효 스탯 | `src/core/stats.ts` |
| 전투 틱 | `src/core/combat.ts` |
| 스킬 실행 | `src/core/skills.ts` |
| 상태이상 | `src/core/status.ts` |
| 아이템 생성 | `src/core/items.ts` |
| 아이템 벨류 | `src/core/itemValue.ts` |
| 100층 생성 | `src/core/tower.ts` |
| 몬스터 trait | `src/core/monsterTraits.ts` |
| 특별 이벤트 | `src/core/events.ts` |
| 상점 | `src/core/shop.ts` |
| 챌린지 추적 | `src/core/challengeRuntime.ts` |
| 메타 저장 | `src/core/meta.ts` |
| 진짜 보스 | `src/core/realboss.ts` |
| 무기/갑옷 자동 발동률 | `src/core/buildBalance.ts` |
| 등급 임계값 | `src/core/scoreThresholds.ts` |
| 전역 store | `src/stores/game.ts` |
| 시뮬레이터 | `src/core/__sim__/runChapter.ts` |
| Firebase Auth | `src/lib/firebase.ts` + `src/lib/auth.ts` |
| 클라우드 동기화 | `src/lib/cloudSync.ts` |
| AdMob | `src/lib/ads.ts` |

## 부록 B. 데이터 정의 파일

| 데이터 | 파일 | 개수 |
|---|---|---|
| 무기 | `src/data/weapons.ts` | 15 |
| 갑옷 | `src/data/armor.ts` | 4 |
| 무기 특성 | `src/data/traits.ts` (`WEAPON_TRAITS`) | 14 (3+3+3+5) |
| 갑옷 특성 | `src/data/traits.ts` (`ARMOR_TRAITS`) | 15 (3+4+4+4) |
| 스킬 | `src/data/skills.ts` | 19 |
| 상태이상 | `src/data/statuses.ts` | 6 |
| 챕터 테마 | `src/data/chapters.ts` | 11 |
| 챌린지 | `src/data/challenges.ts` | 40 |
