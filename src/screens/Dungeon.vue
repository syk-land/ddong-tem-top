<script setup lang="ts">
import { computed, ref, watch, onMounted, onUnmounted } from 'vue'
import { useGameStore } from '@/stores/game'
import { themeColorClass } from '@/ui/colors'
import HpMpBar from '@/ui/components/HpMpBar.vue'
import ItemName from '@/ui/components/ItemName.vue'
import { CHALLENGES_MAP } from '@/data/challenges'
import GrowthPenaltyPanel from '@/ui/components/GrowthPenaltyPanel.vue'
import StatusBadges from '@/ui/components/StatusBadges.vue'
import StatusModal from '@/ui/components/StatusModal.vue'
import InventoryModal from '@/ui/components/InventoryModal.vue'
import ItemDetail from '@/ui/components/ItemDetail.vue'
import { themeBgUrl, floorContentImage, playerImageUrl, userAvatarLabel } from '@/ui/images'
import type { ItemInstance } from '@/types'

const game = useGameStore()
const c = computed(() => game.run!.character)
const ch = computed(() => game.currentChapterState!)
const floor = computed(() => game.currentFloorEvent)
const inventory = computed(() => game.run!.inventory)
const inventoryCap = computed(() => game.run!.inventoryCap)

const statusOpen = ref(false)
const inventoryOpen = ref(false)
const equipDetail = ref<ItemInstance | null>(null)

function enter() {
  game.enterCurrentFloor()
}

// 활성 챌린지 한 줄 (이름 + 짧은 보상/조건). 여러 개면 쉼표.
const challengeOneLine = computed(() => {
  const keys = game.run?.challengeKeys ?? []
  const items = keys.map((k) => {
    const def = CHALLENGES_MAP[k]
    if (!def) return null
    return def.name
  }).filter((s): s is string => !!s)
  return items.join(' · ')
})

// 자동 진입: 일반몬스터/보스/치유샘/보물 자동 진입.
// 상점/특별이벤트는 사용자 선택을 위해 자동 진입 X.
const AUTO_ENTER_TYPES = new Set(['monster', 'boss', 'healing_spring', 'treasure'])
let autoEnterTimer: ReturnType<typeof setTimeout> | null = null

function tryAutoEnter() {
  if (!game.autoEnter) return
  // 모달이 떠 있으면 자동 진입 막음 (사용자 결정 대기 중)
  if (game.dialog || game.inputDialog || game.listDialog || game.pendingPickup) return
  if (game.tutorialActive) return  // 튜토리얼 활성 동안 자동 진입 보류
  if (game.screen !== 'dungeon') return
  const f = game.currentFloorEvent
  if (!f || f.cleared) return
  if (!AUTO_ENTER_TYPES.has(f.type)) return
  if (autoEnterTimer) clearTimeout(autoEnterTimer)
  // 짧은 지연으로 UI 보여주고 자동 진입 — 속도에 따라 단축
  const delay = Math.max(120, 500 / Math.max(1, game.combatSpeed))
  autoEnterTimer = setTimeout(() => {
    autoEnterTimer = null
    // 한번 더 가드 (타이머 도중 사용자 상호작용으로 상태 변경 가능)
    if (game.autoEnter && game.screen === 'dungeon'
        && !game.dialog && !game.inputDialog && !game.listDialog && !game.pendingPickup) {
      game.enterCurrentFloor()
    }
  }, delay)
}

