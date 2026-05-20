<script setup lang="ts">
import { computed, ref } from 'vue'
import { useGameStore } from '@/stores/game'
import { statColorClass, tierColorClass, gradeColorClass } from '@/ui/colors'
import ItemName from '@/ui/components/ItemName.vue'
import StatusBadges from '@/ui/components/StatusBadges.vue'
import { computeEffectiveStats } from '@/core/stats'
import { SKILLS } from '@/data/skills'
import { CHALLENGES_MAP } from '@/data/challenges'
import { WEAPONS } from '@/data/weapons'
import { ARMORS } from '@/data/armor'
import { WEAPON_TRAITS, ARMOR_TRAITS } from '@/data/traits'

const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{ (e: 'close'): void }>()

const game = useGameStore()
const c = computed(() => game.run!.character)
const effective = computed(() => computeEffectiveStats(c.value))
const skillKeys = computed(() => game.availableSkills)
const weaponProcPct = computed(() => game.weaponSkillProcPct)

// 탭
const tab = ref<'base' | 'detail'>('base')

// 상세 능력치 클릭 시 breakdown 모달
interface Breakdown { from: string; value: number; note?: string }
const detailModal = ref<{ name: string; total: number; entries: Breakdown[] } | null>(null)

// 현재 활성 챌린지
const activeChallenges = computed(() => {
  const ctx = game.challengeContext
  if (!ctx) return []
  return ctx.active.map((ac) => {
    const def = CHALLENGES_MAP[ac.key]
    return { ac, def }
  }).filter((e) => e.def !== undefined)
})

async function unequipSlot(slot: 'weapon' | 'armor') {
  const result = game.unequipToInventory(slot)
  if (!result.ok) await game.alertModal(result.reason ?? '해제 실패', '해제 실패')
}
function effectEntries(item: { effects: Record<string, number | undefined> }) {
  return Object.entries(item.effects).filter(([, v]) => v !== undefined && v !== 0)
}
function formatValue(v: number): string {
  return Math.abs(v) < 1 ? (v * 100).toFixed(1) + '%' : v.toFixed(1)
}

