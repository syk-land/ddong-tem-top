import type { CombatContext } from './combat'
import { computeDamage, pushLog, checkMonsterDeath, rollHit, currentTarget, aliveMonsters, applyHealing, chargeSurge } from './combat'
import { computeEffectiveStats } from './stats'
import { getPlayerSynergy, isBrokenArmorActive } from './junkSynergy'
import { applyStatus, purgeDebuffs } from './status'
import { SKILLS } from '@/data/skills'
import { WEAPONS } from '@/data/weapons'
import { ARMORS } from '@/data/armor'
import { clamp } from './rng'
import type { Character, ItemInstance, MonsterInstance, StatusKind } from '@/types'
import { computeArmorAutoProc, computeWeaponSkillProc } from './buildBalance'
import { dispatchOnAfterAttacked, dispatchOnHpThreshold } from './monsterTraits'
import { playSkillSound } from '@/ui/sound'
import { playMonsterHit } from './monsterSfx'
import { t as i18nT, td as i18nTd } from '@/lib/i18n'

// 스킬 효과는 키별로 직접 처리
export function useSkill(ctx: CombatContext, key: string): boolean {
  const skill = SKILLS[key]
  if (!skill) return false

  // 침묵: silenceUntilTick 까지 스킬 사용 불가
  if (ctx.player.silencedUntilTick !== undefined && ctx.tick < ctx.player.silencedUntilTick) {
    pushLog(ctx, i18nT('log.silenced', `🔇 침묵 상태 — 스킬 사용 불가`), 'info')
    return false
  }

  const eff = computeEffectiveStats(ctx.player)
  let mpCost = skill.mp
  // 마법 무기는 MP 보정 적용
  if (skill.kind === 'magic_atk' || skill.kind === 'magic_def') {
    mpCost = Math.max(0, mpCost + eff.weaponMpBonus)
  }

  if (ctx.player.mp < mpCost) {
    pushLog(ctx, i18nT('log.mpLow', `마력이 부족합니다 (필요 ${mpCost})`, { need: mpCost }), 'info')
    return false
  }
  ctx.player.mp -= mpCost
  const _sname = i18nTd('skill', key) || skill.name
  if (mpCost > 0) pushLog(ctx, i18nT('log.skillUse', `${_sname} 사용 (MP -${mpCost})`, { name: _sname, mp: mpCost }), 'skill')
  // 스킬별 고유 효과음 (없으면 fallback)
  playSkillSound(key, skill.kind)

  switch (key) {
    case '스매쉬':
      attackSkill(ctx, 2.0, { accBonus: -10 })
      break
    case '피어스':
      attackSkill(ctx, 1.0, { penBoost: 2.0 })
      break
    case '연속공격': {
      // v9: 속도 → 민첩 (스탯) 직접 사용. 민첩 20 = +1 hit
      // cap 20 — 정상 게임플레이는 도달 불가하지만 store 강제 조작 시 frame freeze 방지.
      const hits = Math.min(20, 1 + Math.floor(eff.민첩 / 20))
      for (let i = 0; i < hits; i++) {
        const t = currentTarget(ctx)
        if (!t || t.hp <= 0) break
        attackSkill(ctx, 0.7, {})
      }
      break
    }
    case '정밀타격':
      attackSkill(ctx, 1.2, { accBonus: 30, critMultiplier: 2 })
      break
    case '급습':
      attackSkill(ctx, 1.5 * (1 + eff.행운 * 0.03), {})
      break

    case '방어':
      ctx.buffs.set('defense', { duration: 10, effect: { defMult: 2, reflect: 0.5 } })
      pushLog(ctx, '방어 자세 (10틱)', 'skill')
      break
    case '회피':
      ctx.buffs.set('evade', { duration: 10, effect: { evaBonus: 30 } })
      pushLog(ctx, '회피 자세 (10틱)', 'skill')
      break
    case '패링':
      // v9: 속도 → 민첩 직접 사용. defMult = 1 + (민첩×1.0 + 공격력×0.5) / 100
      ctx.buffs.set('parry', {
        duration: 10,
        effect: {
          defMult: 1 + (eff.민첩 * 1.0 + eff.공격력 * 0.5) / 100,
          reflect: 0.5,
        },
      })
      pushLog(ctx, '패링 자세 (10틱)', 'skill')
      break
    case '불굴의의지': {
      const heal = applyHealing(ctx, Math.round(ctx.player.maxHp * 0.05))
      if (heal > 0) {
        ctx.player.hp = Math.min(ctx.player.maxHp, ctx.player.hp + heal)
        pushLog(ctx, `불굴의 의지: HP +${heal}`, 'heal')
      } else if (heal < 0) {
        ctx.player.hp = Math.max(0, ctx.player.hp + heal)
      }
      ctx.buffs.set('iron_will', { duration: 10, effect: { statusResistMult: 30 } })
      break
    }

    // === 마법 스킬: 통합 공격력 사용. 물리 대비 +30~50% 데미지 ===
    //   광역/분산 타겟팅 적용 (단계 2 — 다수 몬스터 의미 부여)
    case '빙결의화살': {
      // 관통: 살아있는 적 앞에서 최대 3마리 일렬 적중
      const alive = aliveMonsters(ctx).slice(0, 3)
      if (alive.length === 0) break
      magicAttackMulti(ctx, alive, 3.4, '둔화', 1.0)
      if (alive.length > 1) pushLog(ctx, `빙결의 화살: ${alive.length}마리 관통`, 'skill')
      break
    }
    case '화염구': {
      // 메인 100% + 스플래시 40%(나머지 적)
      const main = currentTarget(ctx)
      if (!main) break
      magicAttackOnTarget(ctx, main, 6.5, '점화', 0.25)
      const splash = aliveMonsters(ctx).filter((m) => m !== main)
      if (splash.length > 0) {
        pushLog(ctx, `화염구 스플래시: ${splash.length}마리에 화상 비산`, 'skill')
        magicAttackMulti(ctx, splash, 6.5 * 0.4, undefined, 0, { accBonus: 20 })
      }
      break
    }
    case '폭풍칼날': {
      // 3히트 분산: 살아있는 적 <=3 -> 1마리씩 / >=4 -> 무작위 3마리
      const alive = aliveMonsters(ctx)
      if (alive.length === 0) break
      const picks = alive.length <= 3 ? alive : shuffled(alive).slice(0, 3)
      magicAttackMulti(ctx, picks, 1.8, undefined, 0, { accBonus: 50 })
      if (picks.length > 1) pushLog(ctx, `폭풍 칼날: ${picks.length}마리 동시 가격`, 'skill')
      break
    }
    case '바위충격': {
      // 전체 70% 데미지, 둔화는 메인에만
      const main = currentTarget(ctx)
      if (!main) break
      magicAttackOnTarget(ctx, main, 4.8, '둔화', 0.40)
      const rest = aliveMonsters(ctx).filter((m) => m !== main)
      if (rest.length > 0) {
        magicAttackMulti(ctx, rest, 4.8 * 0.7, undefined, 0)
        pushLog(ctx, `바위 충격: 광역 진동`, 'skill')
      }
      break
    }
    case '번개창': {
      // 메인 + 연쇄 2 (확률 60% / 30%), 메인 게이지 -10
      const main = currentTarget(ctx)
      if (!main) break
      magicAttackOnTarget(ctx, main, 5.5, '감전', 0.15)
      main.actionGauge = Math.max(0, main.actionGauge - 10)
      const remaining = aliveMonsters(ctx).filter((m) => m !== main)
      if (remaining.length > 0 && Math.random() < 0.6) {
        const chain1 = remaining[0]
        magicAttackOnTarget(ctx, chain1, 5.5 * 0.5, '감전', 0.10)
        pushLog(ctx, `번개 연쇄 1단: ${chain1.template.name}`, 'skill')
        const remaining2 = remaining.filter((m) => m !== chain1 && m.hp > 0)
        if (remaining2.length > 0 && Math.random() < 0.3) {
          const chain2 = remaining2[0]
          magicAttackOnTarget(ctx, chain2, 5.5 * 0.25, '감전', 0.05)
          pushLog(ctx, `번개 연쇄 2단: ${chain2.template.name}`, 'skill')
        }
      }
      break
    }
    case '그림자일격':
      magicAttack(ctx, 4.6, '암흑', 1.0, { penBoost: 1.5 })
      break
    case '정화의광선': {
      const main = currentTarget(ctx)
      if (main) {
        const isUndeadOrDark = main.template.element === '암흑'
          || /언데드|해골|좀비|구울|리치|강령|망령|뱀파이어|흡혈|어둠|암흑|공허/.test(main.template.name)
        const mult = isUndeadOrDark ? 6.0 : 4.0
        magicAttackOnTarget(ctx, main, mult, undefined, 0)
      }
      const purged = purgeDebuffs(ctx.player)
      if (purged.length > 0) pushLog(ctx, `디버프 ${purged.length}개 정화`, 'heal')
      break
    }

    case '배리어':
      ctx.buffs.set('barrier', { duration: 10, effect: { mdefBonus: eff.공격력 } })
      pushLog(ctx, `배리어 (방어 +${Math.round(eff.공격력)})`, 'skill')
      break
    case '마력충전': {
      const restore = Math.round((eff.행운 + eff.공격력) * 0.3)
      ctx.player.mp = Math.min(ctx.player.maxMp, ctx.player.mp + restore)
      pushLog(ctx, `마력 +${restore}`, 'mp')
      break
    }
    case '저항의결계':
      ctx.buffs.set('resist_ward', { duration: 10, effect: { statusResistMult: 50, defMult: 1.3 } })
      pushLog(ctx, '저항의 결계 (상태저항 +50%p, 방어 ×1.3)', 'skill')
      break

    default:
      pushLog(ctx, `알 수 없는 스킬: ${key}`, 'info')
      return false
  }

  return true
}

