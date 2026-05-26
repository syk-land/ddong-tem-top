/// <reference types="vite/client" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, any>
  export default component
}

// vite.config.ts 의 define 으로 빌드 시점 주입 — package.json 의 version 문자열.
declare const __APP_VERSION__: string
