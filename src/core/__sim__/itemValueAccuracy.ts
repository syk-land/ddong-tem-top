// ============================================================
// 장비 공/방 표시 벨류 vs 실제 전투 측정값 정확도 검증
//
// 목적:
//   ItemDetail.vue 의 티어 아래 표시되는 atkValue / defValue 가
//   실제 전투에서 측정되는 공/방 능력치와 얼마나 일치하는지 측정.
//
// 측정:
//   - 공: 랜덤 캐릭터(스탯합 ≤ 200) + 랜덤 장비 → ch5 더미 적 상대 평균 DPS
//        (적은 무한 HP, 회피/공격 비활성화)
//   - 방: 동일 캐릭터 → ch5 더미 보스에게 일방적으로 피격, 평균 피격 데미지
//        (플레이어 공격 미실행, HP 무한)
//   - PvP: 캐릭터 A vs 캐릭터 B (B는 monster 로 변환) 실전, 승률 vs 예측 비교
//
// 출력:
//   - Pearson 상관, Spearman 순위상관
//   - actual/predicted 비율의 평균/표준편차
//   - 5%, 10%, 25% 오차 내 비율
//   - 보정 공식과 비교
//
// 사용: npx tsx src/core/__sim__/itemValueAccuracy.ts
// ============================================================

import {
  createCombatContext, makeMonster, advanceTick,
  monsterAttack, consumeAction, playerBasicAttack,
} from '../combat'
import { computeEffectiveStats } from '../stats'
import { useSkill, pickAutoAction } from '../skills'
import { rollItem } from '../items'
import { computeItemValue } from '../itemValue'
import { computeMaxHp, computeMaxMp } from '../character'
import { CHAPTER_THEMES } from '@/data/chapters'
import { WEAPONS } from '@/data/weapons'
import { ARMORS } from '@/data/armor'
import { WEAPON_TRAITS, ARMOR_TRAITS } from '@/data/traits'
import { computeWeaponSkillProc } from '../buildBalance'
import { SKILLS } from '@/data/skills'
import type {
  Character, Stats, MonsterInstance, MonsterTemplate, ItemInstance,
} from '@/types'

const REF_CHAPTER = 5

// ── 헬퍼 ──
function clampN(v: number, lo: number, hi: number): number { return Math.max(lo, Math.min(hi, v)) }

function randomStats(maxTotal: number, maxStat = 60): Stats {
  let trials = 0
  while (true) {
    trials++
    if (trials > 200) return { 힘: 40, 민첩: 40, 체력: 40, 마력: 40, 행운: 40 }
    const s: Stats = {
      힘: 1 + Math.floor(Math.random() * maxStat),
      민첩: 1 + Math.floor(Math.random() * maxStat),
      체력: 1 + Math.floor(Math.random() * maxStat),
      마력: 1 + Math.floor(Math.random() * maxStat),
      행운: 1 + Math.floor(Math.random() * maxStat),
    }
    const total = s.힘 + s.민첩 + s.체력 + s.마력 + s.행운
    if (total <= maxTotal && total >= maxTotal - 30) return s
  }
}

function makeChar(stats: Stats, weapon: ItemInstance, armor: ItemInstance): Character {
  return {
    stats: { ...stats },
    hp: computeMaxHp(stats.체력),
    maxHp: computeMaxHp(stats.체력),
    mp: computeMaxMp(stats.마력),
    maxMp: computeMaxMp(stats.마력),
    weapon, armor,
    gold: 0,
    statuses: [],
    actionGauge: 0,
  }
}

// DPS 측정용 무방비 더미 — 영원히 살아있고, 안 때리고, 안 피한다
function makeDpsDummy(): MonsterInstance {
  const theme = CHAPTER_THEMES['고블린']
  const m = makeMonster(theme.normalMonsters[0], REF_CHAPTER, 'normal')
  m.def = 3 + REF_CHAPTER * 1.0       // 8% (itemValue.ts 기본값 동일)
  m.eva = 5 + REF_CHAPTER             // 10
  m.acc = 0
  m.atk = 0
  m.hp = 1e12
  m.maxHp = 1e12
  m.template = { ...m.template, trait: undefined }
  return m
}

