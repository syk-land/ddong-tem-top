# 진짜 보스 도전 모드

## 개요
탑 등반(클리어/사망 모두 1회로 카운트)을 5~10회 마다 발동되는 미니 이벤트. 지금까지 등반한 캐릭터 중 가장 낮은 클리어 점수를 기록한 캐릭터를 그 시점 스탯/체력 그대로 되살려 진짜 보스 1체와 1:1 PVE 대전을 시킨다. 보스 HP를 깎은 비율 만큼 다음 캐릭터 1회의 시작 능력치가 늘어난다 (60pt → 최대 120pt).

## 카운터
- `meta.runsSinceLastChallenge` — 등반 횟수
- `meta.nextChallengeAt` — 발동 임계값 (`5 + randInt(0,5)`, 도전 한 번 끝날 때마다 재추첨)
- 클리어 시(`handleTowerClear`) / 사망 시(`handleCombatEnd` 패배 분기) `incrementRunCounter` 호출

## 발동 위치
1. 메인 메뉴 진입 시 (`MainMenu.vue` `onMounted`)
2. 메인 메뉴에서 "새 캐릭터" 버튼 누를 때 (`startNew`)
3. 클리어 직후 보너스 분배 확정 시 (`confirmClearBonus` 끝)

위 세 시점에서 `isChallengeDue(meta)` 이면 `startRealBoss()` 호출.

## 흐름
```
isChallengeDue → startRealBoss
  consumeChallengeTrigger  (카운터 리셋 + nextChallengeAt 재추첨)
  pickWeakestRecord        (history 최저 score, 동률은 가장 오래된 것)
  makeRealBoss(theme)      (그 캐릭터가 도달한 마지막 챕터의 hardBoss 또는 boss, 챕터 10 강도)

→ RealBossChallenge.vue
  ┌─ 인트로 (모험가 / 보스 비교)
  ├─ "도전 시작" → enterRealBossCombat (Combat 화면)
  └─ "나중에" → 메인 메뉴 (도전은 소모됨)

→ Combat (1:1 전투. 부활한 캐릭터 = 풀 HP, 장비 없음, 스탯만 적용)
→ handleCombatEnd → realBossMonster 감지 → finishRealBossCombat
  ratio = (initialMaxHp - finalHp) / initialMaxHp
  meta.lastBossDrainRatio = ratio
  meta.pendingStartBonus = floor(60 * ratio)
  meta.realBossCompleted = true
→ RealBossResult.vue (결과 화면)
  "캐릭터 생성하기" → proceedFromRealBossResult
→ openIntroComic('afterRealBoss')  (튜토리얼 1→2→3)
→ closeIntroComic → startCharacterCreation
```

## 보너스 적용
- 캐릭터 생성 화면(`CharacterCreation.vue`)에 "탑의 빚 +Npt" 패널 표시 (자동 분배 예고)
- `createCharacter(bonusAllocation, customStats, pendingStartBonus)` — 4스탯(공/방/체/마)에 균등 분배, 나머지는 공격력에
- 사용 후 `pendingStartBonus = 0`으로 소진

## 보스 이미지
- 11개 챕터 테마 ↔ 보스 일러스트 1:1 매핑
- `public/images/REALBOSS/{고블린|골렘|언데드|환영|흡혈귀|심해|기계|용암|암흑|천공|맹독}.png`
- `realBossImageUrl(theme)` 헬퍼

## 캐릭터 히스토리
- 클리어 시점에 `pushCharacterHistory(meta, character, score, rank, avatarKey, theme)` 호출
- 최대 50개로 캡 (오래된 것부터 자동 제거)
- 저장 항목: 4스탯 스냅샷, score, rank, avatarKey, 무기/갑옷 정보, hp/maxHp/mp/maxMp, gold, 마지막 챕터 테마, 기록 시각

## 관련 파일
- `src/core/realboss.ts` — `isChallengeDue / pickWeakestRecord / makeRealBoss / computeStartBonusFromDrain`
- `src/core/meta.ts` — `pushCharacterHistory / incrementRunCounter / consumeChallengeTrigger / rollNextChallengeAt`
- `src/screens/RealBossChallenge.vue` — 인트로 화면
- `src/screens/RealBossResult.vue` — 결과 화면
- `src/stores/game.ts` — `triggerRealBossIfDue / startRealBoss / enterRealBossCombat / finishRealBossCombat / proceedFromRealBossResult`
- `src/types/index.ts` — `MetaBonuses`(`runsSinceLastChallenge / nextChallengeAt / characterHistory / pendingStartBonus / lastBossDrainRatio / realBossCompleted`), `CharacterRecord`

## 제약 / 메모
- 사망한 캐릭터는 히스토리에 적재되지 않는다 (현 구현). 사망도 카운터는 증가.
- 도전을 거절(`나중에`)해도 카운터는 소진된다 — 매번 묻지 않기 위함.
- 도전 시 부활 캐릭터는 장비 없이 스탯만 사용. 보스는 챕터 10 강도라 약한 캐릭터는 거의 못 깎을 수도 있다 (그게 의도된 핸디캡).
