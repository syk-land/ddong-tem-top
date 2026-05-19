<script setup lang="ts">
import { computed } from 'vue'
import { useGameStore } from '@/stores/game'
import ItemDetail from '@/ui/components/ItemDetail.vue'

const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{ (e: 'close'): void }>()

const game = useGameStore()
const c = computed(() => game.run!.character)
const inventory = computed(() => game.run?.inventory ?? [])
const inventoryCap = computed(() => game.run?.inventoryCap ?? 0)

async function equipItem(idx: number) {
  const result = game.equipFromInventory(idx)
  if (!result.ok) await game.alertModal(result.reason ?? '장착 실패', '⚠️ 장착 실패')
}
async function discardItem(idx: number) {
  const item = inventory.value[idx]
  if (!item) return
  const ok = await game.confirmModal(
    `${item.trait} ${item.grade} ${item.baseKey}\n\n폐기하시겠습니까? (보상 없음)`,
    { title: '아이템 폐기', danger: true, okLabel: '폐기' }
  )
  if (ok) game.discardFromInventory(idx)
}
async function unequipSlot(slot: 'weapon' | 'armor') {
  const result = game.unequipToInventory(slot)
  if (!result.ok) await game.alertModal(result.reason ?? '해제 실패', '⚠️ 해제 실패')
}
</script>

<template>
  <div
    v-if="props.open"
    class="fixed inset-0 z-40 flex items-center justify-center bg-black/70 px-3 py-6"
    @click.self="emit('close')"
  >
    <div class="panel max-w-lg w-full max-h-[90vh] overflow-y-auto space-y-3">
      <header class="flex items-center justify-between sticky top-0 bg-bg-panel z-10 -mx-3 px-3 py-1">
        <div class="text-lg font-bold">
          🎒 인벤토리
          <span class="text-xs text-gray-500 ml-2">{{ inventory.length }} / {{ inventoryCap }}</span>
        </div>
        <button class="text-gray-400 hover:text-white text-xl leading-none" @click="emit('close')">✕</button>
      </header>

      <!-- 장착 중 -->
      <section class="space-y-2">
        <div class="text-xs text-gray-400">장착 중</div>
        <!-- 무기 -->
        <div class="bg-bg-tertiary rounded p-2 space-y-2">
          <div class="flex items-center justify-between gap-2">
            <div class="text-[10px] text-gray-500">⚔️ 무기</div>
            <button
              v-if="c.weapon"
              class="text-xs px-2 py-1 rounded bg-slate-700 text-gray-300 hover:bg-slate-600"
              @click="unequipSlot('weapon')"
            >해제</button>
          </div>
          <ItemDetail v-if="c.weapon" :item="c.weapon" :character="c" />
          <div v-else class="text-xs text-gray-600 text-center py-2">맨손</div>
        </div>
        <!-- 갑옷 -->
        <div class="bg-bg-tertiary rounded p-2 space-y-2">
          <div class="flex items-center justify-between gap-2">
            <div class="text-[10px] text-gray-500">🛡️ 갑옷</div>
            <button
              v-if="c.armor"
              class="text-xs px-2 py-1 rounded bg-slate-700 text-gray-300 hover:bg-slate-600"
              @click="unequipSlot('armor')"
            >해제</button>
          </div>
          <ItemDetail v-if="c.armor" :item="c.armor" :character="c" />
          <div v-else class="text-xs text-gray-600 text-center py-2">없음</div>
        </div>
      </section>

      <!-- 인벤토리 슬롯 -->
      <section class="space-y-2">
        <div class="text-xs text-gray-400">보관함</div>
        <div v-if="inventory.length === 0" class="text-center text-gray-500 py-4 text-sm">비어있음</div>
        <div v-else class="space-y-3">
          <div
            v-for="(item, idx) in inventory"
            :key="item.id"
            class="bg-bg-tertiary rounded p-2 space-y-2"
          >
            <ItemDetail :item="item" :character="c" />
            <div class="flex gap-1">
              <button class="flex-1 text-xs px-2 py-1 rounded bg-log-skill/30 text-log-skill hover:bg-log-skill/50" @click="equipItem(idx)">
                장착
              </button>
              <button class="text-xs px-3 py-1 rounded bg-slate-700 text-gray-400 hover:bg-slate-600" @click="discardItem(idx)" title="폐기">
                ✕ 폐기
              </button>
            </div>
          </div>
        </div>
        <div class="text-[10px] text-gray-600 text-center">판매는 상점에서만 가능합니다.</div>
      </section>
    </div>
  </div>
</template>
