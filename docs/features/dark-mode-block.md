# 시스템 다크모드 강제 변환 차단

> 게임은 자체 다크 테마. 스마트폰 시스템 다크모드 ON 상태에서 Android WebView 의 force-dark 자동 변환이 추가로 화면을 어둡게 만들어 글씨가 묻히는 현상을 차단.

코드:
- `index.html` — `<meta name="color-scheme" content="dark">` + `supported-color-schemes`
- `src/styles/main.css` — `html { color-scheme: dark }`
- `android/app/src/main/res/values/styles.xml` — `android:forceDarkAllowed="false"`

---

## 증상

스마트폰을 다크모드로 두고 게임을 켜면:
- 캐릭터 생성 / 던전 / 전투 등 전반적으로 화면이 평소보다 어두움
- 일부 회색 계열 글씨(가격, 챌린지 부제목 등)가 배경에 묻혀 안 보임
- 메인 일러스트 위 글씨 가독성 떨어짐

원인: Android WebView (API 29+) 의 "force dark" 기능이 라이트 테마 페이지를 자동으로 어둡게 변환하는 기능을 이미 다크인 페이지에도 적용 → 색상이 한 번 더 어두워짐. iOS 도 비슷한 prefers-color-scheme 변환 이슈 가능.

---

## 3중 안전망

| 위치 | 변경 | 효과 |
|---|---|---|
| `index.html` (`<meta>`) | `color-scheme: dark` 선언 | 브라우저/WebView 에 "이미 다크" 신호 → 추가 변환 스킵 |
| `src/styles/main.css` (`html`) | `color-scheme: dark` CSS | meta 무시하는 일부 환경 커버 |
| `android/app/.../styles.xml` (`AppTheme.NoActionBar`) | `android:forceDarkAllowed="false"` | Android 10+ 에서 WebView 강제 다크화 비활성 (가장 확실) |

---

## 검증 방법

| 플랫폼 | 방법 |
|---|---|
| 데스크탑 브라우저 | OS 다크모드 ON → 새로고침 → 추가 변환이 일어나지 않는지 확인 |
| 안드로이드 | 시스템 설정 → 다크 테마 ON → 앱 재실행 → 색상이 빌드 의도와 동일한지 확인 |

styles.xml 변경은 네이티브 빌드 (`npm run android:build`) 가 필요 — CSS / meta 만으로도 대부분 케이스 커버되지만 100% 보장은 native 까지 적용해야 함.
