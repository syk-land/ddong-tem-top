# 시스템 개요

> 시스템별 세부 문서 인덱스. 전체 게임 디자인은 [`../../DOCS.md`](../../DOCS.md), 밸런스 수치는 [`../../BALANCE.md`](../../BALANCE.md), 게임 서사는 [DOCS §0](../../DOCS.md#0-게임-서사-진짜-스토리).

---

## 시스템 맵

```
                 ─ [서사 / 시간의 신] ─
                          ↕
캐릭터 생성 ─┬─ 5스탯 (힘/민첩/체력/마력/행운, 12 균등 = 60pt)
            ├─ 주사위 3회 (60pt 랜덤 분배)
            ├─ 누적 보너스 풀 (시간의 신이 적립한 영구 능력치)
            └─ 챌린지 3개 중 1개 선택

탑 진행   ─┬─ 10챕터 × 10층 (각성 꿈공간)
          ├─ 11 테마 풀에서 무작위 (고블린/골렘/언데드/.../맹독)
          └─ 노드: 일반 / 보스 / 상점 / 보물 / 회복샘 / 특별이벤트

전투      ─┬─ 게이지 누적 자동 턴제 (틱 = 무기 ticks 임계)
          ├─ 19종 스킬 자동 발동 (무기/갑옷에 묶임)
          ├─ 갑옷 자동 반응 (피격 시, 가죽갑/로브/판금)
          ├─ 6종 상태이상 (점화/출혈/독/둔화/암흑/감전)
          └─ 31종 몬스터 trait (소환/반사/분열/자폭/회복 간섭 등)

장비      ─┬─ 무기 15 (근접 9 + 활 3 + 마법 3)
          ├─ 갑옷 4
          ├─ 등급 4 (노말 1.5 / 레어 2.3 / 스페셜 3.0 / 레전드 4.3)
          └─ 특성 티어 4 × 등급 4 = 16티어

메타      ─┬─ 누적 클리어 보너스 풀 (영구, 0 리셋 없음)
          ├─ 캐릭터 히스토리 (최대 50건)
          ├─ 누적 골드 5만 → 진짜 보스 도전 (= 현실 통로)
          └─ 진짜 보스 깎은 % × 60pt → 영구 시작 보너스 (시간의 신 회귀)
```

---

## 문서 목록

### 핵심 시스템
- [stats.md](stats.md) — 5스탯 → 실효 스탯 산출
- [combat.md](combat.md) — 전투 틱 / 데미지 / 명중·크리 / 갑옷 자동 반응
- [character-creation.md](character-creation.md) — 주사위 / 챌린지 / 보너스 분배

### 장비
- [items.md](items.md) — 무기 15 + 갑옷 4 + 등급/티어 + 자동 벨류
- [traits.md](traits.md) — 무기 14 + 갑옷 15 특성 (4티어)
- [skills.md](skills.md) — 19종 스킬 + 자동 발동률

### 컨텐츠
- [chapters.md](chapters.md) — 11 테마 + 챕터/플로어 생성
- [monster-traits.md](monster-traits.md) — 31종 몬스터 행동
- [status-effects.md](status-effects.md) — 6종 상태이상
- [special-events.md](special-events.md) — 6종 NPC 이벤트
- [shop.md](shop.md) — 상점 슬롯/새로고침

### 메타
- [challenges.md](challenges.md) — 40종 챌린지 + 추적 플래그
- [meta-bonuses.md](meta-bonuses.md) — 누적 풀 / 영구 시작 보너스 / 진짜 보스 (시간의 신 사이클)

### UX
- [ui-modals.md](ui-modals.md) — 화면 라우팅 + 모달 시스템 (11종)
- [sound.md](sound.md) — BGM 2종 + Web Audio API SFX

---

## 코드 매핑

| 시스템 | 핵심 파일 |
|---|---|
| 5스탯 → 실효 | `src/core/stats.ts` |
| 전투 틱 | `src/core/combat.ts` |
| 스킬 실행 | `src/core/skills.ts` |
| 상태이상 | `src/core/status.ts` |
| 아이템 생성 | `src/core/items.ts` |
| 아이템 벨류 | `src/core/itemValue.ts` |
| 탑 / 노드 생성 | `src/core/tower.ts` |
| 몬스터 trait | `src/core/monsterTraits.ts` |
| 특별 이벤트 | `src/core/events.ts` |
| 상점 | `src/core/shop.ts` |
| 챌린지 | `src/core/challengeRuntime.ts` + `src/data/challenges.ts` |
| 메타 / 진짜 보스 | `src/core/meta.ts` + `src/core/realboss.ts` |
| 자동 발동률 | `src/core/buildBalance.ts` |
| 등급 임계값 | `src/core/scoreThresholds.ts` |
| 전역 store | `src/stores/game.ts` |
