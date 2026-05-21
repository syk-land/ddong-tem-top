# Firebase: Google 로그인 + Firestore 클라우드 저장

## 개요
계정 없이 로컬 `localStorage`에만 저장하던 메타 데이터(클리어 횟수/누적 보너스/캐릭터 히스토리)를
Firebase Firestore에 동시 저장. 다른 기기에서 같은 구글 계정으로 로그인하면 진행도가 자동 머지된다.
리더보드는 본인 최고 점수만 갱신되는 공개 컬렉션으로 별도 분리.

플랫폼별:
- **웹** (`npm run dev`): Firebase JS SDK `signInWithPopup`
- **안드로이드** (Capacitor APK): `@capacitor-firebase/authentication` 의 네이티브 Google Sign-In UI
- 분기는 `Capacitor.isNativePlatform()` 으로 자동 판단

## Firebase 프로젝트
- Project ID: `ddongtop-bea1d`
- 위치: `asia-northeast3` (서울)
- 활성화 항목: Authentication (Google), Firestore
- Android 패키지: `com.climetop.app`
- 등록된 디지털 지문 (debug 빌드용 SHA-1): `4B:20:5E:1C:47:8A:C4:18:F8:D9:B2:00:8C:83:86:2D:B4:9F:AA:04`

웹 API 키는 공개돼도 안전한 식별자이므로 [src/lib/firebase.ts](../../src/lib/firebase.ts) 에 하드코딩.
보안은 [firestore.rules](../../firestore.rules) 가 담당.

## Firestore 데이터 모델

| 컬렉션 | 문서 ID | 내용 | 읽기 | 쓰기 |
| --- | --- | --- | --- | --- |
| `users/{uid}` | Firebase Auth uid | displayName, photoURL, email, nickname, createdAt, updatedAt | 로그인 사용자 누구나 | 본인만 |
| `meta/{uid}` | Firebase Auth uid | clearCount, totalBonusStats, permanentStartBonus, realBoss\*, totalGoldEarned, characterHistory | 본인만 | 본인만 |
| `leaderboard/{uid}` | Firebase Auth uid | uid, nickname, bestScore, bestRank, clearCount, updatedAt | 로그인 사용자 누구나 | 본인만 + 필드 화이트리스트 |

규칙 게시: Firebase 콘솔 → Firestore Database → 규칙 → `firestore.rules` 내용 붙여넣기.

## 동작 흐름

### 로그인
1. 메인메뉴 "Google 로 로그인" 클릭
2. `signInWithGoogle()` — 네이티브/웹 분기
3. 성공 → `auth.user` 채워짐 → `_onLoggedIn(user)` 실행:
   - `users/{uid}` upsert (없으면 createdAt, 항상 updatedAt 갱신)
   - `meta/{uid}` 로드 → 클라우드의 `clearCount` 가 더 크면 클라우드 → 로컬 머지 (오프라인 진행도 우선이 아닌 더 많이 진행된 쪽 우선)
   - 그 후 현재 로컬 meta 를 클라우드로 push

### 자동 동기화 (로그인 상태일 때만)
- `game.persistMeta()` 가 `saveMeta()` + fire-and-forget 클라우드 push
- 호출 시점: 캐릭터 생성 (pending 보너스 소진) / 100층 클리어 확정 / 진짜 보스 결과 처리
- 로그인 안 했으면 로컬만 저장 (조용히 스킵)

### 리더보드 제출
- 100층 클리어 후 `pushCharacterHistory` 직후 fire-and-forget `auth.submitScore(score, rank)`
- `leaderboard/{uid}` 의 `bestScore` 가 더 낮을 때만 갱신 (낮은 점수로 안 덮어씀)
- nickname/clearCount 같은 메타는 항상 갱신

### 로그아웃
- 메인메뉴 로그아웃 버튼 → `signOut()` (네이티브 + Firebase)
- 로컬 meta 는 그대로 유지 — 다른 계정으로 로그인 시 머지 로직이 재실행됨

## 코드 아키텍처

```
src/lib/firebase.ts       Firebase 앱 초기화 (Auth/Firestore 핸들 export)
src/lib/auth.ts           signInWithGoogle/signOut/onAuthChange — 플랫폼 분기
src/lib/cloudSync.ts      Firestore CRUD: upsertUserProfile/saveCloudMeta/loadCloudMeta/submitLeaderboard/fetchTopLeaderboard
src/stores/auth.ts        Pinia auth store — user/loading/error + login/logout/syncMetaToCloud/submitScore
```

`auth.ts` 와 `game.ts` 의 순환 의존을 피하기 위해 game store 의 `persistMeta()` 액션은 auth store 를 **dynamic import** 로 가져온다 (`import('./auth').then(...)`).

## Android 빌드 설정 (중요 게이트들)

### 1. `@capacitor-firebase/authentication` 버전
Capacitor 6.x 와 호환되는 v6 사용. 최신 v8 은 Capacitor 8+ 요구.
```json
"@capacitor-firebase/authentication": "^6"
```

### 2. `rgcfaIncludeGoogle = true` (필수)
플러그인의 `build.gradle` 기본값은 `play-services-auth` 를 `compileOnly` 로만 포함.
런타임에 클래스를 못 찾아 `Attempt to invoke virtual method ... on a null object reference` NPE 발생.
[android/variables.gradle](../../android/variables.gradle) 에 다음 한 줄로 해결:
```gradle
rgcfaIncludeGoogle = true
```

