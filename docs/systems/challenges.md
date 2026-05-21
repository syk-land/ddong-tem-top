# 챌린지 시스템 (56종, v9)

> 캐릭터 생성 시 풀에서 3개(즉시 2 + 리스크 1) 랜덤 제시, 1개 선택. 선택 안 해도 시작 가능.

코드: `src/data/challenges.ts` (정의), `src/core/challengeRuntime.ts` (추적/판정)

---

## 분류

### 즉시 보상형 (instant) — 28개
시작 시 스탯/골드 보너스 + 제약. 클리어 여부 무관.

| 그룹 | 챌린지 | 보상 | 페널티 |
|---|---|---|---|
| 공격력 제약 | 과유불급 | 시작 체력 +10 | 최종 공격력 200 초과 시 즉사 |
| 공격력 제약 | 녹슨칼날의맹세 | 시작 민첩 +5, 행운 +3 | 하급 특성 무기만 |
| 공격력 제약 | 유리대포 | 시작 힘 +16 | 갑옷 장착 불가 |
| 공격력 제약 | 체중감량 | 시작 민첩 +12 | 속도계수 0.8 이하 무기 불가 |
| 공격력 제약 | 마법혐오증 | 시작 체력 +6 | 마법 무기 장착 불가 |
| 재화 제약 | 진정한무소유 | 시작 체력 +6, 행운 +4 | 골드 0 고정, 상점 X |
| 재화 제약 | 단벌신사 | 시작 골드 +300 | 시작 장비 해제/변경 불가 |
| 재화 제약 | 미니멀리스트 | 시작 민첩 +6 | 인벤토리 1슬롯 |
| 재화 제약 | 파괴주의자 | 시작 힘 +8 | 장비 buyback 불가 |
| 재화 제약 | 황금알레르기 | 전 스탯 +3 | 누적 골드 500 초과 시 사망 |
| 상점 제약 | 불매운동 | 시작 행운 +8 | 상점 진입 불가 |
| 상점 제약 | 요행은없다 | 시작 힘 +6 | 회복샘 이용 불가 |
| 상점 제약 | 불신주의자 | 시작 민첩 +10 | 모험가 구출 시 즉사 |
| 상점 제약 | 리롤금지령 | 시작 체력 +3, 마력 +3 | 상점 새로고침 불가 |
| 상점 제약 | 정가매입 | 시작 체력 +6 | 상점 할인 X |
| 속도 제약 | 굼벵이전술 | 시작 체력 +15 | 무기 ticks 14+ (한방형만) |
| 속도 제약 | 조급증 | 시작 민첩 +5 | 공격 스킬 사용 불가 (평타만) |
| 속도 제약 | 강박증 | 시작 행운 +6 | 속도계수 1.0 무기만 |
| 속도 제약 | 속전속결 | 시작 힘 +7 | 매 전투 50틱 이내 미승리 시 패배 |
| 속도 제약 | 유지력상실 | 시작 힘 +10 | 최대 MP 30 고정 |
| 생존 제약 | 혈우병 | 시작 행운 +10 | 출혈 시 룰렛 대실패 +20% |
| 생존 제약 | 야맹증 | 시작 힘 +8 | 암흑 상태/챕터에서 명중 -30 |
| 생존 제약 | 절대정수 | 시작 체력 +10 | 회복 효율 -50% |
| 생존 제약 | 의지박약 | 시작 마력 +8 | 불굴의 의지 스킬 사용 불가 |
| 생존 제약 | 연약한피부 | 시작 민첩 +4, 힘 +4 | 판금/중갑 장착 불가 |

### 리스크 베팅형 (risk) — 25개
50/100층 클리어 시 metaBonus 적립. 위반 시 챌린지 실패, 보너스 X.

