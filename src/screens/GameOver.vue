<script setup lang="ts">
import { computed, onMounted, ref, nextTick } from 'vue'
import { useGameStore } from '@/stores/game'
import { defaultBgUrl } from '@/ui/images'
import { logColorClass, logPrefix } from '@/ui/colors'

const game = useGameStore()
const bgUrl = defaultBgUrl()

// 사망 시점의 전투 로그 (resetGame 호출 전까지 game.combat 유지)
const battleLog = computed(() => game.combat?.log ?? [])
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
    <div class="panel max-w-md w-full text-center space-y-4">
      <h1 class="text-3xl font-bold text-log-enemy">사망</h1>
      <p class="text-gray-300">탑을 오르다 쓰러졌습니다.</p>
      <p class="text-sm text-gray-500">캐릭터, 골드, 장비가 모두 소멸했습니다.</p>

      <!-- 마지막 전투 로그 -->
      <div
        v-if="battleLog.length"
        class="rounded-lg border border-slate-700/60 bg-black/55 overflow-hidden text-left"
      >
        <div class="px-3 py-1.5 bg-slate-900/60 border-b border-slate-700/60 flex items-center justify-between">
          <span class="text-xs font-bold text-slate-300">📜 마지막 전투 기록</span>
          <span class="text-xs text-slate-500">{{ battleLog.length }}줄</span>
        </div>
        <div
          ref="logEl"
          class="overflow-y-auto font-mono px-3 py-2 text-xs leading-relaxed"
          style="max-height: 220px"
        >
          <div v-for="(l, i) in battleLog" :key="i" :class="logColorClass[l.kind]">
            <span class="text-gray-500 text-[10px] mr-1">[{{ l.tick }}t]</span>
            <span class="mr-1 opacity-80">{{ logPrefix[l.kind] }}</span>{{ l.text }}
          </div>
        </div>
      </div>

      <button class="btn-primary w-full min-h-11 text-base font-bold" @click="backToMenu">메인 메뉴로</button>
    </div>
  </section>
</template>
