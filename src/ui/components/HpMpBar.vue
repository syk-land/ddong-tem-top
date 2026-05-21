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
</script>

<template>
  <div class="flex flex-col gap-0.5 w-full">
    <div class="flex justify-between text-xs font-mono leading-tight">
      <span :class="['font-bold', kind === 'mp' ? 'text-stat-mp' : 'text-stat-hp']">
        {{ label ?? (kind === 'mp' ? 'MP' : 'HP') }}
      </span>
      <span class="text-gray-200 tabular-nums">{{ Math.max(0, Math.round(current)) }} <span class="text-gray-500">/</span> {{ max }}</span>
    </div>
    <div class="w-full h-2.5 bg-slate-900/80 rounded-full overflow-hidden ring-1 ring-slate-700/60">
      <div
        :class="['h-full transition-all duration-150 rounded-full', barColor]"
        :style="{ width: pct + '%' }"
      />
    </div>
  </div>
</template>
