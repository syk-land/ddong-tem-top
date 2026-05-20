# 안드로이드 릴리스 서명 + versionCode 자동 증가

## 개요
디버그 키스토어로 서명한 빌드는 같은 패키지명이라도 PC가 바뀌면 폰에 덮어쓰기 설치가 안 된다. 한 번 만든 릴리스 키스토어로 매번 서명하고 `versionCode`만 +1 하면 같은 폰에 계속 덮어쓰기 가능.

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
```

## 첫 1회만 주의
지금 폰에 깔린 앱은 디버그 키로 서명됐을 가능성이 큼. 첫 릴리스 APK 설치 시 한 번 기존 앱을 제거하고 설치해야 한다. 이후부터는 같은 키스토어로 서명되므로 덮어쓰기 OK.

## 관련 파일
- `android/app/build.gradle`
- `android/keystore.properties.example`
- `.gitignore`
