# 자동 진입

> 광고 1회로 등반당 해금. 일반 몬스터 / 보스 / 회복샘 자동 진입 + 전투 종료 후 자동 다음 층.

코드: `src/stores/game.ts` (`autoEnter` / `adAutoEnterUnlocked`), `src/screens/Dungeon.vue`, `src/screens/Combat.vue`, `src/lib/ads.ts`

---

## 동작

```
[Dungeon 화면]
   ├─ autoEnter = true 인 노드: 일반 몬스터 / 보스 / 회복샘
   │   → 1초 대기 후 자동 진입 (취소 가능)
   └─ 수동 노드: 상점 / 보물 / 특별 이벤트
       → 사용자가 직접 카드 클릭

[Combat 종료]
   └─ autoEnter 면 자동으로 Dungeon 으로 복귀 → 다음 층 자동 진입
```

---

## 해금 조건 (광고)

```
adAutoEnterUnlocked = false     // 런 시작 시
   └─ SpeedControl 의 "자동 진입" 토글
       ├─ Off → 광고 미시청 상태
       └─ On 클릭 → 광고 1회 → 시청 완료 시 unlocked = true
```

- 한 번 unlock 되면 런 끝까지 유지
- 새 캐릭터 생성 시 다시 false
- 웹/dev 환경에서는 광고 fallback (즉시 보상)

광고 단위: `PROD_AD_UNIT_AUTO_ENTER` (`src/lib/ads.ts`)

---

## 토글 (`autoEnter`)

```
localStorage["climetop:autoEnter:v1"] = "1" | "0"
```

런마다 재설정. 해금 후엔 토글 자유.

---

## 노드별 자동 진입 정책

| 노드 | 자동 진입 |
|---|---|
| 일반 몬스터 | ✅ |
| 보스 | ✅ |
| 회복샘 | ✅ |
| 상점 | ❌ (수동 — 구매 결정이 필요) |
| 보물 | ❌ (수동 — 미믹 위험) |
| 특별 이벤트 | ❌ (수동 — NPC 선택지) |

전투/회복샘 노드는 그냥 클리어/회복이라 자동화 가능, 나머지는 의사결정 필요.

---

## 4배속과의 관계

`combatSpeed` (1 / 2 / 4) 와 `autoEnter` 는 별개 토글:

- 4배속: 광고 1회 별도 해금 (`adFastSpeedUnlocked`)
- 자동 진입: 광고 1회 별도 해금 (`adAutoEnterUnlocked`)
- 둘 다 해금하면 풀 자동 모드 — 사용자가 화면만 보면 알아서 진행

---

## 취소

자동 진입 카운트다운 (1초) 동안:
- 다른 카드 클릭 → 그쪽 진입
- 자동 진입 토글 끔 → 취소
- 뒤로가기 / Esc → 취소

---

## 알려진 제약

- 보스가 너무 강해서 자동 진입하면 사망할 수도 있다 — 사용자 책임
- 보물 (미믹 전투) 는 자동화 안 됨 — 신중한 선택을 위해
- 광고 시청 실패 시 (네트워크 오류 등) 토글 활성화 안 됨, 다시 시도 가능
