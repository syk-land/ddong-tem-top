# 사운드 시스템

## 개요
Web Audio API 기반의 효과음(SFX) + 배경음(BGM) 시스템. 카테고리별 사운드 + 화면 전환에 따른 BGM 라우팅 + 안드로이드/Capacitor 호환.

## SFX 카테고리
- 클릭/전환/모달
- 평타 / 크리티컬 / 미스
- 스킬 (스킬 종류별 19종)
- 몬스터 종류별 피격/사망 (`monsterSfx.ts`)
- 골드/픽업/회복/보스 등장/사망/승리/패배
- 챌린지 성공/실패

`sfx.x()` 형태로 호출 — 한 사운드 사용 시 동일 사운드는 짧은 cooldown으로 중복 방지.

## BGM 종류
- `splash` — 스플래시/메인메뉴 (웅장)
- `menu` — 캐릭터 생성/던전/상점/승리 (발랄)
- 전투/게임오버 — 무음

`playBgm(kind)` / `stopBgm()`. 같은 kind 중복 호출은 무시.

## Autoplay 우회
브라우저 정책으로 첫 사용자 인터랙션 전엔 AudioContext가 `suspended`. `playBgm`은 `pointerdown / keydown / touchstart` 이벤트를 1회 청취 → 사용자의 첫 동작 시 자동 시작.

## 화면 전환 라우팅
`App.vue`의 `watch(currentScreen)`:
- `combat` / `gameover` → `stopBgm()`
- `menu` → `playBgm('splash')`
- 그 외 → `playBgm('menu')`

## 사운드 ON/OFF + 볼륨
- 효과음: `isSoundEnabled / setSoundEnabled`, `getSoundVolume / setSoundVolume`
- 배경음: `isBgmEnabled / setBgmEnabled`, `getBgmVolume / setBgmVolume`
- localStorage 영속화 (key는 sound 모듈 내부)
- 볼륨 0으로 슬라이드하면 자동 음소거, 음소거 해제 시 마지막 양수 볼륨 복원

## 설정 UI
[설정 패널](../features/settings-panel.md)의 효과음/배경음 슬라이더 + 음소거 체크박스.

## 관련 파일
- `src/ui/sound.ts` — `sfx / playBgm / stopBgm / setSoundEnabled / setBgmEnabled / setSoundVolume / setBgmVolume`
- `src/core/monsterSfx.ts` — 몬스터 종류별 사운드 매핑
- `public/sounds/` — 실제 mp3/ogg 자원
