<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useGameStore } from '@/stores/game'

const game = useGameStore()
const speeds = [1, 2, 4] as const

// 펼침 상태 — localStorage 영속화
const expanded = ref(true)
const STORAGE_KEY = 'climetop:speedControl:expanded:v1'

onMounted(() => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw === '0') expanded.value = false
  } catch {}
})

function setSpeed(s: number) {
  game.setCombatSpeed(s)
}

function toggle() {
  expanded.value = !expanded.value
  try {
    localStorage.setItem(STORAGE_KEY, expanded.value ? '1' : '0')
  } catch {}
}
</script>

<template>
  <div class="fixed top-2 right-2 z-40 flex items-center gap-1 bg-black/60 backdrop-blur-sm rounded px-2 py-1 select-none">
    <!-- 토글 버튼: 항상 표시 (펼침=›, 접힘=‹) -->
    <button
      class="w-5 h-5 flex items-center justify-center rounded text-sm text-gray-200 hover:bg-slate-700"
      :title="expanded ? '속도 컨트롤 접기' : '속도 컨트롤 펼치기'"
      @click="toggle"
    >
      {{ expanded ? '›' : '‹' }}
    </button>

    <!-- 펼친 상태: 라벨 + 1/2/4x 버튼 -->
    <template v-if="expanded">
      <span class="text-[10px] text-gray-300">속도</span>
      <button
        v-for="s in speeds"
        :key="s"
        class="px-2 py-0.5 rounded text-[11px] transition-colors"
        :class="game.combatSpeed === s
          ? 'bg-log-skill text-black font-bold'
          : 'bg-slate-800/70 text-gray-200 hover:bg-slate-700'"
        @click="setSpeed(s)"
      >
        {{ s }}x
      </button>
    </template>

    <!-- 접힘 상태: 현재 속도만 작게 표시 -->
    <span v-else class="text-[10px] text-gray-300 font-bold pr-1">{{ game.combatSpeed }}x</span>
  </div>
</template>