const DEF_ATTACKER_ATK = 100
function makeDefAttacker(): MonsterInstance {
  const theme = CHAPTER_THEMES['고블린']
  const m = makeMonster(theme.normalMonsters[0], REF_CHAPTER, 'normal')
  m.atk = DEF_ATTACKER_ATK
  m.acc = 9999
  m.eva = 0
  m.hp = 1e12
  m.maxHp = 1e12
  m.ticks = 10
  m.template = { ...m.template, trait: undefined }
  return m
}

function measureDPS(c: Character, ticks: number, runs = 1): number {
  let totalDmg = 0
  let totalTicks = 0
  for (let r = 0; r < runs; r++) {
    c.hp = c.maxHp; c.mp = c.maxMp; c.statuses = []; c.actionGauge = 0
    const dummy = makeDpsDummy()
    const ctx = createCombatContext(c, dummy)
    const startHp = dummy.hp
    for (let t = 0; t < ticks; t++) {
      advanceTick(ctx)
      if (ctx.ended) break
      const eff = computeEffectiveStats(ctx.player)
      if (ctx.player.actionGauge >= eff.무기ticks) {
        const action = pickAutoAction(ctx, {})
        if (action.kind === 'skill') {
          if (!useSkill(ctx, action.key)) playerBasicAttack(ctx)
        } else playerBasicAttack(ctx)
        consumeAction(ctx.player, eff.무기ticks)
      }
    }
    totalDmg += startHp - dummy.hp
    totalTicks += ticks
  }
  return totalDmg / totalTicks
}

function measureDmgTaken(c: Character, ticks: number): { hitCount: number; avgDmg: number; reductionPct: number } {
  c.hp = 1e9; c.maxHp = 1e9; c.mp = c.maxMp; c.statuses = []; c.actionGauge = 0
  const attacker = makeDefAttacker()
  const ctx = createCombatContext(c, attacker)
  const startHp = c.hp
  let hits = 0
  for (let t = 0; t < ticks; t++) {
    advanceTick(ctx)
    if (ctx.ended) break
    if (attacker.actionGauge >= attacker.ticks) {
      const beforeHp = c.hp
      monsterAttack(ctx, attacker)
      consumeAction(attacker, attacker.ticks)
      if (c.hp < beforeHp) hits++
    }
  }
  const taken = startHp - c.hp
  const avgDmg = hits > 0 ? taken / hits : 0
  const reductionPct = avgDmg > 0 ? (1 - avgDmg / DEF_ATTACKER_ATK) * 100 : 100
  return { hitCount: hits, avgDmg, reductionPct }
}

function characterAsMonster(c: Character, name: string): MonsterInstance {
  const eff = computeEffectiveStats(c)
  const template: MonsterTemplate = { name }
  return {
    template,
    hp: c.maxHp,
    maxHp: c.maxHp,
    atk: eff.공격력,
    def: eff.방어력_effective,
    speed: 8,
    ticks: eff.무기ticks,
    acc: eff.명중률,
    eva: eff.회피율,
    isBoss: false,
    isMimic: false,
    statuses: [],
    actionGauge: 0,
  }
}

function simPvP(a: Character, b: Character): { aWin: boolean; ticks: number } {
  a.hp = a.maxHp; a.mp = a.maxMp; a.statuses = []; a.actionGauge = 0
  const bMon = characterAsMonster(b, 'B')
  const ctx = createCombatContext(a, bMon)
  const MAX = 2000
  while (!ctx.ended && ctx.tick < MAX) {
    advanceTick(ctx)
    const eff = computeEffectiveStats(ctx.player)
    if (bMon.actionGauge >= bMon.ticks) {
      monsterAttack(ctx, bMon)
      consumeAction(bMon, bMon.ticks)
    }
    if (!ctx.ended && ctx.player.actionGauge >= eff.무기ticks) {
      const action = pickAutoAction(ctx, {})
      if (action.kind === 'skill') {
        if (!useSkill(ctx, action.key)) playerBasicAttack(ctx)
      } else playerBasicAttack(ctx)
      consumeAction(ctx.player, eff.무기ticks)
    }
  }
  return { aWin: ctx.victory, ticks: ctx.tick }
}

