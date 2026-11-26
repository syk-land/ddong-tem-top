<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useGameStore } from '@/stores/game'
import { useI18n } from '@/lib/i18n'
import { QUIRK_INFO, RESONANCE_INFO } from '@/core/junkSynergy'
import { RELICS } from '@/data/relics'
import type { TraitQuirkId } from '@/types'

const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{ (e: 'close'): void }>()

const game = useGameStore()
const { t, lang } = useI18n()

const dialogEl = ref<HTMLDialogElement | null>(null)
const activeTab = ref<'quirks' | 'resonances' | 'relics'>('quirks')

const discoveredSet = computed(() => new Set(game.meta.discoveredQuirks ?? []))
const quirkList = computed(() => Object.values(QUIRK_INFO))
const resonanceList = computed(() => Object.values(RESONANCE_INFO))
const relicList = computed(() => Object.values(RELICS))

const QUIRK_SOURCE_MAP: Record<TraitQuirkId, { ko: string; en: string }> = {
  old_weapon: { ko: '오래된 무기 (하급)', en: 'Aged Weapon (Low)' },
  rust_weapon: { ko: '녹슨 무기 (하급)', en: 'Rusty Weapon (Low)' },
  heavy_weapon: { ko: '무거운 무기 (하급)', en: 'Heavy Weapon (Low)' },
  rust_armor: { ko: '녹슨 갑옷 (하급)', en: 'Rusty Armor (Low)' },
  heavy_armor: { ko: '무거운 갑옷 (하급)', en: 'Heavy Armor (Low)' },
  broken_armor: { ko: '부서진 갑옷 (하급)', en: 'Broken Armor (Low)' },
}

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
    aria-labelledby="quirk-codex-title"
    v-bind="{ closedby: 'any' } as any"
    @close="onDialogClose"
    class="w-[min(94vw,30rem)]"
  >
    <div class="rounded-xl border-2 border-amber-400/60 bg-bg-secondary text-gray-100 shadow-[0_0_32px_rgba(251,191,36,0.25)] overflow-hidden flex flex-col max-h-[86dvh]">
      <div class="px-4 py-3 bg-amber-950/40 border-b border-amber-500/30 flex items-center justify-between gap-2">
        <div>
          <h1 id="quirk-codex-title" class="text-base font-bold text-amber-200">
            [CODEX] {{ t('codex.quirk.title', '똥템 허점 · 공명 도감') }}
          </h1>
          <p class="text-[11px] text-amber-200/70">
            {{ t('codex.quirk.subtitle', `해금 현황 ${discoveredSet.size} / ${quirkList.length}`, { n: discoveredSet.size, total: quirkList.length }) }}
          </p>
        </div>
        <button
          type="button"
          class="w-8 h-8 rounded-md bg-slate-800/80 hover:bg-slate-700 text-gray-300 flex items-center justify-center text-base"
          :aria-label="t('common.close', '닫기')"
          @click="closeModal"
        >✕</button>
      </div>

      <!-- 접근성 탭 -->
      <div
        role="tablist"
        :aria-label="t('codex.quirk.tablistLabel', '똥템 도감 분류')"
        class="mwg-tablist border-b border-slate-700 bg-bg-tertiary/60 px-2"
      >
        <button
          type="button"
          role="tab"
          id="tab-quirks"
          :aria-selected="activeTab === 'quirks'"
          class="mwg-tab px-3 py-2.5 text-xs font-bold transition-colors"
          :class="activeTab === 'quirks' ? 'text-amber-300' : 'text-gray-400 hover:text-gray-200'"
          @click="activeTab = 'quirks'"
        >{{ t('codex.tab.quirks', '허점 기믹 (6)') }}</button>
        <button
          type="button"
          role="tab"
          id="tab-resonances"
          :aria-selected="activeTab === 'resonances'"
          class="mwg-tab px-3 py-2.5 text-xs font-bold transition-colors"
          :class="activeTab === 'resonances' ? 'text-cyan-300' : 'text-gray-400 hover:text-gray-200'"
          @click="activeTab = 'resonances'"
        >{{ t('codex.tab.resonances', '똥템 공명 (6)') }}</button>
        <button
          type="button"
          role="tab"
          id="tab-relics"
          :aria-selected="activeTab === 'relics'"
          class="mwg-tab px-3 py-2.5 text-xs font-bold transition-colors"
          :class="activeTab === 'relics' ? 'text-emerald-300' : 'text-gray-400 hover:text-gray-200'"
          @click="activeTab = 'relics'"
        >{{ t('codex.tab.relics', '잡동사니 유물 (8)') }}</button>
      </div>

      <div class="overflow-y-auto flex-1">
        <div role="tabpanel" aria-labelledby="tab-quirks" :hidden="activeTab !== 'quirks'" :tabindex="activeTab === 'quirks' ? 0 : undefined">
          <div class="p-3 space-y-2">
            <div
              v-for="q in quirkList"
              :key="q.id"
              class="rounded-lg border p-3 space-y-1"
              :class="discoveredSet.has(q.id)
                ? 'border-amber-400/50 bg-amber-950/25'
                : 'border-slate-700/70 bg-bg-tertiary/60'"
            >
              <div class="flex items-center justify-between gap-2">
                <span class="text-xs font-bold" :class="discoveredSet.has(q.id) ? 'text-amber-200' : 'text-gray-400'">
                  {{ discoveredSet.has(q.id)
                    ? (lang === 'en' ? q.nameEn : q.nameKo)
                    : t('codex.locked', '??? (미발견)') }}
                </span>
                <span class="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-gray-300">
                  {{ lang === 'en' ? QUIRK_SOURCE_MAP[q.id].en : QUIRK_SOURCE_MAP[q.id].ko }}
                </span>
              </div>
              <p class="text-xs leading-relaxed" :class="discoveredSet.has(q.id) ? 'text-gray-200' : 'text-amber-300/75 italic'">
                {{ discoveredSet.has(q.id)
                  ? (lang === 'en' ? q.descEn : q.descKo)
                  : (lang === 'en' ? q.hintEn : q.hintKo) }}
              </p>
            </div>
          </div>
        </div>

        <div role="tabpanel" aria-labelledby="tab-resonances" :hidden="activeTab !== 'resonances'" :tabindex="activeTab === 'resonances' ? 0 : undefined">
          <div class="p-3 space-y-2">
            <div
              v-for="r in resonanceList"
              :key="r.id"
              class="rounded-lg border border-cyan-500/40 bg-cyan-950/20 p-3 space-y-1"
            >
              <div class="text-xs font-bold text-cyan-200">
                {{ lang === 'en' ? r.nameEn : r.nameKo }}
              </div>
              <p class="text-xs text-gray-200 leading-relaxed">
                {{ lang === 'en' ? r.descEn : r.descKo }}
              </p>
            </div>
          </div>
        </div>

        <div role="tabpanel" aria-labelledby="tab-relics" :hidden="activeTab !== 'relics'" :tabindex="activeTab === 'relics' ? 0 : undefined">
          <div class="p-3 space-y-2">
            <div
              v-for="rel in relicList"
              :key="rel.id"
              class="rounded-lg border border-emerald-500/40 bg-emerald-950/20 p-3 flex items-start gap-2.5"
            >
              <img :src="rel.iconPath" :alt="lang === 'en' ? rel.nameEn : rel.nameKo" class="w-8 h-8 object-contain shrink-0 rounded bg-slate-900/70 p-0.5 border border-emerald-500/30" />
              <div class="space-y-0.5 min-w-0">
                <div class="text-xs font-bold text-emerald-200">
                  {{ lang === 'en' ? rel.nameEn : rel.nameKo }}
                </div>
                <p class="text-xs text-gray-200 leading-relaxed">
                  {{ lang === 'en' ? rel.descEn : rel.descKo }}
                </p>
              </div>
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
