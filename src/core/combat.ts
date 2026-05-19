import type {
  Character, MonsterInstance, StatusKind, ChapterState, MonsterTemplate,
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

export interface LogEntry {
  text: string
  kind: LogKind
  tick: number
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

export function makeMonster(template: MonsterTemplate, chapter: number, kind: 'normal' | 'boss' | 'mimic'): MonsterInstance {
  let baseline
  if (kind === 'boss') baseline = getBossBaseline(chapter)
  else if (kind === 'mimic') baseline = getMimicBaseline(chapter)
  else baseline = getNormalMonsterBaseline(chapter)

  const hp = Math.round(baseline.hp * (template.hpMod ?? 1.0))
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
    isBoss: kind === 'boss',
    isMimic: kind === 'mimic',
    statuses: [],
    actionGauge: 0,
  }
}

export function createCombatContext(player: Character, monsters: MonsterInstance | MonsterInstance[]): CombatContext {
  const arr = Array.isArray(monsters) ? monsters : [monsters]
  const ctx: CombatContext = {
    player,
    monsters: arr,
    tick: 0,
    log: [],
    buffs: new Map(),
    ended: false,
    victory: false,
  }
  // trait onSpawn 발화 (HP/스탯 보정 등)
  for (const m of arr) dispatchOnSpawn(ctx, m)
  return ctx
}

export function pushLog(ctx: CombatContext, text: string, kind: LogKind = 'info') {
  ctx.log.push({ text, kind, tick: ctx.tick })
  // 최근 200개만 유지
  if (ctx.log.length > 200) ctx.log.shift()
}

// 플레이어 HP 회복 시 살아있는 적의 회복 간섭 trait 효과를 반영한다.
// raw: 트레잇 보정 전 원본 회복량. 반환값: 실제로 적용해야 할 회복량 (음수면 데미지 처리).
//
// 효과:
//   heal_reduction  (구울)    : ×0.5
//   heal_pollution  (역병 쥐) : ×0.3 (오염 — 더 강함)
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

// 3.3 명중 공식
export function rollHit(accuracy: number, evasion: number, blindMod: number = 0): boolean {
  const acc = accuracy + blindMod
  const chance = clamp(0.85 + (acc - evasion) * 0.01, 0.30, 0.95)
  return Math.random() < chance
}

// 3.2 크리티컬 굴림
export function rollCrit(luck: number): { isCrit: boolean; multiplier: number } {
  const critChance = clamp(luck * 0.05 + 0.05, 0, 0.95)
  if (Math.random() < critChance) {
    return { isCrit: true, multiplier: 2.0 }
  }
  return { isCrit: false, multiplier: 1.0 }
}

// 합계 활성 버프
function activeBuff(ctx: CombatContext): TempBuff {
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
}

export function computeDamage(
  attackerStats: { 공격력: number; 행운: number; 관통: number },
  defender: { 방어: number },
  opts: DamageOptions = {}
): { dmg: number; isCrit: boolean } {
  const { multiplier = 1.0, penBoost = 1.0, ignoreCrit = false } = opts

  const effectiveAtk = attackerStats.공격력 * multiplier
  // LOL 방어 공식 (게임 스케일 맞춤): damage = atk × K / (K + def)
  // 우리 게임 평균 effective_def 20~50 — LOL의 K=100 → K=25
  //   def 0   → 100% dmg
  //   def 25  → 50% (균등 시작 + 무방어)
  //   def 50  → 33% (균형 빌드)
  //   def 100 → 20% (방어 빌드)
  //   def 200 → 11% (탱커 빌드)
  //   def 500 → 4.8% (극한, 절대 0 아님)
  const DEF_K = 30
  const effectiveDef = Math.max(0, defender.방어 - attackerStats.관통 * penBoost)
  let dmg = Math.max(1, effectiveAtk * DEF_K / (DEF_K + effectiveDef))

  let isCrit = false
  if (!ignoreCrit) {
    const c = rollCrit(attackerStats.행운)
    isCrit = c.isCrit
    dmg = Math.round(dmg * c.multiplier)
  }

  return { dmg, isCrit }
}

// 플레이어 일반 공격 (자동 첫 살아있는 적 타겟)
export function playerBasicAttack(ctx: CombatContext) {
  const target = currentTarget(ctx)
  if (!target) return
  const eff = computeEffectiveStats(ctx.player)
  const buff = activeBuff(ctx)
  const blindMod = getAccuracyModifier(ctx.player)

  // 명중 굴림
  if (!rollHit(eff.명중률 + (buff.accBonus ?? 0), 0, blindMod)) {
    pushLog(ctx, `공격이 빗나갔다.`, 'miss')
    return
  }

  const { dmg, isCrit } = computeDamage(
    { 공격력: eff.공격력, 행운: eff.행운, 관통: eff.관통 },
    { 방어: target.def },
    {}
  )

  // 감전 보너스
  const shockMult = getDamageTakenModifier(target)
  const finalDmg = Math.round(dmg * shockMult)

  target.hp -= finalDmg
  target._hitsTaken = (target._hitsTaken ?? 0) + 1
  if (isCrit) {
    pushLog(ctx, `⚡ 크리티컬! ${target.template.name}에게 ${finalDmg} 데미지`, 'critical')
  } else {
    pushLog(ctx, `${target.template.name}에게 ${finalDmg} 데미지`, 'damage')
  }
  // 피격음 (몬스터 카테고리 기반) — 살아있을 때만, 사망음은 별도
  if (target.hp > 0) playMonsterHit(target)

  // 흡혈
  if (eff.lifesteal > 0) {
    const heal = applyHealing(ctx, Math.round(finalDmg * eff.lifesteal))
    if (heal > 0) {
      ctx.player.hp = Math.min(ctx.player.maxHp, ctx.player.hp + heal)
      pushLog(ctx, `흡혈로 HP +${heal}`, 'heal')
    } else if (heal < 0) {
      ctx.player.hp = Math.max(0, ctx.player.hp + heal)
    }
  }

  // 트레잇 기반 상태이상 발동 (무기) — 현재 타겟에 적용
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
        pushLog(ctx, `${target.template.name}에게 ${kind} 발동!`, 'status')
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

  if (!rollHit(0, eff.회피율 + (buff.evaBonus ?? 0), blindMod)) {
    pushLog(ctx, `${attacker.template.name}의 공격을 회피했다.`, 'miss')
    attacker._attacksMade = (attacker._attacksMade ?? 0) + 1
    return
  }

  const defMult = buff.defMult ?? 1
  let effDef = eff.방어력_effective * defMult
  // trait: 마법 공격자는 플레이어 방어를 절반만 적용 (S1-Q1 결정)
  if (attacker.template.trait === 'magic_attacker') {
    effDef *= 0.5
  }
  // LOL 방어 공식 (게임 스케일 K=25): damage = atk × 25 / (25 + def)
  const DEF_K = 30
  const finalDmg = Math.max(1, Math.round(attacker.atk * DEF_K / (DEF_K + Math.max(0, effDef))))

  // 갑옷 데미지 흡혈 (피격 시 HP 회복)
  if (eff.damageTakenHealPct > 0) {
    const heal = applyHealing(ctx, Math.round(finalDmg * eff.damageTakenHealPct))
    if (heal > 0) {
      ctx.player.hp = Math.min(ctx.player.maxHp, ctx.player.hp + heal)
      pushLog(ctx, `피해 흡수 +${heal}`, 'heal')
    } else if (heal < 0) {
      ctx.player.hp = Math.max(0, ctx.player.hp + heal)
    }
  }

  ctx.player.hp = Math.max(0, ctx.player.hp - finalDmg)
  pushLog(ctx, `${attacker.template.name}의 공격! ${finalDmg} 피해`, 'enemy')

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
  for (const m of ctx.monsters) {
    if (m.hp <= 0) continue
    const mTick = tickStatuses(m, ctx.tick)
    if (mTick.damageTaken > 0) {
      m.hp = Math.max(0, m.hp - mTick.damageTaken)
      for (const ev of mTick.dotEvents) {
        pushLog(ctx, `${m.template.name}: ${ev.kind} ${ev.stacks}스택 -${ev.dmg}`, 'status')
      }
    }
    // trait: 환경 오라/차징 등 매 틱 효과
    dispatchOnTickStart(ctx, m)
  }

  // 자해 (저주의 트레잇)
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

  // 게이지 누적 (플레이어)
  const speedMod = getSpeedModifier(ctx.player)
  const playerSpeed = eff.속도 * speedMod * eff.weaponSpeedCoef
  ctx.player.actionGauge += playerSpeed

  // 각 몬스터 게이지 누적
  for (const m of ctx.monsters) {
    if (m.hp <= 0) continue
    const monsterSpeedMod = getSpeedModifier(m)
    m.actionGauge += m.speed * monsterSpeedMod * 1.0
  }

  checkPlayerDeath(ctx)
  if (!ctx.ended) checkMonsterDeath(ctx)
}

export interface ActionReady {
  player: boolean
  // 게이지 100 도달한 살아있는 몬스터들
  readyMonsters: MonsterInstance[]
}

export function checkActionReady(ctx: CombatContext): ActionReady {
  return {
    player: ctx.player.actionGauge >= 100,
    readyMonsters: ctx.monsters.filter((m) => m.hp > 0 && m.actionGauge >= 100),
  }
}

export function consumeAction(actor: { actionGauge: number }) {
  actor.actionGauge -= 100
}
