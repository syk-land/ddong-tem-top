<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, watch } from 'vue'
import { useGameStore } from '@/stores/game'
import { useAuthStore } from '@/stores/auth'
import {
  isSoundEnabled, setSoundEnabled,
  isBgmEnabled, setBgmEnabled,
  getSoundVolume, setSoundVolume,
  getBgmVolume, setBgmVolume,
  sfx,
} from '@/ui/sound'
import { showRewardedAd } from '@/lib/ads'
import { IS_DEV_SERVER } from '@/lib/platform'
import { useI18n } from '@/lib/i18n'

const game = useGameStore()
const auth = useAuthStore()
const { t } = useI18n()

// 튜토리얼 게이팅 — 본 단계에 따라 표시 가능한 속도/옵션이 다름.
//   first_shop 전: 1배속만
//   first_shop 후, first_chapter_clear 전: 1·2배속
//   first_chapter_clear 후: 1·2·4배속 (4배속·자동진입은 광고 해금 필요)
// 100배는 dev 계정 전용으로 별도 줄에 단독 표시 (헤더 wrap 으로 자동 버튼이
// 사라지는 문제 방지).
const speeds = computed<readonly number[]>(() => {
  if (!game.canUseSpeed2x) return [1]
  if (!game.canShowSpeed4x) return [1, 2]
  return [1, 2, 4]
})

// 펼침 상태 — 기본 접힘. localStorage 영속화 (사용자가 명시적으로 펼친 채로 둔 경우만 복원)
const expanded = ref(false)
const STORAGE_KEY = 'climetop:speedControl:expanded:v2'

// 펼친 상태에서 N 초 무활동이면 자동 접힘
const AUTO_COLLAPSE_MS = 5000
let collapseTimer: ReturnType<typeof setTimeout> | null = null

// 사운드 상태 (reactive)
const sfxOn = ref(isSoundEnabled())
const bgmOn = ref(isBgmEnabled())
const sfxVol = ref(getSoundVolume())
const bgmVol = ref(getBgmVolume())

// 음소거 해제 시 복원할 마지막 양수 볼륨
const lastSfxVol = ref(sfxVol.value > 0 ? sfxVol.value : 0.3)
const lastBgmVol = ref(bgmVol.value > 0 ? bgmVol.value : 0.4)

onMounted(() => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw === '1') expanded.value = true
  } catch {}
  if (expanded.value) scheduleAutoCollapse()
})

onUnmounted(() => {
  if (collapseTimer) clearTimeout(collapseTimer)
})

function persistExpanded() {
  try {
    localStorage.setItem(STORAGE_KEY, expanded.value ? '1' : '0')
  } catch {}
}

function scheduleAutoCollapse() {
  if (collapseTimer) clearTimeout(collapseTimer)
  if (!expanded.value) return
  collapseTimer = setTimeout(() => {
    expanded.value = false
    persistExpanded()
    collapseTimer = null
  }, AUTO_COLLAPSE_MS)
}

// 펼친 상태에서 어떤 상호작용이든 있으면 타이머 리셋
function bumpActivity() {
  if (expanded.value) scheduleAutoCollapse()
}

async function setSpeed(s: number) {
  sfx.click()
  bumpActivity()
  // 자동화 모드 (5배 이상) — 광고 없음. 배치 tick 처리로 setInterval 가드 우회.
  // autoEnter 강제 on + 자동 매수/장착/이벤트 거부 + 자동 진입.
  if (s >= 5) {
    game.setCombatSpeed(s)
    return
  }
  // 4배속 — 등반 1회당 광고 1번 시청 → 그 런 끝까지 자유 토글
  if (s === 4 && game.combatSpeed !== 4 && !game.run?.adFastSpeedUnlocked) {
    const ok = await game.confirmModal(
      t('speed.adFastBody', '광고를 보고 이번 등반 동안 4배속을 사용하시겠습니까?'),
      {
        title: t('speed.adTitle', '광고 시청 (등반 1회 1번)'),
        okLabel: t('speed.adYes', '예 (광고 보기)'),
        cancelLabel: t('common.no', '아니오'),
      },
    )
    if (!ok) return
    const watched = await showRewardedAd('fastSpeed')
    collapse()
    if (!watched) {
      await game.alertModal(
        t('speed.adNotWatchedBody', '광고 시청이 완료되지 않았습니다.'),
        t('speed.adNotWatchedTitle', '활성화 실패'),
      )
      return
    }
    game.unlockAdFastSpeed()
  }
  game.setCombatSpeed(s)
}

