<script setup lang="ts">
import { computed } from 'vue'
import { useGameStore } from '@/stores/game'
import { tutorialImageUrl } from '@/ui/images'
import { useI18n } from '@/lib/i18n'

const game = useGameStore()
const { t, lang } = useI18n()

// 페이지별 텍스트리스 일러스트 URL — page 1=t1, 2=t2, 3=t3
const imgUrl = computed(() => {
  switch (game.introPage) {
    case 1: return tutorialImageUrl(1)
    case 2: return tutorialImageUrl(2)
    case 3: return tutorialImageUrl(3)
    default: return tutorialImageUrl(1)
  }
})

// 텍스트리스 일러스트 하단 시네마틱 자막 (KO / EN 네이티브 렌더링)
const captionLines = computed<string[]>(() => {
  const isEn = lang.value === 'en'
  switch (game.introPage) {
    case 1:
      return isEn
        ? [
            '“Monsters are destroying the world… what can an ordinary person like me do?”',
            'As despair fell, a mysterious voice echoed: “I grant you the power to protect the world.”',
          ]
        : [
            '“저 몬스터들을 전부 없애야 하는데… 나 같은 평범한 사람이 뭘 할 수 있지?”',
            '절망 속에 잠든 순간, 의문의 목소리가 울렸다. “세상을 지킬 힘을 주겠다.”',
          ]
    case 2:
      return isEn
        ? [
            '“I am the God of Time. Climb the tower to the top and claim your reward.”',
            '“Remember: the weaker the gear you use to clear it, the greater your permanent power.”',
          ]
        : [
            '“나는 시간의 신. 지금부터 저 탑을 올라 정상에 도달하면 보상을 주겠다.”',
            '“단, 더 적은 힘과 초라한 장비로 오를수록 더 큰 영구 보상이 주어질 것이다.”',
          ]
    case 3:
      return isEn
        ? [
            '“Failed again… yet every single climb leaves me a little stronger than before.”',
            '“I will not stop. Next run, I climb even higher.”',
          ]
        : [
            '“이번 판도 실패했지만… 조금씩 강해지고 있어. 멈출 수 없어.”',
            '“다음 판엔 반드시 더 높이 올라가겠어.”',
          ]
    default:
      return []
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
    class="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black select-none cursor-pointer"
    @click="advance"
    tabindex="0"
  >
    <div class="relative flex-1 w-full flex items-center justify-center overflow-hidden p-2">
      <img
        :src="imgUrl"
        :alt="t('intro.pageAlt', `인트로 페이지 ${game.introPage}`, { page: game.introPage })"
        class="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
        draggable="false"
      />
      <!-- 시네마틱 자막 박스 -->
      <div
        v-if="captionLines.length"
        class="absolute bottom-3 inset-x-3 sm:inset-x-6 mx-auto max-w-md rounded-lg bg-black/80 backdrop-blur-md border border-amber-400/30 px-4 py-3 text-center space-y-1.5 shadow-[0_6px_24px_rgba(0,0,0,0.85)] pointer-events-none"
      >
        <p
          v-for="(line, i) in captionLines"
          :key="i"
          :class="i === 0 ? 'text-xs sm:text-sm text-gray-100 leading-relaxed font-medium' : 'text-xs sm:text-sm text-amber-200 leading-relaxed font-semibold'"
        >
          {{ line }}
        </p>
      </div>
    </div>
    <div class="w-full py-3.5 text-center text-white text-sm sm:text-base font-bold animate-pulse pointer-events-none">
      {{ ctaLabel }} <span class="opacity-60 text-xs">{{ t('intro.tap', '(터치)') }}</span>
    </div>
  </div>
</template>
