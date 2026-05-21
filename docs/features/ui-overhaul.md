# 모바일 UI 전체 정비

## 개요
안드로이드 빌드 기준으로 모든 핵심 화면을 정비. 톤(색 액센트)으로 액션·정보 종류를 구분하고, 터치 영역·글자 크기를 격상하고, 정보 위계를 카드 구조로 재배치.

같은 시기에 Firebase 로그인이 들어왔지만 파일 충돌 없음 — UI 작업은 `screens/{Combat,Dungeon,GameOver,MainMenu,Shop}`, `ui/components/{ItemDetail,ItemName,HpMpBar,StatusBadges,SpeedControl,StatusModal}`, `core/{buildBalance,itemValue}` 만 손댐.

## 톤 가이드 — 색 액센트 규칙
한 색이 한 의미로만 쓰이도록 통일. UI 전반에서 일관:

| 색 | 의미 | 사용 위치 |
| --- | --- | --- |
| `rose-*` | 적 / 보스 / 패배 / 위험 | Combat 적 카드, Dungeon 보스 층, 패배 UI |
| `cyan-*` | 플레이어 / UI 강조 / 구매 | Combat 플레이어 카드, Dungeon 내 상태 카드, StatusModal, Shop 구매 영역, ItemDetail 모달 |
| `amber-*` | 골드 / 판매 / 상점 / 승리 | 골드 칩, Shop 판매 영역, 황금고블린, 승리 모달, 누적 클리어 |
| `emerald-*` | 회복 / 이어하기 | Dungeon 회복샘 액센트, MainMenu 이어하기 카드 |
| `pink-*` | 특별 이벤트 / 챌린지 | Dungeon 특별 이벤트, StatusModal 챌린지 카드 |
| `purple-*` | 보물 | Dungeon 보물 층 |
| `slate-*` | 기본 / 비활성 | 일반 패널 테두리, 비활성 버튼 |

골드 칩은 어디서나 같은 형태: `⬢ NG` (amber 배경 + 테두리). MainMenu / Dungeon / Shop / StatusModal 일관.

## 핵심 인터랙션 패턴

### 1. 정보 → 상세 모달
빽빽한 정보를 한 줄 칩으로 보이고 탭하면 분해 모달:
- **스킬 칩** (Combat / StatusModal / ItemDetail): `[icon] 스킬명 마나 N · 발동률 N% [상세 ▸]` → 설명 모달
- **5스탯** (StatusModal): 각 스탯 버튼 → 그 스탯이 기여하는 능력치 분해
- **전투력 칩** (ItemDetail): `공 +N%` / `방 +N%` 칩 → DPS/eHp 분해 모달
- **장비 카드** (Dungeon 내 상태 / StatusModal): 탭 → ItemDetail 전체 모달

### 2. 전투력 % 비교 — 캐릭터 총합 기준
ItemDetail 의 핵심 표시 방식. 단순 아이템 단독 비교가 아니라 **캐릭터 총합** 기준:

```
totalCurrent = (현재 무기 atkValue + 현재 갑옷 atkValue)
totalNew     = (이 아이템으로 슬롯 교체) 합
pct          = (totalNew - totalCurrent) / totalCurrent × 100
            .clamp(-100, ∞)  // 100% 이상 깎일 수 없음
```

이렇게 해야 갑옷 교체로 "공 -22%" 같이 합리적 % 가 나옴. 단독 비교(분모: 0.3)면 -133% 같이 폭주.

칩 형태:
```
공 +N% (총합)
방 +N% (총합)
```

자기 자신(현재 장착품) → "현재 장착" / 비교 분모 0 → "신규" 라벨.

### 3. 카드 + 사이드 버튼
Shop 의 매물/판매 카드는 가로 분할:
```
[ItemDetail flex-1]  [구매/판매 N
                      NG       ]
```
사이드 버튼은 카드 전체 높이 (`items-stretch`), `w-16` 폭. 큰 풀폭 버튼보다 한 화면에 카드가 더 많이 들어옴.

## 화면별 개편 요약

### Combat
- 적 카드(rose) / 플레이어 카드(cyan) 통합 — 이미지+HP+상태가 한 블록
- 자동 컨트롤 인라인 제거 → 우상단 SpeedControl 로 일원화
- 로그 접기/펼치기 — 기본 접힘 + 최근 3줄 미리보기
- 승리 → fixed overlay 모달 (배경 클릭 닫힘). 패배는 GameOver 자동 전환
- 스킬 칩 탭 → 설명 모달

### Dungeon
- 헤더 정리 — 챕터/층 + 액션 버튼(`min-h-9`)
- 진입 카드 — 층 종류별 액센트 + 좌상단 태그 (보스/상점/보물/회복샘/특별 이벤트)
- 내 상태 카드 — cyan 액센트, 아바타 + 골드 칩, 무기/갑옷 카드 탭 → ItemDetail 모달

### GameOver
- 마지막 전투 로그 패널 (combat 객체 유지를 활용, 마운트 시 마지막 줄 자동 스크롤)

