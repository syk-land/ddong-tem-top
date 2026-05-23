<script setup lang="ts">
import { computed } from 'vue'
import { useGameStore } from '@/stores/game'
import { realBossImageUrl, defaultBgUrl } from '@/ui/images'

const game = useGameStore()
const bgUrl = defaultBgUrl()

const theme = computed(() => game.realBossTheme)
const boss = computed(() => game.realBossMonster)

function start() {
  game.enterRealBossCombat()
}
</script>

<template>
  <section
    v-if="boss && theme"
    class="flex-1 flex flex-col items-center justify-center px-4 py-6 max-w-2xl mx-auto w-full bg-cover bg-center gap-8 animate-fadein"
    :style="{ backgroundImage: `linear-gradient(rgba(10,14,26,0.78), rgba(10,14,26,0.92)), url(${bgUrl})` }"
  >
    <!-- 보스 이미지 — 크게, 중앙 (화면 폭 꽉 채움) -->
    <img
      :src="realBossImageUrl(theme)"
      :alt="boss.template.name"
      class="w-full aspect-square max-w-sm sm:max-w-md object-cover rounded-2xl border-2 border-rose-500/70 shadow-[0_0_40px_rgba(244,63,94,0.45)]"
      @error="(e) => ((e.target as HTMLImageElement).style.display = 'none')"
    />

    <!-- 보스 이름만 -->
    <div class="text-3xl sm:text-4xl text-rose-200 font-bold tracking-wide text-center">
      {{ boss.template.name }}
    </div>

    <!-- 도전 시작 (하단 sticky) -->
    <div class="w-full mt-auto sticky bottom-0 pt-2 pb-1 bg-gradient-to-t from-bg-primary/95 to-bg-primary/0">
      <button class="btn-primary w-full min-h-12 font-bold tracking-wide" @click="start">도전 시작</button>
    </div>
  </section>
</template>

<style scoped>
@keyframes fadein {
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: translateY(0); }
}
.animate-fadein { animation: fadein 280ms ease-out; }
</style>
