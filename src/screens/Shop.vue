<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from 'vue'
import { useGameStore } from '@/stores/game'
import ItemDetail from '@/ui/components/ItemDetail.vue'
import type { ItemInstance } from '@/types'
import { themeBgUrl, shopIconUrl } from '@/ui/images'
import { canEquipItem, shopForbidden, shopRefreshForbidden, mergedFlags } from '@/core/challengeRuntime'
import { getItemBuyPrice, getShopTemperCost } from '@/core/shop'
import { CHALLENGES_MAP } from '@/data/challenges'
import { showRewardedAd } from '@/lib/ads'
import { useI18n } from '@/lib/i18n'

const game = useGameStore()
const { t, td } = useI18n()

// 아이템 표시명 — '{trait} {grade} {baseKey}' 한국어 / 또는 영어 매핑
function itemLabel(it: ItemInstance): string {
  const trait = td(it.kind === 'weapon' ? 'trait.weapon' : 'trait.armor', it.trait)
  const grade = td('grade', it.grade)
  const base = td(it.kind === 'weapon' ? 'weapon' : 'armor', it.baseKey)
  return `${trait} ${grade} ${base}`
}

// 첫 상점 — 구매/판매/새로고침 안내 + 학습용 100G 1회 지급 + 매물 명중 강제는 createShop 쪽에서 처리
onMounted(() => {
  // 자동화 모드 (6배속) — 자동 매수 + 자동 이탈. 사용자가 화면을 거의 못 보지만
  // 일부러 빠른 진행을 선택한 모드라 그대로 OK.
  if (game.isAutoMode) {
    game.autoShopFlow()
    return
  }
  game.grantTutorialShopBonus()  // first_shop 마킹 전에만 1회 +100G
  game.triggerTutorial('first_shop')
})
const shop = computed(() => game.shop!)
const player = computed(() => game.run!.character)
const refresh = computed(() => game.run!.refreshState)
const inventory = computed(() => game.run!.inventory)
const bgUrl = computed(() => {
  const ch = game.currentChapterState
  return ch ? themeBgUrl(ch.theme) : ''
})
const currentChapterNum = computed(() => game.currentChapterState?.chapter ?? 1)
const temperCost = computed(() => getShopTemperCost(currentChapterNum.value, player.value))
const emergencyGoldAmount = computed(() => 80 * currentChapterNum.value)
const goldZeroForbidden = computed(() => !!game.challengeContext && !!mergedFlags(game.challengeContext).goldZero)
const refreshBlocked = computed(() => !!game.challengeContext && shopRefreshForbidden(game.challengeContext))
const shopListingRef = ref<HTMLElement | null>(null)

async function watchShopRefreshAd() {
  if (shop.value.adRefreshUsed || refreshBlocked.value) return
  const ok = await showRewardedAd('shopRefresh')
  if (!ok) {
    await game.alertModal(t('speed.adNotWatchedBody', '광고 시청이 완료되지 않았습니다.'), t('speed.adNotWatchedTitle', '활성화 실패'))
    return
  }
  game.grantAdShopRefresh()
}

async function watchShopGoldAd() {
  if (game.run?.adShopGoldUsed || goldZeroForbidden.value) return
  const ok = await showRewardedAd('shopGold')
  if (!ok) {
    await game.alertModal(t('speed.adNotWatchedBody', '광고 시청이 완료되지 않았습니다.'), t('speed.adNotWatchedTitle', '활성화 실패'))
    return
  }
  game.grantAdShopGold()
}

function priceOf(item: ItemInstance): number {
  return getItemBuyPrice(item, player.value)
}

async function buy(itemId: string) {
  const item = shop.value.inventory.find((i: ItemInstance) => i.id === itemId)
  if (!item) return
  const price = priceOf(item)
  if (player.value.gold < price) return
  const ok = await game.confirmModal(
    t('shop.buyConfirmBody', `${itemLabel(item)}\n\n${price}G에 구매?`, { item: itemLabel(item), gold: price }),
    { title: t('shop.buyConfirmTitle', '장비 구매'), okLabel: t('shop.buyBtn', '구매') }
  )
  if (!ok) return
  await game.buyItemAndEquip(item)
}

