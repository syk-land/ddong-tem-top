<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from 'vue'
import { useGameStore } from '@/stores/game'
import ItemDetail from '@/ui/components/ItemDetail.vue'
import type { ItemInstance } from '@/types'
import { themeBgUrl, shopIconUrl } from '@/ui/images'
import { canEquipItem } from '@/core/challengeRuntime'
import { CHALLENGES_MAP } from '@/data/challenges'

const game = useGameStore()

// 첫 상점 — 구매/판매 안내 + 2배속 잠금 해제 (안내 페이지에서 처리)
onMounted(() => {
  game.triggerTutorial('first_shop')
})
const shop = computed(() => game.shop!)
const player = computed(() => game.run!.character)
const refresh = computed(() => game.run!.refreshState)
const inventory = computed(() => game.run!.inventory)
const bgUrl = computed(() => {
  const ch = game.currentChapterState
  return ch ? themeBgUrl(ch.theme) : ''
})
const shopListingRef = ref<HTMLElement | null>(null)

async function buy(itemId: string) {
  const item = shop.value.inventory.find((i: ItemInstance) => i.id === itemId)
  if (!item) return
  if (player.value.gold < item.buyPrice) return
  const ok = await game.confirmModal(
    `${item.trait} ${item.grade} ${item.baseKey}\n\n${item.buyPrice}G에 구매?`,
    { title: '장비 구매', okLabel: '구매' }
  )
  if (!ok) return
  await game.buyItemAndEquip(item)
}
function refreshShop() {
  game.refreshShopAction()
  nextTick(() => {
    shopListingRef.value?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  })
}
function leave() {
  game.leaveShop()
}
async function sellSlot(slot: 'weapon' | 'armor') {
  if (sellForbidden.value) {
    await game.alertModal('파괴주의자 챌린지로 인해 장비를 판매할 수 없습니다.', '판매 불가')
    return
  }
  const item = player.value[slot]
  if (!item) return
  const ok = await game.confirmModal(
    `${item.trait} ${item.grade} ${item.baseKey}\n\n${item.buyback}G에 판매?`,
    { title: '장비 판매', okLabel: '판매' }
  )
  if (ok) game.sellEquipped(slot)
}
async function sellInventory(idx: number) {
  if (sellForbidden.value) {
    await game.alertModal('파괴주의자 챌린지로 인해 장비를 판매할 수 없습니다.', '판매 불가')
    return
  }
  const item = inventory.value[idx]
  if (!item) return
  const ok = await game.confirmModal(
    `${item.trait} ${item.grade} ${item.baseKey}\n\n${item.buyback}G에 판매?`,
    { title: '인벤토리 판매', okLabel: '판매' }
  )
  if (ok) game.sellFromInventory(idx)
}

const totalBuyback = computed(() =>
  inventory.value.reduce((sum, it) => sum + it.buyback, 0)
)

// 챌린지 제약으로 못 쓰는 아이템 — buy 도 막음 (사도 의미 없음)
function checkEquip(item: ItemInstance): { ok: boolean; reason?: string } {
  if (!game.challengeContext) return { ok: true }
  return canEquipItem(item, game.challengeContext)
}

// 챌린지: 장비 판매 금지 (파괴주의자 — noBuyback)
const sellForbidden = computed(() => {
  const ctx = game.challengeContext
  if (!ctx) return false
  return ctx.active.some((ac) => !ac.failed && CHALLENGES_MAP[ac.key]?.flags?.noBuyback)
})

async function sellAll() {
  if (sellForbidden.value) {
    await game.alertModal('파괴주의자 챌린지로 인해 장비를 판매할 수 없습니다.', '판매 불가')
    return
  }
  if (inventory.value.length === 0) return
  const total = totalBuyback.value
  const ok = await game.confirmModal(
    `인벤토리 ${inventory.value.length}개 아이템을 모두 ${total}G에 일괄 판매합니다.`,
    { title: '전부 판매', okLabel: '전부 판매' }
  )
  if (!ok) return
  const got = game.sellAllFromInventory()
  await game.alertModal(`+${got}G 획득`, '판매 완료')
}

void bgUrl  // 추후 배경 활용 여지
</script>

