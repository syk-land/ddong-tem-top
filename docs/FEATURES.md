# Climetop 기능 통합 문서

게임 시스템보다 한 단계 위 — 사용자에게 노출되는 UX·인프라 단위 기능의 인덱스. 각 항목은 `docs/features/*.md`의 독립 문서를 가집니다.

---

## 인덱스

| # | 기능 | 한 줄 요약 |
| --- | --- | --- |
| 0 | [인게임 튜토리얼](./features/tutorial.md) | 첫 플레이 8단계 점진적 노출 (캐릭터 생성·전투·상점·메타·진짜 보스). 속도/자동진입도 단계별 해금. 서사 힌트 분위기만 |
| 1 | [인트로 만화](./features/intro-comic.md) | 최초 1회 자동 만화 3컷 + 설정에서 다시보기, 진짜 보스 클리어 시 마지막 컷 잠금 해제 |
| 2 | [진짜 보스 도전 모드](./features/realboss.md) | 누적 골드 5만 + 5회 클리어 시 최근 캐릭터 부활 → 강화 보스 도전 → 깎은 비율만큼 영구 시작 스탯 |
| 3 | [캐릭터 외형 & 이름](./features/auto-avatar.md) | 거지템 모에 10명 중 외형 선택 + 추천/사용자 이름 1개 영구 저장, 던전=전신·전투=흉상 |
| 4 | [자동 진입](./features/auto-enter.md) | 광고 1회로 등반당 해금, 일반 몬스터 / 보스 / 회복샘 자동 진입 |
| 5 | [설정 패널 UX](./features/settings-panel.md) | 사운드 / 클라우드 / 인트로 / 데이터 리셋 — 기본 접힘, 모달 위에서 자동 흐려짐 |
| 6 | [안드로이드 뒤로가기 = 취소](./features/back-button.md) | Capacitor backButton → 모달/상점 우선 닫기, 데스크탑 ESC 동일 |
| 7 | [안드로이드 릴리스 서명](./features/release-signing.md) | `keystore.properties` 분리 + `versionCode` 매뉴얼 +1로 덮어쓰기 설치 가능 |
| 8 | [자동 장착](./features/auto-equip.md) | 현재 비활성 — 모든 장비는 수동 선택 |
| 9 | [데이터 리셋](./features/data-reset.md) | 모든 localStorage 키 비우고 새로고침 — 인트로 만화도 재표시 |
| 10 | [이미지 워터마크 제거](./features/watermark-removal.md) | Pillow + clone stamp 인페인트, 노란 박스 마킹 검출 지원 |
| 11 | [Firebase Google 로그인 + 클라우드 저장](./features/firebase-auth.md) | Firestore 진행도 동기화 + 리더보드. 웹 popup / 안드 네이티브 자동 분기 |
| 12 | [모바일 UI 전체 정비](./features/ui-overhaul.md) | 색 액센트 톤 통일 + 카드 위계 + 탭 모달 + 전투력 % 비교 |
| 13 | [자동화 모드 (dev)](./features/auto-mode.md) | `combatSpeed ≥ 5` 진입 시 자동 진입·매수·장착·이벤트 거부 + tick 배치 처리. 5~999 자유 |
| 14 | [WebP 이미지 파이프라인](./features/webp-pipeline.md) | 모든 일러스트/아이콘 WebP 화 + 캐릭터 그리드 분할 자동화. PNG 대비 -90~-95% 용량 |
| 15 | [시스템 다크모드 강제 변환 차단](./features/dark-mode-block.md) | `color-scheme: dark` 메타·CSS + `forceDarkAllowed=false` 로 추가 어둡게 처리 차단 |

---

## 신규 스크린 / 컴포넌트 (현재 소스 기준)

| 파일 | 역할 |
| --- | --- |
| `src/screens/SplashScreen.vue` | 초기 로딩 스플래시 (클릭 시 닫힘) |
| `src/screens/MainMenu.vue` | 메인 메뉴 (이어하기/새 캐릭터/설정/로그인) |
| `src/screens/CharacterCreation.vue` | 주사위 3회 + 챌린지 1개 선택 + 누적 보너스 분배 |
| `src/screens/Dungeon.vue` | 층 카드 선택 화면 |
| `src/screens/Combat.vue` | 전투 화면 (스킬 / 자동 진입 / 속도 조절) |
| `src/screens/Shop.vue` | 상점 (구매/판매/장비 강화) |
| `src/screens/SettingsScreen.vue` | 설정 (사운드/클라우드/인트로/리셋) |
| `src/screens/GameOver.vue` | 사망 화면 (광고 부활 옵션) |
| `src/screens/VictoryScreen.vue` | 100층 클리어 화면 |
| `src/screens/RealBossChallenge.vue` | 진짜 보스 도전 대치 화면 |
| `src/screens/RealBossResult.vue` | 진짜 보스 결과 (깎은 비율/보너스) |
| `src/ui/components/IntroComic.vue` | 인트로 만화 (탭/클릭 진행) |
| `src/ui/components/ItemAnnounceModal.vue` | 아이템 획득 알림 (큐 전체를 한 모달에 카드 N장 + "확인" 한 번에 전체 비움) |
| `src/ui/components/TutorialOverlay.vue` | 인게임 튜토리얼 (박동 화살표 + 스포트라이트) |
| `src/ui/components/*Modal.vue` | 8종 공통 모달 (Dialog/Input/List/Pickup/Inventory/Status/ItemDetail/Status) |
| `src/ui/components/HpMpBar.vue`, `SpeedControl.vue`, `StatusBadges.vue`, `GrowthPenaltyPanel.vue` | 게이지 / 속도 패널 / 상태 뱃지 / 등급 미리보기 |

