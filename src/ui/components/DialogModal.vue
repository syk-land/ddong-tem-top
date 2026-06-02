<script setup lang="ts">
import { computed } from 'vue'
import { useGameStore } from '@/stores/game'
import { useI18n } from '@/lib/i18n'
import ComicImage from '@/ui/components/ComicImage.vue'
import { COMIC_OVERLAYS, comicKeyFromUrl } from '@/ui/comicOverlays'

const game = useGameStore()
const { lang } = useI18n()
const dialog = computed(() => game.dialog)

// 만화 오버레이 대상 이미지(realboss_intro 등)면 ComicImage 로 렌더해 말풍선을 가린다.
const isComicImage = computed(() => {
  const key = comicKeyFromUrl(dialog.value?.imageUrl)
  return !!key && !!COMIC_OVERLAYS[key]
})

// NPC 이벤트 카드(public/images/NPC/*.webp)는 상단 제목바·하단 문구에 한글이
// 픽셀로 박혀 있다. 모달이 이미 제목·설명을 (영어로) 표시하므로, 영어 모드에선
// 카드의 중앙 일러스트만 보이도록 위/아래 텍스트 밴드를 잘라낸다 (색상 무관).
// ※ 잘라내는 비율(clip)은 npm run dev 로 보면서 미세조정 가능.
const isNpcCardEn = computed(() =>
  lang.value === 'en' && !!dialog.value?.imageUrl && /\/images\/NPC\//.test(dialog.value.imageUrl),
)

function click(value: unknown) {
  game.resolveDialog(value)
}

// 오버레이(다른 곳) 클릭: 취소 버튼(value=false) 또는 마지막 버튼 value 로 닫음
function dismiss() {
  if (!dialog.value) return
  const cancelBtn = dialog.value.buttons.find((b) => b.value === false)
    ?? dialog.value.buttons[dialog.value.buttons.length - 1]
  game.resolveDialog(cancelBtn?.value ?? false)
}
</script>

<template>
  <Teleport to="body">
  <div
    v-if="dialog"
    class="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 px-4"
    @click.self="dismiss"
  >
    <div class="panel max-w-md w-full space-y-3" @click.stop>
      <!-- 만화 오버레이 이미지(realboss_intro 등): 말풍선 영어 오버레이 -->
      <div v-if="isComicImage && dialog.imageUrl" class="w-full max-h-[480px] flex justify-center">
        <ComicImage :src="dialog.imageUrl" />
      </div>
      <!-- NPC 카드(영어): 상/하단 한글 밴드를 잘라내고 중앙 일러스트만 노출 -->
      <div v-else-if="isNpcCardEn" class="w-full overflow-hidden rounded" style="aspect-ratio: 496 / 322;">
        <img :src="dialog.imageUrl" alt="" class="block w-full" style="margin-top: -15%;" />
      </div>
      <img v-else-if="dialog.imageUrl" :src="dialog.imageUrl" alt="" class="w-full max-h-[480px] object-contain rounded" />
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
  </Teleport>
</template>
