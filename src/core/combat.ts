import type {
  Character, MonsterInstance, StatusKind, ChapterState, MonsterTemplate, TraitQuirkId,
} from '@/types'
import { computeEffectiveStats, type EffectiveStats } from './stats'
import { applyStatus, getAccuracyModifier, getDamageTakenModifier, getSpeedModifier, tickStatuses } from './status'
import { clamp, randFloat, randInt } from './rng'
import { getNormalMonsterBaseline, getBossBaseline, getMimicBaseline } from '@/data/chapters'
import type { LogKind } from '@/ui/colors'
import {
  dispatchOnSpawn,
  dispatchOnBeforeAttack,
  dispatchOnAfterAttacked,
  dispatchOnPlayerHit,
  dispatchOnTickStart,
  dispatchOnHpThreshold,
  dispatchOnDeath,
} from './monsterTraits'
import { playMonsterHit, playMonsterDeath } from './monsterSfx'
import { getPlayerSynergy, isBrokenArmorActive } from './junkSynergy'
import { t as i18nT, td as i18nTd, tLabel as i18nTLabel } from '@/lib/i18n'

export interface LogEntry {
  text: string
  kind: LogKind
  tick: number
}

export interface CombatBadgeEvent {
  id: number
  target: 'player' | 'monster'
  monsterIdx?: number
  text: string
  tone: 'gold' | 'cyan' | 'rose'
}

export interface CombatContext {
  player: Character
  // 다수 몬스터 지원 — 길이 1 이상. 죽은 몬스터도 남아 (UI 표시 + 결산용)
  monsters: MonsterInstance[]
  tick: number
  log: LogEntry[]
  buffs: Map<string, { duration: number; effect: TempBuff }>  // 일시 버프 (방어 스킬 등)
  ended: boolean
  victory: boolean
  // PVP 전투 (위기 모험가 / 탐욕 수집가) — 챌린지 트래커가 참조
  isPvp?: boolean
  // 진짜 보스 클리어 누적 횟수 — 소환 몬스터의 HP×(1+0.9×N) 보정에 사용. 시뮬레이션은 0.
  realBossClearCount?: number
  // ── v11: 시간의 파동 (전투 1버튼 능동 개입) ──
  surgeGauge: number
  surgeNextAttackMult?: number
  surgeDefTicks?: number
  // ── v11: 똥템 허점 공략 런타임 상태 ──
  oldWeaponMissStacks?: number
  heavyArmorPenBonus?: number
  brokenArmorNotified?: boolean
  // ── v11: 프롤로그 균열 조우전 (15틱 또는 HP 1 보호 종료) ──
  isPrologueRift?: boolean
  // ── v11: UI 배지 팝업 & 허점 최초 발견 콜백 ──
  badges: CombatBadgeEvent[]
  _badgeSeq?: number
  onQuirkTriggered?: (quirk: TraitQuirkId) => void
}

// 현재 타겟 (첫 살아있는 몬스터). 모두 죽었으면 null
export function currentTarget(ctx: CombatContext): MonsterInstance | null {
  return ctx.monsters.find((m) => m.hp > 0) ?? null
}

// 살아있는 적 리스트
export function aliveMonsters(ctx: CombatContext): MonsterInstance[] {
  return ctx.monsters.filter((m) => m.hp > 0)
}

interface TempBuff {
  defMult?: number     // 방어 스킬: × 2
  accBonus?: number    // 회피 스킬
  evaBonus?: number
  reflect?: number     // 받은 dmg % 반사
  mdefBonus?: number   // 배리어
  statusResistMult?: number
}

// 진짜 보스 클리어 1회마다 모든 몬스터 HP +90% 누적. 0회: ×1.0, 1회: ×1.9, 2회: ×2.8 ...
// 호출 측이 meta.realBossClearCount 를 그대로 넘기면 됨. 시뮬레이션 코드는 기본값(0) 사용.
export function makeMonster(template: MonsterTemplate, chapter: number, kind: 'normal' | 'boss' | 'mimic', realBossClearCount: number = 0): MonsterInstance {
  let baseline
  if (kind === 'boss') baseline = getBossBaseline(chapter)
  else if (kind === 'mimic') baseline = getMimicBaseline(chapter)
  else baseline = getNormalMonsterBaseline(chapter)

  const hpMult = 1 + 0.9 * Math.max(0, realBossClearCount)
  const hp = Math.round(baseline.hp * (template.hpMod ?? 1.0) * hpMult)
  const atk = baseline.atk * (template.atkMod ?? 1.0)
  const def = baseline.def * (template.defMod ?? 1.0)
  const speed = template.speedOverride ?? baseline.speed

  return {
    template,
    hp,
    maxHp: hp,
    atk,
    def,
    speed,
    ticks: baseline.ticks,
    acc: baseline.acc,
    eva: baseline.eva,
    isBoss: kind === 'boss',
    isMimic: kind === 'mimic',
    statuses: [],
    actionGauge: 0,
  }
}

