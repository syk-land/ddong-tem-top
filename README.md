# 이번 판은 똥템으로 탑을 오르겠습니다

100층 로그라이크 탑 등정 RPG (Android + PC)

## 핵심 게임플레이

- 100층 = 10 챕터 × 10층
- 11개 챕터 테마 풀에서 5개 무작위 선택 (1~5 기본 / 6~10 강화)
- 영구 사망 (Permadeath)
- **클리어 등급 시스템 (F~EX)**: 저티어 장비 + 골드 보존 + HP 잔존이 높을수록 EX 등급에 가까워지고 다음 캐릭터에 누적 보너스 스탯 1~10pt 자유 분배 지급
- **챌린지 시스템**: 캐릭터 생성 시 3개 랜덤 챌린지 중 1개 선택 (즉시 보상형 25 + 리스크 베팅형 25 = 총 50개)
- **실시간 성장 패널티 시각화**: 현재 장비 기준 다음 회차 보너스 예상 등급/포인트 실시간 표시

## 기술 스택

- Vue 3 + TypeScript + Vite
- Pinia (상태관리)
- Tailwind CSS (스타일링)
- Capacitor (Android 패키징)

## 실행

### 개발 서버 (PC 브라우저)
```bash
npm install
npm run dev
```
브라우저에서 http://localhost:5173 접속.

### 프로덕션 빌드
```bash
npm run build
```
`dist/` 폴더에 정적 파일 생성.

### Android 빌드 (Capacitor)
초기 셋업:
```bash
npx cap init
npx cap add android
```

빌드 + 동기화:
```bash
npm run android:build
```

Android Studio 열기:
```bash
npm run android
```

## 디렉토리 구조

```
src/
├── data/           # 정적 게임 데이터 (무기/갑옷/트레잇/스킬/상태이상/챕터/챌린지)
├── core/           # 게임 로직 (캐릭터/아이템/전투/스킬/상태이상/탑/이벤트/메타/챌린지)
├── stores/         # Pinia 스토어 (game)
├── ui/
│   ├── colors.ts   # 색상 시스템 (등급/트레잇/상태이상/스탯/로그 등)
│   └── components/ # 재사용 UI 컴포넌트
├── screens/        # 화면 컴포넌트 (메뉴/캐릭터생성/던전/전투/상점/승리/사망)
├── styles/main.css # Tailwind 진입점 + 커스텀 클래스
└── types/          # TypeScript 타입 정의
```

## 게임 디자인

자세한 게임 디자인은 `tower-rpg-design.md` 참조 (669줄, 12 섹션).

## 라이센스

개인 프로젝트.
