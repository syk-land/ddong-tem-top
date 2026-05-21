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
// 자기 자신(현재 장착 중) 체크
const isSameAsEquipped = computed(() => {
  const cur = currentSlotItem.value
  return !!cur && cur.id === props.item.id
})

// ── 캐릭터 총합 기준 비교 ──
//   현재 캐릭터 = (현재 무기 + 현재 갑옷) atkValue/defValue 합
//   새 캐릭터 = (이 아이템으로 슬롯 교체) 합
//   pct = (새 - 현재) / 현재 × 100  (분모: 현재 캐릭터 총합)
const otherSlotValue = computed(() => {
  if (!props.character) return { atkValue: 0, defValue: 0 }
  const other = isWeapon.value ? props.character.armor : props.character.weapon
  return computeItemValue(other, props.character, { chapter: chapterForValue.value })
})
const totalCurrent = computed(() => {
  const w = computeItemValue(props.character?.weapon ?? null, props.character, { chapter: chapterForValue.value })
  const a = computeItemValue(props.character?.armor ?? null, props.character, { chapter: chapterForValue.value })
  return { atk: w.atkValue + a.atkValue, def: w.defValue + a.defValue }
})
const totalNew = computed(() => ({
  atk: itemValue.value.atkValue + otherSlotValue.value.atkValue,
  def: itemValue.value.defValue + otherSlotValue.value.defValue,
}))
const atkDelta = computed(() => totalNew.value.atk - totalCurrent.value.atk)
const defDelta = computed(() => totalNew.value.def - totalCurrent.value.def)
const atkPct = computed<number | null>(() => {
  if (isSameAsEquipped.value) return null
  const cur = totalCurrent.value.atk
  if (Math.abs(cur) < 0.05) return null
  return Math.max(-100, (atkDelta.value / cur) * 100)
})
const defPct = computed<number | null>(() => {
  if (isSameAsEquipped.value) return null
  const cur = totalCurrent.value.def
  if (Math.abs(cur) < 0.05) return null
  return Math.max(-100, (defDelta.value / cur) * 100)
})

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
//   갑옷 def% = baseDef × coef × (1 + trait_pct)  (+ 체력 × 0.3 × coef, stats.ts에서)
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
      `방어 ${baseD} × ${coef.value.toFixed(2)} × (1${fmt(defPctBase)}) = ${dF.toFixed(2)}%  (+ 체력 × 0.3 × ${coef.value.toFixed(2)})`,
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

// 장비 계수 (v9) — itemValue 의 atkValue/defValue 그대로 사용
const itemCoef = computed(() => ({
  atk: itemValue.value.atkValue,
  def: itemValue.value.defValue,
}))

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

// v9 장착 변화 — 캐릭터 총합 기준 (무기 + 갑옷 합산)
const equipChanges = computed<EquipDelta[]>(() => {
  if (!props.character) return []
  const out: EquipDelta[] = []
  const newTotalAtk = totalNew.value.atk
  const newTotalDef = totalNew.value.def
  const curTotalAtk = totalCurrent.value.atk
  const curTotalDef = totalCurrent.value.def

  if (weaponBase.value || armorBase.value) {
    const dAtk = newTotalAtk - curTotalAtk
    if (Math.abs(dAtk) > 0.05) {
      out.push({
        label: '전투력(공)',
        amount: dAtk,
        pct: Math.abs(curTotalAtk) > 0.05 ? Math.max(-100, (dAtk / curTotalAtk) * 100) : 0,
        kind: 'atk',
        note: `${curTotalAtk.toFixed(1)} → ${newTotalAtk.toFixed(1)}`,
      })
    }
    const dDef = newTotalDef - curTotalDef
    if (Math.abs(dDef) > 0.05) {
      out.push({
        label: '전투력(방)',
        amount: dDef,
        pct: Math.abs(curTotalDef) > 0.05 ? Math.max(-100, (dDef / curTotalDef) * 100) : 0,
        kind: 'def',
        note: `${curTotalDef.toFixed(1)} → ${newTotalDef.toFixed(1)}`,
      })
    }
  }

  // 명중/회피 (단순 표시)
  const accBonus = (effects.value.명중 ?? 0) + (weaponBase.value?.accBonus ?? 0)
  if (Math.abs(accBonus) > 0.001) {
    out.push({ label: '명중', amount: accBonus, kind: 'neutral' })
  }
  const evaBonus = (effects.value.회피 ?? 0)
    + (armorBase.value?.evasion ?? 0)
    + (weaponBase.value?.evaBonus ?? 0)
  if (Math.abs(evaBonus) > 0.001) {
    out.push({ label: '회피', amount: evaBonus, kind: 'def' })
  }

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
  // v9: equipChanges 가 이미 itemValue 기반 단순 비교로 처리
  // 별도 비교 라인 불필요 (중복 제거)
  return []
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
        <!-- 전투력 — 공방 모두 표시 (비교는 같은 슬롯 = 무기↔무기, 갑옷↔갑옷) -->
        <div class="flex items-center gap-1.5 mt-0.5 text-[11px] font-bold flex-wrap">
          <!-- 공 -->
          <button
            v-if="Math.abs(itemValue.atkValue) > 0.05"
            class="bg-stat-phys_atk/15 hover:bg-stat-phys_atk/25 rounded px-2 py-0.5 transition-colors flex items-center gap-1"
            @click.stop="openValueModal('atk')"
            title="전투력(공) 상세"
          >
            <span class="text-stat-phys_atk text-[10px] opacity-80">공</span>
            <template v-if="character && atkPct !== null">
              <span :class="[atkPct >= 0 ? 'text-log-reward' : 'text-status-burn', 'text-sm']">
                {{ atkPct >= 0 ? '+' : '' }}{{ Math.round(atkPct) }}%
              </span>
            </template>
            <template v-else-if="character && isSameAsEquipped">
              <span class="text-gray-400 text-[10px]">현재 장착</span>
            </template>
            <template v-else>
              <span class="text-stat-phys_atk text-[10px]">신규</span>
            </template>
            <span class="text-gray-500 text-[10px] opacity-70 font-normal">({{ totalNew.atk.toFixed(1) }})</span>
          </button>

          <!-- 방 -->
          <button
            v-if="Math.abs(itemValue.defValue) > 0.05"
            class="bg-stat-phys_def/15 hover:bg-stat-phys_def/25 rounded px-2 py-0.5 transition-colors flex items-center gap-1"
            @click.stop="openValueModal('def')"
            title="전투력(방) 상세"
          >
            <span class="text-stat-phys_def text-[10px] opacity-80">방</span>
            <template v-if="character && defPct !== null">
              <span :class="[defPct >= 0 ? 'text-log-reward' : 'text-status-burn', 'text-sm']">
                {{ defPct >= 0 ? '+' : '' }}{{ Math.round(defPct) }}%
              </span>
            </template>
            <template v-else-if="character && isSameAsEquipped">
              <span class="text-gray-400 text-[10px]">현재 장착</span>
            </template>
            <template v-else>
              <span class="text-stat-phys_def text-[10px]">신규</span>
            </template>
            <span class="text-gray-500 text-[10px] opacity-70 font-normal">({{ totalNew.def.toFixed(1) }})</span>
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
