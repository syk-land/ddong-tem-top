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
const coef = computed(() => props.item.coef)
const effects = computed(() => props.item.effects)

// 기본 능력치 분해 — 통합 공격력/방어력
const baseSpecLines = computed(() => {
  const lines: string[] = []
  if (weaponBase.value) {
    const base = weaponBase.value.baseAtk
    const traitPctBase = (traitBase.value.공격력_pct ?? 0) + (traitBase.value.전스탯_pct ?? 0)
    const traitFactor = 1 + traitPctBase
    const final = base * (1 + traitPctBase * coef.value)
    lines.push(`공격력 ${base.toFixed(2)} × ${traitFactor.toFixed(2)} × ${coef.value.toFixed(2)} => ${final.toFixed(2)}`)
  }
  if (armorBase.value) {
    const baseD = armorBase.value.baseDef
    const defPctBase = (traitBase.value.방어력_pct ?? 0) + (traitBase.value.전스탯_pct ?? 0)
    const dFactor = 1 + defPctBase
    const dF = baseD * 2.0 * (1 + defPctBase * coef.value)
    lines.push(`방어력 ${baseD.toFixed(2)} × ${dFactor.toFixed(2)} × ${coef.value.toFixed(2)} => ${dF.toFixed(2)}`)
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
  let atk = 0
  if (weaponBase.value) {
    const traitPctBase = (traitBase.value.공격력_pct ?? 0) + (traitBase.value.전스탯_pct ?? 0)
    const finalAtk = weaponBase.value.baseAtk * (1 + traitPctBase * coef.value)
    atk = finalAtk * accMult * penMult * speedFin * luckMult * lifestealMult * statusMult * selfDotPenalty
  } else if (armorBase.value) {
    // 갑옷의 공격력 기여: 속도/명중/관통 보조
    atk = 10 * speedFin * accMult * penMult * luckMult * selfDotPenalty
  }

  // === 방어력 계수 ===
  let def = 0
  if (armorBase.value) {
    const defPctBase = (traitBase.value.방어력_pct ?? 0) + (traitBase.value.전스탯_pct ?? 0)
    const finalDef = armorBase.value.baseDef * 2.0 * (1 + defPctBase * coef.value)
    def = finalDef * evaMult * stResMult * mpMult * dmgHealMult * selfDotPenalty
  } else if (weaponBase.value) {
    // 무기의 방어력 기여: 트레잇 방어% + 회피/저항
    const defPctBase = (traitBase.value.방어력_pct ?? 0) + (traitBase.value.전스탯_pct ?? 0)
    def = 10 * (1 + defPctBase * coef.value) * evaMult * stResMult * selfDotPenalty
  }

  return { atk, def }
})

const totalScore = computed(() => itemCoef.value.atk + itemCoef.value.def)

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
        <div class="text-[10px] mt-0.5">
          <span class="text-stat-phys_atk font-bold">공 {{ itemCoef.atk.toFixed(2) }}</span>
          <span class="text-gray-600 mx-1">/</span>
          <span class="text-stat-phys_def font-bold">방 {{ itemCoef.def.toFixed(2) }}</span>
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
