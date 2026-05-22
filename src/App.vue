<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useGameStore } from './stores/game'
import { useAuthStore } from './stores/auth'
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
import SettingsScreen from './screens/SettingsScreen.vue'
import IntroComic from './ui/components/IntroComic.vue'
import PickupModal from './ui/components/PickupModal.vue'
import DialogModal from './ui/components/DialogModal.vue'
import InputModal from './ui/components/InputModal.vue'
import ListModal from './ui/components/ListModal.vue'
import SpeedControl from './ui/components/SpeedControl.vue'
import TutorialOverlay from './ui/components/TutorialOverlay.vue'
import { playBgm, pauseBgm, resumeBgm, type BgmKind } from './ui/sound'

const game = useGameStore()
const auth = useAuthStore()
auth.initAuthListener()

const currentScreen = computed(() => game.screen)

// 페이지 로드 시 1회 스플래시. 클릭으로 닫힘. 새로고침하면 다시 표시.
const showSplash = ref(true)
function dismissSplash() {
  // 첫 인터랙션으로 autoplay 잠금 해제 (watcher 가 splash/gemini 어느 쪽이든 재생 보장)
  playBgm(pickBgm())
  showSplash.value = false
  // 최초 실행이면 인트로 만화 자동 표시 (main → t1 → t2 → menu)
  game.autoShowIntroIfFirstTime()
}

// 화면 전환 BGM 라우팅 — 정확히 2개 트랙만 사용.
//   - gemini  : run 전체 (캐릭터 생성 ~ 100층/사망)
//                = create/dungeon/shop/combat/event (단, 진짜 보스 전투 제외)
//   - splash  : 그 외 모든 화면 (메뉴/인트로/사망/승리/진짜 보스 도전 등)
// 동일 kind 는 playBgm 내부에서 no-op → 화면 전환 시 끊김 없음.
function pickBgm(): BgmKind {
  if (showSplash.value) return 'splash'
  if (game.introVisible) return 'splash'
  const s = currentScreen.value
  const realBossOn = !!game.realBossMonster
  if (s === 'realboss' || s === 'realboss_result') return 'splash'
  if (s === 'combat' && realBossOn) return 'splash'
  if (s === 'create' || s === 'dungeon' || s === 'shop'
      || s === 'combat' || s === 'event') return 'gemini'
  return 'splash'
}

watch(
  [currentScreen, () => game.introVisible, () => !!game.realBossMonster, showSplash],
  () => {
    if (game.paused) return  // 백그라운드 동안에는 새 BGM 시작 보류
    playBgm(pickBgm())
  },
  { immediate: true },  // 페이지 로드 직후 첫 BGM 자동 시작
)

// ============================================================
// 백그라운드 전환 시 일시정지 (BGM + 자동 틱)
// ============================================================
function onVisibility() {
  if (document.hidden) {
    game.setPaused(true)
    pauseBgm()
  } else {
    game.setPaused(false)
    // 현재 화면에 맞는 BGM 재개 — pauseBgm 시점에 저장된 kind 와 동일하면 resume.
    // 화면이 그새 바뀌었다면 playBgm 로 새 BGM 시작.
    const want = pickBgm()
    resumeBgm()
    // 화면이 바뀌어 다른 BGM 이 필요한 경우 보장
    playBgm(want)
  }
}

onMounted(() => {
  if (typeof document !== 'undefined') {
    // 페이지 마운트된 시점 = 사용자에게 보이는 시점 → paused 초기화 (혹시 잔재 방지)
    if (!document.hidden) game.setPaused(false)
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('pagehide', onVisibility)
    window.addEventListener('pageshow', onVisibility)
  }
})
onUnmounted(() => {
  if (typeof document !== 'undefined') {
    document.removeEventListener('visibilitychange', onVisibility)
    window.removeEventListener('pagehide', onVisibility)
    window.removeEventListener('pageshow', onVisibility)
  }
})
</script>

<template>
  <main class="flex-1 flex flex-col" :class="{ 'pt-8': !showSplash }">
    <MainMenu v-if="currentScreen === 'menu'" />
    <CharacterCreation v-else-if="currentScreen === 'create'" />
    <Dungeon v-else-if="currentScreen === 'dungeon'" />
    <Combat v-else-if="currentScreen === 'combat'" />
    <Shop v-else-if="currentScreen === 'shop'" />
    <GameOver v-else-if="currentScreen === 'gameover'" />
    <VictoryScreen v-else-if="currentScreen === 'victory'" />
    <RealBossChallenge v-else-if="currentScreen === 'realboss'" />
    <RealBossResult v-else-if="currentScreen === 'realboss_result'" />
    <SettingsScreen v-else-if="currentScreen === 'settings'" />
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
    <!-- 인게임 튜토리얼 오버레이 (활성 단계가 있을 때만 표시) -->
    <TutorialOverlay v-if="game.tutorialActive && !showSplash && !game.introVisible" />
    <!-- 최초 실행 스플래시 (클릭 시 닫힘) -->
    <SplashScreen v-if="showSplash" @dismiss="dismissSplash" />
  </main>
</template>