async function toggleAutoEnter() {
  sfx.click()
  bumpActivity()
  if (!game.autoEnter && !game.run?.adAutoEnterUnlocked) {
    const ok = await game.confirmModal(
      t('speed.adAutoBody', '광고를 보고 이번 등반 동안 자동 진입을 사용하시겠습니까?'),
      {
        title: t('speed.adTitle', '광고 시청 (등반 1회 1번)'),
        okLabel: t('speed.adYes', '예 (광고 보기)'),
        cancelLabel: t('common.no', '아니오'),
      },
    )
    if (!ok) return
    const watched = await showRewardedAd('autoEnter')
    collapse()
    if (!watched) {
      await game.alertModal(
        t('speed.adNotWatchedBody', '광고 시청이 완료되지 않았습니다.'),
        t('speed.adNotWatchedTitle', '활성화 실패'),
      )
      return
    }
    game.unlockAdAutoEnter()
  }
  game.setAutoEnter(!game.autoEnter)
}

// 자동화 모드 — 사용자가 직접 배속 숫자 입력 (5~999)
function onCustomSpeed(e: Event) {
  const v = parseInt((e.target as HTMLInputElement).value, 10)
  if (!Number.isFinite(v)) return
  const clamped = Math.max(5, Math.min(999, v))
  game.setCombatSpeed(clamped)
  bumpActivity()
}

// 게임 종료 — 브라우저 window.close() 시도.
// 브라우저 정책상 사용자가 직접 연 탭만 닫힙니다.
async function quitGame() {
  bumpActivity()
  const ok = await game.confirmModal(t('settings.quit.body', '게임을 종료하시겠습니까?'), {
    title: t('settings.quit.title', '종료'),
    okLabel: t('common.yes', '예'),
    cancelLabel: t('common.no', '아니오'),
    danger: true,
  })
  if (!ok) return
  try { window.close() } catch {}
}

function expand() {
  if (!expanded.value) {
    expanded.value = true
    persistExpanded()
    scheduleAutoCollapse()
  }
}
function collapse() {
  if (expanded.value) {
    expanded.value = false
    persistExpanded()
    if (collapseTimer) clearTimeout(collapseTimer)
  }
}

function openIntro() {
  game.openIntroComic('replay')
  // 만화 모달 뜨면 접어두기
  collapse()
}

// ── 효과음 ──
function onSfxVolChange(e: Event) {
  const v = parseFloat((e.target as HTMLInputElement).value)
  sfxVol.value = v
  setSoundVolume(v)
  if (v === 0) {
    if (sfxOn.value) {
      sfxOn.value = false
      setSoundEnabled(false)
    }
  } else {
    lastSfxVol.value = v
    if (!sfxOn.value) {
      sfxOn.value = true
      setSoundEnabled(true)
    }
  }
  bumpActivity()
}
function onSfxMuteToggle() {
  sfxOn.value = !sfxOn.value
  setSoundEnabled(sfxOn.value)
  if (sfxOn.value) {
    const restore = lastSfxVol.value > 0 ? lastSfxVol.value : 0.3
    sfxVol.value = restore
    setSoundVolume(restore)
    sfx.click()
  } else {
    if (sfxVol.value > 0) lastSfxVol.value = sfxVol.value
    sfxVol.value = 0
    setSoundVolume(0)
  }
  bumpActivity()
}

// ── 배경음 ──
function onBgmVolChange(e: Event) {
  const v = parseFloat((e.target as HTMLInputElement).value)
  bgmVol.value = v
  setBgmVolume(v)
  if (v === 0) {
    if (bgmOn.value) {
      bgmOn.value = false
      setBgmEnabled(false)
    }
  } else {
    lastBgmVol.value = v
    if (!bgmOn.value) {
      bgmOn.value = true
      setBgmEnabled(true)
    }
  }
  bumpActivity()
}
function onBgmMuteToggle() {
  bgmOn.value = !bgmOn.value
  setBgmEnabled(bgmOn.value)
  if (bgmOn.value) {
    const restore = lastBgmVol.value > 0 ? lastBgmVol.value : 0.4
    bgmVol.value = restore
    setBgmVolume(restore)
  } else {
    if (bgmVol.value > 0) lastBgmVol.value = bgmVol.value
    bgmVol.value = 0
    setBgmVolume(0)
  }
  bumpActivity()
}

// 접힘 상태의 사운드 요약 아이콘
const summaryIcon = computed(() => {
  if (!sfxOn.value && !bgmOn.value) return '🔇'
  return '🔊'
})

