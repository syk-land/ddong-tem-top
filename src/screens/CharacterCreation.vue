<script setup lang="ts">
import { computed, ref } from 'vue'
import { useGameStore } from '@/stores/game'
import type { Stats, StatKey } from '@/types'
import { statColorClass } from '@/ui/colors'
import { uniformStartingStats } from '@/core/character'
import { mainImageUrl, userAvatarUrl, userAvatarLabel } from '@/ui/images'

const bgUrl = mainImageUrl()

const game = useGameStore()

const bonusAvailable = computed(() => game.meta.totalBonusStats)
const allocation = ref<Partial<Stats>>({})
const used = computed(() =>
  Object.values(allocation.value).reduce((sum, v) => sum + (v ?? 0), 0)
)

const STAT_KEYS: StatKey[] = ['공격력', '방어력', '체력', '마력', '속도', '행운', '명중률', '회피율', '관통', '상태저항']
const RANDOM_KEYS: StatKey[] = ['공격력', '방어력', '체력', '마력']

// 현재 표시될 스탯 — 주사위 굴렸으면 그 결과, 아니면 균등 시작
const previewStats = computed<Stats>(() => game.rolledStats ?? uniformStartingStats())

const rolling = ref(false)
async function rollDice() {
  if (game.rollsLeft <= 0 || rolling.value) return
  rolling.value = true
  // 잠깐 굴리는 애니메이션을 위해 100ms 지연
  await new Promise((r) => setTimeout(r, 150))
  game.rollCharacterDice()
  rolling.value = false
}

function adjust(stat: StatKey, delta: number) {
  const cur = allocation.value[stat] ?? 0
  const next = cur + delta
  if (next < 0) return
  if (delta > 0 && used.value + delta > bonusAvailable.value) return
  allocation.value[stat] = next
  if (next === 0) delete allocation.value[stat]
}

function isSelected(key: string) {
  return game.selectedChallengeKey === key
}
function selectAvatar(key: string) {
  game.selectAvatar(key)
}
function isAvatarSelected(key: string) {
  return game.selectedAvatar === key
}
function toggle(key: string) {
  game.selectChallenge(isSelected(key) ? null : key)
}
function start() {
  game.newGame(allocation.value)
}
function back() {
  game.setScreen('menu')
}
async function resetAll() {
  const ok = await game.confirmModal(
    '챌린지와 주사위 굴림을 모두 초기화하고 다시 시작합니다.',
    { title: '캐릭터 다시 굴리기', okLabel: '다시 굴리기', danger: true }
  )
  if (ok) game.resetCharacterCreation()
}

// 사용한 주사위 수
const usedDice = computed(() => 3 - game.rollsLeft)
</script>

