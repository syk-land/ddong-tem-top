# 스탯 시스템

> 5스탯(힘/민첩/체력/마력/행운) → 실효 스탯 변환. 곱셈 모델(v9.x).

코드: `src/core/stats.ts`

---

## 5스탯과 파생 효과

| 스탯 | 영향 |
|---|---|
| **힘 (STR)** | 물리 공격력 `= STR × baseAtk × coef × (1+trait_atk_pct) × 3.0` |
| **민첩 (AGI)** | 게이지 가속 `1 + AGI/100` · 명중/회피 `+AGI×0.5` · 크리율 `clamp(AGI × 0.003, 0, 1.0)` |
| **체력 (CON)** | 최대 HP `= CON×10 + 50` · 방어% `+CON × 0.3 × armorCoef` · 상태저항 `+CON×0.5` |
| **마력 (MAG)** | 최대 MP `= MAG×15 + 30` · 마법 공격력 `= MAG × baseAtk × coef × (1+trait_atk_pct) × 1.5 × magicSynergy` · 상태저항 `+MAG×0.5` |
| **행운 (LUCK)** | 크리 배수 `+LUCK/100` · 명중/회피 `+LUCK×0.1` · 상태저항 `+LUCK×0.3` · 스킬 발동률 `× (1 + LUCK × 0.005)` |

`magicSynergy = (로브 + isMagic 무기) ? 1.5 : 1.0`
**활 무기** (`category === 'ranged'`): `physStat = STR + AGI × 0.3` 로 대체 (민첩 빌드 활용처).

---

## 명중 / 회피

```
플레이어 acc = 60 + weaponAccBonus + traitAcc + AGI × 0.5 + LUCK × 0.1
플레이어 eva = 5  + weaponEvaBonus + traitEva + armorEvasion + AGI × 0.5 + LUCK × 0.1
적 acc      = 30 + 챕터 × 3
적 eva      = 5  + 챕터 × 1
명중률      = clamp((acc − eva) / 100, 0, 1.0)
```

상태이상 보정(암흑 명중 -25 등)은 `combat.ts` 에서 별도 누적.

---

## 크리티컬

```
크리 확률 = clamp(AGI × 0.003, 0, 1.0)        // 민첩 333 = 100%
크리 배수 = 1.3 + LUCK / 100                    // 행운 50 = 1.8배
크리 데미지 = max(1, atk × (1 − def%)) × 크리 배수
```

---

## 방어%

```
방어% = baseDef × coef × (1 + trait_def_pct) + CON × 0.3 × armorCoef
실효방어% = max(0, 방어% − 관통%)
받는 데미지 = max(1, atk × (1 − 실효방어% / 100))
```

체력 방어 기여(`CON × 0.3`)에도 등급 coef 가 적용되어, 같은 체력이라도 좋은 갑옷일수록 더 큰 방어로 변환된다 (v9.x 변경점).

---

## 시작 스탯 풀

| 항목 | 값 |
|---|---|
| 균등 시작 | 12 / 12 / 12 / 12 / 12 (총 60pt) |
| 주사위 굴림 | 5스탯에 60pt 랜덤 분배 (각 최소 0) |
| 굴림 횟수 | 캐릭터 생성당 3회 |
| 누적 보너스 풀 | `totalBonusStats` (영구), 자유 분배 |
| 영구 시작 보너스 | `permanentStartBonus` (진짜 보스 보상), 5스탯 균등 자동 분배 |

시작 무기/갑옷에 따른 추가 보정은 `getMaxHp / getMaxMp / getAttackPower` 등 `stats.ts` 함수에서 직접 합산.
