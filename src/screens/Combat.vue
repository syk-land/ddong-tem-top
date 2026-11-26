<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useGameStore } from '@/stores/game'
import { SKILLS } from '@/data/skills'
import { RELICS } from '@/data/relics'
import { getActiveResonances, RESONANCE_INFO } from '@/core/junkSynergy'
import HpMpBar from '@/ui/components/HpMpBar.vue'
import ItemName from '@/ui/components/ItemName.vue'
import StatusBadges from '@/ui/components/StatusBadges.vue'
import { logColorClass, logPrefix } from '@/ui/colors'
import { themeBgUrl, skillIconUrl, monsterImageUrl, playerBustUrl, realBossImageUrl } from '@/ui/images'
import { sfx } from '@/ui/sound'
import { useI18n } from '@/lib/i18n'

const game = useGameStore()
const { t, td, lang } = useI18n()
const combat = computed(() => game.combat!)
const player = computed(() => combat.value.player)
const monsters = computed(() => combat.value.monsters)
const aliveMonsterCount = computed(() => monsters.value.filter((m) => m.hp > 0).length)
const log = computed(() => combat.value.log)
const logEl = ref<HTMLElement | null>(null)

const playerGauge = computed(() => Math.min(100, combat.value.player.actionGauge))
const surgeGauge = computed(() => Math.min(100, Math.max(0, combat.value?.surgeGauge ?? 0)))
const surgeReady = computed(() => !combat.value?.ended && surgeGauge.value >= 100)
const activeResonances = computed(() => {
  if (!combat.value?.player) return []
  return getActiveResonances(combat.value.player).map((id) => RESONANCE_INFO[id])
})
const surgeFlash = ref(false)
const bgUrl = computed(() => {
  const ch = game.currentChapterState
  return ch ? themeBgUrl(ch.theme) : ''
})
const isRealBoss = computed(() => !!game.realBossMonster && !!game.realBossTheme)
const realBossImg = computed(() => game.realBossTheme ? realBossImageUrl(game.realBossTheme) : null)

// ============================================================
// 피격 이펙트 (크리티컬/강타 미세 화면 흔들림 + 임팩트 플래시 + 팝업)
// ============================================================
interface DamageEvent {
  id: number
  monsterIdx: number
  amount: number
  isCrit: boolean
  isHeavy: boolean
  kind?: 'damage' | 'miss'
}
const damageEvents = ref<DamageEvent[]>([])
const shakingIdx = ref<Set<number>>(new Set())
const screenShakeMode = ref<'none' | 'light' | 'strong'>('none')
const critFlash = ref(false)
const heavyFlash = ref(false)
const previousHp = ref<number[]>([])
let dmgIdCounter = 0

let screenShakeTimer: ReturnType<typeof setTimeout> | null = null
let critFlashTimer: ReturnType<typeof setTimeout> | null = null
let heavyFlashTimer: ReturnType<typeof setTimeout> | null = null
let playerShakeTimer: ReturnType<typeof setTimeout> | null = null
let surgeFlashTimer: ReturnType<typeof setTimeout> | null = null

function triggerScreenShake(mode: 'light' | 'strong', durationMs: number) {
  // strong 흔들림이 진행 중이면 light 로 덮어쓰지 않음
  if (screenShakeMode.value === 'strong' && mode === 'light') return
  screenShakeMode.value = mode
  if (screenShakeTimer) clearTimeout(screenShakeTimer)
  screenShakeTimer = setTimeout(() => {
    screenShakeMode.value = 'none'
    screenShakeTimer = null
  }, durationMs)
}

function triggerCritFlash(durationMs = 220) {
  critFlash.value = true
  if (critFlashTimer) clearTimeout(critFlashTimer)
  critFlashTimer = setTimeout(() => {
    critFlash.value = false
    critFlashTimer = null
  }, durationMs)
}

