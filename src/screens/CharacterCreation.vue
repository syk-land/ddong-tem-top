<script setup lang="ts">
import { computed, ref, onBeforeUnmount, onMounted } from 'vue'
import { useGameStore } from '@/stores/game'
import type { Stats, StatKey } from '@/types'
import { statColorClass } from '@/ui/colors'
import { uniformStartingStats } from '@/core/character'
import { mainImageUrl, allUserAvatarKeys, userAvatarUrl, userBustUrl } from '@/ui/images'
import { START_STAT_BASE } from '@/core/realboss'

// GameMonetize 서브디렉토리 호스팅 호환 — 상대경로 prefix
const A = import.meta.env.BASE_URL.replace(/\/$/, '')

const bgUrl = mainImageUrl()

const game = useGameStore()

// 튜토리얼 — 첫 캐릭터 생성이면 creation_intro, 이후 사망/클리어 후 첫 진입이면 meta_creation.
// 둘은 독립이라 사용자가 한 단계만 빠르게 닫아도 다음에 해당하는 게 정상.
onMounted(() => {
  const m = game.meta
  if (m.clearCount === 0 && m.climbCount === 0) {
    game.triggerTutorial('creation_intro')
  } else {
    game.triggerTutorial('meta_creation')
  }
})

const bonusAvailable = computed(() => game.meta.totalBonusStats)
const allocation = ref<Partial<Stats>>({})
const used = computed(() =>
  Object.values(allocation.value).reduce((sum, v) => sum + (v ?? 0), 0)
)

const STAT_KEYS: StatKey[] = ['힘', '민첩', '체력', '마력', '행운']
const RANDOM_KEYS: StatKey[] = ['힘', '민첩', '체력', '마력', '행운']

// 현재 표시될 스탯 — 주사위 결과(또는 균등 시작) + 진짜 보스 도전 보너스 자동 분배
//   분배 규칙(createCharacter와 동일): 5스탯 균등 base + 나머지 1pt씩 힘→민첩→체력→마력→행운 순
const previewStats = computed<Stats>(() => {
  const base = { ...(game.rolledStats ?? uniformStartingStats()) }
  const bonus = (game.meta.permanentStartBonus ?? 0) + (game.meta.pendingStartBonus ?? 0)
  if (bonus > 0) {
    const five: StatKey[] = ['힘', '민첩', '체력', '마력', '행운']
    const baseAdd = Math.floor(bonus / 5)
    const rem = bonus - baseAdd * 5
    for (const k of five) base[k] += baseAdd
    for (let i = 0; i < rem; i++) base[five[i]] += 1
  }
  return base
})
const previewSum = computed(() => Object.values(previewStats.value).reduce((s, v) => s + (v ?? 0), 0))

const rolling = ref(false)
async function rollDice() {
  if (game.rollsLeft <= 0 || rolling.value) return
  rolling.value = true
  // 잠깐 굴리는 애니메이션을 위해 100ms 지연
  await new Promise((r) => setTimeout(r, 150))
  game.rollCharacterDice()
  rolling.value = false
}

function adjust(stat: StatKey, delta: number) {
  const cur = allocation.value[stat] ?? 0
  const next = cur + delta
  if (next < 0) return
  if (delta > 0 && used.value + delta > bonusAvailable.value) return
  allocation.value[stat] = next
  if (next === 0) delete allocation.value[stat]
}

// 길게 눌러 연속 가속: 시작 400ms → 점차 50ms 까지 가속, 매 틱마다 +1
let holdTimer: ReturnType<typeof setTimeout> | null = null
function startHold(stat: StatKey, delta: number) {
  // 첫 1회 즉시 반응 (PointerEvent로 click이 같이 발생하지 않게 startHold 만 처리)
  adjust(stat, delta)
  let interval = 350
  const tick = () => {
    adjust(stat, delta)
    interval = Math.max(40, Math.round(interval * 0.82))
    holdTimer = setTimeout(tick, interval)
  }
  holdTimer = setTimeout(tick, interval)
}
function stopHold() {
  if (holdTimer) {
    clearTimeout(holdTimer)
    holdTimer = null
  }
}
onBeforeUnmount(() => stopHold())

function isSelected(key: string) {
  return game.selectedChallengeKey === key
}
function toggle(key: string) {
  game.selectChallenge(isSelected(key) ? null : key)
}
function start() {
  game.newGame(allocation.value)
}
function back() {
  game.setScreen('menu')
}
async function resetAll() {
  const ok = await game.confirmModal(
    '챌린지와 주사위 굴림을 모두 초기화하고 다시 시작합니다.',
    { title: '캐릭터 다시 굴리기', okLabel: '다시 굴리기', danger: true }
  )
  if (ok) game.resetCharacterCreation()
}

