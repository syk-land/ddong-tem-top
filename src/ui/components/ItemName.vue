<script setup lang="ts">
import { computed } from 'vue'
import type { ItemInstance } from '@/types'
import { formatItemNameHTML } from '@/ui/colors'
import { useI18n } from '@/lib/i18n'

const props = defineProps<{
  item: ItemInstance | null
  compact?: boolean
  clickable?: boolean
}>()

const emit = defineEmits<{
  (e: 'clickTrait'): void
  (e: 'clickGrade'): void
  (e: 'clickBase'): void
}>()

const { t, td } = useI18n()

const fmt = computed(() => formatItemNameHTML(props.item))

// i18n 적용된 trait / grade / base
const displayed = computed(() => {
  const it = props.item
  if (!it) return { trait: '', grade: '', base: '' }
  return {
    trait: td(it.kind === 'weapon' ? 'trait.weapon' : 'trait.armor', it.trait),
    grade: td('grade', it.grade),
    base: td(it.kind === 'weapon' ? 'weapon' : 'armor', it.baseKey),
  }
})

const compactSize = computed(() => {
  if (!props.item) return 'text-[11px]'
  const len = displayed.value.trait.length + displayed.value.grade.length + displayed.value.base.length + 4
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
      >{{ displayed.trait }}</span>
      <span class="text-gray-600 mx-0.5">·</span>
      <span
        :class="[fmt.gradeClass, partClass]"
        @click.stop="clickable && emit('clickGrade')"
      >{{ displayed.grade }}</span>
      <span class="text-gray-600 mx-0.5">·</span>
      <span
        :class="[fmt.baseClass, partClass]"
        @click.stop="clickable && emit('clickBase')"
      >{{ displayed.base }}</span>
      <span v-if="!compact" class="text-gray-500 text-xs ml-1">[T{{ item.tier }}]</span>
    </template>
    <span v-else class="text-gray-500 italic">{{ t('item.notEquipped', '미 착용') }}</span>
  </span>
</template>
