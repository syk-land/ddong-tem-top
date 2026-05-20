# 설정 패널 (SpeedControl)

## 개요
화면 우상단에 떠 있는 전역 설정 패널. 게임 속도 / 자동 진입 / 효과음 / 배경음 / 인트로 만화 다시보기를 한 곳에서 다룬다. 게임 화면을 최대한 가리지 않도록 기본 접힘 + 자동 접힘 동작을 가진다.

## 동작 요약
- **기본 접힘**. 한 줄짜리 작은 버튼만 노출 (⚙ `1x` `자` 🔊)
- 접힌 버튼 클릭 → 펼침
- 펼친 상태에서 **5초간 어떤 조작도 없으면 자동 접힘**
- 어떤 조작이든(속도/자동/사운드/마우스 호버 등) 타이머 리셋
- 모달(`dialog/input/list/pickup/intro`) 떠 있을 때는 접힌 패널이 `opacity-25`로 더 흐려져 모달 가림 최소화
- 화면 전환(`screen`) / 전투 종료(`combat.ended`) 변화도 활동으로 간주해 타이머 리셋

## 내부 항목
| 항목 | 종류 | 설명 |
| --- | --- | --- |
| 속도 | 1x / 2x / 4x | 자동 전투 틱 + 자동 진입 지연 |
| 자동 | 토글 | [자동 진입](./auto-enter.md) |
| 효과음 | 슬라이더 + 음소거 | 0~1 볼륨, 0이면 자동 음소거 |
| 배경음 | 슬라이더 + 음소거 | 동일 |
| 📖 인트로 만화 | 버튼 | [인트로 만화 다시보기](./intro-comic.md) (replay 흐름) |

## 저장 키
- `localStorage["climetop:speedControl:expanded:v2"]` — 펼침 상태 영속화 (`v1`은 기본 펼침이었음, v2는 기본 접힘)
- `localStorage["climetop:speed:v1"]` — 속도 (1 / 2 / 4)
- `localStorage["climetop:autoEnter:v1"]` — 자동 진입 토글

## 화면 위치
`fixed top-1 right-1 z-40` — 모든 화면 위에 떠 있음. 스플래시 동안만 숨김 (`App.vue`의 조건).

## 관련 파일
- `src/ui/components/SpeedControl.vue`
- `src/App.vue` — 표시 조건 (`!showSplash`)
- `src/ui/sound.ts` — 사운드 ON/OFF, 볼륨 영속화

## 제약 / 메모
- 자동 접힘 타이머는 펼친 동안에만 동작. 접힘 상태는 변동 없음.
- 모바일(터치)에서 호버 이벤트가 없어도 자동 접힘은 동작 (스크립트 watch만 사용).
