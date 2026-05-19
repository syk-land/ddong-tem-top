<script setup lang="ts">
import { computed } from 'vue'
import { useGameStore } from '@/stores/game'

const game = useGameStore()
const dialog = computed(() => game.dialog)

function click(value: unknown) {
  game.resolveDialog(value)
}
</script>

<template>
  <div
    v-if="dialog"
    class="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 px-4"
  >
    <div class="panel max-w-md w-full space-y-3">
      <img v-if="dialog.imageUrl" :src="dialog.imageUrl" alt="" class="w-full max-h-[480px] object-contain rounded" />
      <h3 v-if="dialog.title" class="text-lg font-bold">{{ dialog.title }}</h3>
      <p class="text-sm text-gray-200 whitespace-pre-wrap leading-relaxed">{{ dialog.message }}</p>
      <div class="flex gap-2 justify-end">
        <button
          v-for="(b, i) in dialog.buttons"
          :key="i"
          :class="[
            'px-4 py-2 rounded text-sm',
            b.danger
              ? 'bg-status-burn text-black font-bold hover:opacity-80'
              : b.primary
              ? 'bg-log-skill text-black font-bold hover:opacity-80'
              : 'bg-slate-700 text-gray-300 hover:bg-slate-600',
          ]"
          @click="click(b.value)"
        >
          {{ b.label }}
        </button>
      </div>
    </div>
  </div>
</template>