export function createCombatContext(
  player: Character,
  monsters: MonsterInstance | MonsterInstance[],
  realBossClearCount: number = 0,
  opts?: { initialSurgeGauge?: number; isPrologueRift?: boolean; onQuirkTriggered?: (quirk: TraitQuirkId) => void }
): CombatContext {
  const arr = Array.isArray(monsters) ? monsters : [monsters]
  const ctx: CombatContext = {
    player,
    monsters: arr,
    tick: 0,
    log: [],
    buffs: new Map(),
    ended: false,
    victory: false,
    realBossClearCount,
    surgeGauge: clamp(opts?.initialSurgeGauge ?? 0, 0, 100),
    isPrologueRift: opts?.isPrologueRift,
    badges: [],
    _badgeSeq: 0,
    onQuirkTriggered: opts?.onQuirkTriggered,
  }
  // trait onSpawn 발화 (HP/스탯 보정 등)
  for (const m of arr) dispatchOnSpawn(ctx, m)
  return ctx
}

export function pushBadge(
  ctx: CombatContext,
  target: 'player' | 'monster',
  text: string,
  tone: 'gold' | 'cyan' | 'rose' = 'gold',
  monsterIdx?: number
) {
  ctx._badgeSeq = (ctx._badgeSeq ?? 0) + 1
  ctx.badges.push({ id: ctx._badgeSeq, target, monsterIdx, text, tone })
  if (ctx.badges.length > 24) ctx.badges.shift()
}

export function chargeSurge(ctx: CombatContext, baseAmount: number) {
  if (ctx.ended || baseAmount <= 0) return
  const syn = getPlayerSynergy(ctx.player)
  const mult = syn.hasLoopholeMaster ? 1.3 : 1.0
  ctx.surgeGauge = clamp(ctx.surgeGauge + Math.round(baseAmount * mult), 0, 100)
}

// 시간의 파동 (1버튼 능동 개입) 발동
//   manual=true  : 적 게이지 -40%, 플레이어 즉시 행동, 다음 공격 확정 크리 ×1.5, 5틱 피해 -50%
//   manual=false : 적 게이지 -20%, 플레이어 즉시 행동, 다음 공격 확정 크리 ×1.2, 5틱 피해 -50%
export function triggerTimeSurge(ctx: CombatContext, manual: boolean = true): boolean {
  if (ctx.ended || ctx.surgeGauge < 100) return false
  ctx.surgeGauge = 0
  const delayFactor = manual ? 0.6 : 0.8
  for (const m of ctx.monsters) {
    if (m.hp > 0) {
      m.actionGauge = Math.max(0, m.actionGauge * delayFactor)
    }
  }
  const eff = computeEffectiveStats(ctx.player)
  ctx.player.actionGauge = Math.max(ctx.player.actionGauge, eff.무기ticks)
  ctx.surgeNextAttackMult = manual ? 1.5 : 1.2
  ctx.surgeDefTicks = 5
  pushBadge(ctx, 'player', manual ? '⚡ TIME SURGE!' : '⚡ AUTO SURGE', 'cyan')
  pushLog(
    ctx,
    manual
      ? i18nT('log.timeSurgeManual', '⚡ 시간의 파동 발동! 적 행동 지연 & 다음 일격 강화!')
      : i18nT('log.timeSurgeAuto', '⚡ 시간의 파동 (자동) 발동!'),
    'skill'
  )
  return true
}

export function pushLog(ctx: CombatContext, text: string, kind: LogKind = 'info') {
  // 영어 모드면 한국어 라벨을 부분 영문화 (이미 영어인 텍스트는 no-op)
  ctx.log.push({ text: i18nTLabel(text), kind, tick: ctx.tick })
  // 최근 200개만 유지
  if (ctx.log.length > 200) ctx.log.shift()
}

// 플레이어 HP 회복 시 살아있는 적의 회복 간섭 trait 효과를 반영한다.
// raw: 특성 보정 전 원본 회복량. 반환값: 실제로 적용해야 할 회복량 (음수면 데미지 처리).
//
// 효과:
//   heal_reduction  (구울)    : ×0.5
//   heal_pollution  (역병 슬라임) : ×0.3 (오염 — 더 강함)
//   heal_reverse    (보스)    : ×-1  (역전)
//
// 여러 효과가 동시 존재 시 곱셈 누적. 살아있는 적만 영향.
export function applyHealing(ctx: CombatContext, raw: number): number {
  if (raw <= 0) return raw
  let mult = 1
  let reversed = false
  for (const m of ctx.monsters) {
    if (m.hp <= 0) continue
    const t = m.template.trait
    if (t === 'heal_reduction') mult *= 0.5
    else if (t === 'heal_pollution') mult *= 0.3
    else if (t === 'heal_reverse') { mult *= -1; reversed = true }
  }
  if (reversed) {
    // heal_reverse: 회복이 데미지로 전환됨을 로그에 명시 (호출지에서 healAmount 음수 처리)
    pushLog(ctx, `회복 역전: ${raw} → ${Math.abs(Math.round(raw * mult))} 피해`, 'status')
  } else if (mult < 1) {
    pushLog(ctx, `회복 감소: ${raw} → ${Math.round(raw * mult)}`, 'status')
  }
  return Math.round(raw * mult)
}

