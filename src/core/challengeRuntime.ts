import type { Character, ItemInstance, Stats, StatKey } from '@/types'
import type { ChallengeDef, ChallengeFlags } from '@/data/challenges'
import { CHALLENGES_MAP } from '@/data/challenges'
import { WEAPONS } from '@/data/weapons'
import { computeEffectiveStats } from './stats'

export interface ActiveChallenge {
  key: string
  failed: boolean
  // 트래킹용 카운터
  counters: {
    shopPurchaseCount?: number
    armorEverEquipped?: boolean
    legendaryEverEquipped?: boolean
    nonTier1EverEquipped?: boolean
    traitedEverEquipped?: boolean
    altarChapterUsage?: Record<number, number>  // 챕터별 교환 횟수
    altarOfferedChapters?: Record<number, boolean>  // 제단 등장한 챕터
    refreshUsedByChapter?: Record<number, boolean>
    totalGoldSpent?: number
    mimicFled?: boolean
    blackMarketCount?: number
    rouletteGreatCount?: number
    smith80PctSuccess?: boolean
    betrayalHits?: number
    mirageHit?: boolean   // 환영 챕터 피격 여부
    longestBossTick?: number
    lowHpTickAccum?: number
    cursedRemoved?: boolean
    potionPurchased?: boolean
    activeSkillsUsed?: number
    basicAttacksUsed?: number
    mpEmptyEveryChapter?: boolean
    speedAlways6OrBelow?: boolean
    avgTierViolated?: boolean
  }
}

export interface ChallengeContext {
  active: ActiveChallenge[]
}

export function makeChallengeContext(challengeKeys: string[]): ChallengeContext {
  return {
    active: challengeKeys.map((key) => ({ key, failed: false, counters: {} })),
  }
}

// 즉시 보상 적용
export function applyInstantRewards(character: Character, ctx: ChallengeContext) {
  // 1) 운칠기삼: 행운 외 모든 4종 스탯을 최소(3)으로 강제, 잉여를 행운으로
  //    스탯 분배 결과를 무시하고 행운 일점투자 빌드로 시작
  for (const ac of ctx.active) {
    const def = CHALLENGES_MAP[ac.key]
    if (def?.flags?.trackLuckOnly) {
      const base = ['공격력', '방어력', '체력', '마력'] as StatKey[]
      let surplus = 0
      for (const k of base) {
        surplus += Math.max(0, character.stats[k] - 3)
        character.stats[k] = 3
      }
      character.stats.행운 = (character.stats.행운 ?? 0) + surplus
    }
  }

  // 2) 즉시 보상 스탯 / 골드
  for (const ac of ctx.active) {
    const def = CHALLENGES_MAP[ac.key]
    if (!def || def.category !== 'instant') continue
    if (def.instantBonus) {
      for (const k in def.instantBonus) {
        const stat = k as StatKey
        character.stats[stat] = (character.stats[stat] ?? 0) + (def.instantBonus[stat] ?? 0)
      }
    }
    if (def.instantStartGold) {
      character.gold += def.instantStartGold
    }
  }
  // 체력/마력 변경된 경우 maxHp/MP 재계산
  character.maxHp = character.stats.체력 * 20 + 50
  character.maxMp = character.stats.마력 * 15 + 30
  character.hp = character.maxHp
  character.mp = character.maxMp

  // MP cap flag 적용 (유지력 상실)
  for (const ac of ctx.active) {
    const def = CHALLENGES_MAP[ac.key]
    if (def?.flags?.mpCapFixed !== undefined) {
      character.maxMp = def.flags.mpCapFixed
      character.mp = character.maxMp
    }
  }
}

// 활성 챌린지 플래그 통합
export function mergedFlags(ctx: ChallengeContext): ChallengeFlags {
  const merged: ChallengeFlags = {}
  for (const ac of ctx.active) {
    if (ac.failed) continue
    const def = CHALLENGES_MAP[ac.key]
    if (!def?.flags) continue
    Object.assign(merged, def.flags)
  }
  return merged
}

