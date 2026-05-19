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
      :class="['px-1.5 py-0.5 rounded text-[10px] font-bold border flex items-center gap-1', statusBgClass[s.kind]]"
    >
      <img
        v-if="statusIconUrl(s.kind)"
        :src="statusIconUrl(s.kind)!"
        :alt="s.kind"
        class="w-3 h-3 object-contain"
      />
      {{ s.kind }} ×{{ s.stacks }}
      <span class="opacity-70">{{ s.duration }}t</span>
    </span>
  </div>
</template>
