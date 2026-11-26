// 시드 지원 RNG 유틸 (Mulberry32). null 이면 기본 Math.random 사용.
let seededFn: (() => number) | null = null

export function setRngSeed(seed: number | null) {
  if (seed === null || !Number.isFinite(seed)) {
    seededFn = null
    return
  }
  let s = seed >>> 0
  seededFn = () => {
    s = (s + 0x6D2B79F5) >>> 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function nextRandom(): number {
  return seededFn ? seededFn() : Math.random()
}

export function randInt(min: number, max: number): number {
  return Math.floor(nextRandom() * (max - min + 1)) + min
}

export function randFloat(min: number, max: number): number {
  return nextRandom() * (max - min) + min
}

export function pickOne<T>(arr: readonly T[]): T {
  return arr[Math.floor(nextRandom() * arr.length)]
}

export function pickN<T>(arr: readonly T[], n: number): T[] {
  const copy = [...arr]
  const result: T[] = []
  while (result.length < n && copy.length > 0) {
    const idx = Math.floor(nextRandom() * copy.length)
    result.push(copy[idx])
    copy.splice(idx, 1)
  }
  return result
}

export function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(nextRandom() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

// 가중 추첨: [{value, weight}, ...]
export function weightedChoice<T>(items: { value: T; weight: number }[]): T {
  const total = items.reduce((sum, it) => sum + it.weight, 0)
  let roll = nextRandom() * total
  for (const it of items) {
    roll -= it.weight
    if (roll <= 0) return it.value
  }
  return items[items.length - 1].value
}

export function uniqueId(): string {
  return Math.random().toString(36).substring(2, 10) + Date.now().toString(36).substring(4)
}

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}
