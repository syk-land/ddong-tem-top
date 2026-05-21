<script setup lang="ts">
import { computed } from 'vue'
import type { ItemInstance } from '@/types'
import { formatItemNameHTML } from '@/ui/colors'

const props = defineProps<{
  item: ItemInstance | null
  compact?: boolean
}>()

const fmt = computed(() => formatItemNameHTML(props.item))

// compact 모드: 텍스트 길이에 따라 폰트 자동 조절 (좁은 카드에서도 1줄 유지)
const compactSize = computed(() => {
  if (!props.item) return 'text-[11px]'
  const len = fmt.value.trait.length + fmt.value.grade.length + fmt.value.base.length + 4  // " · " × 2
  if (len <= 12) return 'text-[12px]'
  if (len <= 15) return 'text-[11px]'
  if (len <= 17) return 'text-[10px]'
  return 'text-[9px]'
})
</script>

<template>
  <span :class="['font-mono', compact ? compactSize : 'text-sm']">
    <template v-if="item">
      <span :class="fmt.traitClass">{{ fmt.trait }}</span>
      <span class="text-gray-600 mx-0.5">·</span>
      <span :class="fmt.gradeClass">{{ fmt.grade }}</span>
      <span class="text-gray-600 mx-0.5">·</span>
      <span :class="fmt.baseClass">{{ fmt.base }}</span>
      <span v-if="!compact" class="text-gray-500 text-xs ml-1">[T{{ item.tier }}]</span>
    </template>
    <span v-else class="text-gray-500 italic">맨손</span>
  </span>
</template>
