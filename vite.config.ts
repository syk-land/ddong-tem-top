import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import path from 'path'
import pkg from './package.json' with { type: 'json' }

export default defineConfig({
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
