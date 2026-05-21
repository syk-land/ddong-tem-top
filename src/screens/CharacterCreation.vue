<script setup lang="ts">
import { computed, ref, onBeforeUnmount } from 'vue'
import { useGameStore } from '@/stores/game'
import type { Stats, StatKey } from '@/types'
import { statColorClass } from '@/ui/colors'
import { uniformStartingStats } from '@/core/character'
import { mainImageUrl } from '@/ui/images'
import { START_STAT_BASE } from '@/core/realboss'

const bgUrl = mainImageUrl()

const game = useGameStore()

const bonusAvailable = computed(() => game.meta.totalBonusStats)
const allocation = ref<Partial<Stats>>({})
const used = computed(() =>
  Object.values(allocation.value).reduce((sum, v) => sum + (v ?? 0), 0)
)

const STAT_KEYS: StatKey[] = ['힘', '민첩', '체력', '마력', '행운']
const RANDOM_KEYS: StatKey[] = ['힘', '민첩', '체력', '마력', '행운']

// 현재 표시될 스탯 — 주사위 결과(또는 균등 시작) + 진짜 보스 도전 보너스 자동 분배
//   분배 규칙(createCharacter와 동일): 5스탯 균등 base + 나머지 1pt씩 힘→민첩→체력→마력→행운 순
const previewStats = computed<Stats>(() => {
  const base = { ...(game.rolledStats ?? uniformStartingStats()) }
  const bonus = (game.meta.permanentStartBonus ?? 0) + (game.meta.pendingStartBonus ?? 0)
  if (bonus > 0) {
    const five: StatKey[] = ['힘', '민첩', '체력', '마력', '행운']
    const baseAdd = Math.floor(bonus / 5)
    const rem = bonus - baseAdd * 5
    for (const k of five) base[k] += baseAdd
    for (let i = 0; i < rem; i++) base[five[i]] += 1
  }
  return base
})
const previewSum = computed(() => Object.values(previewStats.value).reduce((s, v) => s + (v ?? 0), 0))

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

// 길게 눌러 연속 가속: 시작 400ms → 점차 50ms 까지 가속, 매 틱마다 +1
let holdTimer: ReturnType<typeof setTimeout> | null = null
function startHold(stat: StatKey, delta: number) {
  // 첫 1회 즉시 반응 (PointerEvent로 click이 같이 발생하지 않게 startHold 만 처리)
  adjust(stat, delta)
  let interval = 350
  const tick = () => {
    adjust(stat, delta)
    interval = Math.max(40, Math.round(interval * 0.82))
    holdTimer = setTimeout(tick, interval)
  }
  holdTimer = setTimeout(tick, interval)
}
function stopHold() {
  if (holdTimer) {
    clearTimeout(holdTimer)
    holdTimer = null
  }
}
onBeforeUnmount(() => stopHold())

function isSelected(key: string) {
  return game.selectedChallengeKey === key
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

// 도전 보너스 (영구 누적 + 마지막 1회 pending 합)
const startBonus = computed(() => (game.meta.permanentStartBonus ?? 0) + (game.meta.pendingStartBonus ?? 0))
const permanentBonus = computed(() => game.meta.permanentStartBonus ?? 0)
const drainPct = computed(() => Math.round((game.meta.lastBossDrainRatio ?? 0) * 100))
</script>

<template>
  <section
    class="flex-1 flex flex-col px-4 py-4 gap-4 max-w-3xl mx-auto w-full bg-cover bg-center"
    :style="{ backgroundImage: `linear-gradient(rgba(10,14,26,0.7), rgba(10,14,26,0.9)), url(${bgUrl})` }"
  >
    <header class="flex items-center justify-between">
      <h2 class="text-lg font-bold text-trait-special">새 캐릭터 생성</h2>
      <div class="flex gap-2">
        <button class="btn-secondary text-xs" @click="resetAll">다시 굴리기</button>
        <button class="btn-secondary text-xs" @click="back">뒤로</button>
      </div>
    </header>

    <!-- 도전 보너스 안내 (영구 누적 + 마지막 도전 결과) -->
    <div v-if="startBonus > 0" class="panel space-y-1 border border-grade-legend/40 bg-grade-legend/5">
      <div class="text-sm text-grade-legend font-bold">진짜 보스 도전 누적 보상</div>
      <div v-if="drainPct > 0" class="text-xs text-gray-300">
        마지막 도전: 보스 체력 <span class="text-trait-special font-mono font-bold">{{ drainPct }}/100</span> 깎음
      </div>
      <div class="text-xs text-log-reward">
        시작 능력치 총합 50 → <span class="font-mono font-bold">{{ 50 + startBonus }}pt</span>
        (+{{ startBonus }}pt 영구, 5스탯 균등 자동 분배)
      </div>
      <div class="text-[10px] text-gray-500">탑을 5번 오를 때마다 진짜 보스 도전 → 깎은 만큼(최대 {{ START_STAT_BASE }}pt) 영구 누적</div>
    </div>

    <!-- 주사위 시스템 -->
    <div class="panel space-y-3">
      <div class="flex items-baseline justify-between">
        <div class="text-sm">
          <span class="text-grade-legend font-bold">🎲 주사위 — 능력치 굴림</span>
          <div class="text-xs text-gray-500 mt-0.5">시작은 모두 동일. 주사위를 굴려 5스탯에 60pt 랜덤 분배 (각 최소 0, 최대 무제한).</div>
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

      <!-- 현재 스탯 (도전 보너스 자동 분배 적용) -->
      <div class="grid grid-cols-3 gap-2">
        <div v-for="s in RANDOM_KEYS" :key="s" class="bg-bg-tertiary rounded px-2 py-1.5 text-center">
          <div :class="['text-[10px]', statColorClass[s]]">{{ s }}</div>
          <div class="text-lg font-mono font-bold">{{ previewStats[s] }}</div>
        </div>
      </div>
      <div class="text-[10px] text-center">
        <span class="text-gray-400">총합 </span>
        <span class="text-log-reward font-mono font-bold">{{ previewSum }}pt</span>
        <span v-if="startBonus > 0" class="text-gray-500"> (주사위 {{ previewSum - startBonus }} + 영구 보너스 {{ startBonus }})</span>
      </div>

      <!-- 5스탯 파생 효과 안내 -->
      <div class="text-[10px] text-gray-500 text-center leading-snug">
        힘 → 공격력·관통 / 민첩 → 속도·명중·회피 / 체력 → 방어력·HP / 마력 → MP·마법계수 / 행운 → 크리·발동률·보정
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
            <button
              class="w-6 h-6 rounded bg-slate-700 hover:bg-slate-600 text-xs select-none"
              @pointerdown.prevent="startHold(s, -1)"
              @pointerup="stopHold"
              @pointerleave="stopHold"
              @pointercancel="stopHold"
              @contextmenu.prevent
            >-</button>
            <span class="w-6 text-center text-sm font-mono">{{ allocation[s] ?? 0 }}</span>
            <button
              class="w-6 h-6 rounded bg-slate-700 hover:bg-slate-600 text-xs select-none"
              @pointerdown.prevent="startHold(s, +1)"
              @pointerup="stopHold"
              @pointerleave="stopHold"
              @pointercancel="stopHold"
              @contextmenu.prevent
            >+</button>
          </div>
        </div>
      </div>
    </div>

    <button class="btn-primary w-full" @click="start">탑 진입</button>
  </section>
</template>
