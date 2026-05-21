// 아이템 전투력(공) / 전투력(방) — v9 곱셈 모델 + 게이지 시스템
//
// 전투력(공) [무기]: 평균 DPS 추정치
//   atk = physStat × baseAtk × coef × (1+trait_pct) × 3.0          # 마법: 마력 × ... × 1.5 × magicSynergy
//     physStat = 힘 (대부분) / 힘 + 민첩×0.3 (ranged)
//     magicSynergy = 1.5 (로브+마법무기) / 1.0 (그 외)
//   acc = 60 + 무기 + 트레잇 + 민첩×0.5 + 행운×0.1
//   enemyEva = 5 + 챕터×1
//   hitRate = clamp((acc - enemyEva)/100, 0, 1)
//   enemyDef% = 3 + 챕터×1
//   pen% = 무기 + 트레잇
//   effDef% = max(0, enemyDef - pen) / 100
//   평타 = max(1, atk × (1 - effDef%)) × hitRate
//   스킬 = max(1, atk × mult × (1 - effDef%)) × hitRate
//   평균 hit = (1-p) × 평타 + p × 스킬           # p = 무기 발동률
//   크리 보정 = 1 + 크리확률 × (크리배수 - 1)
//   ticks = round(10 / speedCoef)
//   gauge/tick = (1 + 민첩/100) × armorSpeedMult
//   attacks/tick = gauge / ticks
//   DPS = 평균 hit × 크리 보정 × attacks/tick
//
// 전투력(방) [갑옷]:
//   def% = baseDef × coef × (1+trait_pct) + 체력 × 0.3 × coef
//   회피 +/- 무기 ticks 공속 / 마력 / 저항 / 피격회복 / 반사

import type { ItemInstance, Character } from '@/types'
import { WEAPONS } from '@/data/weapons'
import { ARMORS } from '@/data/armor'
import { WEAPON_TRAITS, ARMOR_TRAITS } from '@/data/traits'

const DEFAULT_STATS = { 힘: 12, 민첩: 12, 체력: 12, 마력: 12, 행운: 12 }
const DEFAULT_CHAPTER = 5

// v9 스킬 multiplier — skills.ts 와 동기화
const SKILL_ATK_MULT: Record<string, { mult: number; magic: boolean; note?: string }> = {
  스매쉬: { mult: 2.0, magic: false },
  피어스: { mult: 1.0, magic: false, note: '관통 ×2' },
  연속공격: { mult: 1.4, magic: false, note: '0.7 × 2히트 평균' },
  정밀타격: { mult: 1.5, magic: false, note: '1.2 × 크리 +' },
  급습: { mult: 1.65, magic: false },
  빙결의화살: { mult: 2.2, magic: true },
  화염구: { mult: 6.5, magic: true },
  폭풍칼날: { mult: 3.15, magic: true },
  바위충격: { mult: 4.8, magic: true },
  번개창: { mult: 5.5, magic: true },
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
    : computeArmorValue(item, character, opts.chapter ?? DEFAULT_CHAPTER)
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v))
}

