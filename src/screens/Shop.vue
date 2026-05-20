<script setup lang="ts">
import { computed } from 'vue'
import { useGameStore } from '@/stores/game'
import ItemDetail from '@/ui/components/ItemDetail.vue'
import type { ItemInstance } from '@/types'
import { themeBgUrl } from '@/ui/images'

const game = useGameStore()
const shop = computed(() => game.shop!)
const player = computed(() => game.run!.character)
const refresh = computed(() => game.run!.refreshState)
const inventory = computed(() => game.run!.inventory)
const bgUrl = computed(() => {
  const ch = game.currentChapterState
  return ch ? themeBgUrl(ch.theme) : ''
})

async function buy(itemId: string) {
  const item = shop.value.inventory.find((i: ItemInstance) => i.id === itemId)
  if (!item) return
  if (player.value.gold < item.buyPrice) return
  await game.buyItemAndEquip(item)
}
function refreshShop() {
  game.refreshShopAction()
}
function leave() {
  game.leaveShop()
}
async function sellSlot(slot: 'weapon' | 'armor') {
  const item = player.value[slot]
  if (!item) return
  const ok = await game.confirmModal(
    `${item.trait} ${item.grade} ${item.baseKey}\n\n${item.buyback}G에 판매?`,
    { title: '장비 판매', okLabel: '판매' }
  )
  if (ok) game.sellEquipped(slot)
}
async function sellInventory(idx: number) {
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

async function sellAll() {
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
</script>

<template>
  <section class="flex-1 flex flex-col px-3 py-3 gap-3 max-w-4xl mx-auto w-full">
    <div class="panel-tight flex items-center justify-between">
      <div>
        <span class="text-grade-legend font-bold">🪙 황금고블린 상점</span>
        <span class="text-xs text-gray-500 ml-2">새로고침 {{ refresh.charges }} / {{ refresh.cap }}</span>
      </div>
      <div class="flex items-center gap-2">
        <span class="text-stat-luck font-mono">{{ player.gold }}G</span>
        <button class="btn-secondary text-xs" @click="leave">나가기</button>
      </div>
    </div>

    <!-- 장착 중 (판매) -->
    <div class="panel space-y-2">
      <div class="text-xs text-gray-400">장착 중 (판매 가능)</div>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-2">
        <div class="bg-bg-tertiary rounded p-2 space-y-2">
          <div class="text-[10px] text-gray-500">⚔️ 무기</div>
          <ItemDetail v-if="player.weapon" :item="player.weapon" :character="player" />
          <div v-else class="text-xs text-gray-600">맨손</div>
          <button v-if="player.weapon" class="w-full text-xs px-2 py-1 rounded bg-stat-luck/30 text-stat-luck hover:bg-stat-luck/50" @click="sellSlot('weapon')">
            +{{ player.weapon.buyback }}G 판매
          </button>
        </div>
        <div class="bg-bg-tertiary rounded p-2 space-y-2">
          <div class="text-[10px] text-gray-500">🛡️ 갑옷</div>
          <ItemDetail v-if="player.armor" :item="player.armor" :character="player" />
          <div v-else class="text-xs text-gray-600">없음</div>
          <button v-if="player.armor" class="w-full text-xs px-2 py-1 rounded bg-stat-luck/30 text-stat-luck hover:bg-stat-luck/50" @click="sellSlot('armor')">
            +{{ player.armor.buyback }}G 판매
          </button>
        </div>
      </div>
    </div>

    <!-- 인벤토리 슬롯 판매 -->
    <div v-if="inventory.length > 0" class="panel space-y-2">
      <div class="flex items-center justify-between">
        <div class="text-xs text-gray-400">🎒 인벤토리 (판매 가능)</div>
        <button
          class="text-xs px-3 py-1 rounded bg-stat-luck text-black font-bold hover:opacity-80"
          @click="sellAll"
        >
          전부 판매 +{{ totalBuyback }}G
        </button>
      </div>
      <div class="space-y-2">
        <div
          v-for="(item, idx) in inventory"
          :key="item.id"
          class="bg-bg-tertiary rounded p-2 space-y-2"
        >
          <ItemDetail :item="item" :character="player" />
          <button class="w-full text-xs px-2 py-1 rounded bg-stat-luck/30 text-stat-luck hover:bg-stat-luck/50" @click="sellInventory(idx)">
            +{{ item.buyback }}G 판매
          </button>
        </div>
      </div>
    </div>

    <!-- 상점 인벤토리 (구매) -->
    <div class="panel space-y-2">
      <div class="text-xs text-gray-400">🏪 상점 매물 (구매)</div>
      <div class="grid gap-2" :style="{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }">
        <div
          v-for="item in shop.inventory"
          :key="item.id"
          class="bg-bg-tertiary rounded p-2 space-y-2"
        >
          <ItemDetail :item="item" :character="player" />
          <button
            class="w-full btn-primary text-sm py-1.5 disabled:opacity-30"
            :disabled="player.gold < item.buyPrice"
            @click="buy(item.id)"
          >
            {{ item.buyPrice }}G 구매
          </button>
        </div>
      </div>
    </div>

    <div class="flex gap-2">
      <button
        class="btn-secondary flex-1 disabled:opacity-30"
        :disabled="refresh.charges <= 0"
        @click="refreshShop"
      >
        🔄 새로고침 ({{ refresh.charges }} 남음)
      </button>
      <button class="btn-secondary px-4" @click="leave">나가기</button>
    </div>
  </section>
</template>