// ─────────────────────────────────────────────────────────────
// 보정된 atkValue 공식 v2
//   - skill proc: computeWeaponSkillProc (등급/특성 modifier 반영)
//   - MP 소모: 스킬당 mp 비용 vs MP regen (정상상태에서 procRate 깎기)
//   - 활/체력 etc. 기존 로직 유지
// ─────────────────────────────────────────────────────────────
const SKILL_ATK_MULT_LOCAL: Record<string, { mult: number; magic: boolean }> = {
  스매쉬:    { mult: 2.0, magic: false },
  피어스:    { mult: 1.0, magic: false },
  연속공격:  { mult: 1.4, magic: false },
  정밀타격:  { mult: 1.5, magic: false },
  급습:      { mult: 1.65, magic: false },
  빙결의화살: { mult: 2.2, magic: true },
  화염구:    { mult: 6.5, magic: true },
  폭풍칼날:  { mult: 3.15, magic: true },
  바위충격:  { mult: 4.8, magic: true },
  번개창:    { mult: 5.5, magic: true },
  그림자일격: { mult: 2.2, magic: true },
  정화의광선: { mult: 1.8, magic: true },
}

function predictedDpsV2(c: Character): number {
  const w = c.weapon
  const a = c.armor
  if (!w || !a) return 0
  const wbase = WEAPONS[w.baseKey]
  const abase = ARMORS[a.baseKey as keyof typeof ARMORS]
  const wTraitDef = WEAPON_TRAITS[w.trait]
  if (!wbase || !abase || !wTraitDef) return 0

  const stats = c.stats
  const enemyDef = 3 + REF_CHAPTER * 1.0   // 8%
  const enemyEva = 5 + REF_CHAPTER         // 10

  const atkPct = (wTraitDef.effects.공격력_pct ?? 0) + (wTraitDef.effects.전스탯_pct ?? 0)
  const atkMultBase = wbase.baseAtk * w.coef * (1 + atkPct)
  const isLobe = abase.key === '로브'
  const magicSynergy = isLobe && wbase.isMagic ? 1.5 : 1.0
  const physStat = wbase.category === 'ranged' ? stats.힘 + stats.민첩 * 0.3 : stats.힘
  const totalAtk = wbase.isMagic
    ? stats.마력 * atkMultBase * 1.5 * magicSynergy
    : physStat * atkMultBase * 3.0

  const acc = 60 + (wbase.accBonus ?? 0) + (w.effects.명중 ?? 0) + (a.effects.명중 ?? 0)
    + stats.민첩 * 0.5 + stats.행운 * 0.1
  const hitRate = clampN((acc - enemyEva) / 100, 0, 1.0)

  const pen = (wbase.penBonus ?? 0) + (wbase.magicPenBonus ?? 0) + (w.effects.관통 ?? 0)
  const effDefPct = Math.max(0, enemyDef - pen) / 100

  const basicHit = Math.max(1, totalAtk * (1 - effDefPct)) * hitRate

  // ── 핵심 차이: 보정된 proc rate (실제 combat 식과 동일) ──
  const skillKey = wbase.autoSkill
  const skillInfo = skillKey ? SKILL_ATK_MULT_LOCAL[skillKey] : undefined
  let procRate = 0
  let skillHit = 0
  if (skillKey && skillInfo) {
    procRate = computeWeaponSkillProc(c, stats.행운)
    // MP 게이팅 — 정상상태에서 mp 소모/공격수
    //   MP cost per skill 발동 = skill.mp (마법은 + weaponMpBonus)
    //   MP 재생: 없음 (combat 에서 mp regen 코드 없음) — 즉 MP 한정
    //   장시간 전투에선 MP 풀 = maxMp → 자주 발동 못 함
    //   대략: ticksAvailable * procRate * mpCost ≤ maxMp 가 깨지면 비율 ↓
    //   여기선 600틱 가정.
    const skill = SKILLS[skillKey]
    if (skill) {
      let mpCost = skill.mp
      if ((skill.kind === 'magic_atk' || skill.kind === 'magic_def') && wbase.isMagic) {
        mpCost = Math.max(0, mpCost + (wbase.mpBonus ?? 0))
      }
      // 600틱당 평균 공격 횟수 = 600 × attacks/tick
      const ticks = Math.round(10 / wbase.speedCoef)
      const armorBaseInfo = ARMORS[a.baseKey as keyof typeof ARMORS]
      let armorSpeed = armorBaseInfo?.speedMult ?? 1
      if (armorBaseInfo?.key === '로브' && wbase.isMagic) armorSpeed *= 1.15
      const wSpeedPct = (w.effects.속도_pct ?? 0)
      const aSpeedPct = (a.effects.속도_pct ?? 0)
      const gaugePerTick = (1 + stats.민첩 / 100) * (1 + wSpeedPct + aSpeedPct) * armorSpeed
      const attacksPerTick = gaugePerTick / ticks
      const attacksIn600 = 600 * attacksPerTick
      const wantSkillUse = attacksIn600 * procRate
      const canAfford = mpCost > 0 ? (c.maxMp / mpCost) : wantSkillUse
      const effectiveSkillUses = Math.min(wantSkillUse, canAfford)
      procRate = attacksIn600 > 0 ? effectiveSkillUses / attacksIn600 : 0
    }
    skillHit = Math.max(1, totalAtk * skillInfo.mult * (1 - effDefPct)) * hitRate
  }
  const avgHit = skillInfo ? (1 - procRate) * basicHit + procRate * skillHit : basicHit

  const critChance = clampN(stats.민첩 * 0.003, 0, 1.0)
  const critMult = 1.3 + stats.행운 / 100
  const critBoost = 1 + critChance * (critMult - 1)

  const ticks = Math.round(10 / wbase.speedCoef)
  let armorSpeed = abase?.speedMult ?? 1
  if (abase?.key === '로브' && wbase.isMagic) armorSpeed *= 1.15
  const wSpeedPct = (w.effects.속도_pct ?? 0)
  const aSpeedPct = (a.effects.속도_pct ?? 0)
  const gaugePerTick = (1 + stats.민첩 / 100) * (1 + wSpeedPct + aSpeedPct) * armorSpeed
  const attacksPerTick = gaugePerTick / ticks

  const dps = avgHit * critBoost * attacksPerTick

  // 상태이상 DoT 기여 (대략) — 평타와 곱한 dps 의 작은 비율 (existing logic 동일)
  let statusBonus = 0
  const statusKeys: Array<keyof typeof w.effects> = [
    'burn_chance', 'bleed_chance', 'poison_chance', 'slow_chance', 'blind_chance', 'shock_chance',
  ]
  for (const k of statusKeys) {
    const v = (w.effects[k] as number | undefined) ?? 0
    statusBonus += dps * v * 0.4
  }
  return dps + statusBonus
}