// 접힘 상태에서 스피커 탭 — 전체 사운드(sfx + bgm) 일괄 토글
function toggleAllSound(e: Event) {
  e.stopPropagation()  // 부모 expand 버튼 클릭 방지
  const anyOn = sfxOn.value || bgmOn.value
  if (anyOn) {
    // 모두 OFF — 마지막 양수 볼륨 보관 (이미 lastXxxVol 유지 중)
    if (sfxOn.value) {
      if (sfxVol.value > 0) lastSfxVol.value = sfxVol.value
      sfxOn.value = false
      setSoundEnabled(false)
      sfxVol.value = 0
      setSoundVolume(0)
    }
    if (bgmOn.value) {
      if (bgmVol.value > 0) lastBgmVol.value = bgmVol.value
      bgmOn.value = false
      setBgmEnabled(false)
      bgmVol.value = 0
      setBgmVolume(0)
    }
  } else {
    // 모두 ON — 마지막 볼륨으로 복원
    const sfxRestore = lastSfxVol.value > 0 ? lastSfxVol.value : 0.3
    sfxVol.value = sfxRestore
    setSoundVolume(sfxRestore)
    sfxOn.value = true
    setSoundEnabled(true)
    sfx.click()

    const bgmRestore = lastBgmVol.value > 0 ? lastBgmVol.value : 0.4
    bgmVol.value = bgmRestore
    setBgmVolume(bgmRestore)
    bgmOn.value = true
    setBgmEnabled(true)
  }
  bumpActivity()
}

// 모달 떠 있을 때는 패널 자체를 더 흐리게 — 가림 최소화
const dimmed = computed(() =>
  !!(game.dialog || game.inputDialog || game.listDialog || game.pendingPickup || game.introVisible),
)

// 어느 메뉴/상태든 펼친 상태에서 게임 상태가 바뀌면 자동 접힘 트리거 (다음 층 진입 등)
watch(
  () => [game.screen, game.combat?.ended],
  () => bumpActivity(),
)
</script>

