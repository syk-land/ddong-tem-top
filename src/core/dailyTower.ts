import { CHALLENGES } from '@/data/challenges'
import { RANDOM_STAT_KEYS, type Stats } from '@/types'

export interface DailyTowerConfig {
  date: string
  seed: number
  challengeKey: string
  stats: Stats
}

export function getTodayDateKey(now: Date = new Date()): string {
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function hashDateToSeed(dateKey: string): number {
  let h = 2166136261 >>> 0
  for (let i = 0; i < dateKey.length; i++) {
    h ^= dateKey.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

function mulberry32(seed: number): () => number {
  let s = seed >>> 0
  return () => {
    s = (s + 0x6D2B79F5) >>> 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function getDailyTowerConfig(dateKey: string = getTodayDateKey()): DailyTowerConfig {
  const seed = hashDateToSeed(`climetop-daily:${dateKey}`)
  const rng = mulberry32(seed)

  // 일일 탑 전용: 극단적 무소유/상점차단 제외하고 안정적 다양성 보장
  const safePool = CHALLENGES.filter((c) => !c.flags?.goldZero && !c.flags?.noShop)
  const challenge = safePool[Math.floor(rng() * safePool.length)] ?? CHALLENGES[0]

  const stats: Stats = { 힘: 4, 민첩: 4, 체력: 4, 마력: 4, 행운: 4 }
  let rem = 40
  while (rem > 0) {
    const k = RANDOM_STAT_KEYS[Math.floor(rng() * RANDOM_STAT_KEYS.length)]
    stats[k] += 1
    rem -= 1
  }

  return {
    date: dateKey,
    seed,
    challengeKey: challenge.key,
    stats,
  }
}
