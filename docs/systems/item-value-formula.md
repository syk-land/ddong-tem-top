# 장비 벨류 공식 (실측 기반 도출)

> climetop 의 무기/갑옷 전투력을 **단일 숫자**로 표현하는 공식 — 1500~15000 캐릭터 시뮬레이션으로 검증.
>
> 시뮬레이터: `src/core/__sim__/` (`dummyValue`, `pvpFormula`, `statCorrelation`, `bestFormula`)

## 결론 요약

| 지표 | 현재 `computeItemValue` | **신 구조식** | 개선 |
|---|---|---|---|
| 공격 R² (테스트) | 0.50 | **0.93** | +0.43 |
| 공격 MAPE | 35% | **12%** | −23%p |
| 방어 R² (테스트) | 0.26 | **0.96** | +0.70 |
| 방어 MAPE | 57% | **12%** | −45%p |

**핵심 영역 (총 스탯 ≤ 200, 실제 게임 사용 범위):**
- 공격 R² 0.94 / MAPE 11.6%
- 방어 R² 0.93 / MAPE 12.1%
- 예산 150·200 에선 MAPE 한 자리 (10%) 도달

## 1. 시뮬레이션 방법

### 1.1 더미 셋업 (`bestFormula.ts`)

```ts
ATK_DUMMY: { atkMod: 0, hpMod: 100000 }    // 절대 안 죽음, 공격 X → 순수 DPS 측정
DEF_DUMMY: { atkMod: 1.0, hpMod: 100000 }  // chapter 5 baseline 공격 (atk=14)
REF_CHAPTER: 5   → REF_ATK 14, REF_DEF 10%, REF_ACC 45, REF_EVA 10
```

### 1.2 실측 메트릭

- **공격 벨류 = DPS** = `(initial_dummy_hp − final_dummy_hp) / ticks` (TICKS=600)
- **방어 벨류 = effective HP** = `maxHp / (avg dmg/atk)` (ATTACKS=150)

### 1.3 검증 범위

- 1500 ~ 15000 랜덤 캐릭터 (스탯/무기/갑옷/등급/특성 모두 무작위)
- 훈련 60% / 테스트 40% 분리 — **과적합 없음 확인**
- 9개 스탯 빌드 × 8개 예산 (30 ~ 500) 교차 검증

## 2. 공격 벨류 공식

### 2.1 상수

```
REF_EVA = 10    # 적 회피
REF_DEF = 10    # 적 방어%
```

### 2.2 입력

| 변수 | 산출 |
|---|---|
| `공격력` | `stats.힘 × wbase.baseAtk × weapon.coef × (1 + atk_pct) × 3.0` |
| `마법공격력` | `stats.마력 × wbase.baseAtk × weapon.coef × 1.5 × magicSynergy` |
| `명중률` | `60 + wbase.accBonus + 트레잇.명중 + 민첩×0.5 + 행운×0.1` |
| `관통` | `wbase.penBonus + wbase.magicPenBonus + 트레잇.관통` |
| `크리확률` | `clamp(민첩 × 0.003, 0, 1)` |
| `크리배수` | `1.3 + 행운/100` |
| `게이지가속` | `1 + 민첩/100` |
| `armorSpeedMult` | 갑옷.speedMult × (로브+마법 = ×1.15) |
| `무기ticks` | `round(10 / wbase.speedCoef)` |

### 2.3 공식

```ts
// ── 평타 데미지 (항상 물리) ──
hit = clamp((명중률 − REF_EVA) / 100, 0, 1)
effDef = max(0, REF_DEF − 관통) / 100
basicDmg = max(1, 공격력 × (1 − effDef)) × hit

// ── 스킬 발동률 (등급/특성 보정 + MP 제약) ──
baseProc = WEAPON_SKILL_PROC[weapon.baseKey]   // 0.18 ~ 0.70
gradeMod = { 노말: +0.10, 레어: +0.05, 스페셜: 0, 레전드: −0.05 }
traitMod = { 하급: +0.05, 보통: 0, 희귀: −0.03, 특별: −0.05 }
procRaw = clamp((baseProc + gradeMod + traitMod) × (1 + 행운 × 0.005), 0.05, 0.85)

// MP 제약: maxMp / mpCost 번만 발동 가능
mpCost = skill.magic
       ? max(0, skill.mpCost + weaponMpBonus)   // 마법: 40~60
       : skill.mpCost                            // 물리: 6~10
attacksInSim = attacksPerTick × 600              // 시뮬 길이
idealProcs = attacksInSim × procRaw
effProc = procRaw × clamp(maxMp/mpCost / idealProcs, 0, 1)

// ── 스킬 데미지 ──
skillAtk = skill.magic ? max(마법공격력, 공격력) : 공격력
effMult = skill.luckBoost ? skill.mult × (1 + 행운 × skill.luckBoost)
                          : skill.mult
skillDmg = max(1, skillAtk × effMult × (1 − effDef)) × hit

// ── 평균 hit ──
avgHit = (1 − effProc) × basicDmg + effProc × skillDmg

// ── DPS ──
critBoost = 1 + 크리확률 × (크리배수 − 1)
attacksPerTick = 게이지가속 × armorSpeedMult / 무기ticks
dps = avgHit × critBoost × attacksPerTick

// ── 상태이상 DoT 기여 ──
luckMult = 1 + 행운 × 0.005
stackEst = 1.15

dotDps(chance, intensity, durTicks, dotInterval):
  c = clamp(weapon.effects[chance] × luckMult, 0, 0.95)
  uptime = clamp(c × attacksPerTick × durTicks, 0, 1)
  return uptime × 공격력 × intensity × stackEst / dotInterval

dps += dotDps('burn_chance',   0.15, 40, 10)    // 점화
     + dotDps('bleed_chance',  0.20, 20, 10)    // 출혈
     + dotDps('poison_chance', 0.08, 30, 10)    // 독

// 감전: 받는 dmg ×1.20
shockC = clamp(weapon.effects.shock_chance × luckMult, 0, 0.95)
shockUptime = clamp(shockC × attacksPerTick × 20, 0, 1)
dps *= 1 + shockUptime × 0.20 × stackEst

// 흡혈 (소폭 가산)
if (lifesteal > 0): dps *= 1 + lifesteal × 0.05

// ── 최종 ──
atkValue = K_atk × dps         // K_atk ≈ 0.96
```

