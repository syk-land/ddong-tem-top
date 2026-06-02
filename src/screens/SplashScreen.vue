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

    <!--
      영어 모드 제목 오버레이 — main.webp / main-portrait.webp 상단에 한글 제목
      "이번 판은 똥템으로 탑을 오르겠습니다" 가 픽셀로 박혀 있어 영어 검수 시 노출됨.
      상단 그라데이션 밴드로 그 영역을 덮고 영어 제목을 얹는다 (한국어 모드는 원본 노출).
      ※ 밴드 높이/제목 위치는 브라우저(npm run dev)에서 미세조정 필요.
    -->
    <div
      v-if="lang === 'en'"
      class="absolute top-0 inset-x-0 z-10 text-center pointer-events-none"
      style="padding: 3rem 1rem 11rem; background: linear-gradient(to bottom, #000 0%, #000 70%, rgba(0,0,0,0.85) 88%, rgba(0,0,0,0) 100%)"
    >
      <div style="font-size: 0.95rem; font-weight: 700; letter-spacing: 0.3em; color: #c4b5fd; text-shadow: 0 2px 6px rgba(0,0,0,0.95)">
        THIS RUN
      </div>
      <h1 style="margin-top: 0.35rem; font-size: 2.1rem; line-height: 1.1; font-weight: 800; color: #fff; text-shadow: 0 3px 10px rgba(0,0,0,0.95)">
        Climbing the Tower<br />with Junk Gear
      </h1>
    </div>

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
