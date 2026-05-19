import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import './styles/main.css'
import { CHAPTER_THEMES } from '@/data/chapters'
import { validateMonsterTraitKeys, collectChapterTraitKeys } from '@/core/monsterTraits'

// 부팅 시점에 chapters.ts 의 trait 키가 monsterTraits 레지스트리에 모두 등록됐는지 검증
// (단계 0 시점에는 모두 미등록 — 단계 1 진행하면서 점차 줄어든다)
validateMonsterTraitKeys(collectChapterTraitKeys(CHAPTER_THEMES))

const app = createApp(App)
app.use(createPinia())
app.mount('#app')