### 2.4 스킬 정보

| 스킬 | mult | magic | mpCost | 특수 |
|---|---|---|---|---|
| 스매쉬 | 2.0 | × | 8 | |
| 피어스 | 1.0 | × | 6 | |
| 연속공격 | 1.4 | × | 10 | |
| 정밀타격 | 1.5 | × | 7 | crit ×2 |
| 급습 | 1.5 | × | 9 | `× (1 + 행운×0.03)` |
| 빙결의화살 | 2.2 | ✓ | 40 | |
| 화염구 | 6.5 | ✓ | 50 | |
| 폭풍칼날 | 1.05 | ✓ | 45 | (단일 대상 환산: 3히트 분산 → 0.7×1.5) |
| 바위충격 | 4.8 | ✓ | 55 | |
| 번개창 | 5.5 | ✓ | 45 | |
| 그림자일격 | 2.2 | ✓ | 50 | |
| 정화의광선 | 1.8 | ✓ | 60 | |

## 3. 방어 벨류 공식

### 3.1 상수

```
REF_ATK = 14    # 적 공격력 (chapter 5)
REF_ACC = 45    # 적 명중
```

### 3.2 공식

```ts
// ── 받는 명중 / 데미지 ──
hitRecv = clamp((REF_ACC − 회피율) / 100, 0, 1)
dmgIfHit = max(1, REF_ATK × (1 − 방어력_effective / 100))

// ── 갑옷 자동 발동 (combat.ts 와 동기화) ──
procChance = clamp(0.10 + 행운 × 0.005, 0, 1)   // 행운 460+ saturation 방지
armorProcMult = match(armor.baseKey):
  가죽갑   → max(0, 1 − procChance × 1.0)   // 완전 회피
  로브     → max(0, 1 − procChance × 0.5)   // 50% 차감
  판금/중갑 → 1.0

// ── 피해 흡수 trait ──
dmgPerAtk = hitRecv × dmgIfHit × armorProcMult × (1 − damageTakenHealPct)

// ── 흡혈로 인한 net dmg 차감 ──
//   monster 1공격 ~ 10ticks 동안 player 가 N회 반격 → 매번 dmg×lifesteal 만큼 회복
if (lifesteal > 0):
  playerAtks_perMonsterAtk = (10 / 무기ticks) × 게이지가속 × armorSpeedMult
  playerEffDef = max(0, REF_DEF − 관통) / 100
  playerDmgHit = max(1, 공격력 × (1 − playerEffDef))
               × clamp((명중률 − REF_EVA) / 100, 0, 1)
  heal_perMonsterAtk = playerAtks_perMonsterAtk × playerDmgHit × lifesteal
  netDmgPerAtk = dmgPerAtk − heal_perMonsterAtk
else:
  netDmgPerAtk = dmgPerAtk

// ── 적 디버프로 인한 받는 dmg 감소 ──
luckMult = 1 + 행운 × 0.005
stackEst = 1.15

// 둔화: 적 속도 −40% × stack
slowC = clamp(weapon.effects.slow_chance × luckMult, 0, 0.95)
slowUptime = clamp(slowC × attacksPerTick × 20, 0, 1)
monsterFreqMult = 1 − slowUptime × 0.40 × stackEst × 0.5

// 암흑: 적 명중 −25 × stack
blindC = clamp(weapon.effects.blind_chance × luckMult, 0, 0.95)
blindUptime = clamp(blindC × attacksPerTick × 30, 0, 1)
accReduce = blindUptime × 25 × stackEst
newHit = clamp((REF_ACC − accReduce − 회피율) / 100, 0, 1)
blindHitMult = hitRecv > 0 ? newHit / hitRecv : 1

// ── 최종 effective HP ──
defValue = K_def × maxHp / max(0.5, netDmgPerAtk × monsterFreqMult × blindHitMult)
                                                 // K_def ≈ 1.00
```

