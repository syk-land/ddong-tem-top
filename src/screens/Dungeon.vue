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
import { themeBgUrl, floorContentImage, playerImageUrl } from '@/ui/images'
import type { ItemInstance } from '@/types'
import { useI18n } from '@/lib/i18n'

const game = useGameStore()
const { t, td } = useI18n()
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
    return t(`challenge.${def.key}`, def.name)
  }).filter((s): s is string => !!s)
  return items.join(' · ')
})

// 자동 진입: 일반몬스터/보스/치유샘/보물 자동 진입.
// 상점/특별이벤트는 통상엔 사용자 선택을 위해 보류하지만, 자동화 모드(6배속) 에서는
// 상점도 자동 진입 — 진입 후 Shop.vue 가 autoShopFlow 로 매수+이탈까지 자동 처리.
// (특별이벤트는 runSpecialEvent 가 자동 거부 + advance.)
const AUTO_ENTER_TYPES = new Set(['monster', 'boss', 'healing_spring', 'treasure'])
const AUTO_ENTER_TYPES_AUTOMODE = new Set([...AUTO_ENTER_TYPES, 'shop', 'special_event'])
let autoEnterTimer: ReturnType<typeof setTimeout> | null = null

function tryAutoEnter() {
  if (!game.autoEnter) return
  if (game.paused) return  // 백그라운드 진입 동안 보류 (visibilitychange 가 paused 토글)
  // 모달이 떠 있으면 자동 진입 막음 (사용자 결정 대기 중)
  if (game.dialog || game.inputDialog || game.listDialog || game.pendingPickup) return
  if (game.tutorialActive) return  // 튜토리얼 활성 동안 자동 진입 보류
  if (game.screen !== 'dungeon') return
  const f = game.currentFloorEvent
  if (!f || f.cleared) return
  const allowed = game.isAutoMode ? AUTO_ENTER_TYPES_AUTOMODE : AUTO_ENTER_TYPES
  if (!allowed.has(f.type)) return
  if (autoEnterTimer) clearTimeout(autoEnterTimer)
  // 자동화 모드 — setTimeout 우회. 안드로이드 webview 의 setTimeout throttle 로
  // 챕터 전환 후 자동 진입이 멈추는 현상 방지. game.advance() 끝에서도 micro-task
  // 로 직접 트리거되지만, Dungeon mount 시 (다른 screen 에서 돌아온 경우) onMounted
  // 의 tryAutoEnter 도 즉시 호출되도록 안전망.
  if (game.isAutoMode) {
    game.enterCurrentFloor()
    return
  }
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

  // 보물에서 받은 직후 advance → 3층(상점) 도착 흐름:
  //   pendingTreasureTutorial 이 true 이면 인벤 버튼 안내(first_treasure) 를 발화한다.
  //   이 발화로 시작해 first_inventory → prompt_status → first_status →
  //   prompt_enter_shop 의 연쇄 학습이 진행된다.
  if (game.pendingTreasureTutorial) {
    game.pendingTreasureTutorial = false
    game.triggerTutorial('first_treasure')
  } else {
    // 일반 도착 — 챕터 1 강제 노드(2층 보물 / 3층 상점) 에 대해 진입 버튼 안내.
    // 그 외 챕터·층은 triggerTutorial 가드에서 차단된다.
    const ft = game.currentFloorEvent?.type
    if (ft === 'treasure') {
      game.triggerTutorial('prompt_enter_treasure')
    } else if (ft === 'shop') {
      game.triggerTutorial('prompt_enter_shop')
    }
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
  const ok = await game.confirmModal(
    t('dungeon.quit.body', '현재 진행을 저장하고 메인 메뉴로 돌아갑니다.'),
    { title: t('dungeon.quit.title', '메뉴로') },
  )
  if (ok) game.setScreen('menu')
}

const themeClass = computed(() => themeColorClass[ch.value.theme])
const bgUrl = computed(() => themeBgUrl(ch.value.theme))
const floorImage = computed(() =>
  floor.value ? floorContentImage(floor.value.type, ch.value.theme, ch.value.isHard) : null
)
const floorLabel = computed(() => {
  if (!floor.value) return t('dungeon.chapterClear', '챕터 클리어')
  const labels: Record<string, { key: string; fallback: string }> = {
    monster: { key: 'dungeon.floor.normalMonster', fallback: '일반 몬스터' },
    boss: { key: 'dungeon.floor.boss', fallback: '보스' },
    shop: { key: 'dungeon.floor.shop', fallback: '상점' },
    treasure: { key: 'dungeon.floor.treasure', fallback: '보물상자' },
    healing_spring: { key: 'dungeon.floor.healing', fallback: '회복샘' },
    special_event: { key: 'dungeon.floor.special', fallback: '특별 이벤트' },
  }
  const lab = labels[floor.value.type]
  return lab ? t(lab.key, lab.fallback) : floor.value.type
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
          {{ t('dungeon.chapterFmt', `제 ${ch.chapter}챕터 · ${td('chapter', ch.theme)}`, { chapter: ch.chapter, theme: td('chapter', ch.theme) }) }}
          <span v-if="ch.isHard" class="text-rose-400 ml-1 text-xs">{{ t('dungeon.hardBadge', '[강화]') }}</span>
        </div>
        <div class="text-xs text-gray-400">
          <span class="font-mono tabular-nums">{{ ch.currentFloor + 1 }}</span>
          <span class="text-gray-600"> {{ t('dungeon.floorFmt', `/ ${ch.floors.length}층`, { total: ch.floors.length }) }}</span>
        </div>
      </div>
      <button
        data-tutorial-target="status-btn"
        :data-tutorial-cta-label="t('dungeon.btn.status', '상태')"
        class="btn-secondary text-xs min-h-9 px-3 font-bold"
        @click="statusOpen = true"
        :title="t('dungeon.btn.statusTooltip', '상태창')"
      >{{ t('dungeon.btn.status', '상태') }}</button>
      <button
        data-tutorial-target="inventory-btn"
        class="btn-secondary text-xs min-h-9 px-3 font-bold flex items-center gap-1.5"
        @click="inventoryOpen = true"
        :title="t('dungeon.btn.invTooltip', '인벤토리')"
      >
        <span>{{ t('dungeon.btn.inv', '인벤') }}</span>
        <span class="text-xs text-gray-300 tabular-nums">{{ inventory.length }}/{{ inventoryCap }}</span>
      </button>
      <button class="btn-secondary text-xs min-h-9 px-3 font-bold" @click="quit" :title="t('dungeon.btn.menuTooltip', '메인 메뉴로')">{{ t('dungeon.btn.menu', '메뉴') }}</button>
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
          class="btn-primary px-6 w-full max-w-xs min-h-12 text-base font-bold disabled:opacity-40 disabled:cursor-not-allowed"
          :disabled="game.isTutorialBlockingExit"
          :title="game.isTutorialBlockingExit ? t('dungeon.btn.tutorialBlockingTip', '튜토리얼 — 인벤토리와 상태창 학습을 먼저 완료해주세요') : ''"
          @click="enter"
        >{{ game.isTutorialBlockingExit ? t('dungeon.btn.tutorialBlocking', '학습 진행 중…') : (floor?.type === 'treasure' ? t('dungeon.btn.openChest', '열기') : t('dungeon.btn.enter', '진입')) }}</button>
      </div>
    </div>

    <!-- ④ 내 상태 — cyan 액센트 (Combat 플레이어 카드와 일관) -->
    <!-- 좌측: 전신 풀하이트  /  우측: 이름·골드·HP/MP·챌린지·장비·상태 -->
    <div class="rounded-lg border border-cyan-500/40 bg-bg-secondary/60 backdrop-blur-sm shadow-[0_0_18px_rgba(34,211,238,0.12)_inset] overflow-hidden">
      <div class="flex items-stretch">
        <!-- 좌: 전신 (세로 풀하이트) -->
        <!-- HP/MP/무기/방어구 각각 1행씩 = 4행 풀폭 + 헤더 → 카드가 자연스럽게 길어진다.
             좌측 이미지는 그 길이를 따라 더 크게 보임. portrait aspect 보장으로 최소 높이도 확보. -->
        <div
          v-if="game.runAvatar"
          class="relative shrink-0 w-32 sm:w-40 min-h-[200px] bg-cyan-950/25 border-r border-cyan-500/20"
        >
          <img
            :src="playerImageUrl(game.runAvatar)"
            :alt="game.characterName(game.runAvatar)"
            class="absolute inset-0 w-full h-full object-cover"
            @error="(e) => ((e.target as HTMLImageElement).style.display = 'none')"
          />
          <div class="absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-bg-secondary/50 to-transparent pointer-events-none" />
        </div>

        <!-- 우: 정보 컬럼 -->
        <div class="flex-1 min-w-0 flex flex-col">
          <!-- 헤더: 이름 + 골드 -->
          <div class="px-3 py-2 flex items-center gap-2 border-b border-cyan-500/20 bg-cyan-950/20">
            <div class="text-sm font-bold text-cyan-100 truncate flex-1">
              {{ game.characterName(game.runAvatar) }}
            </div>
            <div class="px-2 py-1 rounded-md bg-amber-950/60 border border-amber-400/40 text-stat-luck text-xs font-bold font-mono shrink-0 flex items-center gap-1">
              <span class="text-amber-400">⬢</span>
              <span class="tabular-nums">{{ c.gold }}G</span>
            </div>
          </div>

          <!-- 본문 — 각 항목 1행 풀폭 -->
          <div class="px-3 py-2 space-y-1.5 flex-1 flex flex-col">
            <!-- HP 1행 -->
            <HpMpBar :current="c.hp" :max="c.maxHp" kind="hp" />
            <!-- MP 1행 -->
            <HpMpBar :current="c.mp" :max="c.maxMp" kind="mp" />

            <!-- 무기 1행 -->
            <button
              type="button"
              class="w-full bg-bg-tertiary/80 rounded-md px-2 py-1.5 border border-slate-700/50 text-left hover:border-cyan-500/40 hover:bg-bg-tertiary transition-colors active:scale-[0.99] flex items-center min-h-10"
              :disabled="!c.weapon"
              @click="c.weapon && (equipDetail = c.weapon)"
              :title="c.weapon ? t('dungeon.equip.weaponTooltip', '장비 상세 보기') : t('dungeon.equip.weaponEmpty', '장착된 무기 없음')"
            >
              <ItemName :item="c.weapon" compact />
            </button>
            <!-- 방어구 1행 -->
            <button
              type="button"
              class="w-full bg-bg-tertiary/80 rounded-md px-2 py-1.5 border border-slate-700/50 text-left hover:border-cyan-500/40 hover:bg-bg-tertiary transition-colors active:scale-[0.99] flex items-center min-h-10"
              :disabled="!c.armor"
              @click="c.armor && (equipDetail = c.armor)"
              :title="c.armor ? t('dungeon.equip.weaponTooltip', '장비 상세 보기') : t('dungeon.equip.armorEmpty', '장착된 갑옷 없음')"
            >
              <ItemName :item="c.armor" compact />
            </button>

            <!-- 챌린지 줄 (있을 때만) -->
            <div v-if="challengeOneLine" class="text-xs text-trait-special truncate flex items-center gap-1">
              <span class="shrink-0">🎯</span>
              <span class="truncate">{{ challengeOneLine }}</span>
            </div>

            <StatusBadges v-if="c.statuses.length" :statuses="c.statuses" />
          </div>
        </div>
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
            {{ t('dungeon.equip.detail', '장비 상세') }}
            <span class="text-cyan-300/70 text-xs ml-1">{{ equipDetail.kind === 'weapon' ? t('dungeon.equip.weapon', '· 무기') : t('dungeon.equip.armor', '· 갑옷') }}</span>
          </div>
          <button
            type="button"
            class="w-8 h-8 flex items-center justify-center rounded text-base text-gray-200 hover:bg-slate-700"
            @click="equipDetail = null"
            :aria-label="t('dungeon.equip.close', '닫기')"
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
