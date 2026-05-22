<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useGameStore } from '@/stores/game'
import { useAuthStore } from '@/stores/auth'
import {
  isSoundEnabled, getSoundVolume, setSoundEnabled, setSoundVolume,
  isBgmEnabled, getBgmVolume, setBgmEnabled, setBgmVolume,
} from '@/ui/sound'

const game = useGameStore()
const auth = useAuthStore()

// ── 사운드 ──
const sfxOn = ref(isSoundEnabled())
const sfxVol = ref(Math.round(getSoundVolume() * 100))
const bgmOn = ref(isBgmEnabled())
const bgmVol = ref(Math.round(getBgmVolume() * 100))

function toggleSfx() {
  sfxOn.value = !sfxOn.value
  setSoundEnabled(sfxOn.value)
}
function onSfxVol(v: number) {
  sfxVol.value = v
  setSoundVolume(v / 100)
}
function toggleBgm() {
  bgmOn.value = !bgmOn.value
  setBgmEnabled(bgmOn.value)
}
function onBgmVol(v: number) {
  bgmVol.value = v
  setBgmVolume(v / 100)
}

// ── 데이터 리셋 ──
const STORAGE_KEYS = [
  'climetop:meta:v1',
  'climetop:run:v1',
  'climetop:creation:v1',
  'climetop:speed:v1',
  'climetop:autoEnter:v1',
  'climetop:tutorialSeen:v1',
  'climetop:sound:v1',
]

async function resetAll() {
  const ok = await game.confirmModal(
    '메타 보너스 / 진행 중 런 / 모든 설정이 삭제됩니다.\n이 작업은 되돌릴 수 없습니다.',
    { title: '모든 데이터 리셋', okLabel: '리셋', danger: true },
  )
  if (!ok) return
  for (const k of STORAGE_KEYS) localStorage.removeItem(k)
  location.reload()
}

// ── 인트로 만화 다시보기 ──
function replayIntro() {
  game.setScreen('menu')
  // 다음 메뉴 진입 시 자동 노출 위해 tutorialSeen 제거 → 또는 직접 노출
  try { localStorage.removeItem('climetop:tutorialSeen:v1') } catch {}
  game.autoShowIntroIfFirstTime()
}

// ── 인게임 튜토리얼 다시보기 ──
async function replayTutorial() {
  const ok = await game.confirmModal(
    '튜토리얼 진행도를 초기화합니다.\n다음 게임 진행 중에 처음부터 다시 노출됩니다.',
    { title: '튜토리얼 다시 보기', okLabel: '초기화' },
  )
  if (!ok) return
  game.resetTutorial()
  game.setScreen('menu')
}

function back() {
  game.setScreen('menu')
}

onMounted(() => {
  // 페이지 진입 시 현재 값 동기화
  sfxOn.value = isSoundEnabled()
  sfxVol.value = Math.round(getSoundVolume() * 100)
  bgmOn.value = isBgmEnabled()
  bgmVol.value = Math.round(getBgmVolume() * 100)
})
</script>