// 사용한 주사위 수
const usedDice = computed(() => 3 - game.rollsLeft)

// 도전 보너스 (영구 누적 + 마지막 1회 pending 합)
const startBonus = computed(() => (game.meta.permanentStartBonus ?? 0) + (game.meta.pendingStartBonus ?? 0))
const permanentBonus = computed(() => game.meta.permanentStartBonus ?? 0)
const drainPct = computed(() => Math.round((game.meta.lastBossDrainRatio ?? 0) * 100))

// 캐릭터 외형 선택 (10명 거지템 모에)
//   메인 화면은 현재 선택 흉상만 표시, "변경" 버튼으로 모달 열어 전신 좌우 페이저.
const avatarKeys = allUserAvatarKeys()

const pickerOpen = ref(false)
const pickerIndex = ref(0)

function openPicker() {
  const cur = game.selectedAvatar
  const idx = cur ? avatarKeys.indexOf(cur) : 0
  pickerIndex.value = idx >= 0 ? idx : 0
  pickerOpen.value = true
}
function closePicker() {
  pickerOpen.value = false
}
function pickerPrev() {
  pickerIndex.value = (pickerIndex.value - 1 + avatarKeys.length) % avatarKeys.length
}
function pickerNext() {
  pickerIndex.value = (pickerIndex.value + 1) % avatarKeys.length
}
function pickerConfirm() {
  const key = avatarKeys[pickerIndex.value]
  if (key) game.selectAvatar(key)
  pickerOpen.value = false
}

// 유저 캐릭터 이름 편집 — 단일 이름, LS 영구 저장.
async function editPlayerName() {
  const current = game.characterName(game.selectedAvatar)
  const input = await game.showInputDialog({
    title: '캐릭터 이름 변경',
    message: '새 이름을 입력하세요 (최대 12자, 비우면 추천 이름으로 복귀)',
    defaultValue: current,
    placeholder: current,
    okLabel: '저장',
  })
  if (input === null) return
  game.setPlayerName(input)
}
</script>

