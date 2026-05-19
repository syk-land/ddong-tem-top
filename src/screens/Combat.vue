<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useGameStore } from '@/stores/game'
import { SKILLS } from '@/data/skills'
import HpMpBar from '@/ui/components/HpMpBar.vue'
import ItemName from '@/ui/components/ItemName.vue'
import StatusBadges from '@/ui/components/StatusBadges.vue'
import { logColorClass, logPrefix } from '@/ui/colors'
import { themeBgUrl, skillIconUrl, monsterImageUrl, playerImageUrl } from '@/ui/images'

const game = useGameStore()
const combat = computed(() => game.combat!)
const player = computed(() => combat.value.player)
const monsters = computed(() => combat.value.monsters)
const aliveMonsterCount = computed(() => monsters.value.filter((m) => m.hp > 0).length)
const log = computed(() => combat.value.log)
const logEl = ref<HTMLElement | null>(null)

const playerGauge = computed(() => Math.min(100, combat.value.player.actionGauge))
const bgUrl = computed(() => {
  const ch = game.currentChapterState
  return ch ? themeBgUrl(ch.theme) : ''
})

// ============================================================
// 피격 이펙트: monster.hp 변화 감지 → 흔들림 + 데미지 부동 숫자
// ============================================================
interface DamageEvent {
  id: number
  monsterIdx: number
  amount: number
  isCrit: boolean
}
const damageEvents = ref<DamageEvent[]>([])
const shakingIdx = ref<Set<number>>(new Set())
const previousHp = ref<number[]>([])
let dmgIdCounter = 0

// 초기화
watch(
  () => monsters.value.length,
  (n) => {
    previousHp.value = monsters.value.map((m) => m.hp)
  },
  { immediate: true }
)

// HP 변화 감지
watch(
  () => monsters.value.map((m) => m.hp),
  (newHps) => {
    for (let i = 0; i < newHps.length; i++) {
      const oldHp = previousHp.value[i] ?? newHps[i]
      const delta = oldHp - newHps[i]
      if (delta > 0) {
        // 피격 발생
        const id = ++dmgIdCounter
        // 크리티컬 판별: 최근 로그에 '크리티컬' 포함 여부
        const recentLog = log.value[log.value.length - 1]
        const isCrit = !!recentLog && /크리티컬/.test(recentLog.text)
        damageEvents.value.push({ id, monsterIdx: i, amount: delta, isCrit })
        shakingIdx.value.add(i)
        setTimeout(() => {
          damageEvents.value = damageEvents.value.filter((e) => e.id !== id)
        }, 900)
        setTimeout(() => {
          shakingIdx.value.delete(i)
        }, 320)
      }
      previousHp.value[i] = newHps[i]
    }
  },
  { deep: false }
)

function damageFor(idx: number): DamageEvent[] {
  return damageEvents.value.filter((e) => e.monsterIdx === idx)
}

// ============================================================
// 플레이어 피격 이펙트
// ============================================================
interface PlayerDmgEvent {
  id: number
  amount: number
}
const playerDamageEvents = ref<PlayerDmgEvent[]>([])
const playerShaking = ref(false)
const prevPlayerHp = ref(combat.value?.player.hp ?? 0)

watch(
  () => combat.value?.player.hp,
  (hp) => {
    if (hp === undefined) return
    const delta = prevPlayerHp.value - hp
    if (delta > 0) {
      const id = ++dmgIdCounter
      playerDamageEvents.value.push({ id, amount: delta })
      playerShaking.value = true
      setTimeout(() => {
        playerDamageEvents.value = playerDamageEvents.value.filter((e) => e.id !== id)
      }, 900)
      setTimeout(() => {
        playerShaking.value = false
      }, 320)
    }
    prevPlayerHp.value = hp
  }
)

// 자동 전투용 스킬 정보 (UI 표시)
const skillKeys = computed(() => game.availableSkills)
const procPct = computed(() => game.weaponSkillProcPct)

const BASE_INTERVAL = 60 // ms

// 자동 틱 (전투 종료 전까지 무한 — 플레이어 액션도 자동)
let ticker: number | null = null
function startAutoTick() {
  if (ticker) return
  const interval = Math.max(10, Math.round(BASE_INTERVAL / Math.max(1, game.combatSpeed)))
  ticker = window.setInterval(() => {
    if (!combat.value || combat.value.ended) {
      stopAutoTick()
      return
    }
    game.tickStep()
  }, interval)
}
function stopAutoTick() {
  if (ticker) {
    clearInterval(ticker)
    ticker = null
  }
}

