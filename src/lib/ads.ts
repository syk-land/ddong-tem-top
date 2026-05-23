// ============================================================
// Google AdMob — Rewarded Ad 래퍼
// ============================================================
// Capacitor 네이티브 환경에서만 동작. 웹/dev 환경에서는 plugin 호출 실패 시
// 자동으로 fallback (즉시 보상 지급) 으로 대체.
//
// 광고 단위 ID:
//   - 사용자가 AdMob Console 에서 발급 받기 전까지 Google 공식 test ID 사용
//   - 광고 단위 발급 후 PROD_AD_UNIT_REVIVE 등을 교체
// ============================================================

import { Capacitor } from '@capacitor/core'
import {
  AdMob,
  RewardAdPluginEvents,
  type RewardAdOptions,
  type AdMobRewardItem,
} from '@capacitor-community/admob'

// ─── 임시 우회 (AdMob 승인 전) ─────────────────────────────
// AdMob 광고 단위 승인이 나기 전까지는 광고 호출 자체가 실패함.
// 그동안 "광고 보기" 버튼을 누르면 광고 없이 보상이 즉시 지급되도록 우회.
// 승인이 완료되면 false 로 바꾸기만 하면 됨.
const BYPASS_ADS = true

// ── Google 공식 test 광고 단위 ID (안드로이드 / Rewarded) ──
//   참고: https://developers.google.com/admob/android/test-ads
const TEST_REWARDED_AD_UNIT = 'ca-app-pub-3940256099942544/5224354917'

// ── 실제 광고 단위 ID (AdMob Console 발급, Rewarded) ──
const PROD_AD_UNIT_REVIVE     = 'ca-app-pub-6410281118825145/5234565288'  // 부활
const PROD_AD_UNIT_4X_SPEED   = 'ca-app-pub-6410281118825145/2005389411'  // 4배속
const PROD_AD_UNIT_AUTO_ENTER = 'ca-app-pub-6410281118825145/5124404555'  // 자동 진입

export type AdUseCase = 'revive' | 'fastSpeed' | 'autoEnter'

function getAdUnitId(useCase: AdUseCase): string {
  // 네이티브 환경이 아니면 어차피 호출되지 않음 (위에서 차단)
  // dev / debug 환경에선 test ID 강제
  if (import.meta.env.DEV) return TEST_REWARDED_AD_UNIT
  switch (useCase) {
    case 'revive':    return PROD_AD_UNIT_REVIVE    || TEST_REWARDED_AD_UNIT
    case 'fastSpeed': return PROD_AD_UNIT_4X_SPEED  || TEST_REWARDED_AD_UNIT
    case 'autoEnter': return PROD_AD_UNIT_AUTO_ENTER || TEST_REWARDED_AD_UNIT
  }
}

// 네이티브 플랫폼 여부 (Capacitor android/ios)
function isNative(): boolean {
  try {
    return Capacitor.isNativePlatform()
  } catch {
    return false
  }
}

let initialized = false
async function initIfNeeded() {
  if (initialized || !isNative()) return
  try {
    await AdMob.initialize({
      // testingDevices: ['EMULATOR'],  // 필요 시 추가
      initializeForTesting: import.meta.env.DEV,
    })
    initialized = true
  } catch (e) {
    console.warn('[ads] AdMob 초기화 실패:', e)
  }
}

// 보상형 광고 표시 — 시청 완료 시 true, 실패/스킵 시 false
//   웹/dev 비-네이티브 환경: 자동 true 반환 (확인 메시지 없이 즉시 보상)
//   네이티브: 광고 prepare → show → reward 이벤트 대기
export async function showRewardedAd(useCase: AdUseCase): Promise<boolean> {
  // AdMob 승인 전 임시 우회 — 항상 보상 즉시 지급
  if (BYPASS_ADS) return true
  if (!isNative()) {
    // 웹/dev — AdMob 안 됨, 즉시 보상 (PoC 동작 유지)
    return true
  }

  await initIfNeeded()
  if (!initialized) return false

  const adUnitId = getAdUnitId(useCase)
  const opts: RewardAdOptions = {
    adId: adUnitId,
  }

  return new Promise<boolean>((resolve) => {
    let rewarded = false
    let settled = false
    // 각 리스너의 PluginListenerHandle 모아두고 cleanup 시 해제
    const handles: Array<{ remove: () => Promise<void> } | undefined> = []
    const cleanup = () => {
      for (const h of handles) {
        try { h?.remove() } catch {}
      }
    }
    // 단일 resolve 보장 + timeout 해제. 4개 이벤트가 동시에 fire 되거나 timeout
    // 과 경쟁할 때 중복 resolve 가 일어나도 첫 호출만 유효.
    const finish = (v: boolean) => {
      if (settled) return
      settled = true
      clearTimeout(timeoutHandle)
      cleanup()
      resolve(v)
    }
    // 안전망 timeout — Rewarded/Dismissed/FailedToShow/FailedToLoad 4개 이벤트가
    // 모두 발화 안 하거나 AdMob 플러그인 자체 stuck 인 경우 (네트워크 끊김 / webview
    // 일시 정지 등) 무한 대기 방지. 30초 후 false 반환 → 부활/속도 흐름이 살아남.
    const TIMEOUT_MS = 30_000
    const timeoutHandle = setTimeout(() => {
      console.warn('[ads] 광고 응답 30초 초과 — false 반환')
      finish(false)
    }, TIMEOUT_MS)

    // 보상 지급 이벤트
    AdMob.addListener(RewardAdPluginEvents.Rewarded, (_reward: AdMobRewardItem) => {
      rewarded = true
    }).then((h) => handles.push(h)).catch(() => {})
    // 광고 닫힘 → 결과 resolve
    AdMob.addListener(RewardAdPluginEvents.Dismissed, () => {
      finish(rewarded)
    }).then((h) => handles.push(h)).catch(() => {})
    // 표시 실패 / 로드 실패
    AdMob.addListener(RewardAdPluginEvents.FailedToShow, () => {
      finish(false)
    }).then((h) => handles.push(h)).catch(() => {})
    AdMob.addListener(RewardAdPluginEvents.FailedToLoad, () => {
      finish(false)
    }).then((h) => handles.push(h)).catch(() => {})

    ;(async () => {
      try {
        await AdMob.prepareRewardVideoAd(opts)
        await AdMob.showRewardVideoAd()
      } catch (e) {
        console.warn('[ads] 광고 표시 실패:', e)
        finish(false)
      }
    })()
  })
}
