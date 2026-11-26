<script setup lang="ts">
import { computed, ref } from 'vue'
import type { ItemInstance, Character } from '@/types'
import { WEAPONS } from '@/data/weapons'
import { ARMORS } from '@/data/armor'
import { WEAPON_TRAITS, ARMOR_TRAITS } from '@/data/traits'
import { SKILLS } from '@/data/skills'
import { tierColorClass, gradeColorClass, gradeBorderClass } from '@/ui/colors'
import { computeWeaponSkillProc } from '@/core/buildBalance'
import { getClearRank } from '@/core/character'
import { useGameStore } from '@/stores/game'
import { itemImageUrl, skillIconUrl } from '@/ui/images'
import { computeItemValue, type ValuePart } from '@/core/itemValue'
import { getDangerTier, getChapterThreshold } from '@/core/scoreThresholds'
import { canEquipItem } from '@/core/challengeRuntime'
import { QUIRK_INFO, getItemQuirk } from '@/core/junkSynergy'
import ItemName from './ItemName.vue'
import { useI18n } from '@/lib/i18n'

const { t: tI18n, td: tdI18n, tLabel: tLabelI18n, lang } = useI18n()

// Combat 의 스킬 카드와 동일한 라벨/색 매핑
const skillKindLabel: Record<string, () => string> = {
  physical_atk: () => tI18n('combat.skillKind.physicalAtk', '물리 공격'),
  physical_def: () => tI18n('combat.skillKind.physicalDef', '물리 방어'),
  magic_atk: () => tI18n('combat.skillKind.magicAtk', '마법 공격'),
  magic_def: () => tI18n('combat.skillKind.magicDef', '마법 방어'),
}
const skillKindColor: Record<string, string> = {
  physical_atk: 'text-stat-phys_atk',
  physical_def: 'text-stat-phys_def',
  magic_atk: 'text-stat-mag_atk',
  magic_def: 'text-stat-mag_def',
}

const game = useGameStore()
const currentChapter = computed(() => game.currentChapterState?.chapter ?? 1)

const props = defineProps<{
  item: ItemInstance
  character?: Character
}>()

const isWeapon = computed(() => props.item.kind === 'weapon')
const weaponBase = computed(() => isWeapon.value ? WEAPONS[props.item.baseKey] : null)
const armorBase = computed(() => !isWeapon.value ? ARMORS[props.item.baseKey as keyof typeof ARMORS] : null)
const traitDef = computed(() =>
  isWeapon.value ? WEAPON_TRAITS[props.item.trait] : ARMOR_TRAITS[props.item.trait]
)
const traitBase = computed(() => traitDef.value?.effects ?? {})
const itemQuirkId = computed(() => getItemQuirk(props.item))
const quirkInfo = computed(() => (itemQuirkId.value ? QUIRK_INFO[itemQuirkId.value] : null))
const isQuirkDiscovered = computed(() =>
  !!itemQuirkId.value && (game.meta.discoveredQuirks ?? []).includes(itemQuirkId.value)
)

// ── 아이템 벨류 + 현재 장착품 대비 변화량 ──
const chapterForValue = computed(() => game.currentChapterState?.chapter)
const itemValue = computed(() => computeItemValue(props.item, props.character, { chapter: chapterForValue.value }))
const currentSlotItem = computed(() => {
  if (!props.character) return null
  return props.item.kind === 'weapon' ? props.character.weapon : props.character.armor
})
const currentValue = computed(() => computeItemValue(currentSlotItem.value, props.character, { chapter: chapterForValue.value }))
// 자기 자신(현재 장착 중) 체크
const isSameAsEquipped = computed(() => {
  const cur = currentSlotItem.value
  return !!cur && cur.id === props.item.id
})

// ── 캐릭터 총합 기준 비교 ──
//   현재 캐릭터 = (현재 무기 + 현재 갑옷) atkValue/defValue 합
//   새 캐릭터 = (이 아이템으로 슬롯 교체) 합
//   pct = (새 - 현재) / 현재 × 100  (분모: 현재 캐릭터 총합)
const otherSlotValue = computed(() => {
  if (!props.character) return { atkValue: 0, defValue: 0 }
  const other = isWeapon.value ? props.character.armor : props.character.weapon
  return computeItemValue(other, props.character, { chapter: chapterForValue.value })
})
const totalCurrent = computed(() => {
  const w = computeItemValue(props.character?.weapon ?? null, props.character, { chapter: chapterForValue.value })
  const a = computeItemValue(props.character?.armor ?? null, props.character, { chapter: chapterForValue.value })
  return { atk: w.atkValue + a.atkValue, def: w.defValue + a.defValue }
})
const totalNew = computed(() => ({
  atk: itemValue.value.atkValue + otherSlotValue.value.atkValue,
  def: itemValue.value.defValue + otherSlotValue.value.defValue,
}))
const atkDelta = computed(() => totalNew.value.atk - totalCurrent.value.atk)
const defDelta = computed(() => totalNew.value.def - totalCurrent.value.def)
const atkPct = computed<number | null>(() => {
  if (isSameAsEquipped.value) return null
  const cur = totalCurrent.value.atk
  if (Math.abs(cur) < 0.05) return null
  return Math.max(-100, (atkDelta.value / cur) * 100)
})
const defPct = computed<number | null>(() => {
  if (isSameAsEquipped.value) return null
  const cur = totalCurrent.value.def
  if (Math.abs(cur) < 0.05) return null
  return Math.max(-100, (defDelta.value / cur) * 100)
})

