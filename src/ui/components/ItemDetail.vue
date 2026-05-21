<script setup lang="ts">
import { computed, ref } from 'vue'
import type { ItemInstance, Character } from '@/types'
import { WEAPONS } from '@/data/weapons'
import { ARMORS } from '@/data/armor'
import { WEAPON_TRAITS, ARMOR_TRAITS } from '@/data/traits'
import { SKILLS } from '@/data/skills'
import { tierColorClass, gradeColorClass, gradeBorderClass } from '@/ui/colors'
import { computeWeaponSkillProc } from '@/core/buildBalance'
import { getClearRank } from '@/core/character'
import { useGameStore } from '@/stores/game'
import { itemImageUrl } from '@/ui/images'
import { computeItemValue, type ValuePart } from '@/core/itemValue'
import ItemName from './ItemName.vue'

const game = useGameStore()
const currentChapter = computed(() => game.currentChapterState?.chapter ?? 1)

const props = defineProps<{
  item: ItemInstance
  character?: Character
}>()

const isWeapon = computed(() => props.item.kind === 'weapon')
const weaponBase = computed(() => isWeapon.value ? WEAPONS[props.item.baseKey] : null)
const armorBase = computed(() => !isWeapon.value ? ARMORS[props.item.baseKey as keyof typeof ARMORS] : null)
const traitDef = computed(() =>
  isWeapon.value ? WEAPON_TRAITS[props.item.trait] : ARMOR_TRAITS[props.item.trait]
)
const traitBase = computed(() => traitDef.value?.effects ?? {})

// ── 아이템 벨류 + 현재 장착품 대비 변화량 ──
const chapterForValue = computed(() => game.currentChapterState?.chapter)
const itemValue = computed(() => computeItemValue(props.item, props.character, { chapter: chapterForValue.value }))
const currentSlotItem = computed(() => {
  if (!props.character) return null
  return props.item.kind === 'weapon' ? props.character.weapon : props.character.armor
})
const currentValue = computed(() => computeItemValue(currentSlotItem.value, props.character, { chapter: chapterForValue.value }))
const atkDelta = computed(() => itemValue.value.atkValue - currentValue.value.atkValue)
const defDelta = computed(() => itemValue.value.defValue - currentValue.value.defValue)

// 분해 모달
const valueModal = ref<{ kind: 'atk' | 'def'; total: number; parts: ValuePart[] } | null>(null)
function openValueModal(kind: 'atk' | 'def') {
  if (kind === 'atk') {
    valueModal.value = { kind, total: itemValue.value.atkValue, parts: itemValue.value.atkParts }
  } else {
    valueModal.value = { kind, total: itemValue.value.defValue, parts: itemValue.value.defParts }
  }
}

// 현재 장착 중인 동일 슬롯 아이템 (인벤토리 비교용)
const currentEquipped = computed(() => {
  if (!props.character) return null
  const slot = isWeapon.value ? 'weapon' : 'armor'
  const cur = props.character[slot]
  // 이 ItemDetail 이 현재 장착품을 표시 중이면 비교 무의미
  if (!cur || cur.id === props.item.id) return null
  return cur
})
const coef = computed(() => props.item.coef)
const effects = computed(() => props.item.effects)

// 기본 능력치 분해 — v9 곱셈 모델
// 공식:
//   무기 atk = 힘 × baseAtk × coef × (1 + trait_pct) × 3.0
//   갑옷 def% = baseDef × coef × (1 + trait_pct)  (+ 체력 × 0.3, stats.ts에서)
const baseSpecLines = computed(() => {
  const lines: string[] = []
  const fmt = (n: number) => (n >= 0 ? '+' : '') + (n * 100).toFixed(0) + '%'
  if (weaponBase.value) {
    const base = weaponBase.value.baseAtk
    const traitPctBase = (traitBase.value.공격력_pct ?? 0) + (traitBase.value.전스탯_pct ?? 0)
    const mult = base * coef.value * (1 + traitPctBase)
    lines.push(
      `atk 계수 ${base.toFixed(2)} × ${coef.value.toFixed(2)} × (1${fmt(traitPctBase)}) = ${mult.toFixed(2)} (× 힘 × 3.0)`,
    )
  }
  if (armorBase.value) {
    const baseD = armorBase.value.baseDef
    const defPctBase = (traitBase.value.방어력_pct ?? 0) + (traitBase.value.전스탯_pct ?? 0)
    const dF = baseD * coef.value * (1 + defPctBase)
    lines.push(
      `방어 ${baseD} × ${coef.value.toFixed(2)} × (1${fmt(defPctBase)}) = ${dF.toFixed(2)}%  (+ 체력 × 0.3)`,
    )
  }
  return lines
})

