# 안드로이드 릴리스 서명 + AAB 빌드

> `keystore.properties` 분리 + `versionCode` 매뉴얼 +1 → Play Store 업로드용 AAB 생성.

코드: `android/app/build.gradle`, `android/keystore.properties.example`
관련 npm 스크립트: `android:build` / `android:bundle`

---

## 0. 한 번만 셋업

### 키스토어 생성

```bash
cd android
mkdir keystore
keytool -genkey -v \
  -keystore keystore/release.jks \
  -keyalg RSA -keysize 2048 -validity 10000 \
  -alias climetop
```

- CN/OU 등은 적당히 채움
- 비밀번호 2개 (store / key) 반드시 메모
- **`release.jks` 분실 시 같은 패키지명으로 영영 업데이트 불가** — 안전한 곳에 백업 필수

### keystore.properties 작성

`android/keystore.properties.example` 을 복사해서 `android/keystore.properties` 로 만들고 채운다 (gitignored):

```properties
KEYSTORE_FILE=keystore/release.jks
KEYSTORE_PASSWORD=<실제 비번>
KEY_ALIAS=climetop
KEY_PASSWORD=<실제 비번>

VERSION_CODE=1                  # 매 릴리스마다 +1
VERSION_NAME=1.0
```

### .gitignore 확인

이미 처리됨:
```
android/keystore.properties
android/keystore/
*.jks
*.keystore
```

`debug.keystore` 는 예외로 커밋 (SHA-1 안정 목적).

---

## 1. 매 릴리스마다

### Step 1: 코드 변경 후 dist 빌드 + Capacitor sync

```bash
npm run android:build
```

내부적으로:
```
vue-tsc -b && vite build         # dist/ 생성
npx cap sync android             # dist → android/app/src/main/assets/public/
```

### Step 2: VERSION_CODE / VERSION_NAME 업데이트

`android/keystore.properties` 의 `VERSION_CODE` +1 (필수, 같으면 폰이 거부).
`VERSION_NAME` 도 의미 있는 변경 시 갱신 (e.g. `1.0` → `1.1`).

### Step 3: AAB 빌드

옵션 A — npm script:
```bash
npm run android:bundle
```

옵션 B — Android Studio:
1. Android Studio 열기 (`npm run android`)
2. Build → Generate Signed Bundle / APK → Android App Bundle
3. keystore 정보는 `keystore.properties` 에서 자동 인식

옵션 C — gradlew:
```bash
cd android
./gradlew bundleRelease         # Linux/macOS
gradlew.bat bundleRelease       # Windows
```

산출물: `android/app/build/outputs/bundle/release/app-release.aab`

### Step 4: AAB 검증

```bash
# bundletool 로 디바이스 호환성 확인 (선택)
bundletool build-apks --bundle=app-release.aab --output=app.apks
bundletool install-apks --apks=app.apks
```

### Step 5: Play Console 업로드

자세히: [../play-store/release-checklist.md](../play-store/release-checklist.md)

---

## 디버그 vs 릴리스

| 항목 | 디버그 (CI) | 릴리스 |
|---|---|---|
| keystore | `app/debug.keystore` (커밋) | `keystore/release.jks` (백업) |
| 서명 SHA-1 | 안정 (Firebase 등록됨) | 별도 — **Firebase 콘솔 추가 등록 필요** |
| 산출물 | `app-debug.apk` | `app-release.aab` |
| minify | 비활성 | 비활성 (현재) — 향후 활성 고려 |
| 설치 | 폰에 직접 (개발자 옵션) | Play Console 업로드 |
| 광고 | test ID 강제 (`import.meta.env.DEV`) | 실제 광고 단위 ID |

### Google 로그인 동작 조건

- 디버그 빌드: `app/debug.keystore` SHA-1 → Firebase 콘솔에 등록되어 있음
- 릴리스 빌드: `keystore/release.jks` SHA-1 → **추가 등록 필요**

릴리스 키 SHA-1 확인:
```bash
keytool -list -v -keystore android/keystore/release.jks -alias climetop
```

출력의 `SHA1:` 줄을 Firebase Console → 프로젝트 설정 → 일반 → "내 앱" → 안드로이드 앱 → 디지털 지문 추가에 입력.

---

## ProGuard / minify

현재 `minifyEnabled false`. 출시 시 활성화 권장:

```gradle
buildTypes {
  release {
    minifyEnabled true
    shrinkResources true
    proguardFiles getDefaultProguardFile('proguard-android.txt'), 'proguard-rules.pro'
  }
}
```

활성화 시 Capacitor + Firebase 의 reflection 호출이 제거될 수 있어 `proguard-rules.pro` 에 keep 규칙 추가 필요. 단계적 적용 권장.

---

## 알려진 제약

- 키스토어 분실 시 복구 불가 — 백업 필수 (USB / 클라우드 양쪽)
- 같은 `VERSION_CODE` 로 빌드 시 폰이 거부 (덮어쓰기 불가)
- Play Console 첫 업로드는 며칠~몇 주 검토 (앱 정책 검수)
- 64bit APK 분할은 AAB 가 자동 처리 — 별도 작업 불필요
