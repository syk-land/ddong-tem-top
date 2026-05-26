<script setup lang="ts">
import { computed, onMounted, onBeforeUnmount, ref } from 'vue'
import { mainImageUrl, mainImagePortraitUrl } from '@/ui/images'
import { useI18n } from '@/lib/i18n'

const emit = defineEmits<{ (e: 'dismiss'): void }>()

const { lang, setLang } = useI18n()

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

// 언어 토글 버튼은 이벤트 전파를 막아 dismiss 트리거 안 되게 함
function pickLang(v: 'ko' | 'en', e: Event) {
  e.stopPropagation()
  setLang(v)
}
</script>

<template>
  <div
    class="fixed inset-0 z-50 flex items-center justify-center bg-black cursor-pointer select-none overflow-hidden"
    @click="dismiss"
    @keydown="dismiss"
    tabindex="0"
  >
    <div
      class="absolute inset-0 bg-no-repeat bg-center bg-cover"
      :style="{ backgroundImage: `url(${imgUrl})` }"
    />

    <!-- 언어 전환 (우상단) — 클릭 전파 차단 -->
    <div class="absolute top-3 right-3 flex items-center gap-1 cursor-default" @click.stop>
      <button
        type="button"
        :class="[
          'min-h-9 px-3 rounded-md text-xs font-bold border-2 transition active:scale-95 cursor-pointer backdrop-blur-sm',
          lang === 'ko'
            ? 'bg-violet-600/70 text-white border-violet-300/80'
            : 'bg-black/40 text-gray-300 border-white/30 hover:border-white/60',
        ]"
        @click="pickLang('ko', $event)"
      >한국어</button>
      <button
        type="button"
        :class="[
          'min-h-9 px-3 rounded-md text-xs font-bold border-2 transition active:scale-95 cursor-pointer backdrop-blur-sm',
          lang === 'en'
            ? 'bg-violet-600/70 text-white border-violet-300/80'
            : 'bg-black/40 text-gray-300 border-white/30 hover:border-white/60',
        ]"
        @click="pickLang('en', $event)"
      >English</button>
    </div>

    <div class="absolute bottom-8 inset-x-0 text-center text-white/80 text-sm font-bold tracking-widest animate-pulse pointer-events-none">
      &gt;&gt; START &lt;&lt;
    </div>
  </div>
</template>
