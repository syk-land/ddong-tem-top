<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useGameStore } from '@/stores/game'
import { useAuthStore } from '@/stores/auth'
import { mainImageUrl, playerImageUrl } from '@/ui/images'
import { loadRun } from '@/core/meta'
import { deleteCloudUserData } from '@/lib/cloudSync'
import {
  detectInAppBrowser,
  inAppBrowserName,
  canOpenExternal,
  openInExternalBrowser,
  copyUrlToClipboard,
} from '@/lib/inAppBrowser'
import { themeColorClass } from '@/ui/colors'
import HpMpBar from '@/ui/components/HpMpBar.vue'
import type { TowerRun } from '@/types'
import { REAL_BOSS_ORDER } from '@/core/realboss'
import { CHAPTER_THEMES } from '@/data/chapters'

const game = useGameStore()
const auth = useAuthStore()
const bgUrl = mainImageUrl()

// 가장 최근에 처치한 진짜 보스 이름 — 미클리어 시 '???'.
//   클리어 순서는 REAL_BOSS_ORDER[i], 표시는 hardBoss 이름(없으면 boss).
const latestRealBossName = computed<string>(() => {
  const n = game.meta.realBossClearCount ?? 0
  if (n <= 0) return '???'
  const theme = REAL_BOSS_ORDER[(n - 1) % REAL_BOSS_ORDER.length]
  const def = CHAPTER_THEMES[theme]
  return def?.hardBoss?.name ?? def?.boss?.name ?? '???'
})

// 도감 12칸 — 각 슬롯의 자산/잠금 규칙은 여기서 통째로 관리.
//   카드 1, 2: 항상 공개 (튜토리얼/인트로 컷).
//   카드 3~12: 진짜 보스 1~10. 카드 (N+2) 공개 조건 = realBossClearCount >= N.
//   썸네일은 보스 죽는 컷(N-2), 클릭 모달엔 [살아있음 N-1, 죽음 N-2] 페어를 좌우 네비.
type CodexSlot = {
  unlocked: boolean
  label: string
  thumb: string
  images: string[]
}
const COMIC_BASE = '/images/COMIC'
const TUTORIAL_BASE = '/images/TUTORIAL'

const codexSlots = computed<CodexSlot[]>(() => {
  const n = game.meta.realBossClearCount ?? 0
  const slots: CodexSlot[] = []

  // 1) 시작 컷 — 항상 공개. 진짜 보스 1회 이상 클리어 시 인트로 3번까지 묶음.
  const introImages = [`${TUTORIAL_BASE}/1.webp`, `${TUTORIAL_BASE}/2.webp`]
  if (n >= 1) introImages.push(`${TUTORIAL_BASE}/3.webp`)
  slots.push({
    unlocked: true,
    label: '시작',
    thumb: `${TUTORIAL_BASE}/1.webp`,
    images: introImages,
  })
  // 2~12) 진짜 보스 1~11 — REAL_BOSS_ORDER[0..10] 전체.
  for (let i = 0; i < REAL_BOSS_ORDER.length; i++) {
    const bossNo = i + 1
    const theme = REAL_BOSS_ORDER[i]
    const def = CHAPTER_THEMES[theme]
    const name = def?.hardBoss?.name ?? def?.boss?.name ?? '???'
    const unlocked = n >= bossNo
    slots.push({
      unlocked,
      label: unlocked ? name : '???',
      thumb: `${COMIC_BASE}/${bossNo}-2.webp`,
      images: [`${COMIC_BASE}/${bossNo}-1.webp`, `${COMIC_BASE}/${bossNo}-2.webp`],
    })
  }
  return slots
})

// ── 도감 모달 (썸네일 클릭 시) ──
const codexModalOpen = ref(false)
const codexModalImages = ref<string[]>([])
const codexModalIndex = ref(0)
const codexModalLabel = ref('')

