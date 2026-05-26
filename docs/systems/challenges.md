# 챌린지 시스템 (40종)

> 캐릭터 생성 시 3개 랜덤 제시 → 1개 선택 (선택 안 해도 됨). 즉시 보상형 22 + 리스크 베팅형 18.

코드: `src/data/challenges.ts` + `src/core/challengeRuntime.ts`

서사적 의미: 더 가혹한 조건일수록 시간의 신이 부여하는 보상↑. [DOCS §0](../../DOCS.md#0-게임-서사-진짜-스토리)

---

## 분류

### 즉시 보상형 (instant, 22개)
- 캐릭터 생성 직후 스탯/골드 보너스 + 제약 조건 부여
- 제약 위반 시 즉시 페널티 (사망/스탯 변동/장비 비활성)
- 50/100층 클리어 무관

### 리스크 베팅형 (risk, 18개)
- 시작 시 보너스 없음 (또는 작음)
- **100층 (또는 50층) 클리어 시** `metaBonus` 적립 (+1~15pt)
- 조건 위반 시 챌린지 실패 → `metaBonus` 0

---

## 대표 챌린지

### 즉시 보상형
| 이름 | 보너스 | 제약 |
|---|---|---|
| 과유불급 | 체력 +10 | 공격력 200 초과 시 즉사 |
| 마법 혐오증 | 체력 +6 | 마법 무기 장착 불가 |
| 로브의 길 | 마력 +14 | 마법무기 + 로브 강제 |
| 명사수 | 민첩 +8 | 활(원거리) 무기만 |
| 굼벵이 전술 | 체력 +5 | 한방형 무기만 |
| 체중감량 | 민첩 +6 | 판금/중갑 금지 |
| 강박증 | 행운 +6 | 같은 등급만 유지 |
| 조급증 | 민첩 +10 | 회복샘 사용 불가 |
| 황금 알레르기 | 골드 +300 | 보유 골드 2000 초과 시 즉사 |
| 속전속결 | 공격력 +20% | 80틱 안에 전투 종료 못 하면 페널티 |
| ... | ... | (총 22개) |

### 리스크 베팅형
| 이름 | 보너스 (메타) | 조건 |
|---|---|---|
| 무소유의 장 | +10 | 50층 클리어 + 레전드 장비 금지 |
| 평화주의자 | +15 | 100층 클리어 + 공격 스킬 사용 금지 |
| 청빈 | +12 | 누적 골드 ≤ 5000 |
| 고집불통 | +8 | 새로고침 0회 |
| 거지 근성 | +10 | 같은 등급 유지 (`trackOnlyTier1`) |
| 침묵의 길 | +10 | 액티브 스킬 사용 안 함 (`noActiveSkills`) |
| 명예의 전당 | +15 | 100층 클리어 + 사용한 챌린지 추적 |
| ... | ... | (총 18개) |

전체 목록은 `src/data/challenges.ts` 참고.

---

## 진행 추적 (`challengeRuntime.ts`)

활성 챌린지마다 `counters` 객체로 조건 누적:

```ts
interface ChallengeCounters {
  goldEarned: number
  refreshCount: number
  legendaryEquipped: boolean
  activeSkillsUsed: number
  // ... 챌린지별 필드 50+
}
```

매 행동 후 갱신, 클리어 시 `evaluateFinalChallenges()` 가 최종 검증.

---

## ChallengeFlags

`src/data/challenges.ts` 의 `ChallengeFlags` 객체로 모든 제약을 정형화:

```ts
interface ChallengeFlags {
  forbidMagicWeapon?: boolean
  forbidPlateArmor?: boolean
  forbidLegendary?: boolean
  startWeaponOverride?: string  // 시작 무기 강제
  startArmorOverride?: string
  noShop?: boolean
  noHealingSpring?: boolean
  noRescueAdventurer?: boolean
  noActiveSkills?: boolean      // 갑옷 자동 반응 영향 없음
  trackNoLegendaryEver?: boolean
  trackOnlyTier1?: boolean
  trackPacifist?: boolean
  trackNoRefreshEver?: boolean
  goldMax2000Death?: boolean
  // ... 50+
}
```

---

## 시작 무기 재추첨

특정 챌린지(굼벵이전술 / 마법혐오증 / 체중감량 / 강박증 / 로브의길 / 명사수)는 시작 무기를 조건에 맞게 자동 재추첨.
로브의 길은 시작 갑옷도 로브로 강제 (`character.ts`).

---

## 클리어 보너스 합산

```
clearBonus = rank.bonus (1~10) + sum(challenge.metaBonus if !failed)
```

| 등급 | rank.bonus |
|---|---|
| EX | 10 |
| SSS | 9 |
| SS | 8 |
| ... | ... |
| D | 3 |
| E / F | 0 |

챌린지 클리어 시 추가 metaBonus 가 쌓이므로, **똥템 + 어려운 챌린지** 조합이 시간의 신의 여력을 가장 크게 만든다.

---

## UI

캐릭터 생성 화면에서 챌린지 카드 3장 (즉시 2 + 리스크 1) 무작위. 선택 안 해도 시작 가능 (보너스/페널티 모두 0).

진행 중 챌린지 상태는 `StatusModal` 의 챌린지 탭에서 확인.
