<script setup lang="ts">
import { computed, ref, watch, nextTick, onMounted, onUnmounted } from 'vue'
import { useGameStore } from '@/stores/game'
import { TUTORIAL_STEPS } from '@/data/tutorial'

const game = useGameStore()

const step = computed(() => game.tutorialActive)
const def = computed(() => step.value ? TUTORIAL_STEPS[step.value] : null)
const pageIdx = ref(0)
const currentPage = computed(() => def.value?.pages[pageIdx.value] ?? null)

// 단계가 바뀌면 페이지 초기화
watch(step, () => { pageIdx.value = 0 })

// ── 위치 계산 ────────────────────────────────────────────
//   target 이 있으면: 타겟 요소의 getBoundingClientRect() 기준으로
//   카드를 위/아래에 자동 배치 + 시안 ring 스포트라이트 + 방향 화살표.
//   target 이 없거나 못 찾으면: 화면 중앙 카드 (기존 동작).
const cardRef = ref<HTMLElement | null>(null)
const targetRect = ref<DOMRect | null>(null)
const arrowDir = ref<'up' | 'down' | null>(null)
const cardPos = ref<{ top: number; left: number } | null>(null)

const CARD_W = 360
const ARROW_SIZE = 14   // 화살표 한 변 절반
const GAP = 16          // 타겟과 카드 사이 여백
const MARGIN = 12       // 화면 경계 여백
const CARD_H_FALLBACK = 220

async function recompute() {
  const p = currentPage.value
  if (!p?.target) {
    targetRect.value = null
    arrowDir.value = null
    cardPos.value = null
    return
  }
  await nextTick()
  const el = document.querySelector(p.target) as HTMLElement | null
  if (!el) {
    targetRect.value = null
    arrowDir.value = null
    cardPos.value = null
    return
  }
  // 자동 스크롤
  //   scrollMode: 'end' — 타겟의 하단을 viewport 의 하단에 맞춤. 페이지 최 하단까지
  //                       내려가서 안내해야 할 때 (예: 누적 보너스 분배 패널).
  //   scrollMode: 'center' (기본) — 타겟 중앙 Y 가 viewport 중앙 ±25% 안에 없으면
  //                                 강제로 가운데로 끌어옴.
  const scrollMode = p.scrollMode ?? 'center'
  const pre = el.getBoundingClientRect()
  let needScroll = false
  if (scrollMode === 'end') {
    // 타겟 하단이 viewport 의 하단 80% ~ 100% 안에 있지 않으면 스크롤
    needScroll = pre.bottom < window.innerHeight * 0.8 || pre.bottom > window.innerHeight
  } else {
    const centerY = pre.top + pre.height / 2
    needScroll = centerY < window.innerHeight * 0.25 || centerY > window.innerHeight * 0.75
  }
  if (needScroll) {
    el.scrollIntoView({
      behavior: 'smooth',
      block: scrollMode === 'end' ? 'end' : 'center',
      inline: 'nearest',
    })
    // 스크롤 애니메이션 후 정확한 좌표 재측정
    await new Promise((r) => setTimeout(r, 360))
  }
  const rect = el.getBoundingClientRect()
  targetRect.value = rect

  const cardH = cardRef.value?.offsetHeight ?? CARD_H_FALLBACK
  const cardW = Math.min(CARD_W, window.innerWidth - MARGIN * 2)

  // 타겟이 화면 위쪽 절반이면 카드는 아래에 (화살표 ↑),
  // 아래쪽이면 카드는 위에 (화살표 ↓).
  const targetMidY = rect.top + rect.height / 2
  const isTopHalf = targetMidY < window.innerHeight / 2

  let top: number
  let dir: 'up' | 'down'
  if (isTopHalf) {
    top = rect.bottom + GAP + ARROW_SIZE
    dir = 'up'
  } else {
    top = rect.top - cardH - GAP - ARROW_SIZE
    dir = 'down'
  }
  top = Math.max(MARGIN, Math.min(top, window.innerHeight - cardH - MARGIN))

  // 좌우: 타겟 중앙에 카드 중앙 맞추되 화면 경계 안에서 clamp
  let left = rect.left + rect.width / 2 - cardW / 2
  left = Math.max(MARGIN, Math.min(left, window.innerWidth - cardW - MARGIN))

  cardPos.value = { top, left }
  arrowDir.value = dir
}