// 자동 스킬 한 줄
const skillKey = computed(() => weaponBase.value?.autoSkill ?? armorBase.value?.autoSkill ?? null)
const skill = computed(() => skillKey.value ? SKILLS[skillKey.value] : null)
const skillProcPct = computed(() => {
  if (!isWeapon.value || !props.character) return null
  const virtualChar = { ...props.character, weapon: props.item }
  return Math.round(
    computeWeaponSkillProc(virtualChar as Character, props.character.stats.행운) * 100
  )
})
const skillLine = computed(() => {
  if (!skill.value) return null
  const procStr = skillProcPct.value !== null ? ` · 발동률 ${skillProcPct.value}%` : ''
  return `${skill.value.name} (마나 ${skill.value.mp}${procStr}) — ${skill.value.description}`
})

// 명중/회피/공격주기 한 줄 — v9
const acc = computed(() => {
  let t = 0
  if (weaponBase.value) t += weaponBase.value.accBonus
  if (effects.value.명중) t += effects.value.명중
  return t
})
const eva = computed(() => {
  let t = 0
  if (weaponBase.value) t += weaponBase.value.evaBonus
  if (armorBase.value) t += armorBase.value.evasion
  if (effects.value.회피) t += effects.value.회피
  return t
})
const speedPctTrait = computed(() => effects.value.속도_pct ?? 0)
// 무기 ticks (게이지 임계값) 또는 갑옷 speedMult
const weaponTicks = computed(() => {
  if (!weaponBase.value) return 0
  return Math.round(10 / weaponBase.value.speedCoef)
})
const armorSpeedMult = computed(() => armorBase.value?.speedMult ?? 1)

const moveLine = computed(() => {
  const parts: string[] = []
  if (acc.value !== 0) parts.push(`명중 ${acc.value >= 0 ? '+' : ''}${acc.value.toFixed(0)}`)
  if (eva.value !== 0) parts.push(`회피 ${eva.value >= 0 ? '+' : ''}${eva.value.toFixed(0)}`)
  if (weaponBase.value) parts.push(`공격주기 ${weaponTicks.value}틱`)
  if (armorBase.value && armorSpeedMult.value !== 1) {
    parts.push(`갑옷 게이지 ×${armorSpeedMult.value.toFixed(2)}`)
  }
  if (speedPctTrait.value !== 0) {
    parts.push(`게이지 ${speedPctTrait.value >= 0 ? '+' : ''}${(speedPctTrait.value * 100).toFixed(0)}%`)
  }
  return parts.join(' / ')
})

// 특수 효과 한 줄
const specialLine = computed(() => {
  const e = effects.value
  const parts: string[] = []
  const pushPct = (label: string, v: number | undefined) => {
    if (v === undefined || v === 0) return
    parts.push(`${label} ${(v * 100).toFixed(2)}%`)
  }
  const pushFlat = (label: string, v: number | undefined) => {
    if (v === undefined || v === 0) return
    parts.push(`${label} ${v >= 0 ? '+' : ''}${v.toFixed(2)}`)
  }
  pushPct('흡혈', e.lifesteal)
  pushPct('자해', e.self_dot_pct)
  pushPct('대언데드', e.vs_undead_pct)
  pushPct('점화', e.burn_chance)
  pushPct('출혈', e.bleed_chance)
  pushPct('독', e.poison_chance)
  pushPct('둔화', e.slow_chance)
  pushPct('암흑', e.blind_chance)
  pushPct('감전', e.shock_chance)
  pushFlat('행운', e.행운)
  pushFlat('상태저항', e.상태저항)
  pushFlat('마력', e.마력)
  pushFlat('관통', e.관통)
  pushPct('피격회복', e.damage_taken_heal_pct)
  // 갑옷 베이스 보너스 (로브 마력 +30, 가죽갑 회피 +12 등 — 특성 효과와 별도)
  if (armorBase.value) {
    if (armorBase.value.mpBonus) {
      parts.push(`마력 +${armorBase.value.mpBonus} (갑옷)`)
    }
    if (armorBase.value.evasion) {
      // 회피는 보정 라인에 이미 포함되므로 중복 표시 안 함
    }
  }
  return parts.join(', ')
})