<template>
  <section
    class="flex-1 flex flex-col px-4 py-4 gap-4 max-w-3xl mx-auto w-full bg-cover bg-center"
    :style="{ backgroundImage: `linear-gradient(rgba(10,14,26,0.7), rgba(10,14,26,0.9)), url(${bgUrl})` }"
  >
    <header class="flex items-center justify-between">
      <h2 class="text-lg font-bold text-trait-special">새 캐릭터 생성</h2>
      <div class="flex gap-2">
        <button class="btn-secondary text-xs" @click="resetAll">🔄 다시 굴리기</button>
        <button class="btn-secondary text-xs" @click="back">뒤로</button>
      </div>
    </header>

    <!-- 캐릭터 외형 선택 (4명 랜덤) -->
    <div class="panel space-y-3">
      <div class="flex items-baseline justify-between">
        <div class="text-sm">
          <span class="text-grade-legend font-bold">👤 캐릭터 외형 선택</span>
          <div class="text-xs text-gray-500 mt-0.5">4명 중 1명을 선택하세요 (외형만, 능력치 영향 없음)</div>
        </div>
      </div>
      <div class="grid grid-cols-4 gap-2">
        <div
          v-for="key in game.avatarOptions"
          :key="key"
          @click="selectAvatar(key)"
          :class="[
            'cursor-pointer border-2 rounded-lg p-1 transition-all bg-bg-tertiary',
            isAvatarSelected(key)
              ? 'border-grade-legend bg-grade-legend/10 scale-105'
              : 'border-slate-700 hover:bg-bg-hover',
          ]"
        >
          <img
            :src="userAvatarUrl(key)"
            :alt="userAvatarLabel(key)"
            class="w-full aspect-square object-contain"
            @error="(e) => ((e.target as HTMLImageElement).style.display = 'none')"
          />
          <div class="text-[10px] text-center mt-1 text-gray-300 leading-tight">
            {{ userAvatarLabel(key) }}
          </div>
        </div>
      </div>
    </div>

    <!-- 주사위 시스템 -->
    <div class="panel space-y-3">
      <div class="flex items-baseline justify-between">
        <div class="text-sm">
          <span class="text-grade-legend font-bold">🎲 주사위 — 능력치 굴림</span>
          <div class="text-xs text-gray-500 mt-0.5">시작은 모두 동일. 주사위를 굴려 6스탯에 50pt 랜덤 분배.</div>
        </div>
        <div class="text-xs text-gray-400">남은 굴림 <span class="text-grade-legend font-mono font-bold">{{ game.rollsLeft }}</span> / 3</div>
      </div>

      <!-- 주사위 3개 시각 -->
      <div class="flex gap-2 justify-center">
        <div
          v-for="i in 3"
          :key="i"
          :class="[
            'w-12 h-12 rounded-lg border-2 flex items-center justify-center text-2xl font-bold transition-all',
            usedDice >= i
              ? 'border-slate-700 bg-slate-800 text-gray-600'
              : 'border-grade-legend bg-grade-legend/10 text-grade-legend animate-pulse',
            rolling && usedDice + 1 === i ? 'rotate-12' : '',
          ]"
        >
          🎲
        </div>
      </div>

      <!-- 현재 스탯 -->
      <div class="grid grid-cols-3 gap-2">
        <div v-for="s in RANDOM_KEYS" :key="s" class="bg-bg-tertiary rounded px-2 py-1.5 text-center">
          <div :class="['text-[10px]', statColorClass[s]]">{{ s }}</div>
          <div class="text-lg font-mono font-bold">{{ previewStats[s] }}</div>
        </div>
      </div>

      <!-- 고정 스탯 표시 -->
      <div class="text-[10px] text-gray-500 text-center">
        고정 · 속도 {{ previewStats.속도 }} / 행운 {{ previewStats.행운 }} / 명중·회피·관통·저항 0
      </div>

      <button
        class="btn-primary w-full disabled:opacity-30"
        :disabled="game.rollsLeft <= 0 || rolling"
        @click="rollDice"
      >
        <span v-if="rolling">🎲 굴리는 중...</span>
        <span v-else-if="game.rollsLeft > 0">🎲 주사위 굴리기 ({{ game.rollsLeft }} 남음)</span>
        <span v-else>주사위 모두 사용함</span>
      </button>

      <div v-if="game.rolledStats === null" class="text-[10px] text-center text-gray-500">
        주사위를 안 굴리면 6스탯 모두 8로 시작합니다 (균등).
      </div>
    </div>

    <!-- 챌린지 선택 -->
    <div class="panel space-y-3">
      <div class="text-sm text-gray-300">
        <span class="text-grade-legend font-bold">챌린지 선택</span>
        <span class="text-gray-500 ml-2 text-xs">하나만 선택 가능 (선택 안 해도 시작 가능)</span>
      </div>
      <div class="grid gap-2 md:grid-cols-3">
        <div
          v-for="(c, idx) in game.challengeOptions"
          :key="c.key"
          @click="toggle(c.key)"
          :class="[
            'cursor-pointer border-2 rounded-lg p-3 transition-all relative',
            isSelected(c.key)
              ? 'border-grade-legend bg-grade-legend/10'
              : 'border-slate-700 bg-bg-tertiary hover:bg-bg-hover',
          ]"
        >
          <!-- 챌린지 1/2/3 배지 이미지 (우상단) -->
          <img
            :src="`/images/UI/챌린지${idx + 1}.png`"
            :alt="`챌린지 ${idx + 1}`"
            class="absolute -top-3 -right-3 w-14 h-14 object-contain drop-shadow-lg z-10"
            @error="(e) => ((e.target as HTMLImageElement).style.display = 'none')"
          />
          <div class="flex items-baseline justify-between mb-1 pr-10">
            <span :class="['text-xs px-1.5 py-0.5 rounded', c.category === 'instant' ? 'bg-blue-900/40 text-stat-mp' : 'bg-rose-900/40 text-status-bleed']">
              {{ c.category === 'instant' ? '즉시 보상' : '리스크 베팅' }}
            </span>
            <span class="text-[10px] text-gray-500">{{ c.group }}</span>
          </div>
          <h3 :class="[isSelected(c.key) ? 'text-grade-legend' : 'text-gray-100', 'font-bold text-sm']">{{ c.name }}</h3>
          <p class="text-xs text-gray-400 mt-1">{{ c.description }}</p>
          <div class="mt-2 space-y-0.5">
            <div class="text-[11px] text-log-reward">✦ {{ c.reward }}</div>
            <div class="text-[11px] text-log-damage">✖ {{ c.penalty }}</div>
          </div>
        </div>
      </div>
    </div>

    <!-- 메타 보너스 자유 분배 -->
    <div v-if="bonusAvailable > 0" class="panel space-y-2">
      <div class="text-sm text-gray-300">
        <span class="text-log-reward font-bold">누적 보너스 자유 분배</span>
        <span class="text-gray-500 ml-2 text-xs">사용 {{ used }} / {{ bonusAvailable }}</span>
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

    <button class="btn-primary w-full" @click="start">탑 진입</button>
  </section>
</template>
