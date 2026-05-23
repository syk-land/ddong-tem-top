<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useGameStore } from '@/stores/game'
import { statColorClass, tierColorClass, gradeColorClass } from '@/ui/colors'
import ItemName from '@/ui/components/ItemName.vue'
import StatusBadges from '@/ui/components/StatusBadges.vue'
import { computeEffectiveStats } from '@/core/stats'
import { SKILLS } from '@/data/skills'
import { CHALLENGES_MAP } from '@/data/challenges'
import { WEAPONS } from '@/data/weapons'
import { ARMORS } from '@/data/armor'
import { WEAPON_TRAITS, ARMOR_TRAITS } from '@/data/traits'

const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{ (e: 'close'): void }>()

const game = useGameStore()

// 상태창이 처음 열리면 first_status 튜토리얼 트리거
watch(() => props.open, (v) => {
  if (v) game.triggerTutorial('first_status')
})

const c = computed(() => game.run!.character)
const effective = computed(() => computeEffectiveStats(c.value))
const skillKeys = computed(() => game.availableSkills)
const weaponProcPct = computed(() => game.weaponSkillProcPct)

// 탭
const tab = ref<'base' | 'detail'>('base')

// 상세 능력치 클릭 시 breakdown 모달
interface Breakdown { from: string; value: number; note?: string }
const detailModal = ref<{ name: string; total: number; entries: Breakdown[] } | null>(null)

// 현재 활성 챌린지
const activeChallenges = computed(() => {
  const ctx = game.challengeContext
  if (!ctx) return []
  return ctx.active.map((ac) => {
    const def = CHALLENGES_MAP[ac.key]
    return { ac, def }
  }).filter((e) => e.def !== undefined)
})

async function unequipSlot(slot: 'weapon' | 'armor') {
  const result = game.unequipToInventory(slot)
  if (!result.ok) await game.alertModal(result.reason ?? '해제 실패', '해제 실패')
}
function effectEntries(item: { effects: Record<string, number | undefined> }) {
  return Object.entries(item.effects).filter(([, v]) => v !== undefined && v !== 0)
}
function formatValue(v: number): string {
  return Math.abs(v) < 1 ? (v * 100).toFixed(1) + '%' : v.toFixed(1)
}

