import type {
  ChapterState, FloorEvent, FloorEventType, ChapterTheme, TowerRun, Character,
} from '@/types'
import { CHAPTER_THEMES, ALL_THEME_KEYS } from '@/data/chapters'
import { pickN, pickOne, shuffle, nextRandom } from './rng'

// 1.3 챕터 테마 선정 (11개 풀에서 5개 무작위, 1~5 base, 6~10 hard)
export function selectThemes(): ChapterTheme[] {
  return pickN(ALL_THEME_KEYS, 5)
}

// 1.2 챕터 이벤트 분배 (10층 셔플)
//   tutorialForceCh1Layout: 첫 캐릭터(튜토리얼 진행 중) 일 때 챕터 1 의 1~4층을
//     각각 일반 몬스터 / 보물 / 상점 / 일반 몬스터 로 강제. 5~9층은 회복샘 1 +
//     일반 몬스터 4 셔플. 10층 보스.
//   tutorialForceCh2FirstFloor: 챕터 2 의 1층을 일반 몬스터로 강제 (4배속·자동진입
//     안내가 자연스럽게 첫 전투 시점에 발화하도록). 2~9층은 통상 분배.
export function generateChapterFloors(
  chapterIdx: number,
  opts: { tutorialForceCh1Layout?: boolean; tutorialForceCh2FirstFloor?: boolean } = {},
): FloorEvent[] {
  // 0-indexed chapter -> chapter number (1-10)
  const chapterNum = chapterIdx + 1

  // 챕터 1 (idx 0) 강제 layout: 1=일반/2=보물/3=상점/4=일반
  if (opts.tutorialForceCh1Layout && chapterIdx === 0) {
    const forced: FloorEventType[] = ['monster', 'treasure', 'shop', 'monster']
    // 5~9층 (5슬롯): 회복샘 1 + 일반 몬스터 4 (특별 이벤트는 첫 챕터에서 끄는 게 안전)
    const rest: FloorEventType[] = ['healing_spring', 'monster', 'monster', 'monster', 'monster']
    const shuffledRest = shuffle(rest)
    const layout: FloorEventType[] = [...forced, ...shuffledRest, 'boss']
    return layout.map((type) => ({ type, cleared: false }))
  }

  // 챕터 2 (idx 1) 1층 강제 일반 몬스터: 1=일반, 2~9 = 통상(회복샘/보물/상점/몬스터 셔플)
  if (opts.tutorialForceCh2FirstFloor && chapterIdx === 1) {
    // 2~9층 (8슬롯) — 통상 분배에서 1슬롯이 1층에 빠진 형태
    const slots: FloorEventType[] = ['shop', 'treasure', 'healing_spring']
    while (slots.length < 8) slots.push('monster')
    // 회복샘은 4층 이상 보장 (= shuffled 결과의 idx 2~7. 1층은 이미 강제 monster)
    let shuffled: FloorEventType[]
    let tries = 0
    do {
      shuffled = shuffle(slots)
      tries++
      const hsIdx = shuffled.findIndex((s) => s === 'healing_spring')
      // 전체 인덱스 기준: shuffled idx 0 = 2층, ... idx 7 = 9층. 4층 이상 = shuffled idx 2 이상
      if (hsIdx >= 2) break
      if (tries > 100) {
        const validIdx = 2 + Math.floor(nextRandom() * 6)
        const orig = shuffled[hsIdx]
        shuffled[hsIdx] = shuffled[validIdx]
        shuffled[validIdx] = orig
        break
      }
    } while (true)
    const layout: FloorEventType[] = ['monster', ...shuffled, 'boss']
    return layout.map((type) => ({ type, cleared: false }))
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
      const validIdx = 3 + Math.floor(nextRandom() * 6)
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
      if (nextRandom() < 0.05) {
        shuffled[i] = 'special_event'
        eventPlaced = true
      }
    }
  }

  // 10층은 보스
  shuffled.push('boss')

  const floors: FloorEvent[] = shuffled.map((type) => ({ type, cleared: false }))

  // v12: 2갈래 분기 선택지 부여 (튜토리얼 강제 구간 제외, 챕터당 최대 4곳)
  const minAltIdx = opts.tutorialForceCh1Layout && chapterIdx === 0
    ? 4
    : (opts.tutorialForceCh2FirstFloor && chapterIdx === 1 ? 1 : 0)
  let altCount = 0
  let extraEventPlaced = false
  for (let i = minAltIdx; i < floors.length - 1 && altCount < 4; i++) {
    const f = floors[i]
    if (f.type === 'monster') {
      if (!extraEventPlaced && nextRandom() < 0.30) {
        f.altChoice = { type: 'special_event' }
        extraEventPlaced = true
      } else {
        f.altChoice = { type: 'monster', isElite: true }
      }
      altCount++
    } else if (f.type === 'healing_spring' && nextRandom() < 0.65) {
      f.altChoice = { type: 'monster', isElite: true }
      altCount++
    }
  }

  return floors
}

export type TowerTutorialOpts = {
  tutorialForceCh1Layout?: boolean       // 챕터 1: 1=일반/2=보물/3=상점/4=일반 강제
  tutorialForceCh2FirstFloor?: boolean   // 챕터 2: 1층 일반 몬스터 강제
}

export function makeChapter(chapterIdx: number, theme: ChapterTheme, isHard: boolean, opts: TowerTutorialOpts = {}): ChapterState {
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

export function makeTowerRun(character: Character, opts: TowerTutorialOpts = {}): TowerRun {
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
