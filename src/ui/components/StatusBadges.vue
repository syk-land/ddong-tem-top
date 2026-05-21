<script setup lang="ts">
import type { StatusInstance } from '@/types'
import { statusBgClass } from '@/ui/colors'
import { statusIconUrl } from '@/ui/images'

defineProps<{
  statuses: StatusInstance[]
}>()
</script>

<template>
  <div class="flex flex-wrap gap-1">
    <span
      v-for="s in statuses"
      :key="s.kind"
      :class="['px-1.5 py-0.5 rounded-md text-xs font-bold border flex items-center gap-1 leading-tight', statusBgClass[s.kind]]"
    >
      <img
        v-if="statusIconUrl(s.kind)"
        :src="statusIconUrl(s.kind)!"
        :alt="s.kind"
        class="w-3.5 h-3.5 object-contain"
      />
      <span>{{ s.kind }}</span>
      <span class="opacity-80">×{{ s.stacks }}</span>
      <span class="opacity-60 text-[10px]">{{ s.duration }}t</span>
    </span>
  </div>
</template>