// 장비 장착 가능 여부 체크 (UI에서 buy/equip 전에 호출)
export function canEquipItem(item: ItemInstance, ctx: ChallengeContext): { ok: boolean; reason?: string } {
  const flags = mergedFlags(ctx)

  if (item.kind === 'armor' && flags.noArmor) {
    return { ok: false, reason: '갑옷 장착 불가 (유리 대포 계약)' }
  }
  if (flags.forceLowTraitsOnly && item.tier > 4) {
    return { ok: false, reason: '하급 특성만 장착 가능 (녹슨 칼날의 맹세)' }
  }
  if (flags.forceLowNormalOnly && item.tier !== 1) {
    return { ok: false, reason: '하급-노말만 장착 가능' }
  }
  if (flags.forceCommonNormalOnly && (item.tier !== 5 || item.trait !== '날카로운')) {
    return { ok: false, reason: '보통-노말만 장착 가능 (특성 봉인)' }
  }
  if (item.kind === 'weapon') {
    const wbase = WEAPONS[item.baseKey]
    if (flags.forbidMagicWeapon && wbase?.isMagic) {
      return { ok: false, reason: '마법 무기 봉인 (마법 혐오증)' }
    }
    if (flags.forbidLargeWeapon && wbase && wbase.speedCoef <= 0.8) {
      return { ok: false, reason: '대형 무기 금지 (체중 감량)' }
    }
    if (flags.onlySpeedCoef1 && wbase && wbase.speedCoef !== 1.0) {
      return { ok: false, reason: '속도계수 1.0 무기만 (강박증)' }
    }
  }
  if (item.kind === 'armor') {
    const akey = item.baseKey
    if (flags.forbidPlateHeavy && (akey === '판금' || akey === '중갑')) {
      return { ok: false, reason: '판금/중갑 금지 (연약한 피부)' }
    }
  }
  return { ok: true }
}

// 사망 체크: 스탯 한계 (과유불급, 황금 알레르기)
export function checkInstantDeathConditions(_character: Character, ctx: ChallengeContext, currentEffectiveAtk: number, totalGoldEarned: number): string | null {
  const flags = mergedFlags(ctx)
  if (flags.maxAtk !== undefined && currentEffectiveAtk > flags.maxAtk) {
    return `공격력 한계 초과: ${currentEffectiveAtk.toFixed(1)} > ${flags.maxAtk}로 사망`
  }
  if (flags.goldMax500Death && totalGoldEarned > 500) {
    return `황금 알레르기: 누적 골드 ${totalGoldEarned} > 500으로 사망`
  }
  return null
}

// 골드 0 강제 (진정한 무소유)
export function enforceGoldZero(character: Character, ctx: ChallengeContext) {
  const flags = mergedFlags(ctx)
  if (flags.goldZero) {
    character.gold = 0
  }
}

// 속도 고정 (굼벵이 전술)
export function speedOverride(ctx: ChallengeContext): number | undefined {
  const flags = mergedFlags(ctx)
  return flags.speedFixed
}

// MP cap (유지력 상실)
export function mpCapOverride(ctx: ChallengeContext): number | undefined {
  const flags = mergedFlags(ctx)
  return flags.mpCapFixed
}

// 회피 / 명중 추가 보정
export function extraAccuracyPenalty(ctx: ChallengeContext, isBlindContext: boolean): number {
  const flags = mergedFlags(ctx)
  if (flags.blindExtra && isBlindContext) return -flags.blindExtra
  return 0
}

// 회복 효율
export function healEfficiency(ctx: ChallengeContext): number {
  const flags = mergedFlags(ctx)
  return flags.healEffMult ?? 1.0
}

// 위반 체크: 액티브 스킬 사용
export function recordActiveSkillUse(ctx: ChallengeContext) {
  for (const ac of ctx.active) {
    const def = CHALLENGES_MAP[ac.key]
    if (def?.flags?.noActiveSkills) ac.failed = true
    if (def?.flags?.trackPacifist) ac.failed = true
    if (def?.flags?.trackSkillOnly) ac.counters.activeSkillsUsed = (ac.counters.activeSkillsUsed ?? 0) + 1
  }
}

export function recordBasicAttackUse(ctx: ChallengeContext) {
  for (const ac of ctx.active) {
    const def = CHALLENGES_MAP[ac.key]
    if (def?.flags?.onlyActiveSkills) ac.failed = true
    if (def?.flags?.trackPacifist) ac.counters.basicAttacksUsed = (ac.counters.basicAttacksUsed ?? 0) + 1
  }
}

// 챌린지 메타 보상 계산 (탑 클리어 시 추가)
export function calcChallengeMetaBonus(ctx: ChallengeContext): number {
  let total = 0
  for (const ac of ctx.active) {
    if (ac.failed) continue
    const def = CHALLENGES_MAP[ac.key]
    if (def?.metaBonus) total += def.metaBonus
  }
  return total
}