// ===== v9 Breakdown =====
// 공격력 = 힘 × 무기공격 × 등급 × (1 + 공격%) × 3.0
function breakdownAtk(): Breakdown[] {
  const s = c.value.stats
  const w = c.value.weapon
  const wb = w ? WEAPONS[w.baseKey] : null
  if (!w || !wb) return [{ from: '미 착용', value: 0, note: '무기 없음' }]
  const t = WEAPON_TRAITS[w.trait]?.effects ?? {}
  const pct = (t.공격력_pct ?? 0) + (t.전스탯_pct ?? 0)
  const total = s.힘 * wb.baseAtk * w.coef * (1 + pct) * 3.0
  return [
    {
      from: '곱셈 모델',
      value: total,
      note: `힘 ${s.힘} × 무기공격 ${wb.baseAtk} × 등급 ${w.coef.toFixed(2)} × (1${pct >= 0 ? '+' : ''}공격% ${(pct * 100).toFixed(0)}%) × 3.0`,
    },
  ]
}
// 마법공격력 = 마력 × 무기공격 × 등급 × (1 + 공격%) × 1.5 × 로브시너지
function breakdownMagicAtk(): Breakdown[] {
  const s = c.value.stats
  const w = c.value.weapon
  const a = c.value.armor
  const wb = w ? WEAPONS[w.baseKey] : null
  if (!w || !wb || !wb.isMagic) return [{ from: '마법 무기 아님', value: 0 }]
  const t = WEAPON_TRAITS[w.trait]?.effects ?? {}
  const pct = (t.공격력_pct ?? 0) + (t.전스탯_pct ?? 0)
  const synergy = a?.baseKey === '로브' ? 1.5 : 1.0
  const total = s.마력 * wb.baseAtk * w.coef * (1 + pct) * 1.5 * synergy
  return [
    {
      from: '곱셈 모델',
      value: total,
      note: `마력 ${s.마력} × 무기공격 ${wb.baseAtk} × 등급 ${w.coef.toFixed(2)} × (1${pct >= 0 ? '+' : ''}공격% ${(pct * 100).toFixed(0)}%) × 1.5${synergy !== 1 ? ` × 로브 시너지 1.5` : ''}`,
    },
  ]
}
// 방어% = 갑옷방어 × 등급 × (1 + 방어%) + 체력 × 0.3 × 등급
function breakdownDef(): Breakdown[] {
  const s = c.value.stats
  const a = c.value.armor
  const ab = a ? ARMORS[a.baseKey as keyof typeof ARMORS] : null
  const coef = a?.coef ?? 0
  const out: Breakdown[] = [
    { from: `체력 × 0.3 × 등급 ${coef.toFixed(2)}`, value: s.체력 * 0.3 * coef, note: `체력 ${s.체력}` },
  ]
  if (a && ab) {
    const t = ARMOR_TRAITS[a.trait]?.effects ?? {}
    const pct = (t.방어력_pct ?? 0) + (t.전스탯_pct ?? 0)
    const armorPart = ab.baseDef * a.coef * (1 + pct)
    out.push({
      from: `갑옷 (${a.baseKey})`,
      value: armorPart,
      note: `갑옷방어 ${ab.baseDef} × 등급 ${a.coef.toFixed(2)} × (1${pct >= 0 ? '+' : ''}방어% ${(pct * 100).toFixed(0)}%)`,
    })
  }
  return out
}
// 게이지 가속 = 1 + 민첩 × 1% + 속도%
function breakdownSpeed(): Breakdown[] {
  const s = c.value.stats
  const w = c.value.weapon
  const a = c.value.armor
  const ab = a ? ARMORS[a.baseKey as keyof typeof ARMORS] : null
  const out: Breakdown[] = [
    { from: '베이스', value: 1.0, note: '매 틱 +1 누적' },
    { from: `민첩 × 1%`, value: s.민첩 / 100, note: `민첩 ${s.민첩} → +${s.민첩}%` },
  ]
  if (w?.effects.속도_pct) {
    const pct = w.effects.속도_pct
    out.push({ from: '무기 특성 (속도)', value: pct, note: `× (1${pct >= 0 ? '+' : ''}${(pct * 100).toFixed(0)}%)` })
  }
  if (a?.effects.속도_pct) {
    const pct = a.effects.속도_pct
    out.push({ from: '갑옷 특성 (속도)', value: pct, note: `× (1${pct >= 0 ? '+' : ''}${(pct * 100).toFixed(0)}%)` })
  }
  if (ab && ab.speedMult !== 1) {
    out.push({ from: `갑옷 속도배율 (${a!.baseKey})`, value: 0, note: `× ${ab.speedMult.toFixed(2)}` })
  }
  return out
}
// 명중 = 60 + 무기 + 특성 + 민첩×0.5 + 행운×0.1
function breakdownAcc(): Breakdown[] {
  const s = c.value.stats
  const w = c.value.weapon
  const a = c.value.armor
  const out: Breakdown[] = [
    { from: '베이스', value: 60 },
    { from: '민첩 × 0.5', value: s.민첩 * 0.5 },
    { from: '행운 × 0.1', value: s.행운 * 0.1 },
  ]
  if (w?.effects.명중) out.push({ from: `무기 특성 (명중)`, value: w.effects.명중 })
  if (a?.effects.명중) out.push({ from: `갑옷 특성 (명중)`, value: a.effects.명중 })
  const wb = w ? WEAPONS[w.baseKey] : null
  if (wb?.accBonus) out.push({ from: `무기 기본 명중 (${w!.baseKey})`, value: wb.accBonus })
  return out
}
// 회피 = 5 + 무기 + 특성 + 갑옷 회피 + 민첩×0.5 + 행운×0.1
function breakdownEva(): Breakdown[] {
  const s = c.value.stats
  const w = c.value.weapon
  const a = c.value.armor
  const out: Breakdown[] = [
    { from: '베이스', value: 5 },
    { from: '민첩 × 0.5', value: s.민첩 * 0.5 },
    { from: '행운 × 0.1', value: s.행운 * 0.1 },
  ]
  if (w?.effects.회피) out.push({ from: `무기 특성 (회피)`, value: w.effects.회피 })
  if (a?.effects.회피) out.push({ from: `갑옷 특성 (회피)`, value: a.effects.회피 })
  const wb = w ? WEAPONS[w.baseKey] : null
  if (wb?.evaBonus) out.push({ from: `무기 기본 회피 (${w!.baseKey})`, value: wb.evaBonus })
  const ab = a ? ARMORS[a.baseKey as keyof typeof ARMORS] : null
  if (ab?.evasion) out.push({ from: `갑옷 기본 회피 (${a!.baseKey})`, value: ab.evasion })
  return out
}
// 관통% — 무기 기본 관통 + 무기 특성 (스탯 영향 없음)
function breakdownPen(): Breakdown[] {
  const w = c.value.weapon
  const out: Breakdown[] = []
  if (w?.effects.관통) out.push({ from: `무기 특성 (관통)`, value: w.effects.관통 })
  const wb = w ? WEAPONS[w.baseKey] : null
  if (wb?.penBonus) out.push({ from: `무기 기본 관통 (${w!.baseKey})`, value: wb.penBonus })
  if (wb?.magicPenBonus) out.push({ from: `무기 마법 관통`, value: wb.magicPenBonus })
  if (out.length === 0) out.push({ from: '없음', value: 0 })
  return out
}
function breakdownResist(): Breakdown[] {
  const s = c.value.stats
  const w = c.value.weapon
  const a = c.value.armor
  const out: Breakdown[] = [
    { from: '체력 × 0.5', value: s.체력 * 0.5 },
    { from: '마력 × 0.5', value: s.마력 * 0.5 },
    { from: '행운 × 0.3', value: s.행운 * 0.3 },
  ]
  if (w?.effects.상태저항) out.push({ from: `무기 특성 (저항)`, value: w.effects.상태저항 })
  if (a?.effects.상태저항) out.push({ from: `갑옷 특성 (저항)`, value: a.effects.상태저항 })
  return out
}
// v9 크리
function breakdownCritChance(): Breakdown[] {
  const s = c.value.stats
  return [
    { from: '민첩 × 0.3%', value: s.민첩 * 0.003, note: `민첩 ${s.민첩} → ${(s.민첩 * 0.3).toFixed(1)}%` },
  ]
}
function breakdownCritMult(): Breakdown[] {
  const s = c.value.stats
  return [
    { from: '베이스', value: 1.3 },
    { from: '행운 × 1%', value: s.행운 / 100, note: `행운 ${s.행운}` },
  ]
}

