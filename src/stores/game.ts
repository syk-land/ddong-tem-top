import { defineStore } from 'pinia'
import type {
  Screen, TowerRun, MetaBonuses, Stats, StatKey, ItemInstance,
} from '@/types'
import { createCharacter, generateRandomStats, uniformStartingStats } from '@/core/character'
import { makeTowerRun, currentChapter, currentFloor, advanceFloor } from '@/core/tower'
import { loadMeta, saveMeta, saveRun, loadRun, clearRun, defaultMeta, commitClearBonus, computePendingBonus, type PendingClearBonus } from '@/core/meta'
import { createCombatContext, type CombatContext, advanceTick, checkActionReady, consumeAction, playerBasicAttack, monsterAttack, makeMonster, pushLog } from '@/core/combat'
import { useSkill, getAvailableSkills, pickAutoAction } from '@/core/skills'
import { createShop, refreshShop } from '@/core/shop'
import type { ShopState } from '@/types'
import { rollItem } from '@/core/items'
import { CHAPTER_THEMES } from '@/data/chapters'
import { pickOne, weightedChoice } from '@/core/rng'
import { computeClearScore, getClearRank } from '@/core/character'
import {
  SPECIAL_EVENTS, SPECIAL_EVENT_INFO, type SpecialEventKey,
  resolveCrisisAdventurer, applySmithUpgrade, spinRoulette, applyRouletteResult,
  exchangeStat, blackMarketPrice, buyStatPoint, greedyCollectorTake,
} from '@/core/events'
import { applyRefreshBoost } from '@/core/shop'
import { pickThreeRandomChallenges, type ChallengeDef } from '@/data/challenges'
import {
  makeChallengeContext, applyInstantRewards, type ChallengeContext,
  calcChallengeMetaBonus, onEquipItem, onShopBuy, onShopRefresh,
  onMimicFlee, onBossFightEnd, onTick, onChapterEnd,
  recordActiveSkillUse, recordBasicAttackUse, evaluateFinalChallenges,
  isActiveSkillForbidden, isBasicAttackForbidden, canEquipItem,
  onSmithBet, onRouletteResult, onAltarUsed, onBlackMarketUsed,
  mergedFlags,
} from '@/core/challengeRuntime'
import { computeWeaponSkillProc } from '@/core/buildBalance'
import { npcIconUrl, pickRandomUserAvatars, isValidAvatarKey } from '@/ui/images'
import { computeEffectiveStats } from '@/core/stats'
import { SKILLS as SKILLS_REF } from '@/data/skills'
import { CHALLENGES_MAP as CHALLENGES_MAP_REF } from '@/data/challenges'

// 모달 dialog 콜백 보관용 (Pinia state 외부)
let dialogResolver: ((v: unknown) => void) | null = null
let inputResolver: ((v: string | null) => void) | null = null
let listResolver: ((v: unknown) => void) | null = null

// ============================================================
// 캐릭터 생성 상태 영구 저장 (뒤로가기/새로고침 후 복원)
// ============================================================
const CREATION_KEY = 'climetop:creation:v1'
interface CreationPersistState {
  rolledStats: Stats | null
  rollsLeft: number
  challengeKeys: string[]
  selectedKey: string | null
  avatarOptions?: string[]      // 랜덤 4개 후보
  selectedAvatar?: string | null
}
function saveCreation(s: CreationPersistState) {
  try {
    localStorage.setItem(CREATION_KEY, JSON.stringify(s))
  } catch {}
}
function loadCreation(): CreationPersistState | null {
  try {
    const raw = localStorage.getItem(CREATION_KEY)
    return raw ? (JSON.parse(raw) as CreationPersistState) : null
  } catch {
    return null
  }
}
function clearCreation() {
  try {
    localStorage.removeItem(CREATION_KEY)
  } catch {}
}

interface GameState {
  screen: Screen
  run: TowerRun | null
  meta: MetaBonuses
  combat: CombatContext | null
  shop: ShopState | null
  pendingClear: PendingClearBonus | null
  pendingAllocation: Partial<Stats>
  // 캐릭터 생성 단계
  challengeOptions: ChallengeDef[]
  selectedChallengeKey: string | null
  challengeContext: ChallengeContext | null
  // 자동 전투 속도 (배수)
  combatSpeed: number
  // 현재 챕터에서 새로고침 사용 여부 (트래킹용)
  refreshUsedThisChapter: boolean
  // 저장된 진행 중인 런 존재 여부 (reactive)
  savedRunExists: boolean
  // 인벤토리 가득 찬 상태에서 입수한 아이템 (모달 해결 대기)
  pendingPickup: ItemInstance | null
  // 캐릭터 생성: 주사위 굴림 결과 + 남은 회수
  rolledStats: Stats | null
  rollsLeft: number
  // 캐릭터 생성: 아바타 선택
  avatarOptions: string[]          // 후보 4개
  selectedAvatar: string | null    // 사용자 선택
  // 진행 중 런의 캐릭터 아바타 (영구 저장)
  runAvatar: string | null
  // 범용 다이얼로그 (alert/confirm 대체)
  dialog: DialogState | null
  // 텍스트 입력 다이얼로그 (prompt 대체)
  inputDialog: InputDialogState | null
  // 리스트 선택 다이얼로그
  listDialog: ListDialogState | null
}

export interface DialogButton {
  label: string
  value: unknown
  primary?: boolean
  danger?: boolean
}

export interface DialogState {
  title?: string
  message: string
  buttons: DialogButton[]
  imageUrl?: string  // 상단 일러스트 (NPC 등)
}

export interface InputDialogState {
  title?: string
  message: string
  defaultValue?: string
  placeholder?: string
  maxValue?: number  // 숫자 입력 시 상한 표시용
  okLabel?: string
  imageUrl?: string
}

export interface ListDialogState {
  title?: string
  message?: string
  options: { label: string; value: unknown; sub?: string; class?: string }[]
  cancelLabel?: string
  imageUrl?: string
}

