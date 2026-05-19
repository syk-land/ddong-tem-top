import type { CombatContext } from './combat'
import { computeDamage, pushLog, checkMonsterDeath, rollHit, currentTarget } from './combat'
import { computeEffectiveStats } from './stats'
import { applyStatus, purgeDebuffs } from './status'
import { SKILLS } from '@/data/skills'
import { WEAPONS } from '@/data/weapons'
import { ARMORS } from '@/data/armor'
import { clamp } from './rng'
import type { Character, ItemInstance } from '@/types'
import { computeArmorAutoProc, computeWeaponSkillProc } from './buildBalance'

// 스킬 효과는 키별로 직접 처리
export function useSkill(ctx: CombatContext, key: string): boolean {
  const skill = SKILLS[key]
  if (!skill) return false

  const eff = computeEffectiveStats(ctx.player)
  let mpCost = skill.mp
  // 마법 무기는 MP 보정 적용
  if (skill.kind === 'magic_atk' || skill.kind === 'magic_def') {
    mpCost = Math.max(0, mpCost + eff.weaponMpBonus)
  }

  if (ctx.player.mp < mpCost) {
    pushLog(ctx, `마력이 부족합니다 (필요 ${mpCost})`, 'info')
    return false
  }
  ctx.player.mp -= mpCost
  if (mpCost > 0) pushLog(ctx, `${skill.name} 사용 (MP -${mpCost})`, 'skill')

  switch (key) {
    case '스매쉬':
      attackSkill(ctx, 2.0, { accBonus: -10 })
      break
    case '피어스':
      attackSkill(ctx, 1.0, { penBoost: 2.0 })
      break
    case '연속공격': {
      const hits = 1 + Math.floor(eff.속도 / 20)
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
      ctx.buffs.set('parry', {
        duration: 10,
        effect: {
          defMult: 1 + (eff.속도 * 0.3 + eff.공격력 * 0.5) / 100,
          reflect: 0.5,
        },
      })
      pushLog(ctx, '패링 자세 (10틱)', 'skill')
      break
    case '불굴의의지': {
      const heal = Math.round(ctx.player.maxHp * 0.05)
      ctx.player.hp = Math.min(ctx.player.maxHp, ctx.player.hp + heal)
      ctx.buffs.set('iron_will', { duration: 10, effect: { statusResistMult: 30 } })
      pushLog(ctx, `불굴의 의지: HP +${heal}`, 'heal')
      break
    }

    // === 마법 스킬: 통합 공격력 사용. 물리 대비 +30~50% 데미지 ===
    case '빙결의화살':
      magicAttack(ctx, 2.0, '둔화', 1.0)  // 1.5 → 2.0
      break
    case '화염구':
      magicAttack(ctx, 2.4, '점화', 0.25)  // 1.8 → 2.4
      break
    case '폭풍칼날': {
      for (let i = 0; i < 3; i++) {
        const t = currentTarget(ctx)
        if (!t || t.hp <= 0) break
        magicAttack(ctx, 0.95, undefined, 0, { accBonus: 50 })  // 0.7 → 0.95 (3히트 총 ×2.85)
      }
      break
    }
    case '바위충격':
      magicAttack(ctx, 2.1, '둔화', 0.40)  // 1.6 → 2.1
      break
    case '번개창':
      magicAttack(ctx, 2.7, '감전', 0.15)  // 2.0 → 2.7
      {
        const t = currentTarget(ctx)
        if (t) t.actionGauge = Math.max(0, t.actionGauge - 10)
      }
      break
    case '그림자일격':
      magicAttack(ctx, 2.0, '암흑', 1.0)  // 1.5 → 2.0
      break
    case '정화의광선': {
      magicAttack(ctx, 1.6, undefined, 0)  // 1.2 → 1.6
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
      ctx.buffs.set('resist_ward', { duration: 10, effect: { statusResistMult: 2 } })
      pushLog(ctx, '저항의 결계', 'skill')
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
  if (!rollHit(eff.명중률 + (opts.accBonus ?? 0), 0)) {
    pushLog(ctx, '공격이 빗나갔다.', 'miss')
    return
  }
  const { dmg, isCrit } = computeDamage(
    { 공격력: eff.공격력, 행운: eff.행운, 관통: eff.관통 },
    { 방어: target.def },
    { multiplier, penBoost: opts.penBoost ?? 1.0 }
  )
  const finalDmg = opts.critMultiplier && isCrit ? Math.round(dmg * (opts.critMultiplier / 2)) : dmg
  target.hp -= finalDmg
  if (isCrit) {
    pushLog(ctx, `⚡ 크리티컬! ${target.template.name}에게 ${finalDmg} 데미지`, 'critical')
  } else {
    pushLog(ctx, `${target.template.name}에게 ${finalDmg} 데미지`, 'damage')
  }

  // 흡혈
  if (eff.lifesteal > 0) {
    const heal = Math.round(finalDmg * eff.lifesteal)
    if (heal > 0) {
      ctx.player.hp = Math.min(ctx.player.maxHp, ctx.player.hp + heal)
      pushLog(ctx, `흡혈 +${heal}`, 'heal')
    }
  }

  checkMonsterDeath(ctx)
}

function magicAttack(
  ctx: CombatContext,
  multiplier: number,
  statusKind: '점화' | '둔화' | '감전' | '암흑' | undefined,
  procChance: number,
  opts: { accBonus?: number } = {}
) {
  const target = currentTarget(ctx)
  if (!target) return
  const eff = computeEffectiveStats(ctx.player)
  if (!rollHit(eff.명중률 + (opts.accBonus ?? 0), 0)) {
    pushLog(ctx, '마법이 빗나갔다.', 'miss')
    return
  }
  const { dmg, isCrit } = computeDamage(
    { 공격력: eff.공격력, 행운: eff.행운, 관통: eff.관통 },
    { 방어: target.def },
    { multiplier }
  )
  target.hp -= dmg
  if (isCrit) {
    pushLog(ctx, `⚡ 크리티컬! ${target.template.name}에게 ${dmg} 마법 데미지`, 'critical')
  } else {
    pushLog(ctx, `${target.template.name}에게 ${dmg} 마법 데미지`, 'damage')
  }

  if (statusKind && procChance > 0) {
    const luckBonus = 1 + eff.행운 * 0.005
    const finalChance = clamp(procChance * luckBonus, 0, 0.95)
    if (Math.random() < finalChance) {
      const ok = applyStatus(target, statusKind, eff.공격력, ctx.tick, 0)
      if (ok) pushLog(ctx, `${target.template.name}에게 ${statusKind} 발동!`, 'status')
    }
  }

  checkMonsterDeath(ctx)
}

// 무기 자동 부여 스킬 + 갑옷 자동 스킬
export function getAvailableSkills(player: { weapon: ItemInstance | null; armor: ItemInstance | null }): string[] {
  const skills: string[] = []
  if (player.weapon) {
    const wbase = WEAPONS[player.weapon.baseKey]
    if (wbase?.autoSkill) skills.push(wbase.autoSkill)
  }
  if (player.armor) {
    const abase = ARMORS[player.armor.baseKey as keyof typeof ARMORS]
    if (abase?.autoSkill && !skills.includes(abase.autoSkill)) skills.push(abase.autoSkill)
  }
  return skills
}

export function getWeaponSkillKey(player: Character): string | null {
  if (!player.weapon) return null
  const wbase = WEAPONS[player.weapon.baseKey]
  return wbase?.autoSkill ?? null
}

export function getArmorSkillKey(player: Character): string | null {
  if (!player.armor) return null
  const abase = ARMORS[player.armor.baseKey as keyof typeof ARMORS]
  return abase?.autoSkill ?? null
}

// ============================================================
// 자동 전투: 게이지 100 도달 시 액션 선택
// 우선순위: 갑옷 방어/회피 (조건부) → 무기 스킬 (확률) → 평타
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

  // 1) 갑옷 방어/회피 스킬 (조건부 트리거)
  const armorKey = getArmorSkillKey(player)
  if (armorKey) {
    const skill = SKILLS[armorKey]
    if (skill) {
      const mpCost = skill.mp
      const sameBuffActive = ctx.buffs.has(armorBuffKey(armorKey))
      if (player.mp >= mpCost && !sameBuffActive) {
        // 가장 게이지 높은 적 기준으로 위협도 판단
        const threat = currentTarget(ctx) ?? { actionGauge: 0, isBoss: false, isMimic: false }
        const armorChance = computeArmorAutoProc({
          player,
          monster: threat,
          luck: eff.행운,
        })
        if (armorChance > 0 && Math.random() < armorChance) {
          return { kind: 'skill', key: armorKey }
        }
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
