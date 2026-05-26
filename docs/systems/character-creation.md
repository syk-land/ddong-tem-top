# 캐릭터 생성

코드: `src/core/character.ts`, `src/screens/CharacterCreation.vue`

---

## 흐름

```
[CharacterCreation 진입]
    │
    ├─ 1. 챌린지 카드 3장 무작위 (즉시 2 + 리스크 1)
    │     └─ 1개 선택 (또는 스킵)
    │
    ├─ 2. 주사위 굴림 (최대 3회)
    │     └─ 5스탯에 60pt 랜덤 분배
    │
    ├─ 3. 누적 보너스 풀 분배 (totalBonusStats)
    │     └─ 5스탯 버튼으로 자유 분배
    │
    ├─ 4. 영구 시작 보너스 자동 분배 (permanentStartBonus)
    │     └─ 5스탯 균등 + 나머지 힘→민첩→체력→마력→행운
    │
    ├─ 5. 외형 선택 (10명 모에 + 마지막 선택 자동 복원) + 이름 편집
    │
    └─ "시작" → Dungeon
```

---

## 시작 스탯

| 항목 | 값 |
|---|---|
| 균등 시작 | 12 / 12 / 12 / 12 / 12 (총 60pt) |
| 주사위 굴림 | 5스탯에 60pt 랜덤 분배 (각 최소 0) |
| 굴림 횟수 | 캐릭터 생성당 최대 3회 |
| 시작 골드 | 50 (챌린지 보너스로 +300 가능) |
| 시작 무기 | 하급 노말 (speedCoef 0.5 ~ 1.0 무작위) |
| 시작 갑옷 | 없음 (상점에서 획득) |

### 챌린지별 시작 무기 강제 (`character.ts`)

- 굼벵이 전술 → 한방형 (`대검 / 양날도끼 / 할버드`)
- 마법 혐오증 → 비-마법 무기만
- 체중감량 → 속도형
- 강박증 → 같은 등급/특성으로 고정 시작
- 로브의 길 → 시작 무기 마법 강제 + **시작 갑옷도 로브 강제**
- 명사수 → 활 (`숏보우 / 롱보우 / 석궁`)

---

## 주사위 시스템

```ts
function rollStats(): Stats {
  // 60pt 를 5스탯에 랜덤 분배 (각 최소 0)
}
```

- 첫 진입 시 자동 1회 굴림 (= 균등이 아닌 랜덤으로 시작)
- 결과는 `climetop:creation:v1` 에 보존 — 다음 캐릭터 생성까지 유지
- "다시 굴리기" 버튼 활성 횟수 = `rollsLeft` (최대 3)

---

## 누적 보너스 분배

- `totalBonusStats` 만큼 5스탯 어디든 자유 분배
- 풀은 차감 안 됨 — 분배만 결정 (다음 캐릭터도 같은 풀 사용 가능)
- UI: 5스탯 각 +1 버튼, 분배 합계가 풀 이내로 제한

---

## 영구 시작 보너스 자동 분배

`permanentStartBonus` 가 있을 때:

```ts
const each = Math.floor(bonus / 5)
const remainder = bonus % 5
stats.힘 += each + (remainder >= 1 ? 1 : 0)
stats.민첩 += each + (remainder >= 2 ? 1 : 0)
stats.체력 += each + (remainder >= 3 ? 1 : 0)
stats.마력 += each + (remainder >= 4 ? 1 : 0)
stats.행운 += each
```

자동 분배 — 사용자 개입 없음. 보너스는 1회용 (소비 후 0).

**서사**: 진짜 보스에게 깎인 비율만큼 시간의 신이 회귀와 함께 능력치를 부여한 결과.

---

## 외형 & 이름

`src/screens/CharacterCreation.vue` 의 메인 카드 + 변경 모달:
- 거지템 모에 10명 (`01`~`10`) — `public/images/USER/{ID}.webp` (전신) / `USER_BUST/{ID}.webp` (흉상)
- 초기값: 마지막 선택(`climetop:lastAvatar:v1`) → 없으면 랜덤 1명
- 변경 모달: 전신 1명씩 좌우 페이저 → "선택" → 영구 LS 저장
- 이름: 단일 (`climetop:playerName:v1`). 미설정 시 아바타의 추천 이름. 편집(`✎`) 시 입력 다이얼로그
- 런 시작 → `runAvatar = selectedAvatar`, 런 동안 변경 불가

자세히: [../features/auto-avatar.md](../features/auto-avatar.md)

---

## 캐릭터 생성 상태 저장

```
localStorage["climetop:creation:v1"]:
  {
    rollsLeft: number
    pendingAllocation: Partial<Stats>
    selectedChallenge: ChallengeId | null
    rolledStats: Stats | null
    avatar: string | null
  }
```

뒤로가기로 나가도 진행도 유지. "시작" 클릭 시 초기화.
