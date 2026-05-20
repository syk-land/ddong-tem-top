<script setup lang="ts">
import { computed } from 'vue'
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

// 기본 능력치 분해 — v4 가산식 모델
// 공식 (stats.ts):
//   무기: 종합 공격계수 = baseAtk × (등급보너스 + 특성보너스)
//   갑옷: 종합 방어계수 = baseDef × 2 × (등급보너스 + 특성보너스)
// 등급보너스 = coef (등급 굴림 결과)
// 특성보너스 = trait%_base (unscaled)
// ( ) 안은 두 보너스의 단일 합계로 출력
const baseSpecLines = computed(() => {
  const lines: string[] = []
  const fmt = (n: number) => (n >= 0 ? '+' : '') + n.toFixed(2)
  if (weaponBase.value) {
    const base = weaponBase.value.baseAtk
    const traitPctBase = (traitBase.value.공격력_pct ?? 0) + (traitBase.value.전스탯_pct ?? 0)
    const sumBonus = coef.value + traitPctBase
    const final = base * sumBonus
    lines.push(
      `공격력 ${base.toFixed(2)} × (${coef.value.toFixed(2)} ${fmt(traitPctBase)}) = ${base.toFixed(2)} × ${sumBonus.toFixed(2)} = ${final.toFixed(2)}`,
    )
  }
  if (armorBase.value) {
    const baseD = armorBase.value.baseDef
    const defPctBase = (traitBase.value.방어력_pct ?? 0) + (traitBase.value.전스탯_pct ?? 0)
    const sumBonus = coef.value + defPctBase
    const dF = baseD * 2.0 * sumBonus
    lines.push(
      `방어력 ${baseD.toFixed(2)} × 2 × (${coef.value.toFixed(2)} ${fmt(defPctBase)}) = ${baseD.toFixed(2)} × 2 × ${sumBonus.toFixed(2)} = ${dF.toFixed(2)}`,
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

// 명중/회피/속도 한 줄
const acc = computed(() => {
  let t = 0
  if (weaponBase.value) t += weaponBase.value.accBonus
  if (effects.value.명중) t += effects.value.명중
  return t
})
const eva = computed(() => {
  let t = 0
  if (armorBase.value) t += armorBase.value.evasion
  if (effects.value.회피) t += effects.value.회피
  return t
})
const speedMult = computed(() => {
  if (weaponBase.value) return weaponBase.value.speedCoef
  if (armorBase.value) return armorBase.value.speedMult
  return 1
})
const speedPctTrait = computed(() => effects.value.속도_pct ?? 0)
// 속도 최종 배율 = 베이스 배율 × (1 + 트레잇 %)
const speedFinal = computed(() => speedMult.value * (1 + speedPctTrait.value))

const moveLine = computed(() => {
  const parts: string[] = []
  parts.push(`명중 ${acc.value >= 0 ? '+' : ''}${acc.value.toFixed(2)}`)
  parts.push(`회피 ${eva.value >= 0 ? '+' : ''}${eva.value.toFixed(2)}`)
  parts.push(`속도 ×${speedFinal.value.toFixed(2)}`)
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
  // 갑옷 베이스 보너스 (로브 마력 +30, 가죽갑 회피 +12 등 — 트레잇 효과와 별도)
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
  // 속도 — 무기 coef 또는 갑옷 배율, 트레잇 속도% 적용
  const speedFin = (weaponBase.value?.speedCoef ?? armorBase.value?.speedMult ?? 1) * (1 + speedPctTrait.value)
  // 상태이상 발동 평균 (DPS 보너스)
  const statusSum = (e.burn_chance ?? 0) + (e.bleed_chance ?? 0) + (e.poison_chance ?? 0) +
                    (e.slow_chance ?? 0) + (e.blind_chance ?? 0) + (e.shock_chance ?? 0)
  const statusMult = 1 + statusSum * 0.5
  // 마력 보너스 (갑옷 mpBonus + 트레잇 마력)
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
//   공통: 트레잇의 명중/회피
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
  const baselineAtk = c.stats.공격력 + c.stats.마력
  const baselineDef = c.stats.방어력 * 2.0
  // 현재 캐릭터의 마력계수 (마법 무기 contribution 에 곱)
  const playerMagicCoef = Math.max(0.1, Math.min(3.0, 1 + (c.stats.마력 - 15) * 0.07))
  const out: EquipDelta[] = []

  if (weaponBase.value) {
    // 무기 공격력 (종합 × 공속) → DPS 기여
    // 마법 무기는 추가로 마력계수 곱 (= 마력계수 × 발동률(speedFin proxy) × 데미지)
    const traitAtkPct = (traitBase.value.공격력_pct ?? 0) + (traitBase.value.전스탯_pct ?? 0)
    const weaponAtk = weaponBase.value.baseAtk * (coef.value + traitAtkPct)
    const speedFin = weaponBase.value.speedCoef * (1 + speedPctTrait.value)
    const isMagic = weaponBase.value.isMagic
    const magicMult = isMagic ? playerMagicCoef : 1
    const contribution = weaponAtk * speedFin * magicMult
    out.push({
      label: isMagic ? `공격력 (마법 ×${playerMagicCoef.toFixed(2)})` : '공격력',
      amount: contribution,
      pct: baselineAtk > 0 ? (contribution / baselineAtk) * 100 : 0,
      kind: 'atk',
      note: isMagic
        ? `${weaponAtk.toFixed(2)} × ${speedFin.toFixed(2)} × ${playerMagicCoef.toFixed(2)} (마력계수)`
        : `${weaponAtk.toFixed(2)} × ${speedFin.toFixed(2)}`,
    })
  }

  if (armorBase.value) {
    // 1) 방어력 종합
    const traitDefPct = (traitBase.value.방어력_pct ?? 0) + (traitBase.value.전스탯_pct ?? 0)
    const armorDef = armorBase.value.baseDef * 2.0 * (coef.value + traitDefPct)
    out.push({
      label: '방어력',
      amount: armorDef,
      pct: baselineDef > 0 ? (armorDef / baselineDef) * 100 : 0,
      kind: 'def',
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
      // 마법공격력 기준 베이스 (무기 무관 — 캐릭터 공격력 stat 만)
      const magicBaselineAtk = c.stats.공격력
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

  // 4) 명중 modifier (트레잇 scaled + 무기 accBonus)
  const accBonus = (effects.value.명중 ?? 0) + (weaponBase.value?.accBonus ?? 0)
  if (Math.abs(accBonus) > 0.001) {
    out.push({
      label: '명중',
      amount: accBonus,
      kind: 'neutral',
    })
  }

  // 5) 회피 modifier (갑옷 base + 트레잇 scaled)
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
      out.push({
        label: '공격력',
        delta: dAtk,
        pctDelta: curAtk > 0 ? (dAtk / curAtk) * 100 : 0,
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
      out.push({
        label: '방어력',
        delta: dDef,
        pctDelta: curDef > 0 ? (dDef / curDef) * 100 : 0,
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

// 던전 등급 변화 한 줄 (6챕터부터 표시)
const rankLine = computed(() => {
  if (!props.character) return null
  if (currentChapter.value < 6) return null
  const c = props.character
  const curWT = c.weapon?.tier ?? 1
  const curAT = c.armor?.tier ?? 1
  const newWT = isWeapon.value ? props.item.tier : curWT
  const newAT = isWeapon.value ? curAT : props.item.tier
  const curEqScore = ((17 - (curWT + curAT) / 2) / 16) * 100
  const newEqScore = ((17 - (newWT + newAT) / 2) / 16) * 100
  const goldScore = Math.min(100, (c.gold / 1890) * 100)
  const hpScore = (c.hp / c.maxHp) * 100
  const curScore = Math.round((curEqScore + goldScore + hpScore) / 3)
  const newScore = Math.round((newEqScore + goldScore + hpScore) / 3)
  const curRank = getClearRank(curScore)
  const newRank = getClearRank(newScore)
  const delta = newScore - curScore
  const bonusDelta = newRank.bonus - curRank.bonus
  return {
    text: `${curRank.rank}(${curRank.bonus}점) → ${newRank.rank}(${newRank.bonus}점) · ${delta > 0 ? '+' : ''}${delta}점`,
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

    <!-- 기본 능력치 -->
    <div v-for="(line, i) in baseSpecLines" :key="i">
      <span class="text-gray-500">기본능력치:</span>
      <span class="text-gray-200 ml-1">{{ line }}</span>
    </div>

    <!-- 스킬 -->
    <div v-if="skillLine">
      <span class="text-gray-500">스킬:</span>
      <span class="text-log-skill ml-1">{{ skillLine }}</span>
    </div>

    <!-- 명중/회피/속도 -->
    <div>
      <span class="text-gray-500">보정:</span>
      <span class="text-gray-300 ml-1">{{ moveLine }}</span>
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
  </div>
</template>
