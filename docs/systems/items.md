# 아이템 시스템 (v6)

## 구조
모든 아이템 = `{ kind, baseKey, trait, grade, coef, tier, effects, sellPrice, buyPrice, buyback }`

- **kind**: `weapon` / `armor`
- **baseKey**: 무기 13종 (마법 21종 추가) / 갑옷 4종
- **trait**: 특성 (이전 "트레잇" → "특성")
- **grade**: 노말 / 레어 / 스페셜 / 레전드
- **coef**: **고정값** (1 / 2 / 4 / 6) — v6에서 굴림 폐기
- **tier**: 1~16 (= grade_level × 4 + trait_level)

## 등급 계수 (`GRADE_COEF`)
```
노말 = 1
레어 = 2
스페셜 = 4
레전드 = 6
```

## 특성 단계 (atk%/def%)
| 티어 | %_base | 의미 |
| --- | --- | --- |
| 하급 | -0.5 | 페널티 (똥템) |
| 보통 | 0 (또는 작은 부가) | 중립 |
| 희귀 | +0.5 | 소량 보너스 |
| 특별 | +0.5~1.5 | 큰 보너스 + 부가 효과 |

→ "특별 트레잇 ≈ 다음 등급 하급 트레잇" 격차.

## 가격
```
sellPrice = trait.price × GRADE_PRICE_MULT[grade]
buyPrice  = sellPrice × 1.5
buyback   = sellPrice × 0.4
```
- `GRADE_PRICE_MULT`: 노말 0.5 / 레어 1.0 / 스페셜 3.0 / 레전드 6.0

## 인벤토리
- 기본 4칸. 미니멀리스트 챌린지 = 1칸
- 가득 차면 `pendingPickup` 모달
- 빈 슬롯 + 같은 종류 인벤 있으면 자동 장착 ([auto-equip](../features/auto-equip.md))

## 종합 공격력 / 방어력 공식
```
무기 공격력 = baseAtk × (coef + 트레잇 공격력%_base)
갑옷 방어력 = baseDef × 2.0 × (coef + 트레잇 방어력%_base)
```
캐릭터 effective 공격력 = 힘 × 5.0 + 무기 공격력 (합연산)

자세한 수치는 [balance.md](../balance.md).

## 관련 파일
- `src/types/index.ts` — `ItemInstance`, `Grade`, `GRADE_COEF`, `GRADE_PRICE_MULT`
- `src/core/items.ts` — `rollItem`, `scaleEffects`, `tierIndex`
- `src/data/weapons.ts` / `src/data/armor.ts` — 베이스 정의
- `src/data/traits.ts` — 특성 정의 (이전 traits.md 참조)
- `src/core/itemValue.ts` — 공격/방어 벨류 휴리스틱
