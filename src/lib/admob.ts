import { Capacitor } from '@capacitor/core'
import { AdMob, RewardAdPluginEvents } from '@capacitor-community/admob'
import type { AdUseCase } from './ads'

// Production AdMob Rewarded Ad Unit IDs (com.sykland.junkgeartower)
const REWARDED_AD_UNIT_IDS: Record<AdUseCase, string> = {
  fastSpeed: import.meta.env.VITE_ADMOB_FAST_SPEED_ID || 'ca-app-pub-6410281118825145/2005389411',
  revive: import.meta.env.VITE_ADMOB_REVIVE_ID || 'ca-app-pub-6410281118825145/5234565288',
  autoEnter: import.meta.env.VITE_ADMOB_AUTO_ENTER_ID || 'ca-app-pub-6410281118825145/5124404555',
  extraDice: import.meta.env.VITE_ADMOB_EXTRA_DICE_ID || 'ca-app-pub-6410281118825145/5234565288',
  shopRefresh: import.meta.env.VITE_ADMOB_SHOP_REFRESH_ID || 'ca-app-pub-6410281118825145/5124404555',
  shopGold: import.meta.env.VITE_ADMOB_SHOP_GOLD_ID || 'ca-app-pub-6410281118825145/2005389411',
}

let initialized = false
let initPromise: Promise<void> | null = null

export function isNativeAdMobAvailable(): boolean {
  try {
    return Capacitor.isNativePlatform()
  } catch {
    return false
  }
}

async function ensureInitialized(): Promise<void> {
  if (initialized) return
  if (!initPromise) {
    initPromise = AdMob.initialize({})
      .then(() => {
        initialized = true
      })
      .catch(() => {
        initPromise = null
      })
  }
  await initPromise
}

export async function showNativeRewardedAd(useCase: AdUseCase): Promise<boolean> {
  if (!isNativeAdMobAvailable()) return true

  try {
    await ensureInitialized()
    const adId = REWARDED_AD_UNIT_IDS[useCase] || REWARDED_AD_UNIT_IDS.revive

    let rewarded = false
    const handles = await Promise.all([
      AdMob.addListener(RewardAdPluginEvents.Showed, () => {
        window.dispatchEvent(new CustomEvent('gm-sdk-event', { detail: { name: 'SDK_GAME_PAUSE' } }))
      }),
      AdMob.addListener(RewardAdPluginEvents.Rewarded, () => {
        rewarded = true
      }),
      AdMob.addListener(RewardAdPluginEvents.Dismissed, () => {
        window.dispatchEvent(new CustomEvent('gm-sdk-event', { detail: { name: 'SDK_GAME_START' } }))
      }),
      AdMob.addListener(RewardAdPluginEvents.FailedToShow, () => {
        window.dispatchEvent(new CustomEvent('gm-sdk-event', { detail: { name: 'SDK_GAME_START' } }))
      }),
    ])

    try {
      await AdMob.prepareRewardVideoAd({ adId })
      await AdMob.showRewardVideoAd()
      return rewarded
    } catch {
      // Offline / no-fill / transient SDK failure: do not block player progress
      window.dispatchEvent(new CustomEvent('gm-sdk-event', { detail: { name: 'SDK_GAME_START' } }))
      return true
    } finally {
      await Promise.all(handles.map((h) => h.remove().catch(() => {})))
    }
  } catch {
    window.dispatchEvent(new CustomEvent('gm-sdk-event', { detail: { name: 'SDK_GAME_START' } }))
    return true
  }
}