onMounted(() => {
  // 첫 던전 진입 — 노드 클릭법 안내. 자동 진입 트리거보다 먼저 발화해야 함.
  game.triggerTutorial('first_node')
  // 보물 노드 receiveItem 직후 pendingTreasureTutorial 가 set 된 경우 — 여기서 발화.
  // (Combat 화면에선 인벤 버튼이 없으니 Dungeon 진입 직후로 지연)
  if (game.pendingTreasureTutorial) {
    game.pendingTreasureTutorial = false
    game.triggerTutorial('first_treasure')
  }
  // 챕터 2 1층 진입 시 4배속·자동진입 광고 해금 안내 트리거
  // (챕터 1 보스 클리어 직후 = advance 가 아니라 다음 챕터 첫 화면에서 학습)
  const ch = game.currentChapterState
  if (ch?.chapter === 2 && ch.currentFloor === 0) {
    game.triggerTutorial('first_chapter_clear')
  }
  tryAutoEnter()
})
onUnmounted(() => {
  if (autoEnterTimer) clearTimeout(autoEnterTimer)
})
watch(
  () => [game.screen, game.run?.currentChapterIndex, game.run?.chapters?.[game.run?.currentChapterIndex ?? 0]?.currentFloor, game.autoEnter, game.tutorialActive],
  tryAutoEnter,
)
async function quit() {
  const ok = await game.confirmModal('현재 진행을 저장하고 메인 메뉴로 돌아갑니다.', { title: '메뉴로' })
  if (ok) game.setScreen('menu')
}

const themeClass = computed(() => themeColorClass[ch.value.theme])
const bgUrl = computed(() => themeBgUrl(ch.value.theme))
const floorImage = computed(() =>
  floor.value ? floorContentImage(floor.value.type, ch.value.theme, ch.value.isHard) : null
)
const floorLabel = computed(() => {
  if (!floor.value) return '챕터 클리어'
  const labels: Record<string, string> = {
    monster: '일반 몬스터',
    boss: '보스',
    shop: '상점',
    treasure: '보물상자',
    healing_spring: '회복샘',
    special_event: '특별 이벤트',
  }
  return labels[floor.value.type] ?? floor.value.type
})

// 층 종류별 액센트 — 카드 테두리/glow
const floorAccent = computed(() => {
  const t = floor.value?.type
  switch (t) {
    case 'boss':           return { border: 'border-rose-400/70',   glow: 'shadow-[0_0_24px_rgba(244,63,94,0.30)]',   tag: 'text-rose-300',   tagBg: 'bg-rose-950/60' }
    case 'shop':           return { border: 'border-amber-400/60',  glow: 'shadow-[0_0_24px_rgba(251,191,36,0.25)]',  tag: 'text-amber-300',  tagBg: 'bg-amber-950/60' }
    case 'treasure':       return { border: 'border-purple-400/60', glow: 'shadow-[0_0_24px_rgba(192,132,252,0.25)]', tag: 'text-purple-300', tagBg: 'bg-purple-950/60' }
    case 'healing_spring': return { border: 'border-emerald-400/60',glow: 'shadow-[0_0_24px_rgba(52,211,153,0.25)]',  tag: 'text-emerald-300',tagBg: 'bg-emerald-950/60' }
    case 'special_event':  return { border: 'border-pink-400/60',   glow: 'shadow-[0_0_24px_rgba(236,72,153,0.25)]',  tag: 'text-pink-300',   tagBg: 'bg-pink-950/60' }
    default:               return { border: 'border-slate-500/60',  glow: '',                                          tag: 'text-slate-200',  tagBg: 'bg-slate-800/60' }
  }
})
</script>

