# Firebase Google 로그인 + 클라우드 저장

> Google 로그인 → Firestore 진행도 동기화 + 리더보드. Firebase Hosting 웹 단일.

코드: `src/lib/firebase.ts`, `src/lib/auth.ts`, `src/lib/cloudSync.ts`, `src/stores/auth.ts`, `firestore.rules`

---

## 로그인 방식

**Google 로그인 단일 옵션** (Apple/익명 미지원).

### `auth.ts` 구현

```ts
async function signInWithGoogle() {
  const provider = new GoogleAuthProvider()
  const userCred = await signInWithPopup(firebaseAuth, provider)
  return userCred.user
}
```

### SDK
- `firebase/auth` 모듈 (JS SDK) — popup 기반 OAuth

---

## Firestore 컬렉션

| 경로 | 내용 |
|---|---|
| `users/{uid}` | 프로필 (`displayName`, `photoURL`, `email`, `nickname`) |
| `meta/{uid}` | 게임 진행도 (`MetaBonuses` 전체) |
| `leaderboard/{uid}` | 본인 최고 점수 (`uid`, `nickname`, `bestScore`, `bestRank`, `clearCount`, `updatedAt`) |

### 보안 규칙 (`firestore.rules`)

```
users:        로그인 사용자 read, 본인만 write
meta:         본인만 read/write (개인 데이터)
leaderboard:  로그인 사용자 모두 read, 본인만 write
              + 필드 화이트리스트 (악의적 필드 차단)
              + bestScore 는 숫자 검증
```

> `users` 컬렉션은 모든 로그인 사용자가 read 가능 — 다른 유저의 displayName/photoURL 을 리더보드 UI 등에서 표시하기 위함. 민감 정보 (이메일 등)는 추후 별도 컬렉션 분리 고려.

---

## 동기화 정책 (`cloudSync.ts`)

### 로그인 시 머지
```
1. 클라우드에서 meta/{uid} 로드
2. 로컬 meta 와 비교 (clearCount 기준)
3. 진행이 더 많은 쪽을 채택 (cloud > local 면 cloud, 반대면 local)
4. 결과를 양쪽 (로컬 + 클라우드) 에 미러
```

### 진행 중 푸시
- 클리어 완료 / 진짜 보스 결과 시 → 클라우드 푸시
- 메인 메뉴 진입 시 백그라운드 푸시

### 충돌 해결
`clearCount` 기준으로 더 진행된 쪽을 신뢰. 같으면 `updatedAt` 비교.

---

## 리더보드

`leaderboard/{uid}` 컬렉션 — 본인 doc 만 갱신:

```ts
{
  uid: string
  nickname: string         // Google displayName
  bestScore: number        // 클리어 등급 점수
  bestRank: string         // 'EX' | 'SSS' | ...
  clearCount: number       // 누적 클리어
  updatedAt: serverTimestamp()
}
```

- 클리어 완료 시 본인 점수 갱신 (현재 점수가 기존보다 좋을 때만)
- `bestScore` 내림차순 정렬로 상위 N명 조회: `fetchTopLeaderboard()` — **구현됐지만 UI 미작성**

---

## auth Store (`src/stores/auth.ts`)

Pinia store:

```ts
{
  user: User | null
  isSignedIn: computed → !!user
  signIn() {
    await signInWithGoogle()
    await mergeCloudData()
    await submitLeaderboard()
  }
  signOut() {
    await firebaseSignOut()
    // 로컬 데이터는 유지
  }
}
```

`onAuthChange` 리스너로 세션 자동 복원 (앱 재시작 시).

---

## Firebase 설정 (`src/lib/firebase.ts`)

```ts
const firebaseConfig = {
  apiKey: '<공개 가능 — Firestore Rules 로 보안>',
  authDomain: 'ddongtop-bea1d.firebaseapp.com',
  projectId: 'ddongtop-bea1d',
  // ...
}
```

> Firebase Web API key 는 공개돼도 안전 — Firestore Rules 가 진짜 보안 경계.

---

## 호스팅 도메인 설정

웹 popup 로그인은 Firebase Console → Authentication → Settings → **승인된 도메인** 에 호스팅 URL 추가 필요:
- `localhost` (dev)
- `ddongtop-bea1d.web.app` / `ddongtop-bea1d.firebaseapp.com` (Firebase Hosting 기본)
- 커스텀 도메인 (사용 시)

---

## 알려진 제약

- 익명 로그인 미지원 (게스트 클라우드 저장 불가)
- 닉네임 편집 UI 없음 (Google displayName 그대로)
- 리더보드 UI 미작성 (`fetchTopLeaderboard()` 만 구현됨)
- 클라우드 데이터 삭제 요청은 수동 (서비스 운영자에게 이메일)
