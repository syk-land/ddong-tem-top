import type { MetaBonuses, Stats, StatKey, Character, TowerRun } from '@/types'
import { computeClearScore, getClearRank } from './character'

const STORAGE_KEY_META = 'climetop:meta:v1'
const STORAGE_KEY_RUN = 'climetop:run:v1'

export function loadMeta(): MetaBonuses {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_META)
    if (!raw) return defaultMeta()
    return JSON.parse(raw) as MetaBonuses
  } catch {
    return defaultMeta()
  }
}

export function saveMeta(meta: MetaBonuses) {
  try {
    localStorage.setItem(STORAGE_KEY_META, JSON.stringify(meta))
  } catch (e) {
    console.error('Failed to save meta', e)
  }
}

export function defaultMeta(): MetaBonuses {
  return {
    clearCount: 0,
    totalBonusStats: 0,
    allocations: {},
  }
}

export function resetMeta() {
  try {
    localStorage.removeItem(STORAGE_KEY_META)
  } catch {}
}

// 클리어 시 보너스 추가 (분배는 다음 캐릭터 생성 시 진행)
export interface PendingClearBonus {
  rank: string
  bonus: number          // 1~10
  score: number
}

export function computePendingBonus(character: Character): PendingClearBonus {
  const score = computeClearScore(character, 10)
  const { rank, bonus } = getClearRank(score)
  return { rank, bonus, score }
}

// 보너스 분배 확정 (다음 캐릭터 생성용)
export function commitClearBonus(meta: MetaBonuses, allocations: Partial<Stats>) {
  meta.clearCount += 1
  // 누적 분배 합산
  for (const key in allocations) {
    const k = key as StatKey
    meta.allocations[k] = (meta.allocations[k] ?? 0) + (allocations[k] ?? 0)
  }
  // 총 누적 보너스 계산
  let total = 0
  for (const k in meta.allocations) {
    total += meta.allocations[k as StatKey] ?? 0
  }
  meta.totalBonusStats = total
  saveMeta(meta)
}

// 진행 중인 런 저장 / 복원
export function saveRun(run: TowerRun) {
  try {
    // Maps와 Sets를 직렬화 가능하게 변환
    const serializable = JSON.parse(JSON.stringify(run))
    localStorage.setItem(STORAGE_KEY_RUN, JSON.stringify(serializable))
  } catch (e) {
    console.error('Failed to save run', e)
  }
}

export function loadRun(): TowerRun | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_RUN)
    if (!raw) return null
    return JSON.parse(raw) as TowerRun
  } catch {
    return null
  }
}

export function clearRun() {
  try {
    localStorage.removeItem(STORAGE_KEY_RUN)
  } catch {}
}
