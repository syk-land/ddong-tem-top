<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useGameStore } from '@/stores/game'
import {
  isSoundEnabled, setSoundEnabled,
  isBgmEnabled, setBgmEnabled,
  getSoundVolume, setSoundVolume,
  getBgmVolume, setBgmVolume,
  sfx,
} from '@/ui/sound'

const game = useGameStore()
const speeds = [1, 2, 4] as const

// 펼침 상태 — localStorage 영속화
const expanded = ref(true)
const STORAGE_KEY = 'climetop:speedControl:expanded:v1'

// 사운드 상태 (reactive)
const sfxOn = ref(isSoundEnabled())
const bgmOn = ref(isBgmEnabled())
const sfxVol = ref(getSoundVolume())
const bgmVol = ref(getBgmVolume())

// 음소거 해제 시 복원할 마지막 양수 볼륨
const lastSfxVol = ref(sfxVol.value > 0 ? sfxVol.value : 0.3)
const lastBgmVol = ref(bgmVol.value > 0 ? bgmVol.value : 0.4)

onMounted(() => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw === '0') expanded.value = false
  } catch {}
})

function setSpeed(s: number) {
  game.setCombatSpeed(s)
  sfx.click()
}

function toggle() {
  expanded.value = !expanded.value
  try {
    localStorage.setItem(STORAGE_KEY, expanded.value ? '1' : '0')
  } catch {}
}

// ── 효과음 ──
function onSfxVolChange(e: Event) {
  const v = parseFloat((e.target as HTMLInputElement).value)
  sfxVol.value = v
  setSoundVolume(v)
  // 0 이면 자동 음소거, >0 이면 자동 음소거 해제
  if (v === 0) {
    if (sfxOn.value) {
      sfxOn.value = false
      setSoundEnabled(false)
    }
  } else {
    lastSfxVol.value = v
    if (!sfxOn.value) {
      sfxOn.value = true
      setSoundEnabled(true)
    }
  }
}
function onSfxMuteToggle() {
  sfxOn.value = !sfxOn.value
  setSoundEnabled(sfxOn.value)
  if (sfxOn.value) {
    // 켜짐: 마지막 양수 볼륨으로 복원 (0 이었으면 기본값)
    const restore = lastSfxVol.value > 0 ? lastSfxVol.value : 0.3
    sfxVol.value = restore
    setSoundVolume(restore)
    sfx.click()
  } else {
    // 꺼짐: 슬라이더 0
    if (sfxVol.value > 0) lastSfxVol.value = sfxVol.value
    sfxVol.value = 0
    setSoundVolume(0)
  }
}

// ── 배경음 ──
function onBgmVolChange(e: Event) {
  const v = parseFloat((e.target as HTMLInputElement).value)
  bgmVol.value = v
  setBgmVolume(v)
  if (v === 0) {
    if (bgmOn.value) {
      bgmOn.value = false
      setBgmEnabled(false)
    }
  } else {
    lastBgmVol.value = v
    if (!bgmOn.value) {
      bgmOn.value = true
      setBgmEnabled(true)
    }
  }
}
function onBgmMuteToggle() {
  bgmOn.value = !bgmOn.value
  setBgmEnabled(bgmOn.value)
  if (bgmOn.value) {
    const restore = lastBgmVol.value > 0 ? lastBgmVol.value : 0.4
    bgmVol.value = restore
    setBgmVolume(restore)
  } else {
    if (bgmVol.value > 0) lastBgmVol.value = bgmVol.value
    bgmVol.value = 0
    setBgmVolume(0)
  }
}

// 접힘 상태의 사운드 요약 아이콘
const summaryIcon = computed(() => {
  if (!sfxOn.value && !bgmOn.value) return '🔇'
  return '🔊'
})
</script>

<template>
  <div class="fixed top-2 right-2 z-40 bg-black/60 backdrop-blur-sm rounded select-none text-gray-200">
    <!-- 헤더 행: 토글 + 속도 + 요약 아이콘 -->
    <div class="flex items-center gap-1 px-2 py-1">
      <button
        class="w-5 h-5 flex items-center justify-center rounded text-sm hover:bg-slate-700"
        :title="expanded ? '컨트롤 접기' : '컨트롤 펼치기'"
        @click="toggle"
      >
        {{ expanded ? '›' : '‹' }}
      </button>

      <template v-if="expanded">
        <span class="text-[10px] text-gray-300">속도</span>
        <button
          v-for="s in speeds"
          :key="s"
          class="px-2 py-0.5 rounded text-[11px] transition-colors"
          :class="game.combatSpeed === s
            ? 'bg-log-skill text-black font-bold'
            : 'bg-slate-800/70 text-gray-200 hover:bg-slate-700'"
          @click="setSpeed(s)"
        >
          {{ s }}x
        </button>
      </template>

      <span v-else class="text-[10px] text-gray-300 font-bold pr-1">{{ game.combatSpeed }}x</span>

      <span class="text-sm ml-1">{{ summaryIcon }}</span>
    </div>

    <!-- 펼친 상태: 사운드 패널 (효과음/배경음 슬라이더 + 음소거) -->
    <div v-if="expanded" class="border-t border-slate-700/50 px-2 py-1.5 space-y-1">
      <!-- 효과음 행 -->
      <div class="flex items-center gap-1.5 text-[10px]">
        <span class="w-10 shrink-0 text-gray-300">효과음</span>
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          :value="sfxVol"
          @input="onSfxVolChange"
          class="w-24 accent-log-skill"
          :title="`효과음 ${Math.round(sfxVol * 100)}%`"
        />
        <span class="w-7 shrink-0 text-right text-gray-400 tabular-nums">{{ Math.round(sfxVol * 100) }}</span>
        <label class="flex items-center gap-1 cursor-pointer ml-1" title="효과음 음소거">
          <input
            type="checkbox"
            :checked="!sfxOn"
            @change="onSfxMuteToggle"
            class="w-3 h-3 accent-red-500 cursor-pointer"
          />
          <span class="text-gray-400">음소거</span>
        </label>
      </div>

      <!-- 배경음 행 -->
      <div class="flex items-center gap-1.5 text-[10px]">
        <span class="w-10 shrink-0 text-gray-300">배경음</span>
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          :value="bgmVol"
          @input="onBgmVolChange"
          class="w-24 accent-log-skill"
          :title="`배경음 ${Math.round(bgmVol * 100)}%`"
        />
        <span class="w-7 shrink-0 text-right text-gray-400 tabular-nums">{{ Math.round(bgmVol * 100) }}</span>
        <label class="flex items-center gap-1 cursor-pointer ml-1" title="배경음 음소거">
          <input
            type="checkbox"
            :checked="!bgmOn"
            @change="onBgmMuteToggle"
            class="w-3 h-3 accent-red-500 cursor-pointer"
          />
          <span class="text-gray-400">음소거</span>
        </label>
      </div>
    </div>
  </div>
</template>