<template>
  <div
    data-tutorial-target="speed-control"
    class="fixed top-1 left-1 z-[100] rounded-md select-none text-gray-200 transition-opacity duration-200"
    :class="[
      dimmed && !expanded ? 'opacity-25' : (expanded ? 'opacity-95' : 'opacity-60 hover:opacity-95'),
      expanded ? 'bg-black/65 backdrop-blur-sm' : 'bg-black/45 backdrop-blur-[2px]',
    ]"
    @mouseenter="bumpActivity"
  >
    <!-- 접힘 상태: 햄버거(설정 펼침) + 속도/자동 표시 + 스피커(전체 사운드 토글, 별도 버튼) -->
    <div v-if="!expanded" class="flex items-center text-xs rounded-md overflow-hidden">
      <button
        type="button"
        class="flex items-center gap-1 pl-2 pr-1.5 py-1 hover:bg-slate-800/60"
        :title="t('speed.expandTooltip', '설정 패널 펼치기')"
        @click="expand"
      >
        <span class="text-sm leading-none">⚙</span>
        <span class="font-mono text-gray-300">{{ game.combatSpeed }}x</span>
        <span v-if="game.autoEnter" class="text-log-reward font-bold">{{ t('speed.autoChip', '자') }}</span>
      </button>
      <button
        type="button"
        class="px-1.5 py-1 hover:bg-slate-800/60 border-l border-slate-600/40 min-w-7 flex items-center justify-center"
        :title="(sfxOn || bgmOn) ? t('speed.soundOffTooltip', '전체 사운드 끄기') : t('speed.soundOnTooltip', '전체 사운드 켜기')"
        @click="toggleAllSound"
      >
        <span class="text-xs leading-none">{{ summaryIcon }}</span>
      </button>
    </div>

    <template v-else>
      <!-- 헤더 행: 닫기 + 속도 + 자동 + 사운드 요약. 100x 추가 시(개발자) 가로 폭이
           좁은 화면에선 넘쳐서 자동 버튼이 잘리므로 flex-wrap 허용 → 자동이 다음 줄로 내려감. -->
      <div class="flex flex-wrap items-center gap-1 px-2 py-1">
        <button
          class="w-5 h-5 flex items-center justify-center rounded text-sm hover:bg-slate-700"
          :title="t('speed.collapseTooltip', '설정 패널 접기')"
          @click="collapse"
        >
          ×
        </button>
        <span class="text-xs text-gray-300">{{ t('speed.label', '속도') }}</span>
        <button
          v-for="s in speeds"
          :key="s"
          class="px-2 py-0.5 rounded text-xs transition-all"
          :class="game.combatSpeed === s
            ? 'bg-log-skill text-black font-bold ring-2 ring-cyan-200 shadow-[0_0_8px_rgba(34,211,238,0.7)]'
            : 'bg-slate-800/70 text-gray-200 hover:bg-slate-700'"
          @click="setSpeed(s)"
        >
          {{ s }}x
        </button>
        <button
          v-if="game.canShowAutoEnter"
          class="px-2 py-0.5 rounded text-xs transition-all ml-1"
          :class="game.autoEnter
            ? 'bg-log-reward text-black font-bold ring-2 ring-amber-200 shadow-[0_0_8px_rgba(251,191,36,0.7)]'
            : 'bg-slate-800/70 text-gray-200 hover:bg-slate-700'"
          :title="game.autoEnter ? t('speed.autoOn', '자동 진입 ON (몬스터/보스/치유샘)') : t('speed.autoOff', '자동 진입 OFF')"
          @click="toggleAutoEnter"
        >
          {{ game.autoEnter ? t('speed.autoChecked', '자동 ✓') : t('speed.autoBtn', '자동') }}
        </button>
        <span class="text-sm ml-1">{{ summaryIcon }}</span>
      </div>

      <!-- 사운드 슬라이더 + 책 버튼 -->
      <div class="border-t border-slate-700/50 px-2 py-1.5 space-y-1">
        <div class="flex items-center gap-1.5 text-xs">
          <span class="w-10 shrink-0 text-gray-300">{{ t('speed.sfx', '효과음') }}</span>
          <input
            type="range" min="0" max="1" step="0.01"
            :value="sfxVol" @input="onSfxVolChange"
            class="w-20 accent-log-skill"
          />
          <span class="w-6 shrink-0 text-right text-gray-400 tabular-nums">{{ Math.round(sfxVol * 100) }}</span>
          <label class="flex items-center gap-1 cursor-pointer ml-1" :title="t('speed.muteTooltip', '음소거')">
            <input type="checkbox" :checked="!sfxOn" @change="onSfxMuteToggle" class="w-3 h-3 accent-red-500" />
            <span class="text-gray-400">{{ t('speed.muteLabel', '끄기') }}</span>
          </label>
        </div>

        <div class="flex items-center gap-1.5 text-xs">
          <span class="w-10 shrink-0 text-gray-300">{{ t('speed.bgm', '배경음') }}</span>
          <input
            type="range" min="0" max="1" step="0.01"
            :value="bgmVol" @input="onBgmVolChange"
            class="w-20 accent-log-skill"
          />
          <span class="w-6 shrink-0 text-right text-gray-400 tabular-nums">{{ Math.round(bgmVol * 100) }}</span>
          <label class="flex items-center gap-1 cursor-pointer ml-1" :title="t('speed.muteTooltip', '음소거')">
            <input type="checkbox" :checked="!bgmOn" @change="onBgmMuteToggle" class="w-3 h-3 accent-red-500" />
            <span class="text-gray-400">{{ t('speed.muteLabel', '끄기') }}</span>
          </label>
        </div>

        <div class="flex items-center justify-center gap-2 pt-0.5">
          <button
            class="flex items-center gap-1 px-2 py-0.5 rounded text-xs text-gray-300 hover:bg-slate-700"
            :title="t('speed.introTooltip', '인트로 만화 다시 보기')"
            @click="openIntro"
          >
            <span class="text-sm leading-none">📖</span>
            <span>{{ t('speed.introBtn', '인트로 만화') }}</span>
          </button>
          <button
            class="flex items-center gap-1 px-2 py-0.5 rounded text-xs text-rose-300 hover:bg-rose-900/40 border border-rose-500/30"
            :title="t('settings.quit.title', '게임 종료')"
            @click="quitGame"
          >
            <span class="text-sm leading-none">⏻</span>
            <span>{{ t('settings.quit.button', '게임 종료') }}</span>
          </button>
        </div>

        <!-- 자동화 모드 — vite dev 서버 + dev 계정 한정. 기본 100배 + 숫자 입력으로
             5~999 조정. autoEnter 강제 on + 상점 자동 매수·새로고침 + 인벤 자동
             업그레이드 + 특별이벤트 자동 거부.
             production 빌드 (안드로이드 / 웹 호스팅) 에서는 IS_DEV_SERVER 가 false
             상수 → 이 v-if 가 dead branch → minifier 가 블록 전체 제거. -->
        <div v-if="IS_DEV_SERVER && auth.isDevAccount" class="flex items-center justify-center gap-2 pt-1 border-t border-slate-700/40">
          <button
            class="px-3 py-1 rounded text-xs font-bold transition-all"
            :class="game.isAutoMode
              ? 'bg-fuchsia-500 text-black ring-2 ring-fuchsia-200 shadow-[0_0_8px_rgba(217,70,239,0.7)]'
              : 'bg-slate-800/70 text-gray-200 hover:bg-slate-700'"
            title="자동화 모드 — 기본 100배 + 자동 진입·매수·장착·이벤트 거부"
            @click="setSpeed(100)"
          >
            🚀 100x (auto)
          </button>
          <input
            v-if="game.isAutoMode"
            type="number" min="5" max="999" step="1"
            :value="game.combatSpeed"
            @change="onCustomSpeed"
            class="w-16 bg-slate-800 text-xs px-2 py-1 rounded font-mono text-center text-gray-200 border border-slate-600 focus:border-fuchsia-400 outline-none"
            title="배속 직접 입력 (5~999)"
          />
        </div>
      </div>
    </template>
  </div>
</template>
