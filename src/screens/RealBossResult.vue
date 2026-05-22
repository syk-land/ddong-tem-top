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
    <!-- 게임 클리어 분기 — amber glow (최종 승리 톤) -->
    <div
      v-if="isGameClear"
      class="w-full rounded-xl border-2 border-amber-400/80 bg-bg-secondary/95 shadow-[0_0_50px_rgba(251,191,36,0.55)] p-6 space-y-4 text-center animate-fadein"
    >
      <div class="text-amber-300 text-5xl font-bold tracking-widest leading-tight">게임 클리어</div>
      <div class="text-base text-amber-100">진짜 보스를 처치했다.</div>
      <div class="text-sm">탑의 정점에 도달한 영혼.</div>

      <div class="rounded-lg border-2 border-amber-400/50 bg-amber-950/30 px-3 py-4">
        <div class="text-xs text-amber-300/80 font-bold">깎은 비율</div>
        <div class="text-6xl font-bold font-mono text-amber-300 leading-none mt-1">100<span class="text-3xl">%</span></div>
      </div>

      <div class="rounded-lg border-2 border-log-reward/40 bg-log-reward/5 px-3 py-2.5">
        <div class="text-xs text-log-reward/80 font-bold">영구 누적 시작 보너스</div>
        <div class="text-log-reward text-3xl font-bold font-mono mt-0.5">+{{ totalPermanent }}<span class="text-base ml-1">pt</span></div>
      </div>

      <button class="btn-primary w-full min-h-12 text-base font-bold" @click="proceed">계속</button>
    </div>

    <!-- 일반 결과 — rose 톤 (도전 종료) + amber 보상 카드 -->
    <div
      v-else
      class="w-full rounded-xl border-2 border-rose-400/70 bg-bg-secondary/95 shadow-[0_0_30px_rgba(244,63,94,0.30)] p-6 space-y-4 text-center animate-fadein"
    >
      <div class="text-rose-300 text-4xl font-bold tracking-widest leading-tight">도전 종료</div>

      <div class="rounded-lg border-2 border-rose-500/40 bg-rose-950/20 px-3 py-3">
        <div class="text-xs text-rose-300/80 font-bold">진짜 보스 체력 깎은 비율</div>
        <div class="text-5xl font-bold font-mono text-rose-200 mt-1">{{ percent }}<span class="text-2xl">%</span></div>
        <div class="text-xs mt-0.5 opacity-70">({{ Math.round(ratio * 10000) / 100 }} / 100)</div>
      </div>

      <!-- 보상 카드 — amber -->
      <div class="rounded-lg border-2 border-amber-400/50 bg-amber-950/20 px-3 py-2.5 space-y-1.5">
        <div>
          <div class="text-xs text-amber-300/80 font-bold">이번 도전 보상</div>
          <div class="text-amber-300 text-3xl font-bold font-mono">+{{ gain }}<span class="text-base ml-1">pt</span></div>
          <div class="text-xs opacity-70">영구 누적</div>
        </div>
        <div class="border-t border-amber-400/20 pt-1.5">
          <div class="text-xs">누적 보너스 <span class="text-log-reward font-mono font-bold">+{{ totalPermanent }}pt</span></div>
          <div class="text-xs mt-0.5 opacity-80">다음 캐릭터 시작 능력치 60 → <span class="text-log-reward font-bold">{{ 60 + totalPermanent }}pt</span></div>
        </div>
      </div>

      <button class="btn-primary w-full min-h-12 text-base font-bold" @click="proceed">캐릭터 생성하기</button>
    </div>
  </section>
</template>

<style scoped>
@keyframes fadein {
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: translateY(0); }
}
.animate-fadein { animation: fadein 280ms ease-out; }
</style>
