# 메타 보너스 & 진짜 보스

> 영구사망(permadeath) 게임이지만, 클리어 시 누적 보상이 다음 캐릭터로 이어짐.

코드: `src/core/meta.ts`, `src/core/realboss.ts`

저장: `localStorage['climetop:meta:v1']` (`MetaBonuses` 구조).

---

## `MetaBonuses` 필드

| 필드 | 타입 | 의미 |
|---|---|---|
| `clearCount` | number | 누적 100층 클리어 횟수 |
| `totalBonusStats` | number | 누적 자유 분배 포인트 풀 (1~10 + 챌린지) |
| `allocations` | Partial<Stats> | 직전 캐릭터 분배 기록 (디버그용) |
| `runsSinceLastChallenge` | number | (옛 시스템 호환용) |
| `nextChallengeAt` | number | (옛 시스템 호환용) — 항상 5 |
| `characterHistory` | CharacterRecord[] | 클리어 캐릭터 누적 (최대 50) |
| `pendingStartBonus` | number | (deprecated) 1회성 보너스 |
| `permanentStartBonus` | number | 진짜 보스 깎은 비율 × 60 누적 |
| `lastBossDrainRatio` | 0~1 | 가장 최근 도전에서 깎은 비율 (UI 표시용) |
| `realBossCompleted` | bool | 진짜 보스전 1회 이상 완료 여부 (튜토리얼 t3 잠금 해제) |
| `realBossDefeated` | bool | 100% 클리어 여부 (게임 완료) |
| `totalGoldEarned` | number | 클리어 시점 잔여 골드 누적 (내부 — UI 표시 X). 5만 도달 시 진짜 보스 트리거 |

---

## 누적 풀 (`totalBonusStats`)

### 적립
매 클리어 시 `commitClearBonus(meta, _, pendingBonus)`:
```ts
meta.totalBonusStats += pendingBonus
```

`pendingBonus` = `rank.bonus (1~10)` + `sum(challenge.metaBonus)` (실패 안 한 챌린지).

### 분배
- 캐릭터 생성 화면에서 `bonusAvailable = meta.totalBonusStats` 만큼 5스탯에 자유 분배.
- v6.1: **분배해도 풀이 차감되지 않음** — 누적은 영구 (`consumeBonusFromPool`은 `allocations` 기록만, 풀 차감 X).

### 리셋
**진짜 보스 도전 종료 시점에 0 리셋** (`finishRealBossCombat`):
```ts
meta.totalBonusStats = 0
meta.allocations = {}
```
이전엔 `proceedFromRealBossResult` (결과 화면 버튼 클릭 시점)에서 처리했으나, 새로고침/뒤로가기 등 우회 경로에서 리셋 누락 → v6.1에서 보스전 종료 즉시로 이동.

---

## 영구 시작 보너스 (`permanentStartBonus`)

### 적립
진짜 보스전 종료 시 (`finishRealBossCombat`):
```ts
ratio = (initialHp - finalHp) / initialHp  // 0~1
gain = floor(60 × ratio)
meta.permanentStartBonus += gain
```

깎은 비율 36% → 21pt 적립. 100% → 60pt 적립.

### 적용
다음 캐릭터 생성 시 `createCharacter` 가 자동으로 5스탯 균등 분배:
```ts
five = ['힘','민첩','체력','마력','행운']
base = floor(permanentStartBonus / 5)
rem  = permanentStartBonus - base × 5
for k in five: stats[k] += base
for i in 0..rem-1: stats[five[i]] += 1   // 나머지는 힘→민첩→체력→마력→행운 순
```

예: 21pt → 5스탯 각 +4 + 힘 +1 = 17/14/14/14/14 (= 50 + 21).

### 리셋
**`resetMeta()` (데이터 리셋 버튼)** 외에는 리셋 안 됨 — 영구 누적.

---

## 진짜 보스 도전

