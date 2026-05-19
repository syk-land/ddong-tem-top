// ====== 능력치 ======
// 통합된 10스탯 (물공+마공→공격력, 물방+마방→방어력, 물리관통+마법관통→관통)
export type StatKey =
  | '공격력' | '방어력'
  | '체력' | '마력'
  | '속도' | '행운'
  | '명중률' | '회피율'
  | '관통'
  | '상태저항'

export type Stats = Record<StatKey, number>

// 캐릭터 생성 시 무작위 분배 대상 스탯 (4개)
export const RANDOM_STAT_KEYS: StatKey[] = ['공격력', '방어력', '체력', '마력']

// ====== 등급 / 티어 ======
export type TraitTier = '하급' | '보통' | '희귀' | '특별'
export type Grade = '노말' | '레어' | '스페셜' | '레전드'

export const TRAIT_TIER_LEVEL: Record<TraitTier, number> = {
  하급: 1, 보통: 2, 희귀: 3, 특별: 4,
}

export const GRADE_LEVEL: Record<Grade, number> = {
  노말: 1, 레어: 2, 스페셜: 3, 레전드: 4,
}

export const GRADE_COEF_RANGE: Record<Grade, [number, number]> = {
  노말: [0.5, 1.0],
  레어: [1.0, 1.5],
  스페셜: [1.5, 2.5],
  레전드: [2.5, 4.0],
}

export const GRADE_PRICE_MULT: Record<Grade, number> = {
  노말: 0.5, 레어: 1.0, 스페셜: 3.0, 레전드: 6.0,
}

// ====== 무기 / 갑옷 카테고리 ======
export type WeaponCategory = 'melee' | 'ranged' | 'magic'
export type ArmorType = '판금' | '중갑' | '가죽갑' | '로브'
export type Element = '물' | '불' | '바람' | '대지' | '번개' | '암흑' | '빛' | '무'

// ====== 트레잇 효과 ======
export interface TraitEffect {
  // 공격력 / 방어력 % 보너스 (음수도 가능) — 물리/마법 통합
  공격력_pct?: number
  방어력_pct?: number
  속도_pct?: number
  전스탯_pct?: number
  명중?: number
  회피?: number
  행운?: number
  관통?: number       // 물리관통 + 마법관통 통합
  상태저항?: number
  마력?: number
  // 특수 효과
  lifesteal?: number          // 데미지의 N% HP 회복
  self_dot_pct?: number       // 매 10틱 HP 손실 % (grade coef 적용 X = 고정)
  vs_undead_pct?: number      // 언데드/암흑 추가 데미지
  // 상태이상 발동 확률 (0~1)
  burn_chance?: number
  slow_chance?: number
  shock_chance?: number
  bleed_chance?: number
  blind_chance?: number
  poison_chance?: number
  // 갑옷 전용: 받은 데미지 반사
  reflect_burn?: number
  reflect_slow?: number
  reflect_shock?: number
  reflect_bleed?: number
  reflect_blind?: number
  reflect_poison?: number
  // 갑옷 전용: 받은 데미지 흡혈
  damage_taken_heal_pct?: number
  // 상태 면역/저항 % 감소
  resist_burn?: number
  resist_slow?: number
  resist_shock?: number
  resist_bleed?: number
  resist_blind?: number
  resist_poison?: number
}

export interface TraitDef {
  name: string
  tier: TraitTier
  price: number       // sell_price 베이스
  effects: TraitEffect
  fixed_self_dot?: boolean  // 저주의: grade coef 미적용
}

// ====== 무기 ======
export interface WeaponBase {
  key: string         // 단검, 검, ...
  category: WeaponCategory
  baseAtk: number
  speedCoef: number   // 매 틱 누적 = 속도 × speedCoef
  accBonus: number    // 명중 보정 (예: 완드 +10, 마도서 -10)
  mpBonus: number     // 마법 무기 MP 소모 보정 (완드 -2, 마도서 +2)
  magicPenBonus: number  // 스태프 +5
  isMagic: boolean
  element?: Element   // 마법 무기만
  autoSkill: string   // 자동 부여 스킬 키
}

// ====== 갑옷 ======
// 방어 통합: baseDef 하나만. baseMdef 제거.
export interface ArmorBase {
  key: ArmorType
  baseDef: number      // 통합 방어력
  speedMult: number    // 갑옷 속도 보정
  evasion: number      // 가죽갑 +10
  mpBonus: number      // 로브 +25
  autoSkill?: string
}

// ====== 아이템 인스턴스 ======
export interface ItemInstance {
  id: string                   // unique runtime id
  kind: 'weapon' | 'armor'
  baseKey: string              // weapon/armor key
  trait: string                // trait name
  grade: Grade
  coef: number                 // 등급 굴림 결과 (0.5~4.0)
  tier: number                 // 1~16
  sellPrice: number
  buyPrice: number
  buyback: number
  effects: TraitEffect         // 스케일링된 효과 (계수 적용)
}

