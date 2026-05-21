# 안드로이드 릴리스 서명 + versionCode 자동 증가

## 개요
디버그 키스토어로 서명한 빌드는 같은 패키지명이라도 PC가 바뀌면 폰에 덮어쓰기 설치가 안 된다. 한 번 만든 릴리스 키스토어로 매번 서명하고 `versionCode`만 +1 하면 같은 폰에 계속 덮어쓰기 가능.

> **참고**: 디버그 빌드도 안정 SHA-1 이 필요한 시점부터 (Google 로그인 등) `android/app/debug.keystore` 가 repo 에 커밋되어 동일 키로 서명되도록 정리됨. 자세한 내용은 [firebase-auth](./firebase-auth.md) 의 "SHA-1 안정화" 섹션 참조. 이 문서는 **release** 빌드 (Play Store/배포용) 만 다룬다.

## 셋업 (1회)
Windows PowerShell (JDK가 PATH에 있어야 함):
```powershell
cd D:\workspace\climetop\android
mkdir keystore
keytool -genkey -v -keystore keystore\release.jks -keyalg RSA -keysize 2048 -validity 10000 -alias climetop
```
- 이름/조직 등은 적당히
- **스토어 비밀번호와 키 비밀번호 메모**
- **`keystore\release.jks` 파일은 다른 안전한 곳에 백업** (잃으면 같은 패키지명으로 평생 덮어쓰기 불가)

그다음:
```powershell
copy keystore.properties.example keystore.properties
notepad keystore.properties
```
열려서 비밀번호 / alias / `VERSION_CODE` / `VERSION_NAME` 입력.

## `keystore.properties` 양식
```
KEYSTORE_FILE=keystore/release.jks
KEYSTORE_PASSWORD=...
KEY_ALIAS=climetop
KEY_PASSWORD=...
VERSION_CODE=1
VERSION_NAME=1.0
```

## 매번 릴리스 빌드
1. `keystore.properties`의 `VERSION_CODE` +1 (예: 1 → 2)
2. `npm run build`
3. `npx cap sync android`
4. Android Studio `Build > Generate Signed Bundle / APK` → release
   - 또는 CLI(Windows): `cd android && gradlew.bat assembleRelease`
5. `android/app/build/outputs/apk/release/app-release.apk` 폰에 설치

## 동작 방식
- `android/app/build.gradle` 최상단에서 `keystore.properties` 존재 여부 확인
- 있으면 `signingConfigs.release` 자동 구성 + `buildTypes.release.signingConfig` 지정
- 없으면 디버그 키 폴백 (기존 흐름 유지)
- `versionCode` / `versionName`도 properties에서 읽음

## .gitignore
다음이 git에 올라가지 않도록 제외됨:
```
android/keystore.properties
android/keystore/
*.jks
*.keystore
# 예외: 안정 SHA-1 용 dev keystore (비번 'android', 공개 정보)
!android/app/debug.keystore
```

## 첫 1회만 주의
지금 폰에 깔린 앱은 디버그 키로 서명됐을 가능성이 큼. 첫 릴리스 APK 설치 시 한 번 기존 앱을 제거하고 설치해야 한다. 이후부터는 같은 키스토어로 서명되므로 덮어쓰기 OK.

## Google 로그인용 release SHA-1 등록
release keystore 로 서명한 APK 에서 Google 로그인을 쓰려면 그 keystore 의 SHA-1 도 Firebase 콘솔에 추가 등록해야 한다 (debug keystore SHA-1 과 별개).

```powershell
keytool -list -v -keystore keystore\release.jks -alias climetop
```
출력의 SHA-1 / SHA-256 을 Firebase 콘솔 → 프로젝트 설정 → 내 앱 → Android → 디지털 지문 추가 에 등록.
등록 후 `google-services.json` 재다운로드 → `android/app/google-services.json` 덮어쓰기 → 커밋.

## 관련 파일
- `android/app/build.gradle`
- `android/keystore.properties.example`
- `.gitignore`
- [firebase-auth](./firebase-auth.md) — Google 로그인 + SHA-1 안정화 전체 흐름
