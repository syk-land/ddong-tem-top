// 아이템 전투력(공) / 전투력(방) — v5 v3 공식 (자동플레이 시뮬 검증 AUC 0.989 / Pearson 0.820)
//
// 종합 점수: atk_v3 + def × 50 + maxHp × 0.02
//   - atk_v3 = per-tick DPS × MP게이팅 × 속도안정성 × 명중안정성 (chapter-relative)
//       · MP 게이팅 = maxMp / (희망 스킬 발동 × mp 비용)  [마법무기 only, 최대 1.0]
//       · 속도 안정성 = 1 − clamp((wticks − 8) × 0.030, 0, 0.25)   [느린무기 페널티]
//       · 명중 안정성 = 1 + max(0, accBonus) × 0.012             [명중 보너스 가점]
//   - def = per-tick 데미지 감소량 × DEF_SCALE(=50)
//   - maxHp 기여 = maxHp × HP_FACTOR(=0.02) → 갑옷의 defValue 에 합산
//
// 전투력(공) [무기]: 평균 DPS 추정치 (chapter-relative)
//   atk = physStat × baseAtk × coef × (1+trait_pct) × 3.0          # 마법: 마력 × ... × 1.5 × magicSynergy
//     physStat = 힘 / 힘 + 민첩×0.3 (ranged)
//     magicSynergy = 1.5 (로브+마법무기) / 1.0 (그 외)
//   hitRate = clamp((acc - enemyEva)/100, 0, 1)
//   effDef% = max(0, enemyDef - pen) / 100
//   평균 hit = (1-p)×평타 + p×스킬 (p = 발동률)
//   DPS = 평균 hit × 크리보정 × attacks/tick
//
// 전투력(방) [갑옷]:
//   defPct = baseDef × coef × (1+trait_pct) + 체력 × 0.3 × coef
//   적 dmg/tick = enemyAtk × enemyHitRate / enemyTicks
//   감소량/tick = 적 dmg/tick × defPct
//   defValue 메인 = 감소량/tick × DEF_SCALE
//   defValue + maxHp × HP_FACTOR (갑옷 표시값에 합산)

import type { ItemInstance, Character } from '@/types'
import { WEAPONS } from '@/data/weapons'
import { ARMORS } from '@/data/armor'
import { WEAPON_TRAITS, ARMOR_TRAITS } from '@/data/traits'
import { SKILLS } from '@/data/skills'
import { getTemperMult, hasRelic } from './junkSynergy'

const DEFAULT_STATS = { 힘: 12, 민첩: 12, 체력: 12, 마력: 12, 행운: 12 }
const DEFAULT_CHAPTER = 5

// v5 v3 공식 상수 (자동플레이 시뮬 검증, BUILD_LOCK ON, n=47k)
//   total_score = atk_v3 + def × 50 + maxHp × 0.02
const DEF_SCALE = 50
const HP_FACTOR = 0.02

// v9 스킬 multiplier — skills.ts 와 동기화
const SKILL_ATK_MULT: Record<string, { mult: number; magic: boolean; note?: string }> = {
  스매쉬: { mult: 2.0, magic: false },
  피어스: { mult: 1.0, magic: false, note: '관통 ×2' },
  연속공격: { mult: 1.4, magic: false, note: '0.7 × 2히트 평균' },
  정밀타격: { mult: 1.5, magic: false, note: '1.2 × 크리 +' },
  급습: { mult: 1.65, magic: false },
  빙결의화살: { mult: 3.4, magic: true, note: '최대 3체 관통' },
  화염구: { mult: 6.5, magic: true },
  폭풍칼날: { mult: 5.4, magic: true, note: '1.8 × 3히트' },
  바위충격: { mult: 4.8, magic: true },
  번개창: { mult: 5.5, magic: true },
  그림자일격: { mult: 4.6, magic: true, note: '관통 ×1.5' },
  정화의광선: { mult: 4.3, magic: true, note: '정화 + 언데드/암흑 ×1.5' },
}

export interface ValuePart {
  label: string
  value: number
  note?: string
}

