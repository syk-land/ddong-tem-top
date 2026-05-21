<script setup lang="ts">
import { onMounted } from 'vue'
import { useGameStore } from '@/stores/game'
import { useAuthStore } from '@/stores/auth'
import { mainImageUrl } from '@/ui/images'

const game = useGameStore()
const auth = useAuthStore()
const bgUrl = mainImageUrl()

async function loginGoogle() {
  try {
    await auth.login()
  } catch (e: any) {
    await game.confirmModal(`로그인 실패: ${e?.message ?? e}`, { title: '구글 로그인', okLabel: '확인' })
  }
}
async function logoutGoogle() {
  await auth.logout()
}

onMounted(() => {
  game.init()
  // 도전 카운터 도달이면 도전 화면으로 자동 전환
  game.triggerRealBossIfDue()
})

function startNew() {
  // 캐릭터 생성 진입 직전에도 도전 카운터 도달 시 도전부터
  if (game.triggerRealBossIfDue()) return
  game.startCharacterCreation()
}
function loadGame() {
  game.loadGame()
}
async function resetMeta() {
  const ok = await game.confirmModal('정말 모든 누적 보너스를 리셋할까요?', { title: '데이터 리셋', danger: true, okLabel: '리셋' })
  if (ok) {
    localStorage.removeItem('climetop:meta:v1')
    localStorage.removeItem('climetop:run:v1')
    localStorage.removeItem('climetop:tutorialSeen:v1')
    localStorage.removeItem('climetop:creation:v1')
    location.reload()
  }
}
</script>

<template>
  <section
    class="flex-1 flex items-center justify-center px-4 bg-cover bg-center"
    :style="{ backgroundImage: `linear-gradient(rgba(10,14,26,0.65), rgba(10,14,26,0.85)), url(${bgUrl})` }"
  >
    <div class="max-w-md w-full panel space-y-4">
      <header class="text-center space-y-2">
        <h1 class="text-2xl font-bold leading-tight">
          <span class="text-trait-special">이번 판은</span>
          <span class="text-grade-legend"> 똥템</span>
          <span class="text-trait-special">으로</span>
          <br />
          <span class="text-log-reward">탑을 오르겠습니다</span>
        </h1>
        <p class="text-sm text-gray-400">100층 로그라이크 · 영구 사망 · 클리어 등급 누적</p>
      </header>

      <div class="space-y-3">
        <button class="btn-primary w-full" @click="startNew">새 캐릭터 (3챌린지 선택)</button>
        <button
          v-if="game.hasSavedRun"
          class="btn-secondary w-full"
          @click="loadGame"
        >
          이어하기
        </button>
        <button class="btn-secondary w-full text-xs opacity-70" @click="resetMeta">
          데이터 리셋
        </button>
      </div>

      <div class="border-t border-slate-700 pt-3">
        <div v-if="auth.isLoggedIn" class="flex items-center gap-2">
          <img
            v-if="auth.photoURL"
            :src="auth.photoURL"
            alt="avatar"
            class="w-8 h-8 rounded-full border border-slate-600"
          />
          <div class="flex-1 text-sm truncate text-gray-300">
            {{ auth.displayName ?? '로그인됨' }}
          </div>
          <button
            class="btn-secondary text-xs px-2 py-1"
            :disabled="auth.loading"
            @click="logoutGoogle"
          >
            로그아웃
          </button>
        </div>
        <button
          v-else
          class="btn-secondary w-full text-sm"
          :disabled="auth.loading"
          @click="loginGoogle"
        >
          {{ auth.loading ? '로그인 중...' : '🔑 Google 로 로그인 (클라우드 저장)' }}
        </button>
      </div>

      <footer class="text-xs text-gray-500 text-center space-y-1 border-t border-slate-700 pt-4">
        <div>누적 클리어: <span class="text-log-reward font-mono">{{ game.meta.clearCount }}회</span></div>
        <div>누적 보너스 스탯: <span class="text-log-reward font-mono">+{{ game.meta.totalBonusStats }}pt</span></div>
      </footer>
    </div>
  </section>
</template>
