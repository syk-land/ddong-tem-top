# 캐릭터 생성

코드: `src/screens/CharacterCreation.vue`, `src/core/character.ts`

---

## 진입

`MainMenu` → "🆕 새 캐릭터" 버튼:
1. `triggerRealBossIfDue` 체크 — 누적 골드 5만 도달 시 도전 모드로 우회.
2. `startCharacterCreation()`:
   - 4배속 → 1배속 자동 리셋
   - 자동 진입 OFF 자동 리셋
   - 저장된 진행 상태 (loadCreation) 복원 또는 신규 생성:
     - `pickThreeRandomChallenges()` → 챌린지 3개 (즉시 2 + 리스크 1)
     - 주사위 3회 초기화
     - 랜덤 아바타 1개
   - 화면 → `create`.

---

## UI 패널

### 1. 진짜 보스 도전 누적 보상 (조건부)
`meta.permanentStartBonus > 0` 일 때만:
- "마지막 도전: 보스 체력 NN/100 깎음"
- "시작 능력치 총합 50 → (50 + N)pt (+Npt 영구, 5스탯 균등 자동 분배)"

### 2. 주사위
- 남은 굴림 3회 (소진 시 굴리기 버튼 비활성).
- 주사위 굴림 → `generateRandomStats()` → 5스탯에 50pt 랜덤 분배 (각 최소 3, 최대 20).
- 결과 미리보기: 5스탯 카드 + 총합. **영구 보너스가 자동 분배된 최종 값** 표시.

### 3. 챌린지 선택
- 3개 카드 (즉시 보상형 2 + 리스크 베팅형 1).
- 카드 클릭 → 토글 (선택/해제).
- 선택 안 해도 시작 가능.

### 4. 누적 보너스 자유 분배 (조건부)
`meta.totalBonusStats > 0` 일 때만:
- 5스탯에 +/- 버튼으로 분배.
- 길게 누르면 가속 연타 (350ms 시작, ×0.82 가속).
- 합계 ≤ totalBonusStats 까지만.

### 5. 탑 진입
`newGame(allocation)` 호출 → `createCharacter` → 첫 챕터 진입.

---

## 캐릭터 빌드 흐름 (`createCharacter`)

```ts
function createCharacter(bonusAllocation, customStats?, pendingStartBonus = 0): Character {
  stats = customStats ?? uniformStartingStats()  // 5스탯 각 10

  // 1) 메타 보너스 자유 분배 적용
  for k in bonusAllocation:
    stats[k] += bonusAllocation[k]

  // 2) 진짜 보스 영구 보너스 자동 분배 (5스탯 균등 + 나머지)
  if pendingStartBonus > 0:
    base = floor(pendingStartBonus / 5)
    rem  = pendingStartBonus - base × 5
    for k in [힘,민첩,체력,마력,행운]: stats[k] += base
    for i in 0..rem-1: stats[five[i]] += 1

  return Character {
    stats, hp: maxHp, maxHp: 10×체력+50, mp/maxMp, weapon: starter, armor: null, gold: 50, ...
  }
}
```

---

## 시작 장비

- 무기: 무작위 물리 무기 (등급 노말, 트레잇 하급).
- 갑옷: 없음.
- 골드: 50G + 챌린지 보너스.

---

## 저장/복원

`localStorage['climetop:creation:v1']` (`saveCreation`):
- 주사위 굴림 결과 (`rolledStats`)
- 남은 굴림 (`rollsLeft`)
- 챌린지 목록 + 선택
- 선택한 아바타

뒤로가기/새로고침 시 보존되어 같은 상태로 복원.
