# 시스템 개요

> 시스템별 세부 문서 인덱스. 전체 게임 디자인은 [DOCS.md](../../DOCS.md), 밸런스 수치는 [BALANCE.md](../../BALANCE.md) 참고.

---

## 시스템 맵

```
캐릭터 생성 ─┬─ 5스탯 (힘/민첩/체력/마력/행운)
            ├─ 주사위 3회 (50pt 랜덤 분배)
            ├─ 누적 보너스 풀 (1~10pt × n)
            └─ 챌린지 3개 중 1개 선택

탑 진행   ─┬─ 10챕터 × 10층
          ├─ 11 테마 (고블린/골렘/언데드/.../맹독)
          └─ 일반 / 보스 / 상점 / 보물 / 회복샘 / 특별이벤트

전투      ─┬─ 게이지 누적 자동 턴제
          ├─ 19종 스킬 자동 발동 (무기/갑옷 묶임)
          ├─ 7종 상태이상 (점화/둔화/감전/...)
          └─ 40+ 몬스터 trait

장비      ─┬─ 무기 34 (물리 13 + 마법 21)
          ├─ 갑옷 4
          ├─ 등급 4 (노말/레어/스페셜/레전드)
          └─ 특성 티어 4 (하급/보통/희귀/특별)

메타      ─┬─ 누적 보너스 풀 (영구 누적)
          ├─ 누적 골드 5만 → 진짜 보스 도전
          └─ 진짜 보스 깎은 % × 60pt → 영구 시작 보너스
```

---

## 문서 목록

### 핵심 시스템
- [stats.md](stats.md) — 5스탯 → 실효 스탯 산출
- [combat.md](combat.md) — 전투 틱/데미지 계산
- [character-creation.md](character-creation.md) — 주사위/챌린지/보너스 분배

### 장비
- [items.md](items.md) — 무기/갑옷 + 등급 + 특성 + 클리어 점수
- [traits.md](traits.md) — 무기/갑옷 특성 효과 명세
- [skills.md](skills.md) — 19종 스킬 + 자동 발동률

### 컨텐츠
- [chapters.md](chapters.md) — 11 테마 + 챕터/플로어 생성
- [monster-traits.md](monster-traits.md) — 40+ 몬스터 행동
- [status-effects.md](status-effects.md) — 점화/둔화/감전/암흑 등
- [special-events.md](special-events.md) — 대장장이/룰렛/제단/암시장/모험가/수집가
- [shop.md](shop.md) — 황금고블린 상점

### 메타
- [challenges.md](challenges.md) — 50종 챌린지
- [meta-bonuses.md](meta-bonuses.md) — 누적 보너스 + 진짜 보스

### UX
- [ui-modals.md](ui-modals.md) — 화면 라우팅 + 모달 시스템
- [sound.md](sound.md) — BGM/SFX

---

## 코드 ↔ 문서 매핑

| 시스템 | 데이터 | 로직 | 문서 |
|---|---|---|---|
| 스탯 | — | `core/stats.ts` `core/character.ts` | [stats.md](stats.md) |
| 전투 | — | `core/combat.ts` | [combat.md](combat.md) |
| 무기 | `data/weapons.ts` | `core/items.ts` `core/itemValue.ts` | [items.md](items.md) |
| 갑옷 | `data/armor.ts` | `core/items.ts` | [items.md](items.md) |
| 특성 | `data/traits.ts` | `core/items.ts` | [traits.md](traits.md) |
| 스킬 | `data/skills.ts` | `core/skills.ts` `core/buildBalance.ts` | [skills.md](skills.md) |
| 상태이상 | `data/statuses.ts` | `core/status.ts` | [status-effects.md](status-effects.md) |
| 챕터 | `data/chapters.ts` | `core/tower.ts` | [chapters.md](chapters.md) |
| 몬스터 trait | (in `data/chapters.ts` template) | `core/monsterTraits.ts` | [monster-traits.md](monster-traits.md) |
| 이벤트 | — | `core/events.ts` | [special-events.md](special-events.md) |
| 상점 | — | `core/shop.ts` | [shop.md](shop.md) |
| 챌린지 | `data/challenges.ts` | `core/challengeRuntime.ts` | [challenges.md](challenges.md) |
| 메타 | — | `core/meta.ts` `core/realboss.ts` | [meta-bonuses.md](meta-bonuses.md) |
