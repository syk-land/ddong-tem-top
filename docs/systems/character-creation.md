# 캐릭터 생성 (v6)

## 단계
1. **외형**: 자동 1명 랜덤 추첨 (`pickRandomUserAvatars(1)`)
2. **챌린지 선택**: 3장 카드 중 1개 (또는 미선택) — `pickThreeRandomChallenges()`
3. **주사위 굴림**: 최대 3회. 굴리지 않으면 5스탯 각 10 (총 50pt) 균등
   - 한 번 굴릴 때마다 5스탯 ↔ 35pt 자유 분배 (각 최소 3, 최대 20)
4. **메타 풀 자유 분배**: `meta.totalBonusStats > 0` 이면 5스탯 분배 가능
5. **도전 보너스** (있을 때): 5스탯 1/5 균등 자동 + 잔여 힘 → 민첩 → 체력 → 마력 → 행운 순서
6. **탑 진입** → `newGame(allocation)`

## 분배 흐름 (v6)
```
탑 클리어
  → VictoryScreen "+N pt 획득" 알림만 (분배 X)
  → confirmClearBonus({}) → meta.totalBonusStats += N
  → 메인메뉴

새 캐릭터
  → CharacterCreation 메타 분배 패널 (5스탯)
  → 사용자가 분배 (분배 안 한 부분은 풀에 남음)
  → 탑 진입 → consumeBonusFromPool(allocation) → meta.totalBonusStats -= used
```

분배 안 한 잔여는 풀에 누적 — 다음 캐릭터에서도 분배 가능.

## 시작 무기 / 인벤토리
- 무기: `하급 노말` 임의 무기 1개 (`createStartingWeapon`)
- 갑옷: 없음 (장비 없이 시작)
- 인벤토리 4칸 (미니멀리스트 1칸)
- 골드: 50

## 챌린지 즉시 보상
챌린지에 따라 5스탯 보너스/골드/인벤 슬롯 등 적용 (`applyInstantRewards`).

## 관련 파일
- `src/stores/game.ts` — `startCharacterCreation / rollCharacterDice / newGame / persistCreation`
- `src/core/character.ts` — `createCharacter` (도전 보너스 1/5 균등 분배)
- `src/core/meta.ts` — `commitClearBonus / consumeBonusFromPool`
- `src/screens/CharacterCreation.vue` — UI

밸런스 수치는 [balance.md](../balance.md).
