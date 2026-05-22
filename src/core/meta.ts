import type { MetaBonuses, Stats, StatKey, Character, TowerRun, CharacterRecord, ChapterTheme, TutorialSeen } from '@/types'
import { computeClearScore, getClearRank } from './character'

const STORAGE_KEY_META = 'climetop:meta:v1'
const STORAGE_KEY_RUN = 'climetop:run:v1'

// v6 5스탯 마이그레이션: 옛 10스탯 키 → 새 5스탯으로 합산
//   공격력/관통 → 힘
//   방어력/상태저항 → 체력 (방어/저항 둘 다 체력 기반)
//   체력 → 체력 (그대로)
//   마력 → 마력
//   속도/명중률/회피율 → 민첩
//   행운 → 행운
const STAT_MIGRATION_MAP: Record<string, string> = {
  공격력: '힘', 관통: '힘',
  방어력: '체력', 상태저항: '체력',
  체력: '체력',
  마력: '마력',
  속도: '민첩', 명중률: '민첩', 회피율: '민첩',
  행운: '행운',
}

function migrateAllocations(old: Partial<Record<string, number>> | undefined): Partial<Record<string, number>> {
  if (!old) return {}
  const out: Partial<Record<string, number>> = {}
  for (const [k, v] of Object.entries(old)) {
    if (!v) continue
    // 이미 새 키면 그대로
    if (['힘', '민첩', '체력', '마력', '행운'].includes(k)) {
      out[k] = (out[k] ?? 0) + v
      continue
    }
    const mapped = STAT_MIGRATION_MAP[k]
    if (mapped) {
      out[mapped] = (out[mapped] ?? 0) + v
    }
  }
  return out
}

function defaultTutorialSeen(): TutorialSeen {
  return {
    menu_start: false,
    creation_intro: false,
    first_node: false,
    first_combat: false,
    first_treasure: false,
    first_inventory: false,
    first_shop: false,
    first_status: false,
    second_combat: false,
    first_chapter_clear: false,
    meta_creation: false,
    realboss_clear: false,
  }
}

function migrateTutorialSeen(t: Partial<TutorialSeen> | undefined): TutorialSeen {
  const base = defaultTutorialSeen()
  if (!t) return base
  return {
    menu_start: !!t.menu_start,
    creation_intro: !!t.creation_intro,
    first_node: !!t.first_node,
    first_combat: !!t.first_combat,
    first_treasure: !!t.first_treasure,
    first_inventory: !!t.first_inventory,
    first_shop: !!t.first_shop,
    first_status: !!t.first_status,
    second_combat: !!t.second_combat,
    first_chapter_clear: !!t.first_chapter_clear,
    meta_creation: !!t.meta_creation,
    realboss_clear: !!t.realboss_clear,
  }
}

export function loadMeta(): MetaBonuses {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_META)
    if (!raw) return defaultMeta()
    const m = JSON.parse(raw) as Partial<MetaBonuses>
    const loaded = {
      clearCount: m.clearCount ?? 0,
      climbCount: m.climbCount ?? 0,
      totalBonusStats: m.totalBonusStats ?? 0,
      allocations: migrateAllocations(m.allocations as any),
      runsSinceLastChallenge: m.runsSinceLastChallenge ?? 0,
      nextChallengeAt: m.nextChallengeAt ?? rollNextChallengeAt(),
      characterHistory: Array.isArray(m.characterHistory)
        ? m.characterHistory.map((rec) => ({
            ...rec,
            stats: migrateAllocations(rec.stats as any) as any,
          }))
        : [],
      pendingStartBonus: m.pendingStartBonus ?? 0,
      permanentStartBonus: m.permanentStartBonus ?? 0,
      lastBossDrainRatio: m.lastBossDrainRatio ?? 0,
      realBossCompleted: m.realBossCompleted ?? false,
      realBossDefeated: m.realBossDefeated ?? false,
      totalGoldEarned: m.totalGoldEarned ?? 0,
      tutorialSeen: migrateTutorialSeen(m.tutorialSeen),
    }
    // 옛 세이브 마이그레이션:
    //   tutorialSeen 필드가 없었던 옛 플레이어는 이미 게임을 진행한 상태인데
    //   갑자기 튜토리얼이 뜨면 부담스러움. clearCount/climbCount 가 0보다 크면
    //   모든 단계 본 것으로 처리해서 튜토리얼이 다시 안 뜨게 한다.
    if (!m.tutorialSeen && (loaded.clearCount > 0 || loaded.climbCount > 0)) {
      loaded.tutorialSeen = {
        menu_start: true,
        creation_intro: true,
        first_node: true,
        first_combat: true,
        first_treasure: true,
        first_inventory: true,
        first_shop: true,
        first_status: true,
        second_combat: true,
        first_chapter_clear: true,
        meta_creation: true,
        realboss_clear: loaded.realBossDefeated,  // 진짜 보스 안 깬 사람만 이거 노출
      }
    }
    return loaded
  } catch {
    return defaultMeta()
  }
}