<template>
  <section class="flex-1 flex flex-col px-2 py-2 sm:px-3 sm:py-3 gap-2 sm:gap-3 max-w-4xl mx-auto w-full">
    <!-- ① 헤더 — 챕터 정보 좌측, 액션 버튼 우측 -->
    <div class="rounded-lg border border-slate-700/70 bg-bg-secondary/60 backdrop-blur-sm px-3 py-2 flex items-center gap-2">
      <div class="flex-1 min-w-0">
        <div :class="['text-sm font-bold truncate', themeClass]">
          제 {{ ch.chapter }}챕터 · {{ ch.themeName }}
          <span v-if="ch.isHard" class="text-rose-400 ml-1 text-xs">[강화]</span>
        </div>
        <div class="text-xs text-gray-400">
          <span class="font-mono tabular-nums">{{ ch.currentFloor + 1 }}</span>
          <span class="text-gray-600"> / {{ ch.floors.length }}층</span>
        </div>
      </div>
      <button
        class="btn-secondary text-xs min-h-9 px-3 font-bold"
        @click="statusOpen = true"
        title="상태창"
      >상태</button>
      <button
        data-tutorial-target="inventory-btn"
        class="btn-secondary text-xs min-h-9 px-3 font-bold flex items-center gap-1.5"
        @click="inventoryOpen = true"
        title="인벤토리"
      >
        <span>인벤</span>
        <span class="text-xs text-gray-300 tabular-nums">{{ inventory.length }}/{{ inventoryCap }}</span>
      </button>
      <button class="btn-secondary text-xs min-h-9 px-3 font-bold" @click="quit" title="메인 메뉴로">메뉴</button>
    </div>

    <!-- ② 다음 회차 보너스 (실시간 성장 패널티) -->
    <GrowthPenaltyPanel />

    <!-- ③ 층 내용 — 종류별 액센트 -->
    <div
      data-tutorial-target="floor-current"
      :class="[
        'rounded-lg border-2 relative overflow-hidden flex flex-col items-center text-center transition-shadow',
        floorAccent.border,
        floorAccent.glow,
      ]"
      style="min-height: 380px"
    >
      <!-- 챕터 배경 (NPC 이미지 비율 맞지 않을 때 fallback) -->
      <div
        class="absolute inset-0 bg-cover bg-center"
        :style="{ backgroundImage: `url(${bgUrl})` }"
      />

      <!-- NPC/콘텐츠 이미지 — 카드 전체 가득 -->
      <img
        v-if="floorImage"
        :src="floorImage"
        :alt="floorLabel"
        class="absolute inset-0 w-full h-full object-cover"
        @error="(e) => ((e.target as HTMLImageElement).style.display = 'none')"
      />

      <!-- 다크 그라데이션 — 텍스트 가독성 (상단 약간, 하단 강하게) -->
      <div class="absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-black/75 pointer-events-none" />

      <!-- 종류 태그 (좌상단) -->
      <div :class="['relative z-10 self-start m-2 px-2.5 py-1 rounded-md text-xs font-bold border', floorAccent.border, floorAccent.tag, floorAccent.tagBg]">
        {{ floorLabel }}
      </div>

      <!-- 하단 진입 박스 -->
      <div class="relative z-10 w-full mt-auto bg-black/65 backdrop-blur-sm py-3 px-3 flex flex-col items-center gap-2 border-t border-white/10">
        <div class="flex items-baseline gap-2">
          <span class="text-2xl font-bold drop-shadow-lg" :class="themeClass">{{ ch.currentFloor + 1 }}F</span>
          <span class="text-base text-white/95 font-bold drop-shadow-md">{{ floorLabel }}</span>
        </div>
        <button
          data-tutorial-target="enter-floor-btn"
          class="btn-primary px-6 w-full max-w-xs min-h-12 text-base font-bold"
          @click="enter"
        >진입</button>
      </div>
    </div>

    <!-- ④ 내 상태 — cyan 액센트 (Combat 플레이어 카드와 일관) -->
    <div class="rounded-lg border border-cyan-500/40 bg-bg-secondary/60 backdrop-blur-sm shadow-[0_0_18px_rgba(34,211,238,0.12)_inset]">
      <!-- 헤더 행: 아바타 + 라벨 + 골드 칩 -->
      <div class="px-3 py-2 flex items-center gap-2 border-b border-cyan-500/20 bg-cyan-950/20">
        <img
          v-if="game.runAvatar"
          :src="playerImageUrl(game.runAvatar)"
          :alt="userAvatarLabel(game.runAvatar)"
          class="w-9 h-9 rounded-full object-cover border-2 border-cyan-500/40 shrink-0"
          @error="(e) => ((e.target as HTMLImageElement).style.display = 'none')"
        />
        <div class="text-sm font-bold text-cyan-100 truncate flex-1">
          {{ game.runAvatar ? userAvatarLabel(game.runAvatar) : '모험가' }}
        </div>
        <div class="px-2.5 py-1 rounded-md bg-amber-950/60 border border-amber-400/40 text-stat-luck text-sm font-bold font-mono shrink-0 flex items-center gap-1">
          <span class="text-amber-400">⬢</span>
          <span class="tabular-nums">{{ c.gold }}G</span>
        </div>
      </div>

      <!-- 본문 -->
      <div class="px-3 py-2.5 space-y-2">
        <div class="grid grid-cols-2 gap-3">
          <HpMpBar :current="c.hp" :max="c.maxHp" kind="hp" />
          <HpMpBar :current="c.mp" :max="c.maxMp" kind="mp" />
        </div>

        <!-- 챌린지 줄 (있을 때만) -->
        <div v-if="challengeOneLine" class="text-xs text-trait-special truncate flex items-center gap-1">
          <span class="shrink-0">🎯</span>
          <span class="truncate">{{ challengeOneLine }}</span>
        </div>

        <div class="grid grid-cols-2 gap-2">
          <button
            type="button"
            class="bg-bg-tertiary/80 rounded-md px-2 py-2 border border-slate-700/50 text-left hover:border-cyan-500/40 hover:bg-bg-tertiary transition-colors active:scale-[0.98] flex items-center min-h-11 whitespace-nowrap overflow-hidden"
            :disabled="!c.weapon"
            @click="c.weapon && (equipDetail = c.weapon)"
            :title="c.weapon ? '장비 상세 보기' : '장착된 무기 없음'"
          >
            <ItemName :item="c.weapon" compact />
          </button>
          <button
            type="button"
            class="bg-bg-tertiary/80 rounded-md px-2 py-2 border border-slate-700/50 text-left hover:border-cyan-500/40 hover:bg-bg-tertiary transition-colors active:scale-[0.98] flex items-center min-h-11 whitespace-nowrap overflow-hidden"
            :disabled="!c.armor"
            @click="c.armor && (equipDetail = c.armor)"
            :title="c.armor ? '장비 상세 보기' : '장착된 갑옷 없음'"
          >
            <ItemName :item="c.armor" compact />
          </button>
        </div>

        <StatusBadges v-if="c.statuses.length" :statuses="c.statuses" />
      </div>
    </div>

    <!-- 빈 공간 (flex spacer) -->
    <div class="flex-1" />

    <!-- 모달 -->
    <StatusModal :open="statusOpen" @close="statusOpen = false" />
    <InventoryModal :open="inventoryOpen" @close="inventoryOpen = false" />

    <!-- 장비 상세 모달 -->
    <Teleport to="body">
    <div
      v-if="equipDetail"
      class="fixed inset-0 z-50 flex items-center justify-center px-3 py-6 bg-black/70 backdrop-blur-sm"
      @click.self="equipDetail = null"
    >
      <div class="w-full max-w-md max-h-[88vh] overflow-y-auto rounded-xl border-2 border-cyan-500/50 bg-bg-secondary/95 shadow-[0_0_30px_rgba(34,211,238,0.30)]">
        <div class="sticky top-0 z-10 px-3 py-2 flex items-center justify-between bg-cyan-950/80 backdrop-blur border-b border-cyan-500/40">
          <div class="text-sm font-bold text-cyan-100">
            장비 상세
            <span class="text-cyan-300/70 text-xs ml-1">{{ equipDetail.kind === 'weapon' ? '· 무기' : '· 갑옷' }}</span>
          </div>
          <button
            type="button"
            class="w-8 h-8 flex items-center justify-center rounded text-base text-gray-200 hover:bg-slate-700"
            @click="equipDetail = null"
            aria-label="닫기"
          >✕</button>
        </div>
        <div class="p-3">
          <ItemDetail :item="equipDetail" :character="c" />
        </div>
      </div>
    </div>
    </Teleport>
  </section>
</template>
