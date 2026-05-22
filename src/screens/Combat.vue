<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useGameStore } from '@/stores/game'
import { SKILLS } from '@/data/skills'
import HpMpBar from '@/ui/components/HpMpBar.vue'
import ItemName from '@/ui/components/ItemName.vue'
import StatusBadges from '@/ui/components/StatusBadges.vue'
import { logColorClass, logPrefix } from '@/ui/colors'
import { themeBgUrl, skillIconUrl, monsterImageUrl, playerImageUrl, realBossImageUrl } from '@/ui/images'
import { sfx } from '@/ui/sound'

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
const isRealBoss = computed(() => !!game.realBossMonster && !!game.realBossTheme)
const realBossImg = computed(() => game.realBossTheme ? realBossImageUrl(game.realBossTheme) : null)

// ============================================================
// 피격 이펙트
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

watch(
  () => monsters.value.length,
  () => {
    previousHp.value = monsters.value.map((m) => m.hp)
  },
  { immediate: true }
)

watch(
  () => monsters.value.map((m) => m.hp),
  (newHps) => {
    for (let i = 0; i < newHps.length; i++) {
      const oldHp = previousHp.value[i] ?? newHps[i]
      const delta = oldHp - newHps[i]
      if (delta > 0) {
        const id = ++dmgIdCounter
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

const skillKeys = computed(() => game.availableSkills)
const procPct = computed(() => game.weaponSkillProcPct)

// 스킬 상세 모달
const selectedSkill = ref<string | null>(null)
const selectedSkillDef = computed(() =>
  selectedSkill.value ? SKILLS[selectedSkill.value] ?? null : null
)
const isAttackSkill = computed(() => {
  const k = selectedSkillDef.value?.kind
  return k === 'physical_atk' || k === 'magic_atk'
})
const skillKindLabel: Record<string, string> = {
  physical_atk: '물리 공격',
  physical_def: '물리 방어',
  magic_atk: '마법 공격',
  magic_def: '마법 방어',
}
const skillKindColor: Record<string, string> = {
  physical_atk: 'text-stat-phys_atk',
  physical_def: 'text-stat-phys_def',
  magic_atk: 'text-stat-mag_atk',
  magic_def: 'text-stat-mag_def',
}

const BASE_INTERVAL = 60

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
  // 첫 전투 — HP/MP/게이지 안내 (= 챕터 1 1층 강제 일반)
  game.triggerTutorial('first_combat')
  // 챕터 1 4층 일반 몬스터 전투 → 2배속 잠금 해제 + 안내
  const ch = game.currentChapterState
  const floor = game.currentFloorEvent
  if (ch?.chapter === 1 && ch.currentFloor === 3 && floor?.type === 'monster') {
    game.triggerTutorial('second_combat')
  }
  startAutoTick()
})
onUnmounted(() => stopAutoTick())

// 광고 부활 시 combat.ended 가 true → false 로 전환되면 ticker 재시작
watch(
  () => combat.value?.ended,
  (newVal, oldVal) => {
    if (oldVal === true && newVal === false) startAutoTick()
  },
)

let autoAdvanceTimer: ReturnType<typeof setTimeout> | null = null
function maybeAutoAdvance() {
  if (!game.autoEnter) return
  if (!combat.value || !combat.value.ended) return
  if (!combat.value.victory) return
  if (game.pendingPickup) return
  if (game.dialog || game.inputDialog || game.listDialog) return
  if (autoAdvanceTimer) clearTimeout(autoAdvanceTimer)
  const delay = Math.max(300, Math.round(900 / Math.max(1, game.combatSpeed)))
  autoAdvanceTimer = setTimeout(() => {
    autoAdvanceTimer = null
    if (combat.value?.ended && combat.value?.victory
        && !game.pendingPickup && !game.dialog && !game.inputDialog && !game.listDialog) {
      game.closeCombat()
    }
  }, delay)
}

watch(
  () => combat.value?.ended,
  (ended) => {
    if (ended) {
      stopAutoTick()
      maybeAutoAdvance()
    }
  }
)
watch(
  () => game.pendingPickup,
  (p) => {
    if (!p) maybeAutoAdvance()
  }
)
onUnmounted(() => {
  if (autoAdvanceTimer) {
    clearTimeout(autoAdvanceTimer)
    autoAdvanceTimer = null
  }
})

watch(
  () => game.combatSpeed,
  () => restartTicker()
)

// ============================================================
// 로그 접기/펼치기
// ============================================================
const logExpanded = ref(false)
const recentLogs = computed(() => log.value.slice(-3))

watch(
  () => log.value.length,
  (newLen, oldLen) => {
    requestAnimationFrame(() => {
      if (logEl.value) logEl.value.scrollTop = logEl.value.scrollHeight
    })
    if (oldLen != null && newLen > oldLen) {
      for (let i = oldLen; i < newLen; i++) {
        const entry = log.value[i]
        if (!entry) continue
        switch (entry.kind) {
          case 'critical':
            sfx.crit()
            break
          case 'enemy':
            if (entry.text.includes('피해')) sfx.hit()
            break
          case 'miss':
            sfx.miss()
            break
          case 'reward':
            if (entry.text.includes('드랍')) sfx.pickup()
            break
          case 'gold':
            sfx.gold()
            break
        }
      }
    }
  }
)

function closeAndAdvance() {
  game.closeCombat()
}

watch(
  () => game.paused || !!game.tutorialActive,
  (p) => {
    if (p) stopAutoTick()
    else if (!combat.value?.ended) startAutoTick()
  },
)
</script>

<template>
  <section class="flex-1 flex flex-col px-2 py-2 sm:px-3 sm:py-3 max-w-4xl mx-auto w-full">
    <!-- 통합 배경 컨테이너 -->
    <div class="relative flex-1 flex flex-col rounded-lg overflow-hidden border border-slate-700">
      <!-- 챕터 배경 -->
      <div
        v-if="bgUrl"
        class="absolute inset-0 bg-cover bg-center"
        :style="{ backgroundImage: `url(${bgUrl})` }"
      />
      <div class="absolute inset-0 bg-black/50" />

      <div class="relative z-10 flex flex-col gap-2 p-2 sm:gap-3 sm:p-3">
        <!-- ====================================================== -->
        <!-- 적 카드 — rose 액센트                                   -->
        <!-- ====================================================== -->
        <div class="rounded-lg overflow-hidden border border-rose-500/40 bg-bg-secondary/55 backdrop-blur-sm shadow-[0_0_20px_rgba(244,63,94,0.15)_inset]">
          <!-- 헤더 -->
          <div class="px-3 py-1.5 bg-rose-950/40 border-b border-rose-500/30 flex items-center justify-between">
            <span class="text-xs font-bold text-rose-300 tracking-wide">
              <span v-if="isRealBoss">⚔ 도전 보스</span>
              <span v-else>⚔ 적 {{ aliveMonsterCount }} / {{ monsters.length }}</span>
            </span>
            <span class="text-xs text-rose-200/60">
              {{ isRealBoss ? '진짜 보스전' : (combat.ended ? '전투 종료' : '진행 중') }}
            </span>
          </div>

          <!-- 적 컨테이너: 도전모드는 단일 큰 카드, 일반은 가로 카드 그리드 -->
          <div
            class="flex justify-center items-end gap-2 sm:gap-3 px-2 pt-3 pb-1"
            :style="{ minHeight: isRealBoss ? '320px' : '150px' }"
          >
            <div
              v-for="(m, idx) in monsters"
              :key="'card-' + idx"
              :class="[
                'relative flex flex-col items-center',
                isRealBoss ? 'flex-1' : 'flex-1 max-w-[140px]',
                m.hp <= 0 ? 'opacity-40 grayscale' : '',
              ]"
            >
              <img
                :src="isRealBoss && realBossImg ? realBossImg : monsterImageUrl(m.template.name)"
                :alt="m.template.name"
                :class="[
                  'object-contain drop-shadow-2xl',
                  isRealBoss ? 'max-h-[300px] max-w-[100%] w-auto' : 'max-h-[110px] max-w-[110px]',
                  shakingIdx.has(idx) ? 'animate-shake animate-flash-red' : '',
                ]"
                @error="(e) => ((e.target as HTMLImageElement).style.display = 'none')"
              />
              <div
                v-for="ev in damageFor(idx)"
                :key="ev.id"
                class="absolute left-1/2 top-2 pointer-events-none font-bold animate-damage-float"
                :class="ev.isCrit
                  ? 'text-3xl text-log-critical drop-shadow-[0_0_4px_rgba(245,158,11,0.8)]'
                  : 'text-2xl text-status-burn drop-shadow-[0_0_3px_rgba(239,68,68,0.8)]'"
              >
                -{{ ev.amount }}<span v-if="ev.isCrit" class="text-sm ml-0.5">✦</span>
              </div>
            </div>
          </div>

          <!-- 적 정보 영역 -->
          <div class="px-3 py-2 space-y-2 bg-black/30">
            <div
              v-for="(m, idx) in monsters"
              :key="'info-' + idx"
              :class="['space-y-1', m.hp <= 0 ? 'opacity-50' : '']"
            >
              <div class="flex items-baseline justify-between gap-2">
                <h3 class="text-sm font-bold text-rose-200 truncate">
                  <span v-if="m.hp <= 0" class="line-through text-gray-500">{{ m.template.name }}</span>
                  <span v-else>{{ m.template.name }}</span>
                  <span v-if="m.isBoss" class="text-grade-legend text-xs ml-1 font-bold">[보스]</span>
                  <span v-if="m.isMimic" class="text-status-bleed text-xs ml-1">미믹</span>
                  <span v-if="m.hp <= 0" class="text-gray-500 text-xs ml-1">처치됨</span>
                </h3>
                <span class="text-xs text-stat-speed shrink-0">⚡{{ m.speed }}</span>
              </div>
              <HpMpBar :current="m.hp" :max="m.maxHp" kind="hp" />
              <!-- 액션 게이지: HP 와 시각적 분리 — 얇은 라인 + 다른 색 -->
              <div class="flex items-center gap-1.5">
                <span class="text-xs text-rose-300/70 font-mono w-8">행동</span>
                <div class="flex-1 h-[3px] bg-slate-900/70 rounded-full overflow-hidden">
                  <div class="h-full bg-rose-400/80 transition-all" :style="{ width: Math.min(100, m.actionGauge) + '%' }" />
                </div>
              </div>
              <StatusBadges v-if="m.statuses.length" :statuses="m.statuses" />
            </div>
          </div>
        </div>

        <!-- ====================================================== -->
        <!-- 플레이어 카드 — teal 액센트                             -->
        <!-- ====================================================== -->
        <div class="rounded-lg overflow-hidden border border-cyan-500/40 bg-bg-secondary/55 backdrop-blur-sm shadow-[0_0_20px_rgba(34,211,238,0.15)_inset]">
          <div class="p-3 space-y-2">
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
              <div data-tutorial-target="combat-bars" class="flex-1 min-w-0 space-y-1.5">
                <HpMpBar :current="player.hp" :max="player.maxHp" kind="hp" />
                <HpMpBar :current="player.mp" :max="player.maxMp" kind="mp" />
                <div class="text-xs flex items-center gap-1.5 flex-wrap">
                  <ItemName :item="player.weapon" compact />
                  <span class="text-gray-600">·</span>
                  <ItemName :item="player.armor" compact />
                </div>
                <StatusBadges v-if="player.statuses.length" :statuses="player.statuses" />
              </div>
            </div>

            <!-- 플레이어 액션 게이지 — 적과 다른 색(cyan) + 얇은 라인 -->
            <div class="flex items-center gap-1.5">
              <span class="text-xs text-cyan-300/70 font-mono w-8">행동</span>
              <div class="flex-1 h-[3px] bg-slate-900/70 rounded-full overflow-hidden">
                <div class="h-full bg-cyan-400/80 transition-all" :style="{ width: playerGauge + '%' }" />
              </div>
            </div>

            <!-- 자동 발동 스킬 — 칩 (탭하면 상세 모달) -->
            <div v-if="skillKeys.length > 0" class="flex flex-wrap items-center gap-1.5 text-xs pt-0.5">
              <span class="text-cyan-300/80 text-xs">자동</span>
              <button
                v-for="key in skillKeys"
                :key="key"
                type="button"
                class="px-2 py-1 rounded-md bg-slate-800/80 text-log-skill flex items-center gap-1 border border-cyan-500/20 hover:bg-slate-700/80 active:scale-95 transition-transform"
                :title="`${SKILLS[key]?.name ?? key} — 상세 보기`"
                @click="selectedSkill = key"
              >
                <img
                  :src="skillIconUrl(key)"
                  :alt="key"
                  class="w-4 h-4 object-contain"
                  @error="(e) => ((e.target as HTMLImageElement).style.display = 'none')"
                />
                <span>{{ SKILLS[key]?.name ?? key }}</span>
                <span
                  v-if="SKILLS[key]?.kind === 'physical_atk' || SKILLS[key]?.kind === 'magic_atk'"
                  class="text-stat-util"
                >{{ procPct }}%</span>
              </button>
            </div>
          </div>
        </div>

        <!-- ====================================================== -->
        <!-- 전투 로그 — 접기/펼치기 (도전모드는 숨김)                 -->
        <!-- ====================================================== -->
        <div
          v-if="!isRealBoss"
          class="rounded-lg overflow-hidden border border-slate-700/60 bg-black/55 backdrop-blur-sm"
        >
          <button
            class="w-full px-3 py-1.5 flex items-center justify-between bg-slate-900/40 hover:bg-slate-800/50 transition-colors"
            @click="logExpanded = !logExpanded"
          >
            <span class="text-xs font-bold text-slate-300">📜 전투 로그</span>
            <span class="text-xs text-slate-400">
              {{ logExpanded ? '접기 ▴' : '펼치기 ▾' }}
            </span>
          </button>

          <!-- 접힘: 최근 3줄 미리보기 -->
          <div v-if="!logExpanded" class="font-mono px-3 py-2 text-xs leading-relaxed">
            <div
              v-for="(l, i) in recentLogs"
              :key="'recent-' + i"
              :class="['truncate', logColorClass[l.kind]]"
            >
              <span class="mr-1 opacity-80">{{ logPrefix[l.kind] }}</span>{{ l.text }}
            </div>
          </div>

          <!-- 펼침: 스크롤 영역 -->
          <div
            v-else
            class="overflow-y-auto font-mono px-3 py-2 text-xs leading-relaxed"
            ref="logEl"
            style="height: 200px"
          >
            <div v-for="(l, i) in log" :key="i" :class="['log-line', logColorClass[l.kind]]">
              <span class="text-gray-500 text-xs mr-1">[{{ l.tick }}t]</span>
              <span class="mr-1 opacity-80">{{ logPrefix[l.kind] }}</span>
              {{ l.text }}
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- ====================================================== -->
    <!-- 스킬 상세 모달                                            -->
    <!-- ====================================================== -->
    <Teleport to="body">
    <div
      v-if="selectedSkillDef"
      class="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/60 backdrop-blur-sm animate-fadein"
      @click.self="selectedSkill = null"
    >
      <div class="w-full max-w-xs rounded-xl border-2 border-cyan-400/60 bg-bg-secondary/95 shadow-[0_0_30px_rgba(34,211,238,0.35)] overflow-hidden">
        <!-- 헤더 -->
        <div class="px-4 py-3 bg-cyan-950/40 border-b border-cyan-500/30 flex items-center gap-3">
          <img
            :src="skillIconUrl(selectedSkill!)"
            :alt="selectedSkillDef.name"
            class="w-10 h-10 object-contain drop-shadow"
            @error="(e) => ((e.target as HTMLImageElement).style.display = 'none')"
          />
          <div class="flex-1 min-w-0">
            <div class="text-base font-bold text-cyan-200 truncate">{{ selectedSkillDef.name }}</div>
            <div class="text-xs flex items-center gap-1.5 flex-wrap">
              <span :class="skillKindColor[selectedSkillDef.kind]">{{ skillKindLabel[selectedSkillDef.kind] }}</span>
              <span v-if="selectedSkillDef.element" class="text-gray-400">· {{ selectedSkillDef.element }}</span>
            </div>
          </div>
          <button
            type="button"
            class="w-7 h-7 flex items-center justify-center rounded text-base text-gray-300 hover:bg-slate-700"
            @click="selectedSkill = null"
            aria-label="닫기"
          >✕</button>
        </div>

        <!-- 본문 -->
        <div class="px-4 py-3 pb-4 space-y-2 text-sm">
          <p class="text-gray-200 leading-relaxed">{{ selectedSkillDef.description }}</p>
          <div class="flex items-center justify-between pt-2 border-t border-slate-700/60 text-xs">
            <span class="text-stat-mp">소모 MP <span class="font-bold">{{ selectedSkillDef.mp }}</span></span>
            <span v-if="isAttackSkill" class="text-stat-util">발동률 <span class="font-bold">{{ procPct }}%</span></span>
          </div>
        </div>
      </div>
    </div>
    </Teleport>

    <!-- ====================================================== -->
    <!-- 승리 모달 (fixed overlay)                                -->
    <!-- - 패배는 GameOver 화면으로 자동 전환되므로 모달 없음       -->
    <!-- ====================================================== -->
    <Teleport to="body">
    <div
      v-if="combat.ended && combat.victory"
      class="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/60 backdrop-blur-sm animate-fadein"
      @click.self="closeAndAdvance"
    >
      <div
        class="w-full max-w-sm rounded-xl border-2 border-amber-400/70 bg-bg-secondary/95 shadow-[0_0_40px_rgba(251,191,36,0.45)] p-6 space-y-4 text-center"
      >
        <!-- 큰 한글만 — GameOver "사망" / Victory "탑 클리어" 와 동일 톤 -->
        <div class="text-amber-300 text-5xl font-bold tracking-widest leading-tight">승리</div>
        <button
          class="btn-primary w-full min-h-12 text-base font-bold"
          @click="closeAndAdvance"
        >다음 층으로</button>
      </div>
    </div>
    </Teleport>
  </section>
</template>

<style scoped>
@keyframes fadein {
  from { opacity: 0; }
  to   { opacity: 1; }
}
.animate-fadein {
  animation: fadein 180ms ease-out;
}
</style>
