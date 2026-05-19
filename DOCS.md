# 이번 판은 똥템으로 탑을 오르겠습니다 — 종합 문서

> 100층 로그라이크 탑 등정 RPG (Android + PC)
> 설계 + 구현 + 빌드 가이드의 단일 진실 공급원(SSOT).

---

## 목차

1. [프로젝트 개요](#1-프로젝트-개요)
2. [핵심 게임 디자인](#2-핵심-게임-디자인)
3. [시스템 디테일](#3-시스템-디테일)
4. [기술 아키텍처](#4-기술-아키텍처)
5. [디렉토리 구조](#5-디렉토리-구조)
6. [데이터 모델](#6-데이터-모델)
7. [UI / 색상 시스템](#7-ui--색상-시스템)
8. [빌드 & 실행](#8-빌드--실행)
9. [구현 현황 매트릭스](#9-구현-현황-매트릭스)
10. [확장 로드맵](#10-확장-로드맵)
11. [**v2 시스템 디테일** (2025-05-19)](#11-v2-시스템-디테일-2025-05-19-리팩토링)

---

## 1. 프로젝트 개요

| 항목 | 내용 |
|---|---|
| **장르** | 텍스트 기반 로그라이크 RPG (틱 기반 턴제) |
| **목표** | 100층 탑 등정 (10챕터 × 10층) |
| **타이틀** | "이번 판은 똥템으로 탑을 오르겠습니다" |
| **핵심 컨셉** | 저티어 장비로 클리어 시 EX 등급 → 메타 보너스 극대화 |
| **사망 처리** | 영구 사망 (Permadeath) |
| **플랫폼** | PC (Web) + Android (Capacitor) |
| **스택** | Vue 3 + TypeScript + Vite + Pinia + Tailwind CSS + Capacitor |

### 1.1 게임의 핵심 재미
1. **자기 도전 메타루프**: 좋은 장비 = 쉬운 클리어 = 약한 보상 ↔ 똥템 = 어려운 클리어 = 강한 보상
2. **선택의 무게**: 새 챌린지 3개 중 1개 선택 (즉시 보상 vs 리스크 베팅)
3. **유혹/탐욕 갈등**: 실시간 성장 패널티 표시로 "끼고 싶다" vs "참아야 한다" 심리전
4. **빌드 다양성**: 15+ 빌드 컨셉, 11개 챕터 테마, 각 테마별 카운터 빌드 존재

### 1.2 코드베이스 통계 (현재, v2 리팩토링 후)
- **총 40+ TypeScript/Vue 파일**, 약 **7000+ 줄**
- 빌드 크기: JS 197KB (gzip 70KB), CSS 29KB (gzip 6KB)
- public 자산: 챕터 배경 22장, 몬스터 55종, 캐릭터 24종, 무기 17, 갑옷 4, 스킬 19, NPC 8, UI 아이콘 35+ (총 ~25MB)

### 1.3 v2 리팩토링 주요 변경 (2025-05-19)
- **스탯 13 → 10개 통합**: 물공/마공 → 공격력, 물방/마방 → 방어력, 물리관통/마법관통 → 관통
- **자동 전투**: 게이지 100시 빌드별 스킬 확률로 자동 발동 (수동 클릭 제거)
- **다수 몬스터**: 챕터 테마별 등장 수 (고블린 2~3, 골렘 1)
- **모달 시스템**: 모든 native alert/confirm/prompt 제거, Promise 기반 DialogModal/InputModal/ListModal
- **이미지 자산 통합**: 챕터 배경 (모바일/WIDE 분기), 몬스터/무기/갑옷/스킬/NPC/UI 아이콘
- **인벤토리 시스템**: 4슬롯 (미니멀리스트 1슬롯), 풀 시 폐기 선택 모달
- **캐릭터 생성 영속화**: 주사위 굴림/챌린지 옵션/아바타 선택 모두 localStorage 저장
- **스탯 1pt = 1 dmg 균등화**: 공격력/방어력/체력/마력 동일 가치

---

## 2. 핵심 게임 디자인

### 2.1 게임 구조
- 100층 = 10챕터 × 10층, 마지막 층 = 보스
- 11개 챕터 테마 풀에서 무작위 5개 선택:
  - 1~5챕터: **기본** 버전
  - 6~10챕터: 동일 5개의 **강화** 버전 (같은 순서)
- 각 챕터 10층 이벤트 분배:

| 이벤트 | 횟수 | 비고 |
|---|---|---|
| 상점 | 1 | 황금고블린 운영 |
| 보물상자 | 1 | 10% 미믹 / 85% 1개 / 5% 2개 |
| 회복샘 | 1 | 4층 이상에서만 |
| 보스 | 1 | 10층 고정 |
| 일반 몬스터 | 5~6 | 슬롯당 5% 특별 이벤트 (cap 1/챕터) |

### 2.2 11개 챕터 테마

| 테마 | 기본 | 강화 | 핵심 기믹 |
|---|---|---|---|
| 고블린 | 군락 | 해방군 | 다수 출몰, 연계 |
| 골렘 | 무덤 | 고대 마도 골렘 | 고방어, 단일 |
| 언데드 | 미궁 | 저주받은 군대 | 부활, HP 디버프 |
| 환영 | 숲 | 신기루 환영 | 회피, 분신 |
| 흡혈귀 | 성 | 블러드 로드 | 흡혈, 출혈 |
| 심해 | 침수 구역 | 심해의 압박 | 둔화, 턴 제한 |
| 기계 | 장치 탑 | 자동화 공장 | 포탑, 자폭 |
| 용암 | 동굴 | 종말의 화산 | 화상, 반사 |
| 암흑 | 신전 | 공허의 심연 | 시야 차단, 침묵 |
| 천공 | 성 | 폭풍의 제단 | 비행, 번개 |
| 맹독 | 늪 | 치명적 역병 | 중독, 회복 감소 |

### 2.3 캐릭터 시스템 (v2 — 10스탯 통합)

#### 10개 능력치 (v1 13개에서 통합)
| 분류 | 스탯 | 역할 | 1pt 가치 |
|---|---|---|---|
| 자원 | 체력 / 마력 | 생존, 스킬 자원, 모든 공격에 마력 가산 | **+1 dmg 환산** |
| 공격 | **공격력** (구 물공+마공) | 모든 공격 데미지 | **+1 dmg/hit** |
| 방어 | **방어력** (구 물방+마방) | 피해 경감 | **-1 dmg/hit** |
| 전술 | **속도** | 행동 빈도 (틱 게이지) | +10% DPS |
| 유틸 | **행운** | 크리, 골드 +5%/pt, 상이 +0.5%/pt | 빌드 시너지 |
| 보조 | 명중률 / 회피율 | 적중/회피 확률 | 약함 |
| 관통 | **관통** (구 물관+마관) | 적 방어 1:1 무력화 | +0.5 dmg |
| 저항 | 상태이상 저항 | 적 발동률 -1%p/pt | 상황 의존 |

#### 생성 룰 (v2)
- **분배 4스탯** (공격력/방어력/체력/마력): 50pt 무작위, 개별 최소 3 / 최대 20
- **고정값**: 속도 = 10, 나머지 = 0
- **시작 골드**: 50
- **시작 무기**: 13종 무기 중 랜덤, **하급 트레잇 + 노말 등급 고정**, coef uniform(0.5, 1.0)
- **시작 갑옷**: 없음
- **균등 시작 (주사위 안 굴림)**: 공격력 13 / 방어력 13 / 체력 12 / 마력 12 = 총 50pt
- **주사위 시스템**: 3개 보유. 1회 굴릴 때마다 generateRandomStats() 재추첨. localStorage로 영구 저장 (뒤로/새로고침 후 유지)
- **캐릭터 외형**: USER 폴더 24장 중 **4장 랜덤 추첨 → 1장 선택**. 외형만 (능력치 영향 없음)

#### 스탯 → 실수치 변환 (v2 — 1pt = 1 dmg 균등)
```
HP = 체력 × 5 + 50              (v1: ×20)
MP = 마력 × 15 + 30
실효 공격력 = 공격력 + 마력 + 무기base + 트레잇 atk%   (마력이 모든 공격에 가산)
실효 방어력 = 방어력 × 2.0 + armor_base × 2.0 × (1 + 트레잇 def%)
```

### 2.4 전투 시스템 (틱 기반, v2 자동 + 다수 적)

#### 행동 게이지
- 매 1틱: `gauge += 속도 × weapon_speed_coef × 둔화_modifier`
- 게이지 **100** 도달 시 1회 행동, `gauge -= 100`
- 베이스 속도 10 + 무기 coef 1.0 = 10틱당 1회 행동

#### 자동 전투 (v2 신규)
- **수동 클릭 제거** — 게이지 100 도달 시 자동 액션
- 액션 선택 우선순위:
  1. 갑옷 방어/회피 스킬 (조건부 트리거 — HP 낮음 / 적 게이지 ≥70)
  2. 무기 스킬 (확률 발동) — `WEAPON_SKILL_PROC` 테이블
  3. 평타
- 챌린지 옵션: `forbidActiveSkills` (조급증) → 스킬 X / `forceActiveSkills` (스킬 미학) → 평타 X

#### 빌드별 스킬 발동률 (`core/buildBalance.ts`)
| 무기 (속도 coef) | 발동률 | 비고 |
|---|---|---|
| 양날도끼 (0.5) | 70% | 한 방 빌드 |
| 철퇴/해머 (0.6) | 60% | |
| 대검/도끼 (0.7) | 55% | |
| 스태프 마법 (0.7) | 50% | 마관 +5 |
| 마도서 마법 (1.0) | 45% | 깡공 |
| 창 (1.0) | 40% | 피어스 |
| 검 (1.0) | 32% | 정밀타격 |
| 완드 마법 (1.2) | 32% | |
| 단검 (1.5) | 22% | 연속공격 |
| 건틀릿 (2.0) | 18% | 빠른 평타 |

보정: `등급 mod`(노말 +10%, 레전드 -5%) + `트레잇 mod`(하급 +5%, 특별 -5%) + `행운 × 0.5%p`

#### 다수 몬스터 (v2 신규)
- **CombatContext.monsters: MonsterInstance[]** — 단일 1마리도 length=1 배열
- 챕터 테마별 등장 수 (`encounterMin~Max`):
  - **고블린/언데드/기계/맹독**: 2~3마리 (다수)
  - **환영/흡혈귀/용암/암흑/천공**: 1~2마리
  - **골렘/심해**: 1마리 (단일, 고방어)
  - **보스/미믹**: 항상 1마리
- 각 몬스터 게이지 독립, 동시 행동
- 플레이어 자동 타겟팅: 첫 살아있는 적
- 처치 시 사망 로그 1회, 시각적으로 회색+취소선

#### 데미지 공식 (v2 통합)
```
공격력 = (스탯 공격력 + 스탯 마력 + 무기 base atk) × (1 + 트레잇 공격력_pct)
실효 방어 = (적 방어 - 관통 × penBoost) × 0.5    (DEF_REDUCTION 0.5)
최종 dmg = max(1, 공격력 × 스킬multiplier - 실효 방어)
크리티컬 = 행운 × 5% + 5% (cap 95%), 데미지 × 2.0
명중 = clamp(0.30, 0.95, 0.85 + (acc - eva) × 0.01)
```

#### 피격 시각 이펙트 (v2 신규)
- 몬스터/플레이어 모두: `animate-shake` (280ms 흔들림) + `animate-flash-red` (붉은 글로우)
- 부동 데미지 숫자: 위로 떠오르며 페이드 (900ms). 크리 = 황금 ✦ 표시

### 2.5 장비 시스템

#### 13개 무기 (마공/마관 통합 후 base atk 단일)
| 무기 | base atk | 속도 계수 | 특수 |
|---|---|---|---|
| 단검 | 3 | 1.5 | 빠름·낮은 dmg |
| 건틀릿 | 2 | 2.0 | 압도적 속도 |
| 검 | 5 | 1.0 | 표준 |
| 창 | 5 | 1.0 | 관통 특화 |
| 대검/도끼 | 8 | 0.7 | 대형 |
| 철퇴/해머 | 9 | 0.6 | 깡뎀 |
| 양날도끼 | 10 | 0.5 | 최대 dmg |
| 사슬낫 | 7 | 1.0 | 변칙형 |
| 숏보우 | 5 | 0.9 | 원거리 |
| 롱보우/석궁 | 8 | 0.6 | 원거리 대형 |
| 완드 (속성×7) | 4 | 1.2 | MP -2, 명중 +10, isMagic |
| 스태프 (속성×7) | 7 | 0.7 | 관통 +5, 명중 +10, isMagic |
| 마도서 (속성×7) | 9 | 1.0 | MP +2, 명중 -10, isMagic |

마법 무기 21종(7속성 × 3타입). `isMagic` flag로 스킬만 분기, 공격력 자체는 통합.

#### 4개 갑옷 (v2 재밸런싱)
| 갑옷 | 방어 base | 속도 배율 | 회피 | 마력 | 자동 스킬 | 컨셉 |
|---|---|---|---|---|---|---|
| 판금 | **10** | **×0.65** | 0 | 0 | - | 고방어 + 큰 속도 패널티 |
| 중갑 | 6 | ×0.90 | 0 | 0 | - | 평균 |
| 가죽갑 | 3 | ×1.20 | +12 | 0 | **회피** | 빠름 + 낮은 방어 |
| 로브 | 1.5 | ×1.0 | 0 | **+30** | **방어** | 매우 낮은 방어 + 마력 보강 |

#### 16-Tier 인덱스 (4 트레잇 × 4 등급)
```
tier = (trait_level - 1) × 4 + grade_level
```

| 티어 | 조합 | 색상 |
|---|---|---|
| 1~4 | 하급 × (노말~레전드) | 회색 (잡템) |
| 5~8 | 보통 × ... | 흰색 |
| 9~12 | 희귀 × ... | 파랑 |
| 13~16 | 특별 × ... | 황금 |

**특성 우선 정렬**: 특별-노말(13) > 희귀-레전드(12) (고유 효과 가치 우선)

#### 트레잇 풀
- **무기 트레잇 27종**: 하급 5 + 보통 5 + 희귀 5 + 특별 12 (흡혈/저주/신성/폭풍/화염/빙결/행운/마비/출혈/어둠/부식/**진귀한**)
- **갑옷 트레잇 24종**: 별도 풀 (저항형 6종 + 흡혈/저주/신성/행운/진귀한 + 일반 12)

#### 가격 공식
```
sell_price = TRAIT_PRICE × GRADE_PRICE_MULT (0.5 / 1 / 3 / 6)
buy_price = sell × 1.5
buyback = sell × 0.4
```

| 트레잇 등급 | sell_price 범위 |
|---|---|
| 하급 | 8~12 |
| 보통 | 45~60 |
| 희귀 | 100~140 |
| 특별 (진귀한 포함) | 190~220 |

#### 드랍 분포
| 소스 | 티어 범위 | 분포 |
|---|---|---|
| 상점/일반 몬스터 | 챕터 ~ 챕터+2 | 60/30/10 |
| 보스 | 챕터+1 ~ 챕터+5 | 50/35/10/4/1 |
| 보물상자 | 챕터-5 ~ 챕터+6 | 균일 (~8.3% × 12) |

#### 6챕터 등급 차단 (v2)
- **1~5챕터**: 노말 / 레어만 출현
- **6~10챕터**: 스페셜 / 레전드 추가 출현
- 추첨된 티어가 4/8/12/16 (레전드) → tier -2 (레어로 다운)
- 추첨된 티어가 3/7/11/15 (스페셜) → tier -1 (레어로 다운)
- forceGrade 명시 시(대장장이 등급 업그레이드)는 예외

### 2.6 스킬 시스템 (19개, 장비 자동, v2 마법 강화)

#### 학습 방식
- **무기 자동 1개** (무기 타입별 매칭)
- **가죽갑 자동 = 회피**
- **로브 자동 = 방어** (반사 효과 포함)
- 판금/중갑: 자동 스킬 없음
- 스킬북 시스템 X

#### 스킬 목록 (v2 — 마법 스킬 MP +50%, multiplier +30~50%)
| 분류 | 스킬 | MP | 효과 요약 |
|---|---|---|---|
| 물리 공격 | 스매쉬 | 8 | 공격력 × 2.0, 명중 -10 |
| | 피어스 | 6 | 공격력 × 1.0, 관통 × 2.0 |
| | 연속공격 | 10 | 공격력 × 0.7 × (1 + 속도//20)회 |
| | 정밀타격 | 7 | × 1.2, 명중 +30, 크리 ×2 |
| | 급습 | 9 | × 1.5 × (1 + 행운×0.03) |
| 물리 방어 | 방어 | 5 | 방어 ×2, 받은 dmg 50% 반사 (10틱) |
| | 회피 | 6 | 회피 +30 (10틱) |
| | 패링 | 8 | 방어 +(속도×0.3 + 공격력×0.5), 반사 |
| | 불굴의 의지 | 10 | HP 5% 회복, 상태저항 +30 |
| 마법 공격 | 빙결의 화살 (물) | **12** | × **2.0**, 30% 둔화 |
| | 화염구 (불) | **15** | × **2.4**, 25% 점화 |
| | 폭풍 칼날 (바람) | **14** | × **0.95** × 3히트, 명중 +50 |
| | 바위 충격 (대지) | **16** | × **2.1**, 40% 둔화 |
| | 번개창 (번개) | **14** | × **2.7**, 15% 감전, 적 게이지 -10 |
| | 그림자 일격 (암흑) | **16** | × **2.0**, 적 명중 -20 (20틱) |
| | 정화의 광선 (빛) | **18** | × **1.6**, 디버프 정화, vs 언데드 ×1.5 |
| 마법 방어 | 배리어 | **14** | 방어 + 공격력 × 1.0 |
| | 마력 충전 | 0 | MP +(행운+공격력)×0.3 |
| | 저항의 결계 | **20** | 상태저항 ×2, 방어 +30% (10틱) |

### 2.7 상태이상 시스템 (6종, 틱 기반)

| 상태 | 분류 | 1 stack 효과 | 지속 | DoT 인터벌 |
|---|---|---|---|---|
| 점화 | DoT (긴) | 10틱마다 마공 × 0.15 | 40틱 (4회) | 10틱 |
| 출혈 | DoT (짧) | 10틱마다 물공 × 0.20 | 20틱 (2회) | 10틱 |
| 독 | DoT (중) | 10틱마다 (물공+마공) × 0.08 | 30틱 (3회) | 10틱 |
| 둔화 | Debuff | 속도 -40% | 20틱 | - |
| 암흑 | Debuff | 명중 -25 | 30틱 | - |
| 감전 | 피해증폭 | 받는 dmg +20% | 20틱 | - |

**스택 규칙**:
- 효과 배율 = `1.3^(stacks - 1)`, 스택 캡 **5** (최대 ≈ 2.86×)
- 재적용 시 stack +1, 지속 시간 리프레시
- 디버프 클램프: 둔화 -90% / 암흑 -75 / 감전 +100%

**발동 확률**:
```
proc = min(0.95, trait × grade_coef + skill × weapon_mod) × (1 + 행운 × 0.005)
```
트레잇과 스킬은 독립 굴림 → 동시 적중 시 +2 stack.

### 2.8 챕터별 몬스터 스탯

```
일반: HP = 25 + 10N, atk = 5 + 2N, def = 2 + 1.2N, 속도 8
보스: HP × 5, atk × 1.2, def × 1.6, 속도 10
미믹: 보스 × 0.7
```

| 챕터 | 일반 HP | atk | def | 보스 HP | 보스 atk | 보스 def |
|---|---|---|---|---|---|---|
| 1 | 35 | 7 | 3.2 | 175 | 8.4 | 5.1 |
| 5 | 75 | 15 | 8 | 375 | 18 | 12.8 |
| 10 | 125 | 25 | 14 | 625 | 30 | 22.4 |

#### 챕터 테마별 등장 수 (v2)
| 테마 | 등장 수 | 디자인 |
|---|---|---|
| 고블린 | 2~3 | 다수, 약함 |
| 언데드 | 2~3 | 부활, 다수 |
| 기계 | 2~3 | 포탑 다수 |
| 맹독 | 2~3 | 중독 누적 |
| 환영/흡혈귀/용암/암흑/천공 | 1~2 | 중간 |
| **골렘** | **1** | 단일, 고방어 |
| **심해** | **1** | 단일, 압박 |

#### 회복 (v2)
- **층 클리어 시**: HP + MP 각 10% 회복 (최대치 기준)
- **챕터 클리어 시**: HP + MP 둘 다 100% 회복
- **회복샘** (4F+): HP 30% 회복 (챕터당 1회)

### 2.9 상점 시스템

#### 슬롯 수
`슬롯 = 3 + (챕터-1) // 3` → Ch1~3: 3, Ch4~6: 4, Ch7~9: 5, Ch10: 6

#### 새로고침
- 매 챕터 진입 시 +1 충전
- 저장 한도: 일반 2개, 이벤트 부스트 시 3개
- **3-충전 페널티 (burst-or-lose)**:
  - 3 보유 중 사용 시 `used_at_max` 플래그 ON
  - 다음 챕터 진입 시 충전 1로 리셋, 이벤트 부스트 해제

#### 인벤토리
- **무조건 랜덤** (카테고리 비율 강제 X)
- 슬롯마다 독립 추첨: 무기/갑옷 50:50 → 티어 분포 → 트레잇 균등 → coef 굴림

#### 황금고블린
- 상점 보유 골드 **무제한**
- buyback 0.4 + 진귀한 매각이 인플레 회수 담당

### 2.10 골드 인플레 곡선
**룰**: 챕터 N 누적 가용 골드 ≈ 1.5 × (해당 챕터 최상위 buy)

| 챕터 | 최상위 buy | 1.5개 골드 목표 | 일반 몹 드랍 (행운0) | 보스 드랍 |
|---|---|---|---|---|
| 1 | 54 | 81 | 10 | 29 |
| 5 | 270 | 405 | 49 | 145 |
| 10 | 1260 | 1890 | 230 | 675 |

- 행운 1pt = 골드 +5%
- 미믹/PVP 처치 보너스: `200 × 챕터`

### 2.11 특별 랜덤 이벤트 (6종)

일반 몬스터 슬롯마다 **5% 확률**, cap 1/챕터, 6종 균등 선택.

| # | 이벤트 | 메커니즘 |
|---|---|---|
| 1 | **위기에 빠진 모험가** | 70% 동료 (할인 상점) / 30% 악당 PVP (선제권, 챕터+1 장비 보상) |
| 2 | **떠돌이 대장장이** | 골드 X 베팅, 성공률 `min(0.9, X / (sell × 2))`, 무기 등급 +1 |
| 3 | **저주받은 도박사** | 베팅 스탯, 5단계 룰렛 (대성공 +5 ~ 대실패 -5), 행운이 EV 결정 |
| 4 | **고대 신의 등가교환 제단** | 스탯 -3 → 다른 스탯 +1, 최대 3교환 |
| 5 | **암시장 스탯 브로커** | 골드 → 스탯, 가격 `100 + 50N` (속도/행운 ×1.5) |
| 6 | **🆕 탐욕의 수집가** | 최고 티어 장비 강제 요구: 양도(+무작위 스탯) / 거절(보스 70% 강도 PVP) |

### 2.12 회복샘 / 보물상자 / 미믹

- **회복샘**: HP **30% 회복** (최대 HP 기준), 4F+ 1회/챕터
- **보물상자**:
  - 10% 미믹 출현 → 보스 70% 강도 전투, 처치 시 보물 + `200 × 챕터` 골드
  - 85% 1개 드랍, 5% 2개 드랍
- 드랍 = 무기/갑옷 50:50, 챕터-5 ~ +6 균일

### 2.13 영구 사망 + 클리어 등급

#### 사망
- 캐릭터, 골드, 장비 모두 소멸
- 레벨업 없음

#### 클리어 등급 시스템 (F~EX)
3요소 평균 점수:
- **Equipment**: `(17 - 평균 16티어) / 16 × 100` (저티어 = 고점수)
- **Gold**: `min(100, 남은 골드 / 1890 × 100)`
- **HP**: `남은 HP / 최대 HP × 100`

| 점수 | 등급 | 보너스 |
|---|---|---|
| 0~9 | F | 1 |
| 10~19 | E | 2 |
| 20~29 | D | 3 |
| 30~39 | C | 4 |
| 40~49 | B | 5 |
| 50~59 | A | 6 |
| 60~69 | S | 7 |
| 70~79 | SS | 8 |
| 80~89 | SSS | 9 |
| 90~100 | **EX** | **10** |

#### 보너스 분배
- 등급별 1~10 포인트, **자유 분배**, 13개 모든 스탯 가능
- localStorage 영구 누적, 한도 없음

### 2.14 챌린지 시스템 (50종)

#### 캐릭터 생성 흐름
1. 게임 시작 시 50개 풀에서 **3개 무작위 표시** (즉시 2 + 리스크 1 균형)
2. 플레이어가 **0~1개 선택** (선택 안 해도 됨)
3. 즉시 보상형 → 시작 시 스탯/골드 보너스 즉시 적용
4. 리스크 베팅형 → 클리어 시 추가 메타 보상 지급

#### Ⅰ. 즉시 보상형 (25종)
- **공격력 제약** (5): 과유불급, 녹슨 칼날의 맹세, 유리 대포, 체중 감량, 마법 혐오증
- **재화 제약** (5): 진정한 무소유, 단벌 신사, 미니멀리스트, 파괴주의자, 황금 알레르기
- **상점 제약** (5): 불매 운동, 요행은 없다, 불신주의자, 리롤 금지령, 정가 매입
- **속도 제약** (5): 굼벵이 전술, 조급증, 강박증, 속전속결, 유지력 상실
- **생존 제약** (5): 혈우병, 야맹증, 절대 정수, 의지박약, 연약한 피부

#### Ⅱ. 리스크 베팅형 (25종)
- **장비 제한** (5): 무소유의 장, 순수 가난, 명품 거부증, 트레잇 봉인, 알몸의 순례자
- **전투 스타일** (5): 운칠기삼, 평화주의자, 철저한 등가교환, 스킬 미학, 자연치유 거부
- **경제 제약** (5): 자산 동결, 황금고블린 파트너, 짠돌이의 탑, 미믹 사냥꾼, 암시장 VIP
- **테마 특화** (5): 환영 파괴자, 도박중독, 대장장이 은인, 배신 저항군, 속전속결의 장
- **가혹 생존** (5): 빈사의 유령, 저주의 동반자, 노 포션, 만성 피로, 가난이 체질

#### 보상 예시
- 즉시: "물방 +10, 마방 +10" (과유불급) - 페널티: 물공 20 초과 시 즉사
- 리스크: "+10pt 보너스" (가난이 체질) - 조건: 평균 티어 3 이하로 100층

### 2.15 실시간 성장 패널티 시각화

화면 상단에 **항상 표시**되는 패널:
```
[다음 회차 보너스] SS · +8 pt   장비 56  골드 79  HP 70   총 68/100
```
- 장비 티어 변경/골드 증감/HP 변동 시 즉시 갱신
- 등급별 색상 적용 (EX는 반짝임)
- 좋은 장비 = 등급 ↓, 똥템 유지 = 등급 ↑ → 심리적 갈등 장치

---

## 3. 시스템 디테일

### 3.1 캐릭터 생성 알고리즘
```typescript
// 6스탯 50pt 분배
1. 모든 스탯에 최소치 3 부여 (18pt 소모)
2. 남은 32pt를 무작위 스탯에 1씩 분배
3. 단, 개별 스탯 15 cap 준수
4. 속도 = 10, 행운/명중/회피/관통/저항 = 0 고정
5. 누적 메타 보너스 분배 적용 (자유 분배)
6. 챌린지 즉시 보상 적용
7. 시작 무기 추첨 (하급-노말)
8. HP/MP 재계산
```

### 3.2 전투 진행 흐름
```
[전투 시작]
  → makeMonster (챕터 베이스라인 + 템플릿 modifier)
  → CombatContext 생성

[매 틱]
  → tickStatuses (DoT 트리거, 지속 시간 감소)
  → 자해 (저주의 트레잇, 매 10틱)
  → 버프 만료 감소
  → 게이지 누적 (속도 × weapon_coef × 둔화 modifier)
  → 사망 체크

[게이지 100 도달]
  → 플레이어: UI에서 액션 대기 (공격/스킬/도주)
  → 몬스터: 자동 공격 (monsterAttack)
  → 액션 후 게이지 -100

[종료 조건]
  → HP 0 도달
  → 도주 선택
```

### 3.3 아이템 추첨 로직
```typescript
rollItem({ kind, chapter, source }) {
  1. baseKey 추첨 (13/4 무기 또는 갑옷 풀 균등)
  2. 티어 추첨 (getTierDistribution × weightedChoice)
  3. tier → (trait_tier, grade) 변환
  4. 트레잇 풀에서 균등 추첨
  5. grade coef 굴림 (random uniform within range)
  6. 효과 스케일링 (속도% 클램프, 자해 fixed 등)
  7. 가격 계산 (sell × grade_mult, buy ×1.5, buyback ×0.4)
}
```

### 3.4 스킬 실행 흐름
```typescript
useSkill(ctx, key) {
  1. MP 비용 계산 (마법 무기 보정 적용)
  2. MP 부족 체크
  3. 스킬별 분기 (switch)
    - 공격: 명중 굴림 → 데미지 계산 → 적용 → 흡혈 / 상태이상
    - 방어: 버프 등록 (10틱)
    - 회복: HP/MP 회복
    - 정화: 디버프 제거
}
```

---

## 4. 기술 아키텍처

### 4.1 스택 결정 근거
| 요구사항 | 선택 | 이유 |
|---|---|---|
| 크로스플랫폼 | Web + Capacitor | 단일 코드베이스, 빠른 배포, 텍스트 게임에 적합 |
| 컴포넌트 UI | Vue 3 | reactivity, Composition API, 사용자 친숙도 |
| 타입 안전성 | TypeScript | 13스탯 × 50트레잇 × 19스킬 등 복잡한 데이터 모델 |
| 상태관리 | Pinia | Vue 3 공식, 단순한 store API |
| 스타일링 | Tailwind CSS | 빠른 프로토타입, 색상 시스템 통합 |
| 빌드 | Vite | 빠른 HMR, ESM 네이티브 |
| 모바일 | Capacitor | Web → Android 네이티브 래핑, Cordova 후속 |

### 4.2 게임 루프 (런타임)
```
[UI Layer] (Vue components)
  ↓ user input
[Pinia Store] (게임 상태)
  ↓ actions
[Core Logic] (Pure TS modules)
  ├─ tower.ts     — 챕터/층 진행
  ├─ combat.ts    — 전투 컨텍스트
  ├─ skills.ts    — 스킬 효과
  ├─ status.ts    — 상태이상
  ├─ items.ts     — 아이템 추첨
  ├─ shop.ts      — 상점 인벤토리
  ├─ events.ts    — 6종 특별 이벤트
  ├─ challengeRuntime.ts — 챌린지 추적
  └─ meta.ts      — 영구 사망/누적 보너스
  ↓ reads
[Data Layer] (정적 데이터)
  ├─ weapons.ts   — 13종 무기 베이스
  ├─ armor.ts     — 4종 갑옷
  ├─ traits.ts    — 무기 27 + 갑옷 24
  ├─ skills.ts    — 19 스킬 정의
  ├─ statuses.ts  — 6종 상태이상
  ├─ chapters.ts  — 11 테마 + 몬스터 + 베이스라인
  └─ challenges.ts — 50종 챌린지
  ↓ persists
[localStorage]
  ├─ climetop:meta:v1 — 누적 보너스
  └─ climetop:run:v1  — 진행 중 런 (이어하기)
```

---

## 5. 디렉토리 구조

```
climetop/
├── DOCS.md                      # 본 문서
├── README.md                    # 간단 안내
├── tower-rpg-design.md          # 게임 디자인 SSOT (669줄)
├── package.json
├── tsconfig.json / tsconfig.node.json
├── vite.config.ts
├── tailwind.config.js
├── postcss.config.js
├── capacitor.config.json
├── index.html
└── src/
    ├── main.ts                  # 진입점
    ├── App.vue                  # 라우팅 (screen 분기)
    ├── env.d.ts
    ├── styles/main.css          # Tailwind + 커스텀 클래스
    ├── types/index.ts           # 모든 타입 정의
    ├── data/                    # 정적 데이터 (8 파일, 약 760줄)
    │   ├── weapons.ts           # 13종 무기 + 마법 무기 7속성 × 3종
    │   ├── armor.ts             # 4종 갑옷
    │   ├── traits.ts            # 무기 27 + 갑옷 24 트레잇
    │   ├── skills.ts            # 19 스킬 정의
    │   ├── statuses.ts          # 6종 상태이상 + 스택 계수
    │   ├── chapters.ts          # 11 테마 + 몬스터 + 스탯 베이스라인
    │   ├── challenges.ts        # 50종 챌린지 (즉시 25 + 리스크 25)
    │   └── index.ts             # re-export
    ├── core/                    # 게임 로직 (12 파일, 약 1900줄)
    │   ├── rng.ts               # 랜덤 유틸 (시드 미적용)
    │   ├── character.ts         # 캐릭터 생성, 클리어 점수
    │   ├── items.ts             # 16-tier, 추첨, 스케일링, 가격
    │   ├── stats.ts             # effective stats (장비 + 트레잇 합산)
    │   ├── combat.ts            # 틱 기반 전투, 데미지/명중/크리
    │   ├── skills.ts            # 19 스킬 실행 로직
    │   ├── status.ts            # 상태이상 적용/틱/스택
    │   ├── tower.ts             # 챕터/층 진행, 이벤트 분배
    │   ├── shop.ts              # 상점 생성, 새로고침
    │   ├── events.ts            # 6종 특별 이벤트
    │   ├── challengeRuntime.ts  # 챌린지 즉시 보상/플래그/추적
    │   └── meta.ts              # localStorage 저장/복원, 클리어 보너스
    ├── stores/
    │   └── game.ts              # Pinia 메인 스토어 (426줄)
    ├── ui/
    │   ├── colors.ts            # 색상 시스템 (144줄)
    │   └── components/
    │       ├── HpMpBar.vue
    │       ├── ItemName.vue
    │       ├── StatusBadges.vue
    │       └── GrowthPenaltyPanel.vue  # 실시간 성장 패널티
    └── screens/                 # 7개 화면 (약 600줄)
        ├── MainMenu.vue         # 메인 메뉴 (새 게임/이어하기/리셋)
        ├── CharacterCreation.vue # 3챌린지 선택 + 자유 분배
        ├── Dungeon.vue          # 챕터/층 진행 + 성장 패널티
        ├── Combat.vue           # 틱 전투 + 콘솔 로그 + 스킬 버튼
        ├── Shop.vue             # 황금고블린 상점
        ├── VictoryScreen.vue    # 클리어 등급 + 보너스 분배
        └── GameOver.vue         # 영구 사망 화면
```

---

## 6. 데이터 모델 (핵심 타입)

### 6.1 캐릭터
```typescript
interface Character {
  stats: Stats           // 13개 능력치
  hp: number, maxHp: number
  mp: number, maxMp: number
  weapon: ItemInstance | null
  armor: ItemInstance | null
  gold: number
  statuses: StatusInstance[]
  actionGauge: number    // 0~100
}
```

### 6.2 아이템
```typescript
interface ItemInstance {
  id: string             // unique runtime id
  kind: 'weapon' | 'armor'
  baseKey: string        // 무기/갑옷 타입
  trait: string          // 형용사 (낡은, 흡혈의 ...)
  grade: Grade           // 노말/레어/스페셜/레전드
  coef: number           // 0.5~4.0 grade roll
  tier: number           // 1~16
  sellPrice: number, buyPrice: number, buyback: number
  effects: TraitEffect   // 스케일링된 효과
}
```

### 6.3 상태이상
```typescript
interface StatusInstance {
  kind: '점화' | '출혈' | '독' | '둔화' | '암흑' | '감전'
  appliedTick: number
  duration: number       // 남은 틱
  stacks: number         // 1~5
  snapshotAtk: number    // 시전자 스탯 스냅샷 (DoT용)
  nextDotAt?: number     // 다음 DoT 트리거 틱
}
```

### 6.4 챕터
```typescript
interface ChapterState {
  chapter: number        // 1~10
  theme: ChapterTheme    // 11개 중 1
  isHard: boolean        // 6~10 = true
  themeName: string      // "고블린 군락" or "고블린 해방군"
  floors: FloorEvent[]   // 10개 (셔플된 이벤트)
  currentFloor: number   // 0~10
  specialEventOccurred: boolean
}
```

### 6.5 챌린지
```typescript
interface ChallengeDef {
  key: string
  category: 'instant' | 'risk'
  name: string
  group: string
  description: string
  reward: string         // 보상 설명 (UI용)
  penalty: string        // 페널티 설명
  instantBonus?: Partial<Stats>     // 즉시 보상 스탯
  instantStartGold?: number
  flags?: ChallengeFlags // 런타임 제약 플래그 (40+ 종)
  metaBonus?: number     // 리스크 클리어 시 추가 보너스
  permanentStat?: Partial<Stats>    // 영구 시작 스탯 보너스
}
```

---

## 7. UI / 색상 시스템

### 7.1 색상 카테고리 (전부 Tailwind 색상 토큰으로 등록)

| 카테고리 | 토큰 | 용도 |
|---|---|---|
| **bg** | primary / secondary / tertiary / panel / hover | 배경 깊이 |
| **grade** | normal / rare / special / legend | 4-등급 (회색/파랑/보라/황금) |
| **trait** | low / common / rare / special | 4-트레잇 풀 색상 |
| **status** | burn / bleed / poison / slow / blind / shock | 6 상태이상 (빨강/진빨강/초록/시안/보라/노랑) |
| **stat** | phys_atk / mag_atk / phys_def / mag_def / hp / mp / speed / luck / util | 스탯 카테고리 |
| **log** | player / enemy / critical / miss / heal / damage / status / mp / skill / gold / info / reward | 전투 로그 12종 |
| **rank** | F / E / D / C / B / A / S / SS / SSS / **EX** (반짝임) | 클리어 등급 10종 |
| **theme** | goblin / golem / undead / mirage / vampire / deep / machine / lava / dark / sky / venom | 11 챕터 테마 |
| **bar** | hp_full / hp_mid / hp_low (펄스) / mp | 체력/마력 바 |

### 7.2 헬퍼 함수 (`src/ui/colors.ts`)
```typescript
gradeColorClass[grade]          // 등급별 텍스트 색
tierColorClass(tier)            // 1~16 티어 → 트레잇 색
statusColorClass[kind]          // 상태이상 색
statusBgClass[kind]             // 상태이상 배지 배경
statColorClass[statKey]         // 스탯별 색
rankColorClass[rank]            // 클리어 등급 색 (EX는 애니메이션)
themeColorClass[theme]          // 챕터 테마 강조
logColorClass[logKind]          // 전투 로그
hpBarColorClass(percent)        // HP 비율 → 색 (낮을수록 빨강+펄스)
formatItemNameHTML(item)        // "낡은 노말 단검" → 분리된 색상 데이터
```

### 7.3 애니메이션
- `log-fade` — 새 로그 라인 페이드인 (200ms)
- `damage-pop` — 데미지 숫자 (600ms)
- `critical-flash` — 크리티컬 강조 (400ms)
- `pulse-low` — HP < 30% 시 빨강 펄스 (1s, 무한)
- `ex-shimmer` — EX 등급 그라데이션 시머 (2s, 무한)

---

## 8. 빌드 & 실행

### 8.1 PC 개발 (Hot Reload)
```bash
cd /mnt/d/workspace/climetop
npm install
npm run dev
```
→ http://localhost:5173 자동 열림

### 8.2 PC 프로덕션 빌드
```bash
npm run build           # dist/ 생성
npm run preview         # 빌드 결과 미리보기
```

### 8.3 Android 빌드 (Capacitor)

#### 초기 셋업 (1회)
```bash
npx cap init climetop com.climetop.app --web-dir=dist
npx cap add android
```

#### 빌드 + 동기화
```bash
npm run android:build   # 웹 빌드 + cap sync
```

#### Android Studio 열기
```bash
npm run android         # Android Studio 자동 실행
```
Android Studio에서 Run → 디바이스/에뮬레이터 선택 → 빌드.

#### APK 생성
Android Studio: Build → Generate Signed Bundle / APK → APK → release.

### 8.4 PWA / 웹 배포
```bash
npm run build
# dist/ 폴더를 Netlify, Vercel, GitHub Pages 등에 배포
```

---

## 9. 구현 현황 매트릭스

### 9.1 완료된 시스템 ✅
| 시스템 | 파일 | 상태 |
|---|---|---|
| 캐릭터 생성 (50pt + 시작 무기) | `core/character.ts` | ✅ |
| 16-tier 아이템 추첨 + 가격 | `core/items.ts` | ✅ |
| Effective stats 계산 (장비/트레잇 합산) | `core/stats.ts` | ✅ |
| 틱 기반 전투 (게이지/명중/크리/관통) | `core/combat.ts` | ✅ |
| 19개 스킬 실행 (스매쉬~정화의광선) | `core/skills.ts` | ✅ |
| 6종 상태이상 + 스택 (1.3^n-1, cap 5) | `core/status.ts` | ✅ |
| 챕터/층 진행 (이벤트 분배, 5% 특별) | `core/tower.ts` | ✅ |
| 상점 (슬롯 3~6, 새로고침 burst-or-lose) | `core/shop.ts` | ✅ |
| 보물상자 (10/85/5) + 미믹 | `stores/game.ts` | ✅ |
| 6종 특별 이벤트 정의 (로직 포함) | `core/events.ts` | ✅ |
| 영구 사망 + localStorage 저장/복원 | `core/meta.ts` | ✅ |
| 클리어 등급 F~EX (3요소 평균) | `core/character.ts` | ✅ |
| 챌린지 50종 정의 | `data/challenges.ts` | ✅ |
| 챌린지 런타임 (즉시 보상 + 플래그) | `core/challengeRuntime.ts` | ✅ |
| 캐릭터 생성 3챌린지 선택 UI | `screens/CharacterCreation.vue` | ✅ |
| 실시간 성장 패널티 패널 | `ui/components/GrowthPenaltyPanel.vue` | ✅ |
| 종합 색상 시스템 (10+ 카테고리) | `ui/colors.ts` + tailwind config | ✅ |
| 메인 메뉴 / 던전 / 전투 / 상점 / 승리 / 사망 화면 | `screens/*.vue` | ✅ |
| Capacitor Android 설정 | `capacitor.config.json` | ✅ |

### 9.2 v2 신규 시스템 (2025-05-19) ✅
| 시스템 | 파일 | 설명 |
|---|---|---|
| **스탯 통합 (13→10)** | `types/index.ts`, `core/stats.ts` | 물공/마공→공격력, 물방/마방→방어력, 관통 통합 |
| **자동 전투** | `core/skills.ts pickAutoAction` | 게이지 100시 자동 액션 (스킬/평타 확률) |
| **빌드별 스킬 확률** | `core/buildBalance.ts` | 무기별 발동률 + 등급/트레잇/행운 보정 |
| **다수 몬스터 전투** | `core/combat.ts` | `monsters: MonsterInstance[]`, 챕터별 등장 수 |
| **특별 이벤트 6종 모달** | `stores/game.ts` event* | 위기/대장장이/룰렛/제단/암시장/수집가 |
| **챌린지 트래킹 완성** | `core/challengeRuntime.ts` | 12+ 훅 (장비/상점/PVP/보스틱/저주 등) |
| **모달 시스템** | `ui/components/*Modal.vue` | DialogModal/InputModal/ListModal/PickupModal (Promise 기반) |
| **인벤토리 시스템** | `stores/game.ts`, `ui/components/InventoryModal.vue` | 4슬롯, 풀시 폐기 선택, 전부 판매 |
| **캐릭터 생성 영속화** | `stores/game.ts` saveCreation | 주사위 3개 + 챌린지 + 아바타 모두 영구 저장 |
| **캐릭터 외형 24종** | `images/USER/*.png` | 4명 랜덤 추첨 → 선택 |
| **이미지 자산 통합** | `ui/images.ts`, `public/images/` | 챕터 배경(모바일/WIDE) + 몬스터 50+ + 무기/갑옷/스킬/NPC |
| **전투 시각 이펙트** | `screens/Combat.vue` | 피격 흔들림 + 부동 데미지 숫자 |
| **장비 종합 계수** | `ui/components/ItemDetail.vue` | 공/방 2계수 (곱셈 기반) |
| **6챕터 등급 차단** | `core/items.ts` | 1~5챕터 노말/레어만, 6~10챕터 스페셜/레전드 추가 |
| **마법 스킬 강화** | `data/skills.ts`, `core/skills.ts` | MP +50%, 멀티 +30~50% |
| **밸런싱**: 스탯 1pt = 1 dmg | `core/character.ts`, `core/stats.ts` | 공격력/방어력/체력/마력 균등 가치 |

### 9.3 부분 구현 / 추가 작업 필요 ⚠️
| 시스템 | 현재 상태 | 보완 필요 |
|---|---|---|
| 챕터 테마 몬스터 특수 능력 | trait 키만 정의 | 효과 구현 (반사/부활/분신 등 44종) |
| 빌드 컨셉별 시뮬 검증 | 베이스라인만 | 마법/탱커/속도 빌드 시뮬 |
| 보스 고유 메커니즘 | 일반 몬스터와 동일 | 보스별 특수 패턴 (광역기/페이즈 등) |
| 광역 공격 스킬 | 단일 타겟에 반복 | 다수 동시 타격 (폭풍 칼날 등) |

### 9.4 미구현 (의도적 제외)
| 시스템 | 사유 |
|---|---|
| 소모품/포션 | 디자인 결정으로 제외 |
| 스킬북 시스템 | 디자인 결정으로 제외 (장비 자동만) |
| 레벨업 | 메타 보너스로 대체 |
| 시드 RNG | 단순 `Math.random` 사용 (재현성 불필요) |

---

## 10. 확장 로드맵

### 10.1 가까운 우선순위
1. **특별 이벤트 UI 다이얼로그 6종** (alert 대체)
   - 위기 모험가: 동료/PVP 선택 다이얼로그
   - 대장장이: 골드 베팅 슬라이더
   - 룰렛: 스탯 선택 + 룰렛 애니메이션
   - 등가교환 제단: 스탯 ↔ 스탯 매트릭스
   - 암시장: 스탯별 가격 그리드
   - 탐욕의 수집가: 양도/거절 선택

2. **챕터 테마 몬스터 특수 능력 적용**
   - 골렘: 물리 반사 (`reflect_physical`)
   - 환영: 분신 (`split_3`)
   - 언데드: 부활 (`revive_chance`)
   - 등 11테마 × 4몬스터 = 44 특수 능력

3. **챌린지 런타임 카운터 완성**
   - 50개 중 데이터만 있는 25개 추적 로직 추가

### 10.2 중기 확장
- 인벤토리 비교 UI (구매/드랍 시 현재 장착과 비교)
- 보스별 고유 메커니즘 (예: 거대 거신 골렘 차징 광역기)
- 사운드 효과 (Web Audio API)
- 안드로이드 햅틱 피드백 (Capacitor Haptics)
- 다국어 지원 (영문/일문)

### 10.3 장기 확장
- 시드 기반 데일리 챌린지 (`seed`로 재현 가능 런)
- 클라우드 세이브 동기화 (Firebase 등)
- 리더보드 (클리어 등급 누적/최단 클리어 시간)
- 멀티 클래스 시스템 (현재는 무기로만 구분)
- 모드 / 커스텀 챌린지 빌더

---

## 부록 A: 핵심 공식 빠른 참조

```
HP = 체력 × 5 + 50                  # v2 변경 (×20 → ×5)
MP = 마력 × 15 + 30
실효 공격력 = (공격력 + 마력 + 무기base) × (1 + 트레잇 공격력_pct)   # v2 — 마력 가산
실효 방어력 = 방어력 × 2.0 + armor_base × 2.0 × (1 + 트레잇 방어력_pct)  # v2 (×1.5 → ×2.0)
데미지 = max(1, 실효 공격력 × 스킬multiplier - (적 방어 - 관통) × 0.5)   # v2 — DEF_REDUCTION 0.5
crit_chance = 행운 × 5% + 5% (cap 95%), crit damage × 2.0
hit_chance = clamp(0.30, 0.95, 0.85 + (acc - eva) × 0.01)
proc_chance = min(0.95, trait × grade_coef) × (1 + 행운 × 0.005)
status_multiplier = 1.3^(stacks - 1) (cap stacks 5)
action_gauge_threshold = 100
gauge_per_tick = 속도 × weapon_speed_coef × 둔화_modifier
auto_skill_proc = WEAPON_PROC × (1 + 등급_mod) × (1 + 트레잇_mod) × (1 + 행운×0.005)   # v2 자동 전투
```

### 스탯 1pt 가치 (v2 균등화)
```
공격력 +1 → +1 dmg/hit                  (기준)
방어력 +1 → -1 dmg/hit (effective +2, ×0.5 차감)
체력 +1   → +5 HP (받는 dmg 5 기준 1 hit 회피)
마력 +1   → +1 dmg (모든 공격에 가산) + MP +15
속도 +1   → +10% DPS
행운 +1   → 크리 +5%, 골드 +5%, 상이 +0.5%p
관통 +1   → 적 방어 -1 = +0.5 dmg
명중 +1   → 적중률 +1%p (cap 0.30~0.95)
회피 +1   → 피격률 -1%p
```

## 부록 B: 챕터 N 핵심 수치

```
일반 몬스터: HP = 25+10N, atk = 5+2N, def = 2+1.2N, 속도 8
보스: HP × 5, atk × 1.2, def × 1.6, 속도 10
미믹: 보스 × 0.7
회복샘: HP 30% 회복 (4F+)
보물상자: 10% 미믹 / 85% 1드랍 / 5% 2드랍
새로고침: 챕터당 +1 (cap 2 일반, 3 이벤트)
상점 슬롯: 3 + (챕터-1)//3 (Ch1~3=3, Ch10=6)
스탯 가격 (암시장): 100 + 50N (속도/행운 ×1.5, 명/회/관/저 ×0.7)
골드 목표: 1.5 × 챕터 최상위 buy
```

## 부록 C: 가격 빠른 참조

```
sell_price = TRAIT_PRICE × GRADE_PRICE_MULT
                          (0.5 / 1 / 3 / 6)
buy = sell × 1.5
buyback = sell × 0.4

TRAIT_PRICE 범위:
  하급 8~12, 보통 45~60, 희귀 100~140, 특별 190~220
```

## 부록 D: 빌드 컨셉 등급 (간략)

| 등급 | 빌드 | Ch10 보스 TTK |
|---|---|---|
| S | 물리 깡뎀 (양날도끼) | 234틱 |
| S | 마법 깡뎀 (마도서 + 번개) | 73틱 |
| A | 마법 burst (완드, 회피 적 카운터) | 79틱 |
| A | 마법 관통 (스태프, 고방어 카운터) | 102틱 |
| A | 관통 물리 (창 + 마스터의) | 230틱 |
| A | 상태이상 마법 | 95틱 |
| S+ | 신성 (언데드/암흑 챕터 한정) | ~50틱 |
| C | 크리티컬 (행운의 + 정밀타격) | 200~300틱 |
| C | 흡혈 (양날도끼 + 흡혈의) | 437틱 |
| C | 탱커 (반사 + 위대한 판금) | 350~500틱 |
| C | 회피 (가죽갑 + 매끈한) | 200~300틱 |
| F | 저주 양쪽 도배 | 자해 사망 |

---

## 11. v2 시스템 디테일 (2025-05-19 리팩토링)

### 11.1 자동 전투 흐름
```
[매 60ms × 속도배수]
  → advanceTick (상태이상/게이지/버프)
  → 살아있는 각 몬스터 ready 체크 → monsterAttack(monster) → consumeAction
  → 플레이어 ready 체크 → playerAutoAct()
       ├ pickAutoAction (옵션: forbidActiveSkills, forceActiveSkills)
       │   ├ 1. 갑옷 자동 스킬 트리거 (HP/적게이지 조건)
       │   ├ 2. 무기 스킬 확률 발동 (computeWeaponSkillProc)
       │   └ 3. 평타
       └ consumeAction
  → 종료 체크
```

### 11.2 빌드 스킬 발동률 (`core/buildBalance.ts`)
```ts
WEAPON_SKILL_PROC = {
  단검: 0.22, 건틀릿: 0.18, 검: 0.32, 창: 0.40, 사슬낫: 0.35,
  대검: 0.55, 도끼: 0.55, 철퇴: 0.60, 해머: 0.60, 양날도끼: 0.70,
  숏보우: 0.38, 롱보우: 0.55, 석궁: 0.55,
  완드: 0.32, 스태프: 0.50, 마도서: 0.45,
}
GRADE_PROC_MOD = { 노말: +0.10, 레어: +0.05, 스페셜: 0, 레전드: -0.05 }
TRAIT_TIER_PROC_MOD = { 하급: +0.05, 보통: 0, 희귀: -0.03, 특별: -0.05 }

ARMOR_AUTO_TRIGGER = {
  가죽갑: { baseChance: 0.45, monsterGaugeThreshold: 70 },  // 적이 공격 직전
  로브:   { baseChance: 0.55, hpThreshold: 0.50 },          // HP 50% 이하
}

최종 = clamp(0.05, 0.85, (base + 등급mod + 트레잇mod) × (1 + 행운×0.005))
```

### 11.3 모달 시스템 (`stores/game.ts`)
```ts
// Promise 기반 — await로 동기 흐름처럼 사용
await game.alertModal(message, title?, imageUrl?)
await game.confirmModal(message, { okLabel, cancelLabel, danger, imageUrl })
await game.showInputDialog({ title, message, defaultValue, maxValue })
await game.showListDialog({ title, options: { label, value, sub, class }[] })
```
- `DialogModal.vue` / `InputModal.vue` / `ListModal.vue` 컴포넌트 + `App.vue`에 마운트
- store에 dialog/inputDialog/listDialog state + resolver 클로저
- 모든 native alert/confirm/prompt 호출 제거 (30+ 호출)

### 11.4 캐릭터 생성 영속화
```ts
// localStorage 'climetop:creation:v1'
{
  rolledStats: Stats | null,        // 주사위 굴림 결과
  rollsLeft: number,                // 남은 굴림 수 (3 → 0)
  challengeKeys: string[],          // 3개 챌린지 옵션
  selectedKey: string | null,       // 선택한 챌린지
  avatarOptions: string[],          // 4명 랜덤 캐릭터
  selectedAvatar: string | null,    // 선택한 캐릭터
}
```
- `init()`: 복원 (캐릭터 생성 도중 새로고침/뒤로가기 후에도 같은 상태)
- `newGame()`: clearCreation (게임 시작 후 임시 데이터 삭제)
- `resetCharacterCreation()`: 사용자가 명시적으로 리셋 ("🔄 다시 굴리기" 버튼)

### 11.5 인벤토리 시스템
- **TowerRun.inventory: ItemInstance[]**, cap 4 (미니멀리스트 1)
- **자동 장착 X** — 모든 입수 아이템은 인벤토리로
- **단**: 상점 구매는 즉시 스위칭 (기존 장비 인벤토리로)
- 인벤토리 가득 + 픽업 시: `pendingPickup` → `PickupModal.vue` → 4슬롯 중 폐기 선택 / 신규 포기
- 인벤토리 모달에서 장착/판매/폐기, 장비 슬롯에서 해제

### 11.6 이미지 자산 매핑 (`ui/images.ts`)
| 헬퍼 | 반환 |
|---|---|
| `themeBgUrl(theme, wide?)` | `/images/BACKGROUND/<테마>.png` 또는 `WIDE` 버전 |
| `mainImageUrl()` | `/images/main.png` (메뉴/생성 배경) |
| `monsterImageUrl(name)` | 50+종 매핑, fuzzy 매칭 |
| `itemImageUrl(kind, baseKey)` | 무기 13 + 갑옷 4 |
| `playerImageUrl(avatarKey)` | USER 폴더 24장 |
| `rankIconUrl(rank)` | F~EX 등급 아이콘 |
| `statIconUrl(stat)` | 10스탯 아이콘 |
| `statusIconUrl(kind)` | 6 상태이상 아이콘 |
| `npcIconUrl(eventKey)` | 6 NPC (대장장이/도박사 등) |
| `skillIconUrl(skillKey)` | 19 스킬 |
| `isWideViewport()` | 768px 임계 분기 |

### 11.7 장비 종합 계수 (`ui/components/ItemDetail.vue`)
공격력 계수와 방어력 계수 두 가지 표시 (곱셈 기반):
```
공격력 계수 = 최종 공격력
  × accMult (1 + 명중/80)       # 명중 -10 → ×0.875
  × penMult (1 + 관통/20)
  × speedMult (무기 coef 또는 갑옷 speedMult)
  × luckMult (1 + 행운×0.02)
  × lifestealMult (1 + 흡혈×0.6)
  × statusMult (1 + 상이확률합×0.5)
  × selfDotPenalty (1 - 자해×4)

방어력 계수 = 최종 방어
  × evaMult (1 + 회피/80)
  × stResMult (1 + 상저/30)
  × mpMult (1 + 마력보너스/50)    # 갑옷 mpBonus + 트레잇 마력
  × dmgHealMult (1 + 피격회복×5)
  × selfDotPenalty
```
무기 단독이라도 회피/방어 트레잇 있으면 방어 계수 ↑, 갑옷 단독이라도 속도/명중이 좋으면 공격 계수 ↑

### 11.8 변경된 파일 구조
```
src/
├── core/
│   ├── buildBalance.ts        (NEW) — 무기별 스킬 발동률
│   ├── stats.ts               — 통합 effective stats
│   ├── combat.ts              — 다수 적, currentTarget(), aliveMonsters()
│   ├── skills.ts              — pickAutoAction(), 마법 강화
│   ├── character.ts           — 50pt 분배, uniformStartingStats()
│   ├── challengeRuntime.ts    — 트래킹 훅 12+종
│   └── items.ts               — 6챕터 등급 차단
├── data/
│   ├── armor.ts               — 4종 재밸런싱
│   ├── traits.ts              — 51 트레잇 통합 (공격력_pct/방어력_pct/관통)
│   ├── skills.ts              — 19 스킬 멀티 조정
│   ├── chapters.ts            — encounterMin/Max 추가
│   └── challenges.ts          — 50종 챌린지 통합 보상
├── stores/game.ts             — 영속화, 모달, 자동 액션, 인벤토리, NPC 이벤트
├── ui/
│   ├── images.ts              (NEW) — 모든 이미지 URL 헬퍼
│   └── components/
│       ├── ItemDetail.vue     (NEW) — 공/방 2계수
│       ├── DialogModal.vue    (NEW)
│       ├── InputModal.vue     (NEW)
│       ├── ListModal.vue      (NEW)
│       ├── PickupModal.vue    (NEW)
│       ├── StatusModal.vue    (NEW) — 상태창 모달
│       ├── InventoryModal.vue (NEW) — 인벤토리 모달
│       └── StatusBadges.vue   — 아이콘 추가
└── screens/
    ├── MainMenu.vue           — main.png 배경, 이어하기 reactive
    ├── CharacterCreation.vue  — 아바타 4종 + 주사위 + 챌린지
    ├── Dungeon.vue            — 챕터 배경 카드, 상태/인벤 버튼
    └── Combat.vue             — 통합 배경, 피격 이펙트, 자동 진행
```

### 11.9 신규 의존성
```json
// public/images/ 정적 자산 (~25MB)
// - BACKGROUND: 11 테마 × 2 (모바일 + WIDE)
// - MONSTER: 55종
// - USER: 24종 (캐릭터 외형)
// - ITEM: 17 (무기 13 + 갑옷 4 + 등급 표시)
// - SKILL: 19 스킬 아이콘
// - NPC: 8 (특별 이벤트 + 상점)
// - UI: 13 스탯 + 6 상태이상 + 10 등급 + 3 챌린지
```

---

문서 끝. 코드 변경 시 본 문서도 동기화 필요.
