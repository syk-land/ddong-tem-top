import type { MetaBonuses, Stats, StatKey, Character, TowerRun, CharacterRecord, ChapterTheme } from '@/types'
import { computeClearScore, getClearRank } from './character'

const STORAGE_KEY_META = 'climetop:meta:v1'
const STORAGE_KEY_RUN = 'climetop:run:v1'

export function loadMeta(): MetaBonuses {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_META)
    if (!raw) return defaultMeta()
    const m = JSON.parse(raw) as Partial<MetaBonuses>
    // 마이그레이션: 신규 필드 채움
    return {
      clearCount: m.clearCount ?? 0,
      totalBonusStats: m.totalBonusStats ?? 0,
      allocations: m.allocations ?? {},
      runsSinceLastChallenge: m.runsSinceLastChallenge ?? 0,
      nextChallengeAt: m.nextChallengeAt ?? rollNextChallengeAt(),
      characterHistory: Array.isArray(m.characterHistory) ? m.characterHistory : [],
      pendingStartBonus: m.pendingStartBonus ?? 0,
      lastBossDrainRatio: m.lastBossDrainRatio ?? 0,
      realBossCompleted: m.realBossCompleted ?? false,
    }
  } catch {
    return defaultMeta()
  }
}

export function rollNextChallengeAt(): number {
  return 5 + Math.floor(Math.random() * 6) // 5~10
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
    runsSinceLastChallenge: 0,
    nextChallengeAt: rollNextChallengeAt(),
    characterHistory: [],
    pendingStartBonus: 0,
    lastBossDrainRatio: 0,
    realBossCompleted: false,
  }
}

// 클리어 캐릭터를 히스토리에 적재 (최대 50개)
export function pushCharacterHistory(
  meta: MetaBonuses,
  character: Character,
  score: number,
  rank: string,
  avatarKey: string | null,
  lastChapterTheme: ChapterTheme,
) {
  const rec: CharacterRecord = {
    stats: { ...character.stats },
    score,
    rank,
    avatarKey,
    weaponBaseKey: character.weapon?.baseKey ?? null,
    weaponTrait: character.weapon?.trait ?? null,
    weaponGrade: character.weapon?.grade ?? null,
    weaponTier: character.weapon?.tier ?? 0,
    armorBaseKey: character.armor?.baseKey ?? null,
    armorTrait: character.armor?.trait ?? null,
    armorGrade: character.armor?.grade ?? null,
    armorTier: character.armor?.tier ?? 0,
    gold: character.gold,
    hp: character.hp,
    maxHp: character.maxHp,
    mp: character.mp,
    maxMp: character.maxMp,
    lastChapterTheme,
    recordedAt: Date.now(),
  }
  meta.characterHistory.push(rec)
  if (meta.characterHistory.length > 50) {
    meta.characterHistory = meta.characterHistory.slice(-50)
  }
}

// 런 1회 종료 카운트 (클리어/사망 모두 호출)
export function incrementRunCounter(meta: MetaBonuses) {
  meta.runsSinceLastChallenge += 1
  saveMeta(meta)
}

// 도전이 발동될 때 호출 (카운터 초기화 + 다음 임계값 재추첨)
export function consumeChallengeTrigger(meta: MetaBonuses) {
  meta.runsSinceLastChallenge = 0
  meta.nextChallengeAt = rollNextChallengeAt()
  saveMeta(meta)
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
