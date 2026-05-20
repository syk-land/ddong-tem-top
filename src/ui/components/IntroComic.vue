<script setup lang="ts">
import { computed } from 'vue'
import { useGameStore } from '@/stores/game'
import { mainImageUrl, tutorialImageUrl } from '@/ui/images'

const game = useGameStore()

// 페이지별 이미지 URL — page 0=main, 1=t1, 2=t2, 3=t3
const imgUrl = computed(() => {
  switch (game.introPage) {
    case 0: return mainImageUrl()
    case 1: return tutorialImageUrl(1)
    case 2: return tutorialImageUrl(2)
    case 3: return tutorialImageUrl(3)
    default: return mainImageUrl()
  }
})

// 하단 문구 — 마지막 페이지면 "시작하기", 아니면 "다음 페이지로"
const isLastPage = computed(() => {
  const last = game.introFlow === 'first' ? 2 : 3
  return game.introPage >= last
})
const ctaLabel = computed(() => isLastPage.value ? '시작하기' : '다음 페이지로')

function advance() {
  game.nextIntroPage()
}
</script>

<template>
  <div
    class="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black select-none"
    @click="advance"
    tabindex="0"
  >
    <div class="flex-1 w-full flex items-center justify-center overflow-hidden">
      <img
        :src="imgUrl"
        :alt="`인트로 페이지 ${game.introPage}`"
        class="max-w-full max-h-full object-contain"
        draggable="false"
      />
    </div>
    <div class="w-full py-4 text-center text-white text-sm sm:text-base font-bold animate-pulse pointer-events-none">
      {{ ctaLabel }} <span class="opacity-60 text-xs">(터치)</span>
    </div>
  </div>
</template>
