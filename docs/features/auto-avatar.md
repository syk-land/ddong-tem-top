# 캐릭터 외형 자동 랜덤

## 개요
이전에는 캐릭터 생성 화면에서 4명의 후보 중 한 명의 외형을 사용자가 골랐다. 지금은 캐릭터 생성 진입 시 자동으로 1명의 외형이 무작위 선택되고 던전 화면 좌상단에 작게 표시된다.

## 동작
- `startCharacterCreation()` / `resetCharacterCreation()`에서 `pickRandomUserAvatars(1)[0]`로 즉시 선택
- 캐릭터 생성 임시 상태(`climetop:creation:v1`)에 저장 → 새로고침/뒤로 가도 같은 얼굴 유지
- 게임 시작(`newGame`) 시 `run.avatarKey`로 영구 저장 → 이후 던전/전투 화면에서 표시

## UI
- **CharacterCreation.vue**: 외형 선택 UI 제거 (4명 카드 패널 삭제)
- **Dungeon.vue**: "내 상태" 패널 위에 작은 원형 얼굴 + 한국어 라벨(예: "갈색머리 기사")
- **Combat.vue**: 기존 우측 캐릭터 패널에 그대로 사용 (변경 없음)

## 관련 파일
- `src/ui/images.ts` — `pickRandomUserAvatars / userAvatarUrl / userAvatarLabel / playerImageUrl`
- `src/stores/game.ts` — `startCharacterCreation / resetCharacterCreation / newGame / loadGame`
- `src/screens/CharacterCreation.vue`
- `src/screens/Dungeon.vue`
- `public/images/USER/F_r0_c0.png ...` (21장)

## 제약 / 메모
- 저장된 외형 키가 유효 목록에 없으면(예: 옛 키 형식) 자동으로 새로 1개 추첨해 덮어쓴다.
- 진행 중인 게임을 이어하기 한 경우 `loadGame()`에서 기존 `avatarKey`를 그대로 복원.
