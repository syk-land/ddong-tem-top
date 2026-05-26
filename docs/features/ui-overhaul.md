# 모바일 UI 전체 정비

> 색 액센트 톤 통일 + 카드 위계 + 탭 모달 + 전투력 % 비교. 모바일 한 손 사용에 최적화.

코드: `src/styles/main.css`, `src/ui/colors.ts`, `src/ui/components/`, Tailwind config (`tailwind.config.js`)

---

## 디자인 토큰

### 액센트 컬러

| 색상 | 용도 |
|---|---|
| `rose` | 위험 / 적 / 사망 |
| `cyan` | 정보 / 자기 능력 |
| `amber` | 골드 / 보상 |
| `emerald` | 회복 / 성공 |
| `pink` | 상태이상 출혈 |
| `purple` | 마법 / 마력 / 마법공격 |

`src/ui/colors.ts` 에 등급/티어/상태별 색상 매핑이 정의되어 있다. Tailwind 의 컬러 토큰과 직접 매칭.

### 카드 위계

```
section header  →  bg-zinc-800 + 굵은 텍스트
card            →  bg-zinc-900 + 1px ring
item slot       →  bg-zinc-950 + 등급 색상 ring
button primary  →  cyan / emerald
button danger   →  rose
button secondary→  zinc-700
```

---

## 탭 모달

`StatusModal` / `InventoryModal` 에 탭 도입:

- StatusModal: 능력치 / 상태이상 / 장착 / 챌린지
- InventoryModal: 착용 중 / 보관함

탭 클릭 시 컨텐츠 영역만 교체 — 스크롤 위치 초기화.

---

## 전투력 % 비교

`ItemDetail` 모달에서 무기/갑옷 교체 시:

```
현재 무기 공격력: 120.5
교체할 무기 공격력: 145.3
   → "공격력 +20.6%" 표시 (캐릭터 총합 기준)
```

캐릭터 총합 (스탯 + 장비) 의 절댓값 변화율을 표시 — 단순 baseAtk 비교가 아니라 실효 공격력 변화.

---

## HpMpBar

- 25% 이하 깜빡임 (rose 액센트)
- 0% 도달 시 자동 숨김 (UI 정리)
- HP / MP 색상 분리 (rose / cyan)

---

## 상태 뱃지 (`StatusBadges`)

상단에 가로 스크롤 칩:

```
[🔥 점화 ×3 / 38틱] [💧 출혈 ×2 / 12틱] ...
```

각 칩은 클릭 시 상세 툴팁 (효과 / 지속 / 스택).

---

## 다크 모드 기본

`tailwind.config.js`:
- 기본은 다크 (zinc-950 배경)
- 라이트 모드 미지원 (게임 분위기상)

---

## 모바일 우선

- 터치 타겟 최소 44×44 px
- 양손 안 잡고 한 손으로 사용 가능 — 주요 액션 버튼은 하단 1/3 영역에
- 풀스크린 모달 (지정 부분만 스크롤)
- `SpeedControl` 패널은 화면 우측 상단 고정

---

## 데스크탑 호환

- 1280×800 모니터에서 최대 800×600 윈도우 시뮬레이션 (CSS clamp)
- Esc 키 = 뒤로가기 (back-button.md)
- 키보드 단축키 미지원 (전부 클릭/탭)