// 스킬 상세 모달
const skillModalOpen = ref(false)
function openSkillModal() { if (skill.value && skillKey.value) skillModalOpen.value = true }
function closeSkillModal() { skillModalOpen.value = false }

// 정보 모달 — 특성 / 등급 / 베이스 클릭 시 표시
interface InfoLine { label: string; value?: string; note?: string }
const infoModal = ref<{
  kind: 'trait' | 'grade' | 'base'
  title: string
  subtitle?: string
  lines: InfoLine[]
} | null>(null)

function fmtPct(n: number): string {
  return (n >= 0 ? '+' : '') + (n * 100).toFixed(0) + '%'
}
function fmtFlat(n: number): string {
  return (n >= 0 ? '+' : '') + n.toFixed(0)
}

function openTraitInfo() {
  const td = traitDef.value
  if (!td) return
  const lines: InfoLine[] = []
  const e = td.effects
  if (e.공격력_pct !== undefined && e.공격력_pct !== 0) lines.push({ label: '공격력', value: fmtPct(e.공격력_pct) })
  if (e.방어력_pct !== undefined && e.방어력_pct !== 0) lines.push({ label: '방어력', value: fmtPct(e.방어력_pct) })
  if (e.전스탯_pct !== undefined && e.전스탯_pct !== 0) lines.push({ label: '전스탯', value: fmtPct(e.전스탯_pct) })
  if (e.속도_pct !== undefined && e.속도_pct !== 0) lines.push({ label: '속도', value: fmtPct(e.속도_pct) })
  if (e.명중 !== undefined && e.명중 !== 0) lines.push({ label: '명중', value: fmtFlat(e.명중) })
  if (e.회피 !== undefined && e.회피 !== 0) lines.push({ label: '회피', value: fmtFlat(e.회피) })
  if (e.관통 !== undefined && e.관통 !== 0) lines.push({ label: '관통', value: fmtFlat(e.관통) })
  if (e.행운 !== undefined && e.행운 !== 0) lines.push({ label: '행운', value: fmtFlat(e.행운) })
  if (e.마력 !== undefined && e.마력 !== 0) lines.push({ label: '마력', value: fmtFlat(e.마력) })
  if (e.상태저항 !== undefined && e.상태저항 !== 0) lines.push({ label: '상태저항', value: fmtFlat(e.상태저항) })
  if (e.lifesteal !== undefined) lines.push({ label: '흡혈', value: fmtPct(e.lifesteal) })
  if (e.vs_undead_pct !== undefined) lines.push({ label: '대언데드', value: fmtPct(e.vs_undead_pct) })
  if (e.self_dot_pct !== undefined) lines.push({ label: '자해 (DoT)', value: fmtPct(e.self_dot_pct) })
  if (e.damage_taken_heal_pct !== undefined) lines.push({ label: '피격 회복', value: fmtPct(e.damage_taken_heal_pct) })
  // 상태이상 chance 류
  const statusEffects: Array<[string, string]> = [
    ['burn_chance', '점화'], ['bleed_chance', '출혈'], ['poison_chance', '독'],
    ['slow_chance', '둔화'], ['blind_chance', '암흑'], ['shock_chance', '감전'],
  ]
  for (const [k, label] of statusEffects) {
    const v = (e as Record<string, number | undefined>)[k]
    if (v) lines.push({ label, value: fmtPct(v) })
  }
  if (quirkInfo.value) {
    if (isQuirkDiscovered.value) {
      lines.push({
        label: lang.value === 'en' ? '💡 Loophole' : '💡 허점 해금',
        value: lang.value === 'en' ? quirkInfo.value.nameEn : quirkInfo.value.nameKo,
        note: lang.value === 'en' ? quirkInfo.value.descEn : quirkInfo.value.descKo,
      })
    } else {
      lines.push({
        label: lang.value === 'en' ? '💡 Hidden Loophole' : '💡 숨은 허점',
        value: '???',
        note: lang.value === 'en' ? quirkInfo.value.hintEn : quirkInfo.value.hintKo,
      })
    }
  }
  infoModal.value = {
    kind: 'trait',
    title: `${props.item.trait} (특성)`,
    subtitle: `${props.item.tier <= 4 ? '하급' : props.item.tier <= 8 ? '보통' : props.item.tier <= 12 ? '희귀' : '특별'} 특성`,
    lines: lines.length > 0 ? lines : [{ label: '효과 없음', value: '—' }],
  }
}

function openGradeInfo() {
  const coef = props.item.coef
  const grade = props.item.grade
  infoModal.value = {
    kind: 'grade',
    title: `${grade} 등급`,
    subtitle: `등급계수 ${coef.toFixed(2)}`,
    lines: [
      { label: '등급계수', value: coef.toFixed(2), note: '무기 공격력·갑옷 방어력에 곱셈 적용 (특성 효과에도 적용)' },
      { label: '현재 티어', value: `T${props.item.tier}` },
      { label: '판매가', value: `${props.item.sellPrice}G`, note: '인벤토리 / 장착 중 판매 시' },
      { label: '구매가 (상점)', value: `${props.item.buyPrice}G` },
    ],
  }
}

