<script setup lang="ts">
import { computed } from 'vue'
import { useGameStore } from '@/stores/game'
import ItemDetail from './ItemDetail.vue'

const game = useGameStore()

// 큐 전체를 한 모달에 나열 — 한 번의 "확인" 으로 비움.
// (이전엔 아이템마다 모달이 따로 떠서 다중 드랍 시 N번 확인해야 했음)
const items = computed(() => game.itemAnnounceQueue)
const visible = computed(() => items.value.length > 0)

function confirmAll() {
  game.clearItemAnnounce()
}
</script>

<template>
  <div
    v-if="visible"
    class="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm px-3 py-6"
    role="dialog"
    aria-live="polite"
  >
    <div
      class="bg-bg-secondary rounded-2xl ring-1 ring-amber-400/40 shadow-2xl p-4 max-w-md w-full max-h-[85vh] flex flex-col gap-3 animate-fadein"
      @click.stop
    >
      <h3 class="text-base font-bold text-amber-300 flex items-center gap-1.5 shrink-0">
        <span>🎁</span>
        <span>아이템 획득{{ items.length > 1 ? ` (${items.length})` : '' }}</span>
      </h3>

      <div class="overflow-y-auto space-y-2 pr-1">
        <div
          v-for="item in items"
          :key="item.id"
          class="bg-bg-tertiary/60 rounded-lg p-2"
        >
          <ItemDetail :item="item" :character="game.run?.character ?? undefined" />
        </div>
      </div>

      <button
        class="shrink-0 w-full py-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 active:bg-amber-600 font-bold text-zinc-900 transition-colors"
        @click="confirmAll"
      >확인</button>
    </div>
  </div>
</template>