// 화살표는 타겟의 X 중앙을 가리키지만, 카드가 clamp 로 좌우 밀렸을 수 있어
// 카드 내부 기준 화살표 left 오프셋을 별도 계산.
const arrowLeftPx = computed(() => {
  const t = targetRect.value
  const c = cardPos.value
  if (!t || !c) return null
  const cardW = Math.min(CARD_W, window.innerWidth - MARGIN * 2)
  const targetCenterX = t.left + t.width / 2
  const offsetInCard = targetCenterX - c.left
  return Math.max(20, Math.min(offsetInCard, cardW - 20))
})

// 스포트라이트 ring 위치
const spotlightStyle = computed(() => {
  const t = targetRect.value
  if (!t) return null
  return {
    top: `${t.top - 4}px`,
    left: `${t.left - 4}px`,
    width: `${t.width + 8}px`,
    height: `${t.height + 8}px`,
  }
})

// 클릭 위임 대상 — 타겟이 자체가 button/a/role=button 이면 그것, 아니면 null.
// (안쪽 button 자동 탐색은 의도치 않은 클릭을 막기 위해 하지 않음.
//  버튼 류가 아닌 패널이 타겟일 때는 그냥 "알겠어요" 로 닫기만.)
const targetActionEl = computed<HTMLElement | null>(() => {
  if (!targetRect.value) return null  // recompute 후 타겟 못 찾았으면 null
  const p = currentPage.value
  if (!p?.target) return null
  const el = document.querySelector(p.target) as HTMLElement | null
  if (!el) return null
  if (el.tagName === 'BUTTON' || el.tagName === 'A') return el
  if (el.getAttribute('role') === 'button') return el
  return null
})

// 다중 페이지일 때 다음 페이지 / 마지막 페이지
const isLastPage = computed(() => {
  const d = def.value
  return d ? pageIdx.value >= d.pages.length - 1 : true
})
const ctaLabel = computed(() => {
  const p = currentPage.value
  if (!p) return ''
  if (!isLastPage.value) return '다음 →'
  // 마지막 페이지 CTA 라벨 우선순위:
  //   1. page.cta 명시
  //   2. 타겟이 클릭 가능 버튼 → data-tutorial-cta-label 속성 또는 buttonText 첫 줄
  //   3. 그 외 "알겠어요"
  if (p.cta) return p.cta
  const action = targetActionEl.value
  if (action) {
    const explicit = action.getAttribute('data-tutorial-cta-label')
    if (explicit) return explicit
    const text = (action.innerText || action.textContent || '').trim().split('\n')[0].trim()
    if (text) return text.length > 20 ? text.slice(0, 20) + '…' : text
  }
  return '알겠어요'
})

function advance() {
  if (!def.value) return
  const action = targetActionEl.value
  if (!isLastPage.value) {
    // 중간 페이지: 타겟이 클릭 가능 버튼이면 click 위임 (예: 주사위 굴리기)
    // + 다음 페이지로 진행. 위임 없으면 그냥 다음 페이지로.
    if (action) action.click()
    pageIdx.value += 1
    return
  }
  // 마지막 페이지: 닫기 + (있으면) 타겟 click 위임. 아니면 닫기만.
  game.completeTutorial()
  if (action) {
    // completeTutorial 직후 click — paused 가 풀린 상태에서 게임 정상 진행
    action.click()
  }
}
function close() {
  game.completeTutorial()
}

// 타겟 위치가 바뀔 수 있는 모든 이벤트에서 재계산
watch([step, pageIdx], () => recompute())
onMounted(() => {
  recompute()
  window.addEventListener('resize', recompute)
  window.addEventListener('scroll', recompute, true)
})
onUnmounted(() => {
  window.removeEventListener('resize', recompute)
  window.removeEventListener('scroll', recompute, true)
})
</script>

