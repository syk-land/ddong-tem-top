# v10 밸런스 리밸런싱

> 한 번 플레이 길이 짧고 한 방에 끝나던 느낌을 완화 — 전투 템포 ¼, HP/MP 풀 ×2, 초반 보스 약화, 행운의 골드 보너스 제거.

코드: `src/screens/Combat.vue`, `src/core/character.ts`, `src/data/chapters.ts`, `src/stores/game.ts`

---

## 1) 전투 템포 — 1초당 10 tick

`BASE_INTERVAL` (Combat.vue) 60ms → **100ms**.

| 배속 | interval | tick/s | 비고 |
|---|---|---|---|
| 1× | 100ms | 10 | 변경 전 60ms·16.7 tick/s |
| 2× | 50ms  | 20 | |
| 4× | 25ms  | 40 | |
| 자동(5~999) | 10ms × ticksPerCall cap 8 | 800 max | cap 영향으로 변화 거의 없음 |

체감 = 1배속 기준 ≈ ⅔ 속도. HP ×2 와 합산하면 전투 1회 wall-clock ≈ **3.3배** (자동 모드는 영향 미미).

---

## 2) HP/MP 풀 ×2

`computeMaxHp / computeMaxMp` (character.ts):

```
체력 1pt = +20 HP (변경 전 +10),  baseline 100 (변경 전 50)
마력 1pt = +30 MP (변경 전 +15),  baseline 60  (변경 전 30)
```

일반 몬스터 baseline (`getNormalMonsterBaseline`):
```
hp = 100 + 12 × chapter   // 변경 전 50 + 6×chapter
```
보스 / 미믹 baseline 은 일반 baseline 에서 파생 → 자동 ×2 전파.

### 영향 표

| 카테고리 | 공식 | 변화 |
|---|---|---|
| 회복 스킬·회복샘·층 이동·selfDot | `maxHp × %` | 동일 |
| 방어율 | `def %` | 동일 |
| 흡혈(lifesteal) / 갑옷 흡수 | `finalDmg × pct` | dmg 절대값 그대로 → **HP풀 대비 효율 절반** |
| 무기 데미지·스킬 데미지 | 무기 dmg 그대로 | 절대 dmg 동일, 적 HP ×2 → **킬타임 ×2** |
| 시간당 골드 효율 | — | **약 절반** (의도) |

`scoreThresholds.ts` 등급 컷오프는 시뮬레이션 기준치라 ±5~10% 정도 어긋날 수 있으나 상대 순위는 유지.

---

## 3) 챕터 1~4 보스 약화

`EARLY_BOSS_SOFTNESS` (chapters.ts):

| chapter | hp 배율 | atk 배율 |
|---|---|---|
| 1 | 0.70 | 0.80 |
| 2 | 0.78 | 0.85 |
| 3 | 0.86 | 0.90 |
| 4 | 0.93 | 0.95 |
| 5+ | 1.00 | 1.00 |

5챕터 이상의 base 보스 + 6~10 챕터 hard 보스는 영향 없음 — 초반 진입 장벽만 완화.

---

## 4) 행운 골드 보너스 제거

`game.ts` `finishCombat` 의 보상 계산에서 다음 블록 삭제:

```ts
// 행운 보너스 — 제거됨
const luckBonus = 1 + (character.stats.행운 * 0.05)
reward = Math.round(reward * luckBonus)
```

행운 효과 항목:

| 항목 | 변경 전 | 변경 후 |
|---|---|---|
| 명중 / 회피 | 행운 × 0.1 | 동일 |
| 크리 배수 | 1.3 + 행운/100 | 동일 |
| 상태저항 | 행운 × 0.3 | 동일 |
| 스킬 발동률 | 보정 × (1 + 행운 × 0.5%) | 동일 |
| **골드 보너스** | **× (1 + 행운 × 5%)** | **제거** |

행운은 이제 전투 기여 스탯에 집중 — 골드는 챕터/몬스터 종류로만 결정.