// v9 명중 공식: 성공률 = clamp((acc - eva) / 100, 0, 1.0)
//   acc/eva 는 %p 단위. 명중 80 vs 회피 10 = 70% 성공.
//   명중/회피는 성공률에만 영향, 데미지에는 영향 X.
export function rollHit(accuracy: number, evasion: number, blindMod: number = 0): boolean {
  const acc = accuracy + blindMod
  const chance = clamp((acc - evasion) / 100, 0, 1.0)
  return Math.random() < chance
}

// v9 크리 굴림
//   확률 = clamp(민첩 × 0.003, 0, 1.0) — 민첩 100 = 30%, 민첩 333 = 100% cap
//   배수 = 1.3 + 행운/100 — 행운 0 = 1.3배, 행운 100 = 2.3배
export function rollCrit(agility: number, luck: number): { isCrit: boolean; multiplier: number } {
  const critChance = clamp(agility * 0.003, 0, 1.0)
  const critMult = 1.3 + luck / 100
  if (Math.random() < critChance) {
    return { isCrit: true, multiplier: critMult }
  }
  return { isCrit: false, multiplier: 1.0 }
}

// 합계 활성 버프
export function activeBuff(ctx: CombatContext): TempBuff {
  const merged: TempBuff = {}
  for (const b of ctx.buffs.values()) {
    if (b.effect.defMult) merged.defMult = Math.max(merged.defMult ?? 1, b.effect.defMult)
    if (b.effect.accBonus) merged.accBonus = (merged.accBonus ?? 0) + b.effect.accBonus
    if (b.effect.evaBonus) merged.evaBonus = (merged.evaBonus ?? 0) + b.effect.evaBonus
    if (b.effect.reflect) merged.reflect = Math.max(merged.reflect ?? 0, b.effect.reflect)
    if (b.effect.mdefBonus) merged.mdefBonus = (merged.mdefBonus ?? 0) + b.effect.mdefBonus
    if (b.effect.statusResistMult) merged.statusResistMult = Math.max(merged.statusResistMult ?? 1, b.effect.statusResistMult)
  }
  return merged
}

// 데미지 공식 — 공격력/방어/관통 통합
export interface DamageOptions {
  multiplier?: number       // 스킬 계수
  penBoost?: number         // 피어스: 관통 배수
  ignoreCrit?: boolean
  forceCrit?: boolean       // 확정 치명타 (시간의 파동 / 오래된 무기 3스택)
  critBonusChance?: number  // 추가 치명타 확률 (다윗의 돌멩이 등)
  ignoreDef?: boolean       // 방어 100% 무시
  flatPenBonus?: number     // 추가 고정 관통 %p
}

export function computeDamage(
  attackerStats: { 공격력: number; 민첩: number; 행운: number; 관통: number },
  defender: { 방어: number },
  opts: DamageOptions = {}
): { dmg: number; isCrit: boolean } {
  const {
    multiplier = 1.0,
    penBoost = 1.0,
    ignoreCrit = false,
    forceCrit = false,
    critBonusChance = 0,
    ignoreDef = false,
    flatPenBonus = 0,
  } = opts

  const effectiveAtk = attackerStats.공격력 * multiplier
  // v9: 방어는 % 단위. 관통은 절대값 차감.
  const penPct = Math.max(0, attackerStats.관통 * penBoost + flatPenBonus)
  const effectiveDefPct = ignoreDef ? 0 : Math.max(0, defender.방어 - penPct) / 100
  let dmg = Math.max(1, effectiveAtk * (1 - effectiveDefPct))

  let isCrit = false
  if (!ignoreCrit) {
    if (forceCrit) {
      isCrit = true
      dmg = Math.round(dmg * (1.3 + attackerStats.행운 / 100))
    } else if (critBonusChance > 0) {
      const chance = clamp(attackerStats.민첩 * 0.003 + critBonusChance, 0, 1.0)
      if (Math.random() < chance) {
        isCrit = true
        dmg = Math.round(dmg * (1.3 + attackerStats.행운 / 100))
      } else {
        dmg = Math.round(dmg)
      }
    } else {
      const c = rollCrit(attackerStats.민첩, attackerStats.행운)
      isCrit = c.isCrit
      dmg = Math.round(dmg * c.multiplier)
    }
  }

  return { dmg, isCrit }
}

