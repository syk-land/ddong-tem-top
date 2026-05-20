// 아이템 전투력(공) / 전투력(방) — 캐릭터 stat + 챕터 기반 동적 모델 (v2).
//
// 전투력(공) [무기]:
//   공격력_총   = 힘 × 5 + baseAtk × (coef + 특성공격%) × (마법:magicCoef)
//   명중률      = clamp(0.5 + (민첩×0.5 + 행운×0.3 + accBonus + 특성명중) / 100, 0.2, 1.0)
//   실효방어    = 적방어 × (1 - 관통/100)                       # 관통(%) = 힘×0.5 + 행운×0.3 + 무기관통
//   적방어      = 10 + 챕터 × 5                                # 동적 (ch1=15, ch10=60)
//   평타 hit    = max(1, 공격력_총 - 실효방어) × 명중률
//   스킬 발동률 = clamp(0.15 + 행운 × 0.015, 0.05, 0.85)
//   스킬 hit    = max(1, 공격력_총 × skill.mult × (마법:magicCoef) - 실효방어) × 명중률
//   평균 hit    = (1 - p) × 평타 + p × 스킬
//   틱당 DPS    = 평균 hit × speedCoef × 갑옷.speedMult
//   + 흡혈/상태이상/대언데드/자해 가산 (DPS 비례)
//
// 전투력(방) [갑옷]:
//   baseDef × 2 × (coef + 특성방어%) + 회피/저항/마력/피격회복/반사
//
// 무기 슬롯 = 공(주), 갑옷 슬롯 = 방(주). 반대편은 보조 효과만 가산.

import type { ItemInstance, Character } from '@/types'
import { WEAPONS } from '@/data/weapons'
import { ARMORS } from '@/data/armor'
import { WEAPON_TRAITS, ARMOR_TRAITS } from '@/data/traits'
import { computeMaxHp } from '@/core/character'

// 기본 캐릭터 stat (캐릭터 없을 때 — 카탈로그 표시용)
const DEFAULT_STATS = { 힘: 10, 민첩: 10, 체력: 10, 마력: 10, 행운: 10 }
// 기본 챕터 (캐릭터 챕터 정보 없을 때)
const DEFAULT_CHAPTER = 5

// 스킬별 평균 데미지 multiplier (data/skills.ts description + core/skills.ts 로직 기반)
// description 텍스트가 바뀌어도 여기는 명시값을 유지 (예상 데미지 모델용)
const SKILL_ATK_MULT: Record<string, { mult: number; magic: boolean }> = {
  스매쉬: { mult: 2.0, magic: false },
  피어스: { mult: 1.5, magic: false },        // 관통 ×2 효과 환산
  연속공격: { mult: 2.1, magic: false },      // 0.7 × 평균 3히트
  정밀타격: { mult: 1.5, magic: false },      // 1.2 × 평균 크리 1.25
  급습: { mult: 1.65, magic: false },         // 1.5 × (1 + 0.15)
  빙결의화살: { mult: 2.2, magic: true },
  화염구: { mult: 2.6, magic: true },
  폭풍칼날: { mult: 3.15, magic: true },      // 1.05 × 3히트
  바위충격: { mult: 2.3, magic: true },
  번개창: { mult: 2.9, magic: true },
  그림자일격: { mult: 2.2, magic: true },
  정화의광선: { mult: 1.8, magic: true },
}

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

export function computeItemValue(
  item: ItemInstance | null,
  character?: Character | null,
  opts: { chapter?: number } = {},
): ItemValueBreakdown {
  if (!item) return { atkValue: 0, defValue: 0, atkParts: [], defParts: [] }
  return item.kind === 'weapon'
    ? computeWeaponValue(item, character, opts.chapter ?? DEFAULT_CHAPTER)
    : computeArmorValue(item, character)
}

// 캐릭터의 무기에서 DPS 추정치 산출 (방어구 공속 페널티 환산용)
function estimateCharWeaponDps(character?: Character | null): number {
  if (!character?.weapon) return 15  // 기본값
  const w = character.weapon
  const base = WEAPONS[w.baseKey]
  const td = WEAPON_TRAITS[w.trait]
  if (!base || !td) return 15
  const atkPct = (td.effects.공격력_pct ?? 0) + (td.effects.전스탯_pct ?? 0)
  return base.baseAtk * (w.coef + atkPct) * base.speedCoef
}

