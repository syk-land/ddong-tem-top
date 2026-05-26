# 시스템 다크모드 강제 변환 차단

> 게임은 자체 다크 테마. 모바일 브라우저의 force-dark 자동 변환이 추가로 화면을 어둡게 만들어 글씨가 묻히는 현상을 차단.

코드:
- `index.html` — `<meta name="color-scheme" content="dark">` + `supported-color-schemes`
- `src/styles/main.css` — `html { color-scheme: dark only }`

---

## 증상

모바일 브라우저(주로 Samsung Internet, Android Chrome)에서 시스템 다크모드를 켜고 게임을 열면:
- 캐릭터 생성 / 던전 / 전투 등 전반적으로 화면이 평소보다 어두움
- 일부 회색 계열 글씨(가격, 챌린지 부제목 등)가 배경에 묻혀 안 보임
- 메인 일러스트 위 글씨 가독성 떨어짐

원인: 모바일 브라우저의 "force dark" 기능이 라이트 테마 페이지를 자동으로 어둡게 변환하는 기능을 이미 다크인 페이지에도 적용 → 색상이 한 번 더 어두워짐.

---

## 2중 안전망

| 위치 | 변경 | 효과 |
|---|---|---|
| `index.html` (`<meta>`) | `color-scheme: dark` 선언 | 브라우저에 "이미 다크" 신호 → 추가 변환 스킵 |
| `src/styles/main.css` (`html`) | `color-scheme: dark only` CSS | `only` 키워드로 Samsung Internet 의 강제 변환까지 차단 |

---

## 검증 방법

| 플랫폼 | 방법 |
|---|---|
| 데스크탑 브라우저 | OS 다크모드 ON → 새로고침 → 추가 변환이 일어나지 않는지 확인 |
| 모바일 (Android Chrome / Samsung Internet) | 시스템 다크 테마 ON → 페이지 열기 → 빌드 의도와 동일한 색감 확인 |
