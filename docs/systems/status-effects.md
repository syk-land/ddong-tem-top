# 상태이상

코드: `src/data/statuses.ts`, `src/core/status.ts`

`StatusKind` = `'점화' | '둔화' | '감전' | '암흑' | '출혈' | '독' | '침묵'`

---

## 효과 표

| 종류 | 효과 | 부여 가능 출처 |
|---|---|---|
| 점화 | 매 틱 maxHp × 1% 화상 데미지, 최대 5스택 | 화염구, 용암 trait, 트레잇 burn_chance |
| 출혈 | 매 틱 maxHp × 0.8% 출혈, 3스택 누적 | 무기 트레잇 bleed_chance |
| 독 | 매 틱 maxHp × 0.6% 장기 도트 | 맹독 챕터, 트레잇 poison_chance |
| 둔화 | 속도 × 0.7 (지속 동안) | 빙결의화살, 바위충격, slow_chance |
| 감전 | 행동 게이지 -10 즉시 + 추가 데미지 | 번개창, shock_chance |
| 암흑 | 명중 -20 | 그림자일격(적용 시 적), blind_chance |
| 침묵 | 스킬 사용 불가 (silenceUntilTick 까지) | 일부 보스 trait |

---

## 부여 (`applyStatus`)

```ts
applyStatus(target, kind, chance, durationTicks)
```
- `chance` 만큼 굴려 성공 시 적용.
- `target.statuses[]` 에 `StatusEntry` push.
- 동종 누적은 스택 가산 (점화/출혈/독), 회피 가능 (행운/마력 기반 저항).

### 저항 (`stRes`)
- 체력 × 0.5 + 마력 × 0.5 + 행운 × 0.3 + 트레잇 상태저항 가산.
- `rollStatusResist(stRes)` 으로 회피 굴림.

### 반사 (트레잇)
갑옷 트레잇의 `reflect_burn` 등으로 부여자를 거꾸로 점화/둔화 등 부여 가능.

---

## 매 틱 처리 (`tickStatuses`)

`advanceTick` 매 호출 시 각 액터에 대해:
1. 각 상태이상의 잔여 틱 -1.
2. 도트형(점화/출혈/독)은 데미지 누적.
3. 만료된 상태 제거.

```ts
return {
  damageTaken: number,   // 이번 틱 총 도트 데미지
  dotEvents: { kind, stacks, dmg }[],  // 로그 표시용
}
```

---

## 정화 (`purgeDebuffs`)

`정화의광선` 스킬 사용 시 플레이어의 디버프(점화/둔화/감전/암흑/출혈/독) 모두 제거.

```ts
purged = purgeDebuffs(player) → 제거된 상태 수 반환
```

---

## 트레잇과 상태이상

무기 트레잇이 상태이상 부여:
- `burn_chance` (점화), `bleed_chance` (출혈), `poison_chance` (독)
- `slow_chance` (둔화), `blind_chance` (암흑), `shock_chance` (감전)

평타/스킬 적중 시 굴림 → 성공하면 적에게 적용.

갑옷 트레잇은 저항/반사:
- `resist_*` — 받을 확률 감소
- `reflect_*` — 부여자에게 거꾸로 부여
