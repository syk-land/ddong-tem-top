// 아이템 공격/방어 벨류 — 시뮬레이터 결과 기반 휴리스틱 가중치.
//   "이 아이템 하나가 캐릭터의 공격력/방어력 전투 능력에 얼마나 기여하는가"를 단일 수치로.
//   캐릭터 stat 과 무관 — 아이템 자체의 가치 표시용.
//
// 공격벨류 (offense value):
//   baseAtk × (coef + 특성 공격력%) × 무기 speedCoef     # 평균 DPS
//   + 명중/관통/행운/lifesteal/상태이상 가산
//
// 방어벨류 (defense value):
//   baseDef × 2 × (coef + 특성 방어력%)                  # 방어력 종합
//   + evasion/저항/마력보너스/회피/저항 특성 가산
//
// 무기 슬롯 = 공격벨류만, 갑옷 슬롯 = 방어벨류만 (반대편은 0).
// 단, 갑옷의 speedMult / mpBonus 같은 일부 효과는 *공격* 영향도 있으므로 양쪽 일부 부여.

import type { ItemInstance } from '@/types'
import { WEAPONS } from '@/data/weapons'
import { ARMORS } from '@/data/armor'
import { WEAPON_TRAITS, ARMOR_TRAITS } from '@/data/traits'

export interface ValuePart {
  label: string
  value: number
  note?: string
}

export interface ItemValueBreakdown {
  atkValue: number
  defValue: number
  atkParts: ValuePart[]
  defParts: ValuePart[]
}

export function computeItemValue(item: ItemInstance | null): ItemValueBreakdown {
  if (!item) return { atkValue: 0, defValue: 0, atkParts: [], defParts: [] }
  return item.kind === 'weapon' ? computeWeaponValue(item) : computeArmorValue(item)
}

// 무기: 공격벨류 위주
function computeWeaponValue(w: ItemInstance): ItemValueBreakdown {
  const base = WEAPONS[w.baseKey]
  const td = WEAPON_TRAITS[w.trait]
  if (!base || !td) return { atkValue: 0, defValue: 0, atkParts: [], defParts: [] }

  const atkParts: ValuePart[] = []
  const defParts: ValuePart[] = []

  // 1) 종합 공격력 (DPS) = baseAtk × (coef + trait%) × speedCoef
  const atkPct = (td.effects.공격력_pct ?? 0) + (td.effects.전스탯_pct ?? 0)
  const rawAtk = base.baseAtk * (w.coef + atkPct)
  const dps = rawAtk * base.speedCoef
  atkParts.push({
    label: '평균 DPS',
    value: dps,
    note: `${base.baseAtk}(base) × (${w.coef}(coef) + ${atkPct.toFixed(2)}(trait)) × ${base.speedCoef}(공속)`,
  })

  // 2) 명중 — 공격 기여 (적 회피 무력화)
  const acc = base.accBonus + (w.effects.명중 ?? 0)
  if (acc) atkParts.push({ label: '명중', value: acc * 0.4, note: `+${acc} (×0.4)` })

  // 3) 관통 — 공격 기여 (적 방어 무력화)
  const pen = base.penBonus ?? 0 + base.magicPenBonus + (w.effects.관통 ?? 0)
  if (pen) atkParts.push({ label: '관통', value: pen * 0.6, note: `+${pen} (×0.6)` })

  // 4) 행운 — 크리/발동률 (대략 0.5)
  const luck = w.effects.행운 ?? 0
  if (luck) atkParts.push({ label: '행운', value: luck * 0.5, note: `+${luck} (×0.5)` })

  // 5) 흡혈 / 자해 / 언데드 / 상태이상
  const lifesteal = w.effects.lifesteal ?? 0
  if (lifesteal) atkParts.push({ label: '흡혈', value: lifesteal * 40, note: `${(lifesteal*100).toFixed(0)}% × 40` })
  const selfDot = w.effects.self_dot_pct ?? 0
  if (selfDot) atkParts.push({ label: '자해(저주)', value: -selfDot * 80, note: `-${(selfDot*100).toFixed(0)}% × 80` })
  const vsUndead = w.effects.vs_undead_pct ?? 0
  if (vsUndead) atkParts.push({ label: '대언데드', value: vsUndead * 8, note: `+${(vsUndead*100).toFixed(0)}% × 8` })

  const statusKeys: Array<[keyof typeof w.effects, string]> = [
    ['burn_chance', '점화'], ['bleed_chance', '출혈'], ['poison_chance', '독'],
    ['slow_chance', '둔화'], ['blind_chance', '암흑'], ['shock_chance', '감전'],
  ]
  for (const [k, label] of statusKeys) {
    const v = (w.effects[k] as number | undefined) ?? 0
    if (v) atkParts.push({ label, value: v * 30, note: `${(v*100).toFixed(0)}% × 30` })
  }

  // 6) 특성 마력 — 마법 무기일 때만 의미
  if (base.isMagic) {
    const mpBonus = w.effects.마력 ?? 0
    if (mpBonus) atkParts.push({ label: '마법 마력 보너스', value: mpBonus * 0.5, note: `+${mpBonus} (마력계수 ↑)` })
  }

  // 7) 무기에도 일부 방어 효과 (저주 갑옷처럼 무기에 회피/저항 특성 가능)
  if (w.effects.회피) defParts.push({ label: '회피 (무기 특성)', value: w.effects.회피 * 0.5 })
  if (w.effects.상태저항) defParts.push({ label: '저항 (무기 특성)', value: w.effects.상태저항 * 0.3 })

  const atkValue = atkParts.reduce((s, p) => s + p.value, 0)
  const defValue = defParts.reduce((s, p) => s + p.value, 0)
  return { atkValue, defValue, atkParts, defParts }
}

