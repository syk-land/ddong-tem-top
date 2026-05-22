<script setup lang="ts">
import { computed, ref, watch, nextTick } from 'vue'
import { useGameStore } from '@/stores/game'

const game = useGameStore()
const dialog = computed(() => game.inputDialog)
const value = ref('')
const inputEl = ref<HTMLInputElement | null>(null)

watch(
  () => dialog.value,
  (d) => {
    if (d) {
      value.value = d.defaultValue ?? ''
      nextTick(() => inputEl.value?.focus())
    }
  },
  { immediate: true }
)

function submit() {
  game.resolveInput(value.value)
}
function cancel() {
  game.resolveInput(null)
}
function onKey(e: KeyboardEvent) {
  if (e.key === 'Enter') submit()
  if (e.key === 'Escape') cancel()
}
</script>

<template>
  <Teleport to="body">
  <div
    v-if="dialog"
    class="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 px-4"
    @click.self="cancel"
  >
    <div class="panel max-w-md w-full space-y-3" @click.stop>
      <img v-if="dialog.imageUrl" :src="dialog.imageUrl" alt="" class="w-full max-h-[400px] object-contain rounded" />
      <h3 v-if="dialog.title" class="text-lg font-bold">{{ dialog.title }}</h3>
      <p class="text-sm text-gray-200 whitespace-pre-wrap leading-relaxed">{{ dialog.message }}</p>
      <input
        ref="inputEl"
        v-model="value"
        :placeholder="dialog.placeholder"
        class="w-full bg-bg-tertiary border border-slate-700 rounded px-3 py-2 text-sm text-gray-100 font-mono"
        @keydown="onKey"
      />
      <div v-if="dialog.maxValue !== undefined" class="text-xs text-gray-500">
        최대 {{ dialog.maxValue }}
      </div>
      <div class="flex gap-2 justify-end">
        <button class="px-4 py-2 rounded text-sm bg-slate-700 text-gray-300 hover:bg-slate-600" @click="cancel">취소</button>
        <button class="px-4 py-2 rounded text-sm bg-log-skill text-black font-bold hover:opacity-80" @click="submit">
          {{ dialog.okLabel ?? '확인' }}
        </button>
      </div>
    </div>
  </div>
  </Teleport>
</template>
