<script setup lang="ts">
import { computed } from 'vue'
import { useGameStore } from '@/stores/game'
import { rankColorClass } from '@/ui/colors'
import { rankIconUrl } from '@/ui/images'

const game = useGameStore()
const projection = computed(() => game.projectedClearRank)
const currentChapter = computed(() => game.currentChapterState?.chapter ?? 1)

const showRank = computed(() => currentChapter.value >= 6)

const rankClass = computed(() =>
  projection.value ? rankColorClass[projection.value.rank] ?? 'text-gray-400' : 'text-gray-500'
)
const rankIcon = computed(() =>
  projection.value ? rankIconUrl(projection.value.rank) : null
)
</script>

<template>
  <div v-if="projection && showRank" class="panel-tight flex items-center justify-between gap-3 text-xs">
    <div class="flex items-center gap-2">
      <span class="text-gray-400 uppercase tracking-wider">다음 회차 보너스</span>
      <img v-if="rankIcon" :src="rankIcon" :alt="projection.rank" class="h-8 w-auto" />
      <span :class="['text-2xl font-bold', rankClass]">{{ projection.rank }}</span>
      <span class="text-gray-500">·</span>
      <span class="text-log-reward font-semibold">+{{ projection.bonus }} pt</span>
    </div>
    <div class="flex items-center gap-3 text-[10px]">
      <span class="text-stat-util">티어 합계 <span class="text-gray-200 font-mono">{{ projection.score }}</span></span>
      <span class="text-gray-500">·</span>
      <span class="text-gray-400">낮을수록 등급 ↑</span>
    </div>
  </div>
  <!-- 1~5챕터: 안내만 -->
  <div v-else-if="projection" class="panel-tight text-xs text-gray-500 text-center">
    클리어 등급 예상은 <span class="text-gray-300">6챕터</span>부터 표시됩니다.
  </div>
</template>
