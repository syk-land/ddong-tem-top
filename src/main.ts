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

// 안드로이드 (Capacitor) 뒤로가기 = 취소 버튼 동작.
// 떠있는 모달이 없으면 디폴트 동작(앱 종료/이전 페이지)
;(async () => {
  try {
    const { App: CapApp } = await import('@capacitor/app')
    CapApp.addListener('backButton', async (e: { canGoBack: boolean }) => {
      const game = useGameStore()
      const handled = game.handleBackButton()
      if (handled) return
      if (e.canGoBack) return
      // 마지막 단계 — 우발적 종료 방지를 위해 확인 후 종료
      const ok = await game.confirmModal('게임을 종료하시겠습니까?', {
        title: '종료',
        okLabel: '예',
        cancelLabel: '아니오',
      })
      if (ok) CapApp.exitApp()
    })
  } catch {
    // 웹 환경 — Capacitor 미사용. 데스크탑 보조용으로 Esc 키도 동일 처리.
    window.addEventListener('keydown', (ev) => {
      if (ev.key === 'Escape') {
        const game = useGameStore()
        if (game.handleBackButton()) ev.preventDefault()
      }
    })
  }
})()
