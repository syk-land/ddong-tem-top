<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useI18n } from '@/lib/i18n'
import type { LeaderboardEntry } from '@/lib/cloudSync'
import { rankColorClass } from '@/ui/colors'

function decodeTierSum(bestScore: number): number {
  if (!Number.isFinite(bestScore) || bestScore < 100) {
    return Math.max(2, Math.min(32, Math.round(bestScore || 32)))
  }
  return Math.max(2, Math.min(32, 34 - Math.floor(bestScore / 100)))
}

const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{
  (e: 'close'): void
  (e: 'request-login'): void
}>()

const auth = useAuthStore()
const { t } = useI18n()

const dialogEl = ref<HTMLDialogElement | null>(null)
const loading = ref(false)
const errorMsg = ref<string | null>(null)
const entries = ref<LeaderboardEntry[]>([])

const nickInput = ref('')
const nickSaving = ref(false)
const nickStatus = ref<string | null>(null)

async function loadEntries() {
  if (!auth.isLoggedIn) {
    entries.value = []
    return
  }
  loading.value = true
  errorMsg.value = null
  try {
    const { fetchTopLeaderboard } = await import('@/lib/cloudSync')
    entries.value = await fetchTopLeaderboard(50)
  } catch (e: unknown) {
    errorMsg.value = e instanceof Error ? e.message : String(e)
  } finally {
    loading.value = false
  }
}

async function saveNickname() {
  if (!auth.isLoggedIn || nickSaving.value) return
  nickSaving.value = true
  nickStatus.value = null
  try {
    const saved = await auth.updateNickname(nickInput.value)
    nickInput.value = saved
    nickStatus.value = t('leaderboard.nickSaved', '저장됨')
    await loadEntries()
  } catch (e: unknown) {
    nickStatus.value = e instanceof Error ? e.message : String(e)
  } finally {
    nickSaving.value = false
  }
}

function openModal() {
  const el = dialogEl.value
  if (el && !el.open) {
    el.showModal()
  }
  nickInput.value = auth.effectiveNickname
  nickStatus.value = null
  loadEntries()
}

function closeModal() {
  const el = dialogEl.value
  if (el && el.open) el.close()
  emit('close')
}

function onDialogClose() {
  if (dialogEl.value) dialogEl.value.returnValue = ''
  if (props.open) emit('close')
}

watch(() => props.open, (v) => {
  if (v) openModal()
  else if (dialogEl.value?.open) dialogEl.value.close()
})

// closedby="any" 미지원 브라우저(Safari 등)용 라이트 디스미스 폴백
let pressedOutside = false
function isOutside(e: PointerEvent, dialog: HTMLDialogElement): boolean {
  const r = dialog.getBoundingClientRect()
  return e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom
}
function onPointerDown(e: PointerEvent) {
  const el = dialogEl.value
  if (!el || 'closedBy' in HTMLDialogElement.prototype) return
  pressedOutside = e.target === el && isOutside(e, el)
}
function onPointerUp(e: PointerEvent) {
  const el = dialogEl.value
  if (!el || 'closedBy' in HTMLDialogElement.prototype) return
  if (pressedOutside && e.target === el && isOutside(e, el)) {
    closeModal()
  }
  pressedOutside = false
}

onMounted(() => {
  const el = dialogEl.value
  if (el) {
    el.addEventListener('pointerdown', onPointerDown)
    el.addEventListener('pointerup', onPointerUp)
  }
  if (props.open) openModal()
})
onUnmounted(() => {
  const el = dialogEl.value
  if (el) {
    el.removeEventListener('pointerdown', onPointerDown)
    el.removeEventListener('pointerup', onPointerUp)
  }
})
</script>

