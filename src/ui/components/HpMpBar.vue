<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue'
import { hpBarColorClass } from '@/ui/colors'

const props = defineProps<{
  current: number
  max: number
  label?: string
  kind?: 'hp' | 'mp'
}>()

const pct = computed(() => {
  if (props.max <= 0) return 0
  return Math.max(0, Math.min(100, (props.current / props.max) * 100))
})
const barColor = computed(() => {
  if (props.kind === 'mp') return 'bg-bar-mp'
  return hpBarColorClass(pct.value)
})

// HP 데미지 잔상 트레일 (고스트 바) — 피격 직후 짧게 머물렀다 부드럽게 따라감
const isHp = computed(() => props.kind !== 'mp')
const trailPct = ref(pct.value)
let trailTimer: ReturnType<typeof setTimeout> | null = null

watch(pct, (next, prev) => {
  if (!isHp.value) {
    trailPct.value = next
    return
  }
  if (next < prev) {
    // 피해 발생 — 기존 잔상 유지 후 220ms 지연 뒤 부드럽게 축소
    if (trailTimer) clearTimeout(trailTimer)
    trailTimer = setTimeout(() => {
      trailPct.value = pct.value
      trailTimer = null
    }, 220)
  } else {
    // 회복 또는 새 전투 초기화 — 잔상 즉시 동기화
    if (trailTimer) {
      clearTimeout(trailTimer)
      trailTimer = null
    }
    trailPct.value = next
  }
})

onUnmounted(() => {
  if (trailTimer) {
    clearTimeout(trailTimer)
    trailTimer = null
  }
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
    <div :class="['relative w-full h-2.5 bg-slate-900/80 rounded-full overflow-hidden ring-1', isCritical ? 'ring-rose-500/70' : 'ring-slate-700/60']">
      <!-- HP 데미지 잔상 트레일 바 -->
      <div
        v-if="isHp && trailPct > pct"
        class="absolute inset-y-0 left-0 rounded-full bg-amber-200/75 transition-[width] duration-500 ease-out"
        :style="{ width: trailPct + '%' }"
      />
      <div
        :class="['relative h-full transition-[width] duration-150 ease-out rounded-full', barColor, isEmpty ? 'opacity-0' : '']"
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
