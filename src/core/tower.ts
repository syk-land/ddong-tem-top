import type {
  ChapterState, FloorEvent, FloorEventType, ChapterTheme, TowerRun, Character,
} from '@/types'
import { CHAPTER_THEMES, ALL_THEME_KEYS } from '@/data/chapters'
import { pickN, pickOne, shuffle } from './rng'

// 1.3 챕터 테마 선정 (11개 풀에서 5개 무작위, 1~5 base, 6~10 hard)
export function selectThemes(): ChapterTheme[] {
  return pickN(ALL_THEME_KEYS, 5)
}

// 1.2 챕터 이벤트 분배 (10층 셔플)
//   tutorialForceFirstChapter: 첫 캐릭터(튜토리얼 모드)일 때 챕터 1 의 1·2·3층을
//   각각 일반 몬스터 / 보물 / 상점 으로 강제 (튜토리얼 트리거 순서와 매칭).
//   4~9층은 통상 분배, 10층은 보스.
export function generateChapterFloors(chapterIdx: number, opts: { tutorialForceFirstChapter?: boolean } = {}): FloorEvent[] {
  // 0-indexed chapter -> chapter number (1-10)
  const chapterNum = chapterIdx + 1

  // 튜토리얼 모드 & 챕터 1 이면 1·2·3층 강제 + 나머지 6슬롯(=4~9층) 일반 몬스터 분배
  if (opts.tutorialForceFirstChapter && chapterIdx === 0) {
    const forced: FloorEventType[] = ['monster', 'treasure', 'shop']
    // 4~9층 (6슬롯): 회복샘 1 + 일반 몬스터 5 (특별 이벤트는 첫 챕터에서 끄는 게 안전)
    const rest: FloorEventType[] = ['healing_spring', 'monster', 'monster', 'monster', 'monster', 'monster']
    const shuffledRest = shuffle(rest)
    // 4층 이상에만 회복샘 들어가니 그대로 사용 (4~9 = idx 3~8)
    return [...forced, ...shuffledRest, 'boss'].map((type) => ({ type, cleared: false }))
  }

  // 1~9층 (마지막 10층은 보스 고정)
  const slots: FloorEventType[] = []
  slots.push('shop')
  slots.push('treasure')

  // 회복샘은 4층 이상에서만. chapterIdx >= 0 으로는 늘 추가 (회복샘 자체는 chapter >= 1)
  // 챕터마다 회복샘 1개 + 4층 이상 위치 제약
  slots.push('healing_spring')

  // 나머지 6슬롯은 일반 몬스터 (특별 이벤트가 추첨될 수 있음)
  while (slots.length < 9) {
    slots.push('monster')
  }

  // 셔플하되 회복샘 위치는 4~9에 보장되도록 (단순 처리)
  let shuffled: FloorEventType[]
  let tries = 0
  do {
    shuffled = shuffle(slots)
    tries++
    // 회복샘 인덱스가 0~2(=층 1~3)이면 다시 셔플
    const hsIdx = shuffled.findIndex((s) => s === 'healing_spring')
    if (hsIdx >= 3) break
    if (tries > 100) {
      // 강제 스왑
      const validIdx = 3 + Math.floor(Math.random() * 6)
      const orig = shuffled[hsIdx]
      shuffled[hsIdx] = shuffled[validIdx]
      shuffled[validIdx] = orig
      break
    }
  } while (true)

  // 일반 몬스터 슬롯에 5% 확률로 특별 이벤트 (cap 1/챕터)
  let eventPlaced = false
  for (let i = 0; i < shuffled.length; i++) {
    if (shuffled[i] === 'monster' && !eventPlaced) {
      if (Math.random() < 0.05) {
        shuffled[i] = 'special_event'
        eventPlaced = true
      }
    }
  }

  // 10층은 보스
  shuffled.push('boss')

  return shuffled.map((type) => ({ type, cleared: false }))
}

export function makeChapter(chapterIdx: number, theme: ChapterTheme, isHard: boolean, opts: { tutorialForceFirstChapter?: boolean } = {}): ChapterState {
  const themeDef = CHAPTER_THEMES[theme]
  return {
    chapter: chapterIdx + 1,
    theme,
    isHard,
    themeName: isHard ? themeDef.hardName : themeDef.baseName,
    floors: generateChapterFloors(chapterIdx, opts),
    currentFloor: 0,
    specialEventOccurred: false,
  }
}

export function makeTowerRun(character: Character, opts: { tutorialForceFirstChapter?: boolean } = {}): TowerRun {
  const themes = selectThemes()
  const chapters: ChapterState[] = []
  // 1~5 = base, 6~10 = hard (같은 순서로 매칭)
  for (let i = 0; i < 10; i++) {
    const themeIdx = i < 5 ? i : i - 5
    chapters.push(makeChapter(i, themes[themeIdx], i >= 5, opts))
  }

  return {
    character,
    chapters,
    currentChapterIndex: 0,
    refreshState: {
      charges: 1,
      cap: 2,
      eventBoostActive: false,
      usedAtMax: false,
    },
    tickCount: 0,
    inventory: [],
    inventoryCap: 4,
  }
}

export function currentChapter(run: TowerRun): ChapterState {
  return run.chapters[run.currentChapterIndex]
}

export function currentFloor(run: TowerRun): FloorEvent | null {
  const ch = currentChapter(run)
  if (ch.currentFloor >= ch.floors.length) return null
  return ch.floors[ch.currentFloor]
}

// 다음 층으로 진행
export function advanceFloor(run: TowerRun): { nextChapter: boolean; ended: boolean } {
  const ch = currentChapter(run)
  if (ch.currentFloor < ch.floors.length) {
    ch.floors[ch.currentFloor].cleared = true
  }
  ch.currentFloor++

  // 매 층 이동 시 HP / MP 각 10% 회복 (최대치 기준)
  const hpRegen = Math.round(run.character.maxHp * 0.10)
  const mpRegen = Math.round(run.character.maxMp * 0.10)
  run.character.hp = Math.min(run.character.maxHp, run.character.hp + hpRegen)
  run.character.mp = Math.min(run.character.maxMp, run.character.mp + mpRegen)

  if (ch.currentFloor >= ch.floors.length) {
    // 챕터 클리어
    run.currentChapterIndex++
    if (run.currentChapterIndex >= run.chapters.length) {
      return { nextChapter: false, ended: true }
    }
    // 챕터 진입 시 새로고침 충전 갱신 & MP 100% 회복
    onChapterEnter(run)
    return { nextChapter: true, ended: false }
  }
  return { nextChapter: false, ended: false }
}

function onChapterEnter(run: TowerRun) {
  // 8.2 새로고침 충전 갱신
  const rs = run.refreshState
  if (rs.usedAtMax) {
    rs.charges = 1
    rs.cap = 2
    rs.eventBoostActive = false
    rs.usedAtMax = false
  } else {
    rs.charges = Math.min(rs.charges + 1, rs.cap)
  }
  // 챕터 클리어 시 HP / MP 100% 회복
  run.character.hp = run.character.maxHp
  run.character.mp = run.character.maxMp
}