// 보정된 defValue (피해 감소 % 직접)
function predictedDefV2(c: Character): number {
  const a = c.armor
  if (!a) return 0
  const abase = ARMORS[a.baseKey as keyof typeof ARMORS]
  const aTraitDef = ARMOR_TRAITS[a.trait]
  if (!abase || !aTraitDef) return 0
  const defPct = (aTraitDef.effects.방어력_pct ?? 0) + (aTraitDef.effects.전스탯_pct ?? 0)
  const armorDef = abase.baseDef * a.coef * (1 + defPct)
  const hpDef = c.stats.체력 * 0.3 * a.coef
  return armorDef + hpDef    // %p reduction directly
}

// ── 통계 헬퍼 ──
function pearson(xs: number[], ys: number[]): number {
  const n = xs.length
  if (n === 0) return 0
  const mx = xs.reduce((a, b) => a + b) / n
  const my = ys.reduce((a, b) => a + b) / n
  let num = 0, dx = 0, dy = 0
  for (let i = 0; i < n; i++) {
    num += (xs[i] - mx) * (ys[i] - my)
    dx += (xs[i] - mx) ** 2
    dy += (ys[i] - my) ** 2
  }
  return num / Math.sqrt(dx * dy || 1)
}

function spearman(xs: number[], ys: number[]): number {
  function ranks(arr: number[]): number[] {
    const idx = arr.map((v, i) => ({ v, i })).sort((a, b) => a.v - b.v)
    const r = new Array(arr.length).fill(0)
    for (let i = 0; i < idx.length; i++) r[idx[i].i] = i + 1
    return r
  }
  return pearson(ranks(xs), ranks(ys))
}

