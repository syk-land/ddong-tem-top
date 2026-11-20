// 개발 서버 (vite dev) 일 때만 true. `npm run build` 로 만든 production 번들에선 false.
//
// import.meta.env.DEV 는 Vite 가 빌드 시 boolean 상수로 인라인하므로,
// `if (IS_DEV_SERVER) { ... }` 또는 `IS_DEV_SERVER && expr` 패턴은
// production 빌드에서 dead branch 가 되어 minifier 가 제거한다.
//
// 사용처: 자동화 모드(dev 전용 5~999배 + 숫자 입력) — production 에서는
// 게터가 항상 false, UI 도 v-if 로 렌더 X → 사실상 기능이 빠진 빌드가 된다.
export const IS_DEV_SERVER: boolean = import.meta.env.DEV

/**
 * GameMonetize 등 H5 포털 iframe 임베드 환경 감지.
 * 포털 심사 규정상 iframe 내부에서는 외부 로그인(Google OAuth 팝업)이나
 * 외부 링크/창 닫기 유도를 숨기고 로컬 저장만 사용한다.
 */
export const IS_PORTAL_EMBED: boolean = (() => {
  if (typeof window === 'undefined') return false
  try {
    if (window.self !== window.top) return true
  } catch {
    return true
  }
  const host = window.location?.hostname ?? ''
  return /gamemonetize|poki|crazygames|gamedistribution/i.test(host)
})()