// ====== 스킬 ======
export type SkillKind = 'physical_atk' | 'physical_def' | 'magic_atk' | 'magic_def'

export interface SkillDef {
  key: string
  name: string
  mp: number
  kind: SkillKind
  element?: Element
  description: string
  // 효과는 코드에서 직접 처리 (스킬마다 다른 로직)
}

// ====== 상태이상 ======
export type StatusKind = '점화' | '출혈' | '독' | '둔화' | '암흑' | '감전'

export interface StatusDef {
  key: StatusKind
  category: 'dot_magic' | 'dot_physical' | 'dot_hybrid' | 'speed_mod' | 'accuracy_mod' | 'damage_taken_mod'
  baseValue: number       // 효과 강도 (DoT 비율, 디버프 양 등)
  baseDuration: number    // 틱 단위
  dotInterval: number     // 0이면 지속형, 10이면 매 10틱 트리거
}

export interface StatusInstance {
  kind: StatusKind
  appliedTick: number
  duration: number        // 남은 틱
  stacks: number          // 1~5
  snapshotAtk: number     // 시전자 스탯 스냅샷 (DoT 계산용)
  nextDotAt?: number      // 다음 DoT 트리거 틱
}

// ====== 챕터 / 몬스터 ======
export type ChapterTheme =
  | '고블린' | '골렘' | '언데드' | '환영' | '흡혈귀'
  | '심해' | '기계' | '용암' | '암흑' | '천공' | '맹독'

export interface MonsterTemplate {
  name: string
  hpMod?: number          // base HP 배수 (1.0 = 표준)
  atkMod?: number
  defMod?: number
  speedOverride?: number
  element?: Element
  trait?: string          // 특수 능력 키 (예: 'reflect_physical', 'burst_minions')
}

export interface ChapterThemeDef {
  key: ChapterTheme
  baseName: string        // "고블린 군락"
  hardName: string        // "고블린 해방군"
  description: string
  normalMonsters: MonsterTemplate[]
  boss: MonsterTemplate
  hardBoss?: MonsterTemplate
  // 일반 전투 시 등장 수 범위 (강한 몹 ↓, 약한 몹 ↑)
  encounterMin: number
  encounterMax: number
}

export interface MonsterInstance {
  template: MonsterTemplate
  hp: number
  maxHp: number
  atk: number
  def: number
  speed: number
  isBoss: boolean
  isMimic: boolean
  statuses: StatusInstance[]
  actionGauge: number
  _deathLogged?: boolean  // 사망 로그 1회만 출력
}

// ====== 캐릭터 ======
export interface Character {
  stats: Stats
  hp: number
  maxHp: number
  mp: number
  maxMp: number
  weapon: ItemInstance | null
  armor: ItemInstance | null
  gold: number
  statuses: StatusInstance[]
  actionGauge: number
}

// ====== 게임 진행 ======
export type FloorEventType =
  | 'monster' | 'boss' | 'shop' | 'treasure' | 'healing_spring' | 'special_event'

export interface FloorEvent {
  type: FloorEventType
  cleared: boolean
  // 특별 이벤트 식별
  specialEventKey?: string
}

export interface ChapterState {
  chapter: number
  theme: ChapterTheme
  isHard: boolean
  themeName: string
  floors: FloorEvent[]
  currentFloor: number    // 1-10 (0 = 챕터 시작 전)
  specialEventOccurred: boolean
}

export interface TowerRun {
  character: Character
  chapters: ChapterState[]
  currentChapterIndex: number  // 0~9
  refreshState: ShopRefreshState
  tickCount: number
  // 인벤토리 (장착 외 보관 슬롯)
  inventory: ItemInstance[]
  inventoryCap: number         // 기본 6, 미니멀리스트 = 0
  // 선택한 챌린지 (key 보관 — 복원 시 컨텍스트 재생성)
  challengeKeys?: string[]
}

// ====== 상점 ======
export interface ShopRefreshState {
  charges: number
  cap: number
  eventBoostActive: boolean
  usedAtMax: boolean
}

export interface ShopState {
  inventory: ItemInstance[]
  slotCount: number
}

// ====== 메타 (영구 누적 보너스) ======
export interface MetaBonuses {
  clearCount: number
  totalBonusStats: number   // 누적 자유 분배 가능 포인트
  allocations: Partial<Stats>  // 어떤 스탯에 얼마나 분배했는지 (다음 캐릭터에 자동 적용)
}

// ====== 화면 라우팅 ======
export type Screen =
  | 'menu' | 'create' | 'dungeon' | 'combat' | 'shop'
  | 'gameover' | 'victory' | 'event' | 'inventory'