// 무기: v9 DPS 추정
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

  // 적 (v9 baseline)
  const enemyDef = 3 + chapter * 1.0   // ch1=4%, ch5=8%, ch10=13%
  const enemyEva = 5 + chapter * 1     // ch1=6, ch5=10, ch10=15

  // ── 공격력 (v9.x 곱셈) ──
  const atkPct = (td.effects.공격력_pct ?? 0) + (td.effects.전스탯_pct ?? 0)
  const atkMultBase = base.baseAtk * w.coef * (1 + atkPct)
  const isLobe = character?.armor?.baseKey === '로브'
  const magicSynergy = isLobe && base.isMagic ? 1.5 : 1.0
  const physStat = base.category === 'ranged' ? stats.힘 + stats.민첩 * 0.3 : stats.힘
  const totalAtk = base.isMagic
    ? stats.마력 * atkMultBase * 1.5 * magicSynergy
    : physStat * atkMultBase * 3.0

  // ── 명중률 (v9) ──
  const acc = 60 + (base.accBonus ?? 0) + (w.effects.명중 ?? 0)
    + stats.민첩 * 0.5 + stats.행운 * 0.1
  const hitRate = clamp((acc - enemyEva) / 100, 0, 1.0)

  // ── 관통 → 실효 방어% ──
  const pen = (base.penBonus ?? 0) + (base.magicPenBonus ?? 0) + (w.effects.관통 ?? 0)
  const effDefPct = Math.max(0, enemyDef - pen) / 100

  // ── 평타 hit ──
  const basicHit = Math.max(1, totalAtk * (1 - effDefPct)) * hitRate

  // ── 스킬 hit + 발동률 ──
  const skillKey = base.autoSkill
  const skillInfo = skillKey ? SKILL_ATK_MULT[skillKey] : undefined
  // 발동률: 무기별 베이스 (대강) + 행운 보정
  // buildBalance.ts 의 단순 모델
  const baseProc = ({
    건틀릿: 0.18, 단검: 0.22, 사슬낫: 0.30, 완드: 0.25, 숏보우: 0.25,
    검: 0.35, 창: 0.40, 철퇴: 0.50, 스태프: 0.40, 롱보우: 0.40,
    대검: 0.55, 양날도끼: 0.65, 할버드: 0.70, 마도서: 0.55, 석궁: 0.50,
  } as Record<string, number>)[w.baseKey] ?? 0.30
  const procRate = skillInfo ? clamp(baseProc * (1 + stats.행운 * 0.005), 0.05, 0.85) : 0
  const skillHit = skillInfo
    ? Math.max(1, totalAtk * skillInfo.mult * (1 - effDefPct)) * hitRate
    : 0
  const avgHit = skillInfo ? (1 - procRate) * basicHit + procRate * skillHit : basicHit

  // ── 크리 보정 ──
  const critChance = clamp(stats.민첩 * 0.003, 0, 1.0)
  const critMult = 1.3 + stats.행운 / 100
  const critBoost = 1 + critChance * (critMult - 1)

  // ── 공격 빈도 (게이지 / ticks) — stats.ts 와 동일 식 ──
  const ticks = Math.round(10 / base.speedCoef)
  const armorBaseInfo = character?.armor
    ? ARMORS[character.armor.baseKey as keyof typeof ARMORS]
    : null
  let armorSpeed = armorBaseInfo?.speedMult ?? 1
  if (armorBaseInfo?.key === '로브' && base.isMagic) armorSpeed *= 1.15
  const wSpeedPct = (w.effects.속도_pct ?? 0)
  const aSpeedPct = (character?.armor?.effects.속도_pct ?? 0)
  const gaugePerTick = (1 + stats.민첩 / 100) * (1 + wSpeedPct + aSpeedPct) * armorSpeed
  const attacksPerTick = gaugePerTick / ticks

  // ── DPS ──
  const dps = avgHit * critBoost * attacksPerTick

  atkParts.push({
    label: `예상 DPS (적 def ${enemyDef.toFixed(0)}% / eva ${enemyEva}, ch${chapter})`,
    value: dps,
    note: `atk ${totalAtk.toFixed(0)} × hit ${(hitRate * 100).toFixed(0)}% × ${attacksPerTick.toFixed(3)}/틱${magicSynergy !== 1 ? ' × 로브시너지 1.5' : ''}${base.category === 'ranged' ? ' (활: 힘+민첩×0.3)' : ''}`,
  })
  if (skillInfo) {
    atkParts.push({
      label: `${skillKey} (×${skillInfo.mult.toFixed(2)}) 가중`,
      value: procRate * (skillHit - basicHit) * critBoost * attacksPerTick,
      note: `발동률 ${(procRate * 100).toFixed(0)}%${skillInfo.note ? ' · ' + skillInfo.note : ''}`,
    })
  }
  if (critBoost > 1.01) {
    atkParts.push({
      label: '크리 보정',
      value: avgHit * (critBoost - 1) * attacksPerTick,
      note: `+${((critBoost - 1) * 100).toFixed(1)}% (${(critChance * 100).toFixed(1)}% × ×${critMult.toFixed(2)})`,
    })
  }

  // ── 보조 효과 (DPS 비례) ──
  const lifesteal = w.effects.lifesteal ?? 0
  if (lifesteal) atkParts.push({ label: '흡혈', value: dps * lifesteal * 0.3, note: `${(lifesteal * 100).toFixed(0)}% × 0.3` })
  const selfDot = w.effects.self_dot_pct ?? 0
  if (selfDot) atkParts.push({ label: '자해 (저주)', value: -dps * selfDot * 4, note: `-${(selfDot * 100).toFixed(0)}%` })
  const vsUndead = w.effects.vs_undead_pct ?? 0
  if (vsUndead) atkParts.push({ label: '대언데드', value: dps * vsUndead * 0.1, note: `테마 1/10` })

  const statusKeys: Array<[keyof typeof w.effects, string]> = [
    ['burn_chance', '점화'], ['bleed_chance', '출혈'], ['poison_chance', '독'],
    ['slow_chance', '둔화'], ['blind_chance', '암흑'], ['shock_chance', '감전'],
  ]
  for (const [k, label] of statusKeys) {
    const v = (w.effects[k] as number | undefined) ?? 0
    if (v) atkParts.push({ label, value: dps * v * 0.4, note: `${(v * 100).toFixed(0)}% × 0.4` })
  }

  const luckEff = w.effects.행운 ?? 0
  if (luckEff) atkParts.push({ label: '행운 (크리/명중↑)', value: dps * luckEff * 0.01, note: `+${luckEff}` })

  if (base.isMagic) {
    const mpBonus = w.effects.마력 ?? 0
    if (mpBonus) atkParts.push({ label: '마력 (마법공격↑)', value: dps * mpBonus * 0.025, note: `+${mpBonus}` })
  }

  // 무기 trait 의 방어 효과
  if (w.effects.회피) defParts.push({ label: '회피 (무기 특성)', value: w.effects.회피 * 0.5 })
  if (w.effects.상태저항) defParts.push({ label: '저항 (무기 특성)', value: w.effects.상태저항 * 0.3 })

  const atkValue = atkParts.reduce((s, p) => s + p.value, 0)
  const defValue = defParts.reduce((s, p) => s + p.value, 0)
  return { atkValue, defValue, atkParts, defParts }
}