// 장비 계수 — 공격력 / 방어력 두 가지로 분리
// 각 효과는 곱셈 기반 (% 값으로 환산). 명중 -10 → ×0.875 같은 식
const itemCoef = computed(() => {
  const e = effects.value

  // 베이스 곱셈 인자 (가산값 → 곱셈 환산)
  const accMult = Math.max(0.3, 1 + acc.value / 80)              // 명중 +30 → ×1.375, -10 → ×0.875
  const evaMult = Math.max(0.3, 1 + eva.value / 80)              // 회피 +12 → ×1.15
  const penMult = 1 + (e.관통 ?? 0) / 20                          // 관통 +8 → ×1.4
  const luckMult = 1 + (e.행운 ?? 0) * 0.02                       // 행운 +5 → ×1.10
  const stResMult = 1 + (e.상태저항 ?? 0) / 30
  const lifestealMult = 1 + (e.lifesteal ?? 0) * 0.6              // 흡혈 25% → ×1.15
  const dmgHealMult = 1 + (e.damage_taken_heal_pct ?? 0) * 5
  // 속도 — 무기 coef 또는 갑옷 배율, 특성 속도% 적용
  const speedFin = (weaponBase.value?.speedCoef ?? armorBase.value?.speedMult ?? 1) * (1 + speedPctTrait.value)
  // 상태이상 발동 평균 (DPS 보너스)
  const statusSum = (e.burn_chance ?? 0) + (e.bleed_chance ?? 0) + (e.poison_chance ?? 0) +
                    (e.slow_chance ?? 0) + (e.blind_chance ?? 0) + (e.shock_chance ?? 0)
  const statusMult = 1 + statusSum * 0.5
  // 마력 보너스 (갑옷 mpBonus + 특성 마력)
  const mpBonus = (armorBase.value?.mpBonus ?? 0) + (e.마력 ?? 0)
  const mpMult = 1 + mpBonus / 50
  // 저주(자해)는 양쪽 페널티
  const selfDotPenalty = 1 - (e.self_dot_pct ?? 0) * 4

  // === 공격력 계수 ===
  // v4 가산식 모델: 무기만 공격력 계수에 기여. 갑옷은 0.
  //   종합 공격계수 = baseAtk × (coef + trait%_base)
  let atk = 0
  if (weaponBase.value) {
    const traitPctBase = (traitBase.value.공격력_pct ?? 0) + (traitBase.value.전스탯_pct ?? 0)
    const finalAtk = weaponBase.value.baseAtk * (coef.value + traitPctBase)
    atk = finalAtk * accMult * penMult * speedFin * luckMult * lifestealMult * statusMult * selfDotPenalty
  }

  // === 방어력 계수 ===
  // v4 가산식 모델: 갑옷만 방어력 계수에 기여. 무기는 0.
  //   종합 방어계수 = baseDef × 2 × (coef + trait%_base)
  let def = 0
  if (armorBase.value) {
    const defPctBase = (traitBase.value.방어력_pct ?? 0) + (traitBase.value.전스탯_pct ?? 0)
    const finalDef = armorBase.value.baseDef * 2.0 * (coef.value + defPctBase)
    def = finalDef * evaMult * stResMult * mpMult * dmgHealMult * selfDotPenalty
  }

  return { atk, def }
})

const totalScore = computed(() => itemCoef.value.atk + itemCoef.value.def)

// 장착 시 기본 능력치 변동 — 다중 항목 (v4)
//   무기: 공격력(종합 × 공속)
//   갑옷: 방어력 + 공격력(공속배율) + 공격력(마력보너스)
//   공통: 특성의 명중/회피
export type EquipDeltaKind = 'atk' | 'def' | 'neutral'
export interface EquipDelta {
  label: string
  // 합산형: amount (delta value), pct (vs baseline)
  amount?: number
  // 곱셈형: mult, pct
  mult?: number
  pct?: number
  kind: EquipDeltaKind
  note?: string
}

