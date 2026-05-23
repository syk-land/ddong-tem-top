<script setup lang="ts">
import { computed, watch } from 'vue'
import { useGameStore } from '@/stores/game'
import ItemDetail from '@/ui/components/ItemDetail.vue'
import { canEquipItem } from '@/core/challengeRuntime'
import type { ItemInstance } from '@/types'

const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{ (e: 'close'): void }>()

const game = useGameStore()
const c = computed(() => game.run!.character)
const inventory = computed(() => game.run?.inventory ?? [])
const inventoryCap = computed(() => game.run?.inventoryCap ?? 0)

// 인벤 모달이 처음 열리면 first_inventory 튜토리얼 트리거.
// 닫힐 때 first_inventory 가 방금 본 상태면 다음 단계 prompt_status 발화 →
// 던전 화면의 "상태" 버튼을 가리킴 (학습 흐름: 인벤 → 상태창).
watch(() => props.open, (v, prev) => {
  if (v) {
    game.triggerTutorial('first_inventory')
  } else if (prev && game.meta.tutorialSeen.first_inventory) {
    // 모달 닫힘. first_inventory 를 봤다면 자연스럽게 상태창 안내로 이어감.
    game.triggerTutorial('prompt_status')
  }
})

async function equipItem(idx: number) {
  const result = game.equipFromInventory(idx)
  if (!result.ok) await game.alertModal(result.reason ?? '장착 실패', '장착 실패')
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
  if (!result.ok) await game.alertModal(result.reason ?? '해제 실패', '해제 실패')
}

// 챌린지 제약 체크
function checkEquip(item: ItemInstance): { ok: boolean; reason?: string } {
  if (!game.challengeContext) return { ok: true }
  return canEquipItem(item, game.challengeContext)
}
</script>

<template>
  <Teleport to="body">
  <div
    v-if="props.open"
    class="fixed inset-0 z-40 flex items-center justify-center bg-black/70 px-3 py-6"
    @click.self="emit('close')"
  >
    <div class="panel max-w-lg w-full max-h-[90vh] overflow-y-auto space-y-3">
      <header class="flex items-center justify-between sticky top-0 bg-bg-panel z-10 -mx-3 px-3 py-1">
        <div class="text-lg font-bold">
          인벤토리
          <span class="text-xs text-gray-500 ml-2">{{ inventory.length }} / {{ inventoryCap }}</span>
        </div>
        <button data-tutorial-target="inventory-close" class="text-gray-400 hover:text-white text-xl leading-none" @click="emit('close')">✕</button>
      </header>

      <!-- 장착 중 -->
      <section class="space-y-2">
        <div class="text-xs text-gray-400">장착 중</div>
        <!-- 무기 -->
        <div class="bg-bg-tertiary rounded p-2 space-y-2">
          <div class="flex items-center justify-between gap-2">
            <div class="text-xs text-gray-500">무기</div>
            <button
              v-if="c.weapon"
              class="text-xs px-2 py-1 rounded bg-slate-700 text-gray-300 hover:bg-slate-600"
              @click="unequipSlot('weapon')"
            >해제</button>
          </div>
          <ItemDetail v-if="c.weapon" :item="c.weapon" :character="c" />
          <div v-else class="text-xs text-gray-600 text-center py-2">미 착용</div>
        </div>
        <!-- 갑옷 -->
        <div class="bg-bg-tertiary rounded p-2 space-y-2">
          <div class="flex items-center justify-between gap-2">
            <div class="text-xs text-gray-500">갑옷</div>
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
            :data-tutorial-target="idx === 0 ? 'inventory-item-card' : undefined"
            class="bg-bg-tertiary rounded p-2 space-y-2"
          >
            <ItemDetail :item="item" :character="c" />
            <div class="flex gap-1">
              <button
                v-if="!checkEquip(item).ok"
                class="flex-1 text-xs px-2 py-1 rounded bg-rose-950/40 text-rose-300 border border-rose-500/40 cursor-not-allowed font-bold"
                :disabled="true"
                :title="checkEquip(item).reason"
              >착용불가</button>
              <button
                v-else
                :data-tutorial-target="idx === 0 ? 'inventory-equip-btn' : undefined"
                class="flex-1 text-xs px-2 py-1 rounded bg-log-skill/30 text-log-skill hover:bg-log-skill/50"
                @click="equipItem(idx)"
              >장착</button>
              <button class="text-xs px-3 py-1 rounded bg-slate-700 text-gray-400 hover:bg-slate-600" @click="discardItem(idx)" title="폐기">
                ✕ 폐기
              </button>
            </div>
          </div>
        </div>
        <div class="text-xs text-gray-600 text-center">판매는 상점에서만 가능합니다.</div>
      </section>
    </div>
  </div>
  </Teleport>
</template>
