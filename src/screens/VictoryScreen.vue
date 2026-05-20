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
    <div class="panel text-center space-y-3 w-full">
      <h1 class="text-3xl font-bold text-grade-legend">🏆 탑 클리어!</h1>
      <div class="text-sm text-gray-400">최종 클리어 등급</div>
      <img v-if="rankIconUrl(pending.rank)" :src="rankIconUrl(pending.rank)!" :alt="pending.rank" class="mx-auto h-24 w-auto" />
      <div :class="[rankColorClass[pending.rank], 'text-6xl font-bold']">{{ pending.rank }}</div>
      <div class="text-sm text-gray-400">점수: <span class="text-gray-200 font-mono">{{ pending.score }} / 100</span></div>
      <div class="border-t border-slate-700 pt-3 mt-3 space-y-1">
        <div class="text-log-reward text-2xl font-bold">+{{ pending.bonus }} 보너스 스탯 획득!</div>
        <div class="text-[11px] text-gray-500">
          분배는 다음 캐릭터 생성에서 할 수 있다 ({{ game.meta.totalBonusStats + pending.bonus }}pt 누적 예정)
        </div>
      </div>
    </div>
    <button class="btn-primary w-full mt-4" @click="confirm">확정 → 메인 메뉴</button>
  </section>
</template>
