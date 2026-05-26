# 진짜 보스 도전 모드

> 시간의 신이 현실로 통로를 여는 임계. 누적된 가장 강한 자아를 현실로 끌어내 진짜 보스와 싸운다.

코드: `src/core/realboss.ts`, `src/screens/RealBossChallenge.vue`, `src/screens/RealBossResult.vue`

---

## 서사

**똥템 탑은 주인공의 꿈공간이고, 진짜 보스가 있는 쪽이 현실이다.** 자세한 배경: [DOCS §0](../../DOCS.md#0-게임-서사-진짜-스토리)

- 진짜 보스들이 시간의 신을 공격 중
- 시간의 신은 자기 힘을 깎아 주인공에게 능력을 부여
- 누적 골드 5만 = 시간의 신이 통로를 여는 임계
- 도전 실패 시 시간의 신이 주인공을 회귀시키고 능력치 추가 부여 — **회귀하셨습니다**
- 완전 처치 시 회귀하지 않음 — 누적 풀 그대로 보존하고 다음 사이클로 이어짐
- 게임 클리어 = 모든 진짜 보스 격파

---

## 해금 조건 (`isChallengeDue`)

```ts
totalGoldEarned >= 50000 && clearCount >= 5
```

| 조건 | 의미 |
|---|---|
| `totalGoldEarned >= 50,000` | 누적 클리어 골드 5만 (시간의 신의 임계) |
| `clearCount >= 5` | 100층 클리어 5회 이상 (충분한 자아 축적) |

위 조건 충족 시:
- 다음 메인 메뉴 진입 또는 "새 캐릭터" 클릭 시 도전 모드 자동 전환
- `RealBossChallenge` 화면으로 이동

---

## 부활 캐릭터 선정 (`pickLatestRecord`)

```ts
characterHistory.filter(r => r.cleared100).slice(-1)[0]
```

- `characterHistory` 의 **가장 최근 100층 클리어 캐릭터** 부활
- 장비 / 스탯 / 챌린지 보너스 그대로 보존 — 가장 강해진 자아

사망/미클리어 캐릭터는 풀에서 제외.

---

## 보스 강화 (`makeRealBoss`)

```ts
base = (REAL_BOSS_ORDER[realBossClearCount % 11]의 hardBoss 또는 챕터 10 보스)
realBoss = {
  ...base,
  hp:  base.hp  * 3.0 * (1 + 0.9 × realBossClearCount),
  atk: base.atk * 9.0,    // v6.1 추가 강화
  def: base.def * 1.6,
}
```

- 챕터 10 하드 보스의 trait 묶음 그대로 (소환/반사/저주 등)
- 일러스트: `public/images/REALBOSS/{테마}.png`

### 등장 순서 (`REAL_BOSS_ORDER`)

`meta.realBossClearCount` 가 인덱스 — 11회 클리어 후 다시 고블린부터 순환.

```
0: 고블린 → 1: 기계 → 2: 천공 → 3: 골렘 → 4: 환영 → 5: 언데드
→ 6: 흡혈귀 → 7: 심해 → 8: 용암 → 9: 암흑 → 10: 맹독 → (12회: 다시 고블린)
```

### 클리어 누적 효과 — 모든 몬스터 HP +90%×N

`finishRealBossCombat()` 에서 `drainRatio === 1` 인 경우에만 `realBossClearCount += 1`.

`makeMonster()` 와 `makeRealBoss()` 가 이 값을 받아 HP 를 `× (1 + 0.9 × N)` 으로 스케일.

| 클리어 횟수 | HP 배수 | 효과 |
|---|---|---|
| 0 | ×1.0 | 기본 |
| 1 | ×1.9 | +90% |
| 2 | ×2.8 | +180% |
| 3 | ×3.7 | +270% |
| 10 | ×10.0 | +900% |

대상: 일반 몬스터, 챕터 보스, 미믹, 진짜 보스, PVP, 소환 미니언 — **모든 몬스터**.
플레이어 HP/스탯은 영향 없음.

---

## 전투

`RealBossChallenge.vue` → `Combat.vue` (단, mode = realboss):

- 도주 불가
- 다중 몬스터 없음 (1:1)
- 진행 중 자동 진입 / 4배속 동일 적용
- 광고 부활 불가 (도전이라 한 번뿐)
- 전투 종료 → `RealBossResult.vue`

---

## 보상 (`computeStartBonusFromDrain`)

```ts
drainRatio = (startHp - endHp) / startHp     // 0 ~ 1
permanentBonus = floor(60 * drainRatio)      // 0 ~ 60
```

| drainRatio | permanentBonus | 결과 |
|---|---|---|
| 0.0 | 0 | 보스에 한 대도 못 깎음 — 그래도 회귀 |
| 0.5 | 30 | 절반 깎음 — 30pt 영구 보너스 |
| 0.99 | 59 | 거의 다 깎음 — 59pt |
| 1.0 | 60 | 완전 클리어 — `realBossDefeated = true` 추가 |

**서사**: 깎은 비율만큼 시간의 신이 능력치를 부여한다 (= 회귀의 대가).

`permanentStartBonus` 는 다음 캐릭터 생성에 5스탯 균등 자동 분배 + 나머지 (`60 % 5 != 0`) 힘→민첩→체력→마력→행운 순.

---

## 완전 클리어 (`drainRatio === 1`) — 회귀 아님

```
meta.realBossDefeated = true
meta.totalGoldEarned = 0          // 다음 사이클 시작
introFlow = 'afterRealBoss'        // 인트로 t3 표시
screen = 'create'                  // 다음 캐릭터 생성으로
```

- `totalBonusStats` (누적 보너스 풀) **그대로 보존** — 회귀가 아니므로 다음 캐릭터도 누적 풀을 그대로 분배 가능
- `permanentStartBonus` 는 +60 으로 누적
- t3 (3번째 인트로 컷)가 잠금 해제되며 **진실이 공개** — 진짜 보스가 시간의 신을 공격 중, 게임 클리어 = 모두 격파

### 회귀 vs 완전 처치 차이

| 결과 | 누적 보너스 풀 (`totalBonusStats`) | `permanentStartBonus` | 다음 캐릭터 의미 |
|---|---|---|---|
| 회귀 (drainRatio < 1) | **리셋** (= 영혼이 다시 0부터) | + floor(60 × ratio) | 새로 시작 + 영구 보너스만 |
| 완전 처치 (drainRatio = 1) | **보존** | +60 | 누적 풀까지 그대로 — 게임 클리어 후 다음 사이클을 더 강하게 |

서사: 회귀하면 누적된 자아가 다시 0으로 돌아가지만, 회귀하지 않은 완전 처치는 자아가 다음 사이클로 그대로 이어진다.

---

## 사이클 반복

```
1차 진짜 보스 격파
  → realBossDefeated = true (서사 진행)
  → totalGoldEarned 리셋
  → 다음 100층 등반 사이클
  → 또 5만 누적 → 2차 진짜 보스 등장
  → ...
모두 격파 → 게임 클리어
```

각 진짜 보스마다 시간의 신을 공격하는 다른 적이며, 모두 처치 시 시간의 신을 구할 수 있다.

---

## 알려진 제약

- **사망 캐릭터 풀 미포함**: 현재 100층 클리어 캐릭터만 부활 가능 — 사망 케이스 추후 결정
- **광고 부활 불가**: 진짜 보스는 도전 모드라 한 번뿐
- **부활 캐릭터의 마지막 챕터 테마는 무시됨**: v7 부터 `REAL_BOSS_ORDER` 가 우선 — 부활 캐릭터의 무기/스탯은 그대로 쓰지만 보스 자체는 누적 클리어 횟수가 결정