// 마법 무기용 마력계수 추정 (stats.ts와 동일 공식: clamp(1 + (총마력 - 15) × 0.05, 0.1, 1.8))
//   캐릭터 마력 + 갑옷 base/trait 마력 + 무기 trait 마력
function estimateMagicCoef(character: Character | null | undefined, viewedWeapon: ItemInstance): number {
  const wEffMp = (WEAPON_TRAITS[viewedWeapon.trait]?.effects.마력 ?? 0)
  let baseMp = 15  // 캐릭터 없으면 magicCoef = 1.0 (중립)
  let armorBoost = 0
  if (character) {
    baseMp = character.stats.마력 ?? 15
    if (character.armor) {
      const ab = ARMORS[character.armor.baseKey as keyof typeof ARMORS]
      armorBoost += ab?.mpBonus ?? 0
      armorBoost += ARMOR_TRAITS[character.armor.trait]?.effects.마력 ?? 0
    }
  }
  const totalMp = baseMp + armorBoost + wEffMp
  // v7.1: 마력계수 추가 강화 동기화 (1pt당 0.10, 상한 3.0)
  const coef = 1 + (totalMp - 15) * 0.10
  return Math.max(0.1, Math.min(3.0, coef))
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v))
}

// 무기: 전투력(공) — 캐릭터 stat + 챕터 기반 동적 모델
function computeWeaponValue(
  w: ItemInstance,
  character: Character | null | undefined,
  chapter: number,
): ItemValueBreakdown {
  const base = WEAPONS[w.baseKey]
  const td = WEAPON_TRAITS[w.trait]
  if (!base || !td) return { atkValue: 0, defValue: 0, atkParts: [], defParts: [] }

  const atkParts: ValuePart[] = []
  const defParts: ValuePart[] = []

  const stats = character?.stats ?? DEFAULT_STATS
  const enemyDef = 10 + chapter * 5            // ch1=15, ch5=35, ch10=60

  // ── 1) 종합 공격력 = 힘 × 7 + (마법무기:마력 × 3) + 무기 종합 (× 마법계수) ──
  //     v7.3: stats.ts와 동기화
  const atkPct = (td.effects.공격력_pct ?? 0) + (td.effects.전스탯_pct ?? 0)
  const weaponContrib = base.baseAtk * (w.coef + atkPct)
  const magicCoef = base.isMagic ? estimateMagicCoef(character, w) : 1
  const atkBase = stats.힘 * 7 + (base.isMagic ? stats.마력 * 3 : 0)
  const totalAtk = (atkBase + weaponContrib) * magicCoef

  // ── 2) 명중률 (곱셈) — clamp(0.5 + acc/100, 0.2, 1.0) ──
  const accStat = stats.민첩 * 0.5 + stats.행운 * 0.3
  const accWeapon = (base.accBonus ?? 0) + (w.effects.명중 ?? 0)
  const totalAcc = accStat + accWeapon
  const hitRate = clamp(0.5 + totalAcc / 100, 0.2, 1.0)

  // ── 3) 관통 → 실효 방어 (v8: % 방어 무시) ──
  const penStat = stats.힘 * 0.5 + stats.행운 * 0.3
  const penWeapon = (base.penBonus ?? 0) + (base.magicPenBonus ?? 0) + (w.effects.관통 ?? 0)
  const totalPen = penStat + penWeapon
  const penRatio = Math.min(1.0, Math.max(0, totalPen / 100))
  const effDef = Math.max(0, enemyDef * (1 - penRatio))

  // ── 4) 실효 공속 ──
  const armorSpeed = character?.armor
    ? (ARMORS[character.armor.baseKey as keyof typeof ARMORS]?.speedMult ?? 1)
    : 1
  const speedMult = base.speedCoef * armorSpeed

  // ── 5) 평타 데미지 ──
  const basicHit = Math.max(1, totalAtk - effDef) * hitRate

  // ── 6) 스킬 데미지 + 행운 기반 발동률 ──
  const skillKey = base.autoSkill
  const skillInfo = skillKey ? SKILL_ATK_MULT[skillKey] : undefined
  const procRate = skillInfo ? clamp(0.15 + stats.행운 * 0.015, 0.05, 0.85) : 0
  let avgHit = basicHit
  if (skillInfo) {
    const skillEffective = totalAtk * skillInfo.mult * (skillInfo.magic ? magicCoef : 1) / (skillInfo.magic ? magicCoef : 1)
    // skillEffective: totalAtk 이미 magicCoef 곱해진 상태 → 마법 스킬도 추가 곱 안함
    const skillRaw = totalAtk * skillInfo.mult
    const skillHit = Math.max(1, skillRaw - effDef) * hitRate
    avgHit = (1 - procRate) * basicHit + procRate * skillHit
    atkParts.push({
      label: `${skillKey} 데미지 (×${skillInfo.mult.toFixed(2)})`,
      value: (skillHit - basicHit) * procRate * speedMult,
      note: `스킬 ${skillHit.toFixed(1)} (×${skillInfo.mult}) vs 평타 ${basicHit.toFixed(1)} · 발동률 ${(procRate * 100).toFixed(0)}% (행운 ${stats.행운})`,
    })
    void skillEffective  // 미사용 변수 정리
  }

  // ── 7) 틱당 DPS (메인 표시값) ──
  const dps = avgHit * speedMult
  const magicNote = magicCoef !== 1 ? ` × ${magicCoef.toFixed(2)}(마력)` : ''
  const armorNote = armorSpeed !== 1 ? ` × ${armorSpeed.toFixed(2)}(갑옷공속)` : ''
  atkParts.unshift({
    label: `틱당 예상 데미지 (적방어 ${enemyDef}, ch${chapter})`,
    value: skillInfo ? basicHit * speedMult : dps,
    note: `(힘×5 + 무기${weaponContrib.toFixed(1)})${magicNote} - 실효방어 ${effDef.toFixed(0)} × ${(hitRate*100).toFixed(0)}%(명중) × ${base.speedCoef}(공속)${armorNote}`,
  })

  // ── 8) 보조 효과 (DPS 비례) ──
  const lifesteal = w.effects.lifesteal ?? 0
  if (lifesteal) atkParts.push({ label: '흡혈 (생존성)', value: dps * lifesteal * 0.3, note: `DPS × ${(lifesteal*100).toFixed(0)}% × 0.3` })
  const selfDot = w.effects.self_dot_pct ?? 0
  if (selfDot) {
    const maxHp = character ? computeMaxHp(stats.체력) : 200
    atkParts.push({ label: '자해(저주)', value: -selfDot * maxHp * 0.05, note: `-${(selfDot*100).toFixed(0)}% × HP ${maxHp} × 0.05` })
  }
  const vsUndead = w.effects.vs_undead_pct ?? 0
  if (vsUndead) atkParts.push({ label: '대언데드', value: dps * vsUndead * 0.1, note: `DPS × ${(vsUndead*100).toFixed(0)}% × 0.1 (테마 1/10)` })

  const statusKeys: Array<[keyof typeof w.effects, string]> = [
    ['burn_chance', '점화'], ['bleed_chance', '출혈'], ['poison_chance', '독'],
    ['slow_chance', '둔화'], ['blind_chance', '암흑'], ['shock_chance', '감전'],
  ]
  for (const [k, label] of statusKeys) {
    const v = (w.effects[k] as number | undefined) ?? 0
    if (v) atkParts.push({ label, value: dps * v * 0.4, note: `DPS × ${(v*100).toFixed(0)}% × 0.4 (DoT)` })
  }

  const luckEff = w.effects.행운 ?? 0
  if (luckEff) atkParts.push({ label: '행운 (크리/발동↑)', value: dps * luckEff * 0.01, note: `DPS × ${luckEff} × 1%` })

  if (base.isMagic) {
    const mpBonus = w.effects.마력 ?? 0
    if (mpBonus) atkParts.push({ label: '마력 (마법공격↑)', value: dps * mpBonus * 0.025, note: `DPS × ${mpBonus} × 2.5%` })
  }

  // 무기 trait 의 방어 효과
  if (w.effects.회피) defParts.push({ label: '회피 (무기 특성)', value: w.effects.회피 * 0.5 })
  if (w.effects.상태저항) defParts.push({ label: '저항 (무기 특성)', value: w.effects.상태저항 * 0.3 })

  const atkValue = atkParts.reduce((s, p) => s + p.value, 0)
  const defValue = defParts.reduce((s, p) => s + p.value, 0)
  return { atkValue, defValue, atkParts, defParts }
}

// 갑옷: 방어벨류 위주
function computeArmorValue(a: ItemInstance, character?: Character | null): ItemValueBreakdown {
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
    note: `${base.baseDef}(기본) × 2 × (${a.coef}(등급) + ${defPct.toFixed(2)}(특성))`,
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

  // 5) 속도 배율 → 공격에 영향 (실제 무기 DPS 비례 환산)
  //    캐릭터 무기가 있으면 그 DPS 기준, 없으면 평균 추정치(15)
  const speedMult = base.speedMult
  if (Math.abs(speedMult - 1) > 0.001) {
    const charDps = estimateCharWeaponDps(character)
    const speedAtkDelta = (speedMult - 1) * charDps
    atkParts.push({
      label: speedMult > 1 ? '공속 가속 (가죽갑/로브)' : '공속 감속 (판금/중갑)',
      value: speedAtkDelta,
      note: `×${speedMult.toFixed(2)} × 공격력 ${charDps.toFixed(1)}`,
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
