<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useGameStore } from '@/stores/game'
import { useI18n } from '@/lib/i18n'
import { CHALLENGES } from '@/data/challenges'

const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{ (e: 'close'): void }>()

const game = useGameStore()
const { t, td } = useI18n()

const dialogEl = ref<HTMLDialogElement | null>(null)
const activeTab = ref<'all' | 'done' | 'todo'>('all')

const completedSet = computed(() => new Set(game.meta.completedChallenges ?? []))
const completedCount = computed(() => completedSet.value.size)

const filteredList = computed(() => {
  if (activeTab.value === 'done') return CHALLENGES.filter((c) => completedSet.value.has(c.key))
  if (activeTab.value === 'todo') return CHALLENGES.filter((c) => !completedSet.value.has(c.key))
  return CHALLENGES
})

const milestones = [
  { count: 5, ko: '시작 골드 +50G', en: 'Start Gold +50G' },
  { count: 15, ko: '상점 새로고침 상한 +1', en: 'Shop Refresh Cap +1' },
  { count: 25, ko: '시작 전스탯 +2 (+10pt)', en: 'All Start Stats +2 (+10pt)' },
  { count: 40, ko: '허점 기믹 위력 +15%', en: 'Loophole Power +15%' },
]

function openModal() {
  const el = dialogEl.value
  if (el && !el.open) el.showModal()
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
  if (pressedOutside && e.target === el && isOutside(e, el)) closeModal()
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
    aria-labelledby="challenge-codex-title"
    v-bind="{ closedby: 'any' } as any"
    @close="onDialogClose"
    class="w-[min(94vw,30rem)]"
  >
    <div class="rounded-xl border-2 border-pink-400/60 bg-bg-secondary text-gray-100 shadow-[0_0_32px_rgba(244,114,182,0.25)] overflow-hidden flex flex-col max-h-[86dvh]">
      <div class="px-4 py-3 bg-pink-950/40 border-b border-pink-500/30 flex items-center justify-between gap-2">
        <div>
          <h1 id="challenge-codex-title" class="text-base font-bold text-pink-200">
            [CHALLENGE] {{ t('codex.challenge.title', '40종 챌린지 정복 도감') }}
          </h1>
          <p class="text-[11px] text-pink-200/70 font-mono">
            {{ completedCount }} / {{ CHALLENGES.length }} {{ t('codex.challenge.clearedLabel', '정복 완료') }}
          </p>
        </div>
        <button
          type="button"
          class="w-8 h-8 rounded-md bg-slate-800/80 hover:bg-slate-700 text-gray-300 flex items-center justify-center text-base"
          :aria-label="t('common.close', '닫기')"
          @click="closeModal"
        >✕</button>
      </div>

      <!-- 마스터리 마일스톤 바 -->
      <div class="px-3 py-2 bg-bg-tertiary/70 border-b border-slate-700/60 grid grid-cols-2 gap-1.5">
        <div
          v-for="ms in milestones"
          :key="ms.count"
          class="rounded px-2 py-1 text-[11px] border flex items-center justify-between gap-1"
          :class="completedCount >= ms.count
            ? 'border-emerald-400/60 bg-emerald-950/35 text-emerald-200 font-bold'
            : 'border-slate-700/60 bg-slate-900/50 text-gray-400'"
        >
          <span>{{ ms.count }}</span>
          <span class="truncate">{{ t(`codex.ms.${ms.count}`, ms.ko) }}</span>
        </div>
      </div>

      <!-- 접근성 탭 -->
      <div
        role="tablist"
        :aria-label="t('codex.challenge.tablistLabel', '챌린지 필터')"
        class="mwg-tablist border-b border-slate-700 bg-bg-tertiary/50 px-2"
      >
        <button
          type="button"
          role="tab"
          id="tab-chal-all"
          :aria-selected="activeTab === 'all'"
          class="mwg-tab px-3 py-2.5 text-xs font-bold transition-colors"
          :class="activeTab === 'all' ? 'text-pink-300' : 'text-gray-400 hover:text-gray-200'"
          @click="activeTab = 'all'"
        >{{ t('codex.challenge.tabAll', `전체 (${CHALLENGES.length})`, { total: CHALLENGES.length }) }}</button>
        <button
          type="button"
          role="tab"
          id="tab-chal-done"
          :aria-selected="activeTab === 'done'"
          class="mwg-tab px-3 py-2.5 text-xs font-bold transition-colors"
          :class="activeTab === 'done' ? 'text-emerald-300' : 'text-gray-400 hover:text-gray-200'"
          @click="activeTab = 'done'"
        >{{ t('codex.challenge.tabDone', `달성 (${completedCount})`, { n: completedCount }) }}</button>
        <button
          type="button"
          role="tab"
          id="tab-chal-todo"
          :aria-selected="activeTab === 'todo'"
          class="mwg-tab px-3 py-2.5 text-xs font-bold transition-colors"
          :class="activeTab === 'todo' ? 'text-amber-300' : 'text-gray-400 hover:text-gray-200'"
          @click="activeTab = 'todo'"
        >{{ t('codex.challenge.tabTodo', `미달성 (${CHALLENGES.length - completedCount})`, { n: CHALLENGES.length - completedCount }) }}</button>
      </div>

      <div class="overflow-y-auto flex-1">
        <div
          role="tabpanel"
          :aria-labelledby="activeTab === 'all' ? 'tab-chal-all' : activeTab === 'done' ? 'tab-chal-done' : 'tab-chal-todo'"
          tabindex="0"
        >
          <div class="p-3 space-y-2">
            <div v-if="filteredList.length === 0" class="text-center py-6 text-xs text-gray-400">
              {{ t('codex.challenge.empty', '해당 목록이 비어 있습니다.') }}
            </div>
            <div
              v-for="ch in filteredList"
              :key="ch.key"
              class="rounded-lg border p-2.5 space-y-1"
              :class="completedSet.has(ch.key)
                ? 'border-emerald-400/50 bg-emerald-950/20'
                : 'border-slate-700/70 bg-bg-tertiary/60'"
            >
              <div class="flex items-center justify-between gap-2">
                <span class="text-xs font-bold" :class="completedSet.has(ch.key) ? 'text-emerald-200' : 'text-gray-200'">
                  {{ t(`challenge.${ch.key}`, ch.name) }}
                </span>
                <span class="text-[10px] px-1.5 py-0.5 rounded font-bold"
                  :class="completedSet.has(ch.key) ? 'bg-emerald-900/70 text-emerald-200' : 'bg-slate-800 text-gray-400'"
                >
                  {{ completedSet.has(ch.key) ? t('codex.challenge.clearedTag', 'CLEARED') : td('challenge.group', ch.group) }}
                </span>
              </div>
              <p class="text-[11px] text-gray-300 leading-snug">{{ t(`challenge.desc.${ch.key}`, ch.description) }}</p>
              <div class="text-[11px] text-log-reward">+ {{ t(`challenge.reward.${ch.key}`, ch.reward) }}</div>
              <div class="text-[11px] text-status-burn">- {{ t(`challenge.penalty.${ch.key}`, ch.penalty) }}</div>
            </div>
          </div>
        </div>
      </div>

      <div class="px-4 py-2.5 bg-bg-tertiary/70 border-t border-slate-700/60 flex justify-end">
        <button type="button" class="btn-secondary text-xs min-h-9 px-4" @click="closeModal">
          {{ t('common.close', '닫기') }}
        </button>
      </div>
    </div>
  </dialog>
</template>
