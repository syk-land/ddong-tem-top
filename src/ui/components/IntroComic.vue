<script setup lang="ts">
import { computed } from 'vue'
import { useGameStore } from '@/stores/game'
import { tutorialImageUrl } from '@/ui/images'
import { useI18n } from '@/lib/i18n'
import ComicImage from '@/ui/components/ComicImage.vue'

const game = useGameStore()
const { t } = useI18n()

// 페이지별 이미지 URL — page 1=t1, 2=t2, 3=t3 (main 컷은 제거됨)
const imgUrl = computed(() => {
  switch (game.introPage) {
    case 1: return tutorialImageUrl(1)
    case 2: return tutorialImageUrl(2)
    case 3: return tutorialImageUrl(3)
    default: return tutorialImageUrl(1)
  }
})

// 하단 문구 — 마지막 페이지면 "시작하기", 아니면 "다음 페이지로"
const isLastPage = computed(() => {
  const last = game.introFlow === 'first' ? 2 : 3
  return game.introPage >= last
})
const ctaLabel = computed(() => isLastPage.value ? t('intro.start', '시작하기') : t('intro.next', '다음 페이지로'))

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
      <ComicImage
        :src="imgUrl"
        :alt="t('intro.pageAlt', `인트로 페이지 ${game.introPage}`, { page: game.introPage })"
      />
    </div>
    <div class="w-full py-4 text-center text-white text-sm sm:text-base font-bold animate-pulse pointer-events-none">
      {{ ctaLabel }} <span class="opacity-60 text-xs">{{ t('intro.tap', '(터치)') }}</span>
    </div>
  </div>
</template>