// ============================================================
// 트래킹 훅 — game.ts에서 이벤트 발생 시 호출
// ============================================================

function forActive(ctx: ChallengeContext, fn: (ac: ActiveChallenge, def: ChallengeDef) => void) {
  for (const ac of ctx.active) {
    if (ac.failed) continue
    const def = CHALLENGES_MAP[ac.key]
    if (!def) continue
    fn(ac, def)
  }
}

/** 장비 장착 직후 호출 */
export function onEquipItem(ctx: ChallengeContext, item: ItemInstance, previousItem: ItemInstance | null) {
  forActive(ctx, (ac, def) => {
    const f = def.flags
    if (!f) return
    // 레전드 1회라도 → 무소유의 장
    if (f.trackNoLegendaryEver) {
      if (item.grade === '레전드' || item.tier > 12) {
        ac.counters.legendaryEverEquipped = true
        ac.failed = true
      }
    }
    // 1티어 외 → 순수 가난 (50층까지만 카운트 — 챕터 정보가 없으면 일단 기록만)
    if (f.trackOnlyTier1) {
      if (item.tier !== 1) {
        ac.counters.nonTier1EverEquipped = true
        // 실제 실패 판정은 evaluate 단계에서 (챕터 5 이전인지 체크)
      }
    }
    // 특성 봉인 — '날카로운' 외 특성 장착 시 실패
    if (f.trackNoTraitEquip) {
      if (item.trait !== '날카로운') {
        ac.counters.traitedEverEquipped = true
        ac.failed = true
      }
    }
    // 갑옷 X — 알몸의 순례자
    if (f.trackNoArmorEver && item.kind === 'armor') {
      ac.counters.armorEverEquipped = true
      // 실패 판정은 evaluate (50층 이전 위반 = fail)
    }
    // 저주의 무기 해제 추적 — 시작 시 저주의면 마킹, 교체 시 실패
    if (f.trackCursedNeverRemove) {
      if (previousItem && previousItem.kind === 'weapon' && previousItem.trait === '저주의') {
        if (item.id !== previousItem.id) {
          ac.counters.cursedRemoved = true
          ac.failed = true
        }
      }
    }
  })
}

/** 상점 구매 직후 호출 */
export function onShopBuy(ctx: ChallengeContext, item: ItemInstance, price: number) {
  forActive(ctx, (ac, def) => {
    const f = def.flags
    if (!f) return
    if (f.trackNoShopBuy) {
      ac.counters.shopPurchaseCount = (ac.counters.shopPurchaseCount ?? 0) + 1
      ac.failed = true
    }
    if (f.trackTotalSpendUnder300) {
      ac.counters.totalGoldSpent = (ac.counters.totalGoldSpent ?? 0) + price
      if ((ac.counters.totalGoldSpent ?? 0) > 300) ac.failed = true
    }
    if (f.trackNoPotionPurchase) {
      // climetop엔 포션 시스템 X — 일단 모든 구매를 포션 취급 X (스킵)
    }
  })
}

/** 상점 새로고침 사용 직후 호출 */
export function onShopRefresh(ctx: ChallengeContext, chapter: number, cost: number) {
  forActive(ctx, (ac, def) => {
    const f = def.flags
    if (!f) return
    if (f.trackUseRefreshEveryChapter) {
      if (!ac.counters.refreshUsedByChapter) ac.counters.refreshUsedByChapter = {}
      ac.counters.refreshUsedByChapter[chapter] = true
    }
    if (f.trackTotalSpendUnder300) {
      ac.counters.totalGoldSpent = (ac.counters.totalGoldSpent ?? 0) + cost
      if ((ac.counters.totalGoldSpent ?? 0) > 300) ac.failed = true
    }
  })
}

/** 미믹 도주 시 호출 */
export function onMimicFlee(ctx: ChallengeContext) {
  forActive(ctx, (ac, def) => {
    if (def.flags?.trackKillAllMimics) {
      ac.counters.mimicFled = true
      ac.failed = true
    }
  })
}

/** 보스 전투 종료 시 호출 */
export function onBossFightEnd(ctx: ChallengeContext, tickCount: number) {
  forActive(ctx, (ac, def) => {
    const f = def.flags
    if (!f) return
    if (f.trackBoss100Tick) {
      ac.counters.longestBossTick = Math.max(ac.counters.longestBossTick ?? 0, tickCount)
      if (tickCount > 100) ac.failed = true
    }
  })
}