export interface ItemValueBreakdown {
  atkValue: number
  defValue: number
  atkParts: ValuePart[]
  defParts: ValuePart[]
}

export function computeItemValue(
  item: ItemInstance | null,
  character?: Character | null,
  opts: { chapter?: number; vsBoss?: boolean } = {},
): ItemValueBreakdown {
  if (!item) return { atkValue: 0, defValue: 0, atkParts: [], defParts: [] }
  const chapter = opts.chapter ?? DEFAULT_CHAPTER
  const vsBoss = opts.vsBoss ?? false
  return item.kind === 'weapon'
    ? computeWeaponValue(item, character, chapter, vsBoss)
    : computeArmorValue(item, character, chapter, vsBoss)
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v))
}

// 무기: v9 DPS 추정
function computeWeaponValue(
  w: ItemInstance,
  character: Character | null | undefined,
  chapter: number,
  vsBoss: boolean = false,
): ItemValueBreakdown {
  const base = WEAPONS[w.baseKey]
  const td = WEAPON_TRAITS[w.trait]
  if (!base || !td) return { atkValue: 0, defValue: 0, atkParts: [], defParts: [] }

  const atkParts: ValuePart[] = []
  const defParts: ValuePart[] = []

  const stats = character?.stats ?? DEFAULT_STATS

  // 적 baseline — vsBoss=true 면 진짜보스(챕터10 hardBoss × realBoss multipliers) 기준.
  //   진짜보스 def = (3 + ch×1.0) × 1.55(보스) × 1.6(REAL_BOSS_DEF_MULT) = ch10 ≈ 32.2%
  //   진짜보스 eva = (5 + ch×1.0) + 5(보스)                              = ch10 = 20
  const enemyDef = vsBoss
    ? (3 + chapter * 1.0) * 1.55 * 1.6
    : 3 + chapter * 1.0          // ch1=4%, ch5=8%, ch10=13%
  const enemyEva = vsBoss
    ? (5 + chapter * 1) + 5
    : 5 + chapter * 1            // ch1=6, ch5=10, ch10=15

  // ── 공격력 (v9.x 곱셈 + 부식 연성) ──
  const hasAnvil = character ? hasRelic(character, 'cursed_anvil_shard') : false
  const temperMult = getTemperMult(w, hasAnvil)
  const atkPct = (td.effects.공격력_pct ?? 0) + (td.effects.전스탯_pct ?? 0)
  const atkMultBase = base.baseAtk * w.coef * temperMult * (1 + atkPct)
  const isLobe = character?.armor?.baseKey === '로브'
  const magicSynergy = isLobe && base.isMagic ? 1.5 : 1.0
  const physStat = base.category === 'ranged' ? stats.힘 + stats.민첩 * 0.3 : stats.힘
  const totalAtk = base.isMagic
    ? stats.마력 * atkMultBase * 1.5 * magicSynergy
    : physStat * atkMultBase * 3.0

  // ── 명중률 (v9) ──
  const acc = 60 + (base.accBonus ?? 0) + (w.effects.명중 ?? 0)
    + stats.민첩 * 0.5 + stats.행운 * 0.1
  const hitRate = clamp((acc - enemyEva) / 100, 0, 1.0)

  // ── 관통 → 실효 방어% ──
  const pen = (base.penBonus ?? 0) + (base.magicPenBonus ?? 0) + (w.effects.관통 ?? 0)
  const effDefPct = Math.max(0, enemyDef - pen) / 100

  // ── 평타 hit ──
  const basicHit = Math.max(1, totalAtk * (1 - effDefPct)) * hitRate

  // ── 스킬 hit + 발동률 ──
  const skillKey = w.skillKey ?? base.autoSkill
  const skillInfo = skillKey ? SKILL_ATK_MULT[skillKey] : undefined
  // 발동률: 무기별 베이스 (대강) + 행운 보정
  // buildBalance.ts 의 단순 모델
  const baseProc = ({
    건틀릿: 0.18, 단검: 0.22, 사슬낫: 0.30, 완드: 0.25, 숏보우: 0.25,
    검: 0.35, 창: 0.40, 철퇴: 0.50, 스태프: 0.40, 롱보우: 0.40,
    대검: 0.55, 양날도끼: 0.65, 할버드: 0.70, 마도서: 0.55, 석궁: 0.50,
  } as Record<string, number>)[w.baseKey] ?? 0.30
  const procRate = skillInfo ? clamp(baseProc * (1 + stats.행운 * 0.005), 0.05, 0.85) : 0
  const skillHit = skillInfo
    ? Math.max(1, totalAtk * skillInfo.mult * (1 - effDefPct)) * hitRate
    : 0
  const avgHit = skillInfo ? (1 - procRate) * basicHit + procRate * skillHit : basicHit

  // ── 크리 보정 ──
  const critChance = clamp(stats.민첩 * 0.003, 0, 1.0)
  const critMult = 1.3 + stats.행운 / 100
  const critBoost = 1 + critChance * (critMult - 1)

  // ── 공격 빈도 (게이지 / ticks) — stats.ts 와 동일 식 ──
  const ticks = Math.round(10 / base.speedCoef)
  const armorBaseInfo = character?.armor
    ? ARMORS[character.armor.baseKey as keyof typeof ARMORS]
    : null
  let armorSpeed = armorBaseInfo?.speedMult ?? 1
  if (armorBaseInfo?.key === '로브' && base.isMagic) armorSpeed *= 1.15
  const wSpeedPct = (w.effects.속도_pct ?? 0)
  const aSpeedPct = (character?.armor?.effects.속도_pct ?? 0)
  const gaugePerTick = (1 + stats.민첩 / 100) * (1 + wSpeedPct + aSpeedPct) * armorSpeed
  const attacksPerTick = gaugePerTick / ticks

  // ── DPS (v3 보정 전 raw) ──
  const dpsRaw = avgHit * critBoost * attacksPerTick

  // ── v3 보정 ──
  // 1) MP 게이팅 — 마법무기에서 maxMp 가 부족하면 스킬 발동 빈도 다 못 씀
  let mpDiscount = 1.0
  if (base.isMagic && skillKey && skillInfo) {
    const skill = SKILLS[skillKey]
    if (skill && skill.mp > 0) {
      const FIGHT_TICKS = 200
      const wantSkillUses = attacksPerTick * FIGHT_TICKS * procRate
      let mpCost = skill.mp
      if ((skill.kind === 'magic_atk' || skill.kind === 'magic_def') && base.isMagic) {
        mpCost = Math.max(0, mpCost + (base.mpBonus ?? 0))
      }
      const mpNeed = wantSkillUses * mpCost
      const maxMp = stats.마력 * 15 + 30
      mpDiscount = mpNeed > maxMp ? maxMp / Math.max(1, mpNeed) : 1.0
    }
  }
  // 2) 속도 안정성 — wticks > 8 페널티 (느린 무기)
  const stability = 1 - Math.min(0.25, Math.max(0, (ticks - 8) * 0.030))
  // 3) 명중 안정성 — accBonus 양수 가점
  const accStability = 1 + Math.max(0, base.accBonus ?? 0) * 0.012

  const dps = dpsRaw * mpDiscount * stability * accStability

  atkParts.push({
    label: `예상 DPS (적 def ${enemyDef.toFixed(0)}% / eva ${enemyEva}, ch${chapter})`,
    value: dps,
    note: `atk ${totalAtk.toFixed(0)} × hit ${(hitRate * 100).toFixed(0)}% × ${attacksPerTick.toFixed(3)}/틱${magicSynergy !== 1 ? ' × 로브시너지 1.5' : ''}${base.category === 'ranged' ? ' (활: 힘+민첩×0.3)' : ''}${mpDiscount < 0.99 ? ` · MP게이팅 ×${mpDiscount.toFixed(2)}` : ''}${stability < 0.99 ? ` · 속도페널티 ×${stability.toFixed(2)}` : ''}${accStability > 1.01 ? ` · 명중보너스 ×${accStability.toFixed(2)}` : ''}`,
  })
  // 스킬 가중치 / 크리 보정은 메인 DPS 에 이미 포함되어 있음 — 정보용으로만 value=0
  if (skillInfo) {
    atkParts.push({
      label: `${skillKey} (×${skillInfo.mult.toFixed(2)}, 위 DPS 포함)`,
      value: 0,
      note: `발동률 ${(procRate * 100).toFixed(0)}%${skillInfo.note ? ' · ' + skillInfo.note : ''} · 마진 ${(procRate * (skillHit - basicHit) * critBoost * attacksPerTick).toFixed(1)}`,
    })
  }
  if (critBoost > 1.01) {
    atkParts.push({
      label: '크리 보정 (위 DPS 포함)',
      value: 0,
      note: `+${((critBoost - 1) * 100).toFixed(1)}% (${(critChance * 100).toFixed(1)}% × ×${critMult.toFixed(2)}) · 마진 ${(avgHit * (critBoost - 1) * attacksPerTick).toFixed(1)}`,
    })
  }

  // ── 보조 효과 (DPS 비례) ──
  const lifesteal = w.effects.lifesteal ?? 0
  if (lifesteal) atkParts.push({ label: '흡혈', value: dps * lifesteal * 0.3, note: `${(lifesteal * 100).toFixed(0)}% × 0.3` })
  const selfDot = w.effects.self_dot_pct ?? 0
  if (selfDot) atkParts.push({ label: '자해 (저주)', value: -dps * selfDot * 4, note: `-${(selfDot * 100).toFixed(0)}%` })
  const vsUndead = w.effects.vs_undead_pct ?? 0
  if (vsUndead) atkParts.push({ label: '대언데드', value: dps * vsUndead * 0.1, note: `테마 1/10` })

  const statusKeys: Array<[keyof typeof w.effects, string]> = [
    ['burn_chance', '점화'], ['bleed_chance', '출혈'], ['poison_chance', '독'],
    ['slow_chance', '둔화'], ['blind_chance', '암흑'], ['shock_chance', '감전'],
  ]
  for (const [k, label] of statusKeys) {
    const v = (w.effects[k] as number | undefined) ?? 0
    if (v) atkParts.push({ label, value: dps * v * 0.4, note: `${(v * 100).toFixed(0)}% × 0.4` })
  }

  // 행운 effect (위 DPS 의 critBoost/명중률에 이미 반영됨) — 정보용 value=0
  const luckEff = w.effects.행운 ?? 0
  if (luckEff) atkParts.push({ label: '행운 (위 DPS 포함)', value: 0, note: `+${luckEff}` })

  // 마력 effect (마법무기일 때 stats.마력 외부 보너스 — DPS 식에 직접 추가됨)
  if (base.isMagic) {
    const mpBonus = w.effects.마력 ?? 0
    if (mpBonus) atkParts.push({ label: '마력 (마법공격↑)', value: dps * mpBonus * 0.025, note: `+${mpBonus}` })
  }

  // 무기 trait 의 방어 효과 (per-tick 단위로 환산)
  // 회피 1pt ≈ 적 명중률 -1%p → 약 적 dmg/tick × 0.01 만큼 감소 효과
  if (w.effects.회피) {
    // 챕터 5 적 dmg/tick 추정: ~0.7
    defParts.push({ label: '회피 (무기 특성)', value: w.effects.회피 * 0.7 * 0.01 * DEF_SCALE })
  }
  if (w.effects.상태저항) {
    defParts.push({ label: '저항 (무기 특성)', value: w.effects.상태저항 * 0.3 })
  }

  const atkValue = atkParts.reduce((s, p) => s + p.value, 0)
  const defValue = defParts.reduce((s, p) => s + p.value, 0)
  return { atkValue, defValue, atkParts, defParts }
}