export interface InputDialogStateExt {
  title?: string
  message: string
  defaultValue?: string
  placeholder?: string
  maxValue?: number
  okLabel?: string
  imageUrl?: string
}

export const useGameStore = defineStore('game', {
  state: (): GameState => ({
    screen: 'menu',
    run: null,
    meta: defaultMeta(),
    combat: null,
    shop: null,
    pendingClear: null,
    pendingAllocation: {},
    challengeOptions: [],
    selectedChallengeKey: null,
    challengeContext: null,
    combatSpeed: 1,
    refreshUsedThisChapter: false,
    savedRunExists: false,
    pendingPickup: null,
    dialog: null,
    inputDialog: null,
    listDialog: null,
    rolledStats: null,
    rollsLeft: 3,
    avatarOptions: [],
    selectedAvatar: null,
    runAvatar: null,
  }),

  getters: {
    // savedRunExists state 우선, 추가로 localStorage 검증 (stale 방어)
    hasSavedRun: (s) => {
      if (!s.savedRunExists) return false
      return loadRun() !== null
    },
    currentChapterState: (s) => (s.run ? currentChapter(s.run) : null),
    currentFloorEvent: (s) => (s.run ? currentFloor(s.run) : null),
    availableSkills: (s) =>
      s.run ? getAvailableSkills(s.run.character) : [],
    // 현재 빌드의 무기 스킬 자동 발동률 (UI 표시용, 0~100 %)
    weaponSkillProcPct: (s): number => {
      if (!s.run) return 0
      const c = s.run.character
      if (!c.weapon) return 0
      const eff = computeEffectiveStats(c)
      return Math.round(computeWeaponSkillProc(c, eff.행운) * 100)
    },
    // 실시간 성장 패널티: 현재 장비 기준 다음 회차 보너스 예상
    projectedClearRank: (s): { rank: string; bonus: number; score: number; eqScore: number; goldScore: number; hpScore: number } | null => {
      if (!s.run) return null
      const c = s.run.character
      const weaponTier = c.weapon?.tier ?? 1
      const armorTier = c.armor?.tier ?? 1
      const avgTier = (weaponTier + armorTier) / 2
      const eqScore = ((17 - avgTier) / 16) * 100
      const goldScore = Math.min(100, (c.gold / 1890) * 100)
      const hpScore = (c.hp / c.maxHp) * 100
      const score = Math.round((eqScore + goldScore + hpScore) / 3)
      const { rank, bonus } = getClearRank(score)
      return { rank, bonus, score, eqScore, goldScore, hpScore }
    },
  },

  actions: {
    init() {
      this.meta = loadMeta()
      this.savedRunExists = loadRun() !== null
      // 캐릭터 생성 중 상태 복원
      const c = loadCreation()
      if (c) {
        this.rolledStats = c.rolledStats
        this.rollsLeft = c.rollsLeft
        this.challengeOptions = c.challengeKeys
          .map((k) => CHALLENGES_MAP_REF[k])
          .filter(Boolean)
        this.selectedChallengeKey = c.selectedKey
        // 빈 배열 / 옛 키 형식이면 새로 추첨 (구세이브 마이그레이션)
        const validOptions = c.avatarOptions?.filter(isValidAvatarKey) ?? []
        this.avatarOptions = validOptions.length >= 4
          ? validOptions.slice(0, 4)
          : pickRandomUserAvatars(4)
        this.selectedAvatar = c.selectedAvatar && isValidAvatarKey(c.selectedAvatar)
          ? c.selectedAvatar
          : null
      }
      // 진행 중인 런이 있으면 runAvatar도 복원
      const loaded = loadRun()
      if (loaded && (loaded as any).avatarKey) {
        this.runAvatar = (loaded as any).avatarKey
      }
    },

    setScreen(screen: Screen) {
      this.screen = screen
    },

    // 캐릭터 생성 단계 진입
    // 저장된 진행 중 상태가 있으면 복원 (뒤로가기/새로고침 후에도 같은 챌린지/주사위 결과 유지)
    // 없으면 새로 챌린지 뽑고 주사위 3개 초기화
    startCharacterCreation() {
      const c = loadCreation()
      if (c) {
        this.challengeOptions = c.challengeKeys
          .map((k) => CHALLENGES_MAP_REF[k])
          .filter(Boolean)
        this.selectedChallengeKey = c.selectedKey
        this.rolledStats = c.rolledStats
        this.rollsLeft = c.rollsLeft
        // 빈 배열 / 옛 키 형식이면 새로 추첨 (구세이브 마이그레이션)
        const validOptions = c.avatarOptions?.filter(isValidAvatarKey) ?? []
        if (validOptions.length >= 4) {
          this.avatarOptions = validOptions.slice(0, 4)
        } else {
          this.avatarOptions = pickRandomUserAvatars(4)
          this.persistCreation()
        }
        this.selectedAvatar = c.selectedAvatar && isValidAvatarKey(c.selectedAvatar)
          ? c.selectedAvatar
          : null
      } else {
        this.challengeOptions = pickThreeRandomChallenges()
        this.selectedChallengeKey = null
        this.rolledStats = null
        this.rollsLeft = 3
        this.avatarOptions = pickRandomUserAvatars(4)
        this.selectedAvatar = null
        this.persistCreation()
      }
      this.screen = 'create'
    },

    // 캐릭터 생성 다시 굴림 시작 (새 챌린지 + 주사위 + 아바타 리셋)
    resetCharacterCreation() {
      this.challengeOptions = pickThreeRandomChallenges()
      this.selectedChallengeKey = null
      this.rolledStats = null
      this.rollsLeft = 3
      this.avatarOptions = pickRandomUserAvatars(4)
      this.selectedAvatar = null
      this.persistCreation()
    },

    // 아바타 선택
    selectAvatar(key: string) {
      this.selectedAvatar = key
      this.persistCreation()
    },

    // 현재 캐릭터 생성 상태 저장
    persistCreation() {
      saveCreation({
        rolledStats: this.rolledStats,
        rollsLeft: this.rollsLeft,
        challengeKeys: this.challengeOptions.map((c) => c.key),
        selectedKey: this.selectedChallengeKey,
        avatarOptions: this.avatarOptions,
        selectedAvatar: this.selectedAvatar,
      })
    },

    // 주사위 굴림: 6스탯 50pt 랜덤 분배 추첨
    rollCharacterDice(): Stats | null {
      if (this.rollsLeft <= 0) return null
      this.rolledStats = generateRandomStats()
      this.rollsLeft -= 1
      this.persistCreation()
      return this.rolledStats
    },

    // 챌린지 선택
    selectChallenge(key: string | null) {
      this.selectedChallengeKey = key
      this.persistCreation()
    },

    // 새 게임 시작 (챌린지 + 메타 보너스 자유분배 + 주사위 결과 적용)
    newGame(bonusAllocation: Partial<Stats> = {}) {
      // 주사위 굴린 결과가 있으면 사용, 없으면 균등 시작 (모두 8)
      const customStats = this.rolledStats ?? uniformStartingStats()
      const character = createCharacter(bonusAllocation, customStats)
      // 챌린지 적용
      const challengeKeys = this.selectedChallengeKey ? [this.selectedChallengeKey] : []
      const cctx = makeChallengeContext(challengeKeys)
      applyInstantRewards(character, cctx)
      this.challengeContext = cctx

      const run = makeTowerRun(character)
      run.challengeKeys = challengeKeys
      // 선택한 아바타 — run 데이터에 보존 + reactive state
      ;(run as any).avatarKey = this.selectedAvatar
      this.runAvatar = this.selectedAvatar
      // 미니멀리스트 챌린지: 인벤토리 1칸
      if (this.selectedChallengeKey === '미니멀리스트') {
        run.inventoryCap = 1
      }
      this.run = run
      this.combat = null
      this.shop = null
      this.pendingClear = null
      this.pendingAllocation = {}
      saveRun(run)
      this.savedRunExists = true
      // 캐릭터 생성 임시 데이터 정리 (이번 회차로 확정)
      clearCreation()
      this.screen = 'dungeon'
    },

    // 진행 중인 게임 이어하기
    loadGame(): boolean {
      const loaded = loadRun()
      if (!loaded) return false
      // 구버전 세이브 마이그레이션
      if (!Array.isArray(loaded.inventory)) loaded.inventory = []
      if (typeof loaded.inventoryCap !== 'number') loaded.inventoryCap = 4
      if (!Array.isArray(loaded.challengeKeys)) loaded.challengeKeys = []
      this.run = loaded
      this.runAvatar = (loaded as any).avatarKey ?? null
      // 챌린지 컨텍스트 재생성 (즉시 보상은 이미 적용된 상태)
      this.challengeContext = makeChallengeContext(loaded.challengeKeys)
      this.savedRunExists = true
      this.screen = 'dungeon'
      return true
    },

    // 현재 층 이벤트 실행
    enterCurrentFloor() {
      if (!this.run) return
      const floor = currentFloor(this.run)
      if (!floor) return

      const chapterNum = currentChapter(this.run).chapter

      switch (floor.type) {
        case 'monster': {
          this.startMonsterFight(chapterNum, 'normal')
          break
        }
        case 'boss': {
          this.startMonsterFight(chapterNum, 'boss')
          break
        }
        case 'shop': {
          this.shop = createShop(chapterNum)
          this.screen = 'shop'
          break
        }
        case 'treasure': {
          this.openTreasure(chapterNum)
          break
        }
        case 'healing_spring': {
          const heal = Math.round(this.run.character.maxHp * 0.30)
          this.run.character.hp = Math.min(this.run.character.maxHp, this.run.character.hp + heal)
          this.combat = null
          this.alertModal(`회복샘에서 HP +${heal} 회복했다.`, '⛲ 회복샘').then(() => this.advance())
          break
        }
        case 'special_event': {
          this.runSpecialEvent(chapterNum)
          break
        }
      }
    },

    startMonsterFight(chapterNum: number, kind: 'normal' | 'boss' | 'mimic') {
      if (!this.run) return
      const ch = currentChapter(this.run)
      const themeDef = CHAPTER_THEMES[ch.theme]

      // 보스/미믹은 항상 1마리, 일반은 챕터 테마의 encounterMin~Max
      let monsters
      if (kind === 'boss') {
        const template = ch.isHard && themeDef.hardBoss ? themeDef.hardBoss : themeDef.boss
        monsters = [makeMonster(template, chapterNum, kind)]
      } else if (kind === 'mimic') {
        monsters = [makeMonster(themeDef.boss, chapterNum, kind)]
      } else {
        const min = themeDef.encounterMin ?? 1
        const max = themeDef.encounterMax ?? 1
        const count = min + Math.floor(Math.random() * (max - min + 1))
        monsters = []
        for (let i = 0; i < count; i++) {
          const template = pickOne(themeDef.normalMonsters)
          monsters.push(makeMonster(template, chapterNum, 'normal'))
        }
      }

      this.combat = createCombatContext(this.run.character, monsters)
      const intro = monsters.length === 1
        ? `${monsters[0].template.name}와(과)의 전투!`
        : `${monsters.length}마리의 적이 등장! (${monsters.map((m) => m.template.name).join(', ')})`
      pushLog(this.combat, intro, 'info')
      this.screen = 'combat'
    },

    openTreasure(chapter: number) {
      // 10% 미믹, 85% 1개, 5% 2개
      const roll = Math.random()
      if (roll < 0.10) {
        // 미믹 출현
        const themeDef = CHAPTER_THEMES[currentChapter(this.run!).theme]
        const bossTemplate = themeDef.boss
        if (this.run) {
          const monster = makeMonster(bossTemplate, chapter, 'mimic')
          monster.template = { ...bossTemplate, name: `미믹 (${bossTemplate.name} 모방)` }
          this.combat = createCombatContext(this.run.character, monster)
          pushLog(this.combat, `보물상자가 미믹이었다!`, 'enemy')
          this.screen = 'combat'
        }
        return
      }
      const count = roll < 0.10 + 0.85 ? 1 : 2
      const rewards: ItemInstance[] = []
      for (let i = 0; i < count; i++) {
        const kind = Math.random() < 0.5 ? 'weapon' : 'armor'
        rewards.push(rollItem({ kind, chapter, source: 'treasure' }))
      }
      // 자동 인벤토리 비교 → 모달로 알림
      const names = rewards.map((r) => `${r.trait} ${r.grade} ${r.baseKey}`).join('\n• ')
      this.alertModal(`• ${names}`, '📦 보물상자 획득').then(() => {
        if (this.run) {
          for (const item of rewards) {
            this.receiveItem(item)
          }
        }
        this.advance()
      })
    },

    // 드랍/구매 처리: 무조건 인벤토리로 적재 (자동 장착 X — 사용자가 명시적으로 장착)
    // 인벤토리 가득 차 있으면 사용자 결정 (모달 표시) 대기
    receiveItem(item: ItemInstance) {
      if (!this.run) return

      // 인벤토리 보유 불가 (미니멀리스트 cap 0 등)
      if (this.run.inventoryCap <= 0) return

      // 빈 자리 있으면 자동 적재
      if (this.run.inventory.length < this.run.inventoryCap) {
        this.run.inventory.push(item)
        saveRun(this.run)
        return
      }

      // 가득 참 → 사용자 결정 대기 (모달)
      this.pendingPickup = item
    },

    // 모달 해결: 인벤토리 슬롯 폐기 후 신규 적재
    resolvePickupDiscardSlot(idx: number) {
      if (!this.run || !this.pendingPickup) return
      if (idx < 0 || idx >= this.run.inventory.length) return
      this.run.inventory.splice(idx, 1, this.pendingPickup)
      this.pendingPickup = null
      saveRun(this.run)
    },

    // 모달 해결: 신규 아이템 포기
    resolvePickupRefuse() {
      this.pendingPickup = null
    },

    // 장비 해제 → 인벤토리로 이동
    unequipToInventory(slot: 'weapon' | 'armor'): { ok: boolean; reason?: string } {
      if (!this.run) return { ok: false, reason: '런 없음' }
      const c = this.run.character
      const item = c[slot]
      if (!item) return { ok: false, reason: '장착된 장비 없음' }
      if (this.run.inventory.length >= this.run.inventoryCap) {
        return { ok: false, reason: '인벤토리가 가득 찼다. 한 칸 비우고 다시 시도.' }
      }
      this.run.inventory.push(item)
      c[slot] = null
      saveRun(this.run)
      return { ok: true }
    },

    // 인벤토리 슬롯의 아이템을 장착 (기존 장착품은 인벤토리로 스왑)
    equipFromInventory(idx: number): { ok: boolean; reason?: string } {
      if (!this.run) return { ok: false, reason: '런 없음' }
      const item = this.run.inventory[idx]
      if (!item) return { ok: false, reason: '슬롯 비어있음' }
      // 챌린지 가드
      if (this.challengeContext) {
        const check = canEquipItem(item, this.challengeContext)
        if (!check.ok) return check
      }
      const c = this.run.character
      const slotKey = item.kind === 'weapon' ? 'weapon' : 'armor'
      const prev = c[slotKey]
      c[slotKey] = item
      if (this.challengeContext) onEquipItem(this.challengeContext, item, prev)
      // 인벤토리 슬롯 갱신: 기존 장착품을 인벤토리로 스왑 (없으면 슬롯 비움)
      if (prev) {
        this.run.inventory.splice(idx, 1, prev)
      } else {
        this.run.inventory.splice(idx, 1)
      }
      saveRun(this.run)
      return { ok: true }
    },

    // 인벤토리 슬롯 판매 (buyback 가격)
    sellFromInventory(idx: number) {
      if (!this.run) return
      const item = this.run.inventory[idx]
      if (!item) return
      this.run.character.gold += item.buyback
      this.run.inventory.splice(idx, 1)
      saveRun(this.run)
    },

    // 인벤토리 전체 일괄 판매 — 총 골드 반환
    sellAllFromInventory(): number {
      if (!this.run) return 0
      const total = this.run.inventory.reduce((sum, it) => sum + it.buyback, 0)
      this.run.character.gold += total
      this.run.inventory = []
      saveRun(this.run)
      return total
    },

    // 인벤토리 슬롯 폐기 (보상 없음)
    discardFromInventory(idx: number) {
      if (!this.run) return
      this.run.inventory.splice(idx, 1)
      saveRun(this.run)
    },

    // 층 이동
    advance() {
      if (!this.run) return
      // 챕터 종료 직전 훅 (현재 챕터 마지막 층이면)
      const ch = currentChapter(this.run)
      const willEndChapter = ch.currentFloor + 1 >= ch.floors.length

      const result = advanceFloor(this.run)
      saveRun(this.run)

      // 챕터 종료 처리: 챌린지 훅 + 새로고침 플래그 리셋
      if (willEndChapter && this.challengeContext) {
        onChapterEnd(this.challengeContext, ch.chapter, this.run.character, this.refreshUsedThisChapter)
      }
      if (willEndChapter) {
        this.refreshUsedThisChapter = false
      }

      if (result.ended) {
        // 탑 클리어!
        this.handleTowerClear()
        return
      }
      this.combat = null
      this.shop = null
      this.screen = 'dungeon'
    },

    handleTowerClear() {
      if (!this.run) return
      if (this.challengeContext) {
        evaluateFinalChallenges(this.challengeContext, this.run.character)
      }
      this.pendingClear = computePendingBonus(this.run.character)
      // 챌린지 메타 보너스 추가
      if (this.challengeContext && this.pendingClear) {
        const extra = calcChallengeMetaBonus(this.challengeContext)
        if (extra > 0) {
          this.pendingClear.bonus += extra
        }
      }
      this.screen = 'victory'
    },

    confirmClearBonus(allocation: Partial<Stats>) {
      commitClearBonus(this.meta, allocation)
      this.run = null
      clearRun()
      this.savedRunExists = false
      this.screen = 'menu'
    },

    // 도주 (수동 — 자동 전투 중에도 유저가 트리거 가능)
    fleeCombat() {
      if (!this.combat || this.combat.ended) return
      // 미믹 도주는 챌린지 위반 가능
      if (this.combat.monsters.some((m) => m.isMimic) && this.challengeContext) {
        onMimicFlee(this.challengeContext)
      }
      this.combat.ended = true
      this.combat.victory = false
      pushLog(this.combat, '도주했다...', 'info')
      this.handleCombatEnd()
    },

    // 1 틱 진행 (몬스터 + 플레이어 모두 자동 행동)
    tickStep() {
      if (!this.combat || this.combat.ended || !this.run) return
      advanceTick(this.combat)
      this.run.tickCount++

      // 챌린지 매 틱 추적 (HP 낮음 / 속도 6 이하)
      if (this.challengeContext) {
        onTick(this.challengeContext, this.run.character)
      }

      // 각 살아있는 몬스터의 행동
      const ready = checkActionReady(this.combat)
      for (const m of ready.readyMonsters) {
        if (this.combat.ended) break
        monsterAttack(this.combat, m)
        consumeAction(m)
      }

      // 플레이어 자동 행동
      if (!this.combat.ended && this.combat.player.actionGauge >= 100) {
        this.playerAutoAct()
      }

      if (this.combat.ended) {
        this.handleCombatEnd()
      }
    },

    // 게이지 100 도달 시 자동 액션 (확률 기반 스킬/평타)
    playerAutoAct() {
      if (!this.combat) return
      const combat = this.combat
      const action = pickAutoAction(combat, {
        forbidActiveSkills: this.challengeContext
          ? isActiveSkillForbidden(this.challengeContext)
          : false,
        forceActiveSkills: this.challengeContext
          ? isBasicAttackForbidden(this.challengeContext)
          : false,
      })

      if (action.kind === 'skill') {
        const ok = useSkill(combat, action.key)
        if (!ok) {
          // MP 부족 등 → 평타로 fallback
          playerBasicAttack(combat)
          if (this.challengeContext) recordBasicAttackUse(this.challengeContext)
        } else {
          // 공격형 스킬만 액티브 카운트 (방어/회피는 카운트 안 함)
          const skill = SKILLS_REF[action.key]
          const isAttackSkill = skill?.kind === 'physical_atk' || skill?.kind === 'magic_atk'
          if (isAttackSkill && this.challengeContext) {
            recordActiveSkillUse(this.challengeContext)
          }
        }
      } else {
        playerBasicAttack(combat)
        if (this.challengeContext) recordBasicAttackUse(this.challengeContext)
      }
      consumeAction(combat.player)
    },

    setCombatSpeed(speed: number) {
      this.combatSpeed = speed
    },

    // ========================================
    // 모달 다이얼로그 시스템 (alert/confirm/prompt 대체)
    // ========================================
    showDialog(opts: { title?: string; message: string; buttons: DialogButton[]; imageUrl?: string }): Promise<unknown> {
      return new Promise((resolve) => {
        dialogResolver = resolve
        this.dialog = opts
      })
    },
    resolveDialog(value: unknown) {
      const r = dialogResolver
      this.dialog = null
      dialogResolver = null
      if (r) r(value)
    },
    alertModal(message: string, title?: string, imageUrl?: string): Promise<void> {
      return this.showDialog({
        title,
        message,
        imageUrl,
        buttons: [{ label: '확인', value: true, primary: true }],
      }) as Promise<void>
    },
    async confirmModal(message: string, options?: { title?: string; okLabel?: string; cancelLabel?: string; danger?: boolean; imageUrl?: string }): Promise<boolean> {
      const v = await this.showDialog({
        title: options?.title,
        message,
        imageUrl: options?.imageUrl,
        buttons: [
          { label: options?.okLabel ?? '확인', value: true, primary: true, danger: options?.danger },
          { label: options?.cancelLabel ?? '취소', value: false },
        ],
      })
      return !!v
    },

    showInputDialog(opts: InputDialogState): Promise<string | null> {
      return new Promise((resolve) => {
        inputResolver = resolve
        this.inputDialog = opts
      })
    },
    resolveInput(value: string | null) {
      const r = inputResolver
      this.inputDialog = null
      inputResolver = null
      if (r) r(value)
    },

    showListDialog<T>(opts: { title?: string; message?: string; options: { label: string; value: T; sub?: string; class?: string }[]; cancelLabel?: string }): Promise<T | null> {
      return new Promise((resolve) => {
        listResolver = resolve as (v: unknown) => void
        this.listDialog = opts as ListDialogState
      })
    },
    resolveList(value: unknown) {
      const r = listResolver
      this.listDialog = null
      listResolver = null
      if (r) r(value)
    },

    // ========================================
    // 특별 이벤트 6종 (모달 기반)
    // ========================================
    async runSpecialEvent(chapter: number) {
      if (!this.run) return
      const key = pickOne(SPECIAL_EVENTS) as SpecialEventKey
      const info = SPECIAL_EVENT_INFO[key]
      await this.alertModal(info.description, `✨ ${info.name}`, npcIconUrl(key))

      let pvpStarted = false
      switch (key) {
        case 'crisis_adventurer':
          pvpStarted = await this.eventCrisisAdventurer(chapter)
          break
        case 'wandering_smith':
          await this.eventWanderingSmith()
          break
        case 'cursed_gambler':
          await this.eventCursedGambler()
          break
        case 'exchange_altar':
          await this.eventExchangeAltar()
          break
        case 'black_market':
          await this.eventBlackMarket(chapter)
          break
        case 'greedy_collector':
          pvpStarted = await this.eventGreedyCollector(chapter)
          break
      }
      if (!pvpStarted) this.advance()
    },

    async eventCrisisAdventurer(chapter: number): Promise<boolean> {
      if (!this.run) return false
      const help = await this.confirmModal(
        '🆘 위기에 빠진 모험가를 발견했다.\n\n구해주면 70% 동료(상점 부스트) / 30% 악당 PVP.',
        { title: '위기 모험가', okLabel: '구해준다', cancelLabel: '무시한다' }
      )
      if (!help) return false

      const flags = this.challengeContext ? mergedFlags(this.challengeContext) : {}
      if (flags.noRescueAdventurer) {
        await this.alertModal('💀 불신주의자: 모험가를 구한 죄로 사망...', '챌린지 위반')
        this.run.character.hp = 0
        clearRun()
        this.savedRunExists = false
        this.screen = 'gameover'
        return true
      }

      const outcome = resolveCrisisAdventurer()
      if (outcome === 'ally') {
        applyRefreshBoost(this.run.refreshState)
        await this.alertModal('🤝 동료 모험가다! 다음 상점 새로고침 슬롯 +1', '동료 발견')
        return false
      }
      await this.alertModal('⚔️ 모험가는 적이었다! 전투 개시!', '악당 PVP')
      const themeDef = CHAPTER_THEMES[currentChapter(this.run).theme]
      const baseTemplate = pickOne(themeDef.normalMonsters)
      const template = {
        ...baseTemplate,
        name: '악당 모험가',
        hpMod: (baseTemplate.hpMod ?? 1.0) * 1.2,
        atkMod: (baseTemplate.atkMod ?? 1.0) * 1.1,
      }
      const monster = makeMonster(template, chapter + 1, 'normal')
      this.combat = createCombatContext(this.run.character, monster)
      pushLog(this.combat, '악당 모험가와의 PVP!', 'info')
      this.screen = 'combat'
      return true
    },

    async eventWanderingSmith() {
      if (!this.run) return
      const c = this.run.character
      const w = c.weapon
      if (!w) {
        await this.alertModal('대장장이가 강화할 무기가 없다며 떠났다.', '🔨 대장장이')
        return
      }
      const maxBet = Math.min(c.gold, w.sellPrice * 2)
      const betStr = await this.showInputDialog({
        title: '🔨 떠돌이 대장장이',
        message: `무기: ${w.trait} ${w.grade} ${w.baseKey} (판매가 ${w.sellPrice}G)\n` +
          `보유 ${c.gold}G, 베팅 ${0}~${maxBet}G.\n` +
          `베팅이 많을수록 성공률 ↑ (최대 90%)`,
        defaultValue: Math.floor(maxBet / 2).toString(),
        maxValue: maxBet,
        placeholder: '베팅 골드',
      })
      if (betStr === null) return
      const bet = Math.max(0, Math.min(parseInt(betStr) || 0, maxBet))
      if (bet <= 0) {
        await this.alertModal('베팅이 0이라 대장장이가 떠났다.', '취소')
        return
      }
      const result = applySmithUpgrade(c, bet)
      if (this.challengeContext) {
        onSmithBet(this.challengeContext, bet, c.gold + bet, result.success)
      }
      if (result.success && result.newItem) {
        await this.alertModal(
          `${result.newItem.trait} ${result.newItem.grade} ${result.newItem.baseKey}`,
          '🔥 강화 성공!'
        )
        if (this.challengeContext) onEquipItem(this.challengeContext, result.newItem, w)
      } else {
        await this.alertModal(`베팅 ${bet}G 소실`, '💔 강화 실패')
      }
      saveRun(this.run)
    },

    async eventCursedGambler() {
      if (!this.run) return
      const stats: StatKey[] = ['공격력', '방어력', '체력', '마력']
      const stat = await this.showListDialog<StatKey>({
        title: '🎲 저주받은 도박사의 룰렛',
        message: '베팅할 스탯을 선택. 결과: 대성공 +5 ~ 대실패 -5 (행운이 EV 결정)',
        options: stats.map((s) => ({
          label: s,
          value: s,
          sub: `현재 ${this.run!.character.stats[s]}`,
        })),
      })
      if (!stat) return

      const result = spinRoulette(this.run.character.stats.행운)
      applyRouletteResult(this.run.character, stat, result.delta)
      const emoji = result.delta >= 0 ? '🎉' : '😱'
      await this.alertModal(
        `${stat} ${result.delta >= 0 ? '+' : ''}${result.delta}`,
        `${emoji} 룰렛: ${result.outcome}!`
      )
      if (this.challengeContext) onRouletteResult(this.challengeContext, result.outcome)
      saveRun(this.run)
    },

    async eventExchangeAltar() {
      if (!this.run) return
      const allStats: StatKey[] = ['공격력', '방어력', '체력', '마력']
      let exchangeCount = 0
      while (exchangeCount < 3) {
        const proceed = await this.confirmModal(
          `선택 스탯 -3 → 다른 스탯 +1\n(${exchangeCount + 1}/3회)`,
          { title: '⚖️ 등가교환 제단', okLabel: '교환', cancelLabel: '종료' }
        )
        if (!proceed) break
        const from = await this.showListDialog<StatKey>({
          title: '줄 스탯',
          options: allStats.map((s) => ({
            label: s,
            value: s,
            sub: `현재 ${this.run!.character.stats[s]} → ${this.run!.character.stats[s] - 3}`,
          })),
        })
        if (!from) break
        if (this.run.character.stats[from] < 6) {
          await this.alertModal(`${from}이(가) 너무 적어 -3 불가 (최소 3 유지)`, '불가')
          continue
        }
        const to = await this.showListDialog<StatKey>({
          title: '받을 스탯',
          options: allStats
            .filter((s) => s !== from)
            .map((s) => ({
              label: s,
              value: s,
              sub: `현재 ${this.run!.character.stats[s]} → ${this.run!.character.stats[s] + 1}`,
            })),
        })
        if (!to) break
        if (exchangeStat(this.run.character, from, to)) {
          exchangeCount++
        }
      }
      if (this.challengeContext) onAltarUsed(this.challengeContext, currentChapter(this.run).chapter)
      saveRun(this.run)
    },

    async eventBlackMarket(chapter: number) {
      if (!this.run) return
      const allStats: StatKey[] = [
        '공격력', '방어력', '체력', '마력',
        '속도', '행운', '명중률', '회피율', '관통', '상태저항',
      ]
      while (true) {
        const c = this.run.character
        const stat = await this.showListDialog<StatKey | null>({
          title: '🕳️ 암시장',
          message: `보유 ${c.gold}G — 스탯 +1 구매`,
          options: allStats.map((s) => ({
            label: `${s} +1`,
            value: s,
            sub: `현재 ${c.stats[s]} · 가격 ${blackMarketPrice(chapter, s)}G`,
            class: c.gold < blackMarketPrice(chapter, s) ? 'opacity-40' : '',
          })),
          cancelLabel: '암시장 떠나기',
        })
        if (!stat) break
        if (!buyStatPoint(c, chapter, stat)) {
          await this.alertModal('💸 골드 부족', '거래 실패')
          continue
        }
        if (this.challengeContext) onBlackMarketUsed(this.challengeContext)
      }
      saveRun(this.run)
    },

    async eventGreedyCollector(chapter: number): Promise<boolean> {
      if (!this.run) return false
      const c = this.run.character
      const w = c.weapon
      const a = c.armor
      if (!w && !a) {
        await this.alertModal('수집가가 빈손인 당신을 보고 그냥 떠났다.', '📦 탐욕의 수집가')
        return false
      }
      const highest = w && a ? (w.tier >= a.tier ? w : a) : (w ?? a)!
      const give = await this.confirmModal(
        `${highest.trait} ${highest.grade} ${highest.baseKey} (티어 ${highest.tier})\n\n` +
          `양도 시 무작위 스탯 +1, 거절 시 보스 70% 강도 PVP`,
        { title: '📦 탐욕의 수집가가 요구한다', okLabel: '양도', cancelLabel: '거절' }
      )
      if (give) {
        const result = greedyCollectorTake(c)
        await this.alertModal(`${result.randomStat} +1`, '✓ 양도 완료')
        saveRun(this.run)
        return false
      }
      await this.alertModal('수집가가 격노한다!', '⚔️ 전투 개시')
      const themeDef = CHAPTER_THEMES[currentChapter(this.run).theme]
      const template = {
        ...themeDef.boss,
        name: '격노한 수집가',
        hpMod: (themeDef.boss.hpMod ?? 1.0) * 0.7,
        atkMod: (themeDef.boss.atkMod ?? 1.0) * 0.85,
        defMod: (themeDef.boss.defMod ?? 1.0) * 0.85,
      }
      const monster = makeMonster(template, chapter, 'normal')
      this.combat = createCombatContext(c, monster)
      pushLog(this.combat, '격노한 수집가와의 전투!', 'info')
      this.screen = 'combat'
      return true
    },

    // 세이브 강제 정리 (사망 화면 등에서 호출)
    resetSavedRunFlag() {
      clearRun()
      this.savedRunExists = false
    },

    handleCombatEnd() {
      if (!this.combat || !this.run) return
      if (!this.combat.victory) {
        // 사망 → 게임 오버
        clearRun()
        this.savedRunExists = false
        this.screen = 'gameover'
        return
      }

      const monsters = this.combat.monsters
      const isBossFight = monsters.some((m) => m.isBoss)
      const isMimicFight = monsters.some((m) => m.isMimic)

      // 챌린지: 보스 전투 틱 수 트래킹
      if (isBossFight && this.challengeContext) {
        onBossFightEnd(this.challengeContext, this.combat.tick)
      }

      // 승리 → 골드 보상 (마리당 분할 — 일반 다수 적 처치 보상 누적)
      const chapterNum = currentChapter(this.run).chapter
      const target_N = computeChapterGoldTarget(chapterNum)
      let reward = 0
      if (isBossFight) {
        reward = Math.round((target_N / 7) * 2.5)
      } else if (isMimicFight) {
        reward = 200 * chapterNum
      } else {
        // 일반: 마리당 (target_N / 7) × 0.85, 다수일수록 누적
        reward = Math.round((target_N / 7) * 0.85 * monsters.length * 0.85)
      }
      // ±20% 변동
      const variance = 0.8 + Math.random() * 0.4
      reward = Math.round(reward * variance)
      // 행운 보너스
      const luckBonus = 1 + (this.run.character.stats.행운 * 0.05)
      reward = Math.round(reward * luckBonus)

      this.run.character.gold += reward
      pushLog(this.combat, `골드 +${reward}`, 'gold')

      // 보스/미믹 처치 시 드랍 아이템 (다수 전투는 드랍 X — 골드만)
      if (isBossFight) {
        const drop = rollItem({ kind: Math.random() < 0.5 ? 'weapon' : 'armor', chapter: chapterNum, source: 'boss' })
        this.receiveItem(drop)
        pushLog(this.combat, `보스 드랍: ${drop.trait} ${drop.grade} ${drop.baseKey}`, 'reward')
      } else if (isMimicFight) {
        const drop = rollItem({ kind: Math.random() < 0.5 ? 'weapon' : 'armor', chapter: chapterNum, source: 'treasure' })
        this.receiveItem(drop)
        pushLog(this.combat, `미믹 드랍: ${drop.trait} ${drop.grade} ${drop.baseKey}`, 'reward')
      }

      saveRun(this.run)
      // 다음 층으로 자동 진행은 UI에서 (전투 결과 보여주고 → advance() 호출)
    },

    closeCombat() {
      this.combat = null
      this.advance()
    },

    // 상점 액션 (기본) — 인벤토리로 들어감
    buyItem(item: ItemInstance) {
      if (!this.run) return false
      if (this.run.character.gold < item.buyPrice) return false
      this.run.character.gold -= item.buyPrice
      // 챌린지 훅: 구매
      if (this.challengeContext) {
        onShopBuy(this.challengeContext, item, item.buyPrice)
      }
      this.receiveItem(item)
      // 상점 인벤토리에서 제거
      if (this.shop) {
        this.shop.inventory = this.shop.inventory.filter((i: ItemInstance) => i.id !== item.id)
      }
      saveRun(this.run)
      return true
    },

    // 상점에서 구매 + 즉시 장착 (스위칭)
    // - 슬롯 비어있으면 자동 장착
    // - 슬롯 차있으면 기존 장비를 인벤토리로 이동 + 새 장비 장착
    // - 인벤토리도 가득이면 모달로 폐기 동의 받음
    async buyItemAndEquip(item: ItemInstance): Promise<boolean> {
      if (!this.run) return false
      if (this.run.character.gold < item.buyPrice) {
        await this.alertModal('골드가 부족합니다.', '💸 구매 불가')
        return false
      }
      const c = this.run.character
      const slotKey = item.kind === 'weapon' ? 'weapon' : 'armor'
      const prev = c[slotKey]

      // 챌린지 가드: 장착 불가능한 아이템이면 차단
      if (this.challengeContext) {
        const check = canEquipItem(item, this.challengeContext)
        if (!check.ok) {
          await this.alertModal(check.reason ?? '챌린지 제약으로 장착 불가', '⚠️ 챌린지')
          return false
        }
      }

      // 기존 장비를 인벤토리로 이동
      let prevDiscarded = false
      if (prev) {
        if (this.run.inventoryCap <= 0) {
          // 미니멀리스트: 인벤토리 0칸 → 기존 장비 폐기 동의
          const ok = await this.confirmModal(
            `기존 장비 "${prev.trait} ${prev.grade} ${prev.baseKey}"를 보관할 인벤토리가 없습니다.\n폐기하고 새 장비를 장착할까요?`,
            { title: '⚠️ 인벤토리 없음', danger: true, okLabel: '폐기 후 장착', cancelLabel: '구매 취소' }
          )
          if (!ok) return false
          prevDiscarded = true
        } else if (this.run.inventory.length >= this.run.inventoryCap) {
          const ok = await this.confirmModal(
            `기존 장비 "${prev.trait} ${prev.grade} ${prev.baseKey}"를 넣을 인벤토리 빈 자리가 없습니다.\n폐기하고 새 장비를 장착할까요?`,
            { title: '⚠️ 인벤토리 가득', danger: true, okLabel: '폐기 후 장착', cancelLabel: '구매 취소' }
          )
          if (!ok) return false
          prevDiscarded = true
        } else {
          // 빈자리 있음 → 인벤토리로 이동
          this.run.inventory.push(prev)
        }
      }

      // 결제
      this.run.character.gold -= item.buyPrice
      if (this.challengeContext) onShopBuy(this.challengeContext, item, item.buyPrice)

      // 장착
      c[slotKey] = item
      if (this.challengeContext) onEquipItem(this.challengeContext, item, prev)

      // 상점 인벤토리에서 제거
      if (this.shop) {
        this.shop.inventory = this.shop.inventory.filter((i: ItemInstance) => i.id !== item.id)
      }
      saveRun(this.run)
      // prevDiscarded는 사용자가 이미 동의한 경우라 추가 알림 X
      return true
    },

    sellEquipped(slot: 'weapon' | 'armor') {
      if (!this.run) return
      const item = this.run.character[slot]
      if (!item) return
      this.run.character.gold += item.buyback
      // 챌린지 훅: 저주의 무기 제거는 '저주의 동반자' 챌린지 실패
      if (this.challengeContext && slot === 'weapon' && item.trait === '저주의') {
        for (const ac of this.challengeContext.active) {
          if (ac.failed) continue
          const def = CHALLENGES_MAP_REF[ac.key]
          if (def?.flags?.trackCursedNeverRemove) {
            ac.counters.cursedRemoved = true
            ac.failed = true
          }
        }
      }
      this.run.character[slot] = null
      saveRun(this.run)
    },

    refreshShopAction(): boolean {
      if (!this.run || !this.shop) return false
      const chapter = currentChapter(this.run).chapter
      const ok = refreshShop(this.shop, this.run.refreshState, chapter)
      if (ok) {
        this.refreshUsedThisChapter = true
        if (this.challengeContext) {
          onShopRefresh(this.challengeContext, chapter, 0)
        }
        saveRun(this.run)
      }
      return ok
    },

    leaveShop() {
      this.shop = null
      this.advance()
    },

    resetGame() {
      clearRun()
      this.run = null
      this.combat = null
      this.shop = null
      this.pendingClear = null
      this.savedRunExists = false
      this.screen = 'menu'
    },
  },
})

function computeChapterGoldTarget(chapter: number): number {
  // 9.15.3 챕터별 누적 골드 목표 곡선 (1.5 × 최상위 buy)
  // 단순화: chapter 별 누적 목표
  const table: Record<number, number> = {
    1: 81, 2: 162, 3: 162, 4: 162, 5: 405,
    6: 810, 7: 810, 8: 810, 9: 945, 10: 1890,
  }
  return table[chapter] ?? 81
}

