<script setup lang="ts">
import { mainImageUrl } from '@/ui/images'

const emit = defineEmits<{ (e: 'dismiss'): void }>()
const imgUrl = mainImageUrl()

function dismiss() {
  emit('dismiss')
}
</script>

<template>
  <div
    class="fixed inset-0 z-50 flex items-center justify-center bg-black cursor-pointer select-none"
    @click="dismiss"
    @keydown="dismiss"
    tabindex="0"
  >
    <img
      :src="imgUrl"
      alt="이번 판은 똥템으로 탑을 오르겠습니다"
      class="max-w-full max-h-full object-contain"
      draggable="false"
    />
    <div class="absolute bottom-8 inset-x-0 text-center text-white/80 text-sm animate-pulse pointer-events-none">
      터치하여 시작
    </div>
  </div>
</template>
