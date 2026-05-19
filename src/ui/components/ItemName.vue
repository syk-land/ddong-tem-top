<script setup lang="ts">
import { computed } from 'vue'
import type { ItemInstance } from '@/types'
import { formatItemNameHTML } from '@/ui/colors'

const props = defineProps<{
  item: ItemInstance | null
  compact?: boolean
}>()

const fmt = computed(() => formatItemNameHTML(props.item))
</script>

<template>
  <span class="font-mono text-sm">
    <template v-if="item">
      <span :class="fmt.traitClass">{{ fmt.trait }}</span>
      <span class="text-gray-600 mx-1">·</span>
      <span :class="fmt.gradeClass">{{ fmt.grade }}</span>
      <span class="text-gray-600 mx-1">·</span>
      <span :class="fmt.baseClass">{{ fmt.base }}</span>
      <span v-if="!compact" class="text-gray-500 text-xs ml-1">[T{{ item.tier }}]</span>
    </template>
    <span v-else class="text-gray-500 italic">맨손</span>
  </span>
</template>