## 신규 코어 모듈

| 파일 | 역할 |
| --- | --- |
| `src/core/realboss.ts` | `isChallengeDue / pickLatestRecord / makeRealBoss / computeStartBonusFromDrain` |
| `src/lib/firebase.ts` | Firebase 앱 / Auth / Firestore 초기화 |
| `src/lib/auth.ts` | `signInWithGoogle / signOut / onAuthChange` — Capacitor 네이티브 / 웹 popup 자동 분기 |
| `src/lib/cloudSync.ts` | Firestore CRUD — 프로필 / 메타 / 리더보드 |
| `src/lib/ads.ts` | AdMob 보상형 광고 (revive / fastSpeed / autoEnter) |
| `src/stores/auth.ts` | Pinia auth store — 로그인 시 자동 머지 + 동기화 + 리더보드 제출 |

## 스키마 — `MetaBonuses`

```ts
interface MetaBonuses {
  clearCount: number             // 100층 클리어 총 횟수
  climbCount: number             // 도중 사망 포함 총 등반 횟수
  totalBonusStats: number        // 누적 보너스 풀 (영구)
  allocations: Partial<Stats>    // 마지막 분배 기록 (자동 적용 X)
  totalGoldEarned: number        // 누적 클리어 골드 (진짜 보스 게이트)
  characterHistory: CharacterRecord[]  // 최대 50건
  permanentStartBonus: number    // 진짜 보스 보상 (다음 캐릭터 1회 +N)
  lastBossDrainRatio: number     // 0~1 (UI 표시용)
  realBossDefeated: boolean      // 인트로 만화 t3 잠금 해제
}
```

`loadMeta` 마이그레이션이 누락 필드를 기본값으로 채움 + 옛 10스탯 → 5스탯 변환 (`migrateAllocations`).

## 저장 키 일람

### 로컬 `localStorage`
| 키 | 내용 |
| --- | --- |
| `climetop:meta:v1` | `MetaBonuses` 전체 |
| `climetop:run:v1` | 진행 중 런 (`TowerRun`) |
| `climetop:creation:v1` | 캐릭터 생성 임시 상태 |
| `climetop:tutorialSeen:v1` | 인트로 만화 자동 표시 여부 |
| `climetop:speed:v1` | 게임 속도 (1/2/4 게이팅, 5~999 = 자동화 모드 dev) |
| `climetop:autoEnter:v1` | 자동 진입 토글 |
| `climetop:speedControl:expanded:v2` | 설정 패널 펼침 상태 |
| `climetop:sound:v1` | 사운드 ON·볼륨 |

### 클라우드 Firestore (로그인 시)
| 컬렉션/문서 | 내용 |
| --- | --- |
| `users/{uid}` | 프로필 (displayName/photoURL/email/nickname) |
| `meta/{uid}` | 게임 진행도 (`MetaBonuses` 전체) |
| `leaderboard/{uid}` | 본인 최고 점수 + nickname + clearCount |

자세한 규칙: [`firestore.rules`](../firestore.rules). 동기화 정책: [firebase-auth](./features/firebase-auth.md).

## 화면 라우팅 값

`Screen` 타입:
```
'splash' | 'menu' | 'create' | 'dungeon' | 'combat' | 'shop'
| 'victory' | 'gameover' | 'realboss' | 'realboss_result' | 'settings'
```

인트로 만화는 `introVisible` 오버레이 방식 (라우팅 값 아님).

## 안드로이드 빌드 흐름 요약

### CI 디버그 빌드 (테스트용)
1. main 브랜치 push → GitHub Actions 자동 실행
2. `android/app/debug.keystore` 로 안정 서명 (= Firebase 등록된 SHA-1 과 일치)
3. Artifacts 에서 디버그 APK 다운로드 → 폰 설치

### 릴리스 빌드 (Play Store 용 AAB)
1. (1회만) [release-signing](./features/release-signing.md) 셋업
2. `keystore.properties`에서 `VERSION_CODE` +1
3. `npm run android:bundle` 또는 Android Studio "Generate Signed Bundle"
4. `android/app/build/outputs/bundle/release/app-release.aab` → Play Console 업로드
5. release SHA-1 도 Firebase 콘솔에 추가 등록 필요 (Google 로그인 동작)

## 알려진 제약 / 향후 작업

- **인트로 만화 페이드 효과 없음**: 컷 사이가 즉시 전환
- **리더보드 UI 미작성**: `cloudSync.fetchTopLeaderboard()` 는 구현됐지만 표시 화면 없음
- **닉네임 편집 UI 미작성**: 현재 Google `displayName` 그대로 사용
- **익명 로그인 미지원**: 게스트 클라우드 저장 필요 시 `signInAnonymously` 추가 가능
- **자동 장착 미구현**: 모든 장비는 수동 선택만 — 자동 장착이 필요하면 `auto-equip.md` 의 정책 결정 필요