function openBaseInfo() {
  const lines: InfoLine[] = []
  if (weaponBase.value) {
    const w = weaponBase.value
    lines.push({ label: '카테고리', value: w.category === 'magic' ? '마법' : w.category === 'ranged' ? '원거리' : '근접' })
    lines.push({ label: '기본 공격력', value: w.baseAtk.toFixed(2), note: '힘(또는 마력) × 무기공격 × 등급계수' })
    const ticks = Math.round(10 / w.speedCoef)
    lines.push({ label: '공격주기', value: `${ticks}틱`, note: `속도계수 ${w.speedCoef.toFixed(2)}` })
    if (w.accBonus) lines.push({ label: '명중 보너스', value: fmtFlat(w.accBonus) })
    if (w.evaBonus) lines.push({ label: '회피 보너스', value: fmtFlat(w.evaBonus) })
    if (w.penBonus) lines.push({ label: '관통', value: fmtFlat(w.penBonus) })
    if (w.magicPenBonus) lines.push({ label: '마법 관통', value: fmtFlat(w.magicPenBonus) })
    if (w.mpBonus) lines.push({ label: 'MP 보정', value: fmtFlat(w.mpBonus) })
    const wSkill = props.item.skillKey ?? w.autoSkill
    if (wSkill) lines.push({ label: '각인 스킬', value: wSkill })
    if (w.isMagic) lines.push({ label: '마법무기', value: '예', note: '마력 스탯 사용, 로브와 시너지 ×1.5' })
  } else if (armorBase.value) {
    const a = armorBase.value
    lines.push({ label: '기본 방어력', value: `${a.baseDef}%`, note: '체력 × 0.3 × 등급계수 추가' })
    if (a.speedMult && a.speedMult !== 1) lines.push({ label: '게이지 배수', value: `×${a.speedMult.toFixed(2)}` })
    if (a.evasion) lines.push({ label: '회피', value: fmtFlat(a.evasion) })
    if (a.mpBonus) lines.push({ label: 'MP 보정', value: fmtFlat(a.mpBonus) })
    if (a.autoSkill) lines.push({ label: '자동 발동', value: a.autoSkill, note: '피격 시 자동 발동' })
    if (props.item.skillKey) lines.push({ label: '비전 각인', value: props.item.skillKey, note: '위기 시 자동 발동' })
  }
  infoModal.value = {
    kind: 'base',
    title: props.item.baseKey,
    subtitle: weaponBase.value ? '무기 베이스' : '갑옷 베이스',
    lines: lines.length > 0 ? lines : [{ label: '정보 없음', value: '—' }],
  }
}
function closeInfoModal() { infoModal.value = null }

// 분해 모달 — 총량 = 이 아이템 + 다른 슬롯, 클릭 시 상세 분해 표시
const valueModal = ref<{
  kind: 'atk' | 'def'
  itemContribution: number     // 이 아이템의 기여분
  otherContribution: number    // 다른 슬롯 (변동 없음)
  totalIfEquipped: number      // 착용 시 총량
  currentTotal: number         // 현재 총량 (현재 장착 기준)
  delta: number                // 변화량 = totalIfEquipped - currentTotal
  parts: ValuePart[]           // 이 아이템의 분해
} | null>(null)
function openValueModal(kind: 'atk' | 'def') {
  if (kind === 'atk') {
    valueModal.value = {
      kind,
      itemContribution: itemValue.value.atkValue,
      otherContribution: otherSlotValue.value.atkValue,
      totalIfEquipped: totalNew.value.atk,
      currentTotal: totalCurrent.value.atk,
      delta: atkDelta.value,
      parts: itemValue.value.atkParts,
    }
  } else {
    valueModal.value = {
      kind,
      itemContribution: itemValue.value.defValue,
      otherContribution: otherSlotValue.value.defValue,
      totalIfEquipped: totalNew.value.def,
      currentTotal: totalCurrent.value.def,
      delta: defDelta.value,
      parts: itemValue.value.defParts,
    }
  }
}

// 현재 장착 중인 동일 슬롯 아이템 (인벤토리 비교용)
const currentEquipped = computed(() => {
  if (!props.character) return null
  const slot = isWeapon.value ? 'weapon' : 'armor'
  const cur = props.character[slot]
  // 이 ItemDetail 이 현재 장착품을 표시 중이면 비교 무의미
  if (!cur || cur.id === props.item.id) return null
  return cur
})
const coef = computed(() => props.item.coef)
const effects = computed(() => props.item.effects)

// 기본 능력치 분해 — v9 곱셈 모델
// 공식:
//   무기 atk = 힘 × baseAtk × coef × (1 + trait_pct) × 3.0
//   갑옷 def% = baseDef × coef × (1 + trait_pct)  (+ 체력 × 0.3 × coef, stats.ts에서)
const baseSpecLines = computed(() => {
  const lines: string[] = []
  const fmt = (n: number) => (n >= 0 ? '+' : '') + (n * 100).toFixed(0) + '%'
  if (weaponBase.value) {
    const base = weaponBase.value.baseAtk
    const traitPctBase = (traitBase.value.공격력_pct ?? 0) + (traitBase.value.전스탯_pct ?? 0)
    const mult = base * coef.value * (1 + traitPctBase)
    lines.push(
      `atk 계수 ${base.toFixed(2)} × ${coef.value.toFixed(2)} × (1${fmt(traitPctBase)}) = ${mult.toFixed(2)} (× 힘 × 3.0)`,
    )
  }
  if (armorBase.value) {
    const baseD = armorBase.value.baseDef
    const defPctBase = (traitBase.value.방어력_pct ?? 0) + (traitBase.value.전스탯_pct ?? 0)
    const dF = baseD * coef.value * (1 + defPctBase)
    lines.push(
      `방어 ${baseD} × ${coef.value.toFixed(2)} × (1${fmt(defPctBase)}) = ${dF.toFixed(2)}%  (+ 체력 × 0.3 × ${coef.value.toFixed(2)})`,
    )
  }
  return lines
})

