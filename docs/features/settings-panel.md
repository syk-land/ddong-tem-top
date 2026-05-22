# 설정 패널 UX

> SpeedControl 전역 패널 + SettingsScreen 풀스크린. 두 곳에서 사운드/자동 기능 토글 가능.

코드: `src/ui/components/SpeedControl.vue`, `src/screens/SettingsScreen.vue`

---

## SpeedControl — 전역 패널

화면 우측 상단 고정. 모든 화면(전투/상점/던전)에서 접근 가능.

### 항목
- 게임 속도 1× / 2× / 4× (4×는 광고 1회 해금)
- 자동 진입 ON/OFF (광고 1회 해금)
- SFX 슬라이더 0~100%
- BGM 슬라이더 0~100%
- 인트로 만화 다시 보기 버튼

### UX
- 기본 **접힘** (작은 칩만 표시)
- 클릭 시 펼침
- 5초 이상 방치 시 자동 접힘
- 모달이 떠 있으면 자동으로 흐려짐 (z-index 조정)

### 저장
```
localStorage["climetop:speedControl:expanded:v2"] = "1" | "0"
```

---

## SettingsScreen — 풀스크린 설정

`MainMenu → 설정` 버튼으로 진입.

### 섹션 1: 사운드
- 효과음 (SFX) ON/OFF + 슬라이더 0~100%
- 배경음 (BGM) ON/OFF + 슬라이더 0~100%

### 섹션 2: 클라우드 저장
- Google 로그인 / 로그아웃 버튼
- 클리어 횟수 동기화 상태 표시
- 자세히: [firebase-auth.md](firebase-auth.md)

### 섹션 3: 게임
- 인트로 만화 다시 보기 — `introFlow = 'replay'` 로 시작
- 모든 데이터 리셋 — [data-reset.md](data-reset.md) 참고

### 섹션 4: 정보 (선택)
- 버전 표시 (`package.json` versionName)
- 라이선스 / 크레딧 (현재 미작성)

---

## 모달 위에서 자동 흐려짐

SpeedControl 은 z-index 가 모달보다 낮음:

```css
z-index:
  modal-base:    50
  speed-control: 30
  intro-comic:   60
```

모달이 떠 있을 때 패널은 50% 투명도로 자동 흐려짐 → 시각적 우선순위 명확.

---

## 알려진 제약

- 닉네임 편집 UI 없음 (Google displayName 그대로)
- 언어 설정 없음 (한국어 단일)
- 그래픽 옵션 없음 (CSS / 이미지 only — 별도 설정 필요 없음)