function openCodex(slot: CodexSlot) {
  if (!slot.unlocked) return
  codexModalImages.value = slot.images
  codexModalIndex.value = 0
  codexModalLabel.value = slot.label
  codexModalOpen.value = true
}
function closeCodex() {
  codexModalOpen.value = false
}
function prevCodex() {
  if (codexModalIndex.value > 0) codexModalIndex.value--
}
function nextCodex() {
  if (codexModalIndex.value < codexModalImages.value.length - 1) codexModalIndex.value++
}

// 저장된 진행 미리보기 (이어하기 카드용)
const savedRun = ref<TowerRun | null>(null)
function refreshSavedPreview() {
  savedRun.value = loadRun()
}

const savedAvatarKey = computed(() => (savedRun.value as any)?.avatarKey ?? null)
const savedChapter = computed(() => {
  const r = savedRun.value
  if (!r) return null
  return r.chapters[r.currentChapterIndex] ?? null
})

// 인앱 브라우저 감지 — Google OAuth 가 막히므로 외부 브라우저로 유도해야 한다.
const inAppBrowser = computed(() => detectInAppBrowser())

async function loginGoogle() {
  const kind = inAppBrowser.value
  if (kind) {
    const name = inAppBrowserName(kind)
    if (canOpenExternal(kind)) {
      const ok = await game.confirmModal(
        `${name} 인앱 브라우저에서는 Google 로그인이 지원되지 않습니다.\n외부 브라우저(Chrome/Safari)로 열어주세요.`,
        { title: '외부 브라우저 필요', okLabel: '외부 브라우저로 열기', cancelLabel: '취소' },
      )
      if (ok) openInExternalBrowser(kind)
    } else {
      const ok = await game.confirmModal(
        `${name} 인앱 브라우저에서는 Google 로그인이 지원되지 않습니다.\nURL 을 복사해 Chrome/Safari 같은 외부 브라우저에서 붙여넣어 열어주세요.`,
        { title: '외부 브라우저 필요', okLabel: 'URL 복사', cancelLabel: '취소' },
      )
      if (ok) {
        const copied = await copyUrlToClipboard()
        await game.confirmModal(
          copied ? 'URL 이 복사됐어요. 외부 브라우저에 붙여넣어 열어주세요.' : `URL 복사에 실패했어요. 주소창에서 직접 복사해 주세요:\n${window.location.href}`,
          { title: copied ? '복사 완료' : 'URL', okLabel: '확인' },
        )
      }
    }
    return
  }
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
  refreshSavedPreview()
  // 도전 카운터 도달이면 도전 화면으로 자동 전환
  game.triggerRealBossIfDue()
  // 인트로 만화 종료 직후 — 첫 사용자에게 새 캐릭터 버튼 안내
  //   triggerTutorial 내부에서 introVisible/이미 본 단계는 무시되므로
  //   인트로 만화가 떠 있는 동안은 발화 안 됨 (만화 닫힌 직후 노출)
  if (!game.introVisible) {
    game.triggerTutorial('menu_start')
  }
})

function startNew() {
  if (game.triggerRealBossIfDue()) return
  game.startCharacterCreation()
}
function loadGameClick() {
  game.loadGame()
}
async function resetMeta() {
  const ok = await game.confirmModal(
    '정말 모든 누적 보너스와 진행을 리셋할까요?\n사운드·속도·자동진입 등 설정도 모두 초기화됩니다.\n로그인 상태라면 클라우드 데이터(누적 보너스·리더보드)도 함께 삭제됩니다.',
    {
      title: '데이터 리셋',
      danger: true,
      okLabel: '리셋',
    },
  )
  if (!ok) return
  // 로그인 상태면 Firestore 사용자 문서 (meta + leaderboard) 삭제 — 안 하면
  // reload 후 auth listener 가 cloud meta 를 다시 받아와 클라우드 값으로 덮어씀.
  // 보류 중인 sync 타이머는 먼저 취소 (delete 직후 발화하면 cloud 가 다시 살아남).
  if (auth.uid) {
    auth.cancelPendingSync()
    await deleteCloudUserData(auth.uid)
  }
  // climetop: 프리픽스 가진 모든 키 일괄 삭제 —
  // 메타/진행/튜토리얼/생성/사운드/속도/자동진입/SpeedControl 펼침 상태 등 전부.
  // 새 키가 추가돼도 동기화 없이 항상 전체 리셋된다.
  try {
    const toRemove: string[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (k && k.startsWith('climetop:')) toRemove.push(k)
    }
    for (const k of toRemove) localStorage.removeItem(k)
  } catch {}
  location.reload()
}
</script>

