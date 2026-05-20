# 몬스터 trait 시스템

## 개요
몬스터 템플릿의 `trait` 필드에 등록된 키는 `monsterTraits.ts`의 레지스트리를 통해 전투 훅에 연결된다. 한 몬스터는 정확히 0~1개의 trait을 가진다.

## 훅 종류
- `onHit(target, attacker, ctx)` — 자신이 공격받았을 때
- `onDealDamage(target, dmg, ctx)` — 자신이 데미지를 입혔을 때
- `onTick(ctx)` — 매 틱
- `onDeath(ctx)` — 사망 시
- `onHpThreshold(percent)` — HP %에 도달했을 때 (보스 페이즈)
- 기타 — 각 trait별 커스텀

## 주요 trait 예시
| trait | 동작 |
| --- | --- |
| `revive_chance` | 사망 시 일정 확률로 1회 부활 (좀비) |
| `first_hit_immune` | 첫 번째 피격 무효 (해골) |
| `summon_minions` | HP 70%/40% 도달 시 미니언 소환 (고블린 왕) |
| `magic_immune` | 모든 마법 데미지 무효 (마도 골렘) |
| `split_3` | 사망 시 3개 분열체 출현 (환영 지배자) |
| `reflect_physical` | 피격 시 물리 데미지 반사 (철갑 골렘) |
| `bind` | 매 N틱 플레이어 행동게이지 -50 (크라켄) |
| `laser_charge` | N틱 차징 → 거대 데미지 (메카닉 타이탄) |
| `lifesteal` | 입힌 데미지 % HP 회복 (흡혈 박쥐) |
| `silence_chance` | 피격 시 침묵 부여 (다크 가고일) |
| `aerial_invincible` | 일정 턴마다 무적 (천공의 키메라) |
| `item_block` | 전투에 참여 시 드랍 차단 (그리폰) |
| `screen_darken` | 명중률 디버프 (실루엣 크로우) |
| `heal_reverse` | 회복 효과를 데미지로 (역병) |
| `gold_curse` | 죽을 때 골드 감소 (다크 컬티스트) |

## 부팅 시 검증
`src/main.ts`에서 `validateMonsterTraitKeys(collectChapterTraitKeys(CHAPTER_THEMES))` 호출.
- chapters.ts에 등록된 trait 키가 모두 monsterTraits 레지스트리에 정의됐는지 검사
- 누락이면 콘솔 경고

## 페이즈 보스
보스 몬스터의 `_phase` / `_phaseTriggered` 런타임 카운터로 HP 임계값(예: 50%, 25%)에 한 번씩만 페이즈 전환을 발동.

## 관련 파일
- `src/core/monsterTraits.ts` — 레지스트리 + 훅 정의
- `src/core/combat.ts` — 훅 호출 위치
- `src/data/chapters.ts` — 각 몬스터 템플릿에 trait 키 할당
- `src/types/index.ts` — `MonsterInstance` 런타임 카운터
