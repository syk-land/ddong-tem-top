# 스탯 시스템 (v6)

## 5스탯 (`StatKey`)
| 스탯 | 의미 | 시작값 |
| --- | --- | --- |
| **힘** | 공격력, 관통 | 10 |
| **민첩** | 속도, 명중, 회피 | 10 |
| **체력** | 방어력, HP, 상태저항(절반) | 10 |
| **마력** | MP, 마력계수, 상태저항(절반) | 10 |
| **행운** | 크리/스킬 발동률/보상/이벤트 + 명중/회피/관통/저항 가산 | 10 |

총 시작 50pt (5스탯 × 10).

`RANDOM_STAT_KEYS`: 5스탯 모두 주사위 분배 대상.

## 파생 효과 (`computeEffectiveStats`)
```
공격력      = 힘 × 5.0 + 무기 종합
관통        = 힘 × 0.5 + 행운 × 0.3 + 무기 penBonus + magicPenBonus
속도        = 민첩 × (1 + 트레잇 속도%) × 갑옷 speedMult × 무기 speedCoef
명중        = 민첩 × 0.5 + 행운 × 0.3 + 무기/갑옷 명중 + 무기 accBonus
회피        = 민첩 × 0.5 + 행운 × 0.3 + 무기/갑옷 회피 + 갑옷 evasion
방어력      = 체력 × 5.0 + 갑옷 종합
HP_max      = 체력 × 10 + 50
상태저항    = 체력 × 0.5 + 마력 × 0.5 + 행운 × 0.3 + 트레잇 저항
MP_max      = 마력 × 15 + 30
마력계수    = clamp(1 + (마력 + 장비 마력 보너스 - 15) × 0.05, 0.1, 1.8)
마법공격력  = (힘 × 5.0 + 무기 weaponAtkCoef) × 마력계수
```

### 무기 / 갑옷 종합 공격력 / 방어력
```
weaponAtkCoef = baseAtk × (coef + 트레잇 공격력%_base + 전스탯%_base)
armorDefCoef  = baseDef × 2.0 × (coef + 트레잇 방어력%_base + 전스탯%_base)
```
- `coef`: 등급별 고정값 (노말 1 / 레어 2 / 스페셜 4 / 레전드 6)
- 트레잇 atk%/def%/전스탯_pct는 *unscaled* — 공격력/방어력 공식에 직접 합산
- 그 외 트레잇 효과(명중/회피/lifesteal/상태이상 chance 등)는 coef-scaled 값 사용

## 행운의 영향
- **크리티컬률** = 행운 × 0.02 (대략, 2% per pt)
- **스킬 발동률** = base × (1 + 행운 × 0.025)
- **보상 보너스** = 1 + 행운 × 0.05
- **특별 이벤트 성공률** (룰렛, 대장장이 등) 행운 영향
- **명중/회피/관통/저항** 각 행운 × 0.3 가산

## 장비/트레잇 영향
v6에서 장비는 스탯 직접 변동 없음. 모든 효과를 derive된 파생값에 가산 (합연산).
- 무기 baseAtk → 공격력
- 갑옷 baseDef → 방어력
- 트레잇 `공격력_pct/방어력_pct` → 공격력/방어력 종합 공식
- 트레잇 `명중/회피/행운/관통/상태저항/마력` → 해당 파생에 가산
- 갑옷 mpBonus → 마력계수에만 영향 (스탯 마력은 그대로)

## 관련 파일
- `src/types/index.ts` — `StatKey`, `RANDOM_STAT_KEYS`
- `src/core/stats.ts` — `EffectiveStats`, `computeEffectiveStats`
- `src/core/character.ts` — `computeMaxHp`, `computeMaxMp`, `uniformStartingStats`, `generateRandomStats`

밸런스 수치는 [balance.md](../balance.md) 참조.