// 갑옷: v9 % 방어 모델
function computeArmorValue(
  a: ItemInstance,
  character: Character | null | undefined,
  _chapter: number,
): ItemValueBreakdown {
  const base = ARMORS[a.baseKey as keyof typeof ARMORS]
  const td = ARMOR_TRAITS[a.trait]
  if (!base || !td) return { atkValue: 0, defValue: 0, atkParts: [], defParts: [] }

  const defParts: ValuePart[] = []
  const atkParts: ValuePart[] = []

  const stats = character?.stats ?? DEFAULT_STATS

  // ── 방어% (v9.x) ──
  const defPct = (td.effects.방어력_pct ?? 0) + (td.effects.전스탯_pct ?? 0)
  const armorDef = base.baseDef * a.coef * (1 + defPct)
  const hpDef = stats.체력 * 0.3 * a.coef
  const totalDef = armorDef + hpDef
  // 피해 감소 점수 = totalDef × 2 (체력 기여 포함)
  defParts.push({
    label: `방어 ${totalDef.toFixed(1)}%`,
    value: totalDef * 2.0,
    note: `${base.baseDef} × ${a.coef.toFixed(2)} × (1+${defPct.toFixed(2)})${stats.체력 ? ` + 체력 ${stats.체력} × 0.3 × ${a.coef.toFixed(2)} = ${hpDef.toFixed(1)}%` : ''}`,
  })

  // 회피
  const evasion = base.evasion + (a.effects.회피 ?? 0)
  if (evasion) defParts.push({ label: '회피', value: evasion * 0.5, note: `+${evasion}` })

  // 상태저항
  const stRes = a.effects.상태저항 ?? 0
  if (stRes) defParts.push({ label: '상태저항', value: stRes * 0.3, note: `+${stRes}` })

  // ── 마력 보너스 → 마법 빌드의 atk 증가 (마법무기 + 로브 시너지) ──
  const mpBonus = base.mpBonus + (a.effects.마력 ?? 0)
  if (mpBonus) {
    // 마법 무기 장착자라면 atk 영향 크게
    const isMagic = character?.weapon
      ? WEAPONS[character.weapon.baseKey]?.isMagic ?? false
      : false
    if (isMagic) {
      atkParts.push({ label: '마력 → 마법 atk', value: mpBonus * 0.8, note: `+${mpBonus} (마력 stat 증가)` })
    } else {
      atkParts.push({ label: '마력 보너스', value: mpBonus * 0.2, note: `+${mpBonus} (마법 무기 없음)` })
    }
    defParts.push({ label: '마력 (저항↑)', value: mpBonus * 0.1, note: `+${mpBonus}` })
  }

  // ── 게이지 가속/감속 ──
  const speedMult = base.speedMult
  if (Math.abs(speedMult - 1) > 0.001) {
    // 게이지 ×N → 공격 빈도 × N → DPS × N
    const charDps = estimateCharDps(character)
    const speedAtkDelta = (speedMult - 1) * charDps
    atkParts.push({
      label: speedMult > 1 ? '게이지 가속' : '게이지 감속',
      value: speedAtkDelta,
      note: `×${speedMult.toFixed(2)} (현재 무기 DPS ${charDps.toFixed(1)})`,
    })
  }

  // ── 로브 + 마법무기 시너지 (×1.5, v9.x) ──
  if (base.key === '로브' && character?.weapon) {
    const wb = WEAPONS[character.weapon.baseKey]
    if (wb?.isMagic) {
      // 시너지 +50% atk
      const charDps = estimateCharDps(character)
      atkParts.push({
        label: '로브 + 마법무기 시너지',
        value: charDps * 0.5,
        note: '마법 atk × 1.5',
      })
    }
  }

  // ── 갑옷 자동 반응 점수 (피격 시 발동, v9.x) ──
  const procChance = 0.10 + stats.행운 * 0.005
  const estEnemyDmg = 15  // 챕터 평균 적 평타 추정
  if (base.key === '가죽갑') {
    defParts.push({
      label: '자동 회피 (피격 시)',
      value: estEnemyDmg * procChance * 2.0,
      note: `발동 ${(procChance * 100).toFixed(0)}% → 데미지 무효`,
    })
  } else if (base.key === '로브') {
    defParts.push({
      label: '자동 방어 (피격 시, MP 흡수)',
      value: estEnemyDmg * 0.5 * procChance * 2.0,
      note: `발동 ${(procChance * 100).toFixed(0)}% → 데미지 −50% (MP 소모)`,
    })
  } else if (base.key === '판금') {
    const charDps = estimateCharDps(character)
    // 카운터: 피격당 평타×0.5 (방어 무시). 평균 가치 = charDps × 0.5 × proc
    atkParts.push({
      label: '철벽 카운터 (피격 시)',
      value: charDps * 0.5 * procChance,
      note: `발동 ${(procChance * 100).toFixed(0)}% → 평타×0.5 반격`,
    })
  }

  // 갑옷 trait — 피격회복/반사/저항
  const dmgHeal = a.effects.damage_taken_heal_pct ?? 0
  if (dmgHeal) defParts.push({ label: '피격 회복', value: dmgHeal * 40, note: `${(dmgHeal * 100).toFixed(0)}%` })
  const selfDot = a.effects.self_dot_pct ?? 0
  if (selfDot) defParts.push({ label: '자해 (저주)', value: -selfDot * 80 })

  const reflectKeys: Array<[keyof typeof a.effects, string]> = [
    ['reflect_burn', '점화반사'], ['reflect_slow', '둔화반사'], ['reflect_shock', '감전반사'],
    ['reflect_bleed', '출혈반사'], ['reflect_blind', '암흑반사'], ['reflect_poison', '독반사'],
  ]
  for (const [k, label] of reflectKeys) {
    const v = (a.effects[k] as number | undefined) ?? 0
    if (v) defParts.push({ label, value: v * 10 })
  }
  const resistKeys: Array<[keyof typeof a.effects, string]> = [
    ['resist_burn', '점화저항'], ['resist_slow', '둔화저항'], ['resist_shock', '감전저항'],
    ['resist_bleed', '출혈저항'], ['resist_blind', '암흑저항'], ['resist_poison', '독저항'],
  ]
  for (const [k, label] of resistKeys) {
    const v = (a.effects[k] as number | undefined) ?? 0
    if (v) defParts.push({ label, value: v * 5 })
  }

  // 명중 1pt ≈ 명중률 +1%p → 평균 dps +1%. charDps 기반 추정 (이전 × 0.4 가중치 너무 컸음)
  if (a.effects.명중) {
    const charDps = estimateCharDps(character)
    atkParts.push({ label: '명중 (갑옷 특성)', value: charDps * (a.effects.명중 / 100), note: `+${a.effects.명중.toFixed(0)} (dps ${charDps.toFixed(0)} × ${a.effects.명중.toFixed(0)}%)` })
  }
  // 행운 1pt → 크리 배수 +1%/pt. dps 영향은 크리 확률에 비례 (대략 dps × 0.5%)
  if (a.effects.행운) {
    const charDps = estimateCharDps(character)
    atkParts.push({ label: '행운 (갑옷 특성)', value: charDps * a.effects.행운 * 0.005, note: `+${a.effects.행운.toFixed(0)}` })
  }

  const atkValue = atkParts.reduce((s, p) => s + p.value, 0)
  const defValue = defParts.reduce((s, p) => s + p.value, 0)
  return { atkValue, defValue, atkParts, defParts }
}

// 캐릭터 현재 무기의 대략적인 DPS 추정 (갑옷의 게이지 가속/감속 환산용)
function estimateCharDps(character?: Character | null): number {
  if (!character?.weapon) return 30
  const w = character.weapon
  const base = WEAPONS[w.baseKey]
  const td = WEAPON_TRAITS[w.trait]
  if (!base || !td) return 30
  const atkPct = (td.effects.공격력_pct ?? 0) + (td.effects.전스탯_pct ?? 0)
  const atkMultBase = base.baseAtk * w.coef * (1 + atkPct)
  const physStat = base.category === 'ranged'
    ? character.stats.힘 + character.stats.민첩 * 0.3
    : character.stats.힘
  const isLobe = character.armor?.baseKey === '로브'
  const magicSynergy = isLobe && base.isMagic ? 1.5 : 1.0
  const stat = base.isMagic ? character.stats.마력 : physStat
  const k = base.isMagic ? 1.5 * magicSynergy : 3.0
  const atk = stat * atkMultBase * k
  const ticks = Math.round(10 / base.speedCoef)
  return atk / ticks
}