<template>
  <section class="flex-1 flex flex-col px-2 py-2 sm:px-3 sm:py-3 gap-2 sm:gap-3 max-w-4xl mx-auto w-full">
    <!-- ── 헤더 — 황금고블린 이미지가 카드 가득 + 텍스트 오버레이 ── -->
    <div class="relative rounded-lg border border-amber-400/50 backdrop-blur-sm overflow-hidden shadow-[0_0_18px_rgba(251,191,36,0.18)] min-h-24">
      <img
        :src="shopIconUrl()"
        alt="황금고블린"
        class="absolute inset-0 w-full h-full object-cover"
      />
      <!-- 다크 그라데이션 — 좌우 정보 가독성 -->
      <div class="absolute inset-0 bg-gradient-to-r from-bg-secondary/85 via-bg-secondary/20 to-bg-secondary/85"></div>
      <!-- 콘텐츠 -->
      <div class="relative flex items-center gap-2.5 px-3 py-2 min-h-24">
        <div class="flex-1 min-w-0">
          <div class="text-base font-bold text-amber-300 truncate drop-shadow">황금고블린 상점</div>
          <div class="text-xs text-amber-100/80 drop-shadow">
            새로고침
            <span class="font-mono tabular-nums text-amber-50">{{ refresh.charges }}</span>
            <span class="text-amber-100/40"> / {{ refresh.cap }}</span>
          </div>
        </div>
        <div class="px-2.5 py-1 rounded-md bg-amber-950/80 border border-amber-400/50 text-stat-luck text-sm font-bold font-mono shrink-0 flex items-center gap-1">
          <span class="text-amber-400">⬢</span>
          <span class="tabular-nums">{{ player.gold }}G</span>
        </div>
      </div>
    </div>

    <!-- ====================================================== -->
    <!-- 판매 영역 — amber 액센트                                 -->
    <!-- ====================================================== -->

    <!-- 장착 중 (판매) -->
    <div class="rounded-lg border border-amber-400/30 bg-bg-secondary/60 backdrop-blur-sm overflow-hidden">
      <div class="px-3 py-1.5 bg-amber-950/40 border-b border-amber-400/20 flex items-center justify-between">
        <span class="text-xs font-bold text-amber-300">💰 장착 중 (판매)</span>
      </div>
      <div class="p-2 space-y-2">
        <div class="bg-bg-tertiary/60 rounded-md p-2 border border-slate-700/40 flex items-stretch gap-2">
          <div class="flex-1 min-w-0">
            <ItemDetail v-if="player.weapon" :item="player.weapon" :character="player" />
            <div v-else class="text-sm text-gray-500 italic text-center py-6">미 착용</div>
          </div>
          <button
            v-if="player.weapon"
            :class="['shrink-0 w-16 rounded-md font-bold border-2 active:scale-[0.98] transition flex flex-col items-center justify-center gap-0.5 px-1',
              sellForbidden
                ? 'bg-slate-800/60 text-gray-500 border-slate-700/60 cursor-not-allowed'
                : 'bg-amber-500/20 text-amber-200 hover:bg-amber-500/30 border-amber-400/40']"
            :disabled="sellForbidden"
            @click="sellSlot('weapon')"
            :title="`${player.weapon.buyback}G 판매`"
          >
            <span class="text-xs uppercase tracking-wide opacity-80">판매</span>
            <span class="font-mono tabular-nums text-sm leading-tight">+{{ player.weapon.buyback }}G</span>
          </button>
        </div>
        <div class="bg-bg-tertiary/60 rounded-md p-2 border border-slate-700/40 flex items-stretch gap-2">
          <div class="flex-1 min-w-0">
            <ItemDetail v-if="player.armor" :item="player.armor" :character="player" />
            <div v-else class="text-sm text-gray-500 italic text-center py-6">없음</div>
          </div>
          <button
            v-if="player.armor"
            :class="['shrink-0 w-16 rounded-md font-bold border-2 active:scale-[0.98] transition flex flex-col items-center justify-center gap-0.5 px-1',
              sellForbidden
                ? 'bg-slate-800/60 text-gray-500 border-slate-700/60 cursor-not-allowed'
                : 'bg-amber-500/20 text-amber-200 hover:bg-amber-500/30 border-amber-400/40']"
            :disabled="sellForbidden"
            @click="sellSlot('armor')"
            :title="`${player.armor.buyback}G 판매`"
          >
            <span class="text-xs uppercase tracking-wide opacity-80">판매</span>
            <span class="font-mono tabular-nums text-sm leading-tight">+{{ player.armor.buyback }}G</span>
          </button>
        </div>
      </div>
    </div>

    <!-- 인벤토리 슬롯 판매 -->
    <div
      v-if="inventory.length > 0"
      class="rounded-lg border border-amber-400/30 bg-bg-secondary/60 backdrop-blur-sm overflow-hidden"
    >
      <div class="px-3 py-1.5 bg-amber-950/40 border-b border-amber-400/20 flex items-center justify-between gap-2">
        <span class="text-xs font-bold text-amber-300">📦 인벤토리 (판매)</span>
        <button
          :class="['text-xs px-3 min-h-9 rounded-md font-bold active:scale-[0.98] transition',
            sellForbidden
              ? 'bg-slate-800/60 text-gray-500 cursor-not-allowed'
              : 'bg-stat-luck text-black hover:opacity-85']"
          :disabled="sellForbidden"
          @click="sellAll"
        >{{ sellForbidden ? '판매 불가' : `전부 +${totalBuyback}G` }}</button>
      </div>
      <div class="p-2 space-y-2">
        <div
          v-for="(item, idx) in inventory"
          :key="item.id"
          class="bg-bg-tertiary/60 rounded-md p-2 border border-slate-700/40 flex items-stretch gap-2"
        >
          <div class="flex-1 min-w-0">
            <ItemDetail :item="item" :character="player" />
          </div>
          <button
            :class="['shrink-0 w-16 rounded-md font-bold border-2 active:scale-[0.98] transition flex flex-col items-center justify-center gap-0.5 px-1',
              sellForbidden
                ? 'bg-slate-800/60 text-gray-500 border-slate-700/60 cursor-not-allowed'
                : 'bg-amber-500/20 text-amber-200 hover:bg-amber-500/30 border-amber-400/40']"
            :disabled="sellForbidden"
            @click="sellInventory(idx)"
            :title="`${item.buyback}G 판매`"
          >
            <span class="text-xs uppercase tracking-wide opacity-80">판매</span>
            <span class="font-mono tabular-nums text-sm leading-tight">+{{ item.buyback }}G</span>
          </button>
        </div>
      </div>
    </div>

    <!-- ====================================================== -->
    <!-- 구매 영역 — cyan 액센트                                  -->
    <!-- ====================================================== -->
    <div
      ref="shopListingRef"
      data-tutorial-target="shop-slot"
      class="rounded-lg border border-cyan-400/40 bg-bg-secondary/60 backdrop-blur-sm overflow-hidden scroll-mt-2 shadow-[0_0_18px_rgba(34,211,238,0.12)]"
    >
      <div class="px-3 py-1.5 bg-cyan-950/40 border-b border-cyan-400/20 flex items-center justify-between gap-2">
        <span class="text-xs font-bold text-cyan-200">🛒 상점 매물 (구매)</span>
        <span class="text-xs text-cyan-300/70">{{ shop.inventory.length }}개</span>
      </div>
      <div class="p-2 space-y-2">
        <div
          v-for="item in shop.inventory"
          :key="item.id"
          class="bg-bg-tertiary/60 rounded-md p-2 border border-slate-700/40 flex items-stretch gap-2"
        >
          <div class="flex-1 min-w-0">
            <ItemDetail :item="item" :character="player" />
          </div>
          <!-- 챌린지로 못 쓰는 아이템: 구매불가 / 골드 부족: disabled / 정상: 구매 -->
          <button
            v-if="!checkEquip(item).ok"
            class="shrink-0 w-16 rounded-md font-bold border-2 bg-rose-950/40 text-rose-300 border-rose-500/40 cursor-not-allowed flex flex-col items-center justify-center gap-0.5 px-1"
            :disabled="true"
            :title="checkEquip(item).reason"
          >
            <span class="text-xs uppercase tracking-wide opacity-80">구매</span>
            <span class="text-xs font-bold leading-tight">불가</span>
          </button>
          <button
            v-else
            class="shrink-0 w-16 rounded-md font-bold transition active:scale-[0.98] border-2 flex flex-col items-center justify-center gap-0.5 px-1"
            :class="player.gold < item.buyPrice
              ? 'bg-slate-800/60 text-gray-500 border-slate-700/60 cursor-not-allowed'
              : 'bg-cyan-500/20 text-cyan-100 hover:bg-cyan-500/35 border-cyan-400/60'"
            :disabled="player.gold < item.buyPrice"
            @click="buy(item.id)"
            :title="`${item.buyPrice}G 구매`"
          >
            <span class="text-xs uppercase tracking-wide opacity-80">구매</span>
            <span class="font-mono tabular-nums text-sm leading-tight">{{ item.buyPrice }}G</span>
          </button>
        </div>
      </div>
    </div>

    <!-- ====================================================== -->
    <!-- 하단 액션 (sticky)                                       -->
    <!-- ====================================================== -->
    <div class="flex gap-2 sticky bottom-0 z-10 pt-2 pb-1 bg-gradient-to-t from-bg-primary/95 to-bg-primary/0">
      <button
        class="flex-1 min-h-12 px-4 rounded-md font-bold text-sm transition active:scale-[0.98] border-2 disabled:opacity-40 disabled:cursor-not-allowed"
        :class="refresh.charges <= 0
          ? 'bg-slate-800/70 text-gray-500 border-slate-700/60'
          : 'bg-bg-tertiary text-gray-100 border-slate-600/70 hover:bg-slate-700'"
        :disabled="refresh.charges <= 0"
        @click="refreshShop"
      >🔄 새로고침 <span class="text-gray-400 font-mono ml-1">({{ refresh.charges }})</span></button>
      <button
        class="min-h-12 px-5 rounded-md font-bold text-sm bg-bg-tertiary text-gray-100 border-2 border-slate-600/70 hover:bg-slate-700 active:scale-[0.98] transition"
        @click="leave"
      >나가기</button>
    </div>
  </section>
</template>
