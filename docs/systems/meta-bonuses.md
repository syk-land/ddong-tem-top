# 메타 보너스 & 진짜 보스 사이클

> 시간의 신이 주인공에게 부여하는 능력치의 시스템적 표현. [DOCS §0 서사](../../DOCS.md#0-게임-서사-진짜-스토리) 참고.

코드: `src/core/meta.ts`, `src/core/realboss.ts`

---

## MetaBonuses 스키마

```ts
interface MetaBonuses {
  clearCount: number              // 100층 클리어 총 횟수
  climbCount: number              // 도중 사망 포함 등반 총 횟수
  totalBonusStats: number         // 누적 보너스 풀 (영구)
  allocations: Partial<Stats>     // 마지막 분배 기록 (자동 적용 X)
  totalGoldEarned: number         // 누적 클리어 골드 (진짜 보스 게이트)
  characterHistory: CharacterRecord[]  // 최대 50건
  permanentStartBonus: number     // 진짜 보스 보상 (다음 캐릭터 1회 +N)
  lastBossDrainRatio: number      // 0~1 (UI 표시용)
  realBossDefeated: boolean       // 인트로 만화 t3 잠금 해제
  // ... runsSinceLastChallenge / nextChallengeAt 등 보조 필드
}
```

저장 위치: localStorage `climetop:meta:v1` (로그인 시 Firestore `meta/{uid}` 미러).

---

## 누적 보너스 풀 (`totalBonusStats`)

**서사**: 시간의 신이 부여한 영구 능력치.

### 적립 (commitClearBonus)
```
클리어 시:
  bonus = rank.bonus (1~10)         // EX 10pt ~ D 3pt
        + sum(challenge.metaBonus)  // 챌린지 클리어 시 +1~15pt
totalBonusStats += bonus            // 영구 누적
```

### 소비 (consumeBonusFromPool)
캐릭터 생성에서 5스탯 자유 분배. **풀은 차감되지 않음** — 다음 캐릭터도 같은 풀로 분배 가능.

### 리셋
- 진짜 보스 100% 완전 클리어 시 일부 리셋 (`finishRealBossCombat`)
- 그 외 영구 보존 (사망/스킵 무관)

---

## 캐릭터 히스토리 (`characterHistory`)

```ts
interface CharacterRecord {
  recordedAt: number    // timestamp
  stats: Stats          // 5스탯
  equipment: { weapon, armor }
  clearedFloors: number // 도달 층수
  clearedRanks: string[] // 챌린지 클리어 기록
  cleared100: boolean
}
```

- 최대 **50건** (recordedAt 오래된 것부터 제거)
- 진짜 보스 도전 시 부활 캐릭터 풀로 사용

---

## 진짜 보스 사이클

**서사**: 시간의 신이 누적된 힘으로 현실 통로를 여는 임계.

### 해금 조건 (`isChallengeDue`)
```
totalGoldEarned ≥ 50,000   AND   clearCount ≥ 5
```

위 조건 충족 시 다음 메인 메뉴 진입 또는 "새 캐릭터" 클릭 시 도전 모드로 전환.

### 부활 캐릭터 선정 (`pickLatestRecord`)
- `characterHistory` 의 가장 최근 100층 클리어 캐릭터
- 장비/스탯 그대로 부활 — 가장 강해진 자아를 현실로 끌어냄

### 보스 강화 (`makeRealBoss`)
- HP × 3.0
- ATK × 9.0 (v6.1 추가 강화)
- DEF × 1.6
- 챕터 10 하드 보스를 기본으로 trait 강화

### 보상 (`computeStartBonusFromDrain`)
```
drainRatio = (시작 HP - 끝 HP) / 시작 HP    // 0~1
영구 시작 보너스 = floor(60 × drainRatio)   // 0~60pt
```

다음 캐릭터에 5스탯 균등 자동 분배 + 나머지 (`60 % 5 != 0` 시) 힘→민첩→체력→마력→행운 순.

### 완전 클리어 (`drainRatio === 1`)
```
realBossDefeated = true
→ 인트로 만화 t3 잠금 해제 → 진실 공개
→ 다음 사이클 시작 (totalGoldEarned 리셋)
```

**게임 클리어** = 진짜 보스를 모두 쓰러뜨려서 시간의 신을 구하는 것.

---

## 적립 흐름

```
[꿈공간 100층 클리어]
   │
   ├─ rank 산정 (티어 합산)
   ├─ 챌린지 평가 (성공/실패)
   ├─ commitClearBonus → totalBonusStats += bonus
   ├─ characterHistory 에 기록 추가
   ├─ totalGoldEarned += 남은 골드
   └─ clearCount += 1

[진짜 보스 도전 조건 충족]
   │
   └─ 메인 메뉴 진입 시 자동 전환

[진짜 보스 결과]
   │
   ├─ drainRatio < 1.0:
   │   ├─ permanentStartBonus += floor(60 × drainRatio)
   │   ├─ totalGoldEarned 리셋
   │   └─ 다음 캐릭터 생성으로
   │
   └─ drainRatio = 1.0 (완전 클리어):
       ├─ realBossDefeated = true
       ├─ 인트로 만화 t3 표시
       ├─ totalBonusStats 일부 리셋
       └─ 다음 진짜 보스를 위한 사이클 재시작
```

---

## 마이그레이션 (`migrateAllocations`)

옛 10스탯 시스템 (`힘 / 민첩 / 지능 / 체력 / 정신력 / ...`) → 5스탯 (`힘 / 민첩 / 체력 / 마력 / 행운`) 자동 합산.
누락 필드는 `loadMeta` 가 기본값으로 채움 (`pendingStartBonus = 0`, `characterHistory = []` 등).
