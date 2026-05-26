# 전투 시스템 (v9.x)

> 게이지 누적 자동 턴제. 1 tick = 가장 작은 시간 단위.

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
   ├─ 상태이상 처리 (DoT, 모디파이어 적용)
   ├─ 자해 (저주 특성 매 10틱)
   ├─ 버프 만료 카운트
   ├─ 게이지 누적
   ├─ 사망 체크
   ↓
[Action Ready (게이지 ≥ 무기 ticks)]
   ├─ 각 ready 몬스터 행동 (monsterAttack)
   ├─ 플레이어 자동 행동 (playerAutoAct)
   ↓
[종료 조건]
   ├─ 플레이어 사망 → GameOver
   └─ 모든 몬스터 사망 → 보상 → Dungeon
```

---

## 게이지 시스템 (v9)

```
plr 누적/틱 = 1 × (1 + AGI/100) × armorSpeedMult × speedModifier(plr)
mon 누적/틱 = 1 × speedModifier(mon)
공격 발동: 게이지 ≥ weaponTicks
  • 적 일반: 10틱
  • 적 보스: 8틱
  • 미믹:    12틱
발동 후: 게이지 -= weaponTicks
```

`speedModifier` 는 둔화 상태이상 등으로 변동 (≥ 0.10).

---

## 데미지 공식 (곱셈 모델, v9)

### 공격력

```
물리 atk = physStat × baseAtk × coef × (1 + trait_atk_pct) × ATK_K_PHYS
마법 atk = MAG      × baseAtk × coef × (1 + trait_atk_pct) × ATK_K_MAGIC × magicSynergy

physStat = STR                       // 대부분 무기
         = STR + AGI × 0.3           // ranged (활)

ATK_K_PHYS   = 3.0
ATK_K_MAGIC  = 1.5
magicSynergy = (로브 + isMagic 무기) ? 1.5 : 1.0
```

### 방어 & 피해

```
방어% = baseDef × coef × (1 + trait_def_pct) + CON × 0.3 × armorCoef
실효방어% = max(0, 방어% − 관통%)
받는 데미지 = max(1, atk × (1 − 실효방어% / 100))
```

상한 없음. 최소 데미지 1 보장.

### 명중률 / 크리

[stats.md](stats.md) 참고.

```
명중률      = clamp((acc − eva) / 100, 0, 1.0)
크리 확률   = clamp(AGI × 0.003, 0, 1.0)
크리 배수   = 1.3 + LUCK / 100
```

---

## 갑옷 자동 반응 (피격 시)

피격 직후 굴림 — 별도 게이지 없음. 무기 액티브 스킬 슬롯을 차지하지 않는다.

```
발동률 = 0.10 + LUCK × 0.005      // 행운 20 → 20% / 행운 40 → 30%
```

| 갑옷 | 효과 |
|---|---|
| **가죽갑** (회피) | 데미지 0 무효 (완전 회피) |
| **로브** (방어) | 데미지 50% 차감 + 차감량만큼 MP 소모 (MP 부족 시 가능한 만큼만) |
| **판금** (철벽) | 데미지 그대로 받음 + 공격자에게 `평타 atk × 0.5` 카운터 반사 (방어 무시) |
| **중갑** | 자동 반응 없음 — 대신 `speedMult` 가 1.00 (페널티 없음) |

챌린지 `noActiveSkills` 와 무관하게 작동 (피격 반응형).

---

## 흡혈 / 자해 / 회복 간섭

- **흡혈** (`lifesteal`): `회복 = max(1, 데미지 × lifesteal)` — 특성/보스 trait
- **자해** (`self_dot_pct`): 매 10틱마다 `maxHp × self_dot_pct` 자기 피해
- **회복 간섭** (몬스터 trait):
  - `heal_reduction` (구울): 회복 ×0.5
  - `heal_pollution` (역병 쥐): 회복 ×0.3
  - `heal_reverse` (맹독 보스): 회복이 피해로 전환

---

## 행동 우선순위 (Action Ready 시)

플레이어 `playerAutoAct`:
1. 무기 액티브 스킬 발동 굴림 (`buildBalance.ts`)
   - MP 부족 / 챌린지 `noActiveSkills` → 평타로 폴백
2. 굴림 실패 → 평타

몬스터 `monsterAttack`:
1. trait 우선 (소환/차징/특수 공격)
2. 평타

플레이어 공격 시 `currentTarget` (살아있는 적 중 첫 번째) 자동 선택.
다중 몬스터는 배열로 관리되며 일부 스킬(화염구/바위충격)은 광역 스플래시.

---

## 상태이상 적용 / 처리

매 틱 `tickStatuses` 가 각 상태에 대해:

1. DoT 간격 도달 시 데미지 산정 → 가해
2. 지속시간 -1
3. 0 도달 시 제거

자세한 수치는 [status-effects.md](status-effects.md).