// ===== Breakdown =====
function breakdownAtk(): Breakdown[] {
  const s = c.value.stats
  const w = c.value.weapon
  const wb = w ? WEAPONS[w.baseKey] : null
  const out: Breakdown[] = [
    { from: '힘 스탯', value: s.힘 * 2.5, note: `힘 ${s.힘} × 2.5` },
  ]
  if (w && wb) {
    const t = WEAPON_TRAITS[w.trait]?.effects ?? {}
    const pct = (t.공격력_pct ?? 0) + (t.전스탯_pct ?? 0)
    const weaponPart = wb.baseAtk * (w.coef + pct)
    out.push({
      from: `무기 (${w.baseKey})`,
      value: weaponPart,
      note: `${wb.baseAtk} × (등급 ${w.coef} + 특성 ${pct.toFixed(2)})`,
    })
  }
  return out
}
function breakdownDef(): Breakdown[] {
  const s = c.value.stats
  const a = c.value.armor
  const ab = a ? ARMORS[a.baseKey as keyof typeof ARMORS] : null
  const out: Breakdown[] = [
    { from: '체력 스탯', value: s.체력 * 2.5, note: `체력 ${s.체력} × 2.5` },
  ]
  if (a && ab) {
    const t = ARMOR_TRAITS[a.trait]?.effects ?? {}
    const pct = (t.방어력_pct ?? 0) + (t.전스탯_pct ?? 0)
    const armorPart = ab.baseDef * 2.0 * (a.coef + pct)
    out.push({
      from: `갑옷 (${a.baseKey})`,
      value: armorPart,
      note: `${ab.baseDef} × 2 × (등급 ${a.coef} + 특성 ${pct.toFixed(2)})`,
    })
  }
  return out
}
function breakdownSpeed(): Breakdown[] {
  const s = c.value.stats
  const w = c.value.weapon
  const a = c.value.armor
  const wt = w ? (WEAPON_TRAITS[w.trait]?.effects.속도_pct ?? 0) : 0
  const at = a ? (ARMOR_TRAITS[a.trait]?.effects.속도_pct ?? 0) : 0
  const armorMult = a ? ARMORS[a.baseKey as keyof typeof ARMORS]?.speedMult ?? 1 : 1
  const weaponCoef = w ? WEAPONS[w.baseKey]?.speedCoef ?? 1 : 1
  const baseSpeed = s.민첩
  const out: Breakdown[] = [
    { from: '민첩 스탯', value: baseSpeed, note: `민첩 ${s.민첩}` },
  ]
  if (wt + at !== 0) {
    out.push({ from: '특성 속도%', value: baseSpeed * (wt + at), note: `+${((wt + at) * 100).toFixed(0)}%` })
  }
  const afterTrait = baseSpeed * (1 + wt + at)
  if (armorMult !== 1) {
    out.push({ from: `갑옷 배율 (${a?.baseKey})`, value: afterTrait * (armorMult - 1), note: `×${armorMult.toFixed(2)}` })
  }
  const afterArmor = afterTrait * armorMult
  if (Math.abs(weaponCoef - 1) > 0.001) {
    out.push({ from: `무기 공속 (${w?.baseKey})`, value: afterArmor * (weaponCoef - 1), note: `×${weaponCoef.toFixed(2)}` })
  }
  return out
}
function breakdownAcc(): Breakdown[] {
  const s = c.value.stats
  const w = c.value.weapon
  const a = c.value.armor
  const out: Breakdown[] = [
    { from: '민첩 × 0.5', value: s.민첩 * 0.5 },
    { from: '행운 × 0.3', value: s.행운 * 0.3 },
  ]
  if (w?.effects.명중) out.push({ from: `무기 특성`, value: w.effects.명중 })
  if (a?.effects.명중) out.push({ from: `갑옷 특성`, value: a.effects.명중 })
  const wb = w ? WEAPONS[w.baseKey] : null
  if (wb?.accBonus) out.push({ from: `무기 베이스 (${w!.baseKey})`, value: wb.accBonus })
  return out
}
function breakdownEva(): Breakdown[] {
  const s = c.value.stats
  const w = c.value.weapon
  const a = c.value.armor
  const out: Breakdown[] = [
    { from: '민첩 × 0.5', value: s.민첩 * 0.5 },
    { from: '행운 × 0.3', value: s.행운 * 0.3 },
  ]
  if (w?.effects.회피) out.push({ from: `무기 특성`, value: w.effects.회피 })
  if (a?.effects.회피) out.push({ from: `갑옷 특성`, value: a.effects.회피 })
  const ab = a ? ARMORS[a.baseKey as keyof typeof ARMORS] : null
  if (ab?.evasion) out.push({ from: `갑옷 베이스 (${a!.baseKey})`, value: ab.evasion })
  return out
}
function breakdownPen(): Breakdown[] {
  const s = c.value.stats
  const w = c.value.weapon
  const out: Breakdown[] = [
    { from: '힘 × 0.5', value: s.힘 * 0.5 },
    { from: '행운 × 0.3', value: s.행운 * 0.3 },
  ]
  if (w?.effects.관통) out.push({ from: `무기 특성`, value: w.effects.관통 })
  const wb = w ? WEAPONS[w.baseKey] : null
  if (wb?.penBonus) out.push({ from: `무기 베이스 관통 (${w!.baseKey})`, value: wb.penBonus })
  if (wb?.magicPenBonus) out.push({ from: `마법 관통`, value: wb.magicPenBonus })
  return out
}
function breakdownResist(): Breakdown[] {
  const s = c.value.stats
  const w = c.value.weapon
  const a = c.value.armor
  const out: Breakdown[] = [
    { from: '체력 × 0.5', value: s.체력 * 0.5 },
    { from: '마력 × 0.5', value: s.마력 * 0.5 },
    { from: '행운 × 0.3', value: s.행운 * 0.3 },
  ]
  if (w?.effects.상태저항) out.push({ from: `무기 특성`, value: w.effects.상태저항 })
  if (a?.effects.상태저항) out.push({ from: `갑옷 특성`, value: a.effects.상태저항 })
  return out
}
function breakdownMagicCoef(): Breakdown[] {
  const s = c.value.stats
  const a = c.value.armor
  const w = c.value.weapon
  const ab = a ? ARMORS[a.baseKey as keyof typeof ARMORS] : null
  const out: Breakdown[] = [
    { from: '마력 스탯', value: s.마력, note: `기준치 15, 1pt당 ±0.05 (cap 1.8)` },
  ]
  const mpBonus = (a?.effects.마력 ?? 0) + (w?.effects.마력 ?? 0) + (ab?.mpBonus ?? 0)
  if (mpBonus) out.push({ from: `장비 마력 보너스`, value: mpBonus })
  return out
}

function openDetail(name: string, total: number, entries: Breakdown[]) {
  detailModal.value = { name, total, entries }
}
</script>

