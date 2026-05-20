<script setup lang="ts">
import { computed } from 'vue'
import { useGameStore } from '@/stores/game'
import { defaultBgUrl } from '@/ui/images'

const game = useGameStore()
const bgUrl = defaultBgUrl()

const ratio = computed(() => game.realBossResultRatio)
const percent = computed(() => Math.round(ratio.value * 100))
const bonus = computed(() => Math.floor(ratio.value * 60))

function proceed() {
  game.proceedFromRealBossResult()
}
</script>

<template>
  <section
    class="flex-1 flex flex-col items-center justify-center px-4 py-6 max-w-md mx-auto w-full bg-cover bg-center"
    :style="{ backgroundImage: `linear-gradient(rgba(10,14,26,0.85), rgba(10,14,26,0.95)), url(${bgUrl})` }"
  >
    <div class="panel text-center space-y-4 w-full">
      <h1 class="text-2xl font-bold text-grade-legend">⚔️ 도전 종료</h1>
      <div class="text-sm text-gray-400">진짜 보스 체력을 깎은 비율</div>
      <div class="text-5xl font-bold font-mono text-trait-special">{{ percent }}%</div>
      <div class="text-xs text-gray-500">({{ Math.round(ratio * 10000) / 100 }} / 100)</div>
      <div class="border-t border-slate-700 pt-3 mt-3">
        <div class="text-sm text-gray-300">다음 캐릭터 시작 능력치</div>
        <div class="text-2xl font-bold text-log-reward mt-1">
          60 → <span>{{ 60 + bonus }}</span>pt
        </div>
        <div class="text-[11px] text-gray-500 mt-1">+{{ bonus }}pt 자동 분배 (공·방·체·마)</div>
      </div>
      <button class="btn-primary w-full" @click="proceed">캐릭터 생성하기</button>
    </div>
  </section>
</template>
