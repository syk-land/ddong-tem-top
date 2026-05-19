<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useGameStore } from './stores/game'
import MainMenu from './screens/MainMenu.vue'
import CharacterCreation from './screens/CharacterCreation.vue'
import Dungeon from './screens/Dungeon.vue'
import Combat from './screens/Combat.vue'
import Shop from './screens/Shop.vue'
import GameOver from './screens/GameOver.vue'
import VictoryScreen from './screens/VictoryScreen.vue'
import SplashScreen from './screens/SplashScreen.vue'
import PickupModal from './ui/components/PickupModal.vue'
import DialogModal from './ui/components/DialogModal.vue'
import InputModal from './ui/components/InputModal.vue'
import ListModal from './ui/components/ListModal.vue'
import SpeedControl from './ui/components/SpeedControl.vue'
import { playBgm, stopBgm } from './ui/sound'

const game = useGameStore()

const currentScreen = computed(() => game.screen)

// 페이지 로드 시 1회 스플래시. 클릭으로 닫힘. 새로고침하면 다시 표시.
const showSplash = ref(true)
function dismissSplash() {
  // 스플래시 클릭 = 첫 사용자 액션 → AudioContext 활성화 가능
  // 짧게 splash BGM 재생 후 menu BGM 으로 전환
  playBgm('splash')
  // 0.8초 후 메뉴 BGM 전환 + 스플래시 닫기
  setTimeout(() => {
    showSplash.value = false
    playBgm('menu')
  }, 800)
}

// 화면 전환에 따른 BGM 전환
//   - combat: 무음 (전투 효과음에 집중)
//   - gameover: 무음
//   - 그 외: menu BGM 유지
watch(currentScreen, (s) => {
  if (showSplash.value) return  // 스플래시 중엔 이미 splash BGM
  if (s === 'combat' || s === 'gameover') {
    stopBgm()
  } else {
    playBgm('menu')
  }
})
</script>

<template>
  <main class="flex-1 flex flex-col">
    <MainMenu v-if="currentScreen === 'menu'" />
    <CharacterCreation v-else-if="currentScreen === 'create'" />
    <Dungeon v-else-if="currentScreen === 'dungeon'" />
    <Combat v-else-if="currentScreen === 'combat'" />
    <Shop v-else-if="currentScreen === 'shop'" />
    <GameOver v-else-if="currentScreen === 'gameover'" />
    <VictoryScreen v-else-if="currentScreen === 'victory'" />
    <!-- 인벤토리 풀 알림 모달 (모든 화면 위에 오버레이) -->
    <PickupModal />
    <!-- 범용 모달 (alert/confirm/prompt/list 대체) -->
    <ListModal />
    <InputModal />
    <DialogModal />
    <!-- 게임 속도 컨트롤 (전역, combat 화면은 인라인 사용하므로 제외, 스플래시 동안 숨김) -->
    <SpeedControl v-if="!showSplash && currentScreen !== 'combat'" />
    <!-- 최초 실행 스플래시 (클릭 시 닫힘) -->
    <SplashScreen v-if="showSplash" @dismiss="dismissSplash" />
  </main>
</template>