// 100층 클리어 5회마다 진짜 보스 발동 (사망은 카운트 안 함)
export function rollNextChallengeAt(): number {
  return 5
}

export function saveMeta(meta: MetaBonuses) {
  try {
    localStorage.setItem(STORAGE_KEY_META, JSON.stringify(meta))
  } catch {}
}

export function defaultMeta(): MetaBonuses {
  return {
    clearCount: 0,
    climbCount: 0,
    totalBonusStats: 0,
    allocations: {},
    runsSinceLastChallenge: 0,
    nextChallengeAt: rollNextChallengeAt(),
    characterHistory: [],
    pendingStartBonus: 0,
    permanentStartBonus: 0,
    lastBossDrainRatio: 0,
    realBossCompleted: false,
    realBossDefeated: false,
    totalGoldEarned: 0,
    tutorialSeen: defaultTutorialSeen(),
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
    weapon: character.weapon ? JSON.parse(JSON.stringify(character.weapon)) : null,
    armor: character.armor ? JSON.parse(JSON.stringify(character.armor)) : null,
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

// v6: 클리어 카운트 (옛 시스템 호환용 — 도전 트리거에는 미사용)
export function incrementRunCounter(meta: MetaBonuses) {
  meta.runsSinceLastChallenge += 1
  saveMeta(meta)
}

// v6: 클리어 시점 남은 골드를 totalGoldEarned 에 누적
export function accumulateClearGold(meta: MetaBonuses, gold: number) {
  meta.totalGoldEarned = (meta.totalGoldEarned ?? 0) + gold
  saveMeta(meta)
}

// 도전이 발동될 때 호출 — 골드 누적 리셋
export function consumeChallengeTrigger(meta: MetaBonuses) {
  meta.totalGoldEarned = 0
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

export function computePendingBonus(
  character: Character,
  opts: { reachedChapter?: number; cleared?: boolean } = {},
): PendingClearBonus {
  const score = computeClearScore(character, 10)
  const { rank, bonus } = getClearRank(score, opts)
  return { rank, bonus, score }
}

// v6: 클리어 보너스는 분배하지 않고 메타 풀에 그대로 적립.
// 분배는 캐릭터 생성에서. allocations 매개변수는 옛 호환용으로 받지만 무시하고,
// pendingClear.bonus 를 totalBonusStats 에 더한다.
//
// isFullClear: true  → 100층 풀 클리어 (clearCount ++)
//              false → 도중 사망 + 등반 보상  (climbCount ++)
export function commitClearBonus(meta: MetaBonuses, _ignored: Partial<Stats>, pendingBonus: number, isFullClear: boolean = true) {
  const before = meta.totalBonusStats
  if (isFullClear) meta.clearCount += 1
  else             meta.climbCount = (meta.climbCount ?? 0) + 1
  meta.totalBonusStats = before + pendingBonus
  saveMeta(meta)
}

// v6.1: 캐릭터 생성에서 분배해도 totalBonusStats 차감 X.
//   누적 풀은 *영구* — 진짜 보스 100% 클리어 시에만 리셋.
//   allocations에는 마지막 분배만 기록 (디버그용, 자동 적용 X).
export function consumeBonusFromPool(meta: MetaBonuses, allocations: Partial<Stats>) {
  for (const key in allocations) {
    const k = key as StatKey
    meta.allocations[k] = (meta.allocations[k] ?? 0) + (allocations[k] ?? 0)
  }
  // totalBonusStats 차감 X — 누적은 영구
  saveMeta(meta)
}

// 진행 중인 런 저장 / 복원
export function saveRun(run: TowerRun) {
  try {
    // Maps와 Sets를 직렬화 가능하게 변환
    const serializable = JSON.parse(JSON.stringify(run))
    localStorage.setItem(STORAGE_KEY_RUN, JSON.stringify(serializable))
  } catch {}
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
