# Climetop 기능 통합 문서

이 세션에서 추가/개편된 기능들을 한눈에 보기 위한 인덱스. 각 항목은 `docs/features/*.md`의 독립 문서를 가지며, 여기엔 핵심 요약 + 주요 저장 키 + 관련 파일만 담겼다. 자세한 흐름은 각 항목 링크.

---

## 인덱스

| # | 기능 | 한 줄 요약 |
| --- | --- | --- |
| 1 | [인트로 만화](./features/intro-comic.md) | 최초 1회 자동 만화 + 설정에서 다시보기, 도전 1회 클리어 후 마지막 컷 잠금 해제 |
| 2 | [진짜 보스 도전 모드](./features/realboss.md) | 등반 5~10회 마다 최약 캐릭터 부활 → 보스 도전 → 깎은 비율만큼 다음 캐릭터 +스탯 |
| 3 | [캐릭터 외형 자동 랜덤](./features/auto-avatar.md) | 4명 중 선택 UI 제거 → 진입 시 자동 1개 추첨, 던전 화면 하단에 표시 |
| 4 | [자동 진입](./features/auto-enter.md) | 일반 몬스터 / 보스 / 치유샘만 자동 진입 + 전투 종료 자동 다음 층 |
| 5 | [설정 패널 UX](./features/settings-panel.md) | 기본 접힘 + 5초 자동 접힘 + 모달 위에서 더 흐려짐 |
| 6 | [안드로이드 뒤로가기 = 취소](./features/back-button.md) | Capacitor backButton → 모달/상점 우선 닫기, 데스크탑 ESC 동일 |
| 7 | [안드로이드 릴리스 서명](./features/release-signing.md) | `keystore.properties` 분리 + `versionCode` 매뉴얼 +1로 덮어쓰기 설치 가능 |
| 8 | [빈 슬롯 자동 장착](./features/auto-equip.md) | 슬롯 비었고 인벤토리에 같은 종류 있으면 tier 가장 높은 것 자동 장착 |
| 9 | [데이터 리셋](./features/data-reset.md) | 4개 키 비우고 새로고침 — 인트로 만화도 재표시 |
| 10 | [이미지 워터마크 제거](./features/watermark-removal.md) | Pillow + clone stamp 인페인트, 노란 박스 마킹 검출 지원 |

---

## 신규 스크린 / 컴포넌트

| 파일 | 역할 |
| --- | --- |
| `src/screens/RealBossChallenge.vue` | 도전 인트로 + 부활 캐릭터/보스 대치 화면 |
| `src/screens/RealBossResult.vue` | 도전 종료 후 비율/보너스 표시 |
| `src/ui/components/IntroComic.vue` | 만화 페이지 컴포넌트 (탭/클릭 진행) |

## 신규 코어 모듈

| 파일 | 역할 |
| --- | --- |
| `src/core/realboss.ts` | `isChallengeDue / pickWeakestRecord / makeRealBoss / computeStartBonusFromDrain` |

## 스키마 변경 — `MetaBonuses`

```ts
interface MetaBonuses {
  clearCount: number
  totalBonusStats: number
  allocations: Partial<Stats>
  // 도전 모드
  runsSinceLastChallenge: number
  nextChallengeAt: number              // 5~10 랜덤
  characterHistory: CharacterRecord[]  // 최대 50
  pendingStartBonus: number            // 다음 캐릭터 1회 +N
  lastBossDrainRatio: number           // 0~1 (UI)
  realBossCompleted: boolean           // 인트로 만화 다시보기에 t3 잠금 해제용
}
```
`loadMeta` 마이그레이션이 누락 필드를 기본값으로 채움.

## 저장 키 일람

| 키 | 내용 |
| --- | --- |
| `climetop:meta:v1` | `MetaBonuses` 전체 |
| `climetop:run:v1` | 진행 중 런 (`TowerRun`) |
| `climetop:creation:v1` | 캐릭터 생성 임시 상태 |
| `climetop:tutorialSeen:v1` | 인트로 만화 자동 표시 여부 |
| `climetop:speed:v1` | 게임 속도 1/2/4 |
| `climetop:autoEnter:v1` | 자동 진입 토글 |
| `climetop:speedControl:expanded:v2` | 설정 패널 펼침 상태 |
| (사운드 모듈 내부) | 효과음/배경음 ON·볼륨 |

리셋 동작은 [data-reset](./features/data-reset.md) 문서 참조.

## 신규 화면 라우팅 값

`Screen` 타입에 추가됨:
```
'intro' | 'realboss' | 'realboss_result'
```
- `intro`는 현재 `introVisible` 오버레이 방식으로 처리되어 실제 라우팅 값으로는 안 쓰임 (예약).
- `realboss` → `RealBossChallenge.vue`
- `realboss_result` → `RealBossResult.vue`

## 안드로이드 빌드 흐름 요약

1. `npm run build`
2. `npx cap sync android`
3. (1회만) [release-signing](./features/release-signing.md) 셋업
4. `keystore.properties`에서 `VERSION_CODE` +1
5. Android Studio 또는 `gradlew.bat assembleRelease`
6. `app-release.apk` 폰에 설치 (1회만 기존 디버그 빌드 제거)

## 알려진 제약 / 향후 작업

- **t1/t2 인페인트 잔여 흔적 가능**: 자국이 보이면 노란 박스 다시 표시해 `images/튜토리얼 N mark.png`로 두면 자동 재처리 가능 ([watermark-removal](./features/watermark-removal.md))
- **사망 캐릭터 히스토리 미적재**: 도전 모드의 최약 캐릭터 풀에 사망 케이스를 포함할지는 추후 결정
- **안드로이드 디폴트 종료 확인**: 게임 진행 중 뒤로가기 → 모달 없을 때 디폴트 종료 → "정말 종료할까요?" 확인 추가 여지
- **인트로 만화 페이드 효과**: 컷 사이가 즉시 전환이라 페이드 추가 시 자연스러워질 수 있음
