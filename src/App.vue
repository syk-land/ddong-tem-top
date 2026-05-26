<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
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
import ItemAnnounceModal from './ui/components/ItemAnnounceModal.vue'
import SpeedControl from './ui/components/SpeedControl.vue'
import TutorialOverlay from './ui/components/TutorialOverlay.vue'
import { playBgm, pauseBgm, resumeBgm, type BgmKind } from './ui/sound'
import { showInterstitial, onGameMonetizeLifecycle, isGameMonetizeReady } from './lib/ads'

const game = useGameStore()
const auth = useAuthStore()
auth.initAuthListener()

const currentScreen = computed(() => game.screen)

// vite.config.ts 의 define 으로 빌드 시점에 박힌 버전 (= package.json 의 version)
const appVersion = __APP_VERSION__

// 페이지 로드 시 1회 스플래시. 클릭으로 닫힘. 새로고침하면 다시 표시.
const showSplash = ref(true)
function dismissSplash() {
  // 첫 인터랙션으로 autoplay 잠금 해제 (watcher 가 splash/gemini 어느 쪽이든 재생 보장)
  playBgm(pickBgm())
  showSplash.value = false
  // 최초 실행이면 인트로 만화 자동 표시 (main → t1 → t2 → menu)
  game.autoShowIntroIfFirstTime()
  // GameMonetize 활성화 트래픽 누적용 — 세션당 1회 프리롤 인터스티셜.
  // SDK 미로드/no-fill 이면 조용히 패스. 사용자가 splash 클릭으로 autoplay 권한을
  // 부여한 직후라 SDK 의 광고 자동재생 정책에도 안 걸린다.
  schedulePreroll()
}

// 세션당 1회 프리롤. SDK 가 비동기 로드라 ready 될 때까지 polling.
//   - 플래그는 "showInterstitial 호출 성공" 시점에 박는다. 폴링 실패 후
//     SDK_READY 이벤트로 다시 시도할 수 있도록 (이전엔 시도 전에 박아서
//     SDK 가 3초 내 안 떴으면 영영 못 봤음).
const PREROLL_SESSION_KEY = 'gm_preroll_done'
function schedulePreroll() {
  if (sessionStorage.getItem(PREROLL_SESSION_KEY)) return
  console.info('[ads] preroll: scheduling — polling SDK ready up to 10s')
  let tries = 0
  const tick = () => {
    if (sessionStorage.getItem(PREROLL_SESSION_KEY)) return  // 다른 경로에서 이미 발동
    if (isGameMonetizeReady()) {
      console.info('[ads] preroll: SDK ready → firing interstitial')
      sessionStorage.setItem(PREROLL_SESSION_KEY, '1')
      showInterstitial()
      return
    }
    if (++tries < 100) setTimeout(tick, 100)  // 최대 10초 대기
    else console.warn('[ads] preroll: SDK never ready within 10s — skipping')
  }
  tick()
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

// 화면 전환 시 최상단으로 스크롤. 컴포넌트 mount 후 (nextTick) 에 실행해
// 새 화면이 DOM 에 그려진 직후 스크롤 위치를 0 으로 리셋.
//   - window: 페이지 전체 스크롤 (드물지만 안전망)
//   - #app: 9:16 컨테이너 (현재 layout 의 실 스크롤 컨테이너)
//   - main: App.vue 의 <main> (각 screen 컴포넌트의 부모)
watch(currentScreen, async () => {
  await nextTick()
  window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
  const appEl = document.getElementById('app')
  if (appEl) appEl.scrollTop = 0
  const mainEl = appEl?.querySelector('main')
  if (mainEl) mainEl.scrollTop = 0
})

// ============================================================
// 백그라운드 전환 시 일시정지 (BGM + 자동 틱)
// ============================================================
function onVisibility() {
  if (document.hidden) {
    game.setPaused(true)
    pauseBgm()
    // 사용자가 탭을 닫을 수 있으므로 보류된 클라우드 sync 를 즉시 발사.
    // 실패해도 게임 흐름엔 영향 없으므로 fire-and-forget.
    auth.flushSyncMetaToCloud().catch(() => {})
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

// GameMonetize SDK 광고 재생 라이프사이클 unsub. 광고 재생 직전 SDK 가 SDK_GAME_PAUSE 를
// 던지고, 종료 후 SDK_GAME_START 를 던진다. 자동 틱 + BGM 을 광고에 맞춰 정지/복원한다.
let unsubAdsLifecycle: (() => void) | null = null

onMounted(() => {
  if (typeof document !== 'undefined') {
    // 페이지 마운트된 시점 = 사용자에게 보이는 시점 → paused 초기화 (혹시 잔재 방지)
    if (!document.hidden) game.setPaused(false)
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('pagehide', onVisibility)
    window.addEventListener('pageshow', onVisibility)
  }
  unsubAdsLifecycle = onGameMonetizeLifecycle({
    onPause: () => {
      game.setPaused(true)
      pauseBgm()
    },
    onResume: () => {
      game.setPaused(false)
      resumeBgm()
      // 화면이 그새 바뀌었을 수도 있어 현재 화면 기준 BGM 재보장
      playBgm(pickBgm())
    },
    onReady: () => {
      // SDK 준비된 즉시 프리롤 시도 (splash 클릭 경로와 별개 — 둘 중 먼저 발동되는 쪽이 이김)
      schedulePreroll()
    },
  })
  // 리스너 attach 시점에 SDK 가 이미 ready 일 수 있다 (SDK_READY 이벤트를 놓쳤을 가능성).
  // 이 경우에도 프리롤이 발동되도록 즉시 한 번 폴링 시작.
  if (isGameMonetizeReady()) schedulePreroll()
})
onUnmounted(() => {
  if (typeof document !== 'undefined') {
    document.removeEventListener('visibilitychange', onVisibility)
    window.removeEventListener('pagehide', onVisibility)
    window.removeEventListener('pageshow', onVisibility)
  }
  unsubAdsLifecycle?.()
  unsubAdsLifecycle = null
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
    <!-- 아이템 획득 알림 모달 (자동 적재 후 카드+확인) -->
    <ItemAnnounceModal />
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
    <!-- 우상단 버전 배지 — 스플래시 외 모든 화면 (SpeedControl 은 좌상단). 클릭 막힘 X -->
    <div
      v-if="!showSplash"
      class="fixed top-1 right-2 z-[100] text-[10px] sm:text-xs font-mono text-gray-400/70 select-none pointer-events-none tabular-nums"
      aria-hidden="true"
    >
      v{{ appVersion }}
    </div>
  </main>
</template>
