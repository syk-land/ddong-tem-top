# Climetop 시스템 문서 인덱스

> 시스템별 세부 문서. 전체 게임 디자인은 [`../DOCS.md`](../DOCS.md), 밸런스 수치는 [`../BALANCE.md`](../BALANCE.md).

---

## 시스템 목차

### 핵심
- [overview.md](systems/overview.md) — 시스템 맵 + 코드-문서 매핑
- [stats.md](systems/stats.md) — 5스탯 → 실효 스탯 산출
- [combat.md](systems/combat.md) — 전투 틱/데미지/마법 계산
- [character-creation.md](systems/character-creation.md) — 캐릭터 생성 흐름

### 장비
- [items.md](systems/items.md) — 무기 34종 + 갑옷 4종 + 등급 + 티어 + 벨류
- [traits.md](systems/traits.md) — 특성 시스템 (하급/보통/희귀/특별)
- [skills.md](systems/skills.md) — 19종 스킬 + 자동 발동률

### 컨텐츠
- [chapters.md](systems/chapters.md) — 11 테마 + 챕터/플로어 생성
- [monster-traits.md](systems/monster-traits.md) — 40+ 몬스터 행동
- [status-effects.md](systems/status-effects.md) — 점화/둔화/감전/암흑/출혈/독/침묵
- [special-events.md](systems/special-events.md) — 6종 NPC 이벤트
- [shop.md](systems/shop.md) — 황금고블린 상점

### 메타
- [challenges.md](systems/challenges.md) — 50종 챌린지 + 추적 플래그
- [meta-bonuses.md](systems/meta-bonuses.md) — 누적 풀 + 영구 시작 보너스 + 진짜 보스

### UX
- [ui-modals.md](systems/ui-modals.md) — 화면 라우팅 + 모달 시스템
- [sound.md](systems/sound.md) — BGM/SFX

---

## 문서 작성 원칙

- 각 문서는 **현재 코드 기준** (v6 5스탯 + v6.1 마법 너프/리셋 견고화).
- 수치/공식은 가급적 코드와 일치시키고, 차이가 있으면 코드를 진실로 간주.
- 옛 버전 잔재 (v5 10스탯 등)는 `meta.ts:migrateAllocations` 마이그레이션 코드에만 존재.
