<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useGameStore } from '@/stores/game'
import { TUTORIAL_STEPS } from '@/data/tutorial'

const game = useGameStore()

const step = computed(() => game.tutorialActive)

const def = computed(() => step.value ? TUTORIAL_STEPS[step.value] : null)

const pageIdx = ref(0)

watch(step, (s) => {
  pageIdx.value = 0
  // step 자체가 바뀌면 페이지 초기화
  void s
})

const currentPage = computed(() => def.value?.pages[pageIdx.value] ?? null)

const isLastPage = computed(() => {
  const d = def.value
  return d ? pageIdx.value >= d.pages.length - 1 : true
})

const ctaLabel = computed(() => {
  const p = currentPage.value
  if (!p) return ''
  if (!isLastPage.value) return '다음 →'
  return p.cta ?? '알겠어요'
})

function advance() {
  if (!def.value) return
  if (!isLastPage.value) {
    pageIdx.value += 1
  } else {
    game.completeTutorial()
  }
}

function close() {
  game.completeTutorial()
}
</script>

<template>
  <div
    v-if="def && currentPage"
    class="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm select-none"
    @click.self="advance"
  >
    <div
      class="relative w-full max-w-md mx-3 mb-3 sm:mb-0 rounded-2xl bg-zinc-900 ring-1 ring-cyan-500/40 shadow-2xl p-5 text-zinc-100"
      role="dialog"
      aria-live="polite"
    >
      <!-- 닫기 버튼 (이 단계만 닫기) -->
      <button
        class="absolute top-2 right-2 w-8 h-8 flex items-center justify-center rounded-full text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800"
        @click.stop="close"
        aria-label="튜토리얼 닫기"
      >
        ×
      </button>

      <!-- 페이지 인디케이터 (여러 페이지일 때만) -->
      <div v-if="def.pages.length > 1" class="flex items-center gap-1.5 mb-2">
        <span
          v-for="(_, i) in def.pages"
          :key="i"
          :class="[
            'w-1.5 h-1.5 rounded-full transition-colors',
            i === pageIdx ? 'bg-cyan-400' : 'bg-zinc-700',
          ]"
        />
      </div>

      <!-- 제목 -->
      <h3 class="text-lg font-bold text-cyan-300 mb-2 pr-6">
        {{ currentPage.title }}
      </h3>

      <!-- 본문 -->
      <p class="text-sm leading-relaxed text-zinc-200 whitespace-pre-line">
        {{ currentPage.body }}
      </p>

      <!-- 서사 힌트 (작은 회색 텍스트) -->
      <p
        v-if="currentPage.hint"
        class="mt-3 text-xs italic text-zinc-500 whitespace-pre-line"
      >
        {{ currentPage.hint }}
      </p>

      <!-- CTA -->
      <button
        class="mt-4 w-full py-2.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 active:bg-cyan-700 font-bold text-zinc-900 transition-colors"
        @click.stop="advance"
      >
        {{ ctaLabel }}
      </button>
    </div>
  </div>
</template>
