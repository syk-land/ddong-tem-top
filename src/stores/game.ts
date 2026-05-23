import { defineStore } from 'pinia'
import type {
  Screen, TowerRun, MetaBonuses, Stats, StatKey, ItemInstance, MonsterInstance, ChapterTheme, CharacterRecord,
  TutorialStep,
} from '@/types'
import { createCharacter, generateRandomStats, uniformStartingStats, computeMaxMp, computeMaxHp } from '@/core/character'
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
  resolveCrisisAdventurer, applySmithUpgrade, pickSmithSlot, spinRoulette, applyRouletteResult,
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
import { computeItemValue } from '@/core/itemValue'
import { npcIconUrl, pickRandomUserAvatars, isValidAvatarKey, allUserAvatarKeys } from '@/ui/images'
import { showRewardedAd } from '@/lib/ads'
import { IS_DEV_SERVER } from '@/lib/platform'
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
  realBossDeclinedThisSession: boolean   // 이번 세션에서 진짜 보스 도전을 거절했는지 (메뉴 무한 재트리거 방지)
  realBossInitialMaxHp: number   // 도전 시작 시 보스 최대 HP (깎은 비율 계산용)
  realBossResultRatio: number    // 결과 화면에서 표시할 깎은 비율
  // 인트로 만화 (스플래시 후 만화 → 다시보기)
  introVisible: boolean
  introPage: number              // 0=main 화면, 1=tutorial1, 2=tutorial2, 3=tutorial3
  introFlow: 'first' | 'replay' | 'afterRealBoss'  // first=최초 main->t1->t2->menu, afterRealBoss=t1->t2->t3->create, replay=설정에서 다시 보기
  // 인게임 튜토리얼 — 현재 표시 중인 단계 (null = 없음). data/tutorial.ts 의 단계 중 하나.
  tutorialActive: TutorialStep | null
  // 보물 노드에서 receiveItem 호출 시 set, 다음 Dungeon onMounted 에서 first_treasure 발화.
  // (receiveItem 시점엔 Combat 화면이라 인벤 버튼이 DOM 에 없어 타겟 잡을 수 없음 — 지연 발화)
  pendingTreasureTutorial: boolean
  // 튜토리얼 — 보물 노드에서 받기 완료했지만 인벤/상태 학습 미완료 상태.
  // true 면 advance() 가드로 다음 층 진입 차단 + 진입 버튼 disabled.
  // first_status 학습 완료 시점에 자동으로 false + advance() 호출.
  pendingTutorialTreasureAdvance: boolean
  // 아이템 획득 알림 큐 — receiveItem 호출 시 push, 사용자가 확인하면 shift.
  // 다중 드랍(보물 무기+갑옷, 보스+다음 받기) 시 차례대로 표시.
  itemAnnounceQueue: ItemInstance[]
  // 백그라운드(탭 비활성) 시 일시정지 플래그 — 자동 틱/BGM 동기화용
  paused: boolean
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
    tutorialActive: null,
    pendingTreasureTutorial: false,
    pendingTutorialTreasureAdvance: false,
    itemAnnounceQueue: [],
    realBossTheme: null,
    realBossMonster: null,
    realBossWeakRecord: null,
    realBossDeclinedThisSession: false,
    realBossInitialMaxHp: 0,
    realBossResultRatio: 0,
    introVisible: false,
    introPage: 1,
    introFlow: 'first',
    paused: false,
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
    // ── 튜토리얼 속도 게이팅 ──
    // 2배속은 second_combat (챕터 1 4층 일반 몬스터 안내) 트리거 시점부터 자유.
    // 안내 모달이 떠 있는 동안에도 이미 해금 — 사용자가 안내를 읽으면서
    // 좌측 상단의 2배속 버튼을 바로 누를 수 있게 한다.
    canUseSpeed2x: (s): boolean =>
      s.meta.tutorialSeen.second_combat || s.tutorialActive === 'second_combat',
    // 4배속·자동진입은 first_chapter_clear (챕터 2 1층 안내) 트리거 시점부터 노출.
    // 2배속과 동일 — 안내 모달이 떠 있는 동안에도 이미 해금된 상태로 버튼을 노출해
    // 사용자가 안내를 읽으면서 바로 4배속/자동진입 버튼을 시도해볼 수 있게 한다.
    canShowSpeed4x: (s): boolean =>
      s.meta.tutorialSeen.first_chapter_clear || s.tutorialActive === 'first_chapter_clear',
    canShowAutoEnter: (s): boolean =>
      s.meta.tutorialSeen.first_chapter_clear || s.tutorialActive === 'first_chapter_clear',
    // 자동화 모드 — vite 개발 서버 한정. production 빌드 (안드로이드 포함) 에서는
    // IS_DEV_SERVER 가 false 상수로 인라인되어 이 getter 가 항상 false → 모든
    // `if (this.isAutoMode)` 분기는 dead branch → minifier 가 제거.
    //   1) autoEnter 강제 on (setCombatSpeed 가 처리)
    //   2) 보물/일반 드롭 → 인벤에 넣고 즉시 더 좋은 장비면 자동 swap (receiveItem)
    //   3) 상점 진입 → 골드 한도 내에서 atk/def value 최고 매물 자동 매수 후 leaveShop (Shop.vue)
    //   4) 특별이벤트 (대장장이/암시장/룰렛/제단/수집가/모험가/도박꾼) → confirmModal 우회, 거부 path
    isAutoMode: (s): boolean => IS_DEV_SERVER && s.combatSpeed >= 5,
    // 튜토리얼 챌린지 게이팅 — 첫 챕터 클리어 전에는 도박꾼·제단·모험가 같은
    // 특별이벤트 챌린지만 후보 (일상 학습 흐름인 인벤/상점/장비를 방해하지 않게).
    // 첫 챕터 클리어 후엔 전체 풀로 복귀.
    tutorialChallengeOpts: (s) => ({
      eventOnly: !s.meta.tutorialSeen.first_chapter_clear,
      excludeShop: !s.meta.tutorialSeen.first_chapter_clear,
      excludeItemRestrict: !s.meta.tutorialSeen.first_chapter_clear,
    }),
    // 튜토리얼 — 2층 보물에서 받기 끝났지만 인벤/상태 학습 미완료 → 다음 층 진입 차단.
    // Dungeon.vue 의 "진입" 버튼 :disabled 바인딩에 사용.
    isTutorialBlockingExit: (s): boolean => {
      if (!s.pendingTutorialTreasureAdvance) return false
      return !s.meta.tutorialSeen.first_inventory || !s.meta.tutorialSeen.first_status
    },
  },

  actions: {
    // saveMeta + 클라우드 fire-and-forget 동기화 헬퍼.
    // 순환 import 방지를 위해 auth store 는 lazy require.
    persistMeta() {
      saveMeta(this.meta)
      try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        import('./auth').then(({ useAuthStore }) => {
          const a = useAuthStore()
          if (a.isLoggedIn) a.syncMetaToCloud().catch(() => {})
        }).catch(() => {})
      } catch {}
    },

    init() {
      this.meta = loadMeta()
      this.savedRunExists = loadRun() !== null
      // 저장된 게임 속도 복원 (1/2/4 = 게이팅 적용, 5 이상은 dev 서버 자동화 모드).
      // production 빌드(안드로이드 포함) 에서는 5 이상 값이 저장돼 있어도 1로 강제.
      try {
        const raw = localStorage.getItem('climetop:speed:v1')
        const n = raw ? Number(raw) : NaN
        if (Number.isFinite(n) && n >= 1 && n <= 1000) {
          const restored = Math.round(n)
          this.combatSpeed = IS_DEV_SERVER ? restored : Math.min(4, restored)
        }
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
      // 4배속/자동 진입은 새 런마다 광고 재시청을 요구 — 캐릭터 생성 진입 시점에 리셋
      if (this.combatSpeed === 4) this.setCombatSpeed(1)
      if (this.autoEnter) this.setAutoEnter(false)
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
        this.challengeOptions = pickThreeRandomChallenges(this.tutorialChallengeOpts)
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
      this.challengeOptions = pickThreeRandomChallenges(this.tutorialChallengeOpts)
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
      // bonusAllocation 검증 — store 강제 조작 (콘솔에서 store.newGame({힘: 9999}) 등)
      // 으로 보유 풀을 초과한 분배를 만드는 cheat 차단. 음수도 거부.
      const totalAllocated = Object.values(bonusAllocation).reduce<number>(
        (sum, v) => sum + (Number.isFinite(v) ? (v as number) : 0),
        0,
      )
      const pool = this.meta.totalBonusStats ?? 0
      if (totalAllocated < 0 || totalAllocated > pool) {
        console.warn(`[newGame] invalid allocation total=${totalAllocated} pool=${pool} — refused`)
        return
      }
      for (const v of Object.values(bonusAllocation)) {
        if (!Number.isFinite(v) || (v as number) < 0) {
          console.warn('[newGame] invalid allocation contains non-positive/non-finite — refused')
          return
        }
      }
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
        this.persistMeta()
      }
      // 챌린지 적용
      const challengeKeys = this.selectedChallengeKey ? [this.selectedChallengeKey] : []
      const cctx = makeChallengeContext(challengeKeys)
      applyInstantRewards(character, cctx)
      this.challengeContext = cctx

      // 튜토리얼 학습 흐름 보장:
      //   - 챕터 1 강제 layout (1=일반/2=보물/3=상점/4=일반) → second_combat 학습 전까지
      //   - 챕터 2 1층 강제 일반 몬스터 → first_chapter_clear 학습 전까지
      const run = makeTowerRun(character, {
        tutorialForceCh1Layout: !this.meta.tutorialSeen.second_combat,
        tutorialForceCh2FirstFloor: !this.meta.tutorialSeen.first_chapter_clear,
      })
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
          // 튜토리얼 — 첫 상점 학습 전엔 명중 트레이트 강제 (회피 미스 누적 방지)
          this.shop = createShop(chapterNum, { tutorialForceAcc: !this.meta.tutorialSeen.first_shop })
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
              this.alertModal('절대 정수 챌린지: 회복샘 이용 불가', '챌린지 제약')
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
            this.alertModal(`회복샘에서 HP +${heal} 회복했다.`, '회복샘').then(() => this.advance())
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
        const m = makeMonster(template, chapterNum, kind)
        // 튜토리얼 — 첫 챕터 1 보스 약화 (사용자가 무조건 잡고 진행할 수 있도록).
        // first_chapter_clear 는 챕터 2 1층 진입 시 마킹되므로 챕터 1 보스 전투 시점엔 false.
        if (chapterNum === 1 && !this.meta.tutorialSeen.first_chapter_clear) {
          m.hp = Math.max(1, Math.round(m.hp * 0.5))
          m.maxHp = m.hp
          m.atk = Math.max(1, Math.round(m.atk * 0.7))
        }
        monsters = [m]
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
      // 튜토리얼 (보물 학습 전) — 미믹 우회 + 무기/방어구 1개씩 강제 드랍 + 명중 트레이트.
      // 사용자가 인벤토리에서 무기·갑옷 둘 다 비교/장착 학습 가능하도록.
      // 알림은 receiveItem 안의 itemAnnounceQueue 가 카드+확인 모달로 처리.
      const isTutorial = !this.meta.tutorialSeen.first_treasure
      if (isTutorial) {
        const rewards: ItemInstance[] = [
          rollItem({ kind: 'weapon', chapter, source: 'treasure', forceTraitName: '날카로운' }),
          rollItem({ kind: 'armor',  chapter, source: 'treasure', forceTraitName: '정밀한' }),
        ]
        for (const item of rewards) this.receiveItem(item)
        // 튜토리얼 모드에서도 즉시 advance — 사용자가 ItemAnnounce 확인을 누르면
        // clearItemAnnounce 에서 다음 층(3층=상점) 으로 진입한다.
        // 인벤/상태 학습은 3층 도착 후 Dungeon.vue onMounted 에서 발화한다.
        this.advance()
        return
      }
      // 통상: 10% 미믹, 85% 1개, 5% 2개
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
      // 알림은 receiveItem 내부 itemAnnounceQueue 가 처리 (카드+확인 모달). 별도 alertModal 불필요.
      for (const item of rewards) this.receiveItem(item)
      this.advance()
    },

    // 드랍/구매 처리: 인벤토리로 적재 → 슬롯 비었으면 자동 장착.
    // 인벤토리 가득 차 있으면 사용자 결정 (모달 표시) 대기
    receiveItem(item: ItemInstance) {
      if (!this.run) return

      // 인벤토리 보유 불가 (미니멀리스트 cap 0 등)
      if (this.run.inventoryCap <= 0) return

      // 튜토리얼 — 보물 노드의 드랍에서만 first_treasure 예약 (즉시 트리거 X).
      // receiveItem 호출 시점은 Combat 화면이라 인벤 버튼이 DOM 에 없음.
      // 다음 Dungeon onMounted 에서 발화하면 인벤 버튼이 마운트된 상태라 타겟 화살표 정상 작동.
      const ch = this.run.chapters[this.run.currentChapterIndex]
      const floor = ch?.floors[ch?.currentFloor]
      if (floor?.type === 'treasure' && !this.meta.tutorialSeen.first_treasure) {
        this.pendingTreasureTutorial = true
      }

      // 빈 자리 있으면 자동 적재 + 획득 알림 큐 push (ItemAnnounceModal 이 카드+확인 모달로 안내)
      if (this.run.inventory.length < this.run.inventoryCap) {
        this.run.inventory.push(item)
        this.autoEquipFromInventory()
        if (this.isAutoMode) {
          // 자동화 모드 — 자동 업그레이드까지 처리하고 ItemAnnounce 모달은 띄우지 않는다.
          // ("확인" 자동 클릭과 같은 결과: 카드 안 보이고 즉시 다음 진행으로 이어감.)
          this.autoUpgradeEquipment()
        } else {
          this.itemAnnounceQueue.push(item)
        }
        saveRun(this.run)
        return
      }

      // 가득 참 — 자동화 모드면 PickupModal 우회. 같은 종류 인벤 슬롯 중 가치
      // 가장 낮은 것을 새 아이템으로 교체 (단 새 아이템이 더 약하면 폐기).
      if (this.isAutoMode) {
        const chapter = this.currentChapterState?.chapter
        const valOf = (it: ItemInstance): number => it.kind === 'weapon'
          ? computeItemValue(it, this.run!.character, { chapter }).atkValue
          : computeItemValue(it, this.run!.character, { chapter }).defValue
        const newVal = valOf(item)
        let worstIdx = -1
        let worstVal = newVal
        for (let i = 0; i < this.run.inventory.length; i++) {
          const inv = this.run.inventory[i]
          if (inv.kind !== item.kind) continue
          const v = valOf(inv)
          if (v < worstVal) { worstVal = v; worstIdx = i }
        }
        if (worstIdx >= 0) {
          this.run.inventory[worstIdx] = item
          this.autoUpgradeEquipment()
        }
        // worstIdx === -1 → 새 아이템이 가장 약하거나 같은 kind 인벤 없음 → 폐기
        saveRun(this.run)
        return
      }

      // 가득 참 → 사용자 결정 대기 (PickupModal). 그 모달 자체가 새 아이템 카드를
      // 보여주므로 itemAnnounceQueue 에는 push 안 함 (중복 방지).
      this.pendingPickup = item
    },

    // ItemAnnounceModal 의 "확인" 콜백 — 큐 전체 비움 (한 모달에 카드 N장 한꺼번에 보여줌).
    clearItemAnnounce() {
      this.itemAnnounceQueue = []
      // 1) 사용자가 "확인" 을 누른 시점에 다음 층 자동 진입 (autoEnter 여부와 무관).
      //    - combat 이 종료(승리) 상태로 남아 있으면 closeCombat 호출 → combat=null +
      //      advance(). closeCombat 안의 itemAnnounceQueue 가드도 이제 통과 (큐 비움).
      //    - combat 없는 던전 도착 상태 (보물/일반 드롭 알림 닫은 후) 면 직접 advance.
      if (this.combat?.ended && this.combat?.victory) {
        this.closeCombat()
      } else if (this.run && !this.combat && this.screen === 'dungeon') {
        this.advance()
      }
      // 2) 보물 받기 직후 흐름 — advance() 가 currentFloor 를 +1 (3층 shop) 으로 옮긴 뒤
      //    인벤 버튼 안내(first_treasure) 발화. Dungeon 컴포넌트는 floor 변경 시
      //    재mount 되지 않으므로 onMounted 가 다시 실행되지 않는다 — 여기서 직접 트리거.
      //    triggerTutorial 가드가 chapter==1 && currentFloor==2 && floor.type==='shop'
      //    조건을 한 번 더 확인한다.
      if (this.pendingTreasureTutorial) {
        this.pendingTreasureTutorial = false
        this.triggerTutorial('first_treasure')
      }
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

    // 자동화 모드 (combatSpeed === 6) — 인벤 안에서 atk(무기)/def(갑옷) value 가 현재
    // 장착품보다 더 높은 후보가 있으면 자동 swap. 슬롯이 비어 있으면 그것도 채움.
    // receiveItem 직후, 상점 매수 후 등에서 호출.
    autoUpgradeEquipment() {
      if (!this.run) return
      const c = this.run.character
      const chapter = this.currentChapterState?.chapter
      let changed = false
      for (const slot of ['weapon', 'armor'] as const) {
        const curVal = c[slot]
          ? (slot === 'weapon'
              ? computeItemValue(c[slot]!, c, { chapter }).atkValue
              : computeItemValue(c[slot]!, c, { chapter }).defValue)
          : -Infinity
        let bestVal = curVal
        let bestIdx = -1
        for (let i = 0; i < this.run.inventory.length; i++) {
          const it = this.run.inventory[i]
          if (it.kind !== slot) continue
          if (this.challengeContext) {
            const check = canEquipItem(it, this.challengeContext)
            if (!check.ok) continue
          }
          const v = slot === 'weapon'
            ? computeItemValue(it, c, { chapter }).atkValue
            : computeItemValue(it, c, { chapter }).defValue
          if (v > bestVal) { bestVal = v; bestIdx = i }
        }
        if (bestIdx >= 0) {
          const newItem = this.run.inventory[bestIdx]
          const old = c[slot]
          c[slot] = newItem
          this.run.inventory.splice(bestIdx, 1)
          if (old) this.run.inventory.push(old)  // 인벤 cap 유지 (-1 + 1)
          if (this.challengeContext) onEquipItem(this.challengeContext, newItem, old)
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

    // 장비 변경 시 파생 능력치 재계산.
    //   maxMp: 마력 (스탯 + 갑옷 mpBonus + 특성 마력) 기반
    //   maxHp: 체력 (스탯 + 향후 장비/특성 체력 보너스 기반)
    // 이전엔 maxMp 만 갱신했는데, 향후 "장비 착용 시 HP +N%" 같은 효과가 추가되면
    // maxHp 도 같은 패턴으로 동기화돼야 한다 — 안전망으로 같이 처리.
    recomputeDerivedStats() {
      if (!this.run) return
      const c = this.run.character
      const eff = computeEffectiveStats(c)
      const newMaxMp = computeMaxMp(eff.마력)
      const newMaxHp = computeMaxHp(eff.체력)
      // mpCapFixed 챌린지가 있으면 그 값 유지
      const flags = this.challengeContext ? mergedFlags(this.challengeContext) : {}
      if (flags.mpCapFixed !== undefined) {
        c.maxMp = flags.mpCapFixed
      } else {
        c.maxMp = newMaxMp
      }
      c.maxHp = newMaxHp
      c.mp = Math.min(c.mp, c.maxMp)
      c.hp = Math.min(c.hp, c.maxHp)
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
      // 획득 알림 모달이 떠 있으면 사용자가 "확인" 누르기 전엔 진행하지 않음
      if (this.itemAnnounceQueue.length > 0) return
      // (구) pendingTutorialTreasureAdvance 게이트는 제거됨 — 보물에서 받은 뒤
      // 즉시 3층(상점) 으로 진입하고, 인벤/상태 학습은 3층 onMounted 에서 발화한다.
      this.pendingTutorialTreasureAdvance = false
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
        // first_chapter_clear 트리거는 챕터 2 1층 진입 시점 (Dungeon.vue) 에서 발화.
        // 챕터 클리어 직후 (advance) 가 아니라 다음 챕터 첫 화면에서 학습하는 게 자연스러움.
      }

      if (result.ended) {
        // 탑 클리어!
        this.handleTowerClear()
        return
      }
      this.combat = null
      this.shop = null
      this.screen = 'dungeon'

      // 자동화 모드 — Dungeon.vue 의 tryAutoEnter 가 setTimeout(120ms) 으로 다음 노드
      // 자동 진입을 등록하지만 안드로이드 webview 에서 setTimeout throttle 로 발화가
      // 누락/지연돼 챕터 전환 후 멈추는 현상이 있었다. micro-task 로 직접 다음 노드
      // 진입을 트리거해 setTimeout 의존을 우회한다.
      if (this.isAutoMode && this.autoEnter) {
        Promise.resolve().then(() => {
          if (!this.run || this.screen !== 'dungeon') return
          const floor = currentFloor(this.run)
          if (!floor || floor.cleared) return
          // shop / special_event 도 자동화 모드에선 자동 진입 (Shop.vue 의
          // autoShopFlow, runSpecialEvent 의 자동 거부가 받는다).
          const allowed = new Set(['monster', 'boss', 'healing_spring', 'treasure', 'shop', 'special_event'])
          if (allowed.has(floor.type)) {
            this.enterCurrentFloor()
          }
        })
      }
    },

    handleTowerClear() {
      if (!this.run) return
      sfx.victory()
      if (this.challengeContext) {
        evaluateFinalChallenges(this.challengeContext, this.run.character)
      }
      this.pendingClear = computePendingBonus(this.run.character)
      // 챌린지 메타 보너스 추가 (rank 보너스 1~10 + 챌린지 metaBonus 합산, 챌린지 클리어 시만)
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
      pushCharacterHistory(this.meta, this.run.character, score, rank, this.runAvatar, lastCh.theme, true)
      // 리더보드 제출 (로그인 시) — fire-and-forget. 실패해도 게임 흐름엔 영향 없음.
      import('./auth').then(({ useAuthStore }) => {
        const a = useAuthStore()
        if (a.isLoggedIn) a.submitScore(score, rank).catch(() => {})
      }).catch(() => {})
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
      this.persistMeta()
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
      if (this.paused) return  // 백그라운드 일시정지
      if (this.tutorialActive) return  // 튜토리얼 활성 동안 게임 일시정지
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
      const playerEff = computeEffectiveStats(this.combat.player)
      const ready = checkActionReady(this.combat, playerEff.무기ticks)
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
        consumeAction(m, m.ticks)
      }

      // 플레이어 자동 행동
      if (!this.combat.ended && this.combat.player.actionGauge >= playerEff.무기ticks) {
        this.playerAutoAct(playerEff.무기ticks)
      }

      if (this.combat.ended) {
        this.handleCombatEnd()
      }
    },

    // 게이지 임계값(무기 ticks) 도달 시 자동 액션 (확률 기반 스킬/평타)
    playerAutoAct(threshold: number) {
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
      consumeAction(combat.player, threshold)
    },

    setCombatSpeed(speed: number) {
      // 튜토리얼 게이팅 (강제 조작 방어):
      //   2배속은 second_combat 학습 후, 4배속은 first_chapter_clear 학습 후만 허용.
      //   5배 이상은 자동화 모드 (dev 서버 한정) — 게이팅 면제.
      if (speed === 2 && !this.meta.tutorialSeen.second_combat) {
        speed = 1
      }
      if (speed === 4 && !this.meta.tutorialSeen.first_chapter_clear) {
        speed = 1
      }
      // 범위 clamp — 1 이상, 1000 이하 정수. production 빌드(안드로이드 포함)
      // 에서는 5+ 가 들어와도 4로 강제 (자동화 모드 비활성).
      speed = Math.max(1, Math.min(1000, Math.round(speed)))
      if (!IS_DEV_SERVER && speed > 4) speed = 4
      this.combatSpeed = speed
      try {
        localStorage.setItem('climetop:speed:v1', String(speed))
      } catch {}
      // 자동화 모드 (5배 이상) — autoEnter 강제 on. 떠 있는 튜토리얼 카드는 그대로
      // 둔다 (사용자가 직접 닫음). 새 단계 trigger 는 triggerTutorial 안에서
      // isAutoMode 가드로 보류된다. 1·2·4 로 다시 내릴 때는 autoEnter 가 사용자
      // 의도 기준이므로 강제 off 하지 않는다. production 빌드는 위에서 4로 clamp
      // 되어 이 분기에 도달하지 않는다.
      if (speed >= 5 && !this.autoEnter) {
        this.setAutoEnter(true)
      }
    },

    // ── 인게임 튜토리얼 ──
    // 단계가 아직 안 봤으면 활성화. 이미 봤거나 다른 단계가 진행 중이면 무시.
    triggerTutorial(step: TutorialStep) {
      if (this.meta.tutorialSeen[step]) return
      if (this.tutorialActive) return
      // 자동화 모드 (6배속) — 튜토리얼 발화 보류. autoEnter / autoShopFlow 가
      // 사용자 개입 없이 흐름을 끌고 가는 동안 안내 모달이 자동 진입을 막지
      // 않게 한다. 6배속을 1·2·4 로 내리면 다시 발화 가능.
      if (this.isAutoMode) return
      // 인벤/상태창 학습 (first_treasure, first_inventory, prompt_status, first_status) 은
      // 챕터 1 3층 (= 상점 노드 도착 직후) 에서만 트리거. 학습 위치를 한 곳에 고정.
      if (step === 'first_treasure' || step === 'first_inventory'
          || step === 'prompt_status' || step === 'first_status') {
        const ch = this.run?.chapters[this.run.currentChapterIndex]
        const floor = ch?.floors[ch?.currentFloor]
        if (!ch || ch.chapter !== 1 || ch.currentFloor !== 2 || floor?.type !== 'shop') return
      }
      // 진입 버튼 안내 — 챕터 1 강제 노드(2층 보물 / 3층 상점) 에서만 발화.
      if (step === 'prompt_enter_treasure') {
        const ch = this.run?.chapters[this.run.currentChapterIndex]
        const floor = ch?.floors[ch?.currentFloor]
        if (!ch || ch.chapter !== 1 || ch.currentFloor !== 1 || floor?.type !== 'treasure') return
      }
      if (step === 'prompt_enter_shop') {
        const ch = this.run?.chapters[this.run.currentChapterIndex]
        const floor = ch?.floors[ch?.currentFloor]
        if (!ch || ch.chapter !== 1 || ch.currentFloor !== 2 || floor?.type !== 'shop') return
      }
      this.tutorialActive = step
    },
    // 첫 상점 진입 시 1회 100골드 지급 — 튜토리얼에서 구매 학습이 가능하도록.
    // first_shop 마킹 전에만 지급, 이미 본 사용자에겐 지급 안 함.
    grantTutorialShopBonus() {
      if (!this.run) return
      if (this.meta.tutorialSeen.first_shop) return
      this.run.character.gold += 100
      saveRun(this.run)
    },
    // 현재 단계 닫기 — 본 것으로 마킹하고 저장
    completeTutorial() {
      const step = this.tutorialActive
      if (!step) return
      this.meta.tutorialSeen[step] = true
      this.tutorialActive = null
      this.persistMeta()
      // first_status (3층 상점 노드에서 닫힘) → 다음으로 상점 진입 버튼 안내 발화.
      // triggerTutorial 의 가드가 floor.type === 'shop' 인지 한 번 더 확인한다.
      if (step === 'first_status') {
        this.triggerTutorial('prompt_enter_shop')
      }
    },
    // 튜토리얼 전체 건너뛰기 — 모든 단계를 본 것으로 마킹 + 현재 단계 종료.
    // pendingTreasureTutorial 같은 예약도 함께 클리어.
    skipAllTutorials() {
      const keys = Object.keys(this.meta.tutorialSeen) as (keyof typeof this.meta.tutorialSeen)[]
      for (const k of keys) this.meta.tutorialSeen[k] = true
      this.tutorialActive = null
      this.pendingTreasureTutorial = false
      this.persistMeta()
    },
    // 설정의 "튜토리얼 다시 보기" — 모든 단계 false 로 리셋
    resetTutorial() {
      this.meta.tutorialSeen = {
        menu_start: false,
        creation_intro: false,
        first_node: false,
        first_combat: false,
        prompt_enter_treasure: false,
        first_treasure: false,
        first_inventory: false,
        prompt_status: false,
        first_status: false,
        prompt_enter_shop: false,
        first_shop: false,
        second_combat: false,
        first_chapter_clear: false,
        meta_creation: false,
        realboss_clear: false,
      }
      // 게이팅된 속도가 켜져 있으면 1배속으로 내림 (재학습 흐름)
      if (this.combatSpeed !== 1) this.setCombatSpeed(1)
      if (this.autoEnter) this.setAutoEnter(false)
      this.persistMeta()
    },

    setAutoEnter(on: boolean) {
      this.autoEnter = on
      try {
        localStorage.setItem('climetop:autoEnter:v1', on ? '1' : '0')
      } catch {}
    },

    // 광고 시청 후 4배속·자동진입 잠금 해제 (등반 1회당 1번)
    unlockAdFastSpeed() {
      if (!this.run) return
      this.run.adFastSpeedUnlocked = true
      saveRun(this.run)
    },
    unlockAdAutoEnter() {
      if (!this.run) return
      this.run.adAutoEnterUnlocked = true
      saveRun(this.run)
    },

    setPaused(on: boolean) {
      this.paused = on
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
      // 자동화 모드 — 특별 이벤트 자동 처리. 대부분 거부 (advance) 하지만
      // 암시장만 체력 스탯을 골드 한도까지 자동 매수 (등반 안정성 직결).
      if (this.isAutoMode) {
        const key = pickOne(SPECIAL_EVENTS) as SpecialEventKey
        if (key === 'black_market') {
          this.autoBlackMarketBuyHp(chapter)
        }
        // 다른 이벤트 (PVP / 룰렛 / 대장장이 / 수집가 / 도박꾼 / 제단 / 모험가) 는
        // 보너스/리스크 trade-off 가 빌드 의도와 충돌 가능 — 자동 거부.
        this.advance()
        return
      }
      const key = pickOne(SPECIAL_EVENTS) as SpecialEventKey
      const info = SPECIAL_EVENT_INFO[key]
      await this.alertModal(info.description, `${info.name}`, npcIconUrl(key))

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
      await this.alertModal('모험가는 적이었다! 전투 개시!', '악당 PVP')
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
      // 60% 무기 / 40% 방어구 — 한쪽만 보유 시 그쪽으로 자동 폴백
      const slot = pickSmithSlot(c)
      if (!slot) {
        await this.alertModal('대장장이가 강화할 장비가 없다며 떠났다.', '🔨 대장장이')
        return
      }
      const target = slot === 'weapon' ? c.weapon! : c.armor!
      const slotLabel = slot === 'weapon' ? '무기' : '방어구'
      const maxBet = Math.min(c.gold, target.sellPrice * 2)
      const choice = await this.showDialog({
        title: '🔨 떠돌이 대장장이',
        message: `${slotLabel}: ${target.trait} ${target.grade} ${target.baseKey} (판매가 ${target.sellPrice}G)\n` +
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
      const result = applySmithUpgrade(c, bet, slot)
      if (this.challengeContext) {
        onSmithBet(this.challengeContext, bet, c.gold + bet, result.success)
      }
      if (result.success && result.newItem) {
        await this.alertModal(
          `${result.newItem.trait} ${result.newItem.grade} ${result.newItem.baseKey}`,
          `🔥 ${slotLabel} 강화 성공!`
        )
        if (this.challengeContext) onEquipItem(this.challengeContext, result.newItem, target)
      } else {
        await this.alertModal(`베팅 ${bet}G 소실`, '💔 강화 실패')
      }
      saveRun(this.run)
    },

    async eventCursedGambler() {
      if (!this.run) return
      const stats: StatKey[] = ['힘', '민첩', '체력', '마력', '행운']
      const stat = await this.showListDialog<StatKey>({
        title: '저주받은 도박사의 룰렛',
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
          { title: '등가교환 제단', okLabel: '교환', cancelLabel: '종료' }
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
          title: '암시장',
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
          { title: '암시장 거래 확인', okLabel: '구매', cancelLabel: '취소' },
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
      const inv = this.run.inventory
      // 장착 + 인벤 전체에서 tier 최고 1개 선정 — 사용자에게 미리 어떤 아이템이
      // 넘어가는지 보여준다 (실제 제거는 양도 확정 후 greedyCollectorTake 가 수행).
      type Cand = { item: ItemInstance; from: '장착' | '인벤' }
      const cands: Cand[] = []
      if (c.weapon) cands.push({ item: c.weapon, from: '장착' })
      if (c.armor)  cands.push({ item: c.armor,  from: '장착' })
      for (const it of inv) cands.push({ item: it, from: '인벤' })
      if (cands.length === 0) {
        await this.alertModal('수집가가 빈손인 당신을 보고 그냥 떠났다.', '탐욕의 수집가')
        return false
      }
      let highest = cands[0]
      for (let i = 1; i < cands.length; i++) {
        if (cands[i].item.tier > highest.item.tier) highest = cands[i]
      }
      const give = await this.confirmModal(
        `${highest.item.trait} ${highest.item.grade} ${highest.item.baseKey} (티어 ${highest.item.tier}, ${highest.from})\n\n` +
          `양도 시 무작위 스탯 +1, 거절 시 보스 70% 강도 PVP`,
        { title: '탐욕의 수집가가 요구한다', okLabel: '양도', cancelLabel: '거절' }
      )
      if (give) {
        const result = greedyCollectorTake(c, inv)
        // 인벤에서 가져갔으면 splice 로 실제 제거 (events.ts 는 character 만 수정).
        if (result.fromInventoryIndex !== undefined && result.fromInventoryIndex >= 0) {
          inv.splice(result.fromInventoryIndex, 1)
        }
        await this.alertModal(`${result.randomStat} +1`, '양도 완료')
        saveRun(this.run)
        return false
      }
      await this.alertModal('수집가가 격노한다!', '전투 개시')
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

    async handleCombatEnd() {
      if (!this.combat) return
      // 진짜 보스 도전 모드: run 없이 진행. 승패 무관하게 결과 화면
      if (this.realBossMonster) {
        this.finishRealBossCombat()
        return
      }
      if (!this.run) return
      if (!this.combat.victory) {
        // v10: 광고 부활 (런당 1회). 도전 모드 / 진짜 보스에서는 비활성.
        if (!this.run.adReviveUsed && !this.realBossMonster) {
          const revive = await this.confirmModal(
            '광고를 보고 부활하시겠습니까?',
            { title: '💀 사망', okLabel: '예 (광고 시청)', cancelLabel: '아니오' }
          )
          if (revive) {
            // AdMob Rewarded Ad — 시청 완료 시에만 부활. 웹/dev 환경에선 즉시 true 반환.
            const watched = await showRewardedAd('revive')
            if (!watched) {
              await this.alertModal('광고 시청이 완료되지 않아 부활할 수 없습니다.', '부활 실패')
              // fallthrough → 게임오버
            } else {
              this.run.adReviveUsed = true
              this.combat.player.hp = this.combat.player.maxHp
              this.combat.player.mp = this.combat.player.maxMp
              this.combat.player.statuses = []
              this.combat.player.silencedUntilTick = undefined
              this.combat.ended = false
              this.combat.victory = false
              pushLog(this.combat, '✨ 부활! (광고 시청 보상)', 'reward')
              saveRun(this.run)
              return
            }
          }
        }
        // 사망 → 게임 오버. (도전 모드 카운터는 클리어만 증가하므로 여기선 카운트 X)
        sfx.death()
        // v10: 도달 챕터 기반 보상 (4~6=F=+1pt / 7~9=E=+2pt / 1~3=없음)
        const reachedChapter = currentChapter(this.run).chapter
        const pending = computePendingBonus(this.run.character, { cleared: false, reachedChapter })
        if (pending.bonus > 0) {
          this.pendingClear = pending
          // 메타 풀에 적립 + 히스토리 기록 (클리어 보상과 동일 흐름의 미니 버전)
          const lastCh = this.run.chapters[Math.max(0, this.run.currentChapterIndex)]
          pushCharacterHistory(this.meta, this.run.character, pending.score, pending.rank, this.runAvatar, lastCh?.theme ?? '고블린', false)
          // 도중 사망 + 등반 보상 → climbCount ++  (clearCount 는 100층 클리어 전용)
          commitClearBonus(this.meta, {}, pending.bonus, false)
        }
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
        // 튜토리얼 학습 중에는 openTreasure 가 미믹 자체를 우회하므로 여기 도달 X.
        // 일반 모드의 미믹 드랍 — 통상 1개.
        const drop = rollItem({ kind: Math.random() < 0.5 ? 'weapon' : 'armor', chapter: chapterNum, source: 'treasure' })
        this.receiveItem(drop)
        pushLog(this.combat, `미믹 드랍: ${drop.trait} ${drop.grade} ${drop.baseKey}`, 'reward')
      }

      saveRun(this.run)
      // 자동화 모드 — Combat.vue 의 maybeAutoAdvance 의 setTimeout(300ms) 의존을 우회하고
      // 즉시 다음 층으로 진행. 안드로이드 webview 에서 100배속 tick 배치 처리로 단일
      // 스레드가 점유되면 setTimeout 스케줄이 지연/누락돼 챕터 전환이 안 일어나는 현상
      // 방지. 자동화 모드는 어차피 사용자 결정 대기가 없으므로 즉시 closeCombat 안전.
      // (보스 드랍 receiveItem 도 자동화 분기에서 모달 없이 동기 완료 — closeCombat
      // 가 itemAnnounceQueue.length > 0 가드에 막히지 않는다.)
      if (this.isAutoMode) {
        this.closeCombat()
      }
      // 다음 층으로 자동 진행은 UI에서 (전투 결과 보여주고 → advance() 호출)
    },

    closeCombat() {
      // 도전 모드면 결과 화면으로 (handleCombatEnd가 이미 처리했을 수도 있음)
      if (this.realBossMonster) {
        this.finishRealBossCombat()
        return
      }
      // 보상 카드(ItemAnnounceModal) 떠 있으면 closeCombat 보류. 그대로 진행하면
      // combat=null 직후 advance() 가 itemAnnounceQueue 가드로 return 해 screen='combat'
      // 인데 combat=null 인 stuck 상태가 된다 → Vue 렌더 null 참조 → 안드로이드 webview
      // 가 더 엄격해 크래시. 사용자가 모달 확인 → clearItemAnnounce 가 다시 closeCombat
      // 호출하면 그때는 큐 비어 통과한다.
      if (this.itemAnnounceQueue.length > 0) return
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
          await this.alertModal(check.reason ?? '챌린지 제약으로 장착 불가', '챌린지')
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
            { title: '인벤토리 없음', danger: true, okLabel: '폐기 후 장착', cancelLabel: '구매 취소' }
          )
          if (!ok) return false
          prevDiscarded = true
        } else if (this.run.inventory.length >= this.run.inventoryCap) {
          const ok = await this.confirmModal(
            `기존 장비 "${prev.trait} ${prev.grade} ${prev.baseKey}"를 넣을 인벤토리 빈 자리가 없습니다.\n폐기하고 새 장비를 장착할까요?`,
            { title: '인벤토리 가득', danger: true, okLabel: '폐기 후 장착', cancelLabel: '구매 취소' }
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
        this.alertModal('리롤 금지령 챌린지: 새로고침 불가', '챌린지 제약')
        return false
      }
      const chapter = currentChapter(this.run).chapter
      const ok = refreshShop(this.shop, this.run.refreshState, chapter, { tutorialForceAcc: !this.meta.tutorialSeen.first_shop })
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

    // 자동화 모드 (6배속) — 상점 진입 시 자동 매수 + 자동 새로고침 + 자동 이탈.
    //   1) 무기는 atkValue, 갑옷은 defValue 가 현재 장착품보다 더 높은 매물만 후보.
    //   2) 가치 높은 순으로 정렬해 골드 한도 내에서 모두 매수. buyItem 이 내부의
    //      receiveItem 을 호출 → 자동 업그레이드 + 가득 시 worst 슬롯 교체까지 처리.
    //   3) 더 매수할 게 없으면 새로고침 시도 (충전 잔량/챌린지 금지 한도 내). 새로고침
    //      후 다시 매수 사이클. 무한 루프 방지로 라운드 cap 적용.
    // 자동화 모드 — 암시장 자동 매수 (체력 스탯만, 골드 한도까지).
    // runSpecialEvent 의 자동 분기에서 black_market 키일 때 호출. 모달 없이 진행.
    autoBlackMarketBuyHp(chapter: number) {
      if (!this.run) return
      const c = this.run.character
      let bought = 0
      const HARD_CAP = 999  // 무한 매수 방지 (가격이 0으로 떨어질 경우 등)
      while (bought < HARD_CAP) {
        const price = blackMarketPrice(chapter, '체력')
        if (price <= 0 || c.gold < price) break
        if (!buyStatPoint(c, chapter, '체력')) break
        bought++
        if (this.challengeContext) onBlackMarketUsed(this.challengeContext)
      }
      saveRun(this.run)
    },

    autoShopFlow() {
      if (!this.run || !this.shop || !this.isAutoMode) return
      const c = this.run.character
      const chapter = this.currentChapterState?.chapter
      const valOf = (it: ItemInstance): number => it.kind === 'weapon'
        ? computeItemValue(it, c, { chapter }).atkValue
        : computeItemValue(it, c, { chapter }).defValue
      const refreshBlocked = !!this.challengeContext && shopRefreshForbidden(this.challengeContext)

      const MAX_ROUNDS = 8       // 새로고침 최대 사이클 (실 충전 한도가 먼저 동작)
      let round = 0
      while (round <= MAX_ROUNDS && this.shop) {
        // ── 매수 라운드 ──
        let buySafety = 32
        while (buySafety-- > 0 && this.shop && this.shop.inventory.length > 0) {
          const curW = c.weapon ? computeItemValue(c.weapon, c, { chapter }).atkValue : -Infinity
          const curA = c.armor  ? computeItemValue(c.armor,  c, { chapter }).defValue : -Infinity
          type Cand = { it: ItemInstance; v: number }
          const cands: Cand[] = []
          for (const it of this.shop.inventory) {
            const v = valOf(it)
            const better = it.kind === 'weapon' ? v > curW : v > curA
            const budget = c.gold >= it.buyPrice
            if (better && budget) cands.push({ it, v })
          }
          if (cands.length === 0) break
          cands.sort((a, b) => b.v - a.v)
          if (!this.buyItem(cands[0].it)) break
        }
        // ── 새로고침 ──
        if (round >= MAX_ROUNDS) break
        if (refreshBlocked) break
        // refreshShop 은 충전 잔량 / 골드 / 챕터 가드 모두 내부에서 처리, 성공 시 true.
        // autoShopFlow 안에서는 alertModal 을 띄우는 분기를 우회하기 위해 직접 호출.
        const chNum = currentChapter(this.run).chapter
        const ok = refreshShop(this.shop, this.run.refreshState, chNum,
          { tutorialForceAcc: !this.meta.tutorialSeen.first_shop })
        if (!ok) break
        this.refreshUsedThisChapter = true
        if (this.challengeContext) {
          onShopRefresh(this.challengeContext, chNum, 0)
        }
        round++
      }
      saveRun(this.run)
      this.leaveShop()
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
      if (this.realBossDeclinedThisSession) return false  // 거절 후 무한 재트리거 방지
      this.startRealBoss()
      return true
    },

    // 도전 화면 진입: 가장 최근 클리어 캐릭터 부활 + 진짜 보스 생성.
    // "탑을 5번 오른 그 캐릭터로 최종 보스에 도전" — 게임 최종 목표.
    //   * 도전 직전에 일러스트 + "진짜 보스에 도전하시겠습니까?" 확인 모달.
    //   * "예" 누른 후에만 totalGoldEarned 소진 + 도전 화면으로 진입.
    async startRealBoss() {
      const latest = pickLatestRecord(this.meta)
      if (!latest) return

      const ok = await this.confirmModal('진짜 보스에 도전하시겠습니까?', {
        title: '진짜 보스의 부름',
        okLabel: '도전하기',
        cancelLabel: '나중에',
        imageUrl: '/images/REALBOSS/진짜보스직전.png',
      })
      if (!ok) {
        // 누적 골드는 보존 — 이번 세션은 거절 처리 (메뉴 재진입 시 다시 안 뜸)
        this.realBossDeclinedThisSession = true
        return
      }

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
    //   * 누적 보너스 풀(totalBonusStats) 이 자리에서 0 리셋 — 어떤 경로로 캐릭터 생성에 가도 안전
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
      // 누적 풀 리셋 — 결과 화면 버튼 클릭 여부와 무관하게 보스전 종료 시점에 처리
      this.meta.totalBonusStats = 0
      this.meta.allocations = {}
      this.persistMeta()
      this.combat = null
      this.screen = 'realboss_result'
    },

    // 결과 화면 → 만화(t1~t3) → 캐릭터 생성
    //   누적 풀 리셋은 finishRealBossCombat 에서 이미 처리. 여기선 라우팅만.
    proceedFromRealBossResult() {
      this.realBossMonster = null
      this.realBossWeakRecord = null
      this.realBossTheme = null
      this.realBossInitialMaxHp = 0
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
      // main.png 컷은 제거 — 모든 flow 가 t1(=page 1) 부터 시작.
      //   first:         page=1 → 2
      //   afterRealBoss: page=1 → 2 → 3
      //   replay:        page=1 → 2  (도전 미완료) / 1 → 2 → 3 (도전 완료)
      this.introPage = 1
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
      // 0) 튜토리얼 오버레이 → 현재 단계 닫기 (가장 위에 떠 있음)
      if (this.tutorialActive) {
        this.completeTutorial()
        return true
      }
      // 0.5) 아이템 획득 알림 → 확인 동작과 동등 (큐 전체 비움)
      if (this.itemAnnounceQueue.length > 0) {
        this.clearItemAnnounce()
        return true
      }
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
        // 첫 실행 — 메인 메뉴에서 새 캐릭터 시작 버튼 안내 (menu_start)
        this.triggerTutorial('menu_start')
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

