# 전투 시스템

## 기본 흐름
턴제가 아닌 **틱 기반 액션 게이지** 방식. 매 틱마다 모든 유닛의 액션게이지가 (각자 속도만큼) 증가하고, 100에 도달한 유닛이 행동.

```
loop:
  advanceTick(combat)         # 모든 유닛 actionGauge += speed, tick++
  ready = checkActionReady(combat)
  for monster in ready.readyMonsters:
    monsterAttack(combat, monster)
    consumeAction(monster)    # gauge -= 100
  if player.actionGauge >= 100:
    playerAutoAct(combat)
    consumeAction(player)
  if 모두 사망 / 플레이어 사망:
    handleCombatEnd
```

## 자동 행동 (`pickAutoAction`)
플레이어 액션게이지 100 도달 시:
1. 무기 자동 스킬이 발동률(`computeWeaponSkillProc`) 패스하면 → 스킬
2. 그 외 보유 스킬 중 MP 충분한 것 확률 픽업
3. 모두 실패 시 평타
4. MP 부족 등 fallback도 평타

도전/챌린지 가드:
- `isActiveSkillForbidden`이 true → 평타만
- `isBasicAttackForbidden`이 true → 강제 스킬

## 무기 자동 스킬 발동률
```
proc = baseProc × luckMultiplier × challenge modifiers
baseProc는 무기 종류 / 트레잇에 따라 다름 (대략 5~25%)
luckMultiplier = 1 + 행운 × 0.025 (clamp)
```
`computeWeaponSkillProc(character, luck)` 참조.

## 데미지 공식 (대략)
```
물리 데미지 = max(1, atk × 스킬계수 - 적.def × max(0, 1 - 관통/적.def))
크리티컬 = 행운/100 + 스킬계수 보너스 → 1.5~2.0x
회피: 적.회피 vs 자.명중 → miss
상태이상: 트레잇 chance % 확률로 시전
```
(정확한 공식은 `src/core/combat.ts` 의 `playerBasicAttack`, `monsterAttack`, `applyDamage` 참고)

## 전투 종료
- 모든 몬스터 HP ≤ 0 → `victory = true`
- 플레이어 HP ≤ 0 → `victory = false`
- 도주 → `victory = false` (단, 사망은 아님 — 일반 전투에서)
- `handleCombatEnd`에서 보상/사망 처리

## 보상
- 보스 처치: 골드 `target_N × 2.5 / 7`, 아이템 드랍 1개
- 일반: 마리당 `target_N × 0.85 × 0.85 / 7`, 다중일수록 누적
- 미믹: `200 × chapter`
- ±20% 변동 + 행운 보너스(`1 + 행운 × 0.05`) 적용

## 자동 진행
[자동 진입](../features/auto-enter.md)이 ON이면 전투 종료 후 자동으로 다음 층.

## 관련 파일
- `src/core/combat.ts` — `createCombatContext / advanceTick / monsterAttack / playerBasicAttack / pushLog / makeMonster`
- `src/core/skills.ts` — `pickAutoAction / useSkill / getAvailableSkills`
- `src/core/buildBalance.ts` — `computeWeaponSkillProc`
- `src/stores/game.ts` — `tickStep / playerAutoAct / handleCombatEnd / startMonsterFight`
- `src/screens/Combat.vue` — 전투 UI