## 4. 검증 결과

### 4.1 예산별 적합도 (각 800개)

| 예산 | 공격 R² | 공격 MAPE | 방어 R² | 방어 MAPE | 평균 DPS | 평균 eHp |
|---|---|---|---|---|---|---|
| 30 | 0.943 | 12.8% | 0.958 | 10.6% | 4 | 51 |
| 60 | 0.929 | 13.2% | 0.931 | 12.4% | 10 | 94 |
| 100 | 0.929 | 11.9% | 0.908 | 13.6% | 20 | 168 |
| **150** | **0.956** | **10.0%** | 0.912 | 12.7% | 36 | 326 |
| **200** | **0.950** | **9.9%** | 0.922 | 11.2% | 59 | 572 |
| 300 | 0.937 | 9.6% | 0.894 | 4.2% | 134 | 1211 |
| 400 | 0.909 | 11.0% | 0.973 | 1.6% | 255 | 1700 |
| 500 | 0.855 | 12.3% | 0.969 | 1.5% | 419 | 2101 |

### 4.2 스탯 빌드별 적합도 (각 1000개)

| 빌드 | 공격 R² | 방어 R² |
|---|---|---|
| 균등 12 | 0.928 | 0.955 |
| 힘 몰빵 | 0.916 | 0.951 |
| **민첩 몰빵** | **0.976** | 0.868 |
| 체력 몰빵 | 0.928 | 0.966 |
| 마력 몰빵 | 0.772 | 0.948 |
| 행운 몰빵 | 0.905 | 0.897 |
| 힘+민첩 | 0.940 | 0.945 |
| 마력+행운 | 0.829 | 0.909 |
| 체력+힘 | 0.929 | 0.957 |

## 5. 핵심 개선 포인트 (현재 `itemValue.ts` 대비)

| 항목 | 현재 | 신 구조식 |
|---|---|---|
| 평타 atk_stat | 마법무기→마법공격력 | **항상 물리 공격력** |
| 스킬 발동률 | weapon별 고정 | **+ 등급/특성 보정** |
| MP 제약 | 미반영 | **maxMp/mpCost 번만 발동** |
| weaponMpBonus | 미반영 | 완드 -3 / 마도서 +3 |
| 갑옷 자동발동 | 일률적 | **가죽갑/로브 별 multiplier + 행운 클램프** |
| 흡혈 (방어) | 단순 가산 | **netDmgPerAtk 차감 (player 반격 회복)** |
| 상태이상 DoT | 단순 0.4× 가중 | **uptime × atk × intensity / interval (정확)** |
| 적 디버프 (둔화/암흑) | 미반영 | **defValue 의 monsterFreqMult / blindHitMult** |
| 자동 스킬 행운 보너스 | 미반영 | **급습 × (1 + 행운×0.03)** |
| 광역/연쇄 스킬 | 광역 mult 그대로 | **단일 대상 환산 (폭풍 3.15→1.05)** |

## 6. 한계 및 추가 개선 여지

1. **마력 빌드 공격 R²=0.77** — 마법 스킬 광역/연쇄/MP 회복 동역학 단순화
2. **고예산 (>300) 영역** — 회피율>적명중, 방어%>100% saturation으로 R² 의미 약화 (단 MAPE는 안정)
3. **상태이상 stack 동역학** — refresh/decay 단순화 (`stackEst = 1.15`)
4. **로브+마법무기 시너지** — magicSynergy=1.5 는 stats.ts에 이미 적용되어 있어 별도 항 불필요

## 7. 실행 방법

```bash
npm run sim:dummy      # 등급별 더미 검증
npm run sim:pvp        # PvP 공식 탐색
npm run sim:corr       # 능력치-벨류 상관 분석 (CORR_N 환경변수로 표본수)
npm run sim:formula    # 최종 공식 검증 (TRAIN_N/TEST_N/BUDGET_N 환경변수)
```

## 8. 부록: 시뮬레이터 파일

| 파일 | 역할 |
|---|---|
| `src/core/__sim__/dummyValue.ts` | 등급별 더미 검증 (atkValue/defValue vs 실측 DPS/DR) |
| `src/core/__sim__/pvpFormula.ts` | 캐릭터 vs 캐릭터 PvP 6개 후보 공식 평가 |
| `src/core/__sim__/statCorrelation.ts` | 30+ feature × DPS/eHp Pearson 상관 분석 |
| `src/core/__sim__/bestFormula.ts` | 최종 공식 도출 + 예산/빌드별 적합도 검증 |
