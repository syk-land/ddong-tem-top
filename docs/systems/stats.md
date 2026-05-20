# 스탯 시스템 (v6 — 5스탯)

> 캐릭터의 5개 기본 스탯에서 모든 파생 스탯이 산출. 장비/특성은 derive 결과에 가산.

코드: `src/core/stats.ts` — `computeEffectiveStats()`

---

## 5스탯

| 스탯 | 기본값 | 주요 파생 | 비고 |
|---|---|---|---|
| **힘** | 10 | 공격력 × 5.0, 관통 × 0.5 | 물리 데미지 핵심 |
| **민첩** | 10 | 속도 × 1.0, 명중 × 0.5, 회피 × 0.5 | 게이지 누적 속도 |
| **체력** | 10 | 방어력 × 5.0, HP (10×체력 + 50), 상태저항 × 0.5 | 탱킹 |
| **마력** | 10 | MP (15×마력 + 30), 마력계수, 상태저항 × 0.5 | 마법 데미지 배율 |
| **행운** | 10 | 명중/회피/관통/상태저항 각 ×0.3 가산, 크리, 발동률 보정 | 광역 보정 |

기본 시작 = 모두 10 (총 50pt). 주사위 굴리면 5스탯에 50pt 랜덤 분배 (각 최소 3, 최대 20).

---

## 파생 공식

```ts
atkBase    = 힘   × 5.0
penBase    = 힘   × 0.5 + 행운 × 0.3
speedBase  = 민첩 × 1.0
accBase    = 민첩 × 0.5 + 행운 × 0.3
evaBase    = 민첩 × 0.5 + 행운 × 0.3
defBase    = 체력 × 5.0
resistBase = 체력 × 0.5 + 마력 × 0.5 + 행운 × 0.3
```

### 최종값 (장비/특성 반영)
```ts
// 공격력
weaponAtkCoef = 무기 baseAtk × (무기 등급계수 + 특성 공격력%)
finalAtk = atkBase + weaponAtkCoef

// 방어력
armorDefCoef = 갑옷 baseDef × 2 × (갑옷 등급계수 + 특성 방어력%)
defEff = defBase + armorDefCoef

// 속도 — 갑옷 speedMult × 무기 speedCoef 포함
speedEff = speedBase × (1 + 속도%_특성) × 갑옷 speedMult × 무기 speedCoef

// 명중/회피
acc = accBase + 무기 accBonus + 특성 명중
eva = evaBase + 갑옷 evasion + 특성 회피

// 관통 (물리 + 마법 통합)
pen = penBase + 무기 penBonus + 무기 magicPenBonus + 특성 관통

// 상태저항
stRes = resistBase + 특성 상태저항
```

### 마법공격력 / 마력계수
```ts
totalMagicStat = 마력 + 갑옷 mpBonus(base + trait) + 무기 trait 마력
magicCoef = clamp(1 + (totalMagicStat - 15) × 0.05, 0.1, 1.8)
finalMagicAtk = (atkBase + weaponAtkCoef) × magicCoef
```

> 마법 무기 평타 + 마법 스킬은 `finalMagicAtk` 사용.
> 물리 무기 평타 + 물리 스킬은 `finalAtk` 사용.

---

## HP / MP

```ts
maxHp = 10 × 체력 + 50      // 체력 10 → 150
maxMp = 15 × 마력 + 30      // 마력 10 → 180
```

챌린지 `mpCapFixed` (유지력 상실) 적용 시 maxMp = 30 고정.

---

## 크리티컬

```ts
crit_chance = 5 + 행운 × 0.5   // %, max 50
crit_multiplier = 2            // 스킬에서 override 가능 (정밀타격 등)
```

---

## 명중 / 회피

```ts
hit_chance = clamp(60 + (명중 - 회피_적), 5, 95)  // %
```

스킬에 따라 명중 가산 (정밀타격 +30, 폭풍칼날 +50 등).

---

## v6 시너지

### 로브 + 마법 무기
- 갑옷이 로브이고 무기가 마법 무기일 때, 추가 속도 ×1.15. (`stats.ts:95`)
