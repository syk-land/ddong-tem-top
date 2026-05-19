<script setup lang="ts">
import { computed } from 'vue'
import { useGameStore } from '@/stores/game'
import { statColorClass, tierColorClass, gradeColorClass } from '@/ui/colors'
import ItemName from '@/ui/components/ItemName.vue'
import StatusBadges from '@/ui/components/StatusBadges.vue'
import { computeEffectiveStats } from '@/core/stats'
import { SKILLS } from '@/data/skills'
import { CHALLENGES_MAP } from '@/data/challenges'

const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{ (e: 'close'): void }>()

const game = useGameStore()
const c = computed(() => game.run!.character)
const effective = computed(() => computeEffectiveStats(c.value))
const skillKeys = computed(() => game.availableSkills)
const weaponProcPct = computed(() => game.weaponSkillProcPct)

// 현재 활성 챌린지 (failed 포함)
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
  if (!result.ok) await game.alertModal(result.reason ?? '해제 실패', '⚠️ 해제 실패')
}
function effectEntries(item: { effects: Record<string, number | undefined> }) {
  return Object.entries(item.effects).filter(([, v]) => v !== undefined && v !== 0)
}
function formatValue(v: number): string {
  return Math.abs(v) < 1 ? (v * 100).toFixed(1) + '%' : v.toFixed(1)
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
        <div class="text-lg font-bold">📊 상태창</div>
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

      <!-- 능력치 10종 (기본 / 실효) -->
      <div class="bg-bg-tertiary rounded p-2 space-y-1">
        <div class="text-xs text-gray-400 mb-1">능력치 (기본 → 장비/트레잇 포함)</div>
        <div class="grid grid-cols-2 gap-x-3 gap-y-0.5 text-xs font-mono">
          <div :class="statColorClass.공격력">공격력 <span class="text-gray-500">{{ c.stats.공격력 }}</span> → {{ effective.공격력.toFixed(1) }}</div>
          <div :class="statColorClass.방어력">방어력 <span class="text-gray-500">{{ c.stats.방어력 }}</span> → {{ effective.방어력_effective.toFixed(1) }}</div>
          <div :class="statColorClass.체력">체력 {{ c.stats.체력 }}</div>
          <div :class="statColorClass.마력">마력 {{ c.stats.마력 }}</div>
          <div :class="statColorClass.속도">속도 <span class="text-gray-500">{{ c.stats.속도 }}</span> → {{ effective.속도.toFixed(1) }}</div>
          <div :class="statColorClass.행운">행운 {{ effective.행운 }}</div>
          <div :class="statColorClass.명중률">명중 {{ effective.명중률 }}</div>
          <div :class="statColorClass.회피율">회피 {{ effective.회피율 }}</div>
          <div :class="statColorClass.관통">관통 {{ effective.관통 }}</div>
          <div :class="statColorClass.상태저항">상저 {{ effective.상태저항 }}</div>
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
          <div class="text-xs text-gray-400">⚔️ 무기</div>
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
            · coef {{ c.weapon.coef }}
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
          <div class="text-xs text-gray-400">🛡️ 갑옷</div>
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
            · coef {{ c.armor.coef }}
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

      <!-- 선택한 챌린지 (최하단) -->
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
  </div>
</template>
