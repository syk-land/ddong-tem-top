<script setup lang="ts">
import { computed } from 'vue'
import { useGameStore } from '@/stores/game'
import { realBossImageUrl, defaultBgUrl, playerImageUrl, allUserAvatarKeys, isValidAvatarKey } from '@/ui/images'
import HpMpBar from '@/ui/components/HpMpBar.vue'
import ItemName from '@/ui/components/ItemName.vue'
import { useI18n } from '@/lib/i18n'

const game = useGameStore()
const { t, td } = useI18n()
const bossName = computed(() => td('monster', game.realBossMonster?.template?.name ?? ''))
const bgUrl = defaultBgUrl()

const theme = computed(() => game.realBossTheme)
const boss = computed(() => game.realBossMonster)
const weak = computed(() => game.realBossWeakRecord)
const bestDrainPct = computed(() => Math.round((game.meta.currentBossBestDrain ?? 0) * 100))

// 옛 기록은 avatarKey 가 누락/무효일 수 있음 → 첫 캐릭터로 폴백
// (playerImageUrl 의 기본 폴백 /images/user.webp 는 그룹샷이라 1인 표시에 부적합).
const avatarUrl = computed(() => {
  const key = weak.value?.avatarKey
  if (key && isValidAvatarKey(key)) return playerImageUrl(key)
  return playerImageUrl(allUserAvatarKeys()[0] ?? null)
})

function start() {
  game.enterRealBossCombat()
}
</script>

<template>
  <section
    v-if="weak && boss && theme"
    class="flex-1 flex flex-col pt-2 pb-2 px-3 max-w-2xl mx-auto w-full bg-cover bg-center gap-3 animate-fadein"
    :style="{ backgroundImage: `linear-gradient(rgba(10,14,26,0.78), rgba(10,14,26,0.92)), url(${bgUrl})` }"
  >
    <!-- ① 진짜 보스 카드 — 이미지 + 이름 한 카드 -->
    <div class="rounded-lg border border-rose-500/50 bg-bg-secondary/60 backdrop-blur-sm shadow-[0_0_18px_rgba(244,63,94,0.20)_inset] overflow-hidden">
      <img
        :src="realBossImageUrl(theme)"
        :alt="bossName"
        decoding="async"
        class="block w-full h-auto"
        @error="(e) => ((e.target as HTMLImageElement).style.display = 'none')"
      />
      <div class="px-3 py-2 text-center border-t border-rose-500/30 bg-rose-950/20">
        <div class="text-xl sm:text-2xl text-rose-200 font-bold tracking-wide">
          {{ bossName }}
        </div>
        <div v-if="bestDrainPct > 0" class="mt-1 text-xs text-rose-300/80">
          {{ t('realboss.bestDrainLabel', '이 보스 베스트 깎은 비율') }} <span class="font-bold text-rose-200">{{ bestDrainPct }}%</span>
        </div>
      </div>
    </div>

    <!-- ② 도전할 캐릭터 카드 — 던전 화면과 동일 디자인 (cyan 액센트) -->
    <div class="rounded-lg border border-cyan-500/40 bg-bg-secondary/60 backdrop-blur-sm shadow-[0_0_18px_rgba(34,211,238,0.12)_inset] overflow-hidden">
      <div class="flex items-stretch">
        <!-- 좌: 전신 -->
        <div class="relative shrink-0 w-32 sm:w-40 min-h-[200px] bg-cyan-950/25 border-r border-cyan-500/20">
          <img
            :src="avatarUrl"
            :alt="game.characterName(weak.avatarKey)"
            loading="lazy"
            decoding="async"
            class="absolute inset-0 w-full h-full object-cover"
            @error="(e) => ((e.target as HTMLImageElement).style.display = 'none')"
          />
          <div class="absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-bg-secondary/50 to-transparent pointer-events-none" />
        </div>

        <!-- 우: 이름/골드 + HP/MP + 장비 -->
        <div class="flex-1 min-w-0 flex flex-col">
          <div class="px-3 py-2 flex items-center gap-2 border-b border-cyan-500/20 bg-cyan-950/20">
            <div class="text-sm font-bold text-cyan-100 truncate flex-1">
              {{ game.characterName(weak.avatarKey) }}
            </div>
            <div class="px-2 py-1 rounded-md bg-amber-950/60 border border-amber-400/40 text-stat-luck text-xs font-bold font-mono shrink-0 flex items-center gap-1">
              <span class="text-amber-400">⬢</span>
              <span class="tabular-nums">{{ weak.gold }}G</span>
            </div>
          </div>
          <div class="px-3 py-2 space-y-1.5 flex-1 flex flex-col">
            <!-- 도전 시 풀 회복되므로 미리보기도 max 기준 표시 -->
            <HpMpBar :current="weak.maxHp" :max="weak.maxHp" kind="hp" />
            <HpMpBar :current="weak.maxMp" :max="weak.maxMp" kind="mp" />
            <!-- 무기/방어구 — 도전 화면이라 클릭 상세는 생략, 표시만 -->
            <div class="w-full bg-bg-tertiary/80 rounded-md px-2 py-1.5 border border-slate-700/50 flex items-center min-h-10">
              <ItemName :item="weak.weapon" compact />
            </div>
            <div class="w-full bg-bg-tertiary/80 rounded-md px-2 py-1.5 border border-slate-700/50 flex items-center min-h-10">
              <ItemName :item="weak.armor" compact />
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- ③ 도전하기 (하단 sticky) -->
    <div class="w-full mt-auto sticky bottom-0 pt-2 pb-1 bg-gradient-to-t from-bg-primary/95 to-bg-primary/0">
      <button class="btn-primary w-full min-h-12 font-bold tracking-wide" @click="start">{{ t('realboss.challengeBtn', '도전하기') }}</button>
    </div>
  </section>
</template>

<style scoped>
@keyframes fadein {
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: translateY(0); }
}
.animate-fadein { animation: fadein 280ms ease-out; }
</style>
