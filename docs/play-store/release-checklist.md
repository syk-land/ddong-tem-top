# Play Store 출시 체크리스트

## 0. 개발자 계정

- [ ] Google Play Console 개발자 계정 등록 ($25 USD 일회성, 신용카드 필요)
- [ ] 신원 확인 완료 (정부 발급 신분증 업로드)
- [ ] 결제 수신 계정 등록 (수익 받으려면 — 추후 가능)

## 1. AdMob

- [x] AdMob 앱 등록 (`ca-app-pub-6410281118825145~7146412752`)
- [x] 광고 단위 3개 생성 (부활/4배속/자동진입)
- [x] 코드 통합 (`src/lib/ads.ts` + AndroidManifest.xml)
- [ ] **AdMob ↔ Google Play Console 연결** (수익 분석 통합용)
- [ ] (선택) ads.txt 파일 호스팅 (광고 사기 방지 인증)

## 2. 코드 / 빌드

- [x] AdMob 플러그인 설치 (`@capacitor-community/admob`)
- [x] 광고 단위 ID 입력
- [x] 등반당 광고 1회 제한 (`adFastSpeedUnlocked` / `adAutoEnterUnlocked`)
- [ ] **`npx cap sync android`** 실행 — plugin native 코드 반영
- [ ] Android Studio 에서 release AAB 빌드 (서명 keystore 필요)
- [ ] 실제 디바이스 테스트 (test 광고 확인 — debug 빌드)

## 3. 스토어 등록 정보

- [ ] 앱 이름 (한국어 + 영어)
- [ ] 간단한 설명 + 자세한 설명 (`docs/play-store/store-listing.md` 참고)
- [ ] 앱 아이콘 512×512 — 이미 있음
- [ ] Feature graphic 1024×500 — **만들어야 함**
- [ ] 스마트폰 스크린샷 최소 2장 — **캡쳐 필요**
- [ ] 카테고리: 게임 > 롤플레잉
- [ ] 콘텐츠 등급 설문 완료

## 4. 정책 문서

- [ ] **개인정보 처리방침 URL** — `docs/play-store/privacy-policy.html` 을 GitHub Pages 또는 외부에 호스팅
  - 추천: GitHub 저장소 Settings → Pages → `/docs` 폴더 활성화
  - 결과 URL 예: `https://syk-genon.github.io/climetop/play-store/privacy-policy.html`
- [ ] 데이터 안전성 신고 작성 (`store-listing.md` 참고)
- [ ] 광고 ID 사용 신고 (AdMob 사용으로 "예")

## 5. 첫 출시

- [ ] 서명된 AAB 업로드 (Internal testing 트랙)
- [ ] 테스터 이메일 등록 (최대 100명)
- [ ] 테스터 링크 공유 → 1~2일 검토
- [ ] 검토 통과 → Closed testing 또는 Production 진행

## 6. 출시 후

- [ ] AdMob 보고서에서 광고 노출/수익 확인
- [ ] Play Console 통계 — 다운로드, 충돌, 평점
- [ ] 첫 1주 모니터링 (낮은 별점이 누적되지 않게 빠른 패치)
