// ============================================================
// 시뮬레이션용 시드 RNG.
//
// 게임 로직(combat/skills/events/monsterTraits/items/rng)이 모두
// `Math.random()`을 직접 호출하므로, 시드 기반 재현 + Common Random
// Numbers (CRN) 비교를 위해 sim 진입점에서 Math.random 을 임시로
// 시드 PRNG 로 교체한다. fn 실행이 끝나면 원본을 복원.
//
// 사용:
//   const result = withSeededRng(seed, () => autoplayAndEval())
//
// 주의:
//   - withSeededRng 안에서 비동기 함수를 호출하면 안 된다 (복원 시점이
//     fn 동기 반환 시점이므로 await 후엔 원본 Math.random 이 복원됨).
//   - 동시 호출(중첩) 시 가장 안쪽 fn 의 시드만 유효하고 종료 시 직전
//     상태로 정상 복원된다.
// ============================================================

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return function () {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t = (t + Math.imul(t ^ (t >>> 7), t | 61)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// 시드를 hash 로 한 번 섞어 인접 시드(0,1,2..)의 첫 출력 상관성을 줄임.
function mixSeed(seed: number): number {
  let h = seed >>> 0
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b)
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35)
  h = h ^ (h >>> 16)
  return h >>> 0
}

export function withSeededRng<T>(seed: number, fn: () => T): T {
  const orig = Math.random
  const rng = mulberry32(mixSeed(seed))
  Math.random = rng as typeof Math.random
  try {
    return fn()
  } finally {
    Math.random = orig
  }
}