// 플레이어 일반 공격 (자동 첫 살아있는 적 타겟)
export function playerBasicAttack(ctx: CombatContext) {
  const target = currentTarget(ctx)
  if (!target) return
  const targetIdx = ctx.monsters.indexOf(target)
  const eff = computeEffectiveStats(ctx.player)
  const buff = activeBuff(ctx)
  const blindMod = getAccuracyModifier(ctx.player)
  const syn = getPlayerSynergy(ctx.player)
  const brokenActive = isBrokenArmorActive(ctx.player, syn.hasLoopholeMaster)

  // 명중 굴림 (시간의 파동 활성화 시 확정 명중)
  const surgeGuaranteedHit = !!(ctx.surgeNextAttackMult && ctx.surgeNextAttackMult > 1)
  if (!surgeGuaranteedHit && !rollHit(eff.명중률 + (buff.accBonus ?? 0), target.eva, blindMod)) {
    pushLog(ctx, i18nT('log.miss', '공격이 빗나갔다.'), 'miss')
    chargeSurge(ctx, 10)
    // 허점 기믹 ①: 오래된 무기 — 빗나갈 때마다 집념 스택 누적 (최대 5)
    if (syn.weaponQuirk === 'old_weapon') {
      ctx.oldWeaponMissStacks = Math.min(5, (ctx.oldWeaponMissStacks ?? 0) + 1)
      pushBadge(ctx, 'player', `집념 ×${ctx.oldWeaponMissStacks}`, 'gold')
      pushLog(ctx, i18nT('log.quirkOldStack', `💡 [허점] 오래된 무기 집념 ×${ctx.oldWeaponMissStacks} 누적!`, { n: ctx.oldWeaponMissStacks }), 'status')
      ctx.onQuirkTriggered?.('old_weapon')
    }
    return
  }

  let atkMult = 1.0
  let forceCrit = false
  let ignoreDef = false
  let flatPenBonus = 0
  let critBonusChance = 0

  // 허점 기믹 ⑥: 부서진 갑옷 — 딸피 폭주 (공격력 +50%)
  if (brokenActive) {
    atkMult *= 1 + 0.5 * syn.loopholeMult
    if (!ctx.brokenArmorNotified) {
      ctx.brokenArmorNotified = true
      pushBadge(ctx, 'player', '허점: 배수진!', 'gold')
      ctx.onQuirkTriggered?.('broken_armor')
    }
  }

  // 허점 기믹 ⑤ 연계: 무거운 갑옷 강타 반사 후 다음 공격 관통 +40%
  if (ctx.heavyArmorPenBonus && ctx.heavyArmorPenBonus > 0) {
    flatPenBonus += ctx.heavyArmorPenBonus
    ctx.heavyArmorPenBonus = 0
  }

  // 공명: 다윗의 돌멩이 (노말 풀세트 vs 보스)
  if (syn.hasDavidStone && target.isBoss) {
    critBonusChance += 0.25
    flatPenBonus += 30
  }

  // 허점 기믹 ①: 오래된 무기 — 누적된 집념 스택 폭발
  if (syn.weaponQuirk === 'old_weapon' && (ctx.oldWeaponMissStacks ?? 0) > 0) {
    const stacks = ctx.oldWeaponMissStacks!
    ctx.oldWeaponMissStacks = 0
    atkMult *= 1 + stacks * 0.6 * syn.loopholeMult
    const critThreshold = syn.hasLoopholeMaster ? 2 : 3
    if (stacks >= critThreshold) {
      forceCrit = true
      ignoreDef = true
    }
    pushBadge(ctx, 'monster', `허점: 집념 ×${stacks}!`, 'gold', targetIdx)
    pushLog(ctx, i18nT('log.quirkOldRelease', `💥 [허점 공략] 오래된 무기 집념 ×${stacks} 폭발!`, { n: stacks }), 'critical')
    ctx.onQuirkTriggered?.('old_weapon')
  }

  // 허점 기믹 ③: 무거운 무기 — 적 게이지 70%(공명 60%)↑ 시 카운터 격돌 + 턴 캔슬
  if (syn.weaponQuirk === 'heavy_weapon') {
    const ratio = target.actionGauge / Math.max(1, target.ticks)
    const threshold = syn.hasLoopholeMaster ? 0.6 : 0.7
    if (ratio >= threshold) {
      atkMult *= 2.2 * (syn.hasLoopholeMaster ? 1.15 : 1.0)
      target.actionGauge = 0
      pushBadge(ctx, 'monster', '허점: 턴 캔슬!', 'gold', targetIdx)
      pushLog(ctx, i18nT('log.quirkHeavyCancel', '💥 [허점 공략] 무거운 무기 카운터 격돌 — 적 행동 취소!'), 'critical')
      ctx.onQuirkTriggered?.('heavy_weapon')
    }
  }

  // 시간의 파동 다음 공격 강화
  if (ctx.surgeNextAttackMult && ctx.surgeNextAttackMult > 1) {
    atkMult *= ctx.surgeNextAttackMult
    forceCrit = true
    ctx.surgeNextAttackMult = undefined
  }

  const { dmg, isCrit } = computeDamage(
    { 공격력: eff.공격력, 민첩: eff.민첩, 행운: eff.행운, 관통: eff.관통 },
    { 방어: target.def },
    { multiplier: atkMult, forceCrit, critBonusChance, ignoreDef, flatPenBonus }
  )

  // 감전 보너스
  const shockMult = getDamageTakenModifier(target)
  let finalDmg = Math.round(dmg * shockMult)

  // 허점 기믹 ②: 녹슨 무기 — 적 방어% 비례 방어 무시 고정 피해 + 독 20%
  if (syn.weaponQuirk === 'rust_weapon') {
    const defTrueDmg = Math.round(eff.공격력 * (Math.max(0, target.def) / 100) * 1.5 * syn.loopholeMult)
    if (defTrueDmg > 0) {
      finalDmg += defTrueDmg
      pushBadge(ctx, 'monster', `부식 +${defTrueDmg}`, 'gold', targetIdx)
      pushLog(ctx, i18nT('log.quirkRustWeapon', `💡 [허점 공략] 녹슨 무기 부식 고정 피해 +${defTrueDmg}`, { dmg: defTrueDmg }), 'status')
      ctx.onQuirkTriggered?.('rust_weapon')
    }
    if (Math.random() < clamp(0.20 * syn.loopholeMult, 0, 0.8)) {
      applyStatus(target, '독', eff.공격력, ctx.tick, 0)
    }
  }

  target.hp -= finalDmg
  target._hitsTaken = (target._hitsTaken ?? 0) + 1
  chargeSurge(ctx, isCrit ? 18 : 12)
  const _tn = i18nTd('monster', target.template.name)
  if (isCrit) {
    pushLog(ctx, i18nT('log.crit', `⚡ 크리티컬! ${_tn}에게 ${finalDmg} 데미지`, { name: _tn, dmg: finalDmg }), 'critical')
  } else {
    pushLog(ctx, i18nT('log.dmg', `${_tn}에게 ${finalDmg} 데미지`, { name: _tn, dmg: finalDmg }), 'damage')
  }
  // 피격음 (몬스터 카테고리 기반) — 살아있을 때만, 사망음은 별도
  if (target.hp > 0) playMonsterHit(target)

  // 흡혈
  if (eff.lifesteal > 0) {
    const heal = applyHealing(ctx, Math.round(finalDmg * eff.lifesteal))
    if (heal > 0) {
      ctx.player.hp = Math.min(ctx.player.maxHp, ctx.player.hp + heal)
      pushLog(ctx, i18nT('log.lifesteal', `흡혈로 HP +${heal}`, { hp: heal }), 'heal')
    } else if (heal < 0) {
      ctx.player.hp = Math.max(0, ctx.player.hp + heal)
    }
  }

  // 특성 기반 상태이상 발동 (무기) — 현재 타겟에 적용
  rollStatusProcs(ctx, eff, target)

  // trait: 피격 후 훅 (반사 등) + 페이즈 임계값 체크
  dispatchOnAfterAttacked(ctx, target, finalDmg, { isMagic: false, isPhysical: true })
  dispatchOnHpThreshold(ctx, target)

  checkMonsterDeath(ctx)
}

