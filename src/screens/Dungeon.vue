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
import { themeBgUrl, floorContentImage, playerImageUrl, userAvatarLabel } from '@/ui/images'

const game = useGameStore()
const c = computed(() => game.run!.character)
const ch = computed(() => game.currentChapterState!)
const floor = computed(() => game.currentFloorEvent)
const inventory = computed(() => game.run!.inventory)
const inventoryCap = computed(() => game.run!.inventoryCap)

const statusOpen = ref(false)
const inventoryOpen = ref(false)

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

onMounted(tryAutoEnter)
onUnmounted(() => {
  if (autoEnterTimer) clearTimeout(autoEnterTimer)
})
watch(
  () => [game.screen, game.run?.currentChapterIndex, game.run?.chapters?.[game.run?.currentChapterIndex ?? 0]?.currentFloor, game.autoEnter],
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
</script>

<template>
  <section class="flex-1 flex flex-col px-3 py-3 gap-3 max-w-4xl mx-auto w-full">
    <!-- ① 최상단: 챕터 정보 + 액션 버튼 1줄 -->
    <div class="panel-tight flex items-center gap-2">
      <div class="flex-1 min-w-0">
        <div :class="['text-sm font-bold truncate', themeClass]">
          제 {{ ch.chapter }}챕터 · {{ ch.themeName }}
          <span v-if="ch.isHard" class="text-rose-400 ml-1 text-xs">[강화]</span>
        </div>
        <div class="text-xs text-gray-500">{{ ch.currentFloor + 1 }} / {{ ch.floors.length }}층</div>
      </div>
      <button
        class="btn-secondary text-xs px-3 py-1"
        @click="statusOpen = true"
        title="상태창"
      >
        상태
      </button>
      <button
        class="btn-secondary text-xs px-3 py-1 flex items-center gap-1 relative"
        @click="inventoryOpen = true"
        title="인벤토리"
      >
        인벤
        <span class="text-[10px] text-gray-400">{{ inventory.length }}/{{ inventoryCap }}</span>
      </button>
      <button class="btn-secondary text-xs px-3 py-1" @click="quit" title="메인 메뉴로">
        메뉴
      </button>
    </div>

    <!-- ② 다음 회차 보너스 (실시간 성장 패널티) -->
    <GrowthPenaltyPanel />

    <!-- ③ 층 내용 + 진입 (챕터 배경 + NPC 이미지 ×2.5) -->
    <div
      class="panel relative overflow-hidden p-0 flex flex-col items-center text-center"
      style="min-height: 420px"
    >
      <!-- 챕터 배경 -->
      <div
        class="absolute inset-0 bg-cover bg-center"
        :style="{ backgroundImage: `url(${bgUrl})` }"
      />
      <!-- 어두운 오버레이 -->
      <div class="absolute inset-0 bg-gradient-to-b from-black/20 via-black/30 to-black/70" />
      <!-- NPC/콘텐츠 이미지 (가로세로 ~2.5배) -->
      <img
        v-if="floorImage"
        :src="floorImage"
        :alt="floorLabel"
        class="absolute inset-x-0 top-2 mx-auto max-h-[360px] max-w-[80%] object-contain drop-shadow-2xl"
        @error="(e) => ((e.target as HTMLImageElement).style.display = 'none')"
      />
      <!-- 텍스트 박스 (절반 높이) -->
      <div class="relative z-10 w-full mt-auto bg-black/55 backdrop-blur-sm py-2 px-3 flex flex-col items-center gap-1">
        <div class="flex items-baseline gap-2">
          <span class="text-xl font-bold drop-shadow-lg" :class="themeClass">{{ ch.currentFloor + 1 }}F</span>
          <span class="text-sm text-white drop-shadow-md">{{ floorLabel }}</span>
        </div>
        <button class="btn-primary px-6 py-1.5 text-sm w-full max-w-xs" @click="enter">진입</button>
      </div>
    </div>

    <!-- ④ 내 상태 -->
    <div class="panel space-y-2">
      <!-- 캐릭터 얼굴 + 라벨 (자동 랜덤 선택된 외형) -->
      <div class="flex items-center gap-2">
        <img
          v-if="game.runAvatar"
          :src="playerImageUrl(game.runAvatar)"
          :alt="userAvatarLabel(game.runAvatar)"
          class="w-10 h-10 rounded-full object-cover border border-slate-700 shrink-0"
          @error="(e) => ((e.target as HTMLImageElement).style.display = 'none')"
        />
        <div class="text-[11px] text-gray-400 truncate">
          {{ game.runAvatar ? userAvatarLabel(game.runAvatar) : '모험가' }}
        </div>
      </div>
      <div class="grid grid-cols-2 gap-3">
        <HpMpBar :current="c.hp" :max="c.maxHp" kind="hp" />
        <HpMpBar :current="c.mp" :max="c.maxMp" kind="mp" />
      </div>
      <div class="flex items-center justify-between text-xs gap-2">
        <div class="truncate flex-1">
          <span v-if="challengeOneLine" class="text-trait-special">🎯 {{ challengeOneLine }}</span>
          <span v-else class="text-gray-500">챌린지 없음</span>
        </div>
        <span class="text-stat-luck font-mono shrink-0">{{ c.gold }}G</span>
      </div>
      <div class="grid grid-cols-2 gap-2 text-xs">
        <div class="bg-bg-tertiary rounded px-2 py-1 truncate">
          <span class="text-gray-500 text-[10px]">무기 </span><ItemName :item="c.weapon" compact />
        </div>
        <div class="bg-bg-tertiary rounded px-2 py-1 truncate">
          <span class="text-gray-500 text-[10px]">갑옷 </span><ItemName :item="c.armor" compact />
        </div>
      </div>
      <StatusBadges :statuses="c.statuses" />
    </div>

    <!-- ⑤ 빈 공간 (flex spacer) -->
    <div class="flex-1" />

    <!-- 모달 -->
    <StatusModal :open="statusOpen" @close="statusOpen = false" />
    <InventoryModal :open="inventoryOpen" @close="inventoryOpen = false" />
  </section>
</template>