function openDetail(name: string, total: number, entries: Breakdown[]) {
  detailModal.value = { name, total, entries }
}

// ===== 5스탯 클릭 시 — 해당 스탯이 직접 기여하는 능력치만 표시 =====
function breakdownStat힘(): Breakdown[] {
  const s = c.value.stats
  const w = c.value.weapon
  const wb = w ? WEAPONS[w.baseKey] : null
  if (w && wb) {
    const t = WEAPON_TRAITS[w.trait]?.effects ?? {}
    const pct = (t.공격력_pct ?? 0) + (t.전스탯_pct ?? 0)
    // 활은 힘 + 민첩×0.3 인데, 여기는 "힘 기여"만 분리
    return [
      { from: '공격력', value: s.힘 * wb.baseAtk * w.coef * (1 + pct) * 3.0,
        note: `힘 ${s.힘} × 무기공격 ${wb.baseAtk} × 등급 ${w.coef.toFixed(2)} × (1${pct >= 0 ? '+' : ''}공격% ${(pct * 100).toFixed(0)}%) × 3.0` },
    ]
  }
  return [{ from: '공격력', value: 0, note: '무기 없음 — 미 착용' }]
}
function breakdownStat민첩(): Breakdown[] {
  const s = c.value.stats
  return [
    { from: '게이지 가속', value: s.민첩 / 100, note: `민첩 × 1% = +${s.민첩}%` },
    { from: '명중', value: s.민첩 * 0.5, note: '민첩 × 0.5' },
    { from: '회피', value: s.민첩 * 0.5, note: '민첩 × 0.5' },
    { from: '크리 확률', value: s.민첩 * 0.003, note: `민첩 × 0.3% = ${(s.민첩 * 0.3).toFixed(1)}%` },
  ]
}
function breakdownStat체력(): Breakdown[] {
  const s = c.value.stats
  const a = c.value.armor
  const coef = a?.coef ?? 0
  const out: Breakdown[] = [
    { from: '방어', value: s.체력 * 0.3 * coef,
      note: a ? `체력 × 0.3 × 갑옷등급 ${coef.toFixed(2)} = +${(s.체력 * 0.3 * coef).toFixed(1)}%` : '갑옷 없음' },
    { from: '상태저항', value: s.체력 * 0.5, note: '체력 × 0.5' },
    { from: '최대 HP', value: c.value.maxHp, note: `체력 × 10 + 50 = ${c.value.maxHp}` },
  ]
  return out
}
function breakdownStat마력(): Breakdown[] {
  const s = c.value.stats
  const w = c.value.weapon
  const a = c.value.armor
  const wb = w ? WEAPONS[w.baseKey] : null
  const out: Breakdown[] = []
  if (w && wb?.isMagic) {
    const t = WEAPON_TRAITS[w.trait]?.effects ?? {}
    const pct = (t.공격력_pct ?? 0) + (t.전스탯_pct ?? 0)
    const synergy = a?.baseKey === '로브' ? 1.5 : 1.0
    out.push({
      from: '마법 공격력',
      value: s.마력 * wb.baseAtk * w.coef * (1 + pct) * 1.5 * synergy,
      note: `마력 ${s.마력} × 무기공격 ${wb.baseAtk} × 등급 ${w.coef.toFixed(2)} × (1${pct >= 0 ? '+' : ''}공격% ${(pct * 100).toFixed(0)}%) × 1.5${synergy !== 1 ? ' × 로브 시너지 1.5' : ''}`,
    })
  }
  out.push({ from: '상태저항', value: s.마력 * 0.5, note: '마력 × 0.5' })
  out.push({ from: '최대 MP', value: c.value.maxMp, note: `마력 × 15 + 30 = ${c.value.maxMp}` })
  return out
}
function breakdownStat행운(): Breakdown[] {
  const s = c.value.stats
  return [
    { from: '명중', value: s.행운 * 0.1, note: '행운 × 0.1' },
    { from: '회피', value: s.행운 * 0.1, note: '행운 × 0.1' },
    { from: '크리 배수', value: s.행운 / 100, note: `행운 × 1% = +${(s.행운 / 100).toFixed(2)}` },
    { from: '상태저항', value: s.행운 * 0.3, note: '행운 × 0.3' },
    { from: '스킬 발동률', value: s.행운 * 0.005,
      note: `보정 × (1 + 행운 × 0.5%) = × ${(1 + s.행운 * 0.005).toFixed(3)}` },
  ]
}

