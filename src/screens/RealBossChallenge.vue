<script setup lang="ts">
import { computed } from 'vue'
import { useGameStore } from '@/stores/game'
import { realBossImageUrl, defaultBgUrl, userAvatarUrl, playerImageUrl } from '@/ui/images'

const game = useGameStore()
const bgUrl = defaultBgUrl()

const weak = computed(() => game.realBossWeakRecord)
const theme = computed(() => game.realBossTheme)
const boss = computed(() => game.realBossMonster)

function start() {
  game.enterRealBossCombat()
}

function decline() {
  // 거절 — 누적 골드 보존, 이번 세션 동안 보스 프롬프트 재트리거 안 함
  game.realBossMonster = null
  game.realBossWeakRecord = null
  game.realBossTheme = null
  game.realBossInitialMaxHp = 0
  game.realBossDeclinedThisSession = true
  game.setScreen('menu')
}
</script>

<template>
  <section
    v-if="weak && boss && theme"
    class="flex-1 flex flex-col px-3 py-4 sm:px-4 max-w-2xl mx-auto w-full bg-cover bg-center gap-3"
    :style="{ backgroundImage: `linear-gradient(rgba(10,14,26,0.78), rgba(10,14,26,0.92)), url(${bgUrl})` }"
  >
    <!-- 헤더 — 큰 한글 + rose glow (GameOver/Victory 패턴) -->
    <div
      class="rounded-xl border-2 border-rose-400/70 bg-bg-secondary/95 shadow-[0_0_30px_rgba(244,63,94,0.30)] p-5 text-center space-y-2 animate-fadein"
    >
      <div class="text-rose-300 text-4xl font-bold tracking-widest leading-tight">탑의 부름</div>
      <p class="text-sm text-gray-200 leading-snug">
        탑이 가장 빛바랜 영혼을 불러냈다.<br />
        패배하면 <span class="text-rose-300 font-bold">회귀하셨습니다</span> — 깎은 비율만큼<br />
        다음 캐릭터의 힘이 된다.<br />
        완전히 처치하면 회귀하지 않는다.
      </p>
    </div>

    <!-- 대치 카드 — 좌 영혼 (grade-legend) / 우 보스 (rose) -->
    <div class="grid grid-cols-2 gap-2 sm:gap-3">
      <!-- 부활한 영혼 -->
      <div class="rounded-lg border-2 border-grade-legend/40 bg-grade-legend/5 p-3 space-y-2 text-center">
        <div class="text-xs text-grade-legend font-bold">부활한 영혼</div>
        <img
          :src="playerImageUrl(weak.avatarKey)"
          alt="weak character"
          class="w-28 h-28 object-cover mx-auto rounded-lg border-2 border-grade-legend/50 shadow-[0_0_18px_rgba(168,85,247,0.25)]"
        />
        <div class="text-xs">
          <span class="text-grade-legend font-bold">{{ weak.rank }}</span>
          <span class="ml-1 font-mono">{{ weak.score }}점</span>
        </div>
        <div class="grid grid-cols-2 text-xs gap-x-2 gap-y-0.5 font-mono">
          <div><span class="text-stat-hp">HP</span> {{ weak.maxHp }}</div>
          <div><span class="text-stat-mp">MP</span> {{ weak.maxMp }}</div>
          <div><span class="text-stat-phys_atk">힘</span> {{ weak.stats.힘 }}</div>
          <div><span class="text-stat-phys_def">체력</span> {{ weak.stats.체력 }}</div>
          <div><span class="text-stat-util">민첩</span> {{ weak.stats.민첩 }}</div>
          <div><span class="text-stat-luck">행운</span> {{ weak.stats.행운 }}</div>
        </div>
      </div>

      <!-- 진짜 보스 -->
      <div class="rounded-lg border-2 border-rose-500/50 bg-rose-950/20 p-3 space-y-2 text-center shadow-[0_0_18px_rgba(244,63,94,0.25)]">
        <div class="text-xs text-rose-300 font-bold">진짜 보스</div>
        <img
          :src="realBossImageUrl(theme)"
          :alt="boss.template.name"
          class="w-28 h-28 object-cover mx-auto rounded-lg border-2 border-rose-500/60 shadow-[0_0_18px_rgba(244,63,94,0.35)]"
          @error="(e) => ((e.target as HTMLImageElement).style.display = 'none')"
        />
        <div class="text-sm text-rose-200 font-bold">{{ boss.template.name }}</div>
        <div class="grid grid-cols-2 text-xs gap-x-2 gap-y-0.5 font-mono">
          <div><span class="text-stat-hp">HP</span> {{ boss.maxHp }}</div>
          <div><span class="text-stat-util">속도</span> {{ boss.speed }}</div>
          <div><span class="text-stat-phys_atk">공</span> {{ boss.atk }}</div>
          <div><span class="text-stat-phys_def">방</span> {{ boss.def }}</div>
        </div>
      </div>
    </div>

    <!-- 보상 안내 -->
    <div class="rounded-lg border border-amber-400/40 bg-amber-950/20 px-3 py-2 text-center">
      <div class="text-xs text-amber-300 font-bold">보상</div>
      <div class="text-sm mt-0.5">깎은 비율 × 60pt = 다음 캐릭터 시작 능력치 보너스 <span class="text-amber-200 font-bold">(최대 +60pt)</span></div>
    </div>

    <!-- 액션 (하단 sticky) -->
    <div class="grid grid-cols-2 gap-2 mt-auto sticky bottom-0 pt-2 pb-1 bg-gradient-to-t from-bg-primary/95 to-bg-primary/0">
      <button class="btn-secondary min-h-12 font-bold" @click="decline">나중에</button>
      <button class="btn-primary min-h-12 font-bold tracking-wide" @click="start">도전 시작</button>
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