<template>
  <div
    v-if="def && currentPage"
    class="fixed inset-0 z-[60] select-none"
    role="dialog"
    aria-live="polite"
  >
    <!-- 백드롭: 투명 — 게임 화면이 그대로 보이도록. 클릭은 흡수해서
         게임 UI 가 우발적으로 눌리지 않게만 차단 (진행은 명시적 버튼/×/뒤로가기). -->
    <div
      class="absolute inset-0 bg-transparent"
      @click.stop
    />

    <!-- 스포트라이트: 타겟 주변 강조 — 안쪽 검정 윤곽 + 시안 두꺼운 ring +
         바깥 검정 윤곽 + 시안 글로우. 박동 (1.2s) 으로 화살표와 같이 강조. -->
    <div
      v-if="spotlightStyle"
      class="absolute pointer-events-none rounded-lg tutorial-spotlight"
      :style="spotlightStyle"
    />

    <!-- 화살표 + 카드 — target 있을 때 동적 배치 -->
    <div
      v-if="cardPos"
      class="absolute tutorial-float pointer-events-none"
      :style="{ top: `${cardPos.top}px`, left: `${cardPos.left}px`, width: '360px', maxWidth: 'calc(100% - 24px)' }"
    >
      <!-- 화살표 (위쪽) — 카드가 타겟 아래, 화살표는 위로 박동 (타겟을 향해 가리킴) -->
      <div
        v-if="arrowDir === 'up' && arrowLeftPx !== null"
        class="absolute -top-[14px] pointer-events-none arrow-pulse-up"
        :style="{ left: `${arrowLeftPx - 14}px` }"
      >
        <svg width="28" height="14" viewBox="0 0 28 14" class="text-cyan-300 drop-shadow-[0_0_8px_rgba(34,211,238,0.9)]">
          <path d="M14 0 L28 14 L0 14 Z" fill="currentColor" />
        </svg>
      </div>

      <div
        ref="cardRef"
        class="relative rounded-2xl bg-zinc-900 ring-1 ring-cyan-500/40 shadow-2xl p-5 text-zinc-100 pointer-events-auto"
        @click.stop
      >
        <!-- 닫기 버튼 -->
        <button
          class="absolute top-2 right-2 w-8 h-8 flex items-center justify-center rounded-full text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800"
          @click.stop="close"
          aria-label="튜토리얼 닫기"
        >×</button>

        <!-- 페이지 인디케이터 -->
        <div v-if="def.pages.length > 1" class="flex items-center gap-1.5 mb-2">
          <span
            v-for="(_, i) in def.pages"
            :key="i"
            :class="[
              'w-1.5 h-1.5 rounded-full transition-colors',
              i === pageIdx ? 'bg-cyan-400' : 'bg-zinc-700',
            ]"
          />
        </div>

        <h3 class="text-lg font-bold text-cyan-300 mb-2 pr-6">{{ currentPage.title }}</h3>
        <p class="text-sm leading-relaxed text-zinc-200 whitespace-pre-line">{{ currentPage.body }}</p>
        <p
          v-if="currentPage.hint"
          class="mt-3 text-xs italic text-zinc-500 whitespace-pre-line"
        >{{ currentPage.hint }}</p>

        <button
          class="mt-4 w-full py-2.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 active:bg-cyan-700 font-bold text-zinc-900 transition-colors"
          @click.stop="advance"
        >{{ ctaLabel }}</button>
      </div>

      <!-- 화살표 (아래쪽) — 카드가 타겟 위, 화살표는 아래로 박동 (타겟을 향해 가리킴) -->
      <div
        v-if="arrowDir === 'down' && arrowLeftPx !== null"
        class="absolute -bottom-[14px] pointer-events-none arrow-pulse-down"
        :style="{ left: `${arrowLeftPx - 14}px` }"
      >
        <svg width="28" height="14" viewBox="0 0 28 14" class="text-cyan-300 drop-shadow-[0_0_8px_rgba(34,211,238,0.9)]">
          <path d="M0 0 L28 0 L14 14 Z" fill="currentColor" />
        </svg>
      </div>
    </div>

    <!-- 중앙 카드 — target 없을 때 fallback (정적, 부유 X) -->
    <div
      v-else
      class="absolute inset-0 flex items-end sm:items-center justify-center px-3 pb-3 sm:pb-0"
    >
      <div
        ref="cardRef"
        class="relative w-full max-w-md rounded-2xl bg-zinc-900 ring-1 ring-cyan-500/40 shadow-2xl p-5 text-zinc-100"
        @click.stop
      >
        <button
          class="absolute top-2 right-2 w-8 h-8 flex items-center justify-center rounded-full text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800"
          @click.stop="close"
          aria-label="튜토리얼 닫기"
        >×</button>

        <div v-if="def.pages.length > 1" class="flex items-center gap-1.5 mb-2">
          <span
            v-for="(_, i) in def.pages"
            :key="i"
            :class="[
              'w-1.5 h-1.5 rounded-full transition-colors',
              i === pageIdx ? 'bg-cyan-400' : 'bg-zinc-700',
            ]"
          />
        </div>

        <h3 class="text-lg font-bold text-cyan-300 mb-2 pr-6">{{ currentPage.title }}</h3>
        <p class="text-sm leading-relaxed text-zinc-200 whitespace-pre-line">{{ currentPage.body }}</p>
        <p
          v-if="currentPage.hint"
          class="mt-3 text-xs italic text-zinc-500 whitespace-pre-line"
        >{{ currentPage.hint }}</p>

        <button
          class="mt-4 w-full py-2.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 active:bg-cyan-700 font-bold text-zinc-900 transition-colors"
          @click.stop="advance"
        >{{ ctaLabel }}</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* 카드 + 화살표 전체가 함께 부유 — 사인 곡선 위·아래 ±6px / 1.8s */
