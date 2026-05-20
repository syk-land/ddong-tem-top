# 챌린지 시스템

## 개요
캐릭터 생성 시 3개의 챌린지 카드 중 1개 선택 (또는 미선택). 선택한 챌린지는 게임 내내 적용되며, 끝까지 조건을 지켜 클리어하면 메타 보너스 추가 부여.

## 두 카테고리
| 카테고리 | 설명 |
| --- | --- |
| **instant** (즉시 보상) | 캐릭터 생성 직후 보상 적용. 조건 위반 시 일부 페널티만 |
| **bet** (리스크 베팅) | 페널티 부담. 끝까지 조건 만족하면 큰 보상 |

## 챌린지 구조 (`ChallengeDef`)
```ts
{
  key: string
  group: string        // 분류
  name: string
  description: string
  category: 'instant' | 'bet'
  reward: string       // 텍스트
  penalty: string      // 텍스트
  flags: { ... }       // 런타임 동작에 영향 (예: noShop, mpCapFixed)
}
```

## 플래그 종류 (`flags`)
- `noShop` — 상점 진입 차단 (불매 운동)
- `noShopRefresh` — 상점 새로고침 금지 (리롤 금지령)
- `noHealingSpring` — 회복샘 사용 차단 (절대 정수)
- `noRescueAdventurer` — 위기 모험가 구하면 사망 (불신주의자)
- `mpCapFixed` — MP 최대치 고정
- `forbidActiveSkills` — 액티브 스킬 사용 불가
- `forbidBasicAttacks` — 평타 사용 불가
- `trackCursedNeverRemove` — 저주의 무기 절대 제거 금지
- 기타 다수

## 런타임 컨텍스트 (`ChallengeContext`)
- `active: ActiveChallenge[]` — 활성 챌린지들 (보통 1개)
- 각 챌린지의 `counters`, `failed` 플래그
- 매 턴 훅 호출: `onTick / onShopBuy / onShopRefresh / onEquipItem / onMimicFlee / onBossFightEnd / onChapterEnd / onSmithBet / onRouletteResult / onAltarUsed / onBlackMarketUsed / onPvpHit / onPlayerHitByTheme`

## 평가
탑 클리어 시 `evaluateFinalChallenges` 호출:
- 모든 챌린지의 최종 조건 충족 검사
- 충족 → `calcChallengeMetaBonus` → 메타 보너스 분배 가능 포인트 +N
- 실패 → 보너스 미부여 (페널티는 이미 진행 중 적용됨)

## 30+ 챌린지 예시
- **불매 운동**: 상점 이용 불가 — 보상: 최종 골드 ×3
- **리롤 금지령**: 새로고침 불가 — 보상: 메타 보너스 +3
- **저주의 동반자**: 저주의 무기 시작 + 절대 제거 금지 — 보상: 메타 보너스 +5
- **미니멀리스트**: 인벤토리 1칸 — 보상: 메타 보너스 +4
- **속전속결**: 전 보스 30턴 내 처치 — 보상: 메타 보너스 +6
- **저체력**: HP 30% 이하 유지 — 보상: 골드 +30%, 메타 +2
- (전체 목록은 `src/data/challenges.ts` 참고)

## 관련 파일
- `src/data/challenges.ts` — `ChallengeDef`, `pickThreeRandomChallenges`, `CHALLENGES_MAP`
- `src/core/challengeRuntime.ts` — 컨텍스트 + 훅 + 평가
- `src/types/index.ts` — `TowerRun.challengeKeys`