function rollStatusProcs(ctx: CombatContext, eff: EffectiveStats, target: MonsterInstance) {
  const luckBonus = 1 + eff.행운 * 0.005
  const tryProc = (chance: number, kind: StatusKind, atkSrc: number) => {
    if (chance <= 0) return
    const finalChance = clamp(chance * luckBonus, 0, 0.95)
    if (Math.random() < finalChance) {
      const ok = applyStatus(target, kind, atkSrc, ctx.tick, 0)
      if (ok) {
        const _tn2 = i18nTd('monster', target.template.name)
        const _sn = i18nTd('status', kind)
        pushLog(ctx, i18nT('log.statusProc', `${_tn2}에게 ${_sn} 발동!`, { name: _tn2, status: _sn }), 'status')
      }
    }
  }
  // 마법공격 기반 발동은 마공 스냅샷, 그 외는 물공
  tryProc(eff.burnChance, '점화', eff.공격력)
  tryProc(eff.slowChance, '둔화', eff.공격력)
  tryProc(eff.shockChance, '감전', eff.공격력)
  tryProc(eff.bleedChance, '출혈', eff.공격력)
  tryProc(eff.blindChance, '암흑', eff.공격력)
  tryProc(eff.poisonChance, '독', eff.공격력)
}

// 적의 공격 (지정 attacker)
export function monsterAttack(ctx: CombatContext, attacker: MonsterInstance) {
  if (attacker.hp <= 0) return

  // trait: 공격 직전 훅 (custom action 으로 평타 스킵 가능)
  const before = dispatchOnBeforeAttack(ctx, attacker)
  if (before.skipBasicAttack) {
    attacker._attacksMade = (attacker._attacksMade ?? 0) + 1
    return
  }

  const eff = computeEffectiveStats(ctx.player)
  const buff = activeBuff(ctx)
  const blindMod = getAccuracyModifier(attacker)
  const syn = getPlayerSynergy(ctx.player)
  const brokenActive = isBrokenArmorActive(ctx.player, syn.hasLoopholeMaster)
  const attackerIdx = ctx.monsters.indexOf(attacker)

  const extraEva = brokenActive ? 35 * syn.loopholeMult : 0
  if (!rollHit(attacker.acc, eff.회피율 + (buff.evaBonus ?? 0) + extraEva, blindMod)) {
    const _an = i18nTd('monster', attacker.template.name)
    pushLog(ctx, i18nT('log.dodge', `${_an}의 공격을 회피했다.`, { name: _an }), 'miss')
    pushBadge(ctx, 'player', brokenActive ? '허점: 회피!' : 'DODGE!', brokenActive ? 'gold' : 'cyan')
    if (brokenActive) ctx.onQuirkTriggered?.('broken_armor')
    chargeSurge(ctx, 10)
    attacker._attacksMade = (attacker._attacksMade ?? 0) + 1
    return
  }

  const defMult = buff.defMult ?? 1
  let effDefPct = eff.방어력_effective * defMult
  // trait: 마법 공격자는 플레이어 방어를 절반만 적용 (S1-Q1 결정)
  if (attacker.template.trait === 'magic_attacker') {
    effDefPct *= 0.5
  }
  // v9: 방어는 % 단위 — 받는 데미지 = atk × (1 - def%/100), 최소 1
  let finalDmg = Math.max(1, Math.round(attacker.atk * (1 - Math.max(0, effDefPct) / 100)))

  // 배리어 스킬 (mdefBonus)
  if (buff.mdefBonus) {
    finalDmg = Math.max(1, finalDmg - Math.round(buff.mdefBonus))
  }

  // 시간의 파동 방어 버프 (5틱간 받는 피해 50% 감소)
  if (ctx.surgeDefTicks && ctx.surgeDefTicks > 0) {
    finalDmg = Math.max(1, Math.round(finalDmg * 0.5))
  }

  // 갑옷 자동 반응 (피격 시 확률 발동: 가죽갑 회피 / 로브 방어 / 판금 철벽)
  const armorKey = ctx.player.armor?.baseKey
  const armorReactChance = clamp((0.10 + eff.행운 * 0.005) * (syn.hasLoopholeMaster ? 2 : 1), 0, 0.85)
  if (armorKey && Math.random() < armorReactChance) {
    const _an2 = i18nTd('monster', attacker.template.name)
    if (armorKey === '가죽갑') {
      pushLog(ctx, i18nT('log.leatherDodge', `${_an2}의 공격! 가죽갑 회피 발동 — 완전 회피`, { name: _an2 }), 'miss')
      pushBadge(ctx, 'player', 'DODGE!', 'cyan')
      chargeSurge(ctx, 10)
      attacker._attacksMade = (attacker._attacksMade ?? 0) + 1
      return
    } else if (armorKey === '로브') {
      const target = Math.round(finalDmg * 0.5)
      const actual = Math.min(ctx.player.mp, target)
      ctx.player.mp -= actual
      finalDmg = Math.max(1, finalDmg - actual)
      if (actual > 0) {
        pushBadge(ctx, 'player', 'SHIELD!', 'cyan')
        pushLog(ctx, i18nT('log.robeBlock', `로브 방어 발동! MP -${actual}, 피해 ${actual} 차감`, { mp: actual, dmg: actual }), 'heal')
      }
    } else if (armorKey === '판금') {
      const counter = Math.max(1, Math.round(eff.공격력 * 0.5))
      attacker.hp = Math.max(0, attacker.hp - counter)
      pushBadge(ctx, 'monster', `COUNTER -${counter}`, 'cyan', attackerIdx)
      pushLog(ctx, i18nT('log.plateCounter', `판금 철벽 발동! ${_an2}에게 카운터 ${counter} 피해`, { name: _an2, dmg: counter }), 'damage')
    }
  }

  // 갑옷 데미지 흡혈 (피격 시 HP 회복)
  if (eff.damageTakenHealPct > 0) {
    const heal = applyHealing(ctx, Math.round(finalDmg * eff.damageTakenHealPct))
    if (heal > 0) {
      ctx.player.hp = Math.min(ctx.player.maxHp, ctx.player.hp + heal)
      pushLog(ctx, i18nT('log.dmgAbsorb', `피해 흡수 +${heal}`, { hp: heal }), 'heal')
    } else if (heal < 0) {
      ctx.player.hp = Math.max(0, ctx.player.hp + heal)
    }
  }

  // 프롤로그 균열 조우전에서는 사망하지 않고 HP 1에서 꿈으로 강제 귀환
  if (ctx.isPrologueRift && ctx.player.hp - finalDmg <= 1) {
    ctx.player.hp = 1
    ctx.ended = true
    ctx.victory = false
    pushLog(ctx, i18nT('log.prologueRetreat', '⏳ 시간의 신이 당신을 균열에서 끌어냈습니다...'), 'skill')
    return
  }

  ctx.player.hp = Math.max(0, ctx.player.hp - finalDmg)
  chargeSurge(ctx, 16)
  const _an3 = i18nTd('monster', attacker.template.name)
  pushLog(ctx, i18nT('log.enemyAtk', `${_an3}의 공격! ${finalDmg} 피해`, { name: _an3, dmg: finalDmg }), 'enemy')

  // 허점 기믹 ④: 녹슨 갑옷 — 피격 시 독+출혈 반격 & 상태이상 적에게 스택 비례 반격
  if (syn.armorQuirk === 'rust_armor' && attacker.hp > 0) {
    const existingStacks = attacker.statuses.reduce((acc, s) => acc + s.stacks, 0)
    if (existingStacks > 0) {
      const dotCounter = Math.max(1, Math.round(attacker.maxHp * 0.02 * existingStacks * syn.loopholeMult))
      attacker.hp = Math.max(0, attacker.hp - dotCounter)
      pushBadge(ctx, 'monster', `파상풍 -${dotCounter}`, 'gold', attackerIdx)
      pushLog(ctx, i18nT('log.quirkRustArmor', `💥 [허점 공략] 녹슨 갑옷 파상풍 반격 -${dotCounter}!`, { dmg: dotCounter }), 'status')
      ctx.onQuirkTriggered?.('rust_armor')
      checkMonsterDeath(ctx)
    }
    if (attacker.hp > 0 && Math.random() < clamp(0.35 * syn.loopholeMult, 0, 0.9)) {
      applyStatus(attacker, '독', Math.max(1, eff.공격력), ctx.tick, 0)
      applyStatus(attacker, '출혈', Math.max(1, eff.공격력), ctx.tick, 0)
      pushBadge(ctx, 'monster', '독+출혈!', 'gold', attackerIdx)
      ctx.onQuirkTriggered?.('rust_armor')
    }
  }

  // 허점 기믹 ⑤: 무거운 갑옷 — 단일 피격이 최대 HP 15%(공명 12%)↑이면 초과분 150% 반사 + 다음 공격 관통 +40%
  if (syn.armorQuirk === 'heavy_armor' && attacker.hp > 0 && ctx.player.maxHp > 0) {
    const thresholdDmg = ctx.player.maxHp * (syn.hasLoopholeMaster ? 0.12 : 0.15)
    if (finalDmg >= thresholdDmg) {
      const excess = Math.max(1, finalDmg - Math.round(thresholdDmg * 0.5))
      const counterDmg = Math.max(1, Math.round(excess * 1.5 * syn.loopholeMult))
      attacker.hp = Math.max(0, attacker.hp - counterDmg)
      ctx.heavyArmorPenBonus = Math.round(40 * syn.loopholeMult)
      pushBadge(ctx, 'monster', `강타 반사 -${counterDmg}`, 'gold', attackerIdx)
      pushLog(ctx, i18nT('log.quirkHeavyArmor', `💥 [허점 공략] 무거운 갑옷 강타 반사 -${counterDmg} & 다음 공격 관통 +${ctx.heavyArmorPenBonus}%!`, { dmg: counterDmg, pen: ctx.heavyArmorPenBonus }), 'damage')
      ctx.onQuirkTriggered?.('heavy_armor')
      checkMonsterDeath(ctx)
    }
  }

  // 갑옷 데미지 반사
  if (eff.damageReflectPct > 0 && attacker.hp > 0) {
    const reflect = Math.max(1, Math.round(finalDmg * eff.damageReflectPct))
    attacker.hp = Math.max(0, attacker.hp - reflect)
    pushLog(ctx, i18nT('log.reflect', `데미지 반사: ${_an3}에게 ${reflect} 피해`, { name: _an3, dmg: reflect }), 'status')
    checkMonsterDeath(ctx)
  }

  // trait: 플레이어 피격 후 훅 (블러드 스트라이크 카운트, 챌린지 트래커 진입점)
  attacker._attacksMade = (attacker._attacksMade ?? 0) + 1
  if (finalDmg > 0) dispatchOnPlayerHit(ctx, attacker, finalDmg)

  // 반사 데미지 (방어/패링 버프) — 공격한 적에게 반사
  if (buff.reflect && buff.reflect > 0) {
    const reflect = Math.round(finalDmg * buff.reflect)
    if (reflect > 0) {
      attacker.hp -= reflect
      pushLog(ctx, `반사 데미지 ${reflect}`, 'damage')
      checkMonsterDeath(ctx)
    }
  }

  checkPlayerDeath(ctx)
}

