<script setup lang="ts">
import { computed } from 'vue'
import { useGameStore } from '@/stores/game'
import { defaultBgUrl } from '@/ui/images'

const game = useGameStore()
const bgUrl = defaultBgUrl()

const ratio = computed(() => game.realBossResultRatio)
const percent = computed(() => Math.round(ratio.value * 100))
const gain = computed(() => Math.floor(ratio.value * 60))
const totalPermanent = computed(() => game.meta.permanentStartBonus ?? 0)
const isGameClear = computed(() => ratio.value >= 0.9999)

function proceed() {
  game.proceedFromRealBossResult()
}
</script>

<template>
  <section
    class="flex-1 flex flex-col items-center justify-center px-4 py-6 max-w-md mx-auto w-full bg-cover bg-center"
    :style="{ backgroundImage: `linear-gradient(rgba(10,14,26,0.85), rgba(10,14,26,0.95)), url(${bgUrl})` }"
  >
    <!-- 게임 클리어 분기 -->
    <div v-if="isGameClear" class="panel text-center space-y-4 w-full border-2 border-grade-legend">
      <h1 class="text-4xl font-bold text-grade-legend">🏆 게임 클리어!</h1>
      <div class="text-lg text-trait-special">진짜 보스를 처치했다.</div>
      <div class="text-sm text-gray-300">탑의 정점에 도달한 영혼.</div>
      <div class="text-5xl font-bold font-mono text-log-reward">100%</div>
      <div class="border-t border-slate-700 pt-3 mt-3 text-sm text-gray-300">
        영구 누적 시작 보너스 <span class="text-log-reward font-mono font-bold">+{{ totalPermanent }}pt</span>
      </div>
      <button class="btn-primary w-full" @click="proceed">계속</button>
    </div>

    <!-- 일반 결과 -->
    <div v-else class="panel text-center space-y-4 w-full">
      <h1 class="text-2xl font-bold text-grade-legend">⚔️ 도전 종료</h1>
      <div class="text-sm text-gray-400">진짜 보스 체력을 깎은 비율</div>
      <div class="text-5xl font-bold font-mono text-trait-special">{{ percent }}%</div>
      <div class="text-xs text-gray-500">({{ Math.round(ratio * 10000) / 100 }} / 100)</div>
      <div class="border-t border-slate-700 pt-3 mt-3 space-y-1">
        <div class="text-sm text-gray-300">이번 도전 보상</div>
        <div class="text-2xl font-bold text-log-reward">+{{ gain }}pt</div>
        <div class="text-[11px] text-gray-500">영구 누적</div>
        <div class="text-sm text-gray-300 mt-2">
          누적 보너스 <span class="text-log-reward font-mono font-bold">+{{ totalPermanent }}pt</span>
        </div>
        <div class="text-[11px] text-gray-400">다음 캐릭터부터 시작 능력치 60 → <span class="text-log-reward">{{ 60 + totalPermanent }}pt</span></div>
      </div>
      <button class="btn-primary w-full" @click="proceed">캐릭터 생성하기</button>
    </div>
  </section>
</template>