function attackSkill(
  ctx: CombatContext,
  multiplier: number,
  opts: { accBonus?: number; penBoost?: number; critMultiplier?: number }
) {
  const target = currentTarget(ctx)
  if (!target) return
  const eff = computeEffectiveStats(ctx.player)
  const syn = getPlayerSynergy(ctx.player)
  const surgeGuaranteedHit = !!(ctx.surgeNextAttackMult && ctx.surgeNextAttackMult > 1)
  if (!surgeGuaranteedHit && !rollHit(eff.명중률 + (opts.accBonus ?? 0), target.eva)) {
    pushLog(ctx, i18nT('log.miss', '공격이 빗나갔다.'), 'miss')
    chargeSurge(ctx, 10)
    return
  }
  let finalMult = multiplier
  let forceCrit = false
  let flatPenBonus = 0
  let critBonusChance = 0
  if (isBrokenArmorActive(ctx.player, syn.hasLoopholeMaster)) {
    finalMult *= 1 + 0.5 * syn.loopholeMult
  }
  if (syn.hasDavidStone && target.isBoss) {
    critBonusChance += 0.25
    flatPenBonus += 30
  }
  if (ctx.heavyArmorPenBonus && ctx.heavyArmorPenBonus > 0) {
    flatPenBonus += ctx.heavyArmorPenBonus
    ctx.heavyArmorPenBonus = 0
  }
  if (ctx.surgeNextAttackMult && ctx.surgeNextAttackMult > 1) {
    finalMult *= ctx.surgeNextAttackMult
    forceCrit = true
    ctx.surgeNextAttackMult = undefined
  }
  const { dmg, isCrit } = computeDamage(
    { 공격력: eff.공격력, 민첩: eff.민첩, 행운: eff.행운, 관통: eff.관통 },
    { 방어: target.def },
    { multiplier: finalMult, penBoost: opts.penBoost ?? 1.0, forceCrit, critBonusChance, flatPenBonus }
  )
  const finalDmg = opts.critMultiplier && isCrit ? Math.round(dmg * (opts.critMultiplier / 2)) : dmg
  target.hp -= finalDmg
  target._hitsTaken = (target._hitsTaken ?? 0) + 1
  chargeSurge(ctx, isCrit ? 18 : 12)
  const _tn = i18nTd('monster', target.template.name)
  if (isCrit) {
    pushLog(ctx, i18nT('log.crit', `⚡ 크리티컬! ${_tn}에게 ${finalDmg} 데미지`, { name: _tn, dmg: finalDmg }), 'critical')
  } else {
    pushLog(ctx, i18nT('log.dmg', `${_tn}에게 ${finalDmg} 데미지`, { name: _tn, dmg: finalDmg }), 'damage')
  }
  // 피격음
  if (target.hp > 0) playMonsterHit(target)

  // 흡혈
  if (eff.lifesteal > 0) {
    const heal = applyHealing(ctx, Math.round(finalDmg * eff.lifesteal))
    if (heal > 0) {
      ctx.player.hp = Math.min(ctx.player.maxHp, ctx.player.hp + heal)
      pushLog(ctx, i18nT('log.lifestealShort', `흡혈 +${heal}`, { hp: heal }), 'heal')
    } else if (heal < 0) {
      ctx.player.hp = Math.max(0, ctx.player.hp + heal)
    }
  }

  // trait: 피격 후 훅 (물리)
  dispatchOnAfterAttacked(ctx, target, finalDmg, { isMagic: false, isPhysical: true })
  dispatchOnHpThreshold(ctx, target)

  checkMonsterDeath(ctx)
}

