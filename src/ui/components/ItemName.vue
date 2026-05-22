<script setup lang="ts">
import { computed } from 'vue'
import type { ItemInstance } from '@/types'
import { formatItemNameHTML } from '@/ui/colors'

const props = defineProps<{
  item: ItemInstance | null
  compact?: boolean
  clickable?: boolean  // true 면 trait/grade/base 가 클릭 가능 (커서 + emit)
}>()

const emit = defineEmits<{
  (e: 'clickTrait'): void
  (e: 'clickGrade'): void
  (e: 'clickBase'): void
}>()

const fmt = computed(() => formatItemNameHTML(props.item))

// compact 모드: 텍스트 길이에 따라 폰트 자동 조절 (좁은 카드에서도 1줄 유지)
const compactSize = computed(() => {
  if (!props.item) return 'text-[11px]'
  const len = fmt.value.trait.length + fmt.value.grade.length + fmt.value.base.length + 4
  if (len <= 12) return 'text-[12px]'
  if (len <= 15) return 'text-[11px]'
  if (len <= 17) return 'text-[10px]'
  return 'text-[9px]'
})

const partClass = computed(() => props.clickable ? 'cursor-pointer hover:underline underline-offset-2' : '')
</script>

<template>
  <span :class="['font-mono', compact ? compactSize : 'text-sm']">
    <template v-if="item">
      <span
        :class="[fmt.traitClass, partClass]"
        @click.stop="clickable && emit('clickTrait')"
      >{{ fmt.trait }}</span>
      <span class="text-gray-600 mx-0.5">·</span>
      <span
        :class="[fmt.gradeClass, partClass]"
        @click.stop="clickable && emit('clickGrade')"
      >{{ fmt.grade }}</span>
      <span class="text-gray-600 mx-0.5">·</span>
      <span
        :class="[fmt.baseClass, partClass]"
        @click.stop="clickable && emit('clickBase')"
      >{{ fmt.base }}</span>
      <span v-if="!compact" class="text-gray-500 text-xs ml-1">[T{{ item.tier }}]</span>
    </template>
    <span v-else class="text-gray-500 italic">미 착용</span>
  </span>
</template>