<template>
  <dialog
    ref="dialogEl"
    aria-labelledby="leaderboard-modal-title"
    v-bind="{ closedby: 'any' } as any"
    @close="onDialogClose"
    class="w-[min(94vw,30rem)]"
  >
    <div class="rounded-xl border-2 border-amber-400/60 bg-bg-secondary text-gray-100 shadow-[0_0_32px_rgba(251,191,36,0.28)] overflow-hidden flex flex-col max-h-[86dvh]">
      <div class="px-4 py-3 bg-amber-950/40 border-b border-amber-500/30 flex items-center justify-between gap-2">
        <div>
          <h1 id="leaderboard-modal-title" class="text-base font-bold text-amber-200">
            [RANK] {{ t('leaderboard.title', '똥템 명예의 전당 (Top 50)') }}
          </h1>
          <p class="text-[11px] text-amber-200/70">
            {{ t('leaderboard.subtitle', '낮은 장비 티어(EX)로 클리어할수록 높은 순위') }}
          </p>
        </div>
        <button
          type="button"
          class="w-8 h-8 rounded-md bg-slate-800/80 hover:bg-slate-700 text-gray-300 flex items-center justify-center text-base"
          :aria-label="t('common.close', '닫기')"
          @click="closeModal"
        >✕</button>
      </div>

      <div class="p-3 space-y-3 overflow-y-auto">
        <div v-if="!auth.isLoggedIn" class="rounded-lg border border-sky-400/40 bg-sky-950/30 p-4 text-center space-y-3">
          <p class="text-sm text-gray-200 leading-relaxed">
            {{ t('leaderboard.loginRequired', 'Google 로그인 후 전 세계 플레이어의 똥템 클리어 랭킹을 확인하고 내 기록을 등록할 수 있습니다.') }}
          </p>
          <button
            type="button"
            class="btn-primary w-full min-h-10 text-sm font-bold"
            @click="() => { closeModal(); emit('request-login') }"
          >{{ t('menu.cloud.googleLogin', 'Google 로 로그인') }}</button>
        </div>

        <template v-else>
          <!-- 닉네임 수정 바 -->
          <form class="flex items-center gap-1.5" @submit.prevent="saveNickname">
            <label for="lb-nick-input" class="sr-only">{{ t('leaderboard.nickLabel', '닉네임') }}</label>
            <input
              id="lb-nick-input"
              v-model="nickInput"
              type="text"
              maxlength="12"
              :placeholder="t('leaderboard.nickPlaceholder', '닉네임 (최대 12자)')"
              class="flex-1 min-w-0 rounded-md bg-bg-tertiary border border-slate-600 px-2.5 py-1.5 text-xs text-gray-100 focus:outline-none focus:border-amber-400"
            />
            <button
              type="submit"
              :disabled="nickSaving"
              class="px-3 py-1.5 rounded-md bg-amber-600/30 hover:bg-amber-600/50 border border-amber-400/50 text-amber-200 text-xs font-bold shrink-0"
            >{{ nickSaving ? '...' : t('leaderboard.nickSave', '닉네임 변경') }}</button>
            <button
              type="button"
              :disabled="loading"
              class="px-2.5 py-1.5 rounded-md bg-slate-800 hover:bg-slate-700 border border-slate-600 text-xs text-gray-200 shrink-0"
              @click="loadEntries"
            >{{ t('leaderboard.refresh', '새로고침') }}</button>
          </form>
          <div v-if="nickStatus" class="text-[11px] text-emerald-300">{{ nickStatus }}</div>

          <div v-if="loading" class="text-center py-8 text-xs text-gray-400">
            {{ t('leaderboard.loading', '랭킹 불러오는 중...') }}
          </div>
          <div v-else-if="errorMsg" class="text-center py-6 text-xs text-rose-300">
            {{ errorMsg }}
          </div>
          <div v-else-if="entries.length === 0" class="text-center py-8 text-xs text-gray-400">
            {{ t('leaderboard.empty', '아직 등록된 클리어 기록이 없습니다. 첫 100층 클리어의 주인공이 되어보세요!') }}
          </div>

          <div
            v-else
            tabindex="0"
            role="region"
            aria-labelledby="leaderboard-table-caption"
            class="leaderboard-table-wrap rounded-lg border border-slate-700/70 bg-bg-primary/70"
          >
            <table class="w-full text-xs text-left border-collapse">
              <caption id="leaderboard-table-caption" class="sr-only">
                {{ t('leaderboard.title', '똥템 명예의 전당 (Top 50)') }}
              </caption>
              <thead class="bg-slate-900 text-gray-300 border-b border-slate-700">
                <tr>
                  <th scope="col" class="px-2.5 py-2 font-bold">#</th>
                  <th scope="col" class="px-2.5 py-2 font-bold">{{ t('leaderboard.colPlayer', '플레이어') }}</th>
                  <th scope="col" class="px-2 py-2 font-bold text-center">{{ t('leaderboard.colRank', '등급') }}</th>
                  <th scope="col" class="px-2 py-2 font-bold text-right">{{ t('leaderboard.colTier', '장비 티어') }}</th>
                  <th scope="col" class="px-2.5 py-2 font-bold text-right">{{ t('leaderboard.colClears', '클리어') }}</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-800/80">
                <tr
                  v-for="(row, idx) in entries"
                  :key="row.uid"
                  :class="row.uid === auth.uid ? 'bg-amber-950/35 text-amber-100' : 'hover:bg-slate-800/40'"
                >
                  <th scope="row" class="px-2.5 py-2 font-mono font-bold text-gray-300 whitespace-nowrap">
                    {{ idx + 1 }}
                  </th>
                  <td class="px-2.5 py-2 font-medium truncate max-w-[9rem]">
                    {{ row.nickname || '익명' }}
                    <span v-if="row.uid === auth.uid" class="ml-1 text-[10px] text-amber-300 font-bold">(YOU)</span>
                  </td>
                  <td class="px-2 py-2 text-center font-bold">
                    <span :class="rankColorClass[row.bestRank] ?? 'text-gray-200'">{{ row.bestRank }}</span>
                  </td>
                  <td class="px-2 py-2 text-right font-mono tabular-nums text-cyan-200">
                    T{{ decodeTierSum(row.bestScore) }}
                  </td>
                  <td class="px-2.5 py-2 text-right font-mono tabular-nums text-gray-300">
                    {{ row.clearCount }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </template>
      </div>

      <div class="px-4 py-2.5 bg-bg-tertiary/70 border-t border-slate-700/60 flex justify-end">
        <button type="button" class="btn-secondary text-xs min-h-9 px-4" @click="closeModal">
          {{ t('common.close', '닫기') }}
        </button>
      </div>
    </div>
  </dialog>
</template>

<style scoped>
.leaderboard-table-wrap {
  overflow: auto;
  max-inline-size: 100%;
  max-block-size: min(400px, 55dvh);
  container-type: inline-size;
}
.leaderboard-table-wrap thead {
  position: sticky;
  inset-block-start: 0;
  z-index: 1;
}
</style>