function magicAttack(
  ctx: CombatContext,
  multiplier: number,
  statusKind: '점화' | '둔화' | '감전' | '암흑' | undefined,
  procChance: number,
  opts: { accBonus?: number; penBoost?: number } = {}
) {
  const target = currentTarget(ctx)
  if (!target) return
  magicAttackOnTarget(ctx, target, multiplier, statusKind, procChance, opts)
}

// 명시적 타겟에 마법 공격 1회 (광역 스킬 헬퍼)
//   마법 스킬은 eff.마법공격력 사용 (= 물리 공격력 + 갑옷 mpBonus + 특성 마력)
function magicAttackOnTarget(
  ctx: CombatContext,
  target: MonsterInstance,
  multiplier: number,
  statusKind: StatusKind | undefined,
  procChance: number,
  opts: { accBonus?: number; penBoost?: number; silent?: boolean } = {}
) {
  if (target.hp <= 0) return
  const eff = computeEffectiveStats(ctx.player)
  const syn = getPlayerSynergy(ctx.player)
  const surgeGuaranteedHit = !!(ctx.surgeNextAttackMult && ctx.surgeNextAttackMult > 1)
  if (!surgeGuaranteedHit && !rollHit(eff.명중률 + (opts.accBonus ?? 0), target.eva)) {
    if (!opts.silent) pushLog(ctx, i18nT('log.magicMiss', '마법이 빗나갔다.'), 'miss')
    chargeSurge(ctx, 10)
    return
  }
  let finalMult = multiplier
  let forceCrit = false
  let flatPenBonus = 0
  let critBonusChance = 0
  if (isBrokenArmorActive(ctx.player, syn.hasLoopholeMaster)) {
    finalMult *= 1 + 0.5 * syn.loopholeMult
  }
  if (syn.hasDavidStone && target.isBoss) {
    critBonusChance += 0.25
    flatPenBonus += 30
  }
  if (ctx.heavyArmorPenBonus && ctx.heavyArmorPenBonus > 0) {
    flatPenBonus += ctx.heavyArmorPenBonus
    ctx.heavyArmorPenBonus = 0
  }
  if (ctx.surgeNextAttackMult && ctx.surgeNextAttackMult > 1) {
    finalMult *= ctx.surgeNextAttackMult
    forceCrit = true
    ctx.surgeNextAttackMult = undefined
  }
  const { dmg, isCrit } = computeDamage(
    { 공격력: eff.마법공격력, 민첩: eff.민첩, 행운: eff.행운, 관통: eff.관통 },
    { 방어: target.def },
    { multiplier: finalMult, penBoost: opts.penBoost ?? 1.0, forceCrit, critBonusChance, flatPenBonus }
  )
  target.hp -= dmg
  target._hitsTaken = (target._hitsTaken ?? 0) + 1
  chargeSurge(ctx, isCrit ? 18 : 12)
  const _tn2 = i18nTd('monster', target.template.name)
  if (isCrit) {
    pushLog(ctx, i18nT('log.critMagic', `⚡ 크리티컬! ${_tn2}에게 ${dmg} 마법 데미지`, { name: _tn2, dmg }), 'critical')
  } else {
    pushLog(ctx, i18nT('log.magicDmg', `${_tn2}에게 ${dmg} 마법 데미지`, { name: _tn2, dmg }), 'damage')
  }
  if (target.hp > 0) playMonsterHit(target)

  if (statusKind && procChance > 0) {
    const luckBonus = 1 + eff.행운 * 0.005
    const finalChance = clamp(procChance * luckBonus, 0, 0.95)
    if (Math.random() < finalChance) {
      const ok = applyStatus(target, statusKind, eff.마법공격력, ctx.tick, 0)
      if (ok) {
        const _sn = i18nTd('status', statusKind)
        pushLog(ctx, i18nT('log.statusProc', `${_tn2}에게 ${_sn} 발동!`, { name: _tn2, status: _sn }), 'status')
      }
    }
  }

  // trait: 피격 후 훅 (마법)
  dispatchOnAfterAttacked(ctx, target, dmg, { isMagic: true, isPhysical: false })
  dispatchOnHpThreshold(ctx, target)

  checkMonsterDeath(ctx)
}

