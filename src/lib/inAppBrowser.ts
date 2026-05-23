// 인앱 브라우저 감지 + 외부 브라우저 강제 오픈 유틸.
//
// Google OAuth (signInWithPopup) 은 카카오톡/네이버/페이스북/인스타/라인 등
// 인앱 WebView 에서 "disallowed_useragent" 로 막히거나 팝업이 빈 화면이 된다.
// 이 경우 사용자에게 Chrome/Safari 같은 외부 브라우저로 다시 열도록 안내해야 한다.
// 카카오톡·네이버는 앱 고유 스킴으로 외부 브라우저 강제 오픈이 가능.

export type InAppBrowserKind =
  | 'kakaotalk'
  | 'naver'
  | 'facebook'
  | 'instagram'
  | 'line'
  | 'twitter'
  | 'daum'

const NAMES: Record<InAppBrowserKind, string> = {
  kakaotalk: '카카오톡',
  naver: '네이버 앱',
  facebook: '페이스북',
  instagram: '인스타그램',
  line: '라인',
  twitter: '트위터/X',
  daum: '다음 앱',
}

export function detectInAppBrowser(): InAppBrowserKind | null {
  if (typeof navigator === 'undefined') return null
  const ua = navigator.userAgent
  // Capacitor 네이티브 빌드는 자체 Google Sign-In 플러그인을 쓰므로 여기서 잡지 않는다.
  // (auth.ts 의 isNative() 분기에서 이미 다른 경로로 갈림)
  if (/KAKAOTALK/i.test(ua)) return 'kakaotalk'
  // NAVER 앱 인앱: "NAVER(inapp; ...)" 형태 또는 단독 "NAVER" 토큰.
  if (/NAVER\(inapp/i.test(ua) || /; NAVER /i.test(ua)) return 'naver'
  if (/FBAN|FBAV|FB_IAB/i.test(ua)) return 'facebook'
  if (/Instagram/i.test(ua)) return 'instagram'
  if (/\bLine\//i.test(ua)) return 'line'
  if (/Twitter/i.test(ua)) return 'twitter'
  if (/DaumApps/i.test(ua)) return 'daum'
  return null
}

export function inAppBrowserName(kind: InAppBrowserKind): string {
  return NAMES[kind]
}

// 앱 고유 스킴으로 외부 브라우저 강제 오픈이 가능한지.
export function canOpenExternal(kind: InAppBrowserKind): boolean {
  return kind === 'kakaotalk' || kind === 'naver'
}

// 외부 브라우저로 강제 점프. 스킴이 없는 앱은 false 리턴 → 호출자가 폴백(클립보드 복사 등) 처리.
export function openInExternalBrowser(kind: InAppBrowserKind): boolean {
  const url = window.location.href
  switch (kind) {
    case 'kakaotalk':
      // 카카오톡 공식 스킴 — 현재 URL 을 시스템 기본 브라우저로 연다.
      window.location.href = `kakaotalk://web/openExternal?url=${encodeURIComponent(url)}`
      return true
    case 'naver':
      // 네이버 앱 인앱 브라우저 → 새 외부 브라우저 탭으로 이동.
      window.location.href = `naversearchapp://inappbrowser?url=${encodeURIComponent(url)}&target=new&version=6`
      return true
    default:
      return false
  }
}

// 폴백: 현재 URL 을 클립보드에 복사. 성공 여부 리턴.
export async function copyUrlToClipboard(): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(window.location.href)
    return true
  } catch {
    return false
  }
}