// 갑옷: 방어벨류 위주
function computeArmorValue(a: ItemInstance): ItemValueBreakdown {
  const base = ARMORS[a.baseKey as keyof typeof ARMORS]
  const td = ARMOR_TRAITS[a.trait]
  if (!base || !td) return { atkValue: 0, defValue: 0, atkParts: [], defParts: [] }

  const defParts: ValuePart[] = []
  const atkParts: ValuePart[] = []

  // 1) 방어력 종합
  const defPct = (td.effects.방어력_pct ?? 0) + (td.effects.전스탯_pct ?? 0)
  const rawDef = base.baseDef * 2.0 * (a.coef + defPct)
  defParts.push({
    label: '방어력',
    value: rawDef,
    note: `${base.baseDef}(base) × 2 × (${a.coef}(coef) + ${defPct.toFixed(2)}(trait))`,
  })

  // 2) 회피 (갑옷 base + 특성)
  const evasion = base.evasion + (a.effects.회피 ?? 0)
  if (evasion) defParts.push({ label: '회피', value: evasion * 0.5, note: `+${evasion} (×0.5)` })

  // 3) 상태저항 (특성)
  const stRes = a.effects.상태저항 ?? 0
  if (stRes) defParts.push({ label: '상태저항', value: stRes * 0.3, note: `+${stRes} (×0.3)` })

  // 4) 마력 보너스 → 마법공격력 증폭 (공격에도 영향)
  const mpBonus = base.mpBonus + (a.effects.마력 ?? 0)
  if (mpBonus) {
    atkParts.push({ label: '마력 보너스 (마법공격↑)', value: mpBonus * 0.4, note: `+${mpBonus} (×0.4)` })
    defParts.push({ label: '마력 보너스 (저항↑)', value: mpBonus * 0.2, note: `+${mpBonus} (×0.2)` })
  }

  // 5) 속도 배율 → 공격에 영향
  const speedMult = base.speedMult
  if (Math.abs(speedMult - 1) > 0.001) {
    const speedAtkDelta = (speedMult - 1) * 20
    atkParts.push({
      label: speedMult > 1 ? '공속 + (가죽갑/로브)' : '공속 - (판금/중갑)',
      value: speedAtkDelta,
      note: `×${speedMult.toFixed(2)}`,
    })
  }

  // 6) 갑옷 특성 — 흡혈/저주/회복/반사
  const dmgHeal = a.effects.damage_taken_heal_pct ?? 0
  if (dmgHeal) defParts.push({ label: '피격 회복', value: dmgHeal * 40, note: `${(dmgHeal*100).toFixed(0)}% × 40` })
  const selfDot = a.effects.self_dot_pct ?? 0
  if (selfDot) defParts.push({ label: '자해 (저주)', value: -selfDot * 80, note: `-${(selfDot*100).toFixed(0)}% × 80` })

  const reflectKeys: Array<[keyof typeof a.effects, string]> = [
    ['reflect_burn', '점화반사'], ['reflect_slow', '둔화반사'], ['reflect_shock', '감전반사'],
    ['reflect_bleed', '출혈반사'], ['reflect_blind', '암흑반사'], ['reflect_poison', '독반사'],
  ]
  for (const [k, label] of reflectKeys) {
    const v = (a.effects[k] as number | undefined) ?? 0
    if (v) defParts.push({ label, value: v * 10, note: `${(v*100).toFixed(0)}% × 10` })
  }
  const resistKeys: Array<[keyof typeof a.effects, string]> = [
    ['resist_burn', '점화저항'], ['resist_slow', '둔화저항'], ['resist_shock', '감전저항'],
    ['resist_bleed', '출혈저항'], ['resist_blind', '암흑저항'], ['resist_poison', '독저항'],
  ]
  for (const [k, label] of resistKeys) {
    const v = (a.effects[k] as number | undefined) ?? 0
    if (v) defParts.push({ label, value: v * 5, note: `${(v*100).toFixed(0)}% × 5` })
  }

  // 7) 특성 명중/관통/행운 — 갑옷이라도 공격에 약간 기여
  if (a.effects.명중) atkParts.push({ label: '명중 (갑옷 특성)', value: a.effects.명중 * 0.4 })
  if (a.effects.행운) atkParts.push({ label: '행운 (갑옷 특성)', value: a.effects.행운 * 0.5 })

  const atkValue = atkParts.reduce((s, p) => s + p.value, 0)
  const defValue = defParts.reduce((s, p) => s + p.value, 0)
  return { atkValue, defValue, atkParts, defParts }
}