/** 매 틱 체크 (HP 비율 < 0.30이면 카운트 / 속도 6 이하 체크) */
export function onTick(ctx: ChallengeContext, character: Character) {
  forActive(ctx, (ac, def) => {
    const f = def.flags
    if (!f) return
    if (f.trackLowHp500Tick) {
      const ratio = character.hp / Math.max(1, character.maxHp)
      if (ratio <= 0.30) {
        ac.counters.lowHpTickAccum = (ac.counters.lowHpTickAccum ?? 0) + 1
      }
    }
    if (f.trackSpeedBelow6) {
      const eff = computeEffectiveStats(character)
      if (eff.속도 > 6) {
        ac.counters.speedAlways6OrBelow = false
        ac.failed = true
      } else if (ac.counters.speedAlways6OrBelow === undefined) {
        ac.counters.speedAlways6OrBelow = true
      }
    }
  })
}

/** 챕터 종료 시 호출 (다음 챕터 진입 직전) */
export function onChapterEnd(ctx: ChallengeContext, chapter: number, character: Character, refreshUsedThisChapter: boolean) {
  forActive(ctx, (ac, def) => {
    const f = def.flags
    if (!f) return
    // MP 0 챕터 종료 (자연치유 거부)
    if (f.trackMpEmptyAtChapterEnd) {
      if (character.mp > 0) {
        ac.counters.mpEmptyEveryChapter = false
        ac.failed = true
      } else if (ac.counters.mpEmptyEveryChapter === undefined) {
        ac.counters.mpEmptyEveryChapter = true
      }
    }
    // 새로고침 매 챕터 사용 (황금고블린 파트너)
    if (f.trackUseRefreshEveryChapter) {
      if (!refreshUsedThisChapter) {
        ac.failed = true
      }
    }
    // 1티어 외 장착 50층 이전 위반 (순수 가난)
    if (f.trackOnlyTier1 && chapter <= 5) {
      if (ac.counters.nonTier1EverEquipped) ac.failed = true
    }
    // 갑옷 50층 이전 (알몸의 순례자)
    if (f.trackNoArmorEver && chapter <= 5) {
      if (ac.counters.armorEverEquipped) ac.failed = true
    }
  })
}

/** 도박사 룰렛 결과 */
export function onRouletteResult(ctx: ChallengeContext, outcome: '대성공' | '성공' | '무효' | '실패' | '대실패') {
  forActive(ctx, (ac, def) => {
    if (def.flags?.trackRouletteGreat3 && outcome === '대성공') {
      ac.counters.rouletteGreatCount = (ac.counters.rouletteGreatCount ?? 0) + 1
    }
  })
}

/** 대장장이 베팅 결과 */
export function onSmithBet(ctx: ChallengeContext, bet: number, totalGold: number, success: boolean) {
  forActive(ctx, (ac, def) => {
    if (def.flags?.trackSmith80PctBet) {
      const pct = totalGold > 0 ? bet / totalGold : 0
      if (pct >= 0.80 && success) ac.counters.smith80PctSuccess = true
      else if (pct >= 0.80 && !success) ac.failed = true
    }
  })
}

/** 암시장 사용 */
export function onBlackMarketUsed(ctx: ChallengeContext) {
  forActive(ctx, (ac, def) => {
    if (def.flags?.trackBlackMarketCount) {
      ac.counters.blackMarketCount = (ac.counters.blackMarketCount ?? 0) + 1
    }
  })
}

/** 제단 교환 사용 */
export function onAltarUsed(ctx: ChallengeContext, chapter: number) {
  forActive(ctx, (ac, def) => {
    if (def.flags?.trackAltarEveryChapter) {
      if (!ac.counters.altarChapterUsage) ac.counters.altarChapterUsage = {}
      ac.counters.altarChapterUsage[chapter] = (ac.counters.altarChapterUsage[chapter] ?? 0) + 1
    }
  })
}

/** 제단 등장 (열렸을 때) — 챕터 단위 기록 */
export function onAltarOffered(ctx: ChallengeContext, chapter: number) {
  forActive(ctx, (ac, def) => {
    if (def.flags?.trackAltarEveryChapter) {
      if (!ac.counters.altarOfferedChapters) ac.counters.altarOfferedChapters = {}
      ac.counters.altarOfferedChapters[chapter] = true
    }
  })
}

/** PVP 전투에서 플레이어 피격 (배신 저항군) */
export function onPvpHit(ctx: ChallengeContext, _damage: number) {
  forActive(ctx, (ac, def) => {
    if (def.flags?.trackBetrayalPerfect) {
      ac.counters.betrayalHits = (ac.counters.betrayalHits ?? 0) + 1
    }
  })
}

