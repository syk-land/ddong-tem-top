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
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  build: {
    // 초기 번들 줄이려고 firebase / vue 코어 / 게임 코드 분리.
    // firebase 는 로그인할 때만 필요 — 첫 진입 비용 절감.
    rollupOptions: {
      output: {
        manualChunks: {
          vue: ['vue', 'pinia'],
          firebase: [
            'firebase/app',
            'firebase/auth',
            'firebase/firestore',
          ],
        },
      },
    },
    // GameMonetize 제출 시 디버그 정보 불필요
    sourcemap: false,
    minify: 'esbuild',
    // 청크 사이즈 경고 임계 (게임 데이터 묶음이 좀 큼)
    chunkSizeWarningLimit: 600,
    // 작은 asset 은 base64 인라인 (네트워크 왕복 절감)
    assetsInlineLimit: 4096,
  },
})
