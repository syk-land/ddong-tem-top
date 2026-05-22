<script setup lang="ts">
import { computed, onMounted, ref, nextTick } from 'vue'
import { useGameStore } from '@/stores/game'
import { defaultBgUrl } from '@/ui/images'
import { logColorClass, logPrefix } from '@/ui/colors'

const game = useGameStore()
const bgUrl = defaultBgUrl()

// 사망 시점의 전투 로그 (resetGame 호출 전까지 game.combat 유지)
const battleLog = computed(() => game.combat?.log ?? [])
const pendingRank = computed(() => game.pendingClear)
const logEl = ref<HTMLElement | null>(null)

onMounted(async () => {
  game.resetSavedRunFlag()
  // 로그를 마지막 줄로 자동 스크롤 — 사망 결정타가 가장 잘 보이도록
  await nextTick()
  if (logEl.value) logEl.value.scrollTop = logEl.value.scrollHeight
})

function backToMenu() {
  game.resetGame()
}
</script>

<template>
  <section
    class="flex-1 flex items-center justify-center px-4 py-6 bg-cover bg-center"
    :style="{ backgroundImage: `linear-gradient(rgba(0,0,0,0.85), rgba(0,0,0,0.95)), url(${bgUrl})` }"
  >
    <div
      class="w-full max-w-md rounded-xl border-2 border-rose-400/70 bg-bg-secondary/95 shadow-[0_0_40px_rgba(244,63,94,0.35)] p-6 space-y-4 text-center animate-fadein"
    >
      <!-- 헤더 — 크게 한글만 -->
      <div class="text-rose-400 text-5xl font-bold tracking-widest leading-tight">사망</div>
      <div class="text-sm text-gray-300">탑을 오르다 쓰러졌습니다.</div>
      <div class="text-xs text-gray-500 -mt-2">캐릭터, 골드, 장비가 모두 소멸했습니다.</div>

      <!-- v10: 도달 챕터 기반 보상 (있을 때만) — amber 액센트 (보상 톤) -->
      <div
        v-if="pendingRank && pendingRank.bonus > 0"
        class="rounded-lg border-2 border-amber-400/50 bg-amber-950/30 px-3 py-2.5 shadow-[0_0_18px_rgba(251,191,36,0.18)]"
      >
        <div class="text-xs text-amber-300/80 font-bold">등급 보상</div>
        <div class="flex items-baseline justify-center gap-3 mt-1">
          <span class="text-3xl font-bold text-amber-300">{{ pendingRank.rank }}</span>
          <span class="text-sm text-log-reward font-mono font-bold">+{{ pendingRank.bonus }}pt</span>
        </div>
        <div class="text-xs text-amber-200/60 mt-1">보너스 스탯이 메타 풀에 적립되었습니다.</div>
      </div>

      <!-- 마지막 전투 로그 — 중성 톤 (가독성 우선) -->
      <div
        v-if="battleLog.length"
        class="rounded-lg border border-rose-400/30 bg-black/55 overflow-hidden text-left"
      >
        <div class="px-3 py-1.5 bg-rose-950/40 border-b border-rose-400/20 flex items-center justify-between">
          <span class="text-xs font-bold text-rose-200">📜 마지막 전투 기록</span>
          <span class="text-xs text-rose-200/60">{{ battleLog.length }}줄</span>
        </div>
        <div
          ref="logEl"
          class="overflow-y-auto font-mono px-3 py-2 text-xs leading-relaxed"
          style="max-height: 220px"
        >
          <div v-for="(l, i) in battleLog" :key="i" :class="logColorClass[l.kind]">
            <span class="text-gray-500 text-xs mr-1">[{{ l.tick }}t]</span>
            <span class="mr-1 opacity-80">{{ logPrefix[l.kind] }}</span>{{ l.text }}
          </div>
        </div>
      </div>

      <button class="btn-primary w-full min-h-12 text-base font-bold" @click="backToMenu">메인 메뉴로</button>
    </div>
  </section>
</template>

<style scoped>
@keyframes fadein {
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: translateY(0); }
}
.animate-fadein {
  animation: fadein 250ms ease-out;
}
</style>