| 그룹 | 챌린지 | 보상 | 페널티 |
|---|---|---|---|
| 장비 제한 | 무소유의장노말 | metaBonus +10 | 특별/레전드 장비 1회라도 X |
| 장비 제한 | 순수가난 | metaBonus +6 (50층) | 1티어 외 장비 시 실패 |
| 장비 제한 | 명품거부증 | metaBonus +8 | 상점 구매 1개 시 실패 |
| 장비 제한 | 특성봉인 | metaBonus +12 | 특성 붙은 장비 시 실패 |
| 장비 제한 | 알몸의순례자 | metaBonus +7 (50층) | 갑옷 1회라도 X |
| 전투 스타일 | 운칠기삼 | 다음 회차 행운 +5 영구 | 행운 외 모든 스탯 3 |
| 전투 스타일 | 평화주의자 | metaBonus +15 (초고난도) | 공격 스킬 사용 시 실패 |
| 전투 스타일 | 철저한등가교환 | 다음 회차 분배 포인트 +5 | 제단 무시 또는 3회 미달 |
| 전투 스타일 | 스킬미학 | metaBonus +5 (50층) | 평타 시 실패 |
| 전투 스타일 | 자연치유거부 | 다음 회차 마력 상한 ↑ | 챕터 종료 시 MP > 0 실패 |
| 경제 | 자산동결 | metaBonus +10 | 최종 보스 시 골드 > 0 실패 |
| 경제 | 황금고블린파트너 | 다음 회차 시작 골드 +200 영구 | 새로고침 1회라도 안 쓰면 실패 |
| 경제 | 짠돌이의탑 | metaBonus +9 | 누적 소비 300 초과 시 실패 |
| 경제 | 미믹사냥꾼 | 다음 회차 미믹 확률 ↓ | 미믹 1회라도 도주 시 실패 |
| 경제 | 암시장VIP | 다음 회차 암시장 20% 할인 영구 | 누적 10회 미만 실패 |
| 테마 특화 | 환영파괴자 | 다음 회차 민첩 +5 영구 | 환영 챕터 1회라도 피격 |
| 테마 특화 | 도박중독 | metaBonus +8 | 룰렛 대성공 3회 미달 |
| 테마 특화 | 대장장이은인 | 다음 회차 대장장이 +15% | 베팅 80% 미만 또는 실패 |
| 테마 특화 | 배신저항군 | 다음 회차 체력 +5 영구 | PvP 피격 3회 초과 |
| 테마 특화 | 속전속결의장 | metaBonus +11 | 보스 100틱 초과 시 실패 |
| 가혹 | 빈사의유령 | metaBonus +14 | HP 30% 이하 500틱 미달 |
| 가혹 | 저주의동반자 | metaBonus +13 | 저주의 무기 해제 시 실패 |
| 가혹 | **고집불통** | metaBonus +10 | 상점 새로고침 1회라도 사용 시 실패 |
| 가혹 | 만성피로 | metaBonus +7 (50층) | 민첩 11 이상 실패 |
| 가혹 | 가난이체질 | metaBonus +10 + EX | 평균 티어 3 초과 실패 |

### v9 신규 (6종)

| 종류 | 챌린지 | 보상 | 페널티 |
|---|---|---|---|
| instant | 크리광인 | 시작 민첩 +10, 행운 +6 | 민첩 25 미만 시 즉사 |
| instant | 로브의길 | 시작 마력 +14 | 마법무기 + 로브 외 장착 X |
| instant | 강철요새 | 시작 체력 +12, 힘 +4 | 판금 외 갑옷 X |
| risk | 둔감 | metaBonus +9 (50층) | 민첩 6 이상 실패 |
| risk | 독재자의일격 | metaBonus +10 | 힘 24 이하 실패 |
| risk | 운명의주사위 | metaBonus +8 | 행운 24 이하 실패 |

> 옛 "노 포션"은 climetop에 포션 시스템이 없어 영구 자동성공 상태였음. v6.1 에서 **고집불통**(새로고침 0회)으로 교체.

---

## 추적 플래그 (`ChallengeFlags`)

`challenges.ts:ChallengeFlags` 에 50+개 정의. 종류:

### 무기/방어구 제약
- `forceLowTraitsOnly`, `forceCommonNormalOnly`, `forceLowNormalOnly`
- `noArmor`, `lockStartingGear`, `forbidPlateHeavy`, `forbidLargeWeapon`, `forbidMagicWeapon`, `onlySpeedCoef1`
- `maxAtk` (v9: 곱셈 스케일 ~200), `weaponTicksMin` (v9 신규, 굼벵이 전술), `mpCapFixed`
- `forceMagicLobeBuild` (v9 신규, 로브의 길), `forceHeavyArmor` (v9 신규, 강철 요새)
- `speedFixed` (deprecated — v9에서 의미 없음)

### 경제
- `goldZero`, `goldMax500Death`, `noShop`, `noShopRefresh`, `noBuyback`, `noShopDiscount`
- `noHealingSpring`, `noRescueAdventurer`
- `noIronWill`, `noActiveSkills`, `onlyActiveSkills`
- `combatTimeLimit`, `blindExtra`, `bleedBadLuckPct`, `healEffMult`

### 트래킹 (위반 시 챌린지 실패)
- `trackNoLegendaryEver`, `trackOnlyTier1`, `trackNoShopBuy`, `trackNoTraitEquip`, `trackNoArmorEver`
- `trackLuckOnly`, `trackPacifist`, `trackAltarEveryChapter`, `trackSkillOnly`, `trackMpEmptyAtChapterEnd`
- `trackGoldZeroAtFinalBoss`, `trackUseRefreshEveryChapter`, `trackTotalSpendUnder300`, `trackKillAllMimics`, `trackBlackMarketCount`
- `trackDodgeAllMirage`, `trackRouletteGreat3`, `trackSmith80PctBet`, `trackBetrayalPerfect`, `trackBoss100Tick`
- `trackLowHp500Tick`, `trackCursedNeverRemove`, `trackNoRefreshEver`, `trackAvgTier3OrLower`
- v9 신규: `trackAgilityBelow` / `trackAgilityAtLeast` / `trackLuckAtLeast` / `trackStrengthAtLeast`
- `trackSpeedBelow6` (deprecated → 민첩 6 이하로 동작)

---

## 챌린지 생명주기

```
[캐릭터 생성]
    │
    ├ pickThreeRandomChallenges() → 즉시 2 + 리스크 1
    │
    ↓ 사용자 선택
[makeChallengeContext(keys)]
    │
    ├ applyInstantRewards(character, ctx) — instant 챌린지의 보너스 적용
    │
    ↓ 게임 진행 중
[Tracking 훅 — game.ts에서 이벤트마다 호출]
    │
    ├ onEquipItem        — 장비 트래킹
    ├ onShopBuy          — 상점 구매
    ├ onShopRefresh      — 상점 새로고침
    ├ onMimicFlee        — 미믹 도주
    ├ onBossFightEnd     — 보스 전투 종료 (틱 카운트)
    ├ onTick             — HP/속도 매 틱 추적
    ├ onChapterEnd       — 챕터 종료 시점 검사
    ├ onAltarUsed/Offered — 제단
    ├ onRouletteResult   — 룰렛
    ├ onSmithBet         — 대장장이
    ├ onBlackMarketUsed  — 암시장
    ├ onPvpHit           — PvP 피격
    ├ onPlayerHitByTheme — 테마별 피격 (환영)
    └ recordBasicAttackUse / recordActiveSkillUse — 평화주의자/스킬미학
    │
    ↓ 클리어 시
[evaluateFinalChallenges]
    │
    ├ trackXxx 카운터 검사 → 미달 시 ac.failed=true
    │
    ↓
[calcChallengeMetaBonus]
    │
    └ 활성 챌린지 중 !failed 만 metaBonus 합산 → pendingClear.bonus 에 가산
```

---

## 보너스 합산

```
clearBonus = rank.bonus (1~10, 무기/갑옷 티어 합산 기반)
           + sum(challenge.metaBonus if !failed)
```

`game.ts:onVictory` 에서 합산. 평화주의자 (+15) 클리어하면 rank EX + 15 = 최대 25pt 적립 가능.