const equipChanges = computed<EquipDelta[]>(() => {
  if (!props.character) return []
  const c = props.character
  // v6: 총공격력 = 힘 × 1.5 + 무기 종합, 총방어력 = 체력 × 2 + 갑옷 종합
  const charAtk = c.stats.힘 * 1.5
  const charDef = c.stats.체력 * 2.0
  const curWeapon = c.weapon
  const curArmor = c.armor
  function weaponContribution(item: ItemInstance | null): number {
    if (!item) return 0
    const wb = WEAPONS[item.baseKey]
    if (!wb) return 0
    const t = WEAPON_TRAITS[item.trait]?.effects ?? {}
    const pct = (t.공격력_pct ?? 0) + (t.전스탯_pct ?? 0)
    return wb.baseAtk * (item.coef + pct)
  }
  function armorContribution(item: ItemInstance | null): number {
    if (!item) return 0
    const ab = ARMORS[item.baseKey as keyof typeof ARMORS]
    if (!ab) return 0
    const t = ARMOR_TRAITS[item.trait]?.effects ?? {}
    const pct = (t.방어력_pct ?? 0) + (t.전스탯_pct ?? 0)
    return ab.baseDef * 2.0 * (item.coef + pct)
  }
  // 현재 캐릭터의 마력계수 (마법 무기 마법공격력 항목 표시용)
  const playerMagicCoef = Math.max(0.1, Math.min(3.0, 1 + (c.stats.마력 - 15) * 0.07))
  const out: EquipDelta[] = []

  if (weaponBase.value) {
    // 같은 슬롯 비교: 새 무기 vs 현재 무기 (없으면 0)
    // 새 무기를 이 슬롯에 끼웠을 때의 "총공격력 변화" 기준 %.
    const traitAtkPct = (traitBase.value.공격력_pct ?? 0) + (traitBase.value.전스탯_pct ?? 0)
    const newWeaponAtk = weaponBase.value.baseAtk * (coef.value + traitAtkPct)
    const curWeaponAtk = weaponContribution(curWeapon)
    const curTotal = charAtk + curWeaponAtk
    const newTotal = charAtk + newWeaponAtk
    const delta = newTotal - curTotal
    const pct = curTotal > 0 ? (delta / curTotal) * 100 : 0
    out.push({
      label: '공격력',
      amount: delta,
      pct,
      kind: 'atk',
      note: `${curTotal.toFixed(2)} → ${newTotal.toFixed(2)}`,
    })
    // 마법 무기는 마력계수 적용된 마법공격력 변화도 별도 라인 (참고용)
    if (weaponBase.value.isMagic) {
      const newMagic = newWeaponAtk * playerMagicCoef
      const curMagic = curWeaponAtk * (curWeapon?.baseKey && WEAPONS[curWeapon.baseKey]?.isMagic ? playerMagicCoef : 0)
      const curMagicTotal = charAtk * playerMagicCoef + curMagic
      const newMagicTotal = charAtk * playerMagicCoef + newMagic
      const mDelta = newMagicTotal - curMagicTotal
      out.push({
        label: `마법공격력 (×${playerMagicCoef.toFixed(2)})`,
        amount: mDelta,
        pct: curMagicTotal > 0 ? (mDelta / curMagicTotal) * 100 : 0,
        kind: 'atk',
      })
    }
  }

  if (armorBase.value) {
    // 같은 슬롯 비교: 새 갑옷 vs 현재 갑옷 (없으면 0)
    const traitDefPct = (traitBase.value.방어력_pct ?? 0) + (traitBase.value.전스탯_pct ?? 0)
    const newArmorDef = armorBase.value.baseDef * 2.0 * (coef.value + traitDefPct)
    const curArmorDef = armorContribution(curArmor)
    const curTotalDef = charDef + curArmorDef
    const newTotalDef = charDef + newArmorDef
    const dDef = newTotalDef - curTotalDef
    out.push({
      label: '방어력',
      amount: dDef,
      pct: curTotalDef > 0 ? (dDef / curTotalDef) * 100 : 0,
      kind: 'def',
      note: `${curTotalDef.toFixed(2)} → ${newTotalDef.toFixed(2)}`,
    })

    // 2) 공속배율 → 공격력에 곱셈 영향 (가죽갑 ×1.2, 판금 ×0.65)
    const armorSpeedFin = armorBase.value.speedMult * (1 + speedPctTrait.value)
    if (Math.abs(armorSpeedFin - 1) > 0.001) {
      const pctDelta = (armorSpeedFin - 1) * 100
      out.push({
        label: '공격력 (공속)',
        mult: armorSpeedFin,
        pct: pctDelta,
        kind: 'atk',
        note: `총공격력 × ${armorSpeedFin.toFixed(2)}`,
      })
    }

    // 3) 마력 보너스 — 마력계수(magic coefficient)에 영향
    //    마법공격력 = (s.공격력 + weaponAtkCoef) × magicCoef
    //    magicCoef = clamp(1 + (총마력 - 15) × 0.07, 0.1, 3.0)
    //    아이템 장착 시 새 magicCoef 계산 후 마법공격력 차이를 표시
    const mpBonus = armorBase.value.mpBonus + (effects.value.마력 ?? 0)
    if (mpBonus !== 0) {
      const calcMagicCoef = (mp: number) => Math.max(0.1, Math.min(3.0, 1 + (mp - 15) * 0.07))
      const currMp = c.stats.마력
      const newMp = currMp + mpBonus
      const currCoef = calcMagicCoef(currMp)
      const newCoef = calcMagicCoef(newMp)
      // v6: 마법공격력 기준 베이스 (캐릭터 힘 × 1.5)
      const magicBaselineAtk = c.stats.힘 * 1.5
      const currMagic = magicBaselineAtk * currCoef
      const newMagic = magicBaselineAtk * newCoef
      const delta = newMagic - currMagic
      const pct = magicBaselineAtk > 0 ? (delta / magicBaselineAtk) * 100 : 0
      out.push({
        label: `마법공격력 (마력계수 ×${newCoef.toFixed(2)})`,
        amount: delta,
        pct,
        kind: 'atk',
        note: `${currCoef.toFixed(2)} → ${newCoef.toFixed(2)}`,
      })
    }
  }

  // 4) 명중 modifier (특성 scaled + 무기 accBonus)
  const accBonus = (effects.value.명중 ?? 0) + (weaponBase.value?.accBonus ?? 0)
  if (Math.abs(accBonus) > 0.001) {
    out.push({
      label: '명중',
      amount: accBonus,
      kind: 'neutral',
    })
  }

  // 5) 회피 modifier (갑옷 base + 특성 scaled)
  const evaBonus = (effects.value.회피 ?? 0) + (armorBase.value?.evasion ?? 0)
  if (Math.abs(evaBonus) > 0.001) {
    out.push({
      label: '회피',
      amount: evaBonus,
      kind: 'def',
    })
  }

  // 방어구/무기 구분 없이 공격력 → 방어력 → 명중 등 순으로 정렬
  const order: Record<EquipDeltaKind, number> = { atk: 0, def: 1, neutral: 2 }
  out.sort((a, b) => order[a.kind] - order[b.kind])

  return out
})

