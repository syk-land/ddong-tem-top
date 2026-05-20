# 특별 이벤트

> 챕터 안에 무작위로 1~9F 에 배치되는 NPC/이벤트.

코드: `src/core/events.ts`

`SpecialEventKey`:
- `lost_adventurer`
- `wandering_smith`
- `cursed_gambler`
- `exchange_altar`
- `black_market`
- `greedy_collector`

---

## 1. 위기에 빠진 모험가 (`lost_adventurer`)

> 함정에 빠진 모험가를 발견했다.

- **구출**: 보상 (스탯/골드/장비 중 무작위)
- **무시**: 패스
- 챌린지 `noRescueAdventurer` (불신주의자): 구출 시 **즉사**

---

## 2. 떠돌이 대장장이 (`wandering_smith`)

> 낯선 대장장이가 무기 강화를 제안.

- 골드를 베팅 → 무기 등급 1단계 ↑ 도박.
- 성공 확률 = `smithSuccessChance(bet, weaponSellPrice)`:
  - 베팅 ≥ 무기 가치 × 0.8 → 70% 성공
  - 베팅 ≥ 무기 가치 × 0.5 → 50%
  - 그 미만 → 30%
- 성공: 무기 등급 ↑ + coef 재추첨.
- 실패: 골드 잃음.
- 챌린지 `trackSmith80PctBet` (대장장이은인): 80% 베팅 + 성공 시 보너스.

---

## 3. 저주받은 도박사 룰렛 (`cursed_gambler`)

> 악마의 룰렛.

- 스탯 1종 선택 → 확률 굴림:
  - **대성공** (5%): 해당 스탯 +5 영구
  - **성공** (30%): +2
  - **무효** (40%): 변화 X
  - **실패** (20%): -2
  - **대실패** (5%): -5
- 챌린지 `trackRouletteGreat3` (도박중독): 대성공 3회 누적 시 보너스.
- 챌린지 `bleedBadLuckPct` (혈우병): 출혈 시 대실패 +20%.

---

## 4. 등가교환 제단 (`exchange_altar`)

> 고대 신의 제단.

- 스탯 1종 **-3** → 다른 스탯 **+2**.
- 챕터당 최대 3회 사용 가능.
- 챌린지 `trackAltarEveryChapter` (철저한등가교환): 매 챕터 3회 사용 강제.

---

## 5. 암시장 스탯 브로커 (`black_market`)

> 어둠 속 거래.

- 골드로 스탯 영구 +1.
- 스탯별 가격 다름 (힘 비쌈, 행운 쌈).
- 챌린지 `trackBlackMarketCount` (암시장VIP): 누적 10회 이상 사용 시 보너스.

---

## 6. 격노한 수집가 (`greedy_collector`)

> 후반 챕터 PvP 전투.

- 일반 보스 템플릿 × 0.85 강화판 보스 등장.
- `combat.isPvp = true` 설정 → PvP 피격 트래킹 (배신 저항군 챌린지).
- 처치 시 큰 보상.

---

## 등장 빈도

`tower.ts:makeChapter()` 에서 1챕터당 0~2 특별 이벤트 배치. 무작위 종류 선택.

---

## 화면 / 모달

`game.ts:enterSpecialEvent(key)` 호출 시 `npcIconUrl(key)` 일러스트와 함께 모달 표시:
- `lost_adventurer` → `/images/NPC/모험가.png`
- `wandering_smith` → `/images/NPC/대장장이.png`
- `cursed_gambler` → `/images/NPC/도박사.png`
- `exchange_altar` → `/images/NPC/제단.png`
- `black_market` → `/images/NPC/암시장.png`
- `greedy_collector` → `/images/NPC/수집가.png`

각 이벤트는 `DialogModal` / `InputModal` / `ListModal` 사용해 사용자 선택 받음.
