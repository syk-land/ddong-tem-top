# 특별 이벤트

## 개요
챕터의 특정 층(보통 6/9층 등)에서 등장하는 NPC/이벤트. 무작위로 6종 중 1개 선택.

## 6종 (`SPECIAL_EVENTS`)

### 1. crisis_adventurer — 위기에 빠진 모험가
- 구해주면 70% 동료(다음 상점 새로고침 슬롯 +1) / 30% 악당 PVP
- 챌린지 "불신주의자"이면 구할 시 사망

### 2. wandering_smith — 떠돌이 대장장이
- 현재 무기 강화 (베팅 골드만큼 성공률 ↑, 최대 90%)
- 성공: 무기 등급/티어 ↑ 또는 효과 강화
- 실패: 베팅 골드 소실

### 3. cursed_gambler — 저주받은 도박사
- 4스탯 중 1개 베팅 → 룰렛 (대성공 +5 ~ 대실패 -5)
- 행운이 높을수록 기대값(EV) ↑

### 4. exchange_altar — 등가교환 제단
- 스탯 -3 → 다른 스탯 +1 교환 (최대 3회)
- 챌린지 트래킹 (한 챕터에 등장 횟수)

### 5. black_market — 암시장
- 10가지 스탯 +1 구매 (각 가격 다름, 챕터 N에 따라 가격 ↑)
- 골드만 있으면 무제한 거래

### 6. greedy_collector — 탐욕의 수집가
- 가장 좋은 장비 양도 → 무작위 스탯 +1
- 거절 → 격노 PVP (보스의 70% 강도)

## NPC 아이콘
`public/images/NPC/{NPC명}.png` — 모험가 / 대장장이 / 도박사 / 제단 / 암시장 / 수집가

## 챌린지 훅
이벤트 후 `onAltarUsed / onAltarOffered / onSmithBet / onRouletteResult / onBlackMarketUsed / onMimicFlee` 호출. 일부 챌린지는 이벤트 등장/사용 횟수를 추적.

## 관련 파일
- `src/core/events.ts` — 6종 핵심 로직 (`resolveCrisisAdventurer / applySmithUpgrade / spinRoulette / exchangeStat / blackMarketPrice / buyStatPoint / greedyCollectorTake`)
- `src/stores/game.ts` — `runSpecialEvent` + 6개 이벤트 함수 (`eventCrisisAdventurer ... eventGreedyCollector`)
- `src/ui/images.ts` — `npcIconUrl`