// 현재 장착품과의 교체 비교 라인 (Δ 공격력 / Δ 방어력 등)
interface CompareDelta {
  label: string
  delta: number
  pctDelta?: number  // 현재 대비 변화율 (%)
  kind: EquipDeltaKind
}

const compareChanges = computed<CompareDelta[]>(() => {
  if (!props.character || !currentEquipped.value) return []
  const cur = currentEquipped.value
  const out: CompareDelta[] = []

  // 무기 비교
  if (weaponBase.value) {
    const curBase = WEAPONS[cur.baseKey]
    const curTrait = WEAPON_TRAITS[cur.trait]?.effects ?? {}
    if (!curBase) return out

    // 신규 무기 공격력
    const newAtkPct = (traitBase.value.공격력_pct ?? 0) + (traitBase.value.전스탯_pct ?? 0)
    const newAtk = weaponBase.value.baseAtk * (coef.value + newAtkPct)
    // 현재 무기 공격력
    const curAtkPct = (curTrait.공격력_pct ?? 0) + (curTrait.전스탯_pct ?? 0)
    const curAtk = curBase.baseAtk * (cur.coef + curAtkPct)

    const dAtk = newAtk - curAtk
    if (Math.abs(dAtk) > 0.01) {
      // v6: 총공격력 기준 변화율 (힘×1.5 + 현재 무기 공격력)
      const curTotalAtk = props.character.stats.힘 * 1.5 + curAtk
      out.push({
        label: '공격력',
        delta: dAtk,
        pctDelta: curTotalAtk > 0 ? (dAtk / curTotalAtk) * 100 : 0,
        kind: 'atk',
      })
    }

    // 속도 비교
    const newSpeed = weaponBase.value.speedCoef * (1 + (traitBase.value.속도_pct ?? 0))
    const curSpeed = curBase.speedCoef * (1 + (curTrait.속도_pct ?? 0))
    const dSpeed = newSpeed - curSpeed
    if (Math.abs(dSpeed) > 0.01) {
      out.push({
        label: '공속',
        delta: dSpeed,
        pctDelta: curSpeed > 0 ? (dSpeed / curSpeed) * 100 : 0,
        kind: 'atk',
      })
    }
  }

  // 갑옷 비교
  if (armorBase.value) {
    const curBase = ARMORS[cur.baseKey as keyof typeof ARMORS]
    const curTrait = ARMOR_TRAITS[cur.trait]?.effects ?? {}
    if (!curBase) return out

    // 신규 갑옷 방어력
    const newDefPct = (traitBase.value.방어력_pct ?? 0) + (traitBase.value.전스탯_pct ?? 0)
    const newDef = armorBase.value.baseDef * 2.0 * (coef.value + newDefPct)
    // 현재 갑옷 방어력
    const curDefPct = (curTrait.방어력_pct ?? 0) + (curTrait.전스탯_pct ?? 0)
    const curDef = curBase.baseDef * 2.0 * (cur.coef + curDefPct)

    const dDef = newDef - curDef
    if (Math.abs(dDef) > 0.01) {
      // v6: 총방어력 기준 변화율 (체력×2 + 현재 갑옷 방어력)
      const curTotalDef = props.character.stats.체력 * 2.0 + curDef
      out.push({
        label: '방어력',
        delta: dDef,
        pctDelta: curTotalDef > 0 ? (dDef / curTotalDef) * 100 : 0,
        kind: 'def',
      })
    }

    // 공속배율 비교
    const newSpeedMult = armorBase.value.speedMult * (1 + (traitBase.value.속도_pct ?? 0))
    const curSpeedMult = curBase.speedMult * (1 + (curTrait.속도_pct ?? 0))
    const dSpeedMult = newSpeedMult - curSpeedMult
    if (Math.abs(dSpeedMult) > 0.01) {
      out.push({
        label: '공속배율',
        delta: dSpeedMult,
        pctDelta: curSpeedMult > 0 ? (dSpeedMult / curSpeedMult) * 100 : 0,
        kind: 'atk',
      })
    }

    // 마력 (마법공격력 영향)
    const newMp = armorBase.value.mpBonus + (effects.value.마력 ?? 0)
    const curMp = curBase.mpBonus + (cur.effects.마력 ?? 0)
    const dMp = newMp - curMp
    if (dMp !== 0) {
      out.push({ label: '마력', delta: dMp, kind: 'atk' })
    }

    // 회피
    const newEva = armorBase.value.evasion + (effects.value.회피 ?? 0)
    const curEva = curBase.evasion + (cur.effects.회피 ?? 0)
    const dEva = newEva - curEva
    if (Math.abs(dEva) > 0.01) {
      out.push({ label: '회피', delta: dEva, kind: 'def' })
    }
  }

  return out
})

