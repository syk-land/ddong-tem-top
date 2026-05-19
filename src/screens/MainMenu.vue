<script setup lang="ts">
import { onMounted } from 'vue'
import { useGameStore } from '@/stores/game'
import { mainImageUrl } from '@/ui/images'

const game = useGameStore()
const bgUrl = mainImageUrl()

onMounted(() => game.init())

function startNew() {
  game.startCharacterCreation()
}
function loadGame() {
  game.loadGame()
}
async function resetMeta() {
  const ok = await game.confirmModal('정말 모든 누적 보너스를 리셋할까요?', { title: '데이터 리셋', danger: true, okLabel: '리셋' })
  if (ok) {
    localStorage.removeItem('climetop:meta:v1')
    localStorage.removeItem('climetop:run:v1')
    location.reload()
  }
}
</script>

<template>
  <section
    class="flex-1 flex items-center justify-center px-4 bg-cover bg-center"
    :style="{ backgroundImage: `linear-gradient(rgba(10,14,26,0.65), rgba(10,14,26,0.85)), url(${bgUrl})` }"
  >
    <div class="max-w-md w-full panel space-y-4">
      <header class="text-center space-y-2">
        <h1 class="text-2xl font-bold leading-tight">
          <span class="text-trait-special">이번 판은</span>
          <span class="text-grade-legend"> 똥템</span>
          <span class="text-trait-special">으로</span>
          <br />
          <span class="text-log-reward">탑을 오르겠습니다</span>
        </h1>
        <p class="text-sm text-gray-400">100층 로그라이크 · 영구 사망 · 클리어 등급 누적</p>
      </header>

      <div class="space-y-3">
        <button class="btn-primary w-full" @click="startNew">🆕 새 캐릭터 (3챌린지 선택)</button>
        <button
          v-if="game.hasSavedRun"
          class="btn-secondary w-full"
          @click="loadGame"
        >
          ▶ 이어하기
        </button>
        <button class="btn-secondary w-full text-xs opacity-70" @click="resetMeta">
          데이터 리셋
        </button>
      </div>

      <footer class="text-xs text-gray-500 text-center space-y-1 border-t border-slate-700 pt-4">
        <div>누적 클리어: <span class="text-log-reward font-mono">{{ game.meta.clearCount }}회</span></div>
        <div>누적 보너스 스탯: <span class="text-log-reward font-mono">+{{ game.meta.totalBonusStats }}pt</span></div>
      </footer>
    </div>
  </section>
</template>
