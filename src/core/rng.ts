// 간단한 RNG 유틸. 시드 RNG가 필요하면 추후 Mulberry32 등으로 교체.
export function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

export function randFloat(min: number, max: number): number {
  return Math.random() * (max - min) + min
}

export function pickOne<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

export function pickN<T>(arr: readonly T[], n: number): T[] {
  const copy = [...arr]
  const result: T[] = []
  while (result.length < n && copy.length > 0) {
    const idx = Math.floor(Math.random() * copy.length)
    result.push(copy[idx])
    copy.splice(idx, 1)
  }
  return result
}

export function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

// 가중 추첨: [{value, weight}, ...]
export function weightedChoice<T>(items: { value: T; weight: number }[]): T {
  const total = items.reduce((sum, it) => sum + it.weight, 0)
  let roll = Math.random() * total
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