// v6 등급 변화 한 줄: 점수 = 무기 티어 + 갑옷 티어
const rankLine = computed(() => {
  if (!props.character) return null
  if (currentChapter.value < 6) return null
  const c = props.character
  const curWT = c.weapon?.tier ?? 1
  const curAT = c.armor?.tier ?? 1
  const newWT = isWeapon.value ? props.item.tier : curWT
  const newAT = isWeapon.value ? curAT : props.item.tier
  const curScore = curWT + curAT  // tier 합계, 낮을수록 좋음
  const newScore = newWT + newAT
  const curRank = getClearRank(curScore)
  const newRank = getClearRank(newScore)
  const delta = newScore - curScore  // 양수면 점수 ↑ = 등급 ↓
  const bonusDelta = newRank.bonus - curRank.bonus
  return {
    text: `${curRank.rank}(${curRank.bonus}pt) → ${newRank.rank}(${newRank.bonus}pt) · 티어 ${delta >= 0 ? '+' : ''}${delta}`,
    bonusDelta,
    delta,
  }
})
</script>

<template>
  <div :class="['space-y-0.5 text-[11px] font-mono leading-tight border-2 rounded p-1.5', gradeBorderClass[item.grade]]">
    <!-- 헤더 (아이콘 + 이름) -->
    <div class="flex items-center gap-2">
      <img
        v-if="itemImageUrl(item.kind, item.baseKey)"
        :src="itemImageUrl(item.kind, item.baseKey)!"
        :alt="item.baseKey"
        :class="['w-10 h-10 object-contain flex-shrink-0 border rounded bg-bg-tertiary/50 p-0.5', gradeBorderClass[item.grade]]"
        @error="(e) => ((e.target as HTMLImageElement).style.display = 'none')"
      />
      <div class="flex-1 min-w-0">
        <div :class="[tierColorClass(item.tier), 'text-sm']">
          <ItemName :item="item" />
        </div>
        <div class="text-gray-600 text-[10px]">
          티어 {{ item.tier }} · <span :class="gradeColorClass[item.grade]">{{ item.grade }}</span> · 등급계수 {{ item.coef.toFixed(2) }}
        </div>
        <!-- 공격/방어 벨류 + 변화량 (클릭 가능, 분해 모달) -->
        <div class="flex items-center gap-2 mt-0.5 text-[11px] font-bold">
          <button
            v-if="Math.abs(itemValue.atkValue) > 0.05"
            class="bg-stat-phys_atk/15 hover:bg-stat-phys_atk/25 rounded px-1.5 py-0.5 transition-colors"
            @click.stop="openValueModal('atk')"
            title="전투력(공) 상세 — 방어 10 상대에 틱당 예상 데미지 + 스킬 가중"
          >
            <span :class="itemValue.atkValue >= 0 ? 'text-stat-phys_atk' : 'text-status-burn'">전투력(공) {{ itemValue.atkValue.toFixed(1) }}</span>
            <span
              v-if="character && Math.abs(atkDelta) > 0.05"
              :class="[atkDelta >= 0 ? 'text-log-reward' : 'text-status-burn', 'ml-1']"
            >({{ atkDelta >= 0 ? '+' : '' }}{{ atkDelta.toFixed(1) }})</span>
          </button>
          <button
            v-if="Math.abs(itemValue.defValue) > 0.05"
            class="bg-stat-phys_def/15 hover:bg-stat-phys_def/25 rounded px-1.5 py-0.5 transition-colors"
            @click.stop="openValueModal('def')"
            title="전투력(방) 상세"
          >
            <span :class="itemValue.defValue >= 0 ? 'text-stat-phys_def' : 'text-status-burn'">전투력(방) {{ itemValue.defValue.toFixed(1) }}</span>
            <span
              v-if="character && Math.abs(defDelta) > 0.05"
              :class="[defDelta >= 0 ? 'text-log-reward' : 'text-status-burn', 'ml-1']"
            >({{ defDelta >= 0 ? '+' : '' }}{{ defDelta.toFixed(1) }})</span>
          </button>
        </div>
        <div v-if="equipChanges.length" class="text-[10px] mt-0.5 leading-tight">
          <template v-for="(ch, i) in equipChanges" :key="i">
            <span
              :class="[
                ch.kind === 'atk' ? 'text-stat-phys_atk' : ch.kind === 'def' ? 'text-stat-phys_def' : 'text-gray-300',
                'font-bold',
                i > 0 ? 'ml-1' : '',
              ]"
            >
              {{ ch.label }}
              <template v-if="ch.mult !== undefined">×{{ ch.mult.toFixed(2) }}</template>
              <template v-else-if="ch.amount !== undefined">{{ ch.amount >= 0 ? '+' : '' }}{{ ch.amount.toFixed(2) }}</template>
            </span>
            <span
              v-if="ch.pct !== undefined"
              :class="[ch.pct >= 0 ? 'text-log-reward' : 'text-status-burn', 'ml-0.5']"
            >
              ({{ ch.pct >= 0 ? '+' : '' }}{{ ch.pct.toFixed(0) }}%)
            </span>
            <span v-if="i < equipChanges.length - 1" class="text-gray-600 mx-0.5">·</span>
          </template>
        </div>
        <!-- 현재 장착품과의 교체 비교 (Δ 표시) -->
        <div v-if="compareChanges.length" class="text-[10px] mt-0.5 leading-tight border-t border-gray-700/50 pt-0.5">
          <span class="text-gray-500">교체 시 Δ:</span>
          <template v-for="(ch, i) in compareChanges" :key="`cmp-${i}`">
            <span
              :class="[
                ch.delta >= 0 ? 'text-log-reward' : 'text-status-burn',
                'font-bold ml-1',
              ]"
            >
              {{ ch.label }}
              {{ ch.delta >= 0 ? '+' : '' }}{{ ch.delta.toFixed(2) }}
            </span>
            <span
              v-if="ch.pctDelta !== undefined"
              :class="[ch.pctDelta >= 0 ? 'text-log-reward' : 'text-status-burn']"
            >
              ({{ ch.pctDelta >= 0 ? '+' : '' }}{{ ch.pctDelta.toFixed(0) }}%)
            </span>
            <span v-if="i < compareChanges.length - 1" class="text-gray-600 mx-0.5">·</span>
          </template>
        </div>
      </div>
    </div>

    <!-- 스킬 -->
    <div v-if="skillLine">
      <span class="text-gray-500">스킬:</span>
      <span class="text-log-skill ml-1">{{ skillLine }}</span>
    </div>

    <!-- 특수 효과 -->
    <div v-if="specialLine">
      <span class="text-gray-500">특수:</span>
      <span class="text-trait-special ml-1">{{ specialLine }}</span>
    </div>

    <!-- 던전 등급 변화 -->
    <div v-if="rankLine">
      <span class="text-gray-500">등급변화:</span>
      <span
        :class="rankLine.bonusDelta > 0 ? 'text-log-reward' : rankLine.bonusDelta < 0 ? 'text-status-burn' : 'text-gray-300'"
        class="ml-1"
      >{{ rankLine.text }}</span>
    </div>

    <!-- 벨류 분해 모달 -->
    <div
      v-if="valueModal"
      class="fixed inset-0 z-[80] flex items-center justify-center bg-black/80 px-3 py-6"
      @click.self="valueModal = null"
      @click.stop
    >
      <div class="panel max-w-sm w-full space-y-2" @click.stop>
        <div class="flex items-center justify-between">
          <div class="text-base font-bold">
            <span v-if="valueModal.kind === 'atk'" class="text-stat-phys_atk">전투력(공)</span>
            <span v-else class="text-stat-phys_def">전투력(방)</span>
          </div>
          <button class="text-gray-400 hover:text-white text-xl leading-none" @click="valueModal = null">✕</button>
        </div>
        <div class="text-3xl font-mono font-bold text-log-reward text-center py-2">
          {{ valueModal.total.toFixed(1) }}
        </div>
        <div v-if="valueModal.parts.length === 0" class="text-xs text-gray-500 text-center py-2">기여 없음</div>
        <div v-else class="space-y-1 text-xs">
          <div
            v-for="(p, i) in valueModal.parts"
            :key="i"
            class="bg-bg-tertiary rounded px-2 py-1.5 flex items-baseline justify-between"
          >
            <div class="flex-1 min-w-0">
              <div class="text-gray-200 truncate">{{ p.label }}</div>
              <div v-if="p.note" class="text-[10px] text-gray-500 truncate">{{ p.note }}</div>
            </div>
            <div :class="[p.value >= 0 ? 'text-log-skill' : 'text-status-burn', 'font-mono font-bold ml-2 shrink-0']">
              {{ p.value >= 0 ? '+' : '' }}{{ p.value.toFixed(2) }}
            </div>
          </div>
        </div>
        <button class="btn-secondary w-full text-xs" @click="valueModal = null">닫기</button>
      </div>
    </div>
  </div>
</template>
