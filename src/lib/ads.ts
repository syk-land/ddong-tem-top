// ============================================================
// GameMonetize H5 SDK — Rewarded Ad 래퍼
// ============================================================
// 웹(Firebase Hosting) / GameMonetize 호스팅 두 트랙에서 동일하게 GameMonetize SDK 사용.
// SDK 가 로드되지 않은 경우 (dev, SDK 미초기화, 네트워크 차단)
// 자동으로 fallback (즉시 보상 지급) 으로 대체.
//
// SDK 로딩: index.html 의 <script src="https://api.gamemonetize.com/sdk.js">.
// 이벤트 전달: index.html 의 onEvent 콜백이 window 에 'gm-sdk-event' CustomEvent 를 dispatch.
//
// 활성화 절차:
//   1) GameMonetize 콘솔에서 게임 상태가 "Active" 로 승격
//   2) index.html 의 GameMonetize <script> 블록 주석 해제
//   3) 아래 BYPASS_ADS 를 false 로 변경
// ============================================================

// GameMonetize SDK 가 window 에 주입하는 함수/객체 타입 (느슨한 정의).
//
// 공식 API (GameMonetize.com-SDK README): SDK 는 `window.sdk` 객체로 노출되고
// 광고는 `sdk.showBanner()` 로 표시한다 (인자 없음 — 인터스티셜/보상형을 SDK 가
// 자체 관리, 완료는 SDK_GAME_START 이벤트로 통지).
//   if (typeof sdk !== 'undefined' && sdk.showBanner !== undefined) sdk.showBanner()
//
// 폴백: 일부 구버전/포크는 탑레벨 ShowAds() / sdk.showAd() 로 노출하므로 호환 유지.
declare global {
  interface Window {
    sdk?: {
      showBanner?: () => void
      showAd?: (type?: string) => void
      AdType?: { Rewarded?: string; Interstitial?: string }
      [k: string]: unknown
    }
    ShowAds?: (type?: string) => void
    ShowAds2?: (type?: string) => void
    MobileInGame?: (type?: string) => void
    SDK_OPTIONS?: unknown
  }
}

// ─── 임시 우회 (GameMonetize 활성화 전) ─────────────────────
// 콘솔 게임 상태가 "New" 단계에선 광고 호출이 no-fill 로 실패함.
// 그동안 "광고 보기" 버튼을 누르면 광고 없이 보상이 즉시 지급되도록 우회.
// 활성화 완료 후 false 로 바꾸면 됨.
const BYPASS_ADS = false

export type AdUseCase = 'revive' | 'fastSpeed' | 'autoEnter'

function isSdkReady(): boolean {
  if (typeof window === 'undefined') return false
  // 공식 API — GameMonetize 가 노출하는 sdk.showBanner()
  if (window.sdk && typeof window.sdk.showBanner === 'function') return true
  // 폴백 — 구버전/포크 호환
  if (typeof window.ShowAds === 'function') return true
  if (window.sdk && typeof window.sdk.showAd === 'function') return true
  return false
}

// SDK 호출 단일 진입점.
//   공식 GameMonetize SDK 의 showBanner() 는 인자가 없다 — 인터스티셜/보상형
//   구분 없이 SDK 가 적절한 광고를 띄우고, 완료는 SDK_GAME_START 이벤트로 통지.
//   type 인자는 폴백(ShowAds/showAd) 경로에서만 사용.
function callShowAd(type?: string): void {
  if (window.sdk && typeof window.sdk.showBanner === 'function') {
    window.sdk.showBanner()
    return
  }
  if (typeof window.ShowAds === 'function') {
    window.ShowAds(type)
    return
  }
  if (window.sdk && typeof window.sdk.showAd === 'function') {
    window.sdk.showAd(type)
    return
  }
  throw new Error('GameMonetize SDK function (sdk.showBanner / ShowAds / sdk.showAd) not found on window')
}

// 진단: GameMonetize SDK 가 window 의 어디에 자기 자신을 노출하는지 찾기.
// SDK_READY 후에도 window.sdk 가 undefined 인 케이스가 보고됨 — 객체 이름이
// 'sdk' 가 아닐 수 있음(SDK / gameMonetize / GameMonetize 등). 모든 후보 키와
// showAd 보유 여부를 한 번 출력해 실체를 파악.
let _sdkDiagPrinted = false
function diagSdk(): void {
  if (_sdkDiagPrinted) return
  _sdkDiagPrinted = true
  if (typeof window === 'undefined') return
  const w = window as unknown as Record<string, unknown>
  const keys = Object.keys(w).filter((k) => /sdk|game|ad|monet/i.test(k))
  const summary: Array<{ key: string; type: string; hasShowBanner: boolean; hasShowAd: boolean }> = []
  for (const k of keys) {
    const v = w[k] as { showBanner?: unknown; showAd?: unknown } | undefined
    summary.push({
      key: k,
      type: typeof v,
      hasShowBanner: !!v && typeof v === 'object' && typeof v.showBanner === 'function',
      hasShowAd: !!v && typeof v === 'object' && typeof v.showAd === 'function',
    })
  }
  console.info('[ads-diag] window keys matching /sdk|game|ad|monet/i', summary)
}

