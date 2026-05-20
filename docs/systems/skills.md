# 스킬 시스템

## 분류 (`SkillKind`)
| 종류 | 설명 |
| --- | --- |
| `physical_atk` | 물리 공격 스킬 (검/단검/창 등) |
| `physical_def` | 물리 방어/회피/반격 스킬 |
| `magic_atk` | 마법 공격 스킬 (스태프/완드/마도서) |
| `magic_def` | 마법 방어/실드/회복 스킬 |

## 데이터 모델
```ts
interface SkillDef {
  key: string
  name: string
  mp: number          // MP 소모
  kind: SkillKind
  element?: Element
  description: string
}
```
실제 효과 로직은 `src/core/skills.ts`의 코드에서 직접 분기 (`useSkill`).

## 보유 스킬
캐릭터가 직접 보유하는 게 아니라 **장비**가 부여:
- 무기 `autoSkill` — 한 개 부여 (예: 검 → "스매시", 완드 → "마법 미사일")
- 갑옷 `autoSkill` — 한 개 부여 (있을 때, 예: "방어 자세")
- 챌린지나 트레잇으로 추가 부여 가능

`getAvailableSkills(character)` — 현재 장비 + 챌린지로 사용 가능한 스킬 목록.

## 자동 픽업 (`pickAutoAction`)
- 액션게이지 100 도달 시 가장 효율 좋은 스킬 자동 선택
- 무기 자동 스킬 발동률(weaponSkillProcPct) 우선 검사
- MP 부족 시 다른 스킬 → 평타로 fallback

## 챌린지 제약
- 무기 자동 스킬만 (`isActiveSkillForbidden` → 스킬 사용 불가)
- 액티브 스킬만 (`isBasicAttackForbidden` → 평타 불가, 강제 스킬)

## UI 표시
- Combat.vue 우상단에 보유 스킬 + 자동 발동률 % 표시
- 스킬 사용 시 로그에 이름 + 데미지/회복량

## 관련 파일
- `src/data/skills.ts` — `SKILLS` 레지스트리 (모든 스킬 정의)
- `src/core/skills.ts` — `useSkill / pickAutoAction / getAvailableSkills`
- `src/ui/images.ts` — `skillIconUrl`
- `public/images/SKILL/{key}.png` — 19종 아이콘