### MainMenu
- 상단 누적 통계 칩 (`🏆 클리어 N회` / `⚡ 보너스 +Npt`)
- 이어하기 카드 — 아바타 + 챕터/층 + HP/MP 미리보기 (`loadRun()` 으로 미리 로드)
- Google 로그인 버튼 — 흰 배경 + G 로고(인라인 SVG), 차별화된 톤
- 데이터 리셋 → 작은 푸터 텍스트 링크 (실수 클릭 방지)

### Shop
- 헤더 amber 액센트 + 골드 칩
- 판매 영역 (장착/인벤) amber / 구매 영역 cyan — 액션 종류별 색 구분
- 카드별 사이드 버튼 (위 패턴 #3)
- 하단 sticky 액션 — 새로고침 + 나가기 (중복 제거)

### StatusModal
- 헤더 cyan 액센트
- HP/MP/Gold 3색 칩 카드 (emerald/sky/amber)
- 탭 전환 (기본 / 상세 능력치) — 활성 cyan 밑줄
- 기본 능력치: 5스탯 버튼 (탭 → 해당 스탯이 기여하는 능력치 분해 모달)
- 상세 능력치: v9 파생 능력치 grid + 각 항목 탭 → breakdown 모달
- 무기/갑옷 카드 탭 → ItemDetail 모달, 해제 버튼 카드 아래
- 자동 발동 스킬 — 탭하면 description 모달 (game.alertModal)

### ItemDetail
- 헤더(이미지+이름+등급+베이스 한 줄) → 전투력 칩(공/방 % + 절대값) → 스킬 칩 → 특수 효과 → 등급 변화
- 분해 모달: 평타 DPS / 스킬 DPS / 상태이상 / 흡혈 등 breakdown
- 모든 영어 식별자 한글화 (`baseAtk` → "무기공격", `coef` → "등급", `atk_pct` → "공격%")

### 공통 컴포넌트
- **HpMpBar**: 라벨 bold, 두께 2.5px, ring, 음수 HP `Math.max(0, ...)` clamp
- **ItemName**: `compact` 모드에서 텍스트 길이별 폰트 자동 (12→11→10→9px)
- **StatusBadges**: `text-[10px]` → `text-xs`, 아이콘 살짝 키움
- **SpeedControl**: 우상단 → 좌상단, 접힘 상태에서 스피커 별도 버튼 (전체 sfx+bgm 토글)
- **buildBalance**: `GRADE_PROC_MOD` / `TRAIT_TIER_PROC_MOD` export 추가

## 모바일 우선 규칙
- 모든 주요 버튼 `min-h-11` 이상 (안드로이드 권장 44dp)
- 텍스트 격상: `text-[10px]` / `[11px]` → `text-xs` / `text-sm` 이상
- 가로 좁은 카드(grid-cols-2) 안의 아이템 이름은 `whitespace-nowrap` + 폰트 자동 조절
- App.vue `<main>` 에 `pt-8` 조건부 — 좌상단 SpeedControl 이 화면 상단 텍스트 가리지 않게

## 관련 파일

| 파일 | 역할 |
| --- | --- |
| `src/screens/Combat.vue` | 전투 — 적/플레이어 카드 + 스킬 모달 + 승리 모달 + 로그 토글 |
| `src/screens/Dungeon.vue` | 탐험 — 헤더/진입 카드(theme 액센트)/내 상태 카드/장비 모달 |
| `src/screens/GameOver.vue` | 사망 — 마지막 전투 로그 |
| `src/screens/MainMenu.vue` | 메인 — 통계 칩/이어하기 카드/Google 로그인 |
| `src/screens/Shop.vue` | 상점 — 헤더/판매/구매 영역 액센트 + 사이드 버튼 |
| `src/ui/components/StatusModal.vue` | 상태창 — 5스탯 클릭 분해 / 장비 모달 / 스킬 모달 |
| `src/ui/components/ItemDetail.vue` | 아이템 카드 + 분해 모달 — 총합 기준 % 비교 |
| `src/ui/components/ItemName.vue` | 길이별 폰트 자동 |
| `src/ui/components/HpMpBar.vue` | 두께/라벨/clamp |
| `src/ui/components/StatusBadges.vue` | 상태이상 칩 |
| `src/ui/components/SpeedControl.vue` | 좌상단 floating — 속도/자동/스피커 |
| `src/core/buildBalance.ts` | GRADE_PROC_MOD / TRAIT_TIER_PROC_MOD export |
| `src/core/itemValue.ts` | v9 atkValue/defValue 계산 (DPS/eHp 모델) |
| `src/App.vue` | `<main>` pt-8 conditional |

## 향후
- Shop 의 ItemDetail 가로 분할이 좁은 화면에서 조금 빡빡 — `w-16` 사이드 버튼을 `w-20` 정도로 키우는 옵션 검토
- CharacterCreation 화면은 미정비
- VictoryScreen 미정비
- RealBossChallenge/Result 미정비
- 사망 모달이 아니라 화면 전체 인 GameOver — Combat 의 승리 모달과 톤 통일 검토 여지
