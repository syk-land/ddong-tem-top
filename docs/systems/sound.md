# 사운드 시스템

코드: `src/ui/sound.ts`

웹 오디오 + AudioContext 기반. autoplay 정책 우회를 위해 첫 사용자 인터랙션까지 BGM 재생을 보류.

---

## BGM (3종)

| 키 | 사용 화면 |
|---|---|
| `splash` | 메인 메뉴 (웅장) |
| `menu` | 캐릭터 생성 / 던전 / 상점 / 승리 (발랄) |
| (무음) | 전투 / 게임 오버 (효과음 집중) |

화면 전환은 `App.vue` 의 watcher 가 `playBgm(kind)` / `stopBgm()` 호출.

---

## SFX 카테고리

`sfx.*()` 함수 모음:

| 카테고리 | 함수 | 사용 시점 |
|---|---|---|
| 평타 | `sfx.basicAttack` | 평타 적중 |
| 물리 스킬 | 자동 (`playSkillSound`) | 스킬 종류별 분기 |
| 마법 스킬 | 자동 | 마법 스킬 |
| 크리티컬 | `sfx.crit` | 크리 발생 |
| 사망 (적) | `playMonsterDeath` | 몬스터 사망 |
| 사망 (자기) | `sfx.death` | 플레이어 사망 |
| 골드 | `sfx.gold` | 골드 획득 |
| 회복 | `sfx.heal` | HP 회복 |
| 승리 | `sfx.victory` | 챕터 클리어 |
| 클릭 | `sfx.click` | 버튼 |

---

## 몬스터 피격/사망 SFX

`monsterSfx.ts` — 몬스터 카테고리(인간형/언데드/기계/...)별 다른 사운드:
- `playMonsterHit(monster)` — 피격 시
- `playMonsterDeath(monster)` — 사망 시

다단히트 (화염구 스플래시, 번개 연쇄, 폭풍칼날) 시 같은 카테고리 사운드 묶음 처리.

---

## 사용자 토글

`SpeedControl` 컴포넌트 우하단 위젯에서:
- BGM ON/OFF
- SFX ON/OFF

상태는 `localStorage` 에 보존 (`climetop:bgm`, `climetop:sfx`).

---

## 안드로이드

Capacitor WebView 도 Web Audio API 지원. iOS 는 첫 터치까지 AudioContext suspended 상태로 자동 대기.
