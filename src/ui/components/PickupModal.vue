<script setup lang="ts">
import { computed } from 'vue'
import { useGameStore } from '@/stores/game'
import { tierColorClass, gradeColorClass } from '@/ui/colors'
import ItemName from '@/ui/components/ItemName.vue'

const game = useGameStore()
const pending = computed(() => game.pendingPickup)
const inventory = computed(() => game.run?.inventory ?? [])

function discardSlot(idx: number) {
  game.resolvePickupDiscardSlot(idx)
}
function refuse() {
  game.resolvePickupRefuse()
}
</script>

<template>
  <Teleport to="body">
  <div
    v-if="pending"
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4"
  >
    <div class="panel max-w-lg w-full space-y-4">
      <header class="text-center space-y-1">
        <div class="text-lg font-bold text-status-burn">인벤토리가 가득 찼다</div>
        <div class="text-xs text-gray-400">새 아이템을 받으려면 한 칸을 폐기하거나, 신규 아이템을 포기하세요.</div>
      </header>

      <!-- 신규 입수 -->
      <div class="bg-grade-legend/10 border border-grade-legend/40 rounded p-3 space-y-1">
        <div class="text-xs text-grade-legend font-bold">신규 입수</div>
        <div :class="[tierColorClass(pending.tier), 'font-mono text-sm']">
          <ItemName :item="pending" />
        </div>
        <div class="text-xs text-gray-500">
          T{{ pending.tier }} ·
          <span :class="gradeColorClass[pending.grade]">{{ pending.grade }}</span>
          · 등급계수 {{ pending.coef.toFixed(2) }}
        </div>
      </div>

      <!-- 인벤토리 슬롯 (폐기 선택) -->
      <div class="space-y-2">
        <div class="text-xs text-gray-400">아래 슬롯 중 하나 클릭 → 그 슬롯 폐기 + 신규 아이템 적재</div>
        <div class="space-y-1">
          <button
            v-for="(slot, idx) in inventory"
            :key="slot.id"
            class="w-full bg-bg-tertiary hover:bg-bg-hover rounded px-3 py-2 flex items-center justify-between text-left transition-colors"
            @click="discardSlot(idx)"
          >
            <div class="flex-1 min-w-0">
              <div :class="[tierColorClass(slot.tier), 'text-xs font-mono truncate']">
                <ItemName :item="slot" compact />
              </div>
              <div class="text-xs text-gray-500">
                T{{ slot.tier }} ·
                <span :class="gradeColorClass[slot.grade]">{{ slot.grade }}</span>
                · 등급계수 {{ slot.coef.toFixed(2) }}
              </div>
            </div>
            <span class="text-xs text-status-burn ml-2">✕ 폐기</span>
          </button>
        </div>
      </div>

      <!-- 신규 포기 -->
      <button class="btn-secondary w-full text-sm" @click="refuse">
        신규 아이템 포기 (인벤토리 유지)
      </button>
    </div>
  </div>
  </Teleport>
</template>