function summary(label: string, predicted: number[], actual: number[]) {
  const n = predicted.length
  if (n === 0) { console.log(`${label}: no data`); return null }
  const valid = predicted.map((p, i) => ({ p, a: actual[i] })).filter((x) => x.p > 0.01)
  const ratios = valid.map((x) => x.a / x.p)
  const r2 = [...ratios].sort((a, b) => a - b)
  const mean = ratios.reduce((s, v) => s + v, 0) / ratios.length
  const sd = Math.sqrt(ratios.reduce((s, v) => s + (v - mean) ** 2, 0) / ratios.length)
  const median = r2[Math.floor(r2.length / 2)]
  const within = (tol: number) => ratios.filter((r) => Math.abs(r - 1) < tol).length / ratios.length
  // 상수 calibration: actual = k × predicted → 최적 k = sum(a*p) / sum(p*p)
  let num = 0, den = 0
  for (const x of valid) { num += x.p * x.a; den += x.p * x.p }
  const kbest = num / (den || 1)
  // calibrate 후 ±10% 비율
  const ratiosCal = valid.map((x) => x.a / (kbest * x.p))
  const within10cal = ratiosCal.filter((r) => Math.abs(r - 1) < 0.10).length / ratiosCal.length
  const pcorr = pearson(predicted, actual)
  const scorr = spearman(predicted, actual)
  console.log(`\n## ${label}  (n=${n}, valid=${valid.length})`)
  console.log(`  Pearson r       ${pcorr.toFixed(3)}      (1.0 = 완벽 비례)`)
  console.log(`  Spearman ρ      ${scorr.toFixed(3)}      (순위 일치)`)
  console.log(`  actual/pred 평균 ${mean.toFixed(3)}      (1.0 = 표시값 일치)`)
  console.log(`  중앙값          ${median.toFixed(3)}`)
  console.log(`  표준편차        ${sd.toFixed(3)}`)
  console.log(`  ±5%  내         ${(within(0.05) * 100).toFixed(1)}%`)
  console.log(`  ±10% 내         ${(within(0.10) * 100).toFixed(1)}%`)
  console.log(`  ±25% 내         ${(within(0.25) * 100).toFixed(1)}%`)
  console.log(`  보정상수 k     ${kbest.toFixed(3)} 적용 후 ±10% 내: ${(within10cal * 100).toFixed(1)}%`)
  return { pcorr, scorr, mean, median, sd,
    within5: within(0.05), within10: within(0.10), within25: within(0.25),
    kbest, within10cal,
  }
}

// V3: 짧은 Monte Carlo — 표시 시점에 200틱 × 2런 시뮬레이션, 같은 더미 사용
function predictedDpsV3_MC(c: Character): number {
  const charCopy = makeChar({ ...c.stats }, c.weapon!, c.armor!)
  return measureDPS(charCopy, 200, 2)
}