/** 플레이어 피격 (테마별) — 환영 파괴자 추적 */
export function onPlayerHitByTheme(ctx: ChallengeContext, theme: string, _damage: number) {
  forActive(ctx, (ac, def) => {
    if (def.flags?.trackDodgeAllMirage && theme === '환영') {
      ac.counters.mirageHit = true
    }
  })
}

/** 최종 클리어 시 모든 챌린지 검증 */
export function evaluateFinalChallenges(ctx: ChallengeContext, character: Character) {
  forActive(ctx, (ac, def) => {
    const f = def.flags
    if (!f) return

    // 자산 동결: 최종 골드 > 0이면 실패
    if (f.trackGoldZeroAtFinalBoss) {
      if (character.gold > 0) ac.failed = true
    }
    // 평균 티어 3 이하 (가난이 체질)
    if (f.trackAvgTier3OrLower) {
      const wt = character.weapon?.tier ?? 1
      const at = character.armor?.tier ?? 1
      const avg = (wt + at) / 2
      if (avg > 3) {
        ac.counters.avgTierViolated = true
        ac.failed = true
      }
    }
    // 평화주의자: 액티브 스킬 0회
    if (f.trackPacifist) {
      if ((ac.counters.activeSkillsUsed ?? 0) > 0) ac.failed = true
    }
    // 스킬 미학: 평타 0회
    if (f.trackSkillOnly) {
      if ((ac.counters.basicAttacksUsed ?? 0) > 0) ac.failed = true
    }
    // 도박중독: 룰렛 대성공 3회
    if (f.trackRouletteGreat3) {
      if ((ac.counters.rouletteGreatCount ?? 0) < 3) ac.failed = true
    }
    // 빈사의 유령: HP 30% 이하 누적 500틱
    if (f.trackLowHp500Tick) {
      if ((ac.counters.lowHpTickAccum ?? 0) < 500) ac.failed = true
    }
    // 암시장 VIP: 누적 10회
    if (f.trackBlackMarketCount) {
      if ((ac.counters.blackMarketCount ?? 0) < (f.trackBlackMarketCount ?? 10)) ac.failed = true
    }
    // 대장장이의 은인
    if (f.trackSmith80PctBet) {
      if (!ac.counters.smith80PctSuccess) ac.failed = true
    }
    // 미믹 사냥꾼: 도주 X
    if (f.trackKillAllMimics) {
      if (ac.counters.mimicFled) ac.failed = true
    }
    // 배신 저항군: PVP 피격 ≤ 3
    if (f.trackBetrayalPerfect) {
      if ((ac.counters.betrayalHits ?? 0) > 3) ac.failed = true
    }
    // 환영 파괴자: 환영 챕터 무피격
    if (f.trackDodgeAllMirage) {
      if (ac.counters.mirageHit) ac.failed = true
    }
    // 철저한 등가교환: 제단이 등장한 모든 챕터에서 3회 교환 사용
    if (f.trackAltarEveryChapter) {
      const offered = ac.counters.altarOfferedChapters ?? {}
      const usage = ac.counters.altarChapterUsage ?? {}
      for (const chKey of Object.keys(offered)) {
        const ch = Number(chKey)
        if ((usage[ch] ?? 0) < 3) {
          ac.failed = true
          break
        }
      }
    }
  })
}

// ============================================================
// 챌린지 옵션 조회 (자동 액션에서 사용)
// ============================================================

export function isActiveSkillForbidden(ctx: ChallengeContext): boolean {
  return mergedFlags(ctx).noActiveSkills === true
}

export function isBasicAttackForbidden(ctx: ChallengeContext): boolean {
  return mergedFlags(ctx).onlyActiveSkills === true
}

export function rescueAdventurerForbidden(ctx: ChallengeContext): boolean {
  return mergedFlags(ctx).noRescueAdventurer === true
}

export function healingSpringForbidden(ctx: ChallengeContext): boolean {
  return mergedFlags(ctx).noHealingSpring === true
}

export function shopForbidden(ctx: ChallengeContext): boolean {
  return mergedFlags(ctx).noShop === true
}

export function shopRefreshForbidden(ctx: ChallengeContext): boolean {
  return mergedFlags(ctx).noShopRefresh === true
}

export function isIronWillForbidden(ctx: ChallengeContext): boolean {
  return mergedFlags(ctx).noIronWill === true
}
