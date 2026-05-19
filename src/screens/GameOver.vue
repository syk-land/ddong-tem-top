<script setup lang="ts">
import { onMounted } from 'vue'
import { useGameStore } from '@/stores/game'
import { defaultBgUrl } from '@/ui/images'

const game = useGameStore()
const bgUrl = defaultBgUrl()

// 사망 화면 진입 시 세이브 강제 정리 (이중 안전장치)
onMounted(() => {
  game.resetSavedRunFlag()
})

function backToMenu() {
  game.resetGame()
}
</script>

<template>
  <section
    class="flex-1 flex items-center justify-center px-4 bg-cover bg-center"
    :style="{ backgroundImage: `linear-gradient(rgba(0,0,0,0.85), rgba(0,0,0,0.95)), url(${bgUrl})` }"
  >
    <div class="panel max-w-md w-full text-center space-y-4">
      <h1 class="text-3xl font-bold text-log-enemy">사망</h1>
      <p class="text-gray-300">탑을 오르다 쓰러졌습니다.</p>
      <p class="text-sm text-gray-500">캐릭터, 골드, 장비가 모두 소멸했습니다.</p>
      <button class="btn-primary w-full" @click="backToMenu">메인 메뉴로</button>
    </div>
  </section>
</template>
