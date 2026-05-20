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
  // 거절도 카운터를 소진 — 이미 startRealBoss에서 처리됨
  game.realBossMonster = null
  game.realBossWeakRecord = null
  game.realBossTheme = null
  game.realBossInitialMaxHp = 0
  game.setScreen('menu')
}
</script>

<template>
  <section
    v-if="weak && boss && theme"
    class="flex-1 flex flex-col px-4 py-4 max-w-2xl mx-auto w-full bg-cover bg-center"
    :style="{ backgroundImage: `linear-gradient(rgba(10,14,26,0.78), rgba(10,14,26,0.92)), url(${bgUrl})` }"
  >
    <div class="panel text-center space-y-3 mb-4">
      <h1 class="text-2xl font-bold text-trait-special">⚔️ 탑의 부름</h1>
      <p class="text-sm text-gray-300">
        탑이 가장 빛바랜 영혼을 불러냈다.<br />
        진짜 보스에 도전해 깎은 비율만큼 다음 캐릭터의 힘이 된다.
      </p>
    </div>

    <!-- 부활한 캐릭터 + 보스 대치 -->
    <div class="panel grid grid-cols-2 gap-4 items-center">
      <!-- 부활한 캐릭터 -->
      <div class="text-center space-y-2">
        <div class="text-xs text-grade-legend">▼ 부활한 영혼</div>
        <img
          :src="playerImageUrl(weak.avatarKey)"
          alt="weak character"
          class="w-32 h-32 object-cover mx-auto rounded-lg border border-slate-700"
        />
        <div class="text-[11px] text-gray-300">
          <span class="text-rank-low">최종 등급</span>
          <span class="text-grade-legend font-bold ml-1">{{ weak.rank }}</span>
          <span class="text-gray-500 ml-2">점수 {{ weak.score }}</span>
        </div>
        <div class="grid grid-cols-2 text-[10px] gap-1 text-gray-400">
          <div>HP {{ weak.maxHp }}</div>
          <div>MP {{ weak.maxMp }}</div>
          <div>힘 {{ weak.stats.힘 }}</div>
          <div>체력 {{ weak.stats.체력 }}</div>
          <div>민첩 {{ weak.stats.민첩 }}</div>
          <div>행운 {{ weak.stats.행운 }}</div>
        </div>
      </div>

      <!-- 보스 -->
      <div class="text-center space-y-2">
        <div class="text-xs text-status-bleed">▼ 진짜 보스</div>
        <img
          :src="realBossImageUrl(theme)"
          :alt="boss.template.name"
          class="w-32 h-32 object-cover mx-auto rounded-lg border border-rose-900"
          @error="(e) => ((e.target as HTMLImageElement).style.display = 'none')"
        />
        <div class="text-sm text-status-bleed font-bold">{{ boss.template.name }}</div>
        <div class="grid grid-cols-2 text-[10px] gap-1 text-gray-400">
          <div>HP {{ boss.maxHp }}</div>
          <div>속도 {{ boss.speed }}</div>
          <div>공 {{ boss.atk }}</div>
          <div>방 {{ boss.def }}</div>
        </div>
      </div>
    </div>

    <div class="text-center text-[11px] text-gray-500 mt-3">
      깎은 비율 × 60pt = 다음 캐릭터 시작 능력치 보너스 (최대 +60pt)
    </div>

    <div class="grid grid-cols-2 gap-2 mt-4">
      <button class="btn-secondary" @click="decline">나중에</button>
      <button class="btn-primary" @click="start">⚔️ 도전 시작</button>
    </div>
  </section>
</template>
