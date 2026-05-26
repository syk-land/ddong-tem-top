# Climetop 시스템 문서 인덱스

> 시스템별 세부 문서. 전체 게임 디자인은 [`../DOCS.md`](../DOCS.md), 밸런스 수치는 [`../BALANCE.md`](../BALANCE.md).

---

## 시스템 목차

### 핵심
- [overview.md](systems/overview.md) — 시스템 맵 + 코드-문서 매핑
- [stats.md](systems/stats.md) — 5스탯 → 실효 스탯 산출
- [combat.md](systems/combat.md) — 전투 틱 / 데미지 / 명중·크리 / 갑옷 자동 반응
- [character-creation.md](systems/character-creation.md) — 캐릭터 생성 흐름

### 장비
- [items.md](systems/items.md) — 무기 15종 + 갑옷 4종 + 등급 4 + 자동 벨류
- [traits.md](systems/traits.md) — 특성 시스템 (하급/보통/희귀/특별, 무기 14 + 갑옷 15)
- [skills.md](systems/skills.md) — 19종 스킬 + 자동 발동률

### 컨텐츠
- [chapters.md](systems/chapters.md) — 11 테마 + 챕터/플로어 생성
- [monster-traits.md](systems/monster-traits.md) — 31종 몬스터 행동
- [status-effects.md](systems/status-effects.md) — 6종 (점화/출혈/독/둔화/암흑/감전)
- [special-events.md](systems/special-events.md) — 6종 NPC 이벤트
- [shop.md](systems/shop.md) — 상점 슬롯/새로고침

### 메타
- [challenges.md](systems/challenges.md) — 40종 챌린지 + 추적 플래그
- [meta-bonuses.md](systems/meta-bonuses.md) — 누적 풀 + 영구 시작 보너스 + 진짜 보스 사이클

### UX
- [ui-modals.md](systems/ui-modals.md) — 화면 라우팅 + 모달 시스템
- [sound.md](systems/sound.md) — BGM (2종) / SFX (Web Audio API)

---

## 문서 작성 원칙

- 각 문서는 **현재 소스 코드 기준** (v9.x).
- 수치/공식은 항상 코드와 일치시키고, 차이가 있으면 **코드를 정답**으로 간주.
- 옛 버전 잔재 (v5 10스탯 등)는 `meta.ts:migrateAllocations` 마이그레이션 코드에만 존재.