### 3. capacitor.config.json plugin 명시
```json
"plugins": {
  "FirebaseAuthentication": {
    "skipNativeAuth": false,
    "providers": ["google.com"]
  }
}
```

### 4. SHA-1 안정화 (필수)
GitHub Actions 가 매 빌드마다 새 debug keystore 를 생성하면 SHA-1 이 매번 달라서 Google Sign-In 이 거부된다. 해결책:
- 안정 `debug.keystore` 를 한 번만 생성 → repo 의 `android/app/debug.keystore` 로 커밋
- [android/app/build.gradle](../../android/app/build.gradle) 의 `signingConfigs.debug` 가 이 파일을 쓰도록 설정 (이미 적용됨)
- [.gitignore](../../.gitignore) 의 `*.keystore` 차단에서 이 파일만 `!android/app/debug.keystore` 로 예외

새 SHA-1 이 필요할 때(키 분실 등)는 [`.github/workflows/setup-keystore.yml`](../../.github/workflows/setup-keystore.yml) 워크플로우를 수동 실행해서 재생성.

### 5. google-services.json
[android/app/google-services.json](../../android/app/google-services.json) — Firebase 콘솔에서 다운로드한 그대로.
SHA-1 등록 **후** 재다운로드해야 `oauth_client` 배열이 채워진다 (`client_type: 1` Android + `client_type: 3` Web).

## 보안 규칙 핵심
```
match /meta/{uid}         allow read, write: if request.auth.uid == uid;
match /users/{uid}        allow read if signed in; write if uid match;
match /leaderboard/{uid}  allow read if signed in; write if uid match
                          + 필드 화이트리스트(uid/nickname/bestScore/bestRank/clearCount/updatedAt)
                          + bestScore is number;
```
- 본인 진행도는 본인만 접근
- 리더보드는 임의 필드 추가/조작 방지를 위해 키 화이트리스트 + 타입 체크

## 알려진 제약 / 향후
- **닉네임 변경 UI 없음**: 현재 `displayName` 그대로 사용. `users/{uid}.nickname` 필드를 별도로 받게 하려면 별도 UI 필요.
- **리더보드 화면 없음**: `fetchTopLeaderboard(n)` 는 구현돼 있지만 표시 UI 미작성.
- **충돌 머지 정책 단순**: 로그인 시 `clearCount` 가 더 큰 쪽만 채택. 다른 필드는 일괄 덮어씀. 더 세밀한 머지는 필드별 갱신 시간 비교 필요.
- **익명 계정 미지원**: 게스트가 로그인 없이 클라우드 저장하려면 `signInAnonymously` 추가 필요.
- **릴리스 keystore SHA-1 미등록**: Play Store 배포 시 [release-signing.md](./release-signing.md) 의 release keystore SHA-1 도 Firebase 에 추가 등록해야 함.

## 트러블슈팅

### Android에서 NPE — `Attempt to invoke virtual method ... on a null object reference`
원인: `rgcfaIncludeGoogle` 미설정. 위 4번 참조.

### `auth/unauthorized-domain`
원인: 웹 popup 사용 시 Firebase 콘솔의 승인된 도메인에 `localhost` 가 빠짐.
해결: Authentication → Settings → Authorized domains 에 `localhost` 추가.

### Claude Preview 에서 `Link to ddongtop-bea1d.firebaseapp.com was blocked`
원인: Claude Preview 의 샌드박스가 localhost 외부 도메인 차단.
해결: 실제 브라우저(Chrome/Edge) 에서 `http://localhost:5173` 직접 접속해서 테스트.

### `oauth_client` 배열 비어있음
원인: Firebase 콘솔에 SHA-1 미등록 상태에서 google-services.json 다운로드.
해결: 콘솔에서 SHA-1/SHA-256 추가 → 같은 페이지에서 google-services.json 재다운로드.

### 첫 빌드에서 `app-debug.apk` 가 기존 앱 위에 안 설치됨
원인: 이전에 다른 keystore (개발자 본인 PC에서 생성) 로 서명된 디버그 빌드가 폰에 있음.
해결: 폰에서 기존 앱 1회 제거 후 새 APK 설치. 이후부터는 같은 keystore 라 덮어쓰기 OK.

## 관련 파일

| 파일 | 역할 |
| --- | --- |
| `src/lib/firebase.ts` | Firebase 앱 초기화 |
| `src/lib/auth.ts` | 플랫폼 분기 로그인/로그아웃 |
| `src/lib/cloudSync.ts` | Firestore CRUD |
| `src/stores/auth.ts` | Pinia auth store |
| `src/stores/game.ts` | `persistMeta()` + 리더보드 제출 훅 |
| `src/screens/MainMenu.vue` | 로그인 버튼 + 프로필 표시 |
| `src/App.vue` | `initAuthListener()` 부팅 시 1회 |
| `firestore.rules` | 보안 규칙 |
| `capacitor.config.json` | FirebaseAuthentication plugin 설정 |
| `android/variables.gradle` | `rgcfaIncludeGoogle = true` |
| `android/app/build.gradle` | 안정 debug.keystore signingConfig |
| `android/app/google-services.json` | Firebase Android 설정 |
| `android/app/debug.keystore` | 안정 SHA-1 디버그 서명 키 |
| `.github/workflows/setup-keystore.yml` | (1회용) debug.keystore 생성 워크플로우 |
