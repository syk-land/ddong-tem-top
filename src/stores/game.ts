import { defineStore } from 'pinia'
import type {
  Screen, TowerRun, MetaBonuses, Stats, StatKey, ItemInstance, MonsterInstance, ChapterTheme, CharacterRecord,
} from '@/types'
import { createCharacter, generateRandomStats, uniformStartingStats, computeMaxMp } from '@/core/character'
import { makeTowerRun, currentChapter, currentFloor, advanceFloor } from '@/core/tower'
import {
  loadMeta, saveMeta, saveRun, loadRun, clearRun, defaultMeta, commitClearBonus, consumeBonusFromPool,
  computePendingBonus, type PendingClearBonus,
  pushCharacterHistory, incrementRunCounter, consumeChallengeTrigger, accumulateClearGold,
} from '@/core/meta'
import {
  isChallengeDue, pickLatestRecord, makeRealBoss, computeStartBonusFromDrain,
} from '@/core/realboss'
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
  onSmithBet, onRouletteResult, onAltarUsed, onAltarOffered,
  onBlackMarketUsed, onPvpHit, onPlayerHitByTheme,
  shopForbidden, shopRefreshForbidden, healingSpringForbidden,
  mergedFlags,
} from '@/core/challengeRuntime'
import { computeWeaponSkillProc } from '@/core/buildBalance'
import { npcIconUrl, pickRandomUserAvatars, isValidAvatarKey, allUserAvatarKeys } from '@/ui/images'
import { sfx } from '@/ui/sound'
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
  // (deprecated) 이전 빌드는 4명 선택 후보 + 사용자 선택. 이제 자동 1개 랜덤.
  avatarOptions?: string[]
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
  // 자동 진입 토글 — 일반몬스터/보스/치유샘만 자동 진입 (상점/보물/이벤트는 사용자 입력)
  autoEnter: boolean
  // 현재 챕터에서 새로고침 사용 여부 (트래킹용)
  refreshUsedThisChapter: boolean
  // 저장된 진행 중인 런 존재 여부 (reactive)
  savedRunExists: boolean
  // 인벤토리 가득 찬 상태에서 입수한 아이템 (모달 해결 대기)
  pendingPickup: ItemInstance | null
  // 캐릭터 생성: 주사위 굴림 결과 + 남은 회수
  rolledStats: Stats | null
  rollsLeft: number
  // 캐릭터 생성: 자동 랜덤 아바타 (선택 UI 없음)
  selectedAvatar: string | null
  // 진행 중 런의 캐릭터 아바타 (영구 저장)
  runAvatar: string | null
  // 진짜 보스 도전 화면용
  realBossTheme: ChapterTheme | null
  realBossMonster: MonsterInstance | null
  realBossWeakRecord: CharacterRecord | null
  realBossInitialMaxHp: number   // 도전 시작 시 보스 최대 HP (깎은 비율 계산용)
  realBossResultRatio: number    // 결과 화면에서 표시할 깎은 비율
  // 인트로 만화 (스플래시 후 만화 → 다시보기)
  introVisible: boolean
  introPage: number              // 0=main 화면, 1=tutorial1, 2=tutorial2, 3=tutorial3
  introFlow: 'first' | 'replay' | 'afterRealBoss'  // first=최초 main->t1->t2->menu, afterRealBoss=t1->t2->t3->create, replay=설정에서 다시 보기
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
    autoEnter: false,
    refreshUsedThisChapter: false,
    savedRunExists: false,
    pendingPickup: null,
    dialog: null,
    inputDialog: null,
    listDialog: null,
    rolledStats: null,
    rollsLeft: 3,
    selectedAvatar: null,
    runAvatar: null,
    realBossTheme: null,
    realBossMonster: null,
    realBossWeakRecord: null,
    realBossInitialMaxHp: 0,
    realBossResultRatio: 0,
    introVisible: false,
    introPage: 0,
    introFlow: 'first',
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
    // v6 실시간 등급 예상: 점수 = 무기 티어 + 갑옷 티어 (낮을수록 좋음)
    projectedClearRank: (s): { rank: string; bonus: number; score: number; eqScore: number; goldScore: number; hpScore: number } | null => {
      if (!s.run) return null
      const c = s.run.character
      const weaponTier = c.weapon?.tier ?? 1
      const armorTier = c.armor?.tier ?? 1
      const score = weaponTier + armorTier  // v6: tier 합계, 0~32
      const { rank, bonus } = getClearRank(score)
      // eqScore/goldScore/hpScore: 호환용 (UI 표시 디버그). v6 점수에는 반영 X.
      const avgTier = (weaponTier + armorTier) / 2
      const eqScore = ((17 - avgTier) / 16) * 100
      const goldScore = Math.min(100, (c.gold / 1890) * 100)
      const hpScore = (c.hp / c.maxHp) * 100
      return { rank, bonus, score, eqScore, goldScore, hpScore }
    },
  },

  actions: {
    init() {
      this.meta = loadMeta()
      this.savedRunExists = loadRun() !== null
      // 저장된 게임 속도 복원 (1/2/4 만 허용)
      try {
        const raw = localStorage.getItem('climetop:speed:v1')
        const n = raw ? Number(raw) : NaN
        if (n === 1 || n === 2 || n === 4) this.combatSpeed = n
      } catch {}
      // 자동 진입 토글 복원
      try {
        this.autoEnter = localStorage.getItem('climetop:autoEnter:v1') === '1'
      } catch {}
      // 캐릭터 생성 중 상태 복원
      const c = loadCreation()
      if (c) {
        this.rolledStats = c.rolledStats
        this.rollsLeft = c.rollsLeft
        this.challengeOptions = c.challengeKeys
          .map((k) => CHALLENGES_MAP_REF[k])
          .filter(Boolean)
        this.selectedChallengeKey = c.selectedKey
        // 아바타: 저장된 selectedAvatar 있으면 유지, 없으면 새 랜덤 1개
        this.selectedAvatar = c.selectedAvatar && isValidAvatarKey(c.selectedAvatar)
          ? c.selectedAvatar
          : pickRandomUserAvatars(1)[0]
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
        this.selectedAvatar = c.selectedAvatar && isValidAvatarKey(c.selectedAvatar)
          ? c.selectedAvatar
          : pickRandomUserAvatars(1)[0]
      } else {
        this.challengeOptions = pickThreeRandomChallenges()
        this.selectedChallengeKey = null
        this.rolledStats = null
        this.rollsLeft = 3
        this.selectedAvatar = pickRandomUserAvatars(1)[0]
      }
      this.persistCreation()
      this.screen = 'create'
    },

    // 캐릭터 생성 다시 굴림 시작 (새 챌린지 + 주사위 + 아바타 리셋)
    resetCharacterCreation() {
      this.challengeOptions = pickThreeRandomChallenges()
      this.selectedChallengeKey = null
      this.rolledStats = null
      this.rollsLeft = 3
      this.selectedAvatar = pickRandomUserAvatars(1)[0]
      this.persistCreation()
    },

    // 현재 캐릭터 생성 상태 저장
    persistCreation() {
      saveCreation({
        rolledStats: this.rolledStats,
        rollsLeft: this.rollsLeft,
        challengeKeys: this.challengeOptions.map((c) => c.key),
        selectedKey: this.selectedChallengeKey,
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

    // 새 게임 시작 (챌린지 + 메타 보너스 자유분배 + 주사위 결과 + 도전 보너스)
    newGame(bonusAllocation: Partial<Stats> = {}) {
      // 주사위 굴린 결과가 있으면 사용, 없으면 균등 시작 (모두 8)
      const customStats = this.rolledStats ?? uniformStartingStats()
      // 영구 누적 시작 스탯 보너스 (진짜 보스 도전 누적). 1회성 pending은 deprecated.
      const startBonus = (this.meta.permanentStartBonus ?? 0) + (this.meta.pendingStartBonus ?? 0)
      const character = createCharacter(bonusAllocation, customStats, startBonus)
      // 메타 풀에서 분배한 만큼 차감
      consumeBonusFromPool(this.meta, bonusAllocation)
      // pending 보너스는 1회성이라 소진 (영구는 그대로 유지)
      if ((this.meta.pendingStartBonus ?? 0) > 0) {
        this.meta.pendingStartBonus = 0
        saveMeta(this.meta)
      }
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
          // 챌린지: 불매 운동 (noShop) — 상점 진입 차단
          if (this.challengeContext && shopForbidden(this.challengeContext)) {
            this.alertModal('💸 불매 운동 챌린지: 상점 이용 불가', '챌린지 제약')
              .then(() => this.advance())
            break
          }
          this.shop = createShop(chapterNum)
          this.screen = 'shop'
          break
        }
        case 'treasure': {
          this.openTreasure(chapterNum)
          break
        }
        case 'healing_spring': {
          // 챌린지: 절대 정수 (noHealingSpring) — 회복샘 사용 차단
          if (this.challengeContext && healingSpringForbidden(this.challengeContext)) {
            this.combat = null
            if (this.autoEnter) {
              this.advance()
            } else {
              this.alertModal('⛲ 절대 정수 챌린지: 회복샘 이용 불가', '챌린지 제약')
                .then(() => this.advance())
            }
            break
          }
          const heal = Math.round(this.run.character.maxHp * 0.30)
          this.run.character.hp = Math.min(this.run.character.maxHp, this.run.character.hp + heal)
          this.combat = null
          if (this.autoEnter) {
            this.advance()
          } else {
            this.alertModal(`회복샘에서 HP +${heal} 회복했다.`, '⛲ 회복샘').then(() => this.advance())
          }
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

    // 드랍/구매 처리: 인벤토리로 적재 → 슬롯 비었으면 자동 장착.
    // 인벤토리 가득 차 있으면 사용자 결정 (모달 표시) 대기
    receiveItem(item: ItemInstance) {
      if (!this.run) return

      // 인벤토리 보유 불가 (미니멀리스트 cap 0 등)
      if (this.run.inventoryCap <= 0) return

      // 빈 자리 있으면 자동 적재
      if (this.run.inventory.length < this.run.inventoryCap) {
        this.run.inventory.push(item)
        this.autoEquipFromInventory()
        saveRun(this.run)
        return
      }

      // 가득 참 → 사용자 결정 대기 (모달)
      this.pendingPickup = item
    },

    // 빈 장비 슬롯이 있고 인벤토리에 같은 종류 아이템이 있으면 가장 좋은 것(tier 우선)으로 자동 장착.
    // 챌린지 제약으로 장착 불가 아이템은 건너뜀.
    autoEquipFromInventory() {
      if (!this.run) return
      const c = this.run.character
      const slots: ('weapon' | 'armor')[] = ['weapon', 'armor']
      let changed = false
      for (const slot of slots) {
        if (c[slot]) continue
        let bestIdx = -1
        let bestTier = -1
        for (let i = 0; i < this.run.inventory.length; i++) {
          const it = this.run.inventory[i]
          if (it.kind !== slot) continue
          if (this.challengeContext) {
            const check = canEquipItem(it, this.challengeContext)
            if (!check.ok) continue
          }
          if (it.tier > bestTier) {
            bestTier = it.tier
            bestIdx = i
          }
        }
        if (bestIdx >= 0) {
          const it = this.run.inventory[bestIdx]
          c[slot] = it
          if (this.challengeContext) onEquipItem(this.challengeContext, it, null)
          this.run.inventory.splice(bestIdx, 1)
          changed = true
        }
      }
      if (changed) this.recomputeDerivedStats()
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
      this.recomputeDerivedStats()
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
      this.recomputeDerivedStats()
      saveRun(this.run)
      return { ok: true }
    },

    // 장비 변경 시 maxMp 재계산 (마력 보너스가 갑옷/특성에서 변경됨)
    //   character.maxMp 는 생성 시점 stats.마력 만 반영 → 동적 갱신 필요
    recomputeDerivedStats() {
      if (!this.run) return
      const c = this.run.character
      const eff = computeEffectiveStats(c)
      const newMaxMp = computeMaxMp(eff.마력)
      // mpCapFixed 챌린지가 있으면 그 값 유지
      const flags = this.challengeContext ? mergedFlags(this.challengeContext) : {}
      if (flags.mpCapFixed !== undefined) {
        c.maxMp = flags.mpCapFixed
      } else {
        c.maxMp = newMaxMp
      }
      c.mp = Math.min(c.mp, c.maxMp)
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
      sfx.transition()
      // 층 클리어 시 플레이어 상태이상 + 침묵 전체 제거
      this.run.character.statuses = []
      this.run.character.silencedUntilTick = undefined
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
      sfx.victory()
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
      // 캐릭터 히스토리 적재 (도전 모드용) — 마지막 도달 챕터 테마 기준
      const lastChIdx = Math.max(0, this.run.currentChapterIndex)
      const lastCh = this.run.chapters[lastChIdx] ?? this.run.chapters[this.run.chapters.length - 1]
      const score = this.pendingClear?.score ?? computeClearScore(this.run.character, 10)
      const rank = this.pendingClear?.rank ?? getClearRank(score).rank
      pushCharacterHistory(this.meta, this.run.character, score, rank, this.runAvatar, lastCh.theme)
      // 런 카운터 증가 (호환용)
      incrementRunCounter(this.meta)
      // v6: 클리어 시점 남은 골드 누적 (5만 도달 시 진짜 보스 트리거)
      accumulateClearGold(this.meta, this.run.character.gold)
      this.screen = 'victory'
    },

    confirmClearBonus(_allocation: Partial<Stats>) {
      const bonus = this.pendingClear?.bonus ?? 0
      // 직접 mutation (pinia reactive 보장)
      const before = this.meta.totalBonusStats ?? 0
      this.meta.clearCount = (this.meta.clearCount ?? 0) + 1
      this.meta.totalBonusStats = before + bonus
      console.log(`[confirmClearBonus] ${before} + ${bonus} = ${this.meta.totalBonusStats}, clearCount=${this.meta.clearCount}`)
      saveMeta(this.meta)
      // 보너스 소진 표시
      this.pendingClear = null
      this.run = null
      clearRun()
      this.savedRunExists = false
      // 도전 시점이면 메인메뉴 대신 도전으로
      if (isChallengeDue(this.meta)) {
        this.startRealBoss()
      } else {
        this.screen = 'menu'
      }
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
      if (!this.combat || this.combat.ended) return
      // 도전 모드는 run 없이 진행 (realBossMonster 있을 때)
      const isRealBoss = !!this.realBossMonster
      if (!isRealBoss && !this.run) return
      advanceTick(this.combat)
      if (this.run) this.run.tickCount++

      // 챌린지 매 틱 추적 (run 있을 때만)
      if (this.challengeContext && this.run) {
        onTick(this.challengeContext, this.run.character)
      }

      // 각 살아있는 몬스터의 행동
      const ready = checkActionReady(this.combat)
      const themeName = this.run ? currentChapter(this.run).theme : null
      for (const m of ready.readyMonsters) {
        if (this.combat.ended) break
        const hpBefore = this.combat.player.hp
        monsterAttack(this.combat, m)
        const damageTaken = hpBefore - this.combat.player.hp
        if (damageTaken > 0 && this.challengeContext && themeName) {
          if (this.combat.isPvp) onPvpHit(this.challengeContext, damageTaken)
          onPlayerHitByTheme(this.challengeContext, themeName, damageTaken)
        }
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
      try {
        localStorage.setItem('climetop:speed:v1', String(speed))
      } catch {}
    },

    setAutoEnter(on: boolean) {
      this.autoEnter = on
      try {
        localStorage.setItem('climetop:autoEnter:v1', on ? '1' : '0')
      } catch {}
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
      this.combat.isPvp = true
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
      // 1) 우선 베팅 방식 선택 (직접 입력 vs 최대 베팅)
      const choice = await this.showDialog({
        title: '🔨 떠돌이 대장장이',
        message: `무기: ${w.trait} ${w.grade} ${w.baseKey} (판매가 ${w.sellPrice}G)\n` +
          `보유 ${c.gold}G — 베팅 ${0}~${maxBet}G\n` +
          `베팅이 많을수록 성공률 ↑ (최대 90%)`,
        buttons: [
          { label: `최대 베팅 (${maxBet}G)`, value: 'max', primary: true },
          { label: '직접 입력', value: 'custom' },
          { label: '취소', value: null },
        ],
      })
      if (choice === null) return
      let bet = 0
      if (choice === 'max') {
        bet = maxBet
      } else {
        const betStr = await this.showInputDialog({
          title: '🔨 베팅 골드 입력',
          message: `보유 ${c.gold}G, 0 ~ ${maxBet}G`,
          defaultValue: Math.floor(maxBet / 2).toString(),
          maxValue: maxBet,
          placeholder: '베팅 골드',
        })
        if (betStr === null) return
        bet = Math.max(0, Math.min(parseInt(betStr) || 0, maxBet))
      }
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
      const stats: StatKey[] = ['힘', '민첩', '체력', '마력', '행운']
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
      // 챌린지 트래킹: 제단이 이 챕터에 등장했음을 기록
      if (this.challengeContext) {
        onAltarOffered(this.challengeContext, currentChapter(this.run).chapter)
      }
      const allStats: StatKey[] = ['힘', '민첩', '체력', '마력', '행운']
      let exchangeCount = 0
      while (exchangeCount < 3) {
        const proceed = await this.confirmModal(
          `선택 스탯 -3 → 다른 스탯 +2\n(${exchangeCount + 1}/3회)`,
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
              sub: `현재 ${this.run!.character.stats[s]} → ${this.run!.character.stats[s] + 2}`,
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
      const allStats: StatKey[] = ['힘', '민첩', '체력', '마력', '행운']
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
        const price = blackMarketPrice(chapter, stat)
        if (c.gold < price) {
          await this.alertModal(`${stat} +1 — ${price}G 필요. 골드 부족.`, '💸 거래 실패')
          continue
        }
        // 구매 확인 모달
        const ok = await this.confirmModal(
          `${stat} +1 을 ${price}G 에 구매하시겠습니까?\n(현재 ${c.stats[stat]} → ${c.stats[stat] + 1}, 보유 ${c.gold}G → ${c.gold - price}G)`,
          { title: '🕳️ 암시장 거래 확인', okLabel: '구매', cancelLabel: '취소' },
        )
        if (!ok) continue
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
      this.combat.isPvp = true
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
      if (!this.combat) return
      // 진짜 보스 도전 모드: run 없이 진행. 승패 무관하게 결과 화면
      if (this.realBossMonster) {
        this.finishRealBossCombat()
        return
      }
      if (!this.run) return
      if (!this.combat.victory) {
        // 사망 → 게임 오버. (도전 모드 카운터는 클리어만 증가하므로 여기선 카운트 X)
        sfx.death()
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
      // item_block trait 가진 적이 전투에 포함되어 있으면 드랍 차단 (그리폰 등)
      const blockedByItemBlock = this.combat.monsters.some(
        (m) => m.template.trait === 'item_block',
      )
      if (blockedByItemBlock) {
        pushLog(this.combat, '🚫 아이템 봉쇄 — 드랍 차단됨', 'info')
      } else if (isBossFight) {
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
      // 도전 모드면 결과 화면으로 (handleCombatEnd가 이미 처리했을 수도 있음)
      if (this.realBossMonster) {
        this.finishRealBossCombat()
        return
      }
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
      this.recomputeDerivedStats()

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
      this.recomputeDerivedStats()
      // 빈 슬롯에 인벤토리 아이템 자동 장착
      this.autoEquipFromInventory()
      saveRun(this.run)
    },

    refreshShopAction(): boolean {
      if (!this.run || !this.shop) return false
      // 챌린지: 리롤 금지령 (noShopRefresh) — 새로고침 차단
      if (this.challengeContext && shopRefreshForbidden(this.challengeContext)) {
        this.alertModal('🔄 리롤 금지령 챌린지: 새로고침 불가', '챌린지 제약')
        return false
      }
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

    // ========================================
    // 진짜 보스 도전 모드
    // ========================================
    // 메인 메뉴 진입 시 카운터 도달했는지 확인하고 도전 화면으로 전환
    triggerRealBossIfDue(): boolean {
      if (!isChallengeDue(this.meta)) return false
      this.startRealBoss()
      return true
    },

    // 도전 화면 진입: 가장 최근 클리어 캐릭터 부활 + 진짜 보스 생성.
    // "탑을 5번 오른 그 캐릭터로 최종 보스에 도전" — 게임 최종 목표.
    startRealBoss() {
      const latest = pickLatestRecord(this.meta)
      if (!latest) return
      consumeChallengeTrigger(this.meta)
      this.realBossWeakRecord = latest  // (필드명은 호환 위해 유지)
      this.realBossTheme = latest.lastChapterTheme
      this.realBossMonster = makeRealBoss(latest.lastChapterTheme)
      this.realBossInitialMaxHp = this.realBossMonster.maxHp
      this.screen = 'realboss'
    },

    // 도전 전투 시작 — 캐릭터 스냅샷을 임시 Character로 부활시켜 Combat 생성.
    // 무기/갑옷도 그대로 복원해 공격력/방어력이 정상 작동하게 한다.
    enterRealBossCombat() {
      const rec = this.realBossWeakRecord
      const boss = this.realBossMonster
      if (!rec || !boss) return
      // ItemInstance 깊은 복사 (참조 공유 방지)
      const weapon = rec.weapon ? JSON.parse(JSON.stringify(rec.weapon)) : null
      const armor = rec.armor ? JSON.parse(JSON.stringify(rec.armor)) : null
      const character = {
        stats: { ...rec.stats },
        hp: rec.maxHp,    // 부활 → 풀 HP
        maxHp: rec.maxHp,
        mp: rec.maxMp,
        maxMp: rec.maxMp,
        weapon,
        armor,
        gold: rec.gold,
        statuses: [],
        actionGauge: 0,
      }
      this.combat = createCombatContext(character, [boss])
      pushLog(this.combat, `진짜 보스 [${boss.template.name}]와의 도전!`, 'info')
      this.screen = 'combat'
    },

    // Combat 종료 후 호출 — realboss 결과 처리.
    //   * 깎은 비율 × 60pt 만큼 permanentStartBonus 영구 누적 (다음 캐릭터부터 시작 스탯 ↑)
    //   * 비율 100% (완전 클리어) → realBossDefeated = true (게임 클리어)
    finishRealBossCombat() {
      const boss = this.realBossMonster
      const initialHp = this.realBossInitialMaxHp
      if (!boss || initialHp <= 0) {
        this.screen = 'menu'
        this.combat = null
        return
      }
      const finalHp = Math.max(0, boss.hp)
      const ratio = Math.max(0, Math.min(1, (initialHp - finalHp) / initialHp))
      const gain = computeStartBonusFromDrain(ratio)
      this.realBossResultRatio = ratio
      this.meta.lastBossDrainRatio = ratio
      this.meta.permanentStartBonus = (this.meta.permanentStartBonus ?? 0) + gain
      this.meta.realBossCompleted = true
      if (ratio >= 0.9999) {
        this.meta.realBossDefeated = true  // 게임 클리어
      }
      // 누적 풀 리셋은 proceedFromRealBossResult (튜토리얼 인트로 시작 시점)에서 처리
      saveMeta(this.meta)
      this.combat = null
      this.screen = 'realboss_result'
    },

    // 결과 화면 → 만화(t1~t3) → 캐릭터 생성
    proceedFromRealBossResult() {
      this.realBossMonster = null
      this.realBossWeakRecord = null
      this.realBossTheme = null
      this.realBossInitialMaxHp = 0
      // v6.1: 진짜 보스전 종료 후 튜토리얼 인트로 시점에 누적 풀 리셋
      console.log(`[realBoss] proceed → totalBonusStats ${this.meta.totalBonusStats} → 0 리셋`)
      this.meta.totalBonusStats = 0
      this.meta.allocations = {}
      saveMeta(this.meta)
      this.openIntroComic('afterRealBoss')
    },

    // ========================================
    // 인트로 만화
    // ========================================
    // 최초 실행 시 자동 표시 — splash 단계에서 호출
    autoShowIntroIfFirstTime(): boolean {
      try {
        const seen = localStorage.getItem('climetop:tutorialSeen:v1')
        if (seen === '1') return false
      } catch {}
      this.openIntroComic('first')
      return true
    },

    openIntroComic(flow: 'first' | 'replay' | 'afterRealBoss') {
      this.introFlow = flow
      // first: page=0 (main) → 1 → 2
      // afterRealBoss: page=1 → 2 → 3
      // replay: page=0 → 1 → 2 (도전 미완료) / 0 → 1 → 2 → 3 (도전 완료)
      this.introPage = flow === 'afterRealBoss' ? 1 : 0
      this.introVisible = true
    },

    nextIntroPage() {
      const flow = this.introFlow
      // 마지막 페이지: first=2, afterRealBoss=3, replay=도전 완료 여부에 따라 2 또는 3
      let last: number
      if (flow === 'first') last = 2
      else if (flow === 'afterRealBoss') last = 3
      else last = this.meta.realBossCompleted ? 3 : 2  // replay
      if (this.introPage < last) {
        this.introPage += 1
      } else {
        this.closeIntroComic()
      }
    },

    // 안드로이드 뒤로가기: 떠있는 모달/오버레이를 우선순위로 닫음.
    // 닫을 게 있으면 true, 없으면 false (호출 측에서 false면 앱 종료 등 결정).
    handleBackButton(): boolean {
      // 1) 인벤토리 풀 모달 → 신규 아이템 거부
      if (this.pendingPickup) {
        this.resolvePickupRefuse()
        return true
      }
      // 2) 다이얼로그 (alert/confirm) → 가장 마지막(취소) 버튼 value 로 닫음
      if (this.dialog) {
        const buttons = this.dialog.buttons
        // 취소 버튼은 보통 마지막에 있고 value=false. 없으면 마지막 버튼 value.
        const cancelBtn = buttons.find((b) => b.value === false) ?? buttons[buttons.length - 1]
        this.resolveDialog(cancelBtn?.value ?? false)
        return true
      }
      // 3) 입력 다이얼로그 (prompt) → null
      if (this.inputDialog) {
        this.resolveInput(null)
        return true
      }
      // 4) 리스트 다이얼로그 → null
      if (this.listDialog) {
        this.resolveList(null)
        return true
      }
      // 5) 인트로 만화 → 닫음 (replay 흐름이면 그냥 종료, first/afterRealBoss는 흐름 끊김 방지하려 닫음 허용)
      if (this.introVisible) {
        this.closeIntroComic()
        return true
      }
      // 6) 상점 화면 → 나가기 (다음 층으로)
      if (this.screen === 'shop') {
        this.leaveShop()
        return true
      }
      return false
    },

    closeIntroComic() {
      this.introVisible = false
      // 최초 시청 완료 플래그
      try { localStorage.setItem('climetop:tutorialSeen:v1', '1') } catch {}
      // 종료 후 라우팅
      const flow = this.introFlow
      if (flow === 'afterRealBoss') {
        this.startCharacterCreation()
      } else if (flow === 'first') {
        // 메인 메뉴로 (이미 위에)
        this.screen = 'menu'
      }
      // replay 는 이전 화면 그대로 유지
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

