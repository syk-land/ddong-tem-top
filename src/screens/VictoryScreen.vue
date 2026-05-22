<script setup lang="ts">
import { computed } from 'vue'
import { useGameStore } from '@/stores/game'
import { rankColorClass } from '@/ui/colors'
import { rankIconUrl, defaultBgUrl } from '@/ui/images'

const bgUrl = defaultBgUrl()
const game = useGameStore()
const pending = computed(() => game.pendingClear)

function confirm() {
  // 분배 없이 메타 totalBonusStats 에만 적립. 분배는 캐릭터 생성에서.
  game.confirmClearBonus({})
}
</script>

<template>
  <section
    v-if="pending"
    class="flex-1 flex flex-col items-center justify-center px-4 py-6 max-w-md mx-auto w-full bg-cover bg-center"
    :style="{ backgroundImage: `linear-gradient(rgba(10,14,26,0.78), rgba(10,14,26,0.92)), url(${bgUrl})` }"
  >
    <div
      class="w-full rounded-xl border-2 border-amber-400/70 bg-bg-secondary/95 shadow-[0_0_40px_rgba(251,191,36,0.45)] p-6 space-y-4 text-center animate-fadein"
    >
      <!-- 헤더 — 크게 한글만 (GameOver 와 동일 패턴) -->
      <div class="text-amber-300 text-5xl font-bold tracking-widest leading-tight">탑 클리어</div>
      <div class="text-sm text-gray-300 -mt-1">최종 클리어 등급</div>

      <!-- 랭크 카드 -->
      <div class="rounded-lg border-2 border-amber-400/40 bg-amber-950/20 px-3 py-3 space-y-1">
        <img
          v-if="rankIconUrl(pending.rank)"
          :src="rankIconUrl(pending.rank)!"
          :alt="pending.rank"
          class="mx-auto h-24 w-auto drop-shadow-[0_0_12px_rgba(251,191,36,0.5)]"
        />
        <div :class="[rankColorClass[pending.rank], 'text-6xl font-bold tracking-wider leading-none']">{{ pending.rank }}</div>
        <div class="text-xs text-gray-400">점수 <span class="text-gray-200 font-mono font-bold">{{ pending.score }} / 100</span></div>
      </div>

      <!-- 보너스 카드 — log-reward 액센트 -->
      <div class="rounded-lg border-2 border-log-reward/40 bg-log-reward/5 px-3 py-2.5 shadow-[0_0_18px_rgba(74,222,128,0.18)]">
        <div class="text-xs text-log-reward/80 font-bold">보너스 스탯 획득</div>
        <div class="text-log-reward text-3xl font-bold tracking-wide font-mono mt-1">+{{ pending.bonus }}<span class="text-base ml-1">pt</span></div>
        <div class="text-xs text-gray-400 mt-1">
          누적 예정 <span class="font-mono font-bold">{{ game.meta.totalBonusStats + pending.bonus }}pt</span>
          <span class="text-gray-500"> · 분배는 다음 캐릭터 생성에서</span>
        </div>
      </div>

      <button class="btn-primary w-full min-h-12 text-base font-bold" @click="confirm">확정 → 메인 메뉴</button>
    </div>
  </section>
</template>

<style scoped>
@keyframes fadein {
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: translateY(0); }
}
.animate-fadein {
  animation: fadein 280ms ease-out;
}
</style>