function triggerHeavyFlash(durationMs = 180) {
  heavyFlash.value = true
  if (heavyFlashTimer) clearTimeout(heavyFlashTimer)
  heavyFlashTimer = setTimeout(() => {
    heavyFlash.value = false
    heavyFlashTimer = null
  }, durationMs)
}

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
        const isCrit = !!recentLog && (recentLog.kind === 'critical' || /크리티컬|CRIT/i.test(recentLog.text))
        const maxHp = monsters.value[i]?.maxHp || 1
        const isHeavy = !isCrit && delta / maxHp >= 0.22
        damageEvents.value.push({ id, monsterIdx: i, amount: delta, isCrit, isHeavy, kind: 'damage' })
        // 고속 배속 시 DOM 과부하 방지 (최대 12개 유지)
        if (damageEvents.value.length > 12) damageEvents.value.shift()
        shakingIdx.value.add(i)
        if (isCrit) {
          triggerScreenShake('strong', 280)
          triggerCritFlash(220)
        } else if (isHeavy) {
          triggerScreenShake('light', 200)
          triggerHeavyFlash(160)
        }
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
// 플레이어 피격 / 회복 이펙트
// ============================================================
interface PlayerDmgEvent {
  id: number
  amount: number
  kind: 'damage' | 'heal' | 'miss'
  isHeavy?: boolean
}
const playerDamageEvents = ref<PlayerDmgEvent[]>([])
const playerShaking = ref(false)
const prevPlayerHp = ref(combat.value?.player.hp ?? 0)

// ============================================================
// v11: 액션 / 허점 배지 팝업 & 시간의 파동 1버튼 + 히트스톱
// ============================================================
interface FloatingBadge {
  id: number
  target: 'player' | 'monster'
  monsterIdx?: number
  text: string
  tone: 'gold' | 'cyan' | 'rose'
}
const floatingBadges = ref<FloatingBadge[]>([])
let lastBadgeId = 0

// 새 CombatContext 인스턴스로 교체 시 (예: 프롤로그 균열 조우전 진입) 로컬 상태 및 ticker 초기화
watch(
  () => game.combat,
  (next) => {
    if (!next) return
    lastBadgeId = 0
    floatingBadges.value = []
    previousHp.value = next.monsters.map((m) => m.hp)
    prevPlayerHp.value = next.player.hp
    if (!next.ended && !game.paused && !game.tutorialActive) {
      restartTicker()
    }
  }
)

watch(
  () => combat.value?.badges.length ?? 0,
  () => {
    const list = combat.value?.badges ?? []
    for (const b of list) {
      if (b.id <= lastBadgeId) continue
      lastBadgeId = b.id
      floatingBadges.value.push({ ...b })
      if (b.tone === 'gold') sfx.loophole()
      else if (b.text.includes('COUNTER')) sfx.counter()
      const bid = b.id
      setTimeout(() => {
        floatingBadges.value = floatingBadges.value.filter((x) => x.id !== bid)
      }, 1050)
    }
  }
)

function badgesForMonster(idx: number): FloatingBadge[] {
  return floatingBadges.value.filter((b) => b.target === 'monster' && (b.monsterIdx ?? 0) === idx)
}
const playerBadges = computed(() => floatingBadges.value.filter((b) => b.target === 'player'))

function onTriggerSurge() {
  if (!surgeReady.value) return
  const ok = game.triggerCombatSurge()
  if (!ok) return
  // 120ms 히트스톱 + 강한 화면 흔들림 + 시안 임팩트 플래시
  stopAutoTick()
  triggerScreenShake('strong', 260)
  surgeFlash.value = true
  setTimeout(() => {
    if (!combat.value?.ended && !game.paused && !game.tutorialActive) {
      startAutoTick()
    }
  }, 120)
  if (surgeFlashTimer) clearTimeout(surgeFlashTimer)
  surgeFlashTimer = setTimeout(() => {
    surgeFlash.value = false
    surgeFlashTimer = null
  }, 280)
}