@keyframes tutorial-float {
  0%, 100% { transform: translateY(0); }
  50%      { transform: translateY(-6px); }
}
.tutorial-float {
  animation: tutorial-float 1.8s ease-in-out infinite;
}

/* 화살표는 별도로 더 빠른 주기 (0.9s) + 더 큰 진폭 (±10px) 으로
   "가리키는 방향"으로 박동. 카드 부유 위에 합성되어 시각적 강조.
   ↑ 방향 화살표는 위로 (= 타겟 방향), ↓ 방향 화살표는 아래로. */
@keyframes arrow-pulse-up {
  0%, 100% { transform: translateY(0); }
  50%      { transform: translateY(-10px); }
}
@keyframes arrow-pulse-down {
  0%, 100% { transform: translateY(0); }
  50%      { transform: translateY(10px); }
}
.arrow-pulse-up   { animation: arrow-pulse-up   0.9s ease-in-out infinite; }
.arrow-pulse-down { animation: arrow-pulse-down 0.9s ease-in-out infinite; }

/* 스포트라이트 테두리 — 타겟 안과 밖 양쪽으로 검정 윤곽 + 시안 두꺼운 ring
   + 외곽 글로우. 화살표 박동과 함께 ring 두께·글로우가 살짝 더 부풀었다 줄어듦. */
.tutorial-spotlight {
  box-shadow:
    inset 0 0 0 2px rgba(2, 6, 23, 0.95),
    0 0 0 4px rgba(34, 211, 238, 1),
    0 0 0 6px rgba(2, 6, 23, 0.95),
    0 0 24px 4px rgba(34, 211, 238, 0.55);
  animation: spotlight-pulse 1.2s ease-in-out infinite;
}
@keyframes spotlight-pulse {
  0%, 100% {
    box-shadow:
      inset 0 0 0 2px rgba(2, 6, 23, 0.95),
      0 0 0 4px rgba(34, 211, 238, 1),
      0 0 0 6px rgba(2, 6, 23, 0.95),
      0 0 24px 4px rgba(34, 211, 238, 0.55);
  }
  50% {
    box-shadow:
      inset 0 0 0 2px rgba(2, 6, 23, 0.95),
      0 0 0 6px rgba(34, 211, 238, 1),
      0 0 0 8px rgba(2, 6, 23, 0.95),
      0 0 36px 6px rgba(34, 211, 238, 0.85);
  }
}
</style>
