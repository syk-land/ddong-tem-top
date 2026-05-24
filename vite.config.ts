import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import path from 'path'
import pkg from './package.json' with { type: 'json' }

export default defineConfig({
  // 상대 base — Firebase Hosting(도메인 루트) 과 GameMonetize 서브디렉토리
  // (uncached.gamemonetize.com/<gameId>/...) 양쪽에서 동일하게 동작.
  base: './',
  plugins: [vue()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
  },
  define: {
    // 빌드 시점에 package.json 의 버전을 코드에 박는다. App.vue 우상단 표시에 사용.
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
})