function showSkillDetail(key: string) {
  const skill = SKILLS[key]
  if (!skill) return
  const kindMap: Record<string, string> = {
    physical_atk: '물리 공격',
    magic_atk: '마법 공격',
    physical_def: '물리 방어/유틸',
    magic_def: '마법 방어/유틸',
  }
  const isAttack = skill.kind === 'physical_atk' || skill.kind === 'magic_atk'
  const lines = [
    `종류: ${kindMap[skill.kind] ?? skill.kind}`,
    `소모 MP: ${skill.mp}`,
    isAttack ? `발동률: ${weaponProcPct.value}%` : '발동: 조건부 (방어/회피 트리거)',
    '',
    skill.description,
  ]
  game.alertModal(lines.join('\n'), `⚡ ${skill.name}`)
}
</script>

<template>
  <Teleport to="body">
  <div
    v-if="props.open"
    class="fixed inset-0 z-40 flex items-center justify-center bg-black/70 px-3 py-6"
    @click.self="emit('close')"
  >
    <div data-tutorial-target="status-stats" class="panel max-w-lg w-full max-h-[90vh] overflow-y-auto space-y-3">
      <header class="flex items-center justify-between sticky top-0 bg-bg-panel z-10 -mx-3 px-3 py-1">
        <div class="text-lg font-bold">상태창</div>
        <button data-tutorial-target="status-close" class="text-gray-400 hover:text-white text-xl leading-none" @click="emit('close')">✕</button>
      </header>

      <!-- HP / MP / Gold -->
      <div class="grid grid-cols-3 gap-2 text-xs font-mono">
        <div class="bg-bg-tertiary rounded px-2 py-1.5">
          <div class="text-xs text-stat-hp">체력</div>
          <div>{{ c.hp }} / {{ c.maxHp }}</div>
        </div>
        <div class="bg-bg-tertiary rounded px-2 py-1.5">
          <div class="text-xs text-stat-mp">마력</div>
          <div>{{ c.mp }} / {{ c.maxMp }}</div>
        </div>
        <div class="bg-bg-tertiary rounded px-2 py-1.5">
          <div class="text-xs text-stat-luck">골드</div>
          <div>{{ c.gold }}G</div>
        </div>
      </div>

      <!-- 탭 -->
      <div class="flex gap-1 border-b border-slate-700">
        <button
          class="px-3 py-1.5 text-xs font-bold rounded-t"
          :class="tab === 'base' ? 'bg-bg-tertiary text-gray-100' : 'text-gray-500 hover:text-gray-300'"
          @click="tab = 'base'"
        >기본 능력치</button>
        <button
          data-tutorial-target="status-detail-tab"
          data-tutorial-cta-label="상세 능력치"
          class="px-3 py-1.5 text-xs font-bold rounded-t"
          :class="tab === 'detail' ? 'bg-bg-tertiary text-gray-100' : 'text-gray-500 hover:text-gray-300'"
          @click="tab = 'detail'"
        >상세 능력치</button>
      </div>

      <!-- 기본 능력치 — 각 스탯 탭하면 기여 능력치 분해 -->
      <div v-if="tab === 'base'" class="bg-bg-tertiary rounded p-2">
        <div class="grid grid-cols-2 gap-1.5 text-sm font-mono">
          <button
            data-tutorial-target="status-first-stat"
            data-tutorial-cta-label="힘"
            class="text-left bg-slate-800 hover:bg-slate-700 rounded px-3 py-2 min-h-11 transition-colors"
            @click="openDetail('힘', c.stats.힘, breakdownStat힘())">
            <span :class="statColorClass.힘" class="text-gray-500">힘</span>
            <span :class="statColorClass.힘" class="font-bold text-base ml-2">{{ c.stats.힘 }}</span>
          </button>
          <button class="text-left bg-slate-800 hover:bg-slate-700 rounded px-3 py-2 min-h-11 transition-colors"
                  @click="openDetail('민첩', c.stats.민첩, breakdownStat민첩())">
            <span :class="statColorClass.민첩" class="text-gray-500">민첩</span>
            <span :class="statColorClass.민첩" class="font-bold text-base ml-2">{{ c.stats.민첩 }}</span>
          </button>
          <button class="text-left bg-slate-800 hover:bg-slate-700 rounded px-3 py-2 min-h-11 transition-colors"
                  @click="openDetail('체력', c.stats.체력, breakdownStat체력())">
            <span :class="statColorClass.체력" class="text-gray-500">체력</span>
            <span :class="statColorClass.체력" class="font-bold text-base ml-2">{{ c.stats.체력 }}</span>
          </button>
          <button class="text-left bg-slate-800 hover:bg-slate-700 rounded px-3 py-2 min-h-11 transition-colors"
                  @click="openDetail('마력', c.stats.마력, breakdownStat마력())">
            <span :class="statColorClass.마력" class="text-gray-500">마력</span>
            <span :class="statColorClass.마력" class="font-bold text-base ml-2">{{ c.stats.마력 }}</span>
          </button>
          <button class="text-left bg-slate-800 hover:bg-slate-700 rounded px-3 py-2 min-h-11 transition-colors col-span-2"
                  @click="openDetail('행운', c.stats.행운, breakdownStat행운())">
            <span :class="statColorClass.행운" class="text-gray-500">행운</span>
            <span :class="statColorClass.행운" class="font-bold text-base ml-2">{{ c.stats.행운 }}</span>
          </button>
        </div>
      </div>

      <!-- 상세 능력치 (파생, 클릭 시 breakdown) -->
      <div v-if="tab === 'detail'" class="bg-bg-tertiary rounded p-2 space-y-1">
        <div class="text-xs text-gray-400 mb-1">파생 (장비/특성 포함) — 항목 클릭 시 상세 분해</div>
        <div class="grid grid-cols-2 gap-1 text-xs font-mono">
          <button class="text-left bg-slate-800 hover:bg-slate-700 rounded px-2 py-1"
                  @click="openDetail('공격력', effective.공격력, breakdownAtk())">
            <span class="text-stat-phys_atk">공격력</span> <span class="font-bold">{{ effective.공격력.toFixed(1) }}</span>
          </button>
          <button class="text-left bg-slate-800 hover:bg-slate-700 rounded px-2 py-1"
                  @click="openDetail('방어 %', effective.방어력_effective, breakdownDef())">
            <span class="text-stat-phys_def">방어</span> <span class="font-bold">{{ effective.방어력_effective.toFixed(1) }}%</span>
          </button>
          <button v-if="effective.isMagicWeapon" class="text-left bg-slate-800 hover:bg-slate-700 rounded px-2 py-1"
                  @click="openDetail('마법공격력', effective.마법공격력, breakdownMagicAtk())">
            <span class="text-stat-mp">마법공격</span> <span class="font-bold">{{ effective.마법공격력.toFixed(1) }}</span>
          </button>
          <button class="text-left bg-slate-800 hover:bg-slate-700 rounded px-2 py-1"
                  @click="openDetail('게이지 가속', effective.게이지가속, breakdownSpeed())">
            <span class="text-stat-speed">게이지</span> <span class="font-bold">×{{ effective.게이지가속.toFixed(2) }}</span>
          </button>
          <div class="bg-slate-800/60 rounded px-2 py-1">
            <span class="text-stat-speed">공격주기</span> <span class="font-bold">{{ effective.무기ticks }}틱</span>
          </div>
          <button class="text-left bg-slate-800 hover:bg-slate-700 rounded px-2 py-1"
                  @click="openDetail('명중', effective.명중률, breakdownAcc())">
            <span class="text-stat-util">명중</span> <span class="font-bold">{{ effective.명중률.toFixed(1) }}</span>
          </button>
          <button class="text-left bg-slate-800 hover:bg-slate-700 rounded px-2 py-1"
                  @click="openDetail('회피', effective.회피율, breakdownEva())">
            <span class="text-stat-util">회피</span> <span class="font-bold">{{ effective.회피율.toFixed(1) }}</span>
          </button>
          <button class="text-left bg-slate-800 hover:bg-slate-700 rounded px-2 py-1"
                  @click="openDetail('관통 %', effective.관통, breakdownPen())">
            <span class="text-stat-util">관통</span> <span class="font-bold">{{ effective.관통.toFixed(1) }}%</span>
          </button>
          <button class="text-left bg-slate-800 hover:bg-slate-700 rounded px-2 py-1"
                  @click="openDetail('크리 확률', effective.크리확률, breakdownCritChance())">
            <span class="text-stat-luck">크리%</span> <span class="font-bold">{{ (effective.크리확률 * 100).toFixed(1) }}%</span>
          </button>
          <button class="text-left bg-slate-800 hover:bg-slate-700 rounded px-2 py-1"
                  @click="openDetail('크리 배수', effective.크리배수, breakdownCritMult())">
            <span class="text-stat-luck">크리×</span> <span class="font-bold">×{{ effective.크리배수.toFixed(2) }}</span>
          </button>
          <button class="text-left bg-slate-800 hover:bg-slate-700 rounded px-2 py-1"
                  @click="openDetail('상태저항', effective.상태저항, breakdownResist())">
            <span class="text-stat-util">상태저항</span> <span class="font-bold">{{ effective.상태저항.toFixed(1) }}</span>
          </button>
          <div class="bg-slate-800/60 rounded px-2 py-1">
            <span class="text-stat-hp">HP</span> <span class="font-bold">{{ c.maxHp }}</span>
          </div>
          <div class="bg-slate-800/60 rounded px-2 py-1">
            <span class="text-stat-mp">MP</span> <span class="font-bold">{{ c.maxMp }}</span>
          </div>
        </div>
      </div>

      <!-- 상태이상 -->
      <div v-if="c.statuses.length > 0" class="bg-bg-tertiary rounded p-2 space-y-1">
        <div class="text-xs text-gray-400 mb-1">상태이상</div>
        <StatusBadges :statuses="c.statuses" />
      </div>

      <!-- 장착 무기 -->
      <div class="bg-bg-tertiary rounded p-2 space-y-2">
        <div class="flex items-center justify-between">
          <div class="text-xs text-gray-400">무기</div>
          <button
            v-if="c.weapon"
            class="text-xs px-2 py-0.5 rounded bg-slate-700 text-gray-300 hover:bg-slate-600"
            @click="unequipSlot('weapon')"
          >해제</button>
        </div>
        <div v-if="c.weapon">
          <div :class="[tierColorClass(c.weapon.tier), 'font-mono text-sm']">
            <ItemName :item="c.weapon" />
          </div>
          <div class="text-xs text-gray-500">
            T{{ c.weapon.tier }} ·
            <span :class="gradeColorClass[c.weapon.grade]">{{ c.weapon.grade }}</span>
            · 등급계수 {{ c.weapon.coef.toFixed(2) }}
          </div>
          <div v-if="effectEntries(c.weapon as any).length > 0" class="mt-1 text-xs grid grid-cols-2 gap-x-3 font-mono">
            <div v-for="[k, v] in effectEntries(c.weapon as any)" :key="k" class="text-gray-300">
              <span class="text-gray-500">{{ k }}:</span> <span class="text-log-skill">{{ formatValue(v as number) }}</span>
            </div>
          </div>
        </div>
        <div v-else class="text-xs text-gray-600">미 착용</div>
      </div>

      <!-- 장착 갑옷 -->
      <div class="bg-bg-tertiary rounded p-2 space-y-2">
        <div class="flex items-center justify-between">
          <div class="text-xs text-gray-400">갑옷</div>
          <button
            v-if="c.armor"
            class="text-xs px-2 py-0.5 rounded bg-slate-700 text-gray-300 hover:bg-slate-600"
            @click="unequipSlot('armor')"
          >해제</button>
        </div>
        <div v-if="c.armor">
          <div :class="[tierColorClass(c.armor.tier), 'font-mono text-sm']">
            <ItemName :item="c.armor" />
          </div>
          <div class="text-xs text-gray-500">
            T{{ c.armor.tier }} ·
            <span :class="gradeColorClass[c.armor.grade]">{{ c.armor.grade }}</span>
            · 등급계수 {{ c.armor.coef.toFixed(2) }}
          </div>
          <div v-if="effectEntries(c.armor as any).length > 0" class="mt-1 text-xs grid grid-cols-2 gap-x-3 font-mono">
            <div v-for="[k, v] in effectEntries(c.armor as any)" :key="k" class="text-gray-300">
              <span class="text-gray-500">{{ k }}:</span> <span class="text-log-skill">{{ formatValue(v as number) }}</span>
            </div>
          </div>
        </div>
        <div v-else class="text-xs text-gray-600">없음</div>
      </div>

      <!-- 자동 발동 스킬 -->
      <div v-if="skillKeys.length > 0" class="bg-bg-tertiary rounded p-2 space-y-1">
        <div class="text-xs text-gray-400">⚡ 자동 발동 스킬 (탭하면 상세)</div>
        <div class="space-y-0.5 text-xs">
          <div v-for="key in skillKeys" :key="key"
               class="flex items-baseline justify-between cursor-pointer hover:bg-bg-secondary rounded px-1 py-0.5"
               @click="showSkillDetail(key)">
            <span>
              <span class="text-log-skill">{{ SKILLS[key]?.name ?? key }}</span>
              <span class="text-gray-500 ml-2 text-xs">{{ SKILLS[key]?.description }}</span>
            </span>
            <span v-if="SKILLS[key]?.kind === 'physical_atk' || SKILLS[key]?.kind === 'magic_atk'"
                  class="text-stat-util font-mono">{{ weaponProcPct }}%</span>
            <span v-else class="text-xs text-gray-600">조건부</span>
          </div>
        </div>
      </div>

      <!-- 선택한 챌린지 -->
      <div v-if="activeChallenges.length > 0" class="bg-bg-tertiary rounded p-2 space-y-2">
        <div class="text-xs text-gray-400">🎯 챌린지</div>
        <div
          v-for="{ ac, def } in activeChallenges"
          :key="ac.key"
          class="space-y-0.5 text-xs"
        >
          <div class="flex items-center justify-between">
            <span :class="ac.failed ? 'text-gray-500 line-through' : 'text-trait-special font-bold'">
              {{ def.name }}
            </span>
            <span
              class="text-xs px-1.5 py-0.5 rounded"
              :class="ac.failed
                ? 'bg-status-burn/30 text-status-burn'
                : (def.category === 'risk' ? 'bg-grade-special/30 text-grade-special' : 'bg-log-skill/30 text-log-skill')"
            >
              {{ ac.failed ? '실패' : (def.category === 'risk' ? '리스크' : '즉시') }}
            </span>
          </div>
          <div class="text-xs text-gray-400">{{ def.description }}</div>
          <div class="text-xs">
            <span class="text-gray-500">보상: </span>
            <span class="text-log-reward">{{ def.reward }}</span>
          </div>
          <div class="text-xs">
            <span class="text-gray-500">조건: </span>
            <span class="text-status-burn">{{ def.penalty }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- 상세 breakdown 모달 (중첩) -->
    <div
      v-if="detailModal"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-3 py-6"
      @click.self="detailModal = null"
    >
      <div class="panel max-w-sm w-full space-y-2">
        <div class="flex items-center justify-between">
          <div class="text-base font-bold">{{ detailModal.name }} 상세</div>
          <button class="text-gray-400 hover:text-white text-xl leading-none" @click="detailModal = null">✕</button>
        </div>
        <div class="text-2xl font-mono font-bold text-log-reward text-center py-2">
          {{ detailModal.total.toFixed(2) }}
        </div>
        <div class="space-y-1 text-xs">
          <div v-for="(e, i) in detailModal.entries" :key="i"
               class="bg-bg-tertiary rounded px-2 py-1.5 flex items-baseline justify-between">
            <div>
              <div class="text-gray-200">{{ e.from }}</div>
              <div v-if="e.note" class="text-xs text-gray-500">{{ e.note }}</div>
            </div>
            <div class="font-mono font-bold text-log-skill">
              {{ e.value >= 0 ? '+' : '' }}{{ e.value.toFixed(2) }}
            </div>
          </div>
        </div>
        <button class="btn-secondary w-full text-xs" @click="detailModal = null">닫기</button>
      </div>
    </div>
  </div>
  </Teleport>
</template>