<template>
  <section class="flex-1 flex flex-col px-3 py-3 sm:px-4 sm:py-4 gap-3 max-w-2xl mx-auto w-full">
    <!-- 헤더 — 큰 한글 + 뒤로 -->
    <header class="flex items-center justify-between">
      <h2 class="text-xl font-bold text-cyan-200 tracking-wide">설정</h2>
      <button class="btn-secondary text-xs min-h-9 px-3 font-bold" @click="back">뒤로</button>
    </header>

    <!-- ── 사운드 ── -->
    <div class="rounded-lg border border-cyan-400/40 bg-bg-secondary/70 backdrop-blur-sm overflow-hidden">
      <div class="px-3 py-1.5 bg-cyan-950/30 border-b border-cyan-500/20 flex items-center">
        <span class="text-xs font-bold text-cyan-200">🔊 사운드</span>
      </div>
      <div class="p-3 space-y-3">
        <!-- SFX -->
        <div class="space-y-1.5">
          <div class="flex items-center justify-between">
            <span class="text-sm font-bold">효과음 (SFX)</span>
            <button
              class="px-3 min-h-9 rounded-md text-xs font-bold border-2 transition active:scale-95"
              :class="sfxOn
                ? 'bg-log-skill/20 text-log-skill border-log-skill/50'
                : 'bg-slate-800 text-gray-500 border-slate-700'"
              @click="toggleSfx"
            >{{ sfxOn ? 'ON' : 'OFF' }}</button>
          </div>
          <div class="flex items-center gap-2">
            <input
              type="range" min="0" max="100" step="1"
              :value="sfxVol"
              :disabled="!sfxOn"
              @input="onSfxVol(Number(($event.target as HTMLInputElement).value))"
              class="flex-1 accent-cyan-400 disabled:opacity-40"
            />
            <span class="w-12 text-right text-xs font-mono tabular-nums">{{ sfxVol }}%</span>
          </div>
        </div>
        <!-- BGM -->
        <div class="space-y-1.5 pt-2 border-t border-slate-700/50">
          <div class="flex items-center justify-between">
            <span class="text-sm font-bold">배경음악 (BGM)</span>
            <button
              class="px-3 min-h-9 rounded-md text-xs font-bold border-2 transition active:scale-95"
              :class="bgmOn
                ? 'bg-log-skill/20 text-log-skill border-log-skill/50'
                : 'bg-slate-800 text-gray-500 border-slate-700'"
              @click="toggleBgm"
            >{{ bgmOn ? 'ON' : 'OFF' }}</button>
          </div>
          <div class="flex items-center gap-2">
            <input
              type="range" min="0" max="100" step="1"
              :value="bgmVol"
              :disabled="!bgmOn"
              @input="onBgmVol(Number(($event.target as HTMLInputElement).value))"
              class="flex-1 accent-cyan-400 disabled:opacity-40"
            />
            <span class="w-12 text-right text-xs font-mono tabular-nums">{{ bgmVol }}%</span>
          </div>
        </div>
      </div>
    </div>

    <!-- ── 클라우드 동기화 ── -->
    <div class="rounded-lg border border-sky-400/40 bg-bg-secondary/70 backdrop-blur-sm overflow-hidden">
      <div class="px-3 py-1.5 bg-sky-950/30 border-b border-sky-500/20 flex items-center">
        <span class="text-xs font-bold text-sky-200">☁ 클라우드 저장</span>
      </div>
      <div class="p-3">
        <div v-if="auth.isLoggedIn" class="flex items-center gap-2.5">
          <img
            v-if="auth.photoURL"
            :src="auth.photoURL"
            alt="avatar"
            class="w-10 h-10 rounded-full border-2 border-sky-400/40"
          />
          <div class="flex-1 min-w-0">
            <div class="text-xs text-sky-300/80 font-bold">활성</div>
            <div class="text-sm font-bold truncate">{{ auth.displayName ?? '로그인됨' }}</div>
          </div>
          <button
            class="text-xs px-3 min-h-9 rounded-md bg-slate-700 hover:bg-slate-600 font-bold"
            :disabled="auth.loading"
            @click="auth.logout"
          >로그아웃</button>
        </div>
        <div v-else class="text-sm">
          로그인하지 않음. 메인 메뉴의 <span class="text-sky-300 font-bold">Google 로 로그인</span>으로 활성화하면 클리어 횟수가 클라우드와 동기화됩니다.
        </div>
      </div>
    </div>

    <!-- ── 기타 ── -->
    <div class="rounded-lg border border-slate-600/40 bg-bg-secondary/70 backdrop-blur-sm overflow-hidden">
      <div class="px-3 py-1.5 bg-slate-900/40 border-b border-slate-700/40 flex items-center">
        <span class="text-xs font-bold">기타</span>
      </div>
      <div class="p-3 space-y-2">
        <button
          class="w-full min-h-11 rounded-md bg-bg-tertiary hover:bg-bg-hover border border-slate-700/60 font-bold text-sm active:scale-[0.99] transition px-3 text-left"
          @click="replayIntro"
        >인트로 만화 다시보기</button>
        <button
          class="w-full min-h-11 rounded-md bg-bg-tertiary hover:bg-bg-hover border border-slate-700/60 font-bold text-sm active:scale-[0.99] transition px-3 text-left"
          @click="replayTutorial"
        >튜토리얼 다시 보기</button>
      </div>
    </div>

    <!-- ── 데이터 리셋 (작은 푸터 링크 — 실수 클릭 방지) ── -->
    <div class="pt-2 text-center">
      <button
        class="text-xs text-gray-500 hover:text-status-burn underline-offset-2 hover:underline px-3 py-2"
        @click="resetAll"
      >모든 데이터 리셋</button>
    </div>
  </section>
</template>