<template>
  <section
    class="flex-1 flex items-center justify-center px-4 py-6 bg-cover bg-center"
    :style="{ backgroundImage: `linear-gradient(rgba(10,14,26,0.65), rgba(10,14,26,0.85)), url(${bgUrl})` }"
  >
    <div class="max-w-md w-full space-y-3">
      <!-- ── 상단: 통계 칩 + 설정 버튼 ── -->
      <div class="flex items-stretch gap-2">
        <div class="flex-1 grid grid-cols-3 gap-2">
          <div class="rounded-lg border border-amber-400/40 bg-amber-950/30 backdrop-blur-sm px-2 py-2">
            <div class="text-xs text-amber-300 font-bold">🏆 클리어</div>
            <div class="text-lg font-mono font-bold text-log-reward tabular-nums leading-tight">{{ game.meta.clearCount }}<span class="text-xs text-gray-400 ml-1">회</span></div>
          </div>
          <div class="rounded-lg border border-emerald-400/40 bg-emerald-950/30 backdrop-blur-sm px-2 py-2">
            <div class="text-xs text-emerald-300 font-bold">⛰ 등반</div>
            <div class="text-lg font-mono font-bold text-emerald-200 tabular-nums leading-tight">{{ game.meta.climbCount ?? 0 }}<span class="text-xs text-gray-400 ml-1">회</span></div>
          </div>
          <div class="rounded-lg border border-cyan-400/40 bg-cyan-950/30 backdrop-blur-sm px-2 py-2">
            <div class="text-xs text-cyan-300 font-bold">💀 찐보스</div>
            <div class="text-sm font-bold text-log-skill leading-tight truncate" :title="latestRealBossName">{{ latestRealBossName }}</div>
          </div>
        </div>
        <button
          class="shrink-0 w-12 rounded-lg border border-slate-600/60 bg-bg-secondary/70 hover:bg-bg-hover backdrop-blur-sm flex items-center justify-center transition active:scale-95"
          title="설정"
          @click="game.setScreen('settings')"
        >
          <span class="text-xl leading-none">⚙</span>
        </button>
      </div>

      <!-- ── 헤더 (제목) ── -->
      <div class="rounded-xl border-2 border-amber-400/30 bg-bg-secondary/80 backdrop-blur-sm p-4 space-y-1 text-center shadow-[0_0_24px_rgba(251,191,36,0.15)]">
        <h1 class="text-2xl font-bold leading-tight">
          <span class="text-trait-special">이번 판은</span>
          <span class="text-grade-legend"> 똥템</span>
          <span class="text-trait-special">으로</span>
          <br />
          <span class="text-log-reward">탑을 오르겠습니다</span>
        </h1>
      </div>

      <!-- ── 진짜 보스 도감 (4×3 = 12칸, 9:15 세로 비율) ── -->
      <div class="grid grid-cols-4 gap-2">
        <button
          v-for="(slot, i) in codexSlots"
          :key="i"
          type="button"
          :disabled="!slot.unlocked"
          class="relative aspect-[9/15] rounded-lg border overflow-hidden flex items-center justify-center text-center transition"
          :class="slot.unlocked
            ? 'border-amber-400/50 bg-bg-secondary/80 hover:border-amber-400 active:scale-95 shadow-[0_0_8px_rgba(251,191,36,0.15)]'
            : 'border-slate-700/60 bg-black cursor-not-allowed'"
          @click="openCodex(slot)"
        >
          <img
            v-if="slot.unlocked"
            :src="slot.thumb"
            :alt="slot.label"
            class="w-full h-full object-cover"
            @error="(e) => ((e.target as HTMLImageElement).style.display = 'none')"
          />
          <span
            v-if="slot.unlocked"
            class="absolute inset-x-0 bottom-0 bg-black/65 text-[10px] font-bold text-amber-200 truncate px-1 py-0.5"
          >{{ slot.label }}</span>
          <span
            v-else
            class="text-xs font-mono text-gray-500"
          >???</span>
        </button>
      </div>

      <!-- ── 도감 모달 (썸네일 클릭) ── -->
      <div
        v-if="codexModalOpen"
        class="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
        @click="closeCodex"
      >
        <div class="relative w-full max-w-md" @click.stop>
          <button
            class="absolute -top-10 right-0 text-white/80 hover:text-white text-3xl leading-none px-2"
            aria-label="닫기"
            @click="closeCodex"
          >✕</button>
          <div class="text-center mb-2 text-amber-300 font-bold text-sm">{{ codexModalLabel }}</div>
          <div class="relative">
            <img
              :src="codexModalImages[codexModalIndex]"
              :alt="codexModalLabel"
              class="w-full rounded-lg shadow-lg"
            />
            <button
              v-if="codexModalIndex > 0"
              class="absolute left-2 top-1/2 -translate-y-1/2 bg-black/60 hover:bg-black/85 text-white text-3xl rounded-full w-12 h-12 flex items-center justify-center leading-none"
              aria-label="이전"
              @click="prevCodex"
            >‹</button>
            <button
              v-if="codexModalIndex < codexModalImages.length - 1"
              class="absolute right-2 top-1/2 -translate-y-1/2 bg-black/60 hover:bg-black/85 text-white text-3xl rounded-full w-12 h-12 flex items-center justify-center leading-none"
              aria-label="다음"
              @click="nextCodex"
            >›</button>
          </div>
          <div
            v-if="codexModalImages.length > 1"
            class="mt-2 text-center text-xs text-gray-400 font-mono tabular-nums"
          >{{ codexModalIndex + 1 }} / {{ codexModalImages.length }}</div>
        </div>
      </div>

      <!-- ── 이어하기 카드 (진행 미리보기 포함) ── -->
      <button
        v-if="game.hasSavedRun && savedRun && savedChapter"
        type="button"
        class="w-full rounded-xl border-2 border-emerald-400/50 bg-bg-secondary/80 backdrop-blur-sm p-3 text-left hover:border-emerald-400/80 active:scale-[0.99] transition shadow-[0_0_20px_rgba(52,211,153,0.20)]"
        @click="loadGameClick"
      >
        <div class="flex items-center gap-3">
          <img
            v-if="savedAvatarKey"
            :src="playerImageUrl(savedAvatarKey)"
            :alt="game.characterName(savedAvatarKey)"
            class="w-14 h-14 rounded-full object-cover border-2 border-emerald-400/60 shrink-0"
            @error="(e) => ((e.target as HTMLImageElement).style.display = 'none')"
          />
          <div class="flex-1 min-w-0">
            <div class="flex items-baseline gap-2 mb-1">
              <span class="text-xs font-bold text-emerald-300">▶ 이어하기</span>
              <span class="text-xs text-gray-400 truncate">{{ savedAvatarKey ? game.characterName(savedAvatarKey) : '모험가' }}</span>
            </div>
            <div :class="['text-sm font-bold truncate', themeColorClass[savedChapter.theme]]">
              제 {{ savedChapter.chapter }}챕터 · {{ savedChapter.themeName }}
              <span class="text-gray-400 font-normal">· <span class="font-mono tabular-nums">{{ savedChapter.currentFloor + 1 }}</span>층</span>
            </div>
            <div class="mt-1.5 space-y-1">
              <HpMpBar :current="savedRun.character.hp" :max="savedRun.character.maxHp" kind="hp" />
              <HpMpBar :current="savedRun.character.mp" :max="savedRun.character.maxMp" kind="mp" />
            </div>
          </div>
        </div>
      </button>

      <!-- ── 새 캐릭터 시작 ── -->
      <button
        data-tutorial-target="new-character-btn"
        data-tutorial-cta-label="새 캐릭터 시작"
        class="btn-primary w-full min-h-12 text-base font-bold"
        @click="startNew"
      >새 캐릭터 시작 <span class="opacity-80 text-sm font-normal ml-1">(3챌린지 선택)</span></button>

      <!-- ── Google 로그인 / 로그아웃 ── -->
      <div
        v-if="auth.isLoggedIn"
        class="rounded-lg border border-slate-600/60 bg-white/95 px-3 py-2.5 flex items-center gap-2.5"
      >
        <img
          v-if="auth.photoURL"
          :src="auth.photoURL"
          alt="avatar"
          class="w-10 h-10 rounded-full border-2 border-slate-300"
        />
        <div class="flex-1 min-w-0">
          <div class="text-xs text-gray-500 font-bold">☁ 클라우드 저장 활성</div>
          <div class="text-sm font-bold text-gray-900 truncate">{{ auth.displayName ?? '로그인됨' }}</div>
        </div>
        <button
          class="text-xs px-3 min-h-9 rounded-md bg-slate-200 text-gray-700 hover:bg-slate-300 font-bold border border-slate-300"
          :disabled="auth.loading"
          @click="logoutGoogle"
        >로그아웃</button>
      </div>
      <button
        v-else
        class="w-full rounded-lg border-2 border-slate-300/80 bg-white text-gray-800 min-h-12 px-4 font-bold text-sm hover:bg-slate-50 active:scale-[0.99] transition disabled:opacity-60 flex items-center justify-center gap-2.5 shadow"
        :disabled="auth.loading"
        @click="loginGoogle"
      >
        <!-- Google G 로고 (인라인 SVG) -->
        <svg viewBox="0 0 48 48" class="w-5 h-5" aria-hidden="true">
          <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/>
          <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 16 19 13 24 13c3.1 0 5.8 1.2 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4c-7.7 0-14.4 4.4-17.7 10.7z"/>
          <path fill="#4CAF50" d="M24 44c5.3 0 10-2 13.5-5.4l-6.3-5.3C29.3 35 26.8 36 24 36c-5.3 0-9.7-3.3-11.3-8l-6.5 5C9.5 39.5 16.2 44 24 44z"/>
          <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.3-4.2 5.6l6.3 5.3c4.5-4.1 7.1-10.2 7.1-17 0-1.3-.1-2.4-.4-3.5z"/>
        </svg>
        <span>{{ auth.loading ? '로그인 중...' : 'Google 로 로그인' }}</span>
        <span v-if="!auth.loading" class="text-xs text-gray-500 font-normal">· 클라우드 저장</span>
      </button>
      <!-- 인앱 브라우저 (카카오톡/네이버/페북 등) 안내 — Google OAuth 가 막히므로 미리 알려준다. -->
      <p
        v-if="!auth.isLoggedIn && inAppBrowser"
        class="text-[11px] text-amber-300/90 bg-amber-950/40 border border-amber-500/40 rounded-md px-2.5 py-1.5 leading-snug"
      >
        ⚠ {{ inAppBrowserName(inAppBrowser) }} 인앱 브라우저에서는 Google 로그인이 막힙니다.<br />
        버튼을 누르면 외부 브라우저(Chrome/Safari)로 여는 방법을 안내해요.
      </p>

      <!-- ── 데이터 리셋 (작은 푸터 링크) ── -->
      <div class="pt-1 text-center">
        <button
          class="text-xs text-gray-500 hover:text-status-burn underline-offset-2 hover:underline px-3 py-2"
          @click="resetMeta"
        >데이터 리셋</button>
      </div>
    </div>
  </section>
</template>
