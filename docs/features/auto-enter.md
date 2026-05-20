# 자동 진입

## 개요
던전에서 "진입" 버튼을 매번 누르지 않아도 되도록 일부 층 타입을 자동으로 진입한다. 전투가 끝나도 자동으로 다음 층으로 넘어가 끊김 없이 진행된다. 상점/보물/특별이벤트는 사용자 결정이 필요해 자동 진입하지 않는다.

## 자동 대상
| 층 타입 | 자동 진입 | 자동 다음층 |
| --- | --- | --- |
| `monster` (일반 몬스터) | O | O (승리 시) |
| `boss` (보스) | O | O (승리 시) |
| `healing_spring` (치유샘) | O (알람 모달 스킵) | O |
| `shop` | X | X |
| `treasure` | X | X (보물 알람은 그대로) |
| `special_event` | X | X |

## 안전 가드
- **사망**(`combat.victory === false`): 자동 다음층 X — 게임오버 화면에서 사용자 확인
- **인벤토리 풀 모달**(`pendingPickup`) 떠있으면 자동 진행 대기 → 모달 닫히면 재개
- **일반 모달**(`dialog / inputDialog / listDialog`) 떠있으면 자동 진입/다음층 모두 차단
- 도전 모드 보스전(`realBossMonster`)에서도 자동 모달은 결과 화면 라우팅과 별도

## 지연
- 던전 진입 watch: `max(120ms, 500 / combatSpeed)`
- 전투 종료 후 다음층: `max(300ms, 900 / combatSpeed)`
- 속도(1x/2x/4x)가 빠를수록 짧아짐.

## 설정
- 설정 패널(`SpeedControl.vue`)의 "자동" 토글
- 저장 키: `localStorage["climetop:autoEnter:v1"]` (`"1"` ON / `"0"` OFF)
- 접힌 패널에서는 ON일 때 "자" 한 글자 노출

## 관련 파일
- `src/stores/game.ts` — `autoEnter` state, `setAutoEnter`, `enterCurrentFloor`(치유샘 알람 분기)
- `src/screens/Dungeon.vue` — `tryAutoEnter` watcher
- `src/screens/Combat.vue` — `maybeAutoAdvance` watcher + `pendingPickup` watcher
- `src/ui/components/SpeedControl.vue` — 토글 버튼

## 제약 / 메모
- 챌린지 "절대 정수"(치유샘 사용 불가)에서도 자동 진입 시 알람을 건너뛰고 `advance()`만 호출 (동작은 동일, UI만 간략).
- 자동 진입은 *던전 화면이 활성*인 동안만 동작. 모달/다른 화면으로 전환 시 타이머는 자동 정리.
