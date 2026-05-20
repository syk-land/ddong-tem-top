# 인트로 만화

## 개요
스플래시를 닫은 직후 보여주는 4컷 만화 형태의 세계관 인트로. 최초 1회만 자동으로 뜨고, 설정 패널의 책 버튼으로 언제든 다시 볼 수 있다. 진짜 보스 도전 모드를 처음 완료하면 마지막 컷(튜토리얼 3)이 잠금 해제되어 다시보기에 추가로 노출된다.

## 사용자 흐름
| 진입 경로 | 표시 순서 |
| --- | --- |
| 최초 실행 (스플래시 직후 자동) | `main` → `튜토리얼 1` → `튜토리얼 2` → 메인 메뉴 |
| 진짜 보스 도전 종료 후 | `튜토리얼 1` → `튜토리얼 2` → `튜토리얼 3` → 캐릭터 생성 |
| 설정 → 인트로 만화 다시 보기 (도전 미완료) | `main` → `튜토리얼 1` → `튜토리얼 2` → 원래 화면 |
| 설정 → 인트로 만화 다시 보기 (도전 1회 이상 완료) | `main` → `튜토리얼 1` → `튜토리얼 2` → `튜토리얼 3` → 원래 화면 |

각 페이지 하단의 라벨은 다음 페이지가 있으면 "다음 페이지로", 마지막 페이지면 "시작하기". 화면 어디든 탭/클릭하면 다음 페이지로 진행.

## 관련 파일
- `src/ui/components/IntroComic.vue` — 만화 페이지 컴포넌트
- `src/stores/game.ts` — `openIntroComic / nextIntroPage / closeIntroComic / autoShowIntroIfFirstTime`
- `src/App.vue` — 스플래시 닫힌 직후 자동 호출
- `src/ui/components/SpeedControl.vue` — 책(📖) 버튼
- `src/ui/images.ts` — `tutorialImageUrl()`
- `public/images/main.png`, `public/images/TUTORIAL/{1,2,3}.png`

## 저장 키
- `localStorage["climetop:tutorialSeen:v1"]` — 최초 시청 완료 여부 (`"1"`이면 자동 재표시 안 함)
- `meta.realBossCompleted` — 도전 1회 완료 여부 (다시보기에 튜토리얼 3 노출 결정)

## 데이터 리셋 동작
메인 메뉴의 "데이터 리셋"은 `climetop:tutorialSeen:v1`을 함께 비우므로 리셋 후 다시 최초 1회 자동 표시된다.

## 제약 / 메모
- 컷 사이는 페이드 없이 즉시 전환. 이미지가 로딩 안 되면 빈 박스로 보일 수 있어 사전 로딩이 보장된 환경(같은 도메인의 public 자원)을 가정한다.
- 안드로이드 뒤로가기로 만화 종료 가능 (`handleBackButton`).
