# 몬스터 trait 시스템

> 몬스터별 고유 행동/패시브. 매 틱/피격/사망/HP 임계마다 발동.

코드: `src/core/monsterTraits.ts` — `MONSTER_TRAITS: Record<string, TraitDef>`

---

## TraitDef 구조

```ts
interface TraitDef {
  isMagic?: boolean   // 마법 공격자 여부 (방어 무력화 등)
  onSpawn?: (p) => void
  onTickStart?: (p) => void
  onAfterAttacked?: (p) => void  // 피격 직후 (반사/카운터)
  onHpThreshold?: (p) => void    // HP 임계 통과 (광폭화/부활)
  onDeath?: (p) => { revived?: boolean }  // 부활 가능
}
```

`p` = `TraitParams { ctx, monster, damage?, isMagic?, isPhysical? }`.

---

## 대표 trait

### 회복 간섭
| trait | 효과 |
|---|---|
| `heal_reduction` | 플레이어 회복 × 0.5 (구울) |
| `heal_pollution` | 플레이어 회복 × 0.3 (역병 쥐) |
| `heal_reverse` | 플레이어 회복이 피해로 전환 (보스급) |

### 부활
| trait | 효과 |
|---|---|
| `revive_chance` | 사망 시 30~50% 확률로 HP 일부 복구 후 재기동 (좀비) |

### 광폭화
| trait | 효과 |
|---|---|
| `last_stand` | HP 30% 이하 시 공격력 × 1.5 + 속도 × 1.3 (기계 보스) |
| `berserk_low_hp` | HP 50% 이하 시 광폭화 |

### 카운터/반사
| trait | 효과 |
|---|---|
| `dispel_buff` | 피격 시 플레이어 활성 버프 1개 정화 |
| `counter_attack` | 피격 시 즉시 반격 (속도 우회) |
| `thorns` | 받은 피해의 N% 반사 |

### 광역/지속
| trait | 효과 |
|---|---|
| `aura_burn` | 매 틱 플레이어에게 점화 굴림 (용암 챕터) |
| `aura_blind` | 매 틱 암흑 굴림 (암흑 챕터) |
| `aura_poison` | 매 틱 독 굴림 (맹독 챕터) |
| `aura_slow` | 매 틱 둔화 굴림 (심해 챕터) |

### 회피/방어
| trait | 효과 |
|---|---|
| `phantom_dodge` | 일정 확률로 공격 무효 (환영) |
| `armored` | 받는 피해 -N% |
| `magic_resist` | 마법 피해 -N% |

### 드랍/보상 조작
| trait | 효과 |
|---|---|
| `item_block` | 보스/몬스터 처치 시 아이템 드랍 차단 (그리폰) |
| `gold_thief` | 사망 시 플레이어 골드 일부 탈취 |

---

## 디스패치

`combat.ts` 에서 적절한 시점에 호출:

| 시점 | 호출 |
|---|---|
| `createCombatContext` 시작 시 | `dispatchOnSpawn` |
| `advanceTick` 매 틱 | `dispatchOnTickStart` (각 몬스터별) |
| 피격 후 | `dispatchOnAfterAttacked(ctx, target, dmg, {isMagic, isPhysical})` |
| HP 임계 통과 | `dispatchOnHpThreshold(ctx, target)` |
| 사망 직전 | `dispatchOnDeath(ctx, monster)` → `{revived?: boolean}` |

---

## 마법 공격자 (`isMagic: true`)

몬스터의 공격이 마법 판정이면:
- 플레이어 방어력 절반만 적용
- 플레이어의 마법 저항 트레잇 (`magic_resist`) 적용

각 보스/주술사 계열에 `isMagic: true` 설정.

---

## 보스 trait 확장

후반 챕터(7~10) 강화 보스는 여러 trait 동시 보유 가능:
- 기계 마지막: `last_stand` + `armored` + `magic_resist`
- 천공 마지막: `phantom_dodge` + `aura_blind` + `counter_attack`

`data/chapters.ts` 의 `MonsterTemplate.trait` 필드로 지정.

---

## 검증

`validateMonsterTraitKeys(allTraitKeys)` — chapters.ts 에서 사용하는 모든 trait 키가 MONSTER_TRAITS 에 등록돼 있는지 검사. 누락 시 missing[] 반환 (dev 모드에서 호출측이 처리).
