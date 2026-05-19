<script setup lang="ts">
import { computed, ref } from 'vue'
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

const game = useGameStore()

const currentScreen = computed(() => game.screen)

// 페이지 로드 시 1회 스플래시. 클릭으로 닫힘. 새로고침하면 다시 표시.
const showSplash = ref(true)
function dismissSplash() {
  showSplash.value = false
}
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