// 자동/각인 스킬 — 무기 변주 스킬 및 갑옷 비전 각인 모두 표시
const skillKey = computed(() => props.item.skillKey ?? weaponBase.value?.autoSkill ?? null)
const skill = computed(() => skillKey.value ? SKILLS[skillKey.value] : null)
const skillProcPct = computed(() => {
  if (!skill.value) return null
  if (!isWeapon.value) return 35
  if (!props.character) return null
  const virtualChar = { ...props.character, weapon: props.item }
  return Math.round(
    computeWeaponSkillProc(virtualChar as Character, props.character.stats.행운) * 100
  )
})
const skillLine = computed(() => {
  if (!skill.value) return null
  const procStr = skillProcPct.value !== null ? ` · 발동률 ${skillProcPct.value}%` : ''
  return `${skill.value.name} (마나 ${skill.value.mp}${procStr}) — ${skill.value.description}`
})

// 명중/회피/공격주기 한 줄 — v9
const acc = computed(() => {
  let t = 0
  if (weaponBase.value) t += weaponBase.value.accBonus
  if (effects.value.명중) t += effects.value.명중
  return t
})
const eva = computed(() => {
  let t = 0
  if (weaponBase.value) t += weaponBase.value.evaBonus
  if (armorBase.value) t += armorBase.value.evasion
  if (effects.value.회피) t += effects.value.회피
  return t
})
const speedPctTrait = computed(() => effects.value.속도_pct ?? 0)
// 무기 ticks (게이지 임계값) 또는 갑옷 speedMult
const weaponTicks = computed(() => {
  if (!weaponBase.value) return 0
  return Math.round(10 / weaponBase.value.speedCoef)
})
const armorSpeedMult = computed(() => armorBase.value?.speedMult ?? 1)

const moveLine = computed(() => {
  const parts: string[] = []
  if (acc.value !== 0) parts.push(`명중 ${acc.value >= 0 ? '+' : ''}${acc.value.toFixed(0)}`)
  if (eva.value !== 0) parts.push(`회피 ${eva.value >= 0 ? '+' : ''}${eva.value.toFixed(0)}`)
  if (weaponBase.value) parts.push(`공격주기 ${weaponTicks.value}틱`)
  if (armorBase.value && armorSpeedMult.value !== 1) {
    parts.push(`갑옷 게이지 ×${armorSpeedMult.value.toFixed(2)}`)
  }
  if (speedPctTrait.value !== 0) {
    parts.push(`게이지 ${speedPctTrait.value >= 0 ? '+' : ''}${(speedPctTrait.value * 100).toFixed(0)}%`)
  }
  return parts.join(' / ')
})

// 특수 효과 한 줄
const specialLine = computed(() => {
  const e = effects.value
  const parts: string[] = []
  const pushPct = (label: string, v: number | undefined) => {
    if (v === undefined || v === 0) return
    parts.push(`${label} ${(v * 100).toFixed(2)}%`)
  }
  const pushFlat = (label: string, v: number | undefined) => {
    if (v === undefined || v === 0) return
    parts.push(`${label} ${v >= 0 ? '+' : ''}${v.toFixed(2)}`)
  }
  pushPct('흡혈', e.lifesteal)
  pushPct('자해', e.self_dot_pct)
  pushPct('대언데드', e.vs_undead_pct)
  pushPct('점화', e.burn_chance)
  pushPct('출혈', e.bleed_chance)
  pushPct('독', e.poison_chance)
  pushPct('둔화', e.slow_chance)
  pushPct('암흑', e.blind_chance)
  pushPct('감전', e.shock_chance)
  pushFlat('행운', e.행운)
  pushFlat('상태저항', e.상태저항)
  pushFlat('마력', e.마력)
  pushFlat('관통', e.관통)
  pushPct('피격회복', e.damage_taken_heal_pct)
  // 갑옷 베이스 보너스 (로브 마력 +30, 가죽갑 회피 +12 등 — 특성 효과와 별도)
  if (armorBase.value) {
    if (armorBase.value.mpBonus) {
      parts.push(`마력 +${armorBase.value.mpBonus} (갑옷)`)
    }
    if (armorBase.value.evasion) {
      // 회피는 보정 라인에 이미 포함되므로 중복 표시 안 함
    }
  }
  return parts.join(', ')
})

// 장비 계수 (v9) — itemValue 의 atkValue/defValue 그대로 사용
const itemCoef = computed(() => ({
  atk: itemValue.value.atkValue,
  def: itemValue.value.defValue,
}))

const totalScore = computed(() => itemCoef.value.atk + itemCoef.value.def)

// ── 챕터별 통과 가능성 색상 (착용 시 총합 score 기준) ──
//   3-tier: 빨강(위험) / 노랑(적정) / 초록(여유)
//   character 가 있을 때만 적용, 없으면 등급 테두리 fallback (gradeBorderClass)
const totalNewScore = computed(() => totalNew.value.atk + totalNew.value.def)
const dangerTier = computed(() => getDangerTier(currentChapter.value, totalNewScore.value))
const chapterThreshold = computed(() => getChapterThreshold(currentChapter.value))