<template>
  <div
    v-if="props.open"
    class="fixed inset-0 z-40 flex items-center justify-center bg-black/70 px-3 py-6"
    @click.self="emit('close')"
  >
    <div class="panel max-w-lg w-full max-h-[90vh] overflow-y-auto space-y-3">
      <header class="flex items-center justify-between sticky top-0 bg-bg-panel z-10 -mx-3 px-3 py-1">
        <div class="text-lg font-bold">상태창</div>
        <button class="text-gray-400 hover:text-white text-xl leading-none" @click="emit('close')">✕</button>
      </header>

      <!-- HP / MP / Gold -->
      <div class="grid grid-cols-3 gap-2 text-xs font-mono">
        <div class="bg-bg-tertiary rounded px-2 py-1.5">
          <div class="text-[10px] text-stat-hp">체력</div>
          <div>{{ c.hp }} / {{ c.maxHp }}</div>
        </div>
        <div class="bg-bg-tertiary rounded px-2 py-1.5">
          <div class="text-[10px] text-stat-mp">마력</div>
          <div>{{ c.mp }} / {{ c.maxMp }}</div>
        </div>
        <div class="bg-bg-tertiary rounded px-2 py-1.5">
          <div class="text-[10px] text-stat-luck">골드</div>
          <div>{{ c.gold }}G</div>
        </div>
      </div>

      <!-- 탭 -->
      <div class="flex gap-1 border-b border-slate-700">
        <button
          class="px-3 py-1.5 text-xs font-bold rounded-t"
          :class="tab === 'base' ? 'bg-bg-tertiary text-gray-100' : 'text-gray-500 hover:text-gray-300'"
          @click="tab = 'base'"
        >기본 능력치</button>
        <button
          class="px-3 py-1.5 text-xs font-bold rounded-t"
          :class="tab === 'detail' ? 'bg-bg-tertiary text-gray-100' : 'text-gray-500 hover:text-gray-300'"
          @click="tab = 'detail'"
        >상세 능력치</button>
      </div>

      <!-- 기본 능력치 (5스탯만) -->
      <div v-if="tab === 'base'" class="bg-bg-tertiary rounded p-2 space-y-1">
        <div class="text-xs text-gray-400 mb-1">5스탯</div>
        <div class="grid grid-cols-2 gap-x-3 gap-y-1.5 text-sm font-mono">
          <div :class="statColorClass.힘"><span class="text-gray-500">힘</span> {{ c.stats.힘 }}</div>
          <div :class="statColorClass.민첩"><span class="text-gray-500">민첩</span> {{ c.stats.민첩 }}</div>
          <div :class="statColorClass.체력"><span class="text-gray-500">체력</span> {{ c.stats.체력 }}</div>
          <div :class="statColorClass.마력"><span class="text-gray-500">마력</span> {{ c.stats.마력 }}</div>
          <div :class="statColorClass.행운"><span class="text-gray-500">행운</span> {{ c.stats.행운 }}</div>
        </div>
        <div class="text-[10px] text-gray-500 mt-2 leading-snug">
          힘 → 공격력·관통 / 민첩 → 속도·명중·회피 / 체력 → 방어·HP / 마력 → MP·마법계수 / 행운 → 크리·발동률·명중·회피·관통·저항
        </div>
      </div>

      <!-- 상세 능력치 (파생, 클릭 시 breakdown) -->
      <div v-if="tab === 'detail'" class="bg-bg-tertiary rounded p-2 space-y-1">
        <div class="text-xs text-gray-400 mb-1">파생 (장비/특성 포함) — 항목 클릭 시 상세 분해</div>
        <div class="grid grid-cols-2 gap-1 text-xs font-mono">
          <button class="text-left bg-slate-800 hover:bg-slate-700 rounded px-2 py-1"
                  @click="openDetail('공격력', effective.공격력, breakdownAtk())">
            <span class="text-stat-phys_atk">공격력</span> <span class="font-bold">{{ effective.공격력.toFixed(1) }}</span>
          </button>
          <button class="text-left bg-slate-800 hover:bg-slate-700 rounded px-2 py-1"
                  @click="openDetail('방어력', effective.방어력_effective, breakdownDef())">
            <span class="text-stat-phys_def">방어력</span> <span class="font-bold">{{ effective.방어력_effective.toFixed(1) }}</span>
          </button>
          <button class="text-left bg-slate-800 hover:bg-slate-700 rounded px-2 py-1"
                  @click="openDetail('마법공격력', effective.마법공격력, [{from:'공격력 × 마력계수', value: effective.마법공격력, note: `${effective.공격력.toFixed(1)} × ${effective.마력계수.toFixed(2)}`}])">
            <span class="text-stat-mp">마법공격</span> <span class="font-bold">{{ effective.마법공격력.toFixed(1) }}</span>
          </button>
          <button class="text-left bg-slate-800 hover:bg-slate-700 rounded px-2 py-1"
                  @click="openDetail('마력계수', effective.마력계수, breakdownMagicCoef())">
            <span class="text-stat-mp">마법×</span> <span class="font-bold">×{{ effective.마력계수.toFixed(2) }}</span>
          </button>
          <button class="text-left bg-slate-800 hover:bg-slate-700 rounded px-2 py-1"
                  @click="openDetail('속도', effective.속도, breakdownSpeed())">
            <span class="text-stat-speed">속도</span> <span class="font-bold">{{ effective.속도.toFixed(1) }}</span>
          </button>
          <button class="text-left bg-slate-800 hover:bg-slate-700 rounded px-2 py-1"
                  @click="openDetail('명중률', effective.명중률, breakdownAcc())">
            <span class="text-stat-util">명중</span> <span class="font-bold">{{ effective.명중률.toFixed(1) }}</span>
          </button>
          <button class="text-left bg-slate-800 hover:bg-slate-700 rounded px-2 py-1"
                  @click="openDetail('회피율', effective.회피율, breakdownEva())">
            <span class="text-stat-util">회피</span> <span class="font-bold">{{ effective.회피율.toFixed(1) }}</span>
          </button>
          <button class="text-left bg-slate-800 hover:bg-slate-700 rounded px-2 py-1"
                  @click="openDetail('관통', effective.관통, breakdownPen())">
            <span class="text-stat-util">관통</span> <span class="font-bold">{{ effective.관통.toFixed(1) }}</span>
          </button>
          <button class="text-left bg-slate-800 hover:bg-slate-700 rounded px-2 py-1"
                  @click="openDetail('상태저항', effective.상태저항, breakdownResist())">
            <span class="text-stat-util">상태저항</span> <span class="font-bold">{{ effective.상태저항.toFixed(1) }}</span>
          </button>
          <div class="bg-slate-800/60 rounded px-2 py-1">
            <span class="text-stat-hp">HP</span> <span class="font-bold">{{ c.maxHp }}</span>
          </div>
          <div class="bg-slate-800/60 rounded px-2 py-1">
            <span class="text-stat-mp">MP</span> <span class="font-bold">{{ c.maxMp }}</span>
          </div>
        </div>
      </div>

      <!-- 상태이상 -->
      <div v-if="c.statuses.length > 0" class="bg-bg-tertiary rounded p-2 space-y-1">
        <div class="text-xs text-gray-400 mb-1">상태이상</div>
        <StatusBadges :statuses="c.statuses" />
      </div>

      <!-- 장착 무기 -->
      <div class="bg-bg-tertiary rounded p-2 space-y-2">
        <div class="flex items-center justify-between">
          <div class="text-xs text-gray-400">무기</div>
          <button
            v-if="c.weapon"
            class="text-[10px] px-2 py-0.5 rounded bg-slate-700 text-gray-300 hover:bg-slate-600"
            @click="unequipSlot('weapon')"
          >해제</button>
        </div>
        <div v-if="c.weapon">
          <div :class="[tierColorClass(c.weapon.tier), 'font-mono text-sm']">
            <ItemName :item="c.weapon" />
          </div>
          <div class="text-[10px] text-gray-500">
            T{{ c.weapon.tier }} ·
            <span :class="gradeColorClass[c.weapon.grade]">{{ c.weapon.grade }}</span>
            · 등급계수 {{ c.weapon.coef.toFixed(2) }}
          </div>
          <div v-if="effectEntries(c.weapon as any).length > 0" class="mt-1 text-[10px] grid grid-cols-2 gap-x-3 font-mono">
            <div v-for="[k, v] in effectEntries(c.weapon as any)" :key="k" class="text-gray-300">
              <span class="text-gray-500">{{ k }}:</span> <span class="text-log-skill">{{ formatValue(v as number) }}</span>
            </div>
          </div>
        </div>
        <div v-else class="text-xs text-gray-600">맨손</div>
      </div>

      <!-- 장착 갑옷 -->
      <div class="bg-bg-tertiary rounded p-2 space-y-2">
        <div class="flex items-center justify-between">
          <div class="text-xs text-gray-400">갑옷</div>
          <button
            v-if="c.armor"
            class="text-[10px] px-2 py-0.5 rounded bg-slate-700 text-gray-300 hover:bg-slate-600"
            @click="unequipSlot('armor')"
          >해제</button>
        </div>
        <div v-if="c.armor">
          <div :class="[tierColorClass(c.armor.tier), 'font-mono text-sm']">
            <ItemName :item="c.armor" />
          </div>
          <div class="text-[10px] text-gray-500">
            T{{ c.armor.tier }} ·
            <span :class="gradeColorClass[c.armor.grade]">{{ c.armor.grade }}</span>
            · 등급계수 {{ c.armor.coef.toFixed(2) }}
          </div>
          <div v-if="effectEntries(c.armor as any).length > 0" class="mt-1 text-[10px] grid grid-cols-2 gap-x-3 font-mono">
            <div v-for="[k, v] in effectEntries(c.armor as any)" :key="k" class="text-gray-300">
              <span class="text-gray-500">{{ k }}:</span> <span class="text-log-skill">{{ formatValue(v as number) }}</span>
            </div>
          </div>
        </div>
        <div v-else class="text-xs text-gray-600">없음</div>
      </div>

      <!-- 자동 발동 스킬 -->
      <div v-if="skillKeys.length > 0" class="bg-bg-tertiary rounded p-2 space-y-1">
        <div class="text-xs text-gray-400">⚡ 자동 발동 스킬</div>
        <div class="space-y-0.5 text-xs">
          <div v-for="key in skillKeys" :key="key" class="flex items-baseline justify-between">
            <span>
              <span class="text-log-skill">{{ SKILLS[key]?.name ?? key }}</span>
              <span class="text-gray-500 ml-2 text-[10px]">{{ SKILLS[key]?.description }}</span>
            </span>
            <span v-if="SKILLS[key]?.kind === 'physical_atk' || SKILLS[key]?.kind === 'magic_atk'"
                  class="text-stat-util font-mono">{{ weaponProcPct }}%</span>
            <span v-else class="text-[10px] text-gray-600">조건부</span>
          </div>
        </div>
      </div>

      <!-- 선택한 챌린지 -->
      <div v-if="activeChallenges.length > 0" class="bg-bg-tertiary rounded p-2 space-y-2">
        <div class="text-xs text-gray-400">🎯 챌린지</div>
        <div
          v-for="{ ac, def } in activeChallenges"
          :key="ac.key"
          class="space-y-0.5 text-[11px]"
        >
          <div class="flex items-center justify-between">
            <span :class="ac.failed ? 'text-gray-500 line-through' : 'text-trait-special font-bold'">
              {{ def.name }}
            </span>
            <span
              class="text-[10px] px-1.5 py-0.5 rounded"
              :class="ac.failed
                ? 'bg-status-burn/30 text-status-burn'
                : (def.category === 'risk' ? 'bg-grade-special/30 text-grade-special' : 'bg-log-skill/30 text-log-skill')"
            >
              {{ ac.failed ? '실패' : (def.category === 'risk' ? '리스크' : '즉시') }}
            </span>
          </div>
          <div class="text-[10px] text-gray-400">{{ def.description }}</div>
          <div class="text-[10px]">
            <span class="text-gray-500">보상: </span>
            <span class="text-log-reward">{{ def.reward }}</span>
          </div>
          <div class="text-[10px]">
            <span class="text-gray-500">조건: </span>
            <span class="text-status-burn">{{ def.penalty }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- 상세 breakdown 모달 (중첩) -->
    <div
      v-if="detailModal"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-3 py-6"
      @click.self="detailModal = null"
    >
      <div class="panel max-w-sm w-full space-y-2">
        <div class="flex items-center justify-between">
          <div class="text-base font-bold">{{ detailModal.name }} 상세</div>
          <button class="text-gray-400 hover:text-white text-xl leading-none" @click="detailModal = null">✕</button>
        </div>
        <div class="text-2xl font-mono font-bold text-log-reward text-center py-2">
          {{ detailModal.total.toFixed(2) }}
        </div>
        <div class="space-y-1 text-xs">
          <div v-for="(e, i) in detailModal.entries" :key="i"
               class="bg-bg-tertiary rounded px-2 py-1.5 flex items-baseline justify-between">
            <div>
              <div class="text-gray-200">{{ e.from }}</div>
              <div v-if="e.note" class="text-[10px] text-gray-500">{{ e.note }}</div>
            </div>
            <div class="font-mono font-bold text-log-skill">
              {{ e.value >= 0 ? '+' : '' }}{{ e.value.toFixed(2) }}
            </div>
          </div>
        </div>
        <button class="btn-secondary w-full text-xs" @click="detailModal = null">닫기</button>
      </div>
    </div>
  </div>
</template>