watch(
  () => combat.value?.player.hp,
  (hp) => {
    if (hp === undefined) return
    const delta = prevPlayerHp.value - hp
    if (delta > 0) {
      const id = ++dmgIdCounter
      const maxHp = combat.value?.player.maxHp || 1
      const isHeavy = delta / maxHp >= 0.2
      playerDamageEvents.value.push({ id, amount: delta, kind: 'damage', isHeavy })
      if (playerDamageEvents.value.length > 8) playerDamageEvents.value.shift()
      playerShaking.value = true
      if (isHeavy) triggerScreenShake('light', 220)
      setTimeout(() => {
        playerDamageEvents.value = playerDamageEvents.value.filter((e) => e.id !== id)
      }, 900)
      if (playerShakeTimer) clearTimeout(playerShakeTimer)
      playerShakeTimer = setTimeout(() => {
        playerShaking.value = false
        playerShakeTimer = null
      }, 320)
    } else if (delta < 0 && prevPlayerHp.value > 0) {
      // 전투 중 회복 팝업 (+HP)
      const healAmount = -delta
      const id = ++dmgIdCounter
      playerDamageEvents.value.push({ id, amount: healAmount, kind: 'heal' })
      if (playerDamageEvents.value.length > 8) playerDamageEvents.value.shift()
      setTimeout(() => {
        playerDamageEvents.value = playerDamageEvents.value.filter((e) => e.id !== id)
      }, 900)
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
const skillKindLabel: Record<string, () => string> = {
  physical_atk: () => t('combat.skillKind.physicalAtk', '물리 공격'),
  physical_def: () => t('combat.skillKind.physicalDef', '물리 방어'),
  magic_atk: () => t('combat.skillKind.magicAtk', '마법 공격'),
  magic_def: () => t('combat.skillKind.magicDef', '마법 방어'),
}
const skillKindColor: Record<string, string> = {
  physical_atk: 'text-stat-phys_atk',
  physical_def: 'text-stat-phys_def',
  magic_atk: 'text-stat-mag_atk',
  magic_def: 'text-stat-mag_def',
}

const BASE_INTERVAL = 100

let ticker: number | null = null
function startAutoTick() {
  if (ticker) return
  const speed = Math.max(1, game.combatSpeed)
  // 6배까지는 interval 단축 (1 tick/call). 6 초과는 interval 을 10ms 로 고정하고
  // 한 setInterval 콜에서 여러 번 tick 을 호출(배치) — setInterval 최소 가드(10ms)
  // 이상으로 가속 가능. 시각 효과(데미지 팝업/로그)는 같은 프레임에 누적되지만
  // 자동 모드 사용자는 결과만 보는 흐름이라 큰 문제 없음.
  // ticksPerCall 은 안드로이드 webview 단일 스레드 점유로 setTimeout / Promise
  // 스케줄(maybeAutoAdvance 등) 이 못 끼어드는 현상을 막기 위해 8 로 cap. 100배속
  // 같은 경우 실 처리량은 (1000ms / 10ms) × 8 = 800 tick/s → BASE_INTERVAL=60ms
  // 기준으로 약 48배 정도. 그 이상 가속은 시각적 의미가 적고 안정성 우선.
  const interval = Math.max(10, Math.round(BASE_INTERVAL / speed))
  const callsPerSec = 1000 / interval
  const targetTicksPerSec = speed * (1000 / BASE_INTERVAL)
  const ticksPerCall = Math.min(8, Math.max(1, Math.round(targetTicksPerSec / callsPerSec)))
  ticker = window.setInterval(() => {
    for (let i = 0; i < ticksPerCall; i++) {
      if (!combat.value || combat.value.ended) {
        stopAutoTick()
        return
      }
      game.tickStep()
    }
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
  // 보상 카드(ItemAnnounceModal) 떠 있으면 자동 진입 보류. 사용자가 카드 확인 →
  // clearItemAnnounce 가 closeCombat 직접 호출 (queue 비워진 시점) → 그때 진입.
  // 일찍 closeCombat 호출하면 combat=null 후 advance 가 queue 가드로 return 해
  // screen='combat' + combat=null 의 stuck 상태가 된다.
  if (game.itemAnnounceQueue.length > 0) return
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
  if (screenShakeTimer) clearTimeout(screenShakeTimer)
  if (critFlashTimer) clearTimeout(critFlashTimer)
  if (heavyFlashTimer) clearTimeout(heavyFlashTimer)
  if (playerShakeTimer) clearTimeout(playerShakeTimer)
  if (surgeFlashTimer) clearTimeout(surgeFlashTimer)
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
          case 'miss': {
            sfx.miss()
            // 회피/빗나감 콜아웃 팝업 (고속 자동화 모드에서는 과도한 DOM 생성 생략)
            if (game.combatSpeed <= 4) {
              const id = ++dmgIdCounter
              const isPlayerDodge = /회피|피했|dodg/i.test(entry.text)
              if (isPlayerDodge) {
                playerDamageEvents.value.push({ id, amount: 0, kind: 'miss' })
                setTimeout(() => {
                  playerDamageEvents.value = playerDamageEvents.value.filter((e) => e.id !== id)
                }, 800)
              } else {
                const targetIdx = Math.max(0, monsters.value.findIndex((m) => m.hp > 0))
                damageEvents.value.push({ id, monsterIdx: targetIdx, amount: 0, isCrit: false, isHeavy: false, kind: 'miss' })
                setTimeout(() => {
                  damageEvents.value = damageEvents.value.filter((e) => e.id !== id)
                }, 800)
              }
            }
            break
          }
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
    <div
      :class="[
        'relative flex-1 flex flex-col rounded-lg overflow-hidden border border-slate-700 transition-transform',
        screenShakeMode === 'strong' ? 'animate-shake-strong' : (screenShakeMode === 'light' ? 'animate-shake' : ''),
      ]"
    >
      <!-- 챕터 배경 -->
      <div
        v-if="bgUrl"
        class="absolute inset-0 bg-cover bg-center"
        :style="{ backgroundImage: `url(${bgUrl})` }"
      />
      <div class="absolute inset-0 bg-black/50" />
      <!-- 크리티컬 임팩트 플래시 -->
      <div
        v-if="critFlash"
        class="absolute inset-0 z-20 pointer-events-none bg-amber-300/15 shadow-[inset_0_0_50px_rgba(251,191,36,0.45)] transition-opacity"
      />
      <!-- 강타 임팩트 플래시 -->
      <div
        v-if="heavyFlash"
        class="absolute inset-0 z-20 pointer-events-none bg-orange-300/10 shadow-[inset_0_0_38px_rgba(251,146,60,0.35)] transition-opacity"
      />
      <!-- 시간의 파동 임팩트 플래시 -->
      <div
        v-if="surgeFlash"
        class="absolute inset-0 z-20 pointer-events-none bg-cyan-300/20 shadow-[inset_0_0_70px_rgba(34,211,238,0.65)] transition-opacity"
      />
      <!-- 플레이어 피격 레드 비네트 -->
      <div
        v-if="playerShaking"
        class="absolute inset-0 z-20 pointer-events-none shadow-[inset_0_0_55px_rgba(239,68,68,0.55)] transition-opacity"
      />
      <!-- 일시정지 배너 (Space 키로 토글) -->
      <button
        v-if="game.paused && !combat.ended && !game.tutorialActive"
        type="button"
        class="absolute top-2 left-1/2 -translate-x-1/2 z-30 px-3 py-1 rounded-full bg-amber-950/90 border border-amber-400/70 text-amber-200 text-xs font-bold shadow-[0_0_16px_rgba(251,191,36,0.45)] flex items-center gap-1.5 hover:bg-amber-900/90 transition"
        :title="t('combat.pausedHint', 'Space 키 또는 클릭으로 재개')"
        @click="game.setPaused(false)"
      >
        <span>⏸</span>
        <span>{{ t('combat.pausedBadge', '일시정지') }}</span>
      </button>

      <div class="relative z-10 flex flex-col gap-2 p-2 sm:gap-3 sm:p-3">
        <!-- ====================================================== -->
        <!-- 적 카드 — rose 액센트                                   -->
        <!-- ====================================================== -->
        <div class="rounded-lg overflow-hidden border border-rose-500/40 bg-bg-secondary/55 backdrop-blur-sm shadow-[0_0_20px_rgba(244,63,94,0.15)_inset]">
          <!-- 헤더 -->
          <div class="px-3 py-1.5 bg-rose-950/40 border-b border-rose-500/30 flex items-center justify-between">
            <span class="text-xs font-bold text-rose-300 tracking-wide">
              <span v-if="isRealBoss">{{ t('combat.realBossLabel', '⚔ 도전 보스') }}</span>
              <span v-else>{{ t('combat.enemyCount', `⚔ 적 ${aliveMonsterCount} / ${monsters.length}`, { alive: aliveMonsterCount, total: monsters.length }) }}</span>
            </span>
            <span class="text-xs text-rose-200/60">
              {{ isRealBoss ? t('combat.realBossSub', '진짜 보스전') : (combat.ended ? t('combat.endedSub', '전투 종료') : t('combat.ongoingSub', '진행 중')) }}
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
                :alt="td('monster', m.template.name)"
                decoding="async"
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
                class="combat-callout absolute left-1/2 top-2 pointer-events-none font-display font-black animate-damage-float whitespace-nowrap"
                :class="ev.kind === 'miss'
                  ? 'text-sm tracking-widest text-slate-300 drop-shadow-[0_1px_4px_rgba(0,0,0,0.9)]'
                  : ev.isCrit
                    ? 'text-3xl text-amber-300 drop-shadow-[0_0_8px_rgba(245,158,11,0.95)]'
                    : ev.isHeavy
                      ? 'text-[26px] text-orange-300 drop-shadow-[0_0_6px_rgba(251,146,60,0.9)]'
                      : 'text-2xl text-status-burn drop-shadow-[0_0_4px_rgba(239,68,68,0.85)]'"
              >
                <template v-if="ev.kind === 'miss'">{{ t('combat.miss', 'MISS') }}</template>
                <template v-else>
                  <span v-if="ev.isCrit" class="text-xs tracking-wider mr-0.5 text-amber-200">CRIT</span>-{{ ev.amount }}<span v-if="ev.isCrit" class="text-sm ml-0.5">✦</span>
                </template>
              </div>
              <div
                v-for="b in badgesForMonster(idx)"
                :key="'mb-' + b.id"
                class="absolute left-1/2 -top-2 -translate-x-1/2 z-20 pointer-events-none px-2 py-0.5 rounded-full text-[11px] font-bold whitespace-nowrap animate-damage-float border shadow-lg"
                :class="b.tone === 'gold'
                  ? 'bg-amber-950/90 text-amber-200 border-amber-400/80'
                  : b.tone === 'cyan'
                    ? 'bg-cyan-950/90 text-cyan-200 border-cyan-400/80'
                    : 'bg-rose-950/90 text-rose-200 border-rose-400/80'"
              >{{ b.text }}</div>
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
                  <span v-if="m.hp <= 0" class="line-through text-gray-500">{{ td('monster', m.template.name) }}</span>
                  <span v-else>{{ td('monster', m.template.name) }}</span>
                  <span v-if="m.isBoss" class="text-grade-legend text-xs ml-1 font-bold">{{ t('combat.bossBadge', '[보스]') }}</span>
                  <span v-if="m.isMimic" class="text-status-bleed text-xs ml-1">{{ t('combat.mimicBadge', '미믹') }}</span>
                  <span v-if="m.hp <= 0" class="text-gray-500 text-xs ml-1">{{ t('combat.killed', '처치됨') }}</span>
                </h3>
                <span class="text-xs text-stat-speed shrink-0">⚡{{ m.speed }}</span>
              </div>
              <HpMpBar :current="m.hp" :max="m.maxHp" kind="hp" />
              <!-- 액션 게이지 -->
              <div class="flex items-center gap-1.5">
                <span class="text-xs text-rose-300/70 font-mono w-8">{{ t('combat.action', '행동') }}</span>
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
                  :src="playerBustUrl(game.runAvatar)"
                  :alt="t('combat.playerAlt', '플레이어')"
                  decoding="async"
                  :class="[
                    'w-32 h-32 sm:w-36 sm:h-36 object-cover rounded-lg drop-shadow-2xl border-2 border-cyan-500/40 shadow-[0_0_14px_rgba(34,211,238,0.3)]',
                    playerShaking ? 'animate-shake animate-flash-red' : '',
                  ]"
                  @error="(e) => ((e.target as HTMLImageElement).style.display = 'none')"
                />
                <div
                  v-for="ev in playerDamageEvents"
                  :key="ev.id"
                  class="combat-callout absolute left-1/2 top-2 pointer-events-none font-bold animate-damage-float whitespace-nowrap"
                  :class="ev.kind === 'heal'
                    ? 'text-xl text-emerald-300 drop-shadow-[0_0_6px_rgba(52,211,153,0.9)]'
                    : ev.kind === 'miss'
                      ? 'text-sm tracking-widest text-cyan-200 drop-shadow-[0_1px_4px_rgba(0,0,0,0.9)]'
                      : ev.isHeavy
                        ? 'text-3xl text-rose-400 drop-shadow-[0_0_8px_rgba(244,63,94,0.95)]'
                        : 'text-2xl text-status-burn drop-shadow-[0_0_3px_rgba(239,68,68,0.8)]'"
                >
                  <template v-if="ev.kind === 'heal'">+{{ ev.amount }}</template>
                  <template v-else-if="ev.kind === 'miss'">{{ t('combat.dodge', 'DODGE') }}</template>
                  <template v-else>-{{ ev.amount }}</template>
                </div>
                <div
                  v-for="b in playerBadges"
                  :key="'pb-' + b.id"
                  class="absolute left-1/2 -top-2 -translate-x-1/2 z-20 pointer-events-none px-2 py-0.5 rounded-full text-[11px] font-bold whitespace-nowrap animate-damage-float border shadow-lg"
                  :class="b.tone === 'gold'
                    ? 'bg-amber-950/90 text-amber-200 border-amber-400/80'
                    : 'bg-cyan-950/90 text-cyan-200 border-cyan-400/80'"
                >{{ b.text }}</div>
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

            <!-- 플레이어 액션 게이지 -->
            <div class="flex items-center gap-1.5">
              <span class="text-xs text-cyan-300/70 font-mono w-8">{{ t('combat.action', '행동') }}</span>
              <div class="flex-1 h-[3px] bg-slate-900/70 rounded-full overflow-hidden">
                <div class="h-full bg-cyan-400/80 transition-all" :style="{ width: playerGauge + '%' }" />
              </div>
            </div>

            <!-- 활성화된 똥템 공명 & 유물 배지 -->
            <div v-if="activeResonances.length > 0 || (player.relics && player.relics.length > 0)" class="flex flex-wrap items-center gap-1.5 pt-0.5">
              <span
                v-for="r in activeResonances"
                :key="r.id"
                class="px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-950/70 text-amber-200 border border-amber-400/60 shadow-[0_0_8px_rgba(251,191,36,0.25)]"
                :title="lang === 'en' ? r.descEn : r.descKo"
              >[RES] {{ lang === 'en' ? r.nameEn : r.nameKo }}</span>
              <span
                v-for="rid in (player.relics ?? [])"
                :key="rid"
                class="px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-950/70 text-emerald-200 border border-emerald-400/50"
                :title="lang === 'en' ? RELICS[rid].descEn : RELICS[rid].descKo"
              >[RELIC] {{ lang === 'en' ? RELICS[rid].nameEn : RELICS[rid].nameKo }}</span>
            </div>

            <!-- v11: 시간의 파동 (전투 1버튼 능동 개입) -->
            <div class="pt-1">
              <button
                type="button"
                :disabled="!surgeReady"
                @click="onTriggerSurge"
                class="relative w-full min-h-10 rounded-lg overflow-hidden border font-bold text-xs tracking-wide transition active:scale-[0.98]"
                :class="surgeReady
                  ? 'border-cyan-300 bg-gradient-to-r from-cyan-600/90 via-sky-500/90 to-amber-500/90 text-white shadow-[0_0_18px_rgba(34,211,238,0.65)] animate-pulse cursor-pointer'
                  : 'border-slate-700/80 bg-slate-900/70 text-slate-400 cursor-default'"
              >
                <div
                  v-if="!surgeReady"
                  class="absolute inset-y-0 left-0 bg-gradient-to-r from-cyan-700/50 to-cyan-400/50 transition-all duration-150"
                  :style="{ width: surgeGauge + '%' }"
                />
                <span class="relative z-10 flex items-center justify-center gap-1.5">
                  <span>⚡</span>
                  <span v-if="surgeReady">{{ t('combat.surgeReady', '시간의 파동 발동! (확정 크리 ×1.5 · 적 지연)') }}</span>
                  <span v-else>{{ t('combat.surgeCharging', `시간의 파동 충전 중 ${surgeGauge}%`, { pct: surgeGauge }) }}</span>
                </span>
              </button>
            </div>

            <!-- 자동 발동 스킬 — 칩 (탭하면 상세 모달) -->
            <div v-if="skillKeys.length > 0" class="flex flex-wrap items-center gap-1.5 text-xs pt-0.5">
              <span class="text-cyan-300/80 text-xs">{{ t('combat.auto', '자동') }}</span>
              <button
                v-for="key in skillKeys"
                :key="key"
                type="button"
                class="px-2 py-1 rounded-md bg-slate-800/80 text-log-skill flex items-center gap-1 border border-cyan-500/20 hover:bg-slate-700/80 active:scale-95 transition-transform"
                :title="t('combat.skillDetailTooltip', `${td('skill', key) || (SKILLS[key]?.name ?? key)} — 상세 보기`, { name: td('skill', key) || (SKILLS[key]?.name ?? key) })"
                @click="selectedSkill = key"
              >
                <img
                  :src="skillIconUrl(key)"
                  :alt="td('skill', key) || key"
                  decoding="async"
                  class="w-4 h-4 object-contain"
                  @error="(e) => ((e.target as HTMLImageElement).style.display = 'none')"
                />
                <span>{{ td('skill', key) || SKILLS[key]?.name || key }}</span>
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
            <span class="text-xs font-bold text-slate-300">{{ t('combat.logLabel', '📜 전투 로그') }}</span>
            <span class="text-xs text-slate-400">
              {{ logExpanded ? t('combat.logCollapse', '접기 ▴') : t('combat.logExpand', '펼치기 ▾') }}
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
            :alt="td('skill', selectedSkill!) || selectedSkillDef.name"
            class="w-10 h-10 object-contain drop-shadow"
            @error="(e) => ((e.target as HTMLImageElement).style.display = 'none')"
          />
          <div class="flex-1 min-w-0">
            <div class="text-base font-bold text-cyan-200 truncate">{{ td('skill', selectedSkill!) || selectedSkillDef.name }}</div>
            <div class="text-xs flex items-center gap-1.5 flex-wrap">
              <span :class="skillKindColor[selectedSkillDef.kind]">{{ skillKindLabel[selectedSkillDef.kind]?.() }}</span>
              <span v-if="selectedSkillDef.element" class="text-gray-400">· {{ td('element', selectedSkillDef.element) }}</span>
            </div>
          </div>
          <button
            type="button"
            class="w-7 h-7 flex items-center justify-center rounded text-base text-gray-300 hover:bg-slate-700"
            @click="selectedSkill = null"
            :aria-label="t('common.close', '닫기')"
          >✕</button>
        </div>

        <!-- 본문 -->
        <div class="px-4 py-3 pb-4 space-y-2 text-sm">
          <p class="text-gray-200 leading-relaxed">{{ td('skill.desc', selectedSkill!) || selectedSkillDef.description }}</p>
          <div class="flex items-center justify-between pt-2 border-t border-slate-700/60 text-xs">
            <span class="text-stat-mp">{{ t('combat.mpCost', '소모 MP') }} <span class="font-bold">{{ selectedSkillDef.mp }}</span></span>
            <span v-if="isAttackSkill" class="text-stat-util">{{ t('combat.procRate', '발동률') }} <span class="font-bold">{{ procPct }}%</span></span>
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
        <div class="text-amber-300 text-5xl font-bold tracking-widest leading-tight">{{ t('combat.victoryTitle', '승리') }}</div>
        <button
          class="btn-primary w-full min-h-12 text-base font-bold"
          @click="closeAndAdvance"
        >{{ t('combat.nextFloor', '다음 층으로') }}</button>
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
