<script setup lang="ts">
import { computed } from 'vue'
import { hpBarColorClass } from '@/ui/colors'

const props = defineProps<{
  current: number
  max: number
  label?: string
  kind?: 'hp' | 'mp'
}>()

const pct = computed(() => Math.max(0, Math.min(100, (props.current / props.max) * 100)))
const barColor = computed(() => {
  if (props.kind === 'mp') return 'bg-bar-mp'
  return hpBarColorClass(pct.value)
})

// HP 위험 임계치 — 25% 이하면 깜빡임/강조
const isCritical = computed(() => props.kind !== 'mp' && pct.value > 0 && pct.value <= 25)
// 0% (사망) — 깜빡임 X
const isEmpty = computed(() => pct.value <= 0)
</script>

<template>
  <div class="flex flex-col gap-0.5 w-full">
    <div class="flex justify-between items-baseline text-xs font-mono leading-tight">
      <span :class="['font-bold', kind === 'mp' ? 'text-stat-mp' : 'text-stat-hp', isCritical ? 'animate-pulse-fast' : '']">
        {{ label ?? (kind === 'mp' ? 'MP' : 'HP') }}
      </span>
      <span class="tabular-nums">
        <span :class="['font-bold', isCritical ? 'text-status-burn animate-pulse-fast' : 'text-gray-100']">{{ Math.max(0, Math.round(current)) }}</span>
        <span class="text-gray-500 mx-0.5">/</span>
        <span class="text-gray-300">{{ max }}</span>
        <span :class="['ml-1.5 text-[10px]', isCritical ? 'text-status-burn font-bold animate-pulse-fast' : 'text-gray-500']">{{ Math.round(pct) }}%</span>
      </span>
    </div>
    <div :class="['w-full h-2.5 bg-slate-900/80 rounded-full overflow-hidden ring-1', isCritical ? 'ring-rose-500/70' : 'ring-slate-700/60']">
      <div
        :class="['h-full transition-all duration-150 rounded-full', barColor, isEmpty ? 'opacity-0' : '']"
        :style="{ width: pct + '%' }"
      />
    </div>
  </div>
</template>

<style scoped>
@keyframes pulse-fast {
  0%, 100% { opacity: 1; }
  50%      { opacity: 0.55; }
}
.animate-pulse-fast {
  animation: pulse-fast 700ms ease-in-out infinite;
}
</style>