async function temperSlot(slot: 'weapon' | 'armor') {
  const target = player.value[slot]
  if (!target || shop.value.temperUsed || (target.temperLevel ?? 0) >= 3) return
  if (game.challengeContext && shopForbidden(game.challengeContext)) return
  const ok = await game.confirmModal(
    t('shop.temperConfirmBody', `${itemLabel(target)}\n\n${temperCost.value}G로 부식 연성 (+18% 계수 · 티어 유지)?`, {
      item: itemLabel(target),
      gold: temperCost.value,
    }),
    { title: t('shop.temperTitle', '모루: 부식 연성'), okLabel: t('shop.temperBtn', '연성') },
  )
  if (!ok) return
  await game.temperItemInShop(slot)
}
function refreshShop() {
  game.refreshShopAction()
  nextTick(() => {
    shopListingRef.value?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  })
}
function leave() {
  game.leaveShop()
}
async function sellSlot(slot: 'weapon' | 'armor') {
  if (sellForbidden.value) {
    await game.alertModal(
      t('shop.sellForbiddenBody', '파괴주의자 챌린지로 인해 장비를 판매할 수 없습니다.'),
      t('shop.sellForbiddenTitle', '판매 불가'),
    )
    return
  }
  const item = player.value[slot]
  if (!item) return
  const ok = await game.confirmModal(
    t('shop.sellConfirmBody', `${itemLabel(item)}\n\n${item.buyback}G에 판매?`, { item: itemLabel(item), gold: item.buyback }),
    { title: t('shop.sellConfirmTitle', '장비 판매'), okLabel: t('shop.sellBtn', '판매') }
  )
  if (ok) game.sellEquipped(slot)
}
async function sellInventory(idx: number) {
  if (sellForbidden.value) {
    await game.alertModal(
      t('shop.sellForbiddenBody', '파괴주의자 챌린지로 인해 장비를 판매할 수 없습니다.'),
      t('shop.sellForbiddenTitle', '판매 불가'),
    )
    return
  }
  const item = inventory.value[idx]
  if (!item) return
  const ok = await game.confirmModal(
    t('shop.sellConfirmBody', `${itemLabel(item)}\n\n${item.buyback}G에 판매?`, { item: itemLabel(item), gold: item.buyback }),
    { title: t('shop.sellInvConfirmTitle', '인벤토리 판매'), okLabel: t('shop.sellBtn', '판매') }
  )
  if (ok) game.sellFromInventory(idx)
}

const totalBuyback = computed(() =>
  inventory.value.reduce((sum, it) => sum + it.buyback, 0)
)

// 챌린지 제약으로 못 쓰는 아이템 — buy 도 막음 (사도 의미 없음)
function checkEquip(item: ItemInstance): { ok: boolean; reason?: string } {
  if (!game.challengeContext) return { ok: true }
  return canEquipItem(item, game.challengeContext)
}

// 챌린지: 장비 판매 금지 (파괴주의자 — noBuyback)
const sellForbidden = computed(() => {
  const ctx = game.challengeContext
  if (!ctx) return false
  return ctx.active.some((ac) => !ac.failed && CHALLENGES_MAP[ac.key]?.flags?.noBuyback)
})

async function sellAll() {
  if (sellForbidden.value) {
    await game.alertModal(
      t('shop.sellForbiddenBody', '파괴주의자 챌린지로 인해 장비를 판매할 수 없습니다.'),
      t('shop.sellForbiddenTitle', '판매 불가'),
    )
    return
  }
  if (inventory.value.length === 0) return
  const total = totalBuyback.value
  const ok = await game.confirmModal(
    t('shop.sellAllConfirmBody', `인벤토리 ${inventory.value.length}개 아이템을 모두 ${total}G에 일괄 판매합니다.`, { count: inventory.value.length, gold: total }),
    { title: t('shop.sellAllConfirmTitle', '전부 판매'), okLabel: t('shop.sellAllBtn', '전부 판매') }
  )
  if (!ok) return
  const got = game.sellAllFromInventory()
  await game.alertModal(
    t('shop.sellAllDoneBody', `+${got}G 획득`, { gold: got }),
    t('shop.sellAllDoneTitle', '판매 완료'),
  )
}