// 살아있는 적 N마리에 같은 공격 적용 (분산형 광역)
function magicAttackMulti(
  ctx: CombatContext,
  targets: MonsterInstance[],
  multiplier: number,
  statusKind: StatusKind | undefined,
  procChance: number,
  opts: { accBonus?: number } = {}
) {
  for (const t of targets) {
    if (t.hp <= 0) continue
    magicAttackOnTarget(ctx, t, multiplier, statusKind, procChance, opts)
  }
}

// 셔플 (Fisher-Yates) — 폭풍칼날 등 무작위 타겟 분배용
function shuffled<T>(arr: T[]): T[] {
  const a = arr.slice()
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// 무기 자동 부여 스킬 + 갑옷 자동 스킬 + 갑옷 비전 각인 스킬
export function getAvailableSkills(player: { weapon: ItemInstance | null; armor: ItemInstance | null }): string[] {
  const skills: string[] = []
  if (player.weapon) {
    const wbase = WEAPONS[player.weapon.baseKey]
    const wSkill = player.weapon.skillKey ?? wbase?.autoSkill
    if (wSkill) skills.push(wSkill)
  }
  if (player.armor) {
    const abase = ARMORS[player.armor.baseKey as keyof typeof ARMORS]
    if (abase?.autoSkill && !skills.includes(abase.autoSkill)) skills.push(abase.autoSkill)
    if (player.armor.skillKey && !skills.includes(player.armor.skillKey)) skills.push(player.armor.skillKey)
  }
  return skills
}

export function getWeaponSkillKey(player: Character): string | null {
  if (!player.weapon) return null
  const wbase = WEAPONS[player.weapon.baseKey]
  return player.weapon.skillKey ?? wbase?.autoSkill ?? null
}

export function getArmorImprintSkillKey(player: Character): string | null {
  return player.armor?.skillKey ?? null
}

export function getArmorSkillKey(player: Character): string | null {
  if (!player.armor) return null
  const abase = ARMORS[player.armor.baseKey as keyof typeof ARMORS]
  return abase?.autoSkill ?? null
}

// ============================================================
// 자동 전투: 게이지 100 도달 시 액션 선택
// 우선순위: 갑옷 비전 각인 (조건부) -> 무기 스킬 (확률) -> 평타
// ============================================================

export type AutoAction =
  | { kind: 'attack' }
  | { kind: 'skill'; key: string }

export function pickAutoAction(ctx: CombatContext, options: {
  forbidActiveSkills?: boolean      // 챌린지: 액티브 공격 스킬 X
  forceActiveSkills?: boolean       // 챌린지: 평타 X (스킬만)
} = {}): AutoAction {
  const eff = computeEffectiveStats(ctx.player)
  const player = ctx.player

  // 1) 갑옷 비전 각인 방어 스킬 (HP <= 65% 또는 상태이상 보유 & 버프 미중첩 시 35% 확률)
  const armorImprint = getArmorImprintSkillKey(player)
  if (armorImprint && !options.forbidActiveSkills && !options.forceActiveSkills) {
    const skill = SKILLS[armorImprint]
    const bKey = armorBuffKey(armorImprint)
    const hpLow = player.hp / Math.max(1, player.maxHp) <= 0.65
    const hasStatus = player.statuses.length > 0
    if (skill && !ctx.buffs.has(bKey) && (hpLow || hasStatus)) {
      let mpCost = skill.mp
      if (skill.kind === 'magic_atk' || skill.kind === 'magic_def') {
        mpCost = Math.max(0, mpCost + eff.weaponMpBonus)
      }
      if (player.mp >= mpCost && Math.random() < 0.35) {
        return { kind: 'skill', key: armorImprint }
      }
    }
  }

  // 2) 무기 스킬 (액티브 공격) — 챌린지 forbidActiveSkills면 스킵
  const weaponKey = getWeaponSkillKey(player)
  if (weaponKey && !options.forbidActiveSkills) {
    const skill = SKILLS[weaponKey]
    if (skill) {
      let mpCost = skill.mp
      if (skill.kind === 'magic_atk' || skill.kind === 'magic_def') {
        mpCost = Math.max(0, mpCost + eff.weaponMpBonus)
      }
      if (player.mp >= mpCost) {
        const chance = computeWeaponSkillProc(player, eff.행운)
        if (Math.random() < chance) {
          return { kind: 'skill', key: weaponKey }
        }
      }
    }
  }

  // 3) 평타 — forceActiveSkills(스킬 미학)면 스킬 강제 시도
  if (options.forceActiveSkills && weaponKey) {
    const skill = SKILLS[weaponKey]
    if (skill) {
      let mpCost = skill.mp
      if (skill.kind === 'magic_atk' || skill.kind === 'magic_def') {
        mpCost = Math.max(0, mpCost + eff.weaponMpBonus)
      }
      if (player.mp >= mpCost) return { kind: 'skill', key: weaponKey }
      // MP 부족 → 마력충전 fallback
      return { kind: 'skill', key: '마력충전' }
    }
  }

  return { kind: 'attack' }
}

function armorBuffKey(skillKey: string): string {
  if (skillKey === '방어') return 'defense'
  if (skillKey === '회피') return 'evade'
  if (skillKey === '패링') return 'parry'
  if (skillKey === '불굴의의지') return 'iron_will'
  if (skillKey === '배리어') return 'barrier'
  if (skillKey === '저항의결계') return 'resist_ward'
  return skillKey
}
