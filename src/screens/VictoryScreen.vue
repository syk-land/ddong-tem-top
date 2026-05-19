<script setup lang="ts">
import { computed, ref } from 'vue'
import { useGameStore } from '@/stores/game'
import type { Stats, StatKey } from '@/types'
import { rankColorClass, statColorClass } from '@/ui/colors'
import { rankIconUrl, defaultBgUrl } from '@/ui/images'

const bgUrl = defaultBgUrl()

const game = useGameStore()
const pending = computed(() => game.pendingClear)
const allocation = ref<Partial<Stats>>({})

const STAT_KEYS: StatKey[] = ['공격력', '방어력', '체력', '마력', '속도', '행운', '명중률', '회피율', '관통', '상태저항']

const used = computed(() =>
  Object.values(allocation.value).reduce((sum, v) => sum + (v ?? 0), 0)
)
const total = computed(() => pending.value?.bonus ?? 0)
const remaining = computed(() => total.value - used.value)

function adjust(stat: StatKey, delta: number) {
  const cur = allocation.value[stat] ?? 0
  const next = cur + delta
  if (next < 0) return
  if (delta > 0 && used.value + delta > total.value) return
  allocation.value[stat] = next
  if (next === 0) delete allocation.value[stat]
}

function confirm() {
  game.confirmClearBonus(allocation.value)
}
</script>

<template>
  <section
    v-if="pending"
    class="flex-1 flex flex-col px-4 py-4 max-w-2xl mx-auto w-full bg-cover bg-center"
    :style="{ backgroundImage: `linear-gradient(rgba(10,14,26,0.78), rgba(10,14,26,0.92)), url(${bgUrl})` }"
  >
    <div class="panel text-center space-y-3 mb-4">
      <h1 class="text-3xl font-bold text-grade-legend">🏆 탑 클리어!</h1>
      <div class="text-sm text-gray-400">최종 클리어 등급</div>
      <img v-if="rankIconUrl(pending.rank)" :src="rankIconUrl(pending.rank)!" :alt="pending.rank" class="mx-auto h-24 w-auto" />
      <div :class="[rankColorClass[pending.rank], 'text-6xl font-bold']">{{ pending.rank }}</div>
      <div class="text-sm text-gray-400">점수: <span class="text-gray-200 font-mono">{{ pending.score }} / 100</span></div>
      <div class="text-log-reward text-lg font-bold">+{{ pending.bonus }} 보너스 스탯 획득!</div>
    </div>

    <div class="panel space-y-2">
      <div class="text-sm text-gray-300 flex justify-between">
        <span>보너스 분배 (자유)</span>
        <span class="text-log-reward font-mono">남은 {{ remaining }} / {{ total }}</span>
      </div>
      <div class="grid grid-cols-2 sm:grid-cols-3 gap-2">
        <div v-for="s in STAT_KEYS" :key="s" class="flex items-center justify-between bg-bg-tertiary rounded px-2 py-1.5">
          <span :class="['text-xs font-mono', statColorClass[s]]">{{ s }}</span>
          <div class="flex items-center gap-1">
            <button class="w-6 h-6 rounded bg-slate-700 hover:bg-slate-600 text-xs" @click="adjust(s, -1)">-</button>
            <span class="w-6 text-center text-sm font-mono">{{ allocation[s] ?? 0 }}</span>
            <button class="w-6 h-6 rounded bg-slate-700 hover:bg-slate-600 text-xs" @click="adjust(s, +1)">+</button>
          </div>
        </div>
      </div>
    </div>

    <button class="btn-primary w-full mt-4" @click="confirm">확정 → 메인 메뉴</button>
  </section>
</template>