export function checkMonsterDeath(ctx: CombatContext) {
  // 새로 죽은 몬스터: trait onDeath 훅 → 부활 가능
  for (const m of ctx.monsters) {
    if (m.hp <= 0 && !m._deathLogged) {
      // trait: 부활 기회 (revive_chance 등)
      const { revived } = dispatchOnDeath(ctx, m)
      if (revived && m.hp > 0) {
        // onDeath 핸들러가 hp 를 복구한 경우 — 사망 로그 생략하고 계속 진행
        continue
      }
      m._deathLogged = true
      pushLog(ctx, `${m.template.name}을(를) 처치했다!`, 'reward')
      // 몬스터 카테고리별 사망음
      playMonsterDeath(m)
    }
  }
  // 모든 적 사망 시 종료
  if (aliveMonsters(ctx).length === 0) {
    ctx.ended = true
    ctx.victory = true
  }
}

export function checkPlayerDeath(ctx: CombatContext) {
  if (ctx.player.hp <= 0) {
    ctx.ended = true
    ctx.victory = false
    pushLog(ctx, `사망했다...`, 'enemy')
  }
}

// 매 틱 진행: 게이지 누적, 상태이상 처리, 버프 만료
export function advanceTick(ctx: CombatContext) {
  ctx.tick += 1

  // 플레이어 상태이상
  const playerTick = tickStatuses(ctx.player, ctx.tick)
  if (playerTick.damageTaken > 0) {
    ctx.player.hp = Math.max(0, ctx.player.hp - playerTick.damageTaken)
    for (const ev of playerTick.dotEvents) {
      pushLog(ctx, `${ev.kind} ${ev.stacks}스택으로 -${ev.dmg} HP`, 'status')
    }
  }

  // 각 몬스터 상태이상 + trait 매 틱 효과
  const syn = getPlayerSynergy(ctx.player)
  for (const m of ctx.monsters) {
    if (m.hp <= 0) continue
    const mTick = tickStatuses(m, ctx.tick)
    if (mTick.damageTaken > 0) {
      let extraTetanus = 0
      if (syn.hasTetanusSet) {
        for (const ev of mTick.dotEvents) {
          if (ev.kind === '독' || ev.kind === '출혈') {
            extraTetanus += Math.round(ev.dmg * 0.5)
          }
        }
      }
      m.hp = Math.max(0, m.hp - (mTick.damageTaken + extraTetanus))
      for (const ev of mTick.dotEvents) {
        pushLog(ctx, `${m.template.name}: ${ev.kind} ${ev.stacks}스택 -${ev.dmg}`, 'status')
      }
    }
    // trait: 환경 오라/차징 등 매 틱 효과
    dispatchOnTickStart(ctx, m)
  }

  // 자해 (저주의 특성)
  const eff = computeEffectiveStats(ctx.player)
  if (eff.selfDotPct > 0 && ctx.tick % 10 === 0) {
    const dmg = Math.round(ctx.player.maxHp * eff.selfDotPct)
    if (dmg > 0) {
      ctx.player.hp = Math.max(0, ctx.player.hp - dmg)
      pushLog(ctx, `저주의 자해: -${dmg} HP`, 'status')
    }
  }

  // 버프 만료
  for (const [key, b] of ctx.buffs.entries()) {
    b.duration -= 1
    if (b.duration <= 0) ctx.buffs.delete(key)
  }
  if (ctx.surgeDefTicks && ctx.surgeDefTicks > 0) {
    ctx.surgeDefTicks -= 1
  }

  // v9 게이지 누적: 베이스 1/틱 × (1 + 민첩/100) × armorSpeedMult × 상태이상 modifier
  const speedMod = getSpeedModifier(ctx.player)
  const brokenSpeedBoost = isBrokenArmorActive(ctx.player, syn.hasLoopholeMaster)
    ? (1 + 0.25 * syn.loopholeMult)
    : 1.0
  const playerGauge = eff.게이지가속 * eff.armorSpeedMult * speedMod * brokenSpeedBoost
  ctx.player.actionGauge += playerGauge

  // 각 몬스터 게이지 누적 (몬스터는 민첩/갑옷 없음 → 1 × speedMod)
  for (const m of ctx.monsters) {
    if (m.hp <= 0) continue
    const monsterSpeedMod = getSpeedModifier(m)
    m.actionGauge += monsterSpeedMod
  }

  // 프롤로그 균열 조우전은 최대 15틱 후 시간의 신이 꿈속으로 귀환시킴
  if (ctx.isPrologueRift && ctx.tick >= 15) {
    ctx.ended = true
    ctx.victory = false
    pushLog(ctx, i18nT('log.prologueRetreat', '⏳ 시간의 신이 당신을 균열에서 끌어냈습니다...'), 'skill')
    return
  }

  checkPlayerDeath(ctx)
  if (!ctx.ended) checkMonsterDeath(ctx)
}

export interface ActionReady {
  player: boolean
  readyMonsters: MonsterInstance[]
}

// v9: 플레이어 임계값 = 무기 ticks (eff.무기ticks), 몬스터 임계값 = m.ticks
export function checkActionReady(ctx: CombatContext, playerTicks: number): ActionReady {
  return {
    player: ctx.player.actionGauge >= playerTicks,
    readyMonsters: ctx.monsters.filter((m) => m.hp > 0 && m.actionGauge >= m.ticks),
  }
}

// v9: 행동 소모 — 임계값만큼 차감 (오버플로 보존으로 빠른 무기 연속 발동 가능)
export function consumeAction(actor: { actionGauge: number }, threshold: number) {
  actor.actionGauge -= threshold
}
