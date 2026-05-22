# Play Store 스토어 등록 정보 초안

> Play Console → 앱 → "스토어 등록정보" 에 입력할 항목을 한 곳에 정리.
> 한국어 / 영어 둘 다 등록 권장 (Play Console 다국어 지원).

---

## 앱 기본 정보

| 항목 | 값 |
|---|---|
| 앱 이름 (한국어) | 이번 판은 똥템으로 탑을 오르겠습니다 |
| 앱 이름 (영어) | Climetop — Trash Gear Tower Climb |
| 패키지명 | `com.climetop.app` |
| 카테고리 | 게임 → 롤플레잉 (또는 시뮬레이션) |
| 가격 | 무료 |
| 인앱 결제 | 없음 |
| 광고 포함 | 예 (보상형만 — 부활·속도·자동진입) |

## 간단한 설명 (80자 이내)

**한국어**
> 똥템으로도 100층 탑을 오를 수 있을까? 5스탯 굴림 + 16티어 장비 + 챌린지 로그라이크.

**English**
> Climb 100 floors with trash gear. Roll 5 stats, pick a challenge, see how high you can go.

## 자세한 설명

**한국어**
```
탑 100층을 영구 사망 룰로 오르는 한 손 로그라이크.

- 주사위 5스탯 굴림 (힘/민첩/체력/마력/행운, 3회 굴림)
- 16티어 장비 (4 등급 × 4 특성) — 같은 등급 안에서도 운빨로 능력이 갈림
- 30+ 챌린지 — 마법무기만, 로브만, 한방형만 등 빌드 강제 + 큰 보상
- 자동 전투 — 1/2/4 배속 + 자동 진입 옵션 (광고 1회)
- 사망 시 광고 1번으로 부활 가능 (등반당 1회)
- Google 로그인 → 클리어 기록 클라우드 백업

한 판 5~15분. 가벼운 머리 풀기 + 깊이 있는 빌드 전략.
```

**English**
```
A one-hand roguelike where you climb a 100-floor tower under permadeath rules.

- Dice-based 5 stats (STR/AGI/CON/MAG/LUCK), 3 rerolls
- 16-tier equipment (4 grades × 4 traits) — same grade items vary by RNG
- 30+ challenges — magic-only, robe-only, heavy-only, etc. — strict build constraints with big rewards
- Auto combat with 1/2/4× speed + auto-enter (single ad to unlock per run)
- Watch ad once per run to revive at death
- Google sign-in for cloud backup of clear records

5–15 min per run. Light brain candy with deep build strategy.
```

## 콘텐츠 등급 — 예상 답변

| 항목 | 답변 |
|---|---|
| 폭력 | 비현실적 판타지 폭력 (텍스트 로그 기반 전투). 피·고어 묘사 없음. |
| 성적 콘텐츠 | 없음 |
| 도박 | **없음** — 보상형 광고는 게임 내 보상 교환 용도, 시뮬레이션 도박 아님 |
| 욕설 | 없음 |
| 사용자 생성 콘텐츠 | 없음 |
| 사용자 간 상호작용 | 없음 (싱글 플레이 + 클라우드 백업만) |
| 위치 정보 | 없음 |
| 디지털 구매 | 없음 |

→ 예상 등급: 만 12세 이상 (또는 IARC 기준에 따라 ESRB E10+ 비슷)

## 데이터 안전성 신고 — 예상 답변

| 항목 | 수집 | 사용 | 공유 | 비고 |
|---|---|---|---|---|
| 이름 (Google displayName) | 예 | 앱 기능 (사용자 식별) | 아니오 | 로그인 시에만 |
| 이메일 (Google email) | 예 | 앱 기능 (사용자 식별) | 아니오 | 로그인 시에만 |
| 프로필 사진 URL | 예 | 앱 기능 (UI 표시) | 아니오 | 로그인 시에만 |
| 사용자 ID (Firebase UID) | 예 | 앱 기능 (클라우드 동기화) | 아니오 | 로그인 시에만 |
| 광고 식별자 (AAID) | 예 | 광고 표시 | 예 (Google AdMob) | 보상형 광고만 |
| 진단 정보 (Crashlytics 등) | 아니오 | — | — | 미사용 |

- **수집 안 함**: 이름·이메일 외 개인 식별 정보, 메시지/통신 내용, 사진/영상, 음성, 정확한 위치, 건강/운동 정보
- **전송 시 암호화**: 예 (HTTPS)
- **데이터 삭제 요청 방법**: 앱 내 "설정 → 모든 데이터 리셋" 또는 이메일 문의

## 그래픽 자산 — 준비 필요

| 자산 | 사양 | 상태 |
|---|---|---|
| 앱 아이콘 | 512×512 PNG (32bit) | ✅ `android/app/src/main/res/mipmap-*/ic_launcher.png` 있음 |
| Feature graphic | 1024×500 JPG/PNG | ❌ 만들어야 함 (메인 일러스트 + 타이틀 합성) |
| 스마트폰 스크린샷 | 16:9 ~ 9:16, 최소 320px, 최대 3840px (2~8장) | ❌ Capture 필요 (메인메뉴/캐릭터생성/전투/상점/사망/클리어) |
| 7인치 태블릿 / 10인치 태블릿 (선택) | 권장 | ❌ |

## URL 항목

| 항목 | 값 (출시 전 입력) |
|---|---|
| 웹사이트 (선택) | `(github.io 페이지 가능)` |
| 이메일 (필수) | `(연락처)` |
| **개인정보 처리방침 URL** (필수) | `docs/play-store/privacy-policy.html` 호스팅 — GitHub Pages 추천 |

## 출시 트랙 단계

1. **내부 테스트** (Internal testing) — 최대 100명, 즉시 배포 가능
2. **비공개 테스트** (Closed testing) — 초대 명단 / 그룹 기반, 첫 production 전에 권장
3. **공개 테스트** (Open testing) — 누구나 옵트인
4. **프로덕션** (Production) — 일반 공개. 첫 출시는 며칠~몇 주 검토

**권장 흐름**: Internal → Closed (1주) → Production