function restartTicker() {
  stopAutoTick()
  startAutoTick()
}

onMounted(() => {
  startAutoTick()
})
onUnmounted(() => stopAutoTick())

// 전투 종료 감지: 자동 정지
watch(
  () => combat.value?.ended,
  (ended) => {
    if (ended) stopAutoTick()
  }
)

// 속도 변경 → 타이머 재시작
watch(
  () => game.combatSpeed,
  () => restartTicker()
)

watch(
  () => log.value.length,
  () => {
    requestAnimationFrame(() => {
      if (logEl.value) logEl.value.scrollTop = logEl.value.scrollHeight
    })
  }
)

function setSpeed(s: number) {
  game.setCombatSpeed(s)
}
function flee() {
  game.fleeCombat()
}
function closeAndAdvance() {
  game.closeCombat()
}
</script>

<template>
  <section class="flex-1 flex flex-col px-3 py-3 max-w-4xl mx-auto w-full">
    <!-- 통합 배경 컨테이너 (적부터 컨트롤까지 하나의 챕터 배경 이어짐) -->
    <div class="relative flex-1 flex flex-col rounded-lg overflow-hidden border border-slate-700">
      <!-- 챕터 배경 (한 장으로 이어짐) -->
      <div
        v-if="bgUrl"
        class="absolute inset-0 bg-cover bg-center"
        :style="{ backgroundImage: `url(${bgUrl})` }"
      />
      <div class="absolute inset-0 bg-black/45" />

      <!-- 내부 카드들 (반투명 panel-glass) -->
      <div class="relative z-10 flex flex-col gap-3 p-3">
        <!-- 적 상태 (다수 가능) -->
        <div class="panel-glass p-0 overflow-hidden">
          <!-- 몬스터 이미지 -->
          <div class="flex justify-center items-end gap-3 pt-3" style="min-height: 140px">
            <div
              v-for="(m, idx) in monsters"
              :key="'img-' + idx"
              :class="['relative flex flex-col items-center', m.hp <= 0 ? 'opacity-30 grayscale' : '']"
            >
              <img
                :src="monsterImageUrl(m.template.name)"
                :alt="m.template.name"
                :class="[
                  'max-h-[120px] max-w-[120px] object-contain drop-shadow-2xl',
                  shakingIdx.has(idx) ? 'animate-shake animate-flash-red' : '',
                ]"
                @error="(e) => ((e.target as HTMLImageElement).style.display = 'none')"
              />
              <div
                v-for="ev in damageFor(idx)"
                :key="ev.id"
                class="absolute left-1/2 top-2 pointer-events-none font-bold animate-damage-float"
                :class="ev.isCrit ? 'text-3xl text-log-critical drop-shadow-[0_0_4px_rgba(245,158,11,0.8)]' : 'text-2xl text-status-burn drop-shadow-[0_0_3px_rgba(239,68,68,0.8)]'"
              >
                -{{ ev.amount }}<span v-if="ev.isCrit" class="text-sm ml-0.5">✦</span>
              </div>
            </div>
          </div>
          <div class="p-2 space-y-2 bg-black/25">
            <div class="text-[10px] text-gray-300">적 {{ aliveMonsterCount }} / {{ monsters.length }} 마리</div>
            <div
              v-for="(m, idx) in monsters"
              :key="idx"
              :class="['space-y-1', m.hp <= 0 ? 'opacity-40' : '']"
            >
              <div class="flex items-baseline justify-between">
                <h3 class="text-sm font-bold text-log-enemy">
                  <span v-if="m.hp <= 0" class="line-through text-gray-500">{{ m.template.name }}</span>
                  <span v-else>{{ m.template.name }}</span>
                  <span v-if="m.isBoss" class="text-grade-legend text-xs ml-1">👑</span>
                  <span v-if="m.isMimic" class="text-status-bleed text-xs ml-1">미믹</span>
                  <span v-if="m.hp <= 0" class="text-gray-500 text-xs ml-1">처치됨</span>
                </h3>
                <span class="text-[10px] text-gray-300">속도 {{ m.speed }}</span>
              </div>
              <HpMpBar :current="m.hp" :max="m.maxHp" kind="hp" />
              <StatusBadges :statuses="m.statuses" />
              <div class="w-full h-1 bg-slate-800 rounded overflow-hidden">
                <div class="h-full bg-log-enemy transition-all" :style="{ width: Math.min(100, m.actionGauge) + '%' }" />
              </div>
            </div>
          </div>
        </div>

        <!-- 플레이어 상태 (로그를 아래로 이동) -->
        <div class="panel-glass p-2 space-y-2">
          <div class="flex items-center gap-3">
            <div class="relative flex-shrink-0">
              <img
                :src="playerImageUrl(game.runAvatar)"
                alt="플레이어"
                :class="[
                  'w-20 h-20 object-contain drop-shadow-2xl',
                  playerShaking ? 'animate-shake animate-flash-red' : '',
                ]"
                @error="(e) => ((e.target as HTMLImageElement).style.display = 'none')"
              />
              <div
                v-for="ev in playerDamageEvents"
                :key="ev.id"
                class="absolute left-1/2 top-2 pointer-events-none font-bold text-2xl text-status-burn animate-damage-float drop-shadow-[0_0_3px_rgba(239,68,68,0.8)]"
              >
                -{{ ev.amount }}
              </div>
            </div>
            <div class="flex-1 min-w-0 space-y-1">
              <HpMpBar :current="player.hp" :max="player.maxHp" kind="hp" />
              <HpMpBar :current="player.mp" :max="player.maxMp" kind="mp" />
              <div class="text-[10px] flex items-center gap-2 flex-wrap">
                <ItemName :item="player.weapon" compact />
                <span class="text-gray-700">·</span>
                <ItemName :item="player.armor" compact />
              </div>
              <StatusBadges :statuses="player.statuses" />
            </div>
          </div>

          <div class="w-full h-2 bg-slate-800/70 rounded overflow-hidden">
            <div class="h-full bg-log-skill transition-all" :style="{ width: playerGauge + '%' }" />
          </div>

          <div v-if="skillKeys.length > 0" class="flex flex-wrap items-center gap-2 text-xs">
            <span class="text-gray-300">자동:</span>
            <span
              v-for="key in skillKeys"
              :key="key"
              class="px-2 py-0.5 rounded bg-slate-800/80 text-log-skill flex items-center gap-1"
            >
              <img :src="skillIconUrl(key)" :alt="key" class="w-4 h-4 object-contain" @error="(e) => ((e.target as HTMLImageElement).style.display = 'none')" />
              {{ SKILLS[key]?.name ?? key }}
              <span v-if="SKILLS[key]?.kind === 'physical_atk' || SKILLS[key]?.kind === 'magic_atk'"
                    class="text-stat-util ml-1">{{ procPct }}%</span>
            </span>
            <span class="text-gray-300 ml-auto text-[10px]">MP {{ player.mp }}/{{ player.maxMp }}</span>
          </div>
        </div>

        <!-- 자동 전투 컨트롤 -->
        <div v-if="!combat.ended" class="panel-glass p-2 flex items-center gap-2">
          <span class="text-xs text-gray-300">속도</span>
          <button
            v-for="s in [1, 2, 4]"
            :key="s"
            class="px-3 py-1 rounded text-sm transition-colors"
            :class="game.combatSpeed === s ? 'bg-log-skill text-black font-bold' : 'bg-slate-800 text-gray-200 hover:bg-slate-700'"
            @click="setSpeed(s)"
          >
            {{ s }}x
          </button>
          <span class="flex-1" />
          <button class="btn-secondary text-sm" @click="flee">🏃 도주</button>
        </div>

        <!-- 종료 화면 -->
        <div v-else class="panel-glass p-3 space-y-3 text-center">
          <div v-if="combat.victory" class="text-log-reward text-xl font-bold">승리!</div>
          <div v-else class="text-log-enemy text-xl font-bold">패배...</div>
          <button v-if="combat.victory" class="btn-primary w-full" @click="closeAndAdvance">다음 층으로</button>
        </div>

        <!-- 전투 로그 (맨 아래, 고정 크기) -->
        <div class="panel-glass p-0 overflow-hidden">
          <div
            class="overflow-y-auto font-mono p-2 text-[10px] leading-snug bg-black/55"
            ref="logEl"
            style="height: 140px"
          >
            <div v-for="(l, i) in log" :key="i" :class="['log-line', logColorClass[l.kind]]">
              <span class="text-gray-500 text-[9px] mr-1">[{{ l.tick }}t]</span>
              <span class="mr-1 opacity-80">{{ logPrefix[l.kind] }}</span>
              {{ l.text }}
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>
