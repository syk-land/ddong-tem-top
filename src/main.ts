import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import './styles/main.css'
import { CHAPTER_THEMES } from '@/data/chapters'
import { validateMonsterTraitKeys, collectChapterTraitKeys } from '@/core/monsterTraits'
import { useGameStore } from '@/stores/game'

// 부팅 시점에 chapters.ts 의 trait 키가 monsterTraits 레지스트리에 모두 등록됐는지 검증
// (단계 0 시점에는 모두 미등록 — 단계 1 진행하면서 점차 줄어든다)
validateMonsterTraitKeys(collectChapterTraitKeys(CHAPTER_THEMES))

const app = createApp(App)
app.use(createPinia())
app.mount('#app')

// 웹 빌드 전용 — 데스크탑 보조용으로 Esc 키를 뒤로가기로 매핑.
//   (이전엔 Capacitor backButton 도 처리했으나 Firebase Hosting only 로 전환되며 제거.)
window.addEventListener('keydown', (ev) => {
  if (ev.key === 'Escape') {
    const game = useGameStore()
    if (game.handleBackButton()) ev.preventDefault()
  }
})
