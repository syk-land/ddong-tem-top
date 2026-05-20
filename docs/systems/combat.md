# 전투 시스템

> 게이지 누적 자동 턴제. 1 ms = 1 tick.

코드: `src/core/combat.ts`, `src/core/skills.ts`

---

## 전투 흐름

```
[Combat 시작]
   │
   ├─ createCombatContext(player, monsters)
   │   └─ 각 몬스터의 onSpawn trait 발화 (HP/스탯 보정 등)
   │
   ↓
[매 틱 (advanceTick)]
   ├─ 플레이어 상태이상 처리 (점화/출혈 등 DoT)
   ├─ 각 몬스터 상태이상 + tick-trait
   ├─ 자해 (저주 특성, 매 10틱)
   ├─ 버프 만료 카운트
   ├─ 게이지 누적 (플레이어 + 몬스터)
   ├─ 사망 체크
   ↓
[Action Ready (게이지 ≥ 100)]
   ├─ 각 ready 몬스터 행동 (monsterAttack)
   ├─ 플레이어 자동 행동 (playerAutoAct)
   │     └─ 무기 자동스킬 시도 → 실패 시 평타
   ↓
[종료 (ended=true)]
   ├─ 승리 (모든 적 사망) → handleCombatEnd
   └─ 패배 (player.hp 0) → handleCombatEnd
```

---

## 게이지 시스템

매 틱:
```ts
player.actionGauge += speedEff × speedModifier(player)
for m in 살아있는 몬스터:
  m.actionGauge += m.speed × speedModifier(m)
```

`speedModifier` = 둔화/감전 상태이상 곱셈 (둔화 ×0.7 등).

게이지 ≥ 100 → 행동. `consumeAction`으로 -100.

---

## 데미지 계산

`computeDamage(attacker_stats, target_stats, opts)`:

```ts
base = max(1, 공격력 × multiplier × penBoost - 방어 × max(0.3, 1 - 관통/100))
isCrit = roll(crit_chance)
dmg = isCrit ? base × 2 : base
```

옵션:
- `multiplier` — 스킬 배율 (스매쉬 2.0, 피어스 1.0, ...)
- `penBoost` — 관통 배율 (피어스 ×2.0)
- `critMultiplier` — 크리 배율 override (정밀타격 ×2 추가)

---

## 마법 공격

플레이어가 마법 스킬 사용 시:
- 공격력으로 `eff.마법공격력` 사용 (= finalAtk × magicCoef)
- 적이 마법 받으면 **방어력 절반만 적용** (`combat.ts:300` S1-Q1 결정)

---

## 자동 행동 (playerAutoAct)

1. `pickAutoAction(ctx, opts)` 호출:
   - 무기/갑옷의 자동 스킬을 발동률에 따라 시도
   - 챌린지 `noActiveSkills` (조급증/평화주의자)면 평타 강제
   - 챌린지 `onlyActiveSkills` (스킬미학)면 스킬 강제
2. 스킬 발동 → `useSkill(ctx, key)`
3. 실패 시 fallback → 평타 `playerBasicAttack`

---

## 평타 (playerBasicAttack)

```ts
target = currentTarget(ctx)
if (!rollHit(eff.명중률)) → "공격이 빗나갔다." 종료
{ dmg, isCrit } = computeDamage(...)
target.hp -= dmg
흡혈, 자해, trait dispatch
```

---

## 흡혈

장비 특성 `lifesteal` (%) 보유 시:
```ts
heal = applyHealing(ctx, round(dmg × lifesteal))
player.hp += heal
```

`applyHealing`은 적의 회복 간섭 trait (heal_reduction/pollution/reverse) 반영.

---

## 회복 간섭 (적 trait)

| trait | 효과 |
|---|---|
| `heal_reduction` (구울) | 회복 ×0.5 |
| `heal_pollution` (역병 쥐) | 회복 ×0.3 |
| `heal_reverse` (보스) | 회복이 피해로 전환 (×-1) |

여러 적이 동시에 가지면 곱셈 누적. `core/combat.ts:applyHealing`.

---

## 종료 처리

`handleCombatEnd` (store/game.ts:1206):
1. 진짜 보스 모드 → `finishRealBossCombat` (결과 화면)
2. 일반 사망 → 게임 오버
3. 일반 승리 → 골드/드랍 → `advance()` (다음 층)

골드 보상 (`computeChapterGoldTarget(chapter) / 7`) × 변동:
- 보스: target × 2.5/7
- 미믹: 200 × chapter
- 일반: target × 0.85/7 × 몬스터수 × 0.85
- ±20% 변동, 행운 × 5% 가산

---

## 도주 (fleeCombat)

`도주했다...` 로그 + `combat.ended=true / victory=false`. 미믹 도주는 챌린지 위반 가능 (`trackKillAllMimics`).
