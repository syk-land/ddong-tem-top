<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useGameStore } from './stores/game'
import MainMenu from './screens/MainMenu.vue'
import CharacterCreation from './screens/CharacterCreation.vue'
import Dungeon from './screens/Dungeon.vue'
import Combat from './screens/Combat.vue'
import Shop from './screens/Shop.vue'
import GameOver from './screens/GameOver.vue'
import VictoryScreen from './screens/VictoryScreen.vue'
import SplashScreen from './screens/SplashScreen.vue'
import RealBossChallenge from './screens/RealBossChallenge.vue'
import RealBossResult from './screens/RealBossResult.vue'
import IntroComic from './ui/components/IntroComic.vue'
import PickupModal from './ui/components/PickupModal.vue'
import DialogModal from './ui/components/DialogModal.vue'
import InputModal from './ui/components/InputModal.vue'
import ListModal from './ui/components/ListModal.vue'
import SpeedControl from './ui/components/SpeedControl.vue'
import { playBgm, stopBgm } from './ui/sound'

const game = useGameStore()

const currentScreen = computed(() => game.screen)

// 페이지 로드 직후 웅장 BGM 예약. 브라우저 autoplay 정책상 AudioContext 가
// suspended 면 playBgm 내부에서 첫 사용자 인터랙션(pointerdown/keydown/touchstart)
// 까지 자동 대기 후 시작. 결과적으로 사용자가 페이지에서 처음 어떤 동작을 하는
// 즉시 BGM 이 흐름 — 스플래시 클릭이든 다른 곳 클릭이든 동일.
onMounted(() => {
  playBgm('splash')
})

// 페이지 로드 시 1회 스플래시. 클릭으로 닫힘. 새로고침하면 다시 표시.
const showSplash = ref(true)
function dismissSplash() {
  // 첫 인터랙션 시점이면 위 onMounted 의 예약이 자동 발동되어 이미 재생 중.
  // playBgm 은 같은 kind 중복 호출을 무시하므로 안전.
  playBgm('splash')
  showSplash.value = false
  // 최초 실행이면 인트로 만화 자동 표시 (main → t1 → t2 → menu)
  game.autoShowIntroIfFirstTime()
}

// 화면 전환 BGM 라우팅
//   - menu (메인 메뉴):       splash BGM (웅장) — 캐릭터 생성 버튼 누르기 전까지 유지
//   - create 이후 (캐릭터 생성/던전/상점/승리): menu BGM (발랄)
//   - combat / gameover:      무음 (효과음 집중)
watch(currentScreen, (s) => {
  if (showSplash.value) return
  if (s === 'combat' || s === 'gameover') {
    stopBgm()
  } else if (s === 'menu') {
    playBgm('splash')
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
    <RealBossChallenge v-else-if="currentScreen === 'realboss'" />
    <RealBossResult v-else-if="currentScreen === 'realboss_result'" />
    <!-- 인트로 만화 (스플래시 후 자동/설정 다시보기) -->
    <IntroComic v-if="game.introVisible" />
    <!-- 인벤토리 풀 알림 모달 (모든 화면 위에 오버레이) -->
    <PickupModal />
    <!-- 범용 모달 (alert/confirm/prompt/list 대체) -->
    <ListModal />
    <InputModal />
    <DialogModal />
    <!-- 게임 속도 컨트롤 (전역, 스플래시 동안만 숨김 — combat 화면에도 표시) -->
    <SpeedControl v-if="!showSplash" />
    <!-- 최초 실행 스플래시 (클릭 시 닫힘) -->
    <SplashScreen v-if="showSplash" @dismiss="dismissSplash" />
  </main>
</template>