// ── 챌린지 제약으로 못 쓰는 아이템 — 벨류·테두리 표시 안 함 ──
const isLocked = computed(() => {
  if (!game.challengeContext) return false
  return !canEquipItem(props.item, game.challengeContext).ok
})

// 장착 시 기본 능력치 변동 — 다중 항목 (v4)
//   무기: 공격력(종합 × 공속)
//   갑옷: 방어력 + 공격력(공속배율) + 공격력(마력보너스)
//   공통: 특성의 명중/회피
export type EquipDeltaKind = 'atk' | 'def' | 'neutral'
export interface EquipDelta {
  label: string
  // 합산형: amount (delta value), pct (vs baseline)
  amount?: number
  // 곱셈형: mult, pct
  mult?: number
  pct?: number
  kind: EquipDeltaKind
  note?: string
}

// v9 장착 변화 — 캐릭터 총합 기준 (무기 + 갑옷 합산)
const equipChanges = computed<EquipDelta[]>(() => {
  if (!props.character) return []
  const out: EquipDelta[] = []
  const newTotalAtk = totalNew.value.atk
  const newTotalDef = totalNew.value.def
  const curTotalAtk = totalCurrent.value.atk
  const curTotalDef = totalCurrent.value.def

  if (weaponBase.value || armorBase.value) {
    const dAtk = newTotalAtk - curTotalAtk
    if (Math.abs(dAtk) > 0.05) {
      out.push({
        label: '전투력(공)',
        amount: dAtk,
        pct: Math.abs(curTotalAtk) > 0.05 ? Math.max(-100, (dAtk / curTotalAtk) * 100) : 0,
        kind: 'atk',
        note: `${curTotalAtk.toFixed(1)} → ${newTotalAtk.toFixed(1)}`,
      })
    }
    const dDef = newTotalDef - curTotalDef
    if (Math.abs(dDef) > 0.05) {
      out.push({
        label: '전투력(방)',
        amount: dDef,
        pct: Math.abs(curTotalDef) > 0.05 ? Math.max(-100, (dDef / curTotalDef) * 100) : 0,
        kind: 'def',
        note: `${curTotalDef.toFixed(1)} → ${newTotalDef.toFixed(1)}`,
      })
    }
  }

  // 명중/회피 (단순 표시)
  const accBonus = (effects.value.명중 ?? 0) + (weaponBase.value?.accBonus ?? 0)
  if (Math.abs(accBonus) > 0.001) {
    out.push({ label: '명중', amount: accBonus, kind: 'neutral' })
  }
  const evaBonus = (effects.value.회피 ?? 0)
    + (armorBase.value?.evasion ?? 0)
    + (weaponBase.value?.evaBonus ?? 0)
  if (Math.abs(evaBonus) > 0.001) {
    out.push({ label: '회피', amount: evaBonus, kind: 'def' })
  }

  const order: Record<EquipDeltaKind, number> = { atk: 0, def: 1, neutral: 2 }
  out.sort((a, b) => order[a.kind] - order[b.kind])
  return out
})

// 현재 장착품과의 교체 비교 라인 (Δ 공격력 / Δ 방어력 등)
interface CompareDelta {
  label: string
  delta: number
  pctDelta?: number  // 현재 대비 변화율 (%)
  kind: EquipDeltaKind
}

const compareChanges = computed<CompareDelta[]>(() => {
  // v9: equipChanges 가 이미 itemValue 기반 단순 비교로 처리
  // 별도 비교 라인 불필요 (중복 제거)
  return []
})

// v6 등급 변화 한 줄: 점수 = 무기 티어 + 갑옷 티어
const rankLine = computed(() => {
  if (!props.character) return null
  if (currentChapter.value < 6) return null
  const c = props.character
  const curWT = c.weapon?.tier ?? 1
  const curAT = c.armor?.tier ?? 1
  const newWT = isWeapon.value ? props.item.tier : curWT
  const newAT = isWeapon.value ? curAT : props.item.tier
  const curScore = curWT + curAT  // tier 합계, 낮을수록 좋음
  const newScore = newWT + newAT
  const curRank = getClearRank(curScore)
  const newRank = getClearRank(newScore)
  const delta = newScore - curScore  // 양수면 점수 ↑ = 등급 ↓
  const bonusDelta = newRank.bonus - curRank.bonus
  return {
    text: `${curRank.rank}(${curRank.bonus}pt) → ${newRank.rank}(${newRank.bonus}pt) · 티어 ${delta >= 0 ? '+' : ''}${delta}`,
    bonusDelta,
    delta,
  }
})
</script>

