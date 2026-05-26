<script setup lang="ts">
import { computed } from 'vue'
import { useGameStore } from '@/stores/game'
import { useI18n } from '@/lib/i18n'

const game = useGameStore()
const { t } = useI18n()
const dialog = computed(() => game.listDialog)

function pick(value: unknown) {
  game.resolveList(value)
}
function cancel() {
  game.resolveList(null)
}
</script>

<template>
  <Teleport to="body">
  <div
    v-if="dialog"
    class="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 px-4 py-6"
    @click.self="cancel"
  >
    <div class="panel max-w-md w-full max-h-[85vh] overflow-y-auto space-y-3" @click.stop>
      <img v-if="dialog.imageUrl" :src="dialog.imageUrl" alt="" class="w-full max-h-[400px] object-contain rounded" />
      <h3 v-if="dialog.title" class="text-lg font-bold">{{ dialog.title }}</h3>
      <p v-if="dialog.message" class="text-sm text-gray-300 whitespace-pre-wrap leading-relaxed">{{ dialog.message }}</p>
      <div class="space-y-1">
        <button
          v-for="(opt, i) in dialog.options"
          :key="i"
          :class="[
            'w-full bg-bg-tertiary hover:bg-bg-hover rounded px-3 py-2 text-left text-sm transition-colors',
            opt.class,
          ]"
          @click="pick(opt.value)"
        >
          <div class="font-mono">{{ opt.label }}</div>
          <div v-if="opt.sub" class="text-xs text-gray-500 mt-0.5">{{ opt.sub }}</div>
        </button>
      </div>
      <button class="w-full px-4 py-2 rounded text-sm bg-slate-700 text-gray-300 hover:bg-slate-600" @click="cancel">
        {{ dialog.cancelLabel ?? t('common.cancel', '취소') }}
      </button>
    </div>
  </div>
  </Teleport>
</template>
