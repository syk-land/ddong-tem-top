# 사운드 시스템

코드: `src/ui/sound.ts`, `src/core/monsterSfx.ts`

---

## 구조

- **BGM 2종** — MP3 외부 파일 1 + Web Audio API procedural 1
- **SFX** — Web Audio API oscillator + envelope (전부 procedural)
- **autoplay 잠금 해제**: 첫 사용자 인터랙션 (`pointerdown` / `keydown` / `touchstart`)

설정 저장: `localStorage["climetop:sound:v1"]`

```ts
{
  enabled: boolean       // SFX ON/OFF
  volume: number         // 0~1
  bgmEnabled: boolean
  bgmVolume: number      // 0~1
}
```

음소거 토글 시 마지막 양수 볼륨 복원.

---

## BGM

| 키 | 소스 | 사용처 |
|---|---|---|
| `splash` | `public/sounds/Beneath_the_Wet_Stone.mp3` | 메뉴 / 사망 / 승리 / 보스 도전 |
| `gemini` | Procedural (C major 아르페지오 + 베이스) | 캐릭터 생성 ~ 100층 등반 도중 |

```ts
playBgm('splash' | 'gemini')
stopBgm()
setBgmVolume(0..1)
```

화면 전환 시 자동 페이드 (`Combat.vue` 등의 onMounted/onUnmounted).

---

## SFX 카테고리

`ui/sound.ts:playSfx(name)` 호출.

### 기본 (12종)
attack / hit / crit / miss / skill / magic / pickup / gold / death / victory / rankUp / click / transition

### 스킬별 (19종)
스매시 / 피어스 / 연속공격 / 정밀타격 / 급습 / 방어 / 회피 / 패링 / 불굴 / 빙결 / 화염구 / 폭풍칼날 / 바위충격 / 번개창 / 그림자 / 정화 / 배리어 / 마력충전 / 저항의결계

각 스킬마다 고유 envelope + 주파수 패턴.

---

## 몬스터 SFX 카테고리 (`core/monsterSfx.ts`)

피격 / 사망 음을 6 카테고리로 분류 자동 매핑:

| 카테고리 | 매칭 |
|---|---|
| soft | 슬라임, 곤충, 무른 생물 |
| bone | 언데드, 골격 |
| metal | 기계, 골렘, 갑옷 |
| beast | 야수, 조류 |
| fire | 화염, 불 |
| magical | 영혼, 그림자, 마법 |

분류 우선순위: **이름 패턴 → trait 패턴 → element**.

```ts
const cat = classifyMonster(monster)
playSfx(cat === 'soft' ? 'hit_soft' : ...)
```

같은 카테고리 음 **60ms 이내** 중복 차단 — 다수 전투 시 음 폭주 방지.

---

## 음량 제어

`SpeedControl.vue` (글로벌 패널):
- SFX 슬라이더 0~100%
- BGM 슬라이더 0~100%
- SFX ON/OFF 토글
- BGM ON/OFF 토글

`SettingsScreen.vue`:
- 동일 항목 (사운드 섹션)

---

## 자동 차단 정책

- 브라우저 autoplay 정책 — 첫 인터랙션 전엔 모든 소리 차단
- 첫 사용자 입력 (`pointerdown` 등) 감지 시 AudioContext 활성화
- 백그라운드 (탭 비활성) 시 자동 음소거 (Vue lifecycle)