void bgUrl  // 추후 배경 활용 여지
</script>

<template>
  <section class="flex-1 flex flex-col px-2 py-2 sm:px-3 sm:py-3 gap-2 sm:gap-3 max-w-4xl mx-auto w-full">
    <!-- ── 헤더 — 황금고블린 이미지가 카드 가득 + 텍스트 오버레이 ── -->
    <div class="relative rounded-lg border border-amber-400/50 backdrop-blur-sm overflow-hidden shadow-[0_0_18px_rgba(251,191,36,0.18)] min-h-24">
      <img
        :src="shopIconUrl()"
        :alt="t('shop.shopkeeperAlt', '황금고블린')"
        class="absolute inset-0 w-full h-full object-cover"
      />
      <!-- 다크 그라데이션 -->
      <div class="absolute inset-0 bg-gradient-to-r from-bg-secondary/85 via-bg-secondary/20 to-bg-secondary/85"></div>
      <!-- 콘텐츠 -->
      <div class="relative flex items-center gap-2.5 px-3 py-2 min-h-24">
        <div class="flex-1 min-w-0">
          <div class="text-base font-bold text-amber-300 truncate drop-shadow">{{ t('shop.title', '황금고블린 상점') }}</div>
          <div class="text-xs text-amber-100/80 drop-shadow">
            {{ t('shop.refreshLabel', '새로고침') }}
            <span class="font-mono tabular-nums text-amber-50">{{ refresh.charges }}</span>
            <span class="text-amber-100/40"> / {{ refresh.cap }}</span>
          </div>
        </div>
        <div class="px-2.5 py-1 rounded-md bg-amber-950/80 border border-amber-400/50 text-stat-luck text-sm font-bold font-mono shrink-0 flex items-center gap-1">
          <span class="text-amber-400">⬢</span>
          <span class="tabular-nums">{{ player.gold }}G</span>
        </div>
      </div>
    </div>

    <!-- ====================================================== -->
    <!-- 판매 영역 — amber 액센트                                 -->
    <!-- ====================================================== -->

    <!-- 장착 중 (판매) -->
    <div data-tutorial-target="shop-sell" class="rounded-lg border border-amber-400/30 bg-bg-secondary/60 backdrop-blur-sm overflow-hidden">
      <div class="px-3 py-1.5 bg-amber-950/40 border-b border-amber-400/20 flex items-center justify-between">
        <span class="text-xs font-bold text-amber-300">{{ t('shop.equipped.header', '💰 장착 중 (판매)') }}</span>
      </div>
      <div class="p-2 space-y-2">
        <div class="bg-bg-tertiary/60 rounded-md p-2 border border-slate-700/40 flex items-stretch gap-2">
          <div class="flex-1 min-w-0">
            <ItemDetail v-if="player.weapon" :item="player.weapon" :character="player" />
            <div v-else class="text-sm text-gray-500 italic text-center py-6">{{ t('shop.empty.weapon', '미 착용') }}</div>
          </div>
          <button
            v-if="player.weapon"
            :class="['shrink-0 w-16 rounded-md font-bold border-2 active:scale-[0.98] transition flex flex-col items-center justify-center gap-0.5 px-1',
              sellForbidden
                ? 'bg-slate-800/60 text-gray-500 border-slate-700/60 cursor-not-allowed'
                : 'bg-amber-500/20 text-amber-200 hover:bg-amber-500/30 border-amber-400/40']"
            :disabled="sellForbidden"
            @click="sellSlot('weapon')"
            :title="t('shop.sellTooltip', `${player.weapon.buyback}G 판매`, { gold: player.weapon.buyback })"
          >
            <span class="text-xs uppercase tracking-wide opacity-80">{{ t('shop.sellBtn', '판매') }}</span>
            <span class="font-mono tabular-nums text-sm leading-tight">+{{ player.weapon.buyback }}G</span>
          </button>
        </div>
        <div class="bg-bg-tertiary/60 rounded-md p-2 border border-slate-700/40 flex items-stretch gap-2">
          <div class="flex-1 min-w-0">
            <ItemDetail v-if="player.armor" :item="player.armor" :character="player" />
            <div v-else class="text-sm text-gray-500 italic text-center py-6">{{ t('shop.empty.armor', '없음') }}</div>
          </div>
          <button
            v-if="player.armor"
            :class="['shrink-0 w-16 rounded-md font-bold border-2 active:scale-[0.98] transition flex flex-col items-center justify-center gap-0.5 px-1',
              sellForbidden
                ? 'bg-slate-800/60 text-gray-500 border-slate-700/60 cursor-not-allowed'
                : 'bg-amber-500/20 text-amber-200 hover:bg-amber-500/30 border-amber-400/40']"
            :disabled="sellForbidden"
            @click="sellSlot('armor')"
            :title="t('shop.sellTooltip', `${player.armor.buyback}G 판매`, { gold: player.armor.buyback })"
          >
            <span class="text-xs uppercase tracking-wide opacity-80">{{ t('shop.sellBtn', '판매') }}</span>
            <span class="font-mono tabular-nums text-sm leading-tight">+{{ player.armor.buyback }}G</span>
          </button>
        </div>
      </div>
    </div>

    <!-- 인벤토리 슬롯 판매 -->
    <div
      v-if="inventory.length > 0"
      class="rounded-lg border border-amber-400/30 bg-bg-secondary/60 backdrop-blur-sm overflow-hidden"
    >
      <div class="px-3 py-1.5 bg-amber-950/40 border-b border-amber-400/20 flex items-center justify-between gap-2">
        <span class="text-xs font-bold text-amber-300">{{ t('shop.inventory.header', '📦 인벤토리 (판매)') }}</span>
        <button
          :class="['text-xs px-3 min-h-9 rounded-md font-bold active:scale-[0.98] transition',
            sellForbidden
              ? 'bg-slate-800/60 text-gray-500 cursor-not-allowed'
              : 'bg-stat-luck text-black hover:opacity-85']"
          :disabled="sellForbidden"
          @click="sellAll"
        >{{ sellForbidden ? t('shop.sellForbiddenTitle', '판매 불가') : t('shop.sellAllAmount', `전부 +${totalBuyback}G`, { gold: totalBuyback }) }}</button>
      </div>
      <div class="p-2 space-y-2">
        <div
          v-for="(item, idx) in inventory"
          :key="item.id"
          class="bg-bg-tertiary/60 rounded-md p-2 border border-slate-700/40 flex items-stretch gap-2"
        >
          <div class="flex-1 min-w-0">
            <ItemDetail :item="item" :character="player" />
          </div>
          <button
            :class="['shrink-0 w-16 rounded-md font-bold border-2 active:scale-[0.98] transition flex flex-col items-center justify-center gap-0.5 px-1',
              sellForbidden
                ? 'bg-slate-800/60 text-gray-500 border-slate-700/60 cursor-not-allowed'
                : 'bg-amber-500/20 text-amber-200 hover:bg-amber-500/30 border-amber-400/40']"
            :disabled="sellForbidden"
            @click="sellInventory(idx)"
            :title="t('shop.sellTooltip', `${item.buyback}G 판매`, { gold: item.buyback })"
          >
            <span class="text-xs uppercase tracking-wide opacity-80">{{ t('shop.sellBtn', '판매') }}</span>
            <span class="font-mono tabular-nums text-sm leading-tight">+{{ item.buyback }}G</span>
          </button>
        </div>
      </div>
    </div>

    <!-- ====================================================== -->
    <!-- 구매 영역 -->
    <!-- ====================================================== -->
    <div
      ref="shopListingRef"
      data-tutorial-target="shop-slot"
      class="rounded-lg border border-cyan-400/40 bg-bg-secondary/60 backdrop-blur-sm overflow-hidden scroll-mt-2 shadow-[0_0_18px_rgba(34,211,238,0.12)]"
    >
      <div class="px-3 py-1.5 bg-cyan-950/40 border-b border-cyan-400/20 flex items-center justify-between gap-2">
        <span class="text-xs font-bold text-cyan-200">{{ t('shop.listing.header', '🛒 상점 매물 (구매)') }}</span>
        <span class="text-xs text-cyan-300/70">{{ shop.inventory.length }}{{ t('shop.itemSuffix', '개') }}</span>
      </div>
      <div class="p-2 space-y-2">
        <div
          v-for="item in shop.inventory"
          :key="item.id"
          class="bg-bg-tertiary/60 rounded-md p-2 border border-slate-700/40 flex items-stretch gap-2"
        >
          <div class="flex-1 min-w-0">
            <ItemDetail :item="item" :character="player" />
          </div>
          <!-- 챌린지로 못 쓰는 아이템: 구매불가 / 골드 부족: disabled / 정상: 구매 -->
          <button
            v-if="!checkEquip(item).ok"
            class="shrink-0 w-16 rounded-md font-bold border-2 bg-rose-950/40 text-rose-300 border-rose-500/40 cursor-not-allowed flex flex-col items-center justify-center gap-0.5 px-1"
            :disabled="true"
            :title="checkEquip(item).reason"
          >
            <span class="text-xs uppercase tracking-wide opacity-80">{{ t('shop.buyBtn', '구매') }}</span>
            <span class="text-xs font-bold leading-tight">{{ t('shop.buyForbidden', '불가') }}</span>
          </button>
          <button
            v-else
            class="shrink-0 w-16 rounded-md font-bold transition active:scale-[0.98] border-2 flex flex-col items-center justify-center gap-0.5 px-1"
            :class="player.gold < priceOf(item)
              ? 'bg-slate-800/60 text-gray-500 border-slate-700/60 cursor-not-allowed'
              : 'bg-cyan-500/20 text-cyan-100 hover:bg-cyan-500/35 border-cyan-400/60'"
            :disabled="player.gold < priceOf(item)"
            @click="buy(item.id)"
            :title="t('shop.buyTooltip', `${priceOf(item)}G 구매`, { gold: priceOf(item) })"
          >
            <span class="text-xs uppercase tracking-wide opacity-80">{{ t('shop.buyBtn', '구매') }}</span>
            <span class="font-mono tabular-nums text-sm leading-tight">{{ priceOf(item) }}G</span>
          </button>
        </div>
      </div>
    </div>

    <!-- ====================================================== -->
    <!-- 모루: 부식 연성 (티어 유지 강화, 상점당 1회)                -->
    <!-- ====================================================== -->
    <div class="rounded-lg border border-orange-400/40 bg-bg-secondary/60 backdrop-blur-sm overflow-hidden">
      <div class="px-3 py-1.5 bg-orange-950/40 border-b border-orange-400/20 flex items-center justify-between gap-2">
        <span class="text-xs font-bold text-orange-200">[ANVIL] {{ t('shop.temperHeader', '모루: 부식 연성 (티어 유지)') }}</span>
        <span class="text-xs font-mono text-orange-200/80">{{ shop.temperUsed ? t('shop.temperDone', '이번 상점 완료') : `${temperCost}G` }}</span>
      </div>
      <div class="p-2 grid grid-cols-2 gap-2">
        <button
          type="button"
          class="rounded-md border px-2.5 py-2 text-left transition active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed"
          :class="!shop.temperUsed && player.weapon && (player.weapon.temperLevel ?? 0) < 3 && player.gold >= temperCost
            ? 'border-orange-400/60 bg-orange-950/30 hover:bg-orange-900/40 text-orange-100'
            : 'border-slate-700/60 bg-slate-800/50 text-gray-400'"
          :disabled="!!shop.temperUsed || !player.weapon || (player.weapon.temperLevel ?? 0) >= 3 || player.gold < temperCost"
          @click="temperSlot('weapon')"
        >
          <div class="text-xs font-bold">{{ t('shop.temperWeapon', '무기 연성') }}</div>
          <div class="text-[11px] font-mono">
            {{ player.weapon ? `+${player.weapon.temperLevel ?? 0} -> +${Math.min(3, (player.weapon.temperLevel ?? 0) + 1)}` : t('shop.empty.weapon', '미 착용') }}
          </div>
        </button>
        <button
          type="button"
          class="rounded-md border px-2.5 py-2 text-left transition active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed"
          :class="!shop.temperUsed && player.armor && (player.armor.temperLevel ?? 0) < 3 && player.gold >= temperCost
            ? 'border-orange-400/60 bg-orange-950/30 hover:bg-orange-900/40 text-orange-100'
            : 'border-slate-700/60 bg-slate-800/50 text-gray-400'"
          :disabled="!!shop.temperUsed || !player.armor || (player.armor.temperLevel ?? 0) >= 3 || player.gold < temperCost"
          @click="temperSlot('armor')"
        >
          <div class="text-xs font-bold">{{ t('shop.temperArmor', '갑옷 연성') }}</div>
          <div class="text-[11px] font-mono">
            {{ player.armor ? `+${player.armor.temperLevel ?? 0} -> +${Math.min(3, (player.armor.temperLevel ?? 0) + 1)}` : t('shop.empty.armor', '없음') }}
          </div>
        </button>
      </div>
    </div>

    <!-- ====================================================== -->
    <!-- 하단 액션 (sticky)                                       -->
    <!-- ====================================================== -->
    <div class="space-y-1.5 sticky bottom-0 z-10 pt-2 pb-1 bg-gradient-to-t from-bg-primary/95 to-bg-primary/0">
      <div v-if="(refresh.charges <= 0 && !refreshBlocked && !shop.adRefreshUsed) || (!game.run?.adShopGoldUsed && !goldZeroForbidden)" class="flex gap-2">
        <button
          v-if="refresh.charges <= 0 && !refreshBlocked && !shop.adRefreshUsed"
          type="button"
          class="flex-1 min-h-9 px-3 rounded-md font-bold text-xs border border-amber-400/60 bg-amber-950/50 hover:bg-amber-900/60 text-amber-200 transition"
          @click="watchShopRefreshAd"
        >[AD] {{ t('shop.adRefresh', '광고: 무료 새로고침 +1') }}</button>
        <button
          v-if="!game.run?.adShopGoldUsed && !goldZeroForbidden"
          type="button"
          class="flex-1 min-h-9 px-3 rounded-md font-bold text-xs border border-emerald-400/60 bg-emerald-950/50 hover:bg-emerald-900/60 text-emerald-200 transition"
          @click="watchShopGoldAd"
        >[AD] {{ t('shop.adGold', `긴급 군자금 +${emergencyGoldAmount}G`, { gold: emergencyGoldAmount }) }}</button>
      </div>
      <div class="flex gap-2">
        <button
          data-tutorial-target="shop-refresh"
          class="flex-1 min-h-12 px-4 rounded-md font-bold text-sm transition active:scale-[0.98] border-2 disabled:opacity-40 disabled:cursor-not-allowed"
          :class="refresh.charges <= 0
            ? 'bg-slate-800/70 text-gray-500 border-slate-700/60'
            : 'bg-bg-tertiary text-gray-100 border-slate-600/70 hover:bg-slate-700'"
          :disabled="refresh.charges <= 0"
          @click="refreshShop"
        >{{ t('shop.refreshBtn', '🔄 새로고침') }} <span class="text-gray-400 font-mono ml-1">({{ refresh.charges }})</span></button>
        <button
          class="min-h-12 px-5 rounded-md font-bold text-sm bg-bg-tertiary text-gray-100 border-2 border-slate-600/70 hover:bg-slate-700 active:scale-[0.98] transition"
          @click="leave"
        >{{ t('shop.leaveBtn', '나가기') }}</button>
      </div>
    </div>
  </section>
</template>
