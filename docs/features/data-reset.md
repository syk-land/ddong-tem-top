# 데이터 리셋

> 모든 localStorage 키 비우고 새로고침 — 인트로 만화도 재표시. 클라우드 동기화 데이터는 별도 처리.

코드: `src/screens/SettingsScreen.vue`

---

## 진입

```
MainMenu → 설정 (Settings) → "모든 데이터 리셋" 버튼
   └─ 확인 다이얼로그
       └─ 확인 → localStorage 전체 제거 + window.location.reload()
```

---

## 제거 대상

localStorage 키 전체:

| 키 | 내용 |
|---|---|
| `climetop:meta:v1` | 누적 보너스 / 진짜 보스 상태 |
| `climetop:run:v1` | 진행 중 런 |
| `climetop:creation:v1` | 캐릭터 생성 임시 상태 |
| `climetop:tutorialSeen:v1` | 인트로 만화 시청 완료 → 재표시됨 |
| `climetop:speed:v1` | 게임 속도 |
| `climetop:autoEnter:v1` | 자동 진입 토글 |
| `climetop:speedControl:expanded:v2` | 설정 패널 펼침 상태 |
| `climetop:sound:v1` | 사운드 설정 |

```ts
// 구현 — climetop: prefix 전체 삭제
for (const k of Object.keys(localStorage)) {
  if (k.startsWith('climetop:')) localStorage.removeItem(k)
}
window.location.reload()
```

---

## 클라우드 데이터는 별도

**로컬 리셋은 Firestore 데이터를 건드리지 않음.**

- Google 로그인 상태에서 리셋 → 로컬만 초기화
- 다음 로그인 시 클라우드에서 진행도 복원됨 → 사실상 리셋 안 됨

**완전 삭제 방법**:
1. 설정 → 로그아웃
2. 모든 데이터 리셋
3. (필요 시) 서비스 운영자에게 클라우드 데이터 삭제 요청

자세한 클라우드 정책: [firebase-auth.md](firebase-auth.md)

---

## 안드로이드 시스템 레벨 리셋

- 안드로이드 설정 → 앱 → 똥템탑 → 저장공간 → 데이터 삭제
- 위는 localStorage 까지 모두 삭제 + 캐시 초기화
- 클라우드는 마찬가지로 별도

---

## 인트로 재표시

`tutorialSeen` 키가 제거되면 `App.vue` 마운트 시 `introFlow = 'first'` 로 인트로 시작.
즉 데이터 리셋 후 첫 화면은 인트로 만화.

---

## 안전 장치

- 다이얼로그 2단계 확인 (현재는 1단계)
- 진행 중 런이 있다면 경고 메시지 표시
- "정말 모든 진행도를 삭제하시겠습니까?" 메시지

---

## 향후 작업

- 클라우드 데이터까지 같이 삭제하는 "완전 리셋" 옵션
- 백업 / 복원 (export / import) 기능
