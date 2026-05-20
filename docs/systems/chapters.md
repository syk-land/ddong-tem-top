# 챕터 & 몬스터

코드: `src/data/chapters.ts` (테마/몬스터 정의), `src/core/tower.ts` (탑 생성)

---

## 11 테마

| 테마 | 컨셉 | 주요 trait |
|---|---|---|
| 고블린 | 빠른 다수 | 회피, 다수 적 출현 |
| 골렘 | 단단한 방어 | 방어 ↑↑ HP ↑ |
| 언데드 | 부활/저주 | revive_chance, heal_reduction |
| 환영 | 회피/명중 페널티 | 환영체, 명중 -페널티 |
| 흡혈귀 | 흡혈 | 흡혈, blood drain |
| 심해 | 둔화/광역 | 둔화 부여, 광역 |
| 기계 | 고방어 + 강공격 | last_stand, 강력 (후반 어려움 ★) |
| 용암 | 점화 도트 | 점화, 화염 오라 |
| 암흑 | 명중 -페널티 | blind 부여, 어둠 오라 |
| 천공 | 회피/원거리 | 회피 ↑, 원거리 공격 (후반 어려움) |
| 맹독 | 독 도트 | 독, 누적 데미지 |

각 테마는 `ChapterThemeDef`:
- `normalMonsters: MonsterTemplate[]` (일반 몬스터 풀)
- `boss: MonsterTemplate` (챕터 1~5 보스)
- `hardBoss?: MonsterTemplate` (챕터 6~10 강화 보스)

---

## 1런 = 10챕터

`makeTowerRun(character)` (tower.ts):
1. 11 테마에서 무작위 10개 선택 (셔플).
2. 챕터 1~5는 `boss` 사용, 챕터 6~10은 `hardBoss` 사용 (있는 경우, 없으면 `boss`).
3. 각 챕터 = 10층.

```
챕터 1 (고블린) — 1F ~ 10F
챕터 2 (심해)   — 1F ~ 10F
...
챕터 10 (기계)  — 1F ~ 10F  ← 100층 최종 보스
```

---

## 챕터 = 10층 구성

`tower.ts:makeChapter()` 슬롯 분배:

| 층 | 타입 |
|---|---|
| 1~9F | 무작위 (몬스터/상점/보물/회복샘/특별이벤트) |
| 10F | 챕터 보스 (확정) |

층 풀:
- `monster` (일반 몬스터, 가장 흔함)
- `boss` (10F 확정)
- `shop` (1챕터당 1~2회)
- `treasure` (미믹 가능)
- `healing_spring` (1챕터당 최대 1회, 4F 이상)
- `special_event` (1챕터당 0~2회)

회복샘은 4F 이상에 강제 배치 (저층 셔플 시 재섞임).

---

## 몬스터 인스턴스 (`MonsterInstance`)

`makeMonster(template, chapter, kind)`:
```ts
baseline = chapter별 HP/ATK/DEF baseline (normal / boss / mimic 셋)
hp  = round(baseline.hp  × template.hpMod)
atk = baseline.atk × template.atkMod
def = baseline.def × template.defMod
speed = template.speedOverride ?? baseline.speed
```

`MonsterInstance` 필드:
- `template`, `hp`, `maxHp`, `atk`, `def`, `speed`
- `isBoss`, `isMimic`
- `statuses[]`, `actionGauge`
- 각종 `_*` 내부 카운터 (피격 횟수, HP 임계 dispatch 여부 등)

---

## 다수 몬스터 (Encounter)

일반 층 (`monster`)에서 1~5마리 등장 가능. 챕터/층/난이도별 출현 조정.
- `combat.ts:createCombatContext(player, monsters[])` 다중 적 지원.
- `currentTarget(ctx)` — 가장 첫 살아있는 적을 타겟.
- 광역 스킬은 `aliveMonsters(ctx)` 활용.

---

## 보스 vs 강화 보스

| 챕터 | 보스 | 비고 |
|---|---|---|
| 1~5 | `theme.boss` | 입문 |
| 6~10 | `theme.hardBoss` (있으면) | HP/ATK ↑, 추가 trait |

강화 보스는 hpMod/atkMod/defMod 가 1.5~2.0배. 일부 테마는 hardBoss가 별도 trait를 가짐 (예: 기계 마지막 보스 → last_stand).

---

## 진짜 보스 (`realboss.ts`)

도전 시 가장 최근 클리어 캐릭터가 도달한 챕터 테마의 **hardBoss를 추가 증폭**:
```
hp  × 3.0
atk × 9.0  (v6.1, 기존 1.8 → 9.0 강화)
def × 1.6
```

자세한 메커니즘은 [meta-bonuses.md](meta-bonuses.md).