function run() {
  const N = 400
  const TICKS_PER_RUN = 600
  const RUNS_PER_CHAR = 3
  console.log(`\n=== 장비 공/방 표시 벨류 정확도 검증 ===`)
  console.log(`(샘플 ${N}개, 캐릭터 총스탯 ≤ 200, 랜덤 무기·갑옷, ch${REF_CHAPTER} 더미, ${TICKS_PER_RUN}틱 × ${RUNS_PER_CHAR}런)`)

  const predAtkV1: number[] = []
  const predAtkV2: number[] = []
  const predAtkV3: number[] = []
  const actualDps: number[] = []
  const predDefV1: number[] = []
  const predDefV2List: number[] = []
  const actualReduction: number[] = []

  const t0 = Date.now()
  for (let i = 0; i < N; i++) {
    const s = randomStats(200)
    const w = rollItem({ kind: 'weapon', chapter: REF_CHAPTER })
    const a = rollItem({ kind: 'armor', chapter: REF_CHAPTER })
    const c = makeChar(s, w, a)
    const wPred = computeItemValue(w, c, { chapter: REF_CHAPTER })
    const aPred = computeItemValue(a, c, { chapter: REF_CHAPTER })
    predAtkV1.push(wPred.atkValue + aPred.atkValue)
    predDefV1.push(wPred.defValue + aPred.defValue)
    predAtkV2.push(predictedDpsV2(c))
    predAtkV3.push(predictedDpsV3_MC(c))
    predDefV2List.push(predictedDefV2(c))
    const dps = measureDPS(c, TICKS_PER_RUN, RUNS_PER_CHAR)
    const dmg = measureDmgTaken(c, TICKS_PER_RUN)
    actualDps.push(dps)
    actualReduction.push(dmg.reductionPct)
    if ((i + 1) % 50 === 0) {
      const elapsed = ((Date.now() - t0) / 1000).toFixed(0)
      process.stdout.write(`  진행 ${i + 1}/${N} (${elapsed}s)\r`)
    }
  }
  console.log(`\n  소요 ${((Date.now() - t0) / 1000).toFixed(1)}s`)

  // PvP 측정
  console.log(`\n## PvP 예측 정확도`)
  const PAIRS = 150
  const FIGHTS_PER_PAIR = 5
  let correctV1 = 0, correctV2 = 0, totalP = 0
  let totalAWins = 0, totalFights = 0
  for (let i = 0; i < PAIRS; i++) {
    const sA = randomStats(200)
    const sB = randomStats(200)
    const wA = rollItem({ kind: 'weapon', chapter: REF_CHAPTER })
    const aA = rollItem({ kind: 'armor', chapter: REF_CHAPTER })
    const wB = rollItem({ kind: 'weapon', chapter: REF_CHAPTER })
    const aB = rollItem({ kind: 'armor', chapter: REF_CHAPTER })
    const cA = makeChar(sA, wA, aA)
    const cB = makeChar(sB, wB, aB)
    // V1: 표시값 그대로 atk 비교
    const vA = computeItemValue(wA, cA, { chapter: REF_CHAPTER })
    const vA2 = computeItemValue(aA, cA, { chapter: REF_CHAPTER })
    const vB = computeItemValue(wB, cB, { chapter: REF_CHAPTER })
    const vB2 = computeItemValue(aB, cB, { chapter: REF_CHAPTER })
    const aAtkV1 = vA.atkValue + vA2.atkValue
    const aDefV1 = vA.defValue + vA2.defValue
    const bAtkV1 = vB.atkValue + vB2.atkValue
    const bDefV1 = vB.defValue + vB2.defValue
    // V2: atk × (HP / 상대 atk) 형식 — A 가 살아남는 ticks vs B
    const aHp = cA.maxHp
    const bHp = cB.maxHp
    // 단순 예측: A 가 B 죽이는 시간 < B 가 A 죽이는 시간 ?
    //   tA→B = bHp / (aAtkV1)
    //   tB→A = aHp / (bAtkV1)
    //   atkValue 가 이미 hit/crit/속도/방어 포함하므로 직접 사용
    const tAB_V1 = bHp / Math.max(1, aAtkV1)
    const tBA_V1 = aHp / Math.max(1, bAtkV1)
    const predV1AWin = tAB_V1 < tBA_V1

    // V2: 보정 dps + 방어 % 적용
    const aDps2 = predictedDpsV2(cA)
    const bDps2 = predictedDpsV2(cB)
    const aDef2 = predictedDefV2(cA)
    const bDef2 = predictedDefV2(cB)
    // A 의 effective dps 대 B = aDps2 × (1 - bDef2/100)
    const aEff2 = aDps2 * Math.max(0.01, 1 - bDef2 / 100)
    const bEff2 = bDps2 * Math.max(0.01, 1 - aDef2 / 100)
    const tAB_V2 = bHp / Math.max(1, aEff2)
    const tBA_V2 = aHp / Math.max(1, bEff2)
    const predV2AWin = tAB_V2 < tBA_V2

    let aWins = 0
    for (let f = 0; f < FIGHTS_PER_PAIR; f++) {
      const cAx = makeChar(sA, wA, aA)
      const cBx = makeChar(sB, wB, aB)
      const r = simPvP(cAx, cBx)
      if (r.aWin) { aWins++; totalAWins++ }
      totalFights++
    }
    const actualAWin = aWins / FIGHTS_PER_PAIR > 0.5
    if (predV1AWin === actualAWin) correctV1++
    if (predV2AWin === actualAWin) correctV2++
    totalP++
  }
  console.log(`  쌍 ${PAIRS}개 × ${FIGHTS_PER_PAIR}전투 — A 평균 승률 ${(totalAWins / totalFights * 100).toFixed(1)}%`)
  console.log(`  V1 (현재 표시 atk 만 비교): ${(correctV1 / totalP * 100).toFixed(1)}%`)
  console.log(`  V2 (보정 dps × 상대 def): ${(correctV2 / totalP * 100).toFixed(1)}%`)

  // 결과 통계
  const sAtkV1 = summary('공 V1 (현재 itemValue.ts atkValue)', predAtkV1, actualDps)
  const sAtkV2 = summary('공 V2 (보정 — 등급/특성 proc + MP 게이팅)', predAtkV2, actualDps)
  const sAtkV3 = summary('공 V3 (Monte Carlo — 200틱 × 2런 시뮬)', predAtkV3, actualDps)
  const sDefV1 = summary('방 V1 (현재 itemValue.ts defValue, ×2.0 score)', predDefV1, actualReduction)
  const sDefV2 = summary('방 V2 (baseDef×coef×(1+def_pct)+체력×0.3×coef = %p reduction)', predDefV2List, actualReduction)

  console.log(`\n## 결론`)
  console.log(`  공 V1 ${(sAtkV1?.within10 ?? 0) >= 0.95 ? '✅' : '❌'} Spearman ${(sAtkV1?.scorr ?? 0).toFixed(3)} / ±10% raw ${((sAtkV1?.within10 ?? 0) * 100).toFixed(1)}% / 보정후 ${((sAtkV1?.within10cal ?? 0) * 100).toFixed(1)}%`)
  console.log(`  공 V2 ${(sAtkV2?.within10 ?? 0) >= 0.95 ? '✅' : '❌'} Spearman ${(sAtkV2?.scorr ?? 0).toFixed(3)} / ±10% raw ${((sAtkV2?.within10 ?? 0) * 100).toFixed(1)}% / 보정후 ${((sAtkV2?.within10cal ?? 0) * 100).toFixed(1)}%`)
  console.log(`  공 V3 ${(sAtkV3?.within10 ?? 0) >= 0.95 ? '✅' : '❌'} Spearman ${(sAtkV3?.scorr ?? 0).toFixed(3)} / ±10% raw ${((sAtkV3?.within10 ?? 0) * 100).toFixed(1)}% / 보정후 ${((sAtkV3?.within10cal ?? 0) * 100).toFixed(1)}%`)
  console.log(`  방 V1 ${(sDefV1?.within10 ?? 0) >= 0.95 ? '✅' : '❌'} Spearman ${(sDefV1?.scorr ?? 0).toFixed(3)} / ±10% raw ${((sDefV1?.within10 ?? 0) * 100).toFixed(1)}% / 보정후 ${((sDefV1?.within10cal ?? 0) * 100).toFixed(1)}%`)
  console.log(`  방 V2 ${(sDefV2?.within10 ?? 0) >= 0.95 ? '✅' : '❌'} Spearman ${(sDefV2?.scorr ?? 0).toFixed(3)} / ±10% raw ${((sDefV2?.within10 ?? 0) * 100).toFixed(1)}% / 보정후 ${((sDefV2?.within10cal ?? 0) * 100).toFixed(1)}%`)
}

if (typeof process !== 'undefined' && process.argv?.[1]?.includes('itemValueAccuracy')) {
  run()
}
