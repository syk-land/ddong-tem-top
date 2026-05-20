# 데이터 리셋

## 개요
메인 메뉴 하단의 "데이터 리셋" 버튼은 누적 보너스/진행 상태/시청 기록을 모두 비우고 페이지를 새로 로드한다. 리셋 후엔 첫 실행 직후와 동일한 상태가 된다.

## 비우는 LocalStorage 키
| 키 | 내용 |
| --- | --- |
| `climetop:meta:v1` | 메타 보너스, 캐릭터 히스토리, 도전 카운터, `pendingStartBonus`, `realBossCompleted` 등 |
| `climetop:run:v1` | 진행 중인 런 (캐릭터, 챕터, 인벤토리, 챌린지 키) |
| `climetop:tutorialSeen:v1` | 인트로 만화 자동 표시 여부 |
| `climetop:creation:v1` | 캐릭터 생성 임시 상태 (주사위/챌린지/아바타) |

→ `location.reload()` 호출. 스플래시 → 인트로 만화(최초 표시) → 메인 메뉴 흐름이 다시 흐른다.

## 비우지 않는 키 (의도적)
| 키 | 이유 |
| --- | --- |
| `climetop:speed:v1` | 사용자 선호 — 게임 속도 |
| `climetop:autoEnter:v1` | 사용자 선호 — 자동 진입 |
| `climetop:speedControl:expanded:v2` | UI 상태 |
| 사운드 ON/OFF, 볼륨 | UI/오디오 선호 |

## 관련 파일
- `src/screens/MainMenu.vue` — `resetMeta`

## 확인 모달
"정말 모든 누적 보너스를 리셋할까요?" — 사용자가 확인 누른 경우에만 진행. 안드로이드 뒤로가기는 [back-button](./back-button.md) 우선순위에 따라 모달 취소.
