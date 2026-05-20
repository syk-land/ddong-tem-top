# 상태이상

## 6종 (`StatusKind`)
| 이름 | 카테고리 | 효과 | 부여 트레잇 |
| --- | --- | --- | --- |
| **점화** | `dot_magic` | 매 10틱 마법 DoT | `burn_chance` |
| **출혈** | `dot_physical` | 매 10틱 물리 DoT | `bleed_chance` |
| **독** | `dot_hybrid` | 매 10틱 hybrid DoT (저항 절반 적용) | `poison_chance` |
| **둔화** | `speed_mod` | 속도 -50% (지속형) | `slow_chance` |
| **암흑** | `accuracy_mod` | 명중률 -X (지속형) | `blind_chance` |
| **감전** | `damage_taken_mod` | 받는 데미지 +50% (지속형) | `shock_chance` |

## 인스턴스 모델
```ts
interface StatusInstance {
  kind: StatusKind
  appliedTick: number   // 부여 시점
  duration: number      // 남은 틱
  stacks: number        // 1~5
  snapshotAtk: number   // 시전자 공격력 스냅샷 (DoT 계산용)
  nextDotAt?: number    // 다음 DoT 트리거 틱
}
```

## 부여 흐름
- 평타/스킬 데미지 입힐 때마다 무기 트레잇의 `<kind>_chance` % 확률로 부여
- 대상의 `상태저항`이 높으면 적용 확률 감소
- 갑옷의 `resist_X` 트레잇 효과로 해당 종류 저항 추가
- 갑옷의 `reflect_X` 트레잇이 있으면 피격자가 시전자에게 같은 상태이상 반사

## 스택 / 갱신
- 같은 종류 부여 시 스택 +1 (최대 5)
- duration이 늘어남
- DoT은 `snapshotAtk × stacks × ratio` 식으로 계산

## 챕터 종료 정리
모든 층 클리어 시 (`advance`) 플레이어 상태이상 + 침묵 효과 제거.

## 관련 파일
- `src/data/statuses.ts` — `StatusDef` 데이터
- `src/core/status.ts` — 부여 / 갱신 / DoT 처리
- `src/types/index.ts` — `StatusKind / StatusInstance / StatusDef`
- `src/ui/components/StatusBadges.vue` — 표시
- `src/ui/images.ts` — `statusIconUrl`
- `public/images/UI/{점화,출혈,중독,둔화,감전}.png`
