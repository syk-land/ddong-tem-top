<script setup lang="ts">
import { computed, onMounted, onBeforeUnmount, ref } from 'vue'
import { mainImageUrl, mainImagePortraitUrl } from '@/ui/images'

const emit = defineEmits<{ (e: 'dismiss'): void }>()

// 화면이 세로(또는 거의 정사각형)면 세로 이미지, 가로면 가로 이미지
//   - 안드로이드/모바일은 보통 세로 → portrait
//   - PC 가로 화면 → landscape main.png
const isPortrait = ref<boolean>(typeof window !== 'undefined' ? window.innerHeight >= window.innerWidth : true)
function updateOrientation() {
  if (typeof window === 'undefined') return
  isPortrait.value = window.innerHeight >= window.innerWidth
}
onMounted(() => {
  updateOrientation()
  window.addEventListener('resize', updateOrientation)
  window.addEventListener('orientationchange', updateOrientation)
})
onBeforeUnmount(() => {
  window.removeEventListener('resize', updateOrientation)
  window.removeEventListener('orientationchange', updateOrientation)
})

const imgUrl = computed(() => (isPortrait.value ? mainImagePortraitUrl() : mainImageUrl()))

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
    <!-- viewport 비율에 따라 가로/세로 이미지 자동 선택, 화면 꽉 채우기 (cover) -->
    <div
      class="absolute inset-0 bg-no-repeat bg-center bg-cover"
      :style="{ backgroundImage: `url(${imgUrl})` }"
    />
    <div class="absolute bottom-8 inset-x-0 text-center text-white/80 text-sm animate-pulse pointer-events-none">
      터치하여 시작
    </div>
  </div>
</template>
