import type { Character, Grade, TraitTier } from '@/types'
import { WEAPONS } from '@/data/weapons'
import { WEAPON_TRAITS } from '@/data/traits'
import { clamp } from './rng'

// ============================================================
// 빌드별 스킬 자동 발동 확률 (밸런스 튜닝)
//
// 설계 원칙:
//   - 똥템(저속·저공·노말·하급)일수록 스킬 발동률 ↑ → 보상
//   - 강템(고속·고공·레전드·특별)일수록 스킬 발동률 ↓ → 평타 위주
//   - 게이지가 빠르게 차오르는 무기는 발동률 낮음(평타로 누적뎀)
//   - 게이지가 느린 무기는 발동률 높음(한 방 강하게)
//   - 행운은 발동률을 살짝 끌어올림 (procChance × (1 + 행운 × 0.005))
//
// 부록 D 빌드 등급표 기준:
//   S (양날도끼 234틱) → 0.70 (스매쉬 ×2.0 활용도 ↑)
//   S (마도서 73틱)    → 0.45 (마공 대량, 평타도 쎄서 적당)
//   A (창 230틱)       → 0.40 (피어스 ×1.0 + 관통)
//   C (단검 빠른 평타) → 0.20 (연속공격 무거움 → 평타로)
// ============================================================

export const WEAPON_SKILL_PROC: Record<string, number> = {
  // 속도형 (6~9틱) — 평타 누적, 스킬 발동 ↓
  건틀릿: 0.18,
  단검: 0.22,
  사슬낫: 0.30,
  완드: 0.25,
  숏보우: 0.25,

  // 균형형 (10~13틱)
  검: 0.35,
  창: 0.40,
  철퇴: 0.50,
  스태프: 0.40,
  롱보우: 0.40,

  // 중량형 (14~20틱) — 한 방 위주, 스킬 발동 ↑
  대검: 0.55,
  양날도끼: 0.65,
  할버드: 0.70,
  마도서: 0.55,
  석궁: 0.50,
}

export function lookupWeaponProc(baseKey: string): number {
  return WEAPON_SKILL_PROC[baseKey] ?? 0.30
}

// ============================================================
// 등급 / 특성 등급 보정 (똥템 보상)
// ============================================================

export const GRADE_PROC_MOD: Record<Grade, number> = {
  노말: +0.10,
  레어: +0.05,
  스페셜: 0.0,
  레전드: -0.05,
}

export const TRAIT_TIER_PROC_MOD: Record<TraitTier, number> = {
  하급: +0.05,
  보통: 0.0,
  희귀: -0.03,
  특별: -0.05,
}

// ============================================================
// 갑옷 자동 방어 스킬 확률 (조건부 트리거)
// ============================================================

export interface ArmorAutoTrigger {
  /** 발동 베이스 확률 */
  baseChance: number
  /** HP 비율 임계 (이하일 때 발동) — undefined = 무조건 */
  hpThreshold?: number
  /** 적 게이지 임계 (이상일 때 발동) — undefined = 무조건 */
  monsterGaugeThreshold?: number
}

export const ARMOR_AUTO_TRIGGER: Record<string, ArmorAutoTrigger> = {
  // 가죽갑 (회피): 적이 곧 때릴 때 우선 발동
  가죽갑: { baseChance: 0.45, monsterGaugeThreshold: 70 },
  // 로브 (방어): HP 위험할 때 발동 (반사 효과 강력)
  로브: { baseChance: 0.55, hpThreshold: 0.50 },
}

// ============================================================
// 최종 발동률 계산
// ============================================================

export interface ProcContext {
  player: Character
  monster: { actionGauge: number; isBoss: boolean; isMimic: boolean }
  luck: number
}

/**
 * 무기 스킬 자동 발동률 계산.
 *
 * @returns 0.0~0.95 사이의 확률
 */
export function computeWeaponSkillProc(c: Character, luck: number): number {
  if (!c.weapon) return 0
  const base = lookupWeaponProc(c.weapon.baseKey)
  const gradeMod = GRADE_PROC_MOD[c.weapon.grade] ?? 0
  const traitDef = WEAPON_TRAITS[c.weapon.trait]
  const traitMod = traitDef ? (TRAIT_TIER_PROC_MOD[traitDef.tier] ?? 0) : 0

  // 보스/엘리트 가산 (긴 전투 = 스킬 가치 ↑)
  const luckBonus = 1 + luck * 0.005

  const raw = (base + gradeMod + traitMod) * luckBonus
  return clamp(raw, 0.05, 0.85)
}

/**
 * 갑옷 자동 방어 스킬 발동 시도.
 * 조건(HP/적 게이지)을 통과한 경우에만 베이스 확률을 반환.
 */
export function computeArmorAutoProc(ctx: ProcContext): number {
  const armor = ctx.player.armor
  if (!armor) return 0
  const trig = ARMOR_AUTO_TRIGGER[armor.baseKey]
  if (!trig) return 0

  // 조건 체크
  if (trig.hpThreshold !== undefined) {
    const hpRatio = ctx.player.hp / Math.max(1, ctx.player.maxHp)
    if (hpRatio > trig.hpThreshold) return 0
  }
  if (trig.monsterGaugeThreshold !== undefined) {
    if (ctx.monster.actionGauge < trig.monsterGaugeThreshold) return 0
  }

  // 갑옷 등급 보정
  const gradeMod = GRADE_PROC_MOD[armor.grade] ?? 0
  const luckBonus = 1 + ctx.luck * 0.005
  return clamp((trig.baseChance + gradeMod) * luckBonus, 0.05, 0.90)
}