<template>
  <section
    class="flex-1 flex flex-col px-3 py-3 sm:px-4 sm:py-4 gap-3 sm:gap-4 max-w-3xl mx-auto w-full bg-cover bg-center"
    :style="{ backgroundImage: `linear-gradient(rgba(10,14,26,0.7), rgba(10,14,26,0.9)), url(${bgUrl})` }"
  >
    <header class="flex items-center justify-between">
      <h2 class="text-base sm:text-lg font-bold text-trait-special">새 캐릭터 생성</h2>
      <div class="flex gap-2">
        <button class="btn-secondary text-xs min-h-9 px-3" @click="resetAll">다시 굴리기</button>
        <button class="btn-secondary text-xs min-h-9 px-3" @click="back">뒤로</button>
      </div>
    </header>

    <!-- 도전 보너스 안내 (영구 누적 + 마지막 도전 결과) -->
    <div v-if="startBonus > 0" class="rounded-lg border border-grade-legend/40 bg-grade-legend/5 backdrop-blur-sm px-3 py-2 space-y-1">
      <div class="text-sm text-grade-legend font-bold">진짜 보스 도전 누적 보상</div>
      <div v-if="drainPct > 0" class="text-xs text-gray-300">
        마지막 도전: 보스 체력 <span class="text-trait-special font-mono font-bold">{{ drainPct }}/100</span> 깎음
      </div>
      <div class="text-xs text-log-reward">
        시작 능력치 총합 50 → <span class="font-mono font-bold">{{ 50 + startBonus }}pt</span>
        (+{{ startBonus }}pt 영구, 5스탯 균등 자동 분배)
      </div>
      <div class="text-xs text-gray-500">탑을 5번 오를 때마다 진짜 보스 도전 → 깎은 만큼(최대 {{ START_STAT_BASE }}pt) 영구 누적</div>
    </div>

    <!-- ====================================================== -->
    <!-- 캐릭터 외형 — sky 액센트                                  -->
    <!-- 현재 선택 캐릭터 흉상 + "변경" 버튼 (모달에서 좌우 페이저)   -->
    <!-- ====================================================== -->
    <div class="rounded-lg border border-sky-400/40 bg-bg-secondary/70 backdrop-blur-sm overflow-hidden">
      <div class="px-3 py-1.5 bg-sky-950/40 border-b border-sky-400/20 flex items-center justify-between">
        <span class="text-xs font-bold text-sky-200">🧍 캐릭터 외형</span>
        <span class="text-xs text-sky-200/60">전투 시 흉상으로 등장</span>
      </div>
      <div class="p-3 flex items-center gap-3">
        <img
          v-if="game.selectedAvatar"
          :src="userBustUrl(game.selectedAvatar)"
          :alt="game.characterName(game.selectedAvatar)"
          class="w-20 h-20 sm:w-24 sm:h-24 object-cover rounded-lg border border-sky-400/40 shadow-[0_0_14px_rgba(56,189,248,0.35)]"
          @error="(e) => ((e.target as HTMLImageElement).style.display = 'none')"
        />
        <div class="flex-1 min-w-0">
          <button
            type="button"
            class="flex items-center gap-1.5 max-w-full group active:scale-95 transition-transform"
            @click="editPlayerName"
            :title="'이름 변경'"
          >
            <span class="text-base text-sky-100 font-bold truncate">{{ game.characterName(game.selectedAvatar) }}</span>
            <span class="text-sky-400 text-sm shrink-0 group-hover:text-sky-200">✎</span>
          </button>
          <div class="text-xs text-gray-400 mt-0.5 leading-snug">이름을 눌러 변경, 우측 버튼으로 외형 변경</div>
        </div>
        <button
          type="button"
          class="btn-secondary text-xs min-h-9 px-3 shrink-0"
          @click="openPicker"
        >외형</button>
      </div>
    </div>

    <!-- ====================================================== -->
    <!-- 주사위 시스템 — grade-legend 액센트                       -->
    <!-- ====================================================== -->
    <div data-tutorial-target="dice-area" class="rounded-lg border border-grade-legend/40 bg-bg-secondary/70 backdrop-blur-sm overflow-hidden">
      <div class="px-3 py-1.5 bg-grade-legend/10 border-b border-grade-legend/30 flex items-center justify-between">
        <span class="text-xs font-bold text-grade-legend">🎲 주사위 — 능력치 굴림</span>
        <span class="text-xs text-gray-400">남은 굴림 <span class="text-grade-legend font-mono font-bold">{{ game.rollsLeft }}</span> / 3</span>
      </div>
      <div class="p-3 space-y-3">
        <div class="text-xs text-gray-400 leading-snug">시작은 모두 동일. 주사위를 굴려 5스탯에 60pt 랜덤 분배 (각 최소 0, 최대 무제한).</div>

        <!-- 주사위 3개 시각 -->
        <div class="flex gap-2 justify-center">
          <div
            v-for="i in 3"
            :key="i"
            :class="[
              'w-14 h-14 rounded-lg border-2 flex items-center justify-center text-2xl font-bold transition-all',
              usedDice >= i
                ? 'border-slate-700 bg-slate-800 text-gray-600'
                : 'border-grade-legend bg-grade-legend/10 text-grade-legend animate-pulse',
              rolling && usedDice + 1 === i ? 'rotate-12' : '',
            ]"
          >
            🎲
          </div>
        </div>

        <!-- 현재 스탯 (도전 보너스 자동 분배 적용) -->
        <div class="grid grid-cols-5 gap-1.5">
          <div v-for="s in RANDOM_KEYS" :key="s" class="bg-bg-tertiary/70 rounded-md px-1.5 py-1.5 text-center border border-slate-700/40">
            <div :class="['text-xs font-bold', statColorClass[s]]">{{ s }}</div>
            <div class="text-lg font-mono font-bold leading-tight">{{ previewStats[s] }}</div>
          </div>
        </div>
        <div class="text-xs text-center">
          <span class="text-gray-400">총합 </span>
          <span class="text-log-reward font-mono font-bold">{{ previewSum }}pt</span>
          <span v-if="startBonus > 0" class="text-gray-500"> (주사위 {{ previewSum - startBonus }} + 영구 보너스 {{ startBonus }})</span>
        </div>

        <!-- 5스탯 파생 효과 안내 -->
        <div class="text-xs text-gray-500 text-center leading-snug">
          힘 → 공격력·관통 / 민첩 → 속도·명중·회피 / 체력 → 방어력·HP / 마력 → MP·마법계수 / 행운 → 크리·발동률·보정
        </div>

        <button
          data-tutorial-target="dice-roll-btn"
          data-tutorial-cta-label="주사위 굴리기"
          class="btn-primary w-full min-h-11 text-sm font-bold disabled:opacity-30"
          :disabled="game.rollsLeft <= 0 || rolling"
          @click="rollDice"
        >
          <span v-if="rolling">🎲 굴리는 중...</span>
          <span v-else-if="game.rollsLeft > 0">🎲 주사위 굴리기 ({{ game.rollsLeft }} 남음)</span>
          <span v-else>주사위 모두 사용함</span>
        </button>
      </div>
    </div>

    <!-- ====================================================== -->
    <!-- 챌린지 선택 — pink 액센트 (톤 가이드: 챌린지/특별 이벤트)   -->
    <!-- ====================================================== -->
    <div data-tutorial-target="challenge-area" class="rounded-lg border border-pink-400/40 bg-bg-secondary/70 backdrop-blur-sm overflow-hidden">
      <div class="px-3 py-1.5 bg-pink-950/40 border-b border-pink-400/20 flex items-center justify-between gap-2">
        <span class="text-xs font-bold text-pink-200">⚔️ 챌린지 선택</span>
        <span class="text-xs text-pink-200/60">하나만 선택 (또는 미선택)</span>
      </div>
      <div class="p-2 grid gap-2 md:grid-cols-3">
        <div
          v-for="(c, idx) in game.challengeOptions"
          :key="c.key"
          @click="toggle(c.key)"
          :class="[
            'cursor-pointer border-2 rounded-lg p-3 transition-all relative active:scale-[0.98]',
            isSelected(c.key)
              ? 'border-pink-400 bg-pink-500/15 shadow-[0_0_18px_rgba(244,114,182,0.25)]'
              : 'border-slate-700 bg-bg-tertiary hover:bg-bg-hover',
          ]"
        >
          <!-- 챌린지 1/2/3 배지 이미지 (우상단) -->
          <img
            :src="`${A}/images/UI/챌린지${idx + 1}.webp`"
            :alt="`챌린지 ${idx + 1}`"
            class="absolute -top-3 -right-3 w-14 h-14 object-contain drop-shadow-lg z-10"
            @error="(e) => ((e.target as HTMLImageElement).style.display = 'none')"
          />
          <div class="flex items-baseline justify-between mb-1.5 pr-10 gap-2">
            <span :class="['text-xs px-2 py-0.5 rounded font-bold', c.category === 'instant' ? 'bg-cyan-950/60 text-cyan-200 border border-cyan-400/30' : 'bg-rose-950/60 text-rose-200 border border-rose-400/30']">
              {{ c.category === 'instant' ? '즉시 보상' : '리스크 베팅' }}
            </span>
            <span class="text-xs text-gray-500">{{ c.group }}</span>
          </div>
          <h3 :class="[isSelected(c.key) ? 'text-pink-200' : 'text-gray-100', 'font-bold text-sm']">{{ c.name }}</h3>
          <p class="text-xs text-gray-400 mt-1 leading-snug">{{ c.description }}</p>
          <div class="mt-2 space-y-0.5 text-xs">
            <div class="text-log-reward">✦ {{ c.reward }}</div>
            <div class="text-log-damage">✖ {{ c.penalty }}</div>
          </div>
        </div>
      </div>
    </div>

    <!-- ====================================================== -->
    <!-- 메타 보너스 자유 분배 — emerald 액센트 (회복/누적 — 톤)    -->
    <!-- 주사위 스탯과 동일하게 5컬럼 한 줄, 세로 정렬 (+/이름/값/−) -->
    <!-- ====================================================== -->
    <div v-if="bonusAvailable > 0" data-tutorial-target="bonus-alloc" class="rounded-lg border border-emerald-400/40 bg-bg-secondary/70 backdrop-blur-sm overflow-hidden">
      <div class="px-3 py-1.5 bg-emerald-950/40 border-b border-emerald-400/20 flex items-center justify-between">
        <span class="text-xs font-bold text-emerald-200">✦ 누적 보너스 자유 분배</span>
        <span class="text-xs text-emerald-200/80">사용 <span class="font-mono font-bold">{{ used }}</span> / {{ bonusAvailable }}</span>
      </div>
      <div class="p-2 grid grid-cols-5 gap-1.5">
        <div
          v-for="s in STAT_KEYS"
          :key="s"
          class="flex flex-col items-center gap-1 bg-bg-tertiary/60 rounded-md px-1 py-1.5 border border-slate-700/40"
        >
          <!-- + (위) -->
          <button
            class="w-9 h-9 rounded-md bg-emerald-700/60 hover:bg-emerald-700 active:scale-95 text-lg font-bold leading-none select-none transition disabled:opacity-30"
            :disabled="used >= bonusAvailable"
            @pointerdown.prevent="startHold(s, +1)"
            @pointerup="stopHold"
            @pointerleave="stopHold"
            @pointercancel="stopHold"
            @contextmenu.prevent
          >+</button>
          <!-- 스탯 이름 -->
          <span :class="['text-xs font-bold font-mono', statColorClass[s]]">{{ s }}</span>
          <!-- 값 -->
          <span class="text-base font-mono font-bold tabular-nums leading-none">{{ allocation[s] ?? 0 }}</span>
          <!-- − (아래) -->
          <button
            class="w-9 h-9 rounded-md bg-slate-700 hover:bg-slate-600 active:scale-95 text-lg font-bold leading-none select-none transition disabled:opacity-30"
            :disabled="(allocation[s] ?? 0) === 0"
            @pointerdown.prevent="startHold(s, -1)"
            @pointerup="stopHold"
            @pointerleave="stopHold"
            @pointercancel="stopHold"
            @contextmenu.prevent
          >−</button>
        </div>
      </div>
    </div>

    <!-- ====================================================== -->
    <!-- 하단 sticky — 탑 진입                                     -->
    <!-- ====================================================== -->
    <div class="sticky bottom-0 z-10 pt-3 pb-1 bg-gradient-to-t from-bg-primary/95 to-bg-primary/0">
      <button
        class="btn-primary w-full min-h-12 text-base font-bold tracking-wide"
        @click="start"
      >탑 진입</button>
    </div>

    <!-- ====================================================== -->
    <!-- 캐릭터 외형 변경 모달                                       -->
    <!--   전신 1명씩 표시, 좌우 버튼으로 페이지, 선택으로 확정.       -->
    <!-- ====================================================== -->
    <Teleport to="body">
      <div
        v-if="pickerOpen"
        class="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/70 backdrop-blur-sm"
        @click.self="closePicker"
      >
        <div class="w-full max-w-sm rounded-xl border-2 border-sky-400/60 bg-bg-secondary/95 shadow-[0_0_30px_rgba(56,189,248,0.35)] overflow-hidden flex flex-col">
          <!-- 헤더 -->
          <div class="px-4 py-2.5 bg-sky-950/50 border-b border-sky-400/30 flex items-center justify-between">
            <span class="text-sm font-bold text-sky-200">캐릭터 외형 선택</span>
            <button
              type="button"
              class="w-7 h-7 flex items-center justify-center rounded text-base text-gray-300 hover:bg-slate-700"
              @click="closePicker"
              aria-label="닫기"
            >✕</button>
          </div>

          <!-- 본문: 좌우 화살표 + 전신 -->
          <div class="relative px-3 py-4 flex items-center justify-center bg-bg-primary/40" style="min-height: 360px">
            <button
              type="button"
              class="absolute left-2 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-slate-800/90 hover:bg-slate-700 active:scale-95 text-2xl text-sky-200 border border-sky-400/40 shadow-lg flex items-center justify-center"
              @click="pickerPrev"
              aria-label="이전 캐릭터"
            >‹</button>

            <img
              :src="userAvatarUrl(avatarKeys[pickerIndex])"
              :alt="`캐릭터 ${avatarKeys[pickerIndex]}`"
              class="max-h-[320px] max-w-[70%] object-contain drop-shadow-[0_0_18px_rgba(56,189,248,0.35)]"
              @error="(e) => ((e.target as HTMLImageElement).style.display = 'none')"
            />

            <button
              type="button"
              class="absolute right-2 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-slate-800/90 hover:bg-slate-700 active:scale-95 text-2xl text-sky-200 border border-sky-400/40 shadow-lg flex items-center justify-center"
              @click="pickerNext"
              aria-label="다음 캐릭터"
            >›</button>
          </div>

          <!-- 페이지 인디케이터 -->
          <div class="px-4 py-2 flex items-center justify-center gap-1.5 bg-black/30 border-t border-slate-700/60">
            <span
              v-for="(_, i) in avatarKeys"
              :key="i"
              :class="[
                'w-1.5 h-1.5 rounded-full transition-colors',
                i === pickerIndex ? 'bg-sky-300' : 'bg-slate-600',
              ]"
            />
            <span class="ml-2 text-xs text-sky-200/80 font-mono">{{ pickerIndex + 1 }} / {{ avatarKeys.length }}</span>
          </div>

          <!-- 하단 액션 -->
          <div class="px-4 py-3 flex items-center gap-2 border-t border-slate-700/60">
            <button
              type="button"
              class="btn-secondary flex-1 min-h-11 text-sm"
              @click="closePicker"
            >취소</button>
            <button
              type="button"
              class="btn-primary flex-1 min-h-11 text-sm font-bold"
              @click="pickerConfirm"
            >이 캐릭터 선택</button>
          </div>
        </div>
      </div>
    </Teleport>
  </section>
</template>