<template>
  <div
    :class="[
      'space-y-0.5 text-xs font-mono leading-tight border-2 rounded p-1.5',
      isLocked
        ? 'border-slate-700/50 opacity-70'
        : character ? dangerTier.borderClass : gradeBorderClass[item.grade],
    ]"
    :title="isLocked
      ? '챌린지로 사용 불가'
      : character ? `현재 ch${currentChapter} 통과 — ${dangerTier.label} (합계 ${totalNewScore.toFixed(1)}, 임계 운빨≥${chapterThreshold.p25.toFixed(1)} / 여유≥${chapterThreshold.p75.toFixed(1)})` : undefined"
  >
    <!-- 헤더 (아이콘 + 이름) -->
    <div class="flex items-center gap-2">
      <img
        v-if="itemImageUrl(item.kind, item.baseKey)"
        :src="itemImageUrl(item.kind, item.baseKey)!"
        :alt="item.baseKey"
        :class="['w-10 h-10 object-contain flex-shrink-0 border rounded bg-bg-tertiary/50 p-0.5', gradeBorderClass[item.grade]]"
        @error="(e) => ((e.target as HTMLImageElement).style.display = 'none')"
      />
      <div class="flex-1 min-w-0">
        <div :class="[tierColorClass(item.tier), 'text-sm']">
          <ItemName
            :item="item"
            clickable
            @clickTrait="openTraitInfo"
            @clickGrade="openGradeInfo"
            @clickBase="openBaseInfo"
          />
        </div>
        <!-- 전투력 — 공/방 표시
             장착 중: 착용중(공벨류) / 착용중(방벨류)
             보유/판매: 착용시 총량(변화량 ±N) / 착용시 총량(변화량 ±N)
             총량 부분 클릭 → 계산 이유 모달 -->
        <div v-if="!isLocked" class="flex items-center gap-1.5 mt-0.5 text-xs font-bold flex-wrap">
          <!-- 공 -->
          <button
            v-if="Math.abs(totalNew.atk) > 0.05 || Math.abs(itemValue.atkValue) > 0.05"
            class="bg-stat-phys_atk/15 hover:bg-stat-phys_atk/25 rounded px-2 py-0.5 transition-colors flex items-center gap-1"
            @click.stop="openValueModal('atk')"
            :title="character && !isSameAsEquipped ? tI18n('itemd.atkWornTooltip', `착용 시 공 ${totalNew.atk.toFixed(1)} (${atkDelta >= 0 ? '+' : ''}${atkDelta.toFixed(1)})`, { atk: totalNew.atk.toFixed(1), delta: (atkDelta >= 0 ? '+' : '') + atkDelta.toFixed(1) }) : tI18n('itemd.atkTooltip', '전투력(공) 상세')"
          >
            <span class="text-stat-phys_atk text-xs opacity-80">{{ tI18n('itemd.atkShort', '공') }}</span>
            <template v-if="character && isSameAsEquipped">
              <!-- 장착 중 — 단일 총량만 -->
              <span class="text-gray-400 text-xs">{{ tI18n('itemd.equipped', '착용중') }}</span>
              <span class="text-stat-phys_atk text-sm">{{ totalNew.atk.toFixed(1) }}</span>
            </template>
            <template v-else-if="character">
              <!-- 보유/판매 — 총량 (변화량) -->
              <span class="text-stat-phys_atk text-sm">{{ totalNew.atk.toFixed(1) }}</span>
              <span
                :class="[atkDelta > 0.05 ? 'text-log-reward' : atkDelta < -0.05 ? 'text-status-burn' : 'text-gray-500', 'text-xs']"
              >
                (<template v-if="Math.abs(atkDelta) < 0.05">0</template><template v-else>{{ atkDelta >= 0 ? '+' : '' }}{{ atkDelta.toFixed(1) }}</template>)
              </span>
            </template>
            <template v-else>
              <!-- character 없음 — 단일 값 -->
              <span class="text-stat-phys_atk text-sm">{{ itemValue.atkValue.toFixed(1) }}</span>
            </template>
          </button>

          <!-- 방 -->
          <button
            v-if="Math.abs(totalNew.def) > 0.05 || Math.abs(itemValue.defValue) > 0.05"
            class="bg-stat-phys_def/15 hover:bg-stat-phys_def/25 rounded px-2 py-0.5 transition-colors flex items-center gap-1"
            @click.stop="openValueModal('def')"
            :title="character && !isSameAsEquipped ? tI18n('itemd.defWornTooltip', `착용 시 방 ${totalNew.def.toFixed(1)} (${defDelta >= 0 ? '+' : ''}${defDelta.toFixed(1)})`, { def: totalNew.def.toFixed(1), delta: (defDelta >= 0 ? '+' : '') + defDelta.toFixed(1) }) : tI18n('itemd.defTooltip', '전투력(방) 상세')"
          >
            <span class="text-stat-phys_def text-xs opacity-80">{{ tI18n('itemd.defShort', '방') }}</span>
            <template v-if="character && isSameAsEquipped">
              <span class="text-gray-400 text-xs">{{ tI18n('itemd.equipped', '착용중') }}</span>
              <span class="text-stat-phys_def text-sm">{{ totalNew.def.toFixed(1) }}</span>
            </template>
            <template v-else-if="character">
              <span class="text-stat-phys_def text-sm">{{ totalNew.def.toFixed(1) }}</span>
              <span
                :class="[defDelta > 0.05 ? 'text-log-reward' : defDelta < -0.05 ? 'text-status-burn' : 'text-gray-500', 'text-xs']"
              >
                (<template v-if="Math.abs(defDelta) < 0.05">0</template><template v-else>{{ defDelta >= 0 ? '+' : '' }}{{ defDelta.toFixed(1) }}</template>)
              </span>
            </template>
            <template v-else>
              <span class="text-stat-phys_def text-sm">{{ itemValue.defValue.toFixed(1) }}</span>
            </template>
          </button>
        </div>
      </div>
    </div>

    <!-- 스킬 인라인 칩 — 클릭 시 상세 모달
         좌측: 아이콘 + 스킬명 (발동확률%) / 우측: MP 소모량 -->
    <button
      v-if="skill && skillKey"
      type="button"
      class="mt-0.5 w-full text-left flex items-center gap-1.5 px-2 py-1 rounded-md bg-cyan-950/30 hover:bg-cyan-950/50 active:scale-[0.99] transition border border-cyan-500/30"
      @click.stop="openSkillModal"
    >
      <img
        :src="skillIconUrl(skillKey)"
        :alt="tdI18n('skill', skill.key) || skill.name"
        class="w-6 h-6 object-contain drop-shadow flex-shrink-0"
        @error="(e) => ((e.target as HTMLImageElement).style.display = 'none')"
      />
      <span class="text-cyan-200 font-bold text-xs">{{ tdI18n('skill', skill.key) || skill.name }}</span>
      <span v-if="skillProcPct !== null" class="text-stat-util font-mono font-bold text-xs">({{ skillProcPct }}%)</span>
      <span class="ml-auto text-stat-mp font-mono font-bold text-xs">{{ skill.mp }} MP</span>
    </button>

    <!-- v11: 하급 똥템 숨은 허점 (발견형 힌트 / 해금 배지) -->
    <button
      v-if="quirkInfo"
      type="button"
      class="mt-1 w-full text-left flex items-center gap-1.5 px-2 py-1 rounded-md border transition active:scale-[0.99]"
      :class="isQuirkDiscovered
        ? 'bg-amber-950/45 border-amber-400/60 text-amber-200 hover:bg-amber-950/65'
        : 'bg-slate-900/60 border-amber-500/30 text-amber-300/80 hover:bg-slate-800/70'"
      @click.stop="openTraitInfo"
    >
      <span class="text-xs shrink-0">💡</span>
      <span v-if="isQuirkDiscovered" class="text-[11px] font-bold truncate">
        {{ lang === 'en' ? quirkInfo.nameEn : quirkInfo.nameKo }}
      </span>
      <span v-else class="text-[11px] italic truncate">
        {{ lang === 'en' ? quirkInfo.hintEn : quirkInfo.hintKo }}
      </span>
    </button>


    <!-- 벨류 분해 모달 — Teleport 로 body 직속에 부착 (부모 backdrop-blur 가 fixed containing block 을 변경하는 문제 회피) -->
    <Teleport to="body">
    <div
      v-if="valueModal"
      class="fixed inset-0 z-[80] flex items-center justify-center bg-black/80 px-3 py-6"
      @click.self="valueModal = null"
      @click.stop
    >
      <div class="panel max-w-sm w-full space-y-2" @click.stop>
        <div class="flex items-center justify-between">
          <div class="text-base font-bold">
            <span v-if="valueModal.kind === 'atk'" class="text-stat-phys_atk">{{ tI18n('itemd.atkBreakdownTitle', '전투력(공) 총량 분해') }}</span>
            <span v-else class="text-stat-phys_def">{{ tI18n('itemd.defBreakdownTitle', '전투력(방) 총량 분해') }}</span>
          </div>
          <button class="text-base leading-none hover:bg-slate-700 rounded w-7 h-7 flex items-center justify-center" @click="valueModal = null">✕</button>
        </div>

        <!-- 총량 + 변화량 헤더 -->
        <div class="bg-bg-tertiary/60 rounded px-3 py-2">
          <div class="flex items-baseline justify-between mb-1">
            <span class="text-xs">{{ tI18n('itemd.totalIfEquipped', '착용 시 총량') }}</span>
            <div>
              <span class="text-2xl font-mono font-bold text-log-reward">{{ valueModal.totalIfEquipped.toFixed(1) }}</span>
              <span
                v-if="character && !isSameAsEquipped"
                :class="[valueModal.delta > 0.05 ? 'text-log-reward' : valueModal.delta < -0.05 ? 'text-status-burn' : 'text-gray-100', 'ml-1.5 text-sm font-mono']"
              >
                ({{ valueModal.delta >= 0 ? '+' : '' }}{{ valueModal.delta.toFixed(1) }})
              </span>
            </div>
          </div>
          <div class="text-xs space-y-0.5">
            <div>= {{ tI18n('itemd.thisItem', '이 아이템') }} <span class="font-mono font-bold">{{ valueModal.itemContribution.toFixed(1) }}</span>
                 + {{ tI18n('itemd.otherSlot', '다른 슬롯') }} <span class="font-mono font-bold">{{ valueModal.otherContribution.toFixed(1) }}</span></div>
            <div v-if="character && !isSameAsEquipped">
              {{ tI18n('itemd.currentTotal', '현재 총량') }} <span class="font-mono">{{ valueModal.currentTotal.toFixed(1) }}</span>
              → {{ tI18n('itemd.delta', '변화량') }} {{ valueModal.delta >= 0 ? '+' : '' }}{{ valueModal.delta.toFixed(1) }}
            </div>
          </div>
        </div>

        <!-- 이 아이템의 기여 분해 -->
        <div class="text-xs mt-1 font-bold">{{ tI18n('itemd.thisItemContribution', '이 아이템의 기여') }} ({{ valueModal.itemContribution.toFixed(1) }})</div>
        <div v-if="valueModal.parts.length === 0" class="text-xs text-center py-2">{{ tI18n('itemd.noContribution', '기여 없음') }}</div>
        <div v-else class="space-y-1 text-xs">
          <div
            v-for="(p, i) in valueModal.parts"
            :key="i"
            class="bg-bg-tertiary rounded px-2 py-1.5 flex items-baseline justify-between"
          >
            <div class="flex-1 min-w-0">
              <div class="truncate">{{ tLabelI18n(p.label) }}</div>
              <div v-if="p.note" class="text-xs truncate opacity-80">{{ tLabelI18n(p.note) }}</div>
            </div>
            <div :class="[p.value >= 0 ? 'text-log-skill' : 'text-status-burn', 'font-mono font-bold ml-2 shrink-0']">
              {{ p.value >= 0 ? '+' : '' }}{{ p.value.toFixed(2) }}
            </div>
          </div>
        </div>
        <button class="btn-secondary w-full text-xs min-h-9" @click="valueModal = null">{{ tI18n('common.close', '닫기') }}</button>
      </div>
    </div>
    </Teleport>

    <!-- 스킬 상세 모달 — Combat 의 스킬 모달과 동일 패턴 -->
    <Teleport to="body">
    <div
      v-if="skillModalOpen && skill && skillKey"
      class="fixed inset-0 z-[80] flex items-center justify-center px-4 bg-black/70 backdrop-blur-sm"
      @click.self="closeSkillModal"
    >
      <div class="w-full max-w-xs rounded-xl border-2 border-cyan-400/60 bg-bg-secondary/95 shadow-[0_0_30px_rgba(34,211,238,0.35)] overflow-hidden">
        <!-- 헤더 -->
        <div class="px-4 py-3 bg-cyan-950/40 border-b border-cyan-500/30 flex items-center gap-3">
          <img
            :src="skillIconUrl(skillKey)"
            :alt="tdI18n('skill', skill.key) || skill.name"
            class="w-10 h-10 object-contain drop-shadow"
            @error="(e) => ((e.target as HTMLImageElement).style.display = 'none')"
          />
          <div class="flex-1 min-w-0">
            <div class="text-base font-bold text-cyan-200 truncate">{{ tdI18n('skill', skill.key) || skill.name }}</div>
            <div class="text-xs flex items-center gap-1.5 flex-wrap">
              <span :class="skillKindColor[skill.kind]">{{ skillKindLabel[skill.kind]?.() }}</span>
              <span v-if="skill.element">· {{ tdI18n('element', skill.element) }}</span>
            </div>
          </div>
          <button
            type="button"
            class="w-7 h-7 flex items-center justify-center rounded text-base hover:bg-slate-700"
            @click="closeSkillModal"
            :aria-label="tI18n('common.close', '닫기')"
          >✕</button>
        </div>
        <!-- 본문 -->
        <div class="px-4 py-3 pb-4 space-y-2 text-sm">
          <p class="leading-relaxed">{{ tdI18n('skill.desc', skill.key) || skill.description }}</p>
          <div class="flex items-center justify-between pt-2 border-t border-slate-700/60 text-xs">
            <span class="text-stat-mp">{{ tI18n('combat.mpCost', '소모 MP') }} <span class="font-bold">{{ skill.mp }}</span></span>
            <span v-if="skillProcPct !== null" class="text-stat-util">{{ tI18n('combat.procRate', '발동률') }} <span class="font-bold">{{ skillProcPct }}%</span></span>
          </div>
        </div>
      </div>
    </div>
    </Teleport>

    <!-- 정보 모달 — 특성/등급/베이스 클릭 시 -->
    <Teleport to="body">
    <div
      v-if="infoModal"
      class="fixed inset-0 z-[80] flex items-center justify-center px-4 bg-black/70 backdrop-blur-sm"
      @click.self="closeInfoModal"
    >
      <div class="w-full max-w-xs rounded-xl border-2 border-cyan-400/60 bg-bg-secondary/95 shadow-[0_0_30px_rgba(34,211,238,0.35)] overflow-hidden">
        <!-- 헤더 -->
        <div class="px-4 py-3 bg-cyan-950/40 border-b border-cyan-500/30 flex items-center gap-3">
          <div class="flex-1 min-w-0">
            <div class="text-base font-bold text-cyan-200 truncate">{{ tLabelI18n(infoModal.title) }}</div>
            <div v-if="infoModal.subtitle" class="text-xs text-cyan-300/70 truncate">{{ tLabelI18n(infoModal.subtitle) }}</div>
          </div>
          <button
            type="button"
            class="w-7 h-7 flex items-center justify-center rounded text-base hover:bg-slate-700"
            @click="closeInfoModal"
            :aria-label="tI18n('common.close', '닫기')"
          >✕</button>
        </div>
        <!-- 본문 -->
        <div class="px-4 py-3 pb-4 space-y-1.5 text-sm">
          <div
            v-for="(ln, i) in infoModal.lines"
            :key="i"
            class="bg-bg-tertiary/60 rounded px-2.5 py-1.5"
          >
            <div class="flex items-baseline justify-between gap-2">
              <span class="text-gray-200 font-bold">{{ tLabelI18n(ln.label) }}</span>
              <span v-if="ln.value" class="text-log-skill font-mono font-bold">{{ ln.value }}</span>
            </div>
            <div v-if="ln.note" class="text-xs text-gray-400 mt-0.5">{{ tLabelI18n(ln.note) }}</div>
          </div>
        </div>
      </div>
    </div>
    </Teleport>
  </div>
</template>