// 갑옷: v5 — per-tick 감소량 × DEF_SCALE + maxHp × HP_FACTOR
function computeArmorValue(
  a: ItemInstance,
  character: Character | null | undefined,
  chapter: number,
  vsBoss: boolean = false,
): ItemValueBreakdown {
  const base = ARMORS[a.baseKey as keyof typeof ARMORS]
  const td = ARMOR_TRAITS[a.trait]
  if (!base || !td) return { atkValue: 0, defValue: 0, atkParts: [], defParts: [] }

  const defParts: ValuePart[] = []
  const atkParts: ValuePart[] = []

  const stats = character?.stats ?? DEFAULT_STATS

  // 적 baseline — vsBoss=true 면 진짜보스(챕터10 보스 × realBoss multipliers) 기준.
  //   진짜보스 atk   = (8 + ch×1.2) × 1.7(보스) × 5.0(REAL_BOSS_ATK_MULT) = ch10 = 170
  //   보스 ticks     = 8 (일반 10보다 빠름)
  //   보스 acc       = (30 + ch×3) + 10(보스)                            = ch10 = 70
  const enemyAtk = vsBoss
    ? (8 + 1.2 * chapter) * 1.7 * 5.0
    : 8 + 1.2 * chapter
  const enemyTicks = vsBoss ? 8 : 10
  const enemyAcc = vsBoss
    ? (30 + 3 * chapter) + 10
    : 30 + 3 * chapter

  // ── 방어% 계산 (부식 연성 포함) ──
  const hasAnvil = character ? hasRelic(character, 'cursed_anvil_shard') : false
  const temperMult = getTemperMult(a, hasAnvil)
  const effectiveCoef = a.coef * temperMult
  const defPctTrait = (td.effects.방어력_pct ?? 0) + (td.effects.전스탯_pct ?? 0)
  const armorDef = base.baseDef * effectiveCoef * (1 + defPctTrait)
  const hpDef = stats.체력 * 0.3 * effectiveCoef
  const totalDefPct = clamp(armorDef + hpDef, 0, 99) / 100

  // 회피로 인한 적 명중률 감소 (per-tick 감소량 계산용)
  const playerEva = 5 + (base.evasion ?? 0) + (a.effects.회피 ?? 0)
    + stats.민첩 * 0.5 + stats.행운 * 0.1
  const enemyHitRate = clamp((enemyAcc - playerEva) / 100, 0, 1)

  // 적 per-tick 데미지 — 회피·방어 모두 무시한 raw 베이스라인.
  // (= 사용자가 어떤 갑옷도 입지 않았을 때의 최악 데미지)
  const enemyDmgFull = enemyAtk / enemyTicks
  // enemyDmgPerTick — 회피만 반영된 적 dmg/tick. 자동 반응/피격 회복/저주 등
  // "피격당 발동" 효과들이 실제로 맞는 빈도 × 위력 기준이라 회피는 반영해야 함.
  // (이후 코드에서 그대로 사용)
  const enemyDmgPerTick = enemyAtk * enemyHitRate / enemyTicks
  // 실제 받는 데미지 = 회피 안 한 비율 × 방어 후 비율
  const effectiveDmg = enemyDmgFull * enemyHitRate * (1 - totalDefPct)
  // 감소량 = 회피로 피한 부분 + 방어로 막은 부분 (둘 다 갑옷의 가치)
  // 이전 식 (= enemyDmgPerTick × totalDefPct) 은 회피 효과가 enemyHitRate 를
  // 낮추면 동시에 reduction 도 함께 낮춰져서 회피 트레이트가 점수를 깎는
  // 역효과가 있었음 → 매끈한(+8 회피) T6 가 녹슨(-50% 방어) T5 보다 낮게
  // 평가되는 모순. 회피로 피한 부분을 명시적으로 더해 정상화.
  const reductionPerTick = enemyDmgFull - effectiveDmg

  // ── 메인 방어 (per-tick 감소량 × DEF_SCALE) ──
  defParts.push({
    label: `방어 ${(totalDefPct * 100).toFixed(1)}% · 회피 ${((1 - enemyHitRate) * 100).toFixed(0)}% (적 ${enemyDmgFull.toFixed(2)} dmg/틱)`,
    value: reductionPerTick * DEF_SCALE,
    note: `감소 ${reductionPerTick.toFixed(3)}/틱 × ${DEF_SCALE} = baseDef ${base.baseDef} × ${a.coef.toFixed(2)} × (1${defPctTrait >= 0 ? '+' : ''}${defPctTrait.toFixed(2)})${stats.체력 ? ` + 체력 ${stats.체력} × 0.3 × ${a.coef.toFixed(2)}` : ''}, 회피 ${playerEva.toFixed(0)}`,
  })

  // ── 체력 기여 (maxHp × HP_FACTOR) ──
  const maxHp = stats.체력 * 10 + 50
  defParts.push({
    label: `체력 ${stats.체력} → HP ${maxHp}`,
    value: maxHp * HP_FACTOR,
    note: `${maxHp} × ${HP_FACTOR}`,
  })

  // 회피 (메인 reductionPerTick 에 이미 적 hit rate 로 반영됨 — 추가 가시화 X)
  // 상태저항
  const stRes = a.effects.상태저항 ?? 0
  if (stRes) defParts.push({ label: '상태저항', value: stRes * 0.3, note: `+${stRes}` })

  // ── 마력 보너스 → 마법 빌드의 atk 증가 (마법무기 + 로브 시너지) ──
  const mpBonus = base.mpBonus + (a.effects.마력 ?? 0)
  if (mpBonus) {
    // 마법 무기 장착자라면 atk 영향 크게
    const isMagic = character?.weapon
      ? WEAPONS[character.weapon.baseKey]?.isMagic ?? false
      : false
    if (isMagic) {
      atkParts.push({ label: '마력 → 마법 atk', value: mpBonus * 0.8, note: `+${mpBonus} (마력 stat 증가)` })
    } else {
      atkParts.push({ label: '마력 보너스', value: mpBonus * 0.2, note: `+${mpBonus} (마법 무기 없음)` })
    }
    defParts.push({ label: '마력 (저항↑)', value: mpBonus * 0.1, note: `+${mpBonus}` })
  }

  // v5: 게이지 가속 (speedMult) 과 로브+마법 시너지 (×1.5) 는
  //     computeWeaponValue 의 DPS 계산에 이미 포함되어 중복 카운트 X.
  //     (이전 calibration 이 보정해줬지만 v5 raw 식에선 두 번 더하면 ↑↑)

  // ── 갑옷 자동 반응 점수 (피격 시 발동) — chapter-aware ──
  // 발동률 × 적 per-attack 데미지 × per-tick 환산 × DEF_SCALE
  const procChance = 0.10 + stats.행운 * 0.005
  const enemyDmgPerAttack = enemyDmgPerTick * enemyTicks   // 단일 공격 데미지
  if (base.key === '가죽갑') {
    defParts.push({
      label: '자동 회피 (피격 시)',
      value: enemyDmgPerTick * procChance * DEF_SCALE,    // 회피 1회당 데미지 무효
      note: `발동 ${(procChance * 100).toFixed(0)}% → ${enemyDmgPerAttack.toFixed(1)} dmg 무효`,
    })
  } else if (base.key === '로브') {
    defParts.push({
      label: '자동 방어 (피격 시)',
      value: enemyDmgPerTick * 0.5 * procChance * DEF_SCALE,
      note: `발동 ${(procChance * 100).toFixed(0)}% → 50% 차감 (MP 소모)`,
    })
  } else if (base.key === '판금') {
    const charDps = estimateCharDps(character)
    // 카운터: 피격당 평타×0.5 반격 (방어 무시) → 적 ticks 마다 반격 시도
    atkParts.push({
      label: '철벽 카운터 (피격 시)',
      value: charDps * 0.5 * procChance / enemyTicks,
      note: `발동 ${(procChance * 100).toFixed(0)}% → 평타×0.5 반격`,
    })
  }

  // 갑옷 비전 각인 방어 스킬 기여
  if (a.skillKey) {
    defParts.push({
      label: `방어 각인 (${a.skillKey})`,
      value: enemyDmgPerTick * 0.12 * DEF_SCALE,
      note: 'HP 65% 이하 또는 상태이상 시 35% 자동 발동',
    })
  }

  // 갑옷 trait — 피격회복/반사/저항 (chapter-aware)
  const dmgHeal = a.effects.damage_taken_heal_pct ?? 0
  if (dmgHeal) defParts.push({
    label: '피격 회복',
    value: dmgHeal * enemyDmgPerTick * DEF_SCALE,
    note: `${(dmgHeal * 100).toFixed(0)}% × 적 dmg/틱 ${enemyDmgPerTick.toFixed(2)}`,
  })
  const selfDot = a.effects.self_dot_pct ?? 0
  if (selfDot) defParts.push({
    label: '자해 (저주)',
    value: -selfDot * enemyDmgPerTick * DEF_SCALE * 2,
    note: `매 10틱 maxHp×${(selfDot*100).toFixed(0)}% 손실`,
  })

  const reflectKeys: Array<[keyof typeof a.effects, string]> = [
    ['reflect_burn', '점화반사'], ['reflect_slow', '둔화반사'], ['reflect_shock', '감전반사'],
    ['reflect_bleed', '출혈반사'], ['reflect_blind', '암흑반사'], ['reflect_poison', '독반사'],
  ]
  for (const [k, label] of reflectKeys) {
    const v = (a.effects[k] as number | undefined) ?? 0
    if (v) defParts.push({ label, value: v * 10 })
  }
  const resistKeys: Array<[keyof typeof a.effects, string]> = [
    ['resist_burn', '점화저항'], ['resist_slow', '둔화저항'], ['resist_shock', '감전저항'],
    ['resist_bleed', '출혈저항'], ['resist_blind', '암흑저항'], ['resist_poison', '독저항'],
  ]
  for (const [k, label] of resistKeys) {
    const v = (a.effects[k] as number | undefined) ?? 0
    if (v) defParts.push({ label, value: v * 5 })
  }

  // 명중/행운 trait — 무기측 DPS 식의 acc + aeffects.명중, 크리/명중률에 이미 반영됨
  // 정보용 value=0
  if (a.effects.명중) {
    atkParts.push({ label: '명중 (갑옷 특성, 위 DPS 포함)', value: 0, note: `+${a.effects.명중.toFixed(0)}` })
  }
  if (a.effects.행운) {
    atkParts.push({ label: '행운 (갑옷 특성, 위 DPS 포함)', value: 0, note: `+${a.effects.행운.toFixed(0)}` })
  }

  const atkValue = atkParts.reduce((s, p) => s + p.value, 0)
  const defValue = defParts.reduce((s, p) => s + p.value, 0)
  return { atkValue, defValue, atkParts, defParts }
}

// 캐릭터 현재 무기의 대략적인 DPS 추정 (갑옷의 게이지 가속/감속 환산용)
function estimateCharDps(character?: Character | null): number {
  if (!character?.weapon) return 30
  const w = character.weapon
  const base = WEAPONS[w.baseKey]
  const td = WEAPON_TRAITS[w.trait]
  if (!base || !td) return 30
  const hasAnvil = hasRelic(character, 'cursed_anvil_shard')
  const atkPct = (td.effects.공격력_pct ?? 0) + (td.effects.전스탯_pct ?? 0)
  const atkMultBase = base.baseAtk * w.coef * getTemperMult(w, hasAnvil) * (1 + atkPct)
  const physStat = base.category === 'ranged'
    ? character.stats.힘 + character.stats.민첩 * 0.3
    : character.stats.힘
  const isLobe = character.armor?.baseKey === '로브'
  const magicSynergy = isLobe && base.isMagic ? 1.5 : 1.0
  const stat = base.isMagic ? character.stats.마력 : physStat
  const k = base.isMagic ? 1.5 * magicSynergy : 3.0
  const atk = stat * atkMultBase * k
  const ticks = Math.round(10 / base.speedCoef)
  return atk / ticks
}