### 트리거
- 매 100층 클리어 시점에 `accumulateClearGold(meta, character.gold)` → `totalGoldEarned` 적립.
- **누적 5만 골드 도달 시** `isChallengeDue(meta) === true`.
- 다음 메인 메뉴 진입 또는 "새 캐릭터" 클릭 시 `startRealBoss()` 자동 발동.

### 시작
`startRealBoss()`:
1. `consumeChallengeTrigger(meta)` → `totalGoldEarned = 0` 리셋.
2. `pickLatestRecord(meta)` — 가장 최근 클리어 캐릭터.
3. 그 캐릭터의 `lastChapterTheme` 의 hardBoss를 강화:
   ```
   inst.maxHp ×= 3.0
   inst.atk   ×= 9.0    (v6.1, 기존 1.8 → 9.0)
   inst.def   ×= 1.6
   ```
4. 화면 → `realboss`.

### 진행
- 캐릭터 풀 HP/MP로 부활, 기존 장비 그대로 사용.
- 전투 종료 (사망/도주/완클) 후 → `finishRealBossCombat`.

### 보상
- 깎은 비율 × 60 → `permanentStartBonus` 영구 누적.
- `meta.lastBossDrainRatio` 저장 (다음 캐릭터 생성 패널 표시).
- 100% (ratio ≥ 0.9999) → `realBossDefeated = true` (게임 클리어, 인트로 만화 t3 잠금 해제).
- `realBossCompleted = true` (1회 이상 시도 완료).

### 화면 흐름
```
[Menu] → triggerRealBossIfDue → [RealBossChallenge] (도전 시작 안내)
   │
   ↓ "도전 시작"
[Combat] (진짜 보스전)
   │
   ↓ 종료 → finishRealBossCombat
[RealBossResult] (깎은 % + 적립 pt 표시)
   │
   ↓ "캐릭터 생성하기" → proceedFromRealBossResult
[IntroComic: afterRealBoss] (t1→t2→t3)
   │
   ↓ closeIntroComic
[CharacterCreation] (다음 캐릭터, permanentStartBonus 적용)
```

---

## 클리어 등급 보너스 표

`character.ts:getClearRank(score)` 매핑 (score = 무기 티어 + 갑옷 티어):

| 점수 | 등급 | 보너스 |
|---|---|---|
| ≤ 5  | EX  | 10 |
| ≤ 8  | SSS | 9 |
| ≤ 11 | SS  | 8 |
| ≤ 14 | S   | 7 |
| ≤ 17 | A   | 6 |
| ≤ 20 | B   | 5 |
| ≤ 23 | C   | 4 |
| ≤ 26 | D   | 3 |
| ≤ 29 | E   | 2 |
| 30+  | F   | 1 |

낮은 티어 장비 유지 = 점수 ↓ = 등급 ↑ = 보너스 ↑ = 다음 캐릭터 강해짐. "똥템" 컨셉의 핵심.

---

## 캐릭터 히스토리 (`characterHistory`)

매 클리어 시 캐릭터 스냅샷 적립 (`pushCharacterHistory`):
```ts
CharacterRecord {
  stats, score, rank, avatarKey,
  weapon, armor,         // ItemInstance 깊은 복사
  gold, hp/maxHp, mp/maxMp,
  lastChapterTheme,
  recordedAt: timestamp,
}
```

최대 50개 보존. 진짜 보스 도전 시 `pickLatestRecord` (가장 최근)로 부활.

---

## 마이그레이션 (v5 → v6)

5스탯 통합 (`migrateAllocations`):
| 옛 키 | 새 키 |
|---|---|
| 공격력, 관통 | 힘 |
| 방어력, 상태저항 | 체력 |
| 체력 | 체력 |
| 마력 | 마력 |
| 속도, 명중률, 회피율 | 민첩 |
| 행운 | 행운 |

`loadMeta()`에서 자동 변환.
