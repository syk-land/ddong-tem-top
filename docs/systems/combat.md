# 전투 시스템 (v9)

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
[Action Ready (게이지 ≥ 무기 ticks)]
   ├─ 각 ready 몬스터 행동 (monsterAttack)
   ├─ 플레이어 자동 행동 (playerAutoAct)
   ↓
[종료]
```

---

## 게이지 시스템 (v9)

```
player.actionGauge/tick = 1 × (1 + 민첩/100) × armorSpeedMult × speedModifier(player)
monster.actionGauge/tick = 1 × speedModifier(monster)

발동 임계값:
- 플레이어 = 무기 ticks (검 10 / 건틀릿 7 / 할버드 15 / ...)
- 몬스터 = m.ticks (일반 10 / 보스 8 / 미믹 12)

consumeAction(actor, threshold) → 게이지 -threshold (오버플로 보존)
```

`speedModifier` = 둔화/감전 상태이상 곱셈 (둔화 ×0.7 등).

---

## 명중 (v9)

```
플레이어 acc = 60 + 무기 + 트레잇 + 민첩×0.5 + 행운×0.1
플레이어 eva = 5  + 무기 + 트레잇 + 갑옷 evasion + 민첩×0.5 + 행운×0.1
적 acc = 30 + 챕터×3
적 eva = 5  + 챕터×1

성공률 = clamp((acc − eva) / 100, 0, 1.0)
```

명중/회피는 성공률만 결정. 데미지에는 영향 없음.

---

## 데미지 계산 (v9)

`computeDamage({공격력, 민첩, 행운, 관통}, {방어%}, opts)`:

```
실효방어% = max(0, 방어% − 관통%)   # 관통은 절대값 차감
hit = max(1, atk × multiplier × (1 − 실효방어%/100))

크리 굴림:
  확률 = clamp(민첩 × 0.003, 0, 1.0)
  배수 = 1.3 + 행운/100
  발동 시 dmg = round(hit × 배수)
```

옵션:
- `multiplier` — 스킬 배율 (스매쉬 2.0, 화염구 6.5, ...)
- `penBoost` — 관통 배율 (피어스 ×2.0)
- `ignoreCrit` — 크리 굴림 건너뜀

---

## 공격력 (v9.x 곱셈 모델)

```
물리 atk = physStat × baseAtk × coef × (1 + trait_atk_pct) × 3.0
마법 atk = 마력     × baseAtk × coef × (1 + trait_atk_pct) × 1.5 × magicSynergy

physStat:
- 대부분 무기 = 힘
- ranged (숏보우/롱보우/석궁) = 힘 + 민첩 × 0.3   ← v9.x

magicSynergy:
- 마법무기 + 로브 = 1.5   ← v9.x (기존 1.7)
- 그 외 = 1.0
```

마법 스킬 사용 시 `eff.마법공격력` 적용. 마법 공격자(적)는 플레이어 방어 절반만 적용.

---

## 방어% (v9.x)

```
방어% = baseDef × coef × (1 + trait_def_pct) + 체력 × 0.3 × coef   ← v9.x
받는 dmg = max(1, atk × (1 − 실효방어%/100))
```

상한 없음. 최소 데미지 1 보장. 갑옷 자동 반응이 추가 변형 가함(아래).

---

## 갑옷 자동 반응 (v9.x — 피격 시 발동)

`monsterAttack` 내 명중 굴림 성공 직후, 데미지 적용 전에 굴림.

```
발동률 = 0.10 + 행운 × 0.005
```

발동 시 갑옷 종류별 효과:

| 갑옷 | 효과 |
|---|---|
| 가죽갑 | 데미지 0 무효 (완전 회피, 로그 'miss') |
| 로브 | 데미지 50% 차감, 차감량만큼 MP 소모 (부족 시 부분 차감) |
| 판금 | 데미지 그대로 받음 + 평타 atk × 0.5 카운터 (방어 무시) |
| 중갑 | 자동 반응 없음 (speedMult 1.00 으로 보상) |

게이지 사이클의 무기 액티브 스킬과 별개 슬롯. 챌린지 `noActiveSkills` 와 무관하게 작동.

---

## 자동 행동 (playerAutoAct)

1. `pickAutoAction(ctx, opts)` 호출:
   - 무기/갑옷의 자동 스킬을 발동률에 따라 시도
   - 챌린지 `noActiveSkills` 면 평타 강제
   - 챌린지 `onlyActiveSkills` 면 스킬 강제
2. 스킬 발동 → `useSkill(ctx, key)`
3. 실패 시 fallback → 평타 `playerBasicAttack`

---

## 흡혈

장비 특성 `lifesteal` (%) 보유 시:
```
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

여러 적이 동시에 가지면 곱셈 누적.

---

## 종료 처리

`handleCombatEnd`:
1. 진짜 보스 모드 → `finishRealBossCombat` (결과 화면)
2. 일반 사망 → 게임 오버
3. 일반 승리 → 골드/드랍 → `advance()` (다음 층)

---

## 도주 (fleeCombat)

`도주했다...` 로그 + `combat.ended=true / victory=false`. 미믹 도주는 챌린지 위반 가능 (`trackKillAllMimics`).