// 보상형 광고 표시 — 시청 완료 시 true, 실패/스킵 시 false.
//   BYPASS_ADS 또는 SDK 미로드 시: 즉시 true (PoC 동작 유지).
//   정상 동작 시: SDK rewarded 호출 후 이벤트로 결과 판정.
//
// useCase 는 통계/분석용 메타 — GameMonetize SDK 가 광고 단위를 자체 관리해서
// 코드에선 분기만 가능 (광고 단위 ID 를 직접 넘기지 않는다).
export async function showRewardedAd(useCase: AdUseCase): Promise<boolean> {
  diagSdk()
  console.info('[ads] showRewardedAd called', { useCase, BYPASS_ADS, sdkReady: isSdkReady() })
  if (BYPASS_ADS) return true
  if (!isSdkReady()) {
    // SDK 미로드 — dev / 네트워크 차단 / SDK 비활성화 상태. 즉시 보상.
    console.info('[ads] SDK not ready — granting immediate reward')
    return true
  }

  return new Promise<boolean>((resolve) => {
    let rewarded = false
    let settled = false
    const finish = (v: boolean) => {
      if (settled) return
      settled = true
      clearTimeout(timeoutHandle)
      window.removeEventListener('gm-sdk-event', onEvent)
      console.info('[ads] rewarded ad finished', { result: v, useCase })
      resolve(v)
    }
    const onEvent = (e: Event) => {
      const ce = e as CustomEvent
      const detail = ce.detail as { name?: string; message?: string } | undefined
      const name = detail?.name
      if (!name) return
      console.info('[ads] gm-sdk-event', name, detail?.message ?? '')
      // GameMonetize SDK 이벤트 이름은 버전마다 약간 다를 수 있어서 보수적으로 매칭.
      switch (name) {
        // ── 정상 완료 ──
        case 'SDK_REWARDED_WATCH_COMPLETE':
        case 'SDK_REWARDED_FINISHED':
        case 'AD_REWARDED':
        case 'AD_FINISHED':
        case 'AD_COMPLETE':
          rewarded = true
          finish(true)
          break
        // ── 사용자가 명시적으로 스킵 (보상 거부) ──
        case 'AD_SKIPPED':
          finish(false)
          break
        // ── 광고 fill 실패 / 인벤토리 부족 / SDK 오류 ──
        //   사용자 잘못 X (no-fill 은 "New" 단계의 정상 상황).
        //   클릭한 의도를 존중해 보상 지급.
        case 'AD_CANCELED':
        case 'AD_ERROR':
        case 'SDK_REWARDED_NOT_AVAILABLE':
          rewarded = true
          finish(true)
          break
        // ── 광고 흐름 종료 ──
        //   위에서 이미 settle 됐으면 no-op, 아니면 보상 폴백.
        case 'SDK_GAME_START':
          if (!settled) {
            rewarded = true
            finish(true)
          }
          break
      }
    }
    // 안전망 timeout — 이벤트가 전혀 fire 안 하거나 SDK stuck 상태인 경우.
    // GameMonetize SDK 가 inventory 없을 때 첫 시도는 12초 safety timer 로
    // AD_CANCELED 던지지만, 이후 ShowAds() 호출은 침묵하는 경우 관측됨.
    // → 8초 안에 아무 이벤트 없으면 "SDK 침묵 = no-fill" 로 간주, 보상 지급.
    const TIMEOUT_MS = 8_000
    const timeoutHandle = setTimeout(() => {
      console.warn('[ads] GameMonetize 광고 응답 8초 초과 — no-fill 로 간주, 보상 지급')
      rewarded = true
      finish(true)
    }, TIMEOUT_MS)
    window.addEventListener('gm-sdk-event', onEvent)
    try {
      const adType = window.sdk?.AdType?.Rewarded ?? 'rewarded'
      console.info('[ads] calling SDK ShowAds (rewarded)', { adType })
      callShowAd(adType)
    } catch (e) {
      console.warn('[ads] GameMonetize 광고 표시 실패:', e)
      finish(false)
    }
  })
}

// 인터스티셜 광고 — 프리롤/스테이지 간 노출용. rewarded 와 달리 결과 판정 없음 (표시 자체가 목적).
// GameMonetize 활성화 자격은 실제 ad request 트래픽 누적이 필요해서, 세션당 1회 프리롤만으로도
// "사용 중인 게임" 시그널이 명확해진다.
export function showInterstitial(): void {
  diagSdk()
  console.info('[ads] showInterstitial called', { BYPASS_ADS, sdkReady: isSdkReady() })
  if (BYPASS_ADS) return
  if (!isSdkReady()) return  // SDK 미로드 — dev/네트워크 차단. 조용히 패스
  try {
    console.info('[ads] calling SDK ShowAds (interstitial)')
    callShowAd()  // no-arg = 인터스티셜
  } catch (e) {
    console.warn('[ads] GameMonetize 인터스티셜 표시 실패:', e)
  }
}

// SDK 가 광고 재생 직전 SDK_GAME_PAUSE, 종료 후 SDK_GAME_START 를 던진다.
// 게임 자동 틱 / BGM 토글을 이 이벤트에 맞춰 동기화하면 광고 재생 중 게임이 진행되는 사고를 막을 수 있다.
// SDK_READY 는 SDK 가 광고 호출을 받을 준비가 된 시점.
export type GameMonetizeHandlers = {
  onPause?: () => void
  onResume?: () => void
  onReady?: () => void
}

export function onGameMonetizeLifecycle(handlers: GameMonetizeHandlers): () => void {
  const listener = (e: Event) => {
    const name = (e as CustomEvent).detail?.name as string | undefined
    if (!name) return
    if (name === 'SDK_GAME_PAUSE') handlers.onPause?.()
    else if (name === 'SDK_GAME_START') handlers.onResume?.()
    else if (name === 'SDK_READY') handlers.onReady?.()
  }
  window.addEventListener('gm-sdk-event', listener)
  return () => window.removeEventListener('gm-sdk-event', listener)
}

// SDK_READY 이벤트를 우리 리스너 attach 이전에 놓쳤을 가능성 대비 — 객체 존재로도 판정.
export function isGameMonetizeReady(): boolean {
  return isSdkReady()
}
