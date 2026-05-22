<script setup lang="ts">
import { computed } from 'vue'
import { useGameStore } from '@/stores/game'
import ItemDetail from './ItemDetail.vue'

const game = useGameStore()

// 큐의 첫 아이템만 표시 — 사용자가 확인 누르면 다음 아이템으로
const current = computed(() => game.itemAnnounceQueue[0] ?? null)

function confirmReceived() {
  game.popItemAnnounce()
}
</script>

<template>
  <div
    v-if="current"
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-3 py-6"
    role="dialog"
    aria-live="polite"
  >
    <div
      class="bg-bg-secondary rounded-2xl ring-1 ring-amber-400/40 shadow-2xl p-4 max-w-md w-full space-y-3 animate-fadein"
      @click.stop
    >
      <h3 class="text-base font-bold text-amber-300 flex items-center gap-1.5">
        <span>🎁</span><span>아이템 획득</span>
      </h3>
      <div class="bg-bg-tertiary/60 rounded-lg p-2">
        <ItemDetail :item="current" :character="game.run?.character ?? undefined" />
      </div>
      <button
        class="w-full py-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 active:bg-amber-600 font-bold text-zinc-900 transition-colors"
        @click="confirmReceived"
      >확인</button>
    </div>
  </div>
</template>
