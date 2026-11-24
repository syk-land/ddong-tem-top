<script setup lang="ts">
// 만화 이미지 + (영어 모드) 한글 말풍선 마스킹 오버레이.
// 인트로/진짜보스/도감 어디서든 동일하게 쓰는 단일 컴포넌트.
//
// 정렬 보장: object-contain 으로 그려진 '실제 이미지 사각형'을 런타임에 측정해
// 오버레이 레이어를 그 사각형에 정확히 맞춘다 (레터박스/컨테이너 크기와 무관).
// 말풍선 좌표는 원본 이미지 기준 %, 폰트는 측정된 이미지 너비의 비율(px).
import { ref, reactive, computed, onMounted, onBeforeUnmount, watch, nextTick } from 'vue'
import { useI18n } from '@/lib/i18n'
import { COMIC_OVERLAYS, comicKeyFromUrl } from '@/ui/comicOverlays'

const props = defineProps<{ src: string; alt?: string }>()
const { lang } = useI18n()

const meta = computed(() => {
  const key = comicKeyFromUrl(props.src)
  return key ? COMIC_OVERLAYS[key] ?? null : null
})
const bubbles = computed(() => (lang.value === 'en' && meta.value ? meta.value.bubbles : []))

const rootEl = ref<HTMLElement | null>(null)
const imgEl = ref<HTMLImageElement | null>(null)
// 측정된 '표시 이미지' 사각형 (root 기준 px)
const rect = reactive({ left: 0, top: 0, width: 0, height: 0 })

function measure() {
  const img = imgEl.value
  const root = rootEl.value
  if (!img || !root || !img.naturalWidth || !img.naturalHeight) return
  const ib = img.getBoundingClientRect()
  const rb = root.getBoundingClientRect()
  const boxW = ib.width
  const boxH = ib.height
  const ar = img.naturalWidth / img.naturalHeight
  // object-contain 으로 box 안에 들어간 실제 이미지 크기
  let w = boxW
  let h = boxW / ar
  if (h > boxH) { h = boxH; w = boxH * ar }
  rect.width = w
  rect.height = h
  rect.left = (ib.left - rb.left) + (boxW - w) / 2
  rect.top = (ib.top - rb.top) + (boxH - h) / 2
}

let ro: ResizeObserver | null = null
onMounted(() => {
  measure()
  ro = new ResizeObserver(() => measure())
  if (imgEl.value) ro.observe(imgEl.value)
  if (rootEl.value) ro.observe(rootEl.value)
  window.addEventListener('resize', measure)
})
onBeforeUnmount(() => {
  ro?.disconnect()
  window.removeEventListener('resize', measure)
})
watch(() => props.src, () => { nextTick(() => requestAnimationFrame(measure)) })
</script>

<template>
  <div v-if="meta" ref="rootEl" class="comic-root">
    <img
      ref="imgEl"
      :src="src"
      :alt="alt ?? ''"
      decoding="async"
      class="comic-img"
      draggable="false"
      @load="measure"
    />
    <div
      class="comic-layer"
      :style="{ left: rect.left + 'px', top: rect.top + 'px', width: rect.width + 'px', height: rect.height + 'px' }"
    >
      <div
        v-for="(b, i) in bubbles"
        :key="i"
        class="comic-bubble"
        :style="{ top: b.top + '%', left: b.left + '%', width: b.width + '%', fontSize: (b.fs / 100 * rect.width) + 'px' }"
      >{{ b.text }}</div>
    </div>
  </div>
  <img v-else :src="src" :alt="alt ?? ''" decoding="async" class="comic-img-plain" draggable="false" />
</template>

<style scoped>
.comic-root {
  position: relative;
  width: 100%;
  height: 100%;
  min-height: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}
.comic-img {
  max-width: 100%;
  max-height: 100%;
  width: auto;
  height: auto;
  object-fit: contain;
  display: block;
}
.comic-img-plain {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
}
.comic-layer {
  position: absolute;
  pointer-events: none;
}
.comic-bubble {
  position: absolute;
  transform: translateY(-50%);
  box-sizing: border-box;
  background: rgba(255, 255, 255, 0.98);
  color: #161616;
  border-radius: 0.7em;
  padding: 0.55em 0.6em;
  font-weight: 700;
  line-height: 1.12;
  text-align: center;
  box-shadow: 0 1px 5px rgba(0, 0, 0, 0.45);
  pointer-events: none;
}
</style>
