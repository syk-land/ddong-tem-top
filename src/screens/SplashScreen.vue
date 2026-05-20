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
    class="fixed inset-0 z-50 flex items-center justify-center bg-black cursor-pointer select-none overflow-hidden"
    @click="dismiss"
    @keydown="dismiss"
    tabindex="0"
  >
    <!-- main.png를 화면을 꽉 채우게 cover + center crop (전체 표시 X) -->
    <div
      class="absolute inset-0 bg-no-repeat bg-center bg-cover"
      :style="{ backgroundImage: `url(${imgUrl})` }"
    />
    <div class="absolute bottom-8 inset-x-0 text-center text-white/80 text-sm animate-pulse pointer-events-none">
      터치하여 시작
    </div>
  </div>
</template>
