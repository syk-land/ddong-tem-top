# 메타 보너스 시스템

## 개요
탑을 클리어하면 등급에 따라 보너스 스탯 포인트가 부여되고, 다음 캐릭터 생성 시 자유 분배해 영구 누적. 등급이 낮을수록 더 많은 보너스를 받는 역설 시스템.

## 등급 → 보너스 (`getClearRank`)
| 점수 | 등급 | 보너스 |
| --- | --- | --- |
| 90+ | EX | 10 |
| 80~89 | SSS | 9 |
| 70~79 | SS | 8 |
| 60~69 | S | 7 |
| 50~59 | A | 6 |
| 40~49 | B | 5 |
| 30~39 | C | 4 |
| 20~29 | D | 3 |
| 10~19 | E | 2 |
| 0~9 | F | 1 |

## 점수 계산 (`computeClearScore`)
```
equipmentScore = ((17 - 평균티어) / 16) × 100   ← 티어 낮을수록 높음 (역설)
goldScore      = min(100, 남은골드 / 1890 × 100)
hpScore        = 남은HP / 최대HP × 100
score = round((equipmentScore + goldScore + hpScore) / 3)
```

## 보너스 분배 흐름
1. 탑 클리어 → 승리 화면(`VictoryScreen.vue`) 진입
2. `pendingClear = { rank, bonus, score }` 표시
3. 사용자가 10가지 스탯 중 N pt 자유 분배
4. 확정 → `commitClearBonus(meta, allocation)` 호출
5. `meta.allocations[stat] += N`, `meta.clearCount += 1`, `meta.totalBonusStats` 재계산
6. 다음 캐릭터 생성 시 `createCharacter(allocations)` 로 자동 적용

## 챌린지 추가 보너스
- 챌린지 클리어 성공 시 `calcChallengeMetaBonus(ctx)` → `pendingClear.bonus`에 +N

## 진짜 보스 도전 (`pendingStartBonus`)
[realboss](../features/realboss.md) 참조. 60pt 시작 스탯에 +N 균등 분배. 1회성 (사용 후 0으로 리셋).

## 클리어 캐릭터 히스토리
- `meta.characterHistory` (최대 50개) — 도전 모드에서 가장 약한 캐릭터 픽업용
- 사망 캐릭터는 적재 안 함

## 데이터 리셋
[data-reset](../features/data-reset.md) — `climetop:meta:v1` 비움 → 모든 누적 초기화.

## 관련 파일
- `src/core/meta.ts` — `commitClearBonus / loadMeta / saveMeta / pushCharacterHistory / ... `
- `src/core/character.ts` — `getClearRank / computeClearScore / createCharacter`
- `src/screens/VictoryScreen.vue`
- `src/types/index.ts` — `MetaBonuses / PendingClearBonus / CharacterRecord`
