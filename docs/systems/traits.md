# 트레잇 시스템

## 개요
모든 아이템은 1개의 트레잇(접두사)을 가진다. 트레잇이 아이템의 핵심 성격(공격력 추가, 출혈 부여, 흡혈, 자해 등)을 결정.

## 두 카테고리
- `WEAPON_TRAITS` — 무기 전용 (공격/스킬/상태이상 부여)
- `ARMOR_TRAITS` — 갑옷 전용 (방어/회피/저항/반사)

## 트레잇 티어
| 티어 | 효과 강도 | 예시 |
| --- | --- | --- |
| **하급** | 보통 ~10% | 평범한, 무거운 |
| **보통** | ~25% | 단단한, 날카로운 |
| **희귀** | ~50% | 화염의, 흡혈의 |
| **특별** | ~80~100% | 신성한, 저주의, 폭풍의 |

## 효과 종류 (`TraitEffect`)
- **퍼센트형**: `공격력_pct / 방어력_pct / 속도_pct / 전스탯_pct`
- **가산형**: `명중 / 회피 / 행운 / 관통 / 상태저항 / 마력`
- **특수**: `lifesteal / self_dot_pct / vs_undead_pct`
- **상태이상 부여 확률**: `burn_chance / bleed_chance / poison_chance / slow_chance / blind_chance / shock_chance`
- **갑옷 전용**:
  - 반사: `reflect_burn / reflect_bleed / ...`
  - 피격 회복: `damage_taken_heal_pct`
  - 저항 감소: `resist_burn / resist_bleed / ...`

## 스케일링
트레잇 정의 시 등록된 효과는 **unscaled base 값**.  실제 아이템 인스턴스의 `effects`는 `coef`(등급계수)에 곱해진 값이 저장됨 (`scaleEffects`).

예외: `공격력_pct / 방어력_pct / 전스탯_pct`는 *unscaled*로 그대로 사용. v4 가산식 공식에서 `base × (coef + trait%_base)` 형태로 직접 합산.

## 트레잇 예시 (대표 5종)
| 이름 | 슬롯 | 특수 효과 |
| --- | --- | --- |
| 화염의 | 무기 | `burn_chance: 0.3` — 피격 시 30% 점화 |
| 흡혈의 | 무기 | `lifesteal: 0.25` — 데미지 25% HP 회복 |
| 저주의 | 무기 | `self_dot_pct: 0.05` 고정 — 본인 매 10틱 HP 5% 손실 |
| 단단한 | 갑옷 | `방어력_pct: 0.3` — 종합 방어 +30% |
| 신성한 | 갑옷 | `vs_undead_pct: 0.5` — 언데드 추가 데미지 |

## 챌린지 상호작용
- "저주의 동반자" — 저주의 무기를 절대 제거 안 해야 클리어 보상 (제거 시 챌린지 실패)
- 일부 챌린지가 특정 트레잇 장착 금지 / 강제 (`canEquipItem`)

## 관련 파일
- `src/data/traits.ts` — 모든 트레잇 정의
- `src/types/index.ts` — `TraitEffect`, `TraitDef`, `TraitTier`
- `src/core/items.ts` — `scaleEffects` (coef 적용)
- `src/core/stats.ts` — `computeEffectiveStats` (효과 합산)
