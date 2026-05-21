// ============================================================
// 최적 공격/방어 벨류 공식 도출 + 검증
// ============================================================
// 목적:
//   게임 메카닉을 구조식으로 적분해서 단일 atkValue/defValue 공식 도출,
//   훈련 세트로 K 피팅 → 별도 테스트 세트로 R²/MAE 검증.
//
// 구조 (REF = chapter 5 normal monster):
//   REF_EVA=10, REF_DEF=10%, REF_ATK=14, REF_ACC=45
//
// atkValue (= 예상 DPS):
//   atkStat × hit × penFactor × critBoost × attacksPerTick × skillMult × lifestealBoost
//
// defValue (= 예상 생존 attack 수 ∝ maxHp / dmg/atk):
//   maxHp / [ hit_received × dmgIfHit × armorProcMult × (1 − dmgHeal) ]
//
// 사용: npm run sim:formula

import { createCombatContext, makeMonster, advanceTick, checkActionReady, monsterAttack, consumeAction, playerBasicAttack } from '../combat'
import { computeEffectiveStats } from '../stats'
import { useSkill, pickAutoAction } from '../skills'
import { rollItem } from '../items'
import { computeItemValue } from '../itemValue'
import { computeMaxHp, computeMaxMp } from '../character'
import { WEAPONS, WEAPON_KEYS } from '@/data/weapons'
import { ARMOR_KEYS } from '@/data/armor'
import type { Character, MonsterTemplate, Grade, Stats, TraitTier } from '@/types'

const TEST_CHAPTER = 5
const REF_EVA = 10
const REF_DEF = 10
const REF_ATK = 14
const REF_ACC = 45

// itemValue.ts 와 동기화
const SKILL_INFO: Record<string, { mult: number; magic: boolean }> = {
  스매쉬: { mult: 2.0, magic: false },
  피어스: { mult: 1.0, magic: false },
  연속공격: { mult: 1.4, magic: false },
  정밀타격: { mult: 1.5, magic: false },
  급습: { mult: 1.65, magic: false },
  빙결의화살: { mult: 2.2, magic: true },
  화염구: { mult: 6.5, magic: true },
  폭풍칼날: { mult: 3.15, magic: true },
  바위충격: { mult: 4.8, magic: true },
  번개창: { mult: 5.5, magic: true },
  그림자일격: { mult: 2.2, magic: true },
  정화의광선: { mult: 1.8, magic: true },
}
const BASE_PROC: Record<string, number> = {
  건틀릿: 0.18, 단검: 0.22, 사슬낫: 0.30, 완드: 0.25, 숏보우: 0.25,
  검: 0.35, 창: 0.40, 철퇴: 0.50, 스태프: 0.40, 롱보우: 0.40,
  대검: 0.55, 양날도끼: 0.65, 할버드: 0.70, 마도서: 0.55, 석궁: 0.50,
}

function clamp(v: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, v)) }

// ============================================================
// 구조식 공식 (피팅 전 raw)
// ============================================================
//
// 평타는 항상 물리 공격력 (combat.ts: playerBasicAttack 은 eff.공격력 사용)
// 마법 스킬만 마법공격력 — 단, MP 비용 40-60 으로 발동 횟수 제한됨
//
const MAGIC_SKILL_MP = 50   // 평균 마법 스킬 MP cost
const PHYS_SKILL_MP = 8     // 평균 물리 스킬 MP cost
const SIM_TICKS = 400        // 측정 시뮬레이션 길이 — MP 제약 환산용

export function predictAtkRaw(c: Character): number {
  const eff = computeEffectiveStats(c)

  // 명중 / 관통 / 적 방어
  const hit = clamp((eff.명중률 - REF_EVA) / 100, 0, 1)
  const effDef = Math.max(0, REF_DEF - eff.관통) / 100

  // 평타 데미지: 항상 물리 공격력
  const basicDmg = Math.max(1, eff.공격력 * (1 - effDef)) * hit

  // 스킬 정보
  const wKey = c.weapon?.baseKey
  const skillKey = wKey ? WEAPONS[wKey].autoSkill : undefined
  const skill = skillKey ? SKILL_INFO[skillKey] : undefined
  const baseProc = wKey ? (BASE_PROC[wKey] ?? 0.3) : 0
  const procRateRaw = clamp(baseProc * (1 + eff.행운 * 0.005), 0.05, 0.85)

  // 공격 빈도
  const attacksPerTick = eff.게이지가속 * eff.armorSpeedMult / eff.무기ticks
  const attacksInSim = attacksPerTick * SIM_TICKS

  // 스킬 발동률: MP 제약 — maxMp / mpCost 번 발동 가능
  let effProc = 0
  let skillDmg = 0
  if (skill && skillKey) {
    const mpCost = skill.magic ? MAGIC_SKILL_MP : PHYS_SKILL_MP
    const maxProcsInSim = c.maxMp / mpCost
    const idealProcs = attacksInSim * procRateRaw
    effProc = procRateRaw * clamp(maxProcsInSim / Math.max(0.1, idealProcs), 0, 1)

    // 스킬 atk_stat (마법 스킬은 마법공격력)
    const skillAtk = skill.magic ? (eff.마법공격력 > 0 ? eff.마법공격력 : eff.공격력) : eff.공격력
    skillDmg = Math.max(1, skillAtk * skill.mult * (1 - effDef)) * hit
  }

  // 평균 hit
  const avgHit = (1 - effProc) * basicDmg + effProc * skillDmg

  // 크리
  const critBoost = 1 + eff.크리확률 * (eff.크리배수 - 1)

  // DPS
  let dps = avgHit * critBoost * attacksPerTick

  // 흡혈 — atk 영향은 미미 (defValue 에서 큰 영향)
  if (eff.lifesteal > 0) dps *= (1 + eff.lifesteal * 0.05)

  return dps
}

export function predictDefRaw(c: Character): number {
  const eff = computeEffectiveStats(c)

  // 받는 명중 / 데미지
  const hitReceived = clamp((REF_ACC - eff.회피율) / 100, 0, 1)
  const dmgIfHit = Math.max(1, REF_ATK * (1 - eff.방어력_effective / 100))

  // 갑옷 자동 발동
  const armorKey = c.armor?.baseKey
  const procChance = 0.10 + eff.행운 * 0.005
  let armorProcMult = 1.0
  if (armorKey === '가죽갑') armorProcMult = 1 - procChance * 1.0
  else if (armorKey === '로브') armorProcMult = 1 - procChance * 0.5

  // 피해 흡수
  const dmgHeal = eff.damageTakenHealPct ?? 0
  const dmgPerAtk = hitReceived * dmgIfHit * armorProcMult * (1 - dmgHeal)

  // 흡혈로 인한 회복 (player 반격 시 회복)
  //   monster 1 attack ~ 10 ticks
  //   player attacks per monster attack = 10/무기ticks × 게이지가속 × armorSpeedMult
  let netDmgPerAtk = dmgPerAtk
  if (eff.lifesteal > 0) {
    const playerAtksPerMonsterAtk = (10 / eff.무기ticks) * eff.게이지가속 * eff.armorSpeedMult
    // player 평타 데미지 추정 (반격은 평타라 항상 물리)
    const playerEffDef = Math.max(0, REF_DEF - eff.관통) / 100
    const playerDmgPerHit = Math.max(1, eff.공격력 * (1 - playerEffDef))
        * clamp((eff.명중률 - REF_EVA) / 100, 0, 1)
    const healPerMonsterAtk = playerAtksPerMonsterAtk * playerDmgPerHit * eff.lifesteal
    netDmgPerAtk = dmgPerAtk - healPerMonsterAtk
  }

  return c.maxHp / Math.max(0.5, netDmgPerAtk)
}

// ============================================================
// 측정 헬퍼 (dummyValue 와 동일)
// ============================================================
const ATK_DUMMY: MonsterTemplate = { name: '훈련용', hpMod: 100000, atkMod: 0, defMod: 1.0 }
const DEF_DUMMY: MonsterTemplate = { name: '공격형', hpMod: 100000, atkMod: 1.0, defMod: 1.0 }

function measureDps(char: Character, ticks: number): number {
  const c: Character = { ...char, hp: 1e9, maxHp: 1e9, mp: char.maxMp, actionGauge: 0, statuses: [] }
  c.stats = { ...char.stats }
  const dummy = makeMonster(ATK_DUMMY, TEST_CHAPTER, 'normal')
  dummy.hp = 1e9; dummy.maxHp = 1e9
  const ctx = createCombatContext(c, dummy)
  const initialHp = dummy.hp
  let t = 0
  while (t < ticks && !ctx.ended) {
    advanceTick(ctx)
    const eff = computeEffectiveStats(ctx.player)
    const ready = checkActionReady(ctx, eff.무기ticks)
    for (const m of ready.readyMonsters) consumeAction(m, m.ticks)
    if (ctx.player.actionGauge >= eff.무기ticks) {
      const action = pickAutoAction(ctx, {})
      if (action.kind === 'skill') {
        if (!useSkill(ctx, action.key)) playerBasicAttack(ctx)
      } else {
        playerBasicAttack(ctx)
      }
      consumeAction(ctx.player, eff.무기ticks)
    }
    t++
  }
  return (initialHp - dummy.hp) / Math.max(1, t)
}

function measureEffectiveHp(char: Character, attacks: number): number {
  const c: Character = { ...char, hp: 1e9, maxHp: 1e9, mp: char.maxMp, actionGauge: 0, statuses: [] }
  c.stats = { ...char.stats }
  const dummy = makeMonster(DEF_DUMMY, TEST_CHAPTER, 'normal')
  dummy.hp = 1e9; dummy.maxHp = 1e9
  const ctx = createCombatContext(c, dummy)
  const initialPlayer = c.hp
  let a = 0, safety = 0
  while (a < attacks && safety < attacks * 200 && !ctx.ended) {
    advanceTick(ctx)
    const eff = computeEffectiveStats(ctx.player)
    const ready = checkActionReady(ctx, eff.무기ticks)
    for (const m of ready.readyMonsters) {
      monsterAttack(ctx, m)
      consumeAction(m, m.ticks)
      a++
    }
    if (ctx.player.actionGauge >= eff.무기ticks) {
      playerBasicAttack(ctx)
      consumeAction(ctx.player, eff.무기ticks)
    }
    safety++
  }
  if (a === 0) return char.maxHp
  const dmgPerAtk = (initialPlayer - c.hp) / a
  // 실효 HP = maxHp / dmgPerAtk (작을수록 좋음 → 클수록 좋게 invert)
  return char.maxHp / Math.max(0.5, dmgPerAtk)
}

// ============================================================
// 캐릭터 생성
// ============================================================
function pick<T>(a: T[]): T { return a[Math.floor(Math.random() * a.length)] }
function randomStats(): Stats {
  const keys: Array<keyof Stats> = ['힘', '민첩', '체력', '마력', '행운']
  const s: Stats = { 힘: 0, 민첩: 0, 체력: 0, 마력: 0, 행운: 0 }
  let r = 60
  while (r > 0) { s[pick(keys)]++; r-- }
  return s
}
function randomChar(forcedStats?: Stats): Character {
  const G: Grade[] = ['노말', '레어', '스페셜', '레전드']
  const T: TraitTier[] = ['하급', '보통', '희귀', '특별']
  const stats = forcedStats ? { ...forcedStats } : randomStats()
  const weapon = rollItem({ kind: 'weapon', forceBaseKey: pick(WEAPON_KEYS), forceGrade: pick(G), forceTraitTier: pick(T) })
  const armor = rollItem({ kind: 'armor', forceBaseKey: pick(ARMOR_KEYS), forceGrade: pick(G), forceTraitTier: pick(T) })
  return {
    stats: { ...stats }, hp: computeMaxHp(stats.체력), maxHp: computeMaxHp(stats.체력),
    mp: computeMaxMp(stats.마력), maxMp: computeMaxMp(stats.마력),
    weapon, armor, gold: 0, statuses: [], actionGauge: 0,
  }
}

// 스탯 빌드별 (60pt 분배 고정)
const STAT_BUILDS: Array<{ name: string; stats: Stats }> = [
  { name: '균등',     stats: { 힘: 12, 민첩: 12, 체력: 12, 마력: 12, 행운: 12 } },
  { name: '힘몰빵',   stats: { 힘: 40, 민첩: 5,  체력: 5,  마력: 5,  행운: 5  } },
  { name: '민첩몰빵', stats: { 힘: 5,  민첩: 40, 체력: 5,  마력: 5,  행운: 5  } },
  { name: '체력몰빵', stats: { 힘: 5,  민첩: 5,  체력: 40, 마력: 5,  행운: 5  } },
  { name: '마력몰빵', stats: { 힘: 5,  민첩: 5,  체력: 5,  마력: 40, 행운: 5  } },
  { name: '행운몰빵', stats: { 힘: 5,  민첩: 5,  체력: 5,  마력: 5,  행운: 40 } },
  { name: '힘+민첩',  stats: { 힘: 20, 민첩: 20, 체력: 6,  마력: 7,  행운: 7  } },
  { name: '마력+행운', stats: { 힘: 5,  민첩: 8,  체력: 7,  마력: 20, 행운: 20 } },
  { name: '체력+힘',  stats: { 힘: 20, 민첩: 7,  체력: 20, 마력: 6,  행운: 7  } },
]

// ============================================================
// 통계 / 회귀
// ============================================================
function pearson(xs: number[], ys: number[]): number {
  const n = xs.length
  if (n < 2) return 0
  const mx = xs.reduce((s, v) => s + v, 0) / n
  const my = ys.reduce((s, v) => s + v, 0) / n
  let num = 0, sx = 0, sy = 0
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - mx, dy = ys[i] - my
    num += dx * dy; sx += dx * dx; sy += dy * dy
  }
  return sx > 0 && sy > 0 ? num / Math.sqrt(sx * sy) : 0
}

// 절편 없는 단순 회귀 y = K*x — K 최적값 + R²
function fitNoIntercept(predicted: number[], actual: number[]): { K: number; r2: number; mae: number; rmse: number; meanAbsPctErr: number } {
  const n = predicted.length
  let num = 0, den = 0
  for (let i = 0; i < n; i++) { num += predicted[i] * actual[i]; den += predicted[i] * predicted[i] }
  const K = den > 0 ? num / den : 1

  // R² (1 - SS_res / SS_tot)
  const mean = actual.reduce((s, v) => s + v, 0) / n
  let ssRes = 0, ssTot = 0, mae = 0, mape = 0
  for (let i = 0; i < n; i++) {
    const pred = K * predicted[i]
    const err = actual[i] - pred
    ssRes += err * err
    ssTot += (actual[i] - mean) * (actual[i] - mean)
    mae += Math.abs(err)
    if (actual[i] > 0.01) mape += Math.abs(err / actual[i])
  }
  return {
    K,
    r2: ssTot > 0 ? 1 - ssRes / ssTot : 0,
    mae: mae / n,
    rmse: Math.sqrt(ssRes / n),
    meanAbsPctErr: (mape / n) * 100,
  }
}

// ============================================================
// 메인
// ============================================================
export function runBestFormula() {
  const N_TRAIN = Number(process.env.TRAIN_N ?? 3000)
  const N_TEST = Number(process.env.TEST_N ?? 1500)
  const TICKS = 400
  const ATTACKS = 80

  console.log(`\n############################################################`)
  console.log(`# 최적 공격/방어 벨류 공식 도출 + 검증`)
  console.log(`# train=${N_TRAIN} / test=${N_TEST}, REF eva=${REF_EVA} def=${REF_DEF}% atk=${REF_ATK} acc=${REF_ACC}`)
  console.log(`############################################################`)

  // ── 데이터 수집 ──
  function collect(n: number, label: string) {
    console.log(`\n${label} 수집 중...`)
    const t0 = Date.now()
    const chars: Character[] = []
    const dps: number[] = []
    const eHp: number[] = []
    for (let i = 0; i < n; i++) {
      const c = randomChar()
      chars.push(c)
      dps.push(measureDps(c, TICKS))
      eHp.push(measureEffectiveHp(c, ATTACKS))
      if ((i + 1) % 500 === 0) {
        const dt = (Date.now() - t0) / 1000
        console.log(`  ${i + 1}/${n} (${dt.toFixed(0)}s)`)
      }
    }
    return { chars, dps, eHp }
  }

  const train = collect(N_TRAIN, '훈련 세트')
  const test = collect(N_TEST, '테스트 세트')

  // ── 구조식 예측 ──
  const trainPredAtk = train.chars.map(predictAtkRaw)
  const trainPredDef = train.chars.map(predictDefRaw)
  const testPredAtk = test.chars.map(predictAtkRaw)
  const testPredDef = test.chars.map(predictDefRaw)

  // ── 회귀: K 피팅 ──
  const atkFit = fitNoIntercept(trainPredAtk, train.dps)
  const defFit = fitNoIntercept(trainPredDef, train.eHp)

  // ── 현재 computeItemValue 와 비교 ──
  const trainCurrAtk = train.chars.map((c) => computeItemValue(c.weapon, c, { chapter: TEST_CHAPTER }).atkValue)
  const trainCurrDef = train.chars.map((c) => computeItemValue(c.armor, c, { chapter: TEST_CHAPTER }).defValue)
  const testCurrAtk = test.chars.map((c) => computeItemValue(c.weapon, c, { chapter: TEST_CHAPTER }).atkValue)
  const testCurrDef = test.chars.map((c) => computeItemValue(c.armor, c, { chapter: TEST_CHAPTER }).defValue)
  const currAtkFit = fitNoIntercept(trainCurrAtk, train.dps)
  const currDefFit = fitNoIntercept(trainCurrDef, train.eHp)

  // ── 결과 출력 ──
  console.log(`\n============================================================`)
  console.log(`■ 공격벨류 공식 — 훈련 세트 (${N_TRAIN})`)
  console.log(`============================================================`)
  console.log(`구조식 atkValue (raw):`)
  console.log(`  R² = ${atkFit.r2.toFixed(4)}, K = ${atkFit.K.toFixed(4)}, MAE = ${atkFit.mae.toFixed(3)}, RMSE = ${atkFit.rmse.toFixed(3)}, MAPE = ${atkFit.meanAbsPctErr.toFixed(1)}%`)
  console.log(`  Pearson r = ${pearson(trainPredAtk, train.dps).toFixed(4)}`)
  console.log(`현재 computeItemValue.atkValue:`)
  console.log(`  R² = ${currAtkFit.r2.toFixed(4)}, K = ${currAtkFit.K.toFixed(4)}, MAE = ${currAtkFit.mae.toFixed(3)}, RMSE = ${currAtkFit.rmse.toFixed(3)}, MAPE = ${currAtkFit.meanAbsPctErr.toFixed(1)}%`)
  console.log(`  Pearson r = ${pearson(trainCurrAtk, train.dps).toFixed(4)}`)

  console.log(`\n============================================================`)
  console.log(`■ 방어벨류 공식 — 훈련 세트 (${N_TRAIN})`)
  console.log(`============================================================`)
  console.log(`구조식 defValue (= effective HP):`)
  console.log(`  R² = ${defFit.r2.toFixed(4)}, K = ${defFit.K.toFixed(4)}, MAE = ${defFit.mae.toFixed(2)}, MAPE = ${defFit.meanAbsPctErr.toFixed(1)}%`)
  console.log(`  Pearson r = ${pearson(trainPredDef, train.eHp).toFixed(4)}`)
  console.log(`현재 computeItemValue.defValue:`)
  console.log(`  R² = ${currDefFit.r2.toFixed(4)}, K = ${currDefFit.K.toFixed(4)}, MAE = ${currDefFit.mae.toFixed(2)}, MAPE = ${currDefFit.meanAbsPctErr.toFixed(1)}%`)
  console.log(`  Pearson r = ${pearson(trainCurrDef, train.eHp).toFixed(4)}`)

  // ── 테스트 세트 검증 (훈련 K 그대로 적용) ──
  console.log(`\n============================================================`)
  console.log(`■ 테스트 세트 검증 (${N_TEST}) — 훈련 K 그대로 적용`)
  console.log(`============================================================`)
  function evalTest(predicted: number[], actual: number[], K: number, label: string) {
    const n = predicted.length
    const mean = actual.reduce((s, v) => s + v, 0) / n
    let ssRes = 0, ssTot = 0, mae = 0, mape = 0
    for (let i = 0; i < n; i++) {
      const p = K * predicted[i]
      const err = actual[i] - p
      ssRes += err * err
      ssTot += (actual[i] - mean) * (actual[i] - mean)
      mae += Math.abs(err)
      if (actual[i] > 0.01) mape += Math.abs(err / actual[i])
    }
    const r2 = ssTot > 0 ? 1 - ssRes / ssTot : 0
    const r = pearson(predicted, actual)
    console.log(`${label}: R²=${r2.toFixed(4)}, r=${r.toFixed(4)}, MAE=${(mae / n).toFixed(3)}, MAPE=${((mape / n) * 100).toFixed(1)}%`)
  }
  console.log('-- 공격벨류 --')
  evalTest(testPredAtk, test.dps, atkFit.K, '  구조식')
  evalTest(testCurrAtk, test.dps, currAtkFit.K, '  현재')
  console.log('-- 방어벨류 --')
  evalTest(testPredDef, test.eHp, defFit.K, '  구조식')
  evalTest(testCurrDef, test.eHp, currDefFit.K, '  현재')

  // ── 최종 공식 출력 ──
  console.log(`\n============================================================`)
  console.log(`■ 최종 공식`)
  console.log(`============================================================`)
  console.log(`상수: REF_EVA=${REF_EVA}, REF_DEF=${REF_DEF}%, REF_ATK=${REF_ATK}, REF_ACC=${REF_ACC}`)
  console.log(``)
  console.log(`atkValue(c) = ${atkFit.K.toFixed(4)} × dps`)
  console.log(`  basicDmg = max(1, 공격력 × (1 − max(0, REF_DEF − 관통)/100)) × hit`)
  console.log(`  skillAtk = 스킬마법? max(마법공격력, 공격력) : 공격력`)
  console.log(`  skillDmg = max(1, skillAtk × skillMult × (1 − max(0, REF_DEF − 관통)/100)) × hit`)
  console.log(`  hit      = clamp((명중률 − REF_EVA)/100, 0, 1)`)
  console.log(`  procRaw  = clamp(baseProc(weapon) × (1 + 행운×0.005), 0.05, 0.85)`)
  console.log(`  mpCost   = 스킬마법? 50 : 8`)
  console.log(`  effProc  = procRaw × clamp(maxMp/mpCost / (attacksInSim × procRaw), 0, 1)`)
  console.log(`  avgHit   = (1 − effProc) × basicDmg + effProc × skillDmg`)
  console.log(`  dps      = avgHit × (1 + 크리확률×(크리배수−1)) × 게이지가속 × armorSpeedMult / 무기ticks`)
  console.log(`           × (1 + lifesteal × 0.05)`)
  console.log(``)
  console.log(`defValue(c) = ${defFit.K.toFixed(4)} × (maxHp / max(0.5, netDmgPerAtk))`)
  console.log(`  hitRecv  = clamp((REF_ACC − 회피율)/100, 0, 1)`)
  console.log(`  dmgIfHit = max(1, REF_ATK × (1 − 방어%/100))`)
  console.log(`  armorMul = 가죽갑: 1 − (0.1 + 행운×0.005)`)
  console.log(`             로브:   1 − (0.1 + 행운×0.005)×0.5`)
  console.log(`             판금/중갑: 1.0`)
  console.log(`  dmgPerAtk = hitRecv × dmgIfHit × armorMul × (1 − dmgTakenHeal)`)
  console.log(`  // 흡혈 회복으로 net dmg 차감`)
  console.log(`  playerAtks/MonsterAtk = (10/무기ticks) × 게이지가속 × armorSpeedMult`)
  console.log(`  playerDmgHit = max(1, 공격력 × (1 − max(0, REF_DEF − 관통)/100)) × hit`)
  console.log(`  heal/MonsterAtk = playerAtks/MonsterAtk × playerDmgHit × lifesteal`)
  console.log(`  netDmgPerAtk = dmgPerAtk − heal/MonsterAtk`)

  // ── 스탯 빌드별 적합도 검증 ──
  console.log(`\n============================================================`)
  console.log(`■ 스탯 빌드별 적합도 (각 빌드 1000개, 장비 무작위)`)
  console.log(`============================================================`)
  console.log(`스탯이 식에 잘 반영되었는지 확인 — 빌드 무관 R² 유지되면 OK\n`)
  console.log('빌드        | 공격(R²)  | 공격 MAPE  | 방어(R²)  | 방어 MAPE  | n')
  console.log('------------+-----------+------------+-----------+------------+-----')

  type BuildResult = { name: string; atkR2: number; atkMape: number; defR2: number; defMape: number; n: number }
  const buildResults: BuildResult[] = []
  const BUILD_N = Number(process.env.BUILD_N ?? 1000)

  for (const build of STAT_BUILDS) {
    const chars: Character[] = []
    const dpsA: number[] = []
    const eHpA: number[] = []
    for (let i = 0; i < BUILD_N; i++) {
      const c = randomChar(build.stats)
      chars.push(c)
      dpsA.push(measureDps(c, TICKS))
      eHpA.push(measureEffectiveHp(c, ATTACKS))
    }
    const predAtk = chars.map(predictAtkRaw)
    const predDef = chars.map(predictDefRaw)

    function evalFit(predicted: number[], actual: number[], K: number) {
      const n = predicted.length
      const mean = actual.reduce((s, v) => s + v, 0) / n
      let ssRes = 0, ssTot = 0, mape = 0
      for (let i = 0; i < n; i++) {
        const err = actual[i] - K * predicted[i]
        ssRes += err * err
        ssTot += (actual[i] - mean) * (actual[i] - mean)
        if (actual[i] > 0.01) mape += Math.abs(err / actual[i])
      }
      return { r2: ssTot > 0 ? 1 - ssRes / ssTot : 0, mape: (mape / n) * 100 }
    }
    const atkE = evalFit(predAtk, dpsA, atkFit.K)
    const defE = evalFit(predDef, eHpA, defFit.K)
    buildResults.push({ name: build.name, atkR2: atkE.r2, atkMape: atkE.mape, defR2: defE.r2, defMape: defE.mape, n: BUILD_N })

    console.log(
      `${build.name.padEnd(11)} | ${atkE.r2.toFixed(3).padStart(9)} | ${atkE.mape.toFixed(1).padStart(9)}% | ${defE.r2.toFixed(3).padStart(9)} | ${defE.mape.toFixed(1).padStart(9)}% | ${BUILD_N}`,
    )
  }

  // 빌드별 평균 + 분산
  const atkR2s = buildResults.map((r) => r.atkR2)
  const defR2s = buildResults.map((r) => r.defR2)
  const atkR2Mean = atkR2s.reduce((s, v) => s + v, 0) / atkR2s.length
  const defR2Mean = defR2s.reduce((s, v) => s + v, 0) / defR2s.length
  const atkR2Min = Math.min(...atkR2s), atkR2Max = Math.max(...atkR2s)
  const defR2Min = Math.min(...defR2s), defR2Max = Math.max(...defR2s)
  console.log(`\n빌드 무관성 (R² 변동):`)
  console.log(`  공격: 평균 ${atkR2Mean.toFixed(3)} (min ${atkR2Min.toFixed(3)} ~ max ${atkR2Max.toFixed(3)}, 폭 ${(atkR2Max - atkR2Min).toFixed(3)})`)
  console.log(`  방어: 평균 ${defR2Mean.toFixed(3)} (min ${defR2Min.toFixed(3)} ~ max ${defR2Max.toFixed(3)}, 폭 ${(defR2Max - defR2Min).toFixed(3)})`)
  if (atkR2Max - atkR2Min < 0.10 && defR2Max - defR2Min < 0.10) {
    console.log(`  ★ 빌드 무관 — 식이 스탯을 잘 반영함 (R² 변동 폭 < 0.10)`)
  } else {
    console.log(`  ⚠ 빌드별 R² 격차 큼 — 특정 스탯에 추가 보정 필요할 수 있음`)
  }

  // ── 최악 케이스 ──
  console.log(`\n============================================================`)
  console.log(`■ 잔차 큰 케이스 (테스트, 구조식 — 위 5개)`)
  console.log(`============================================================`)
  type Resid = { i: number; pred: number; actual: number; ratio: number; label: string }
  function showWorst(predicted: number[], actual: number[], K: number, chars: Character[], label: string) {
    const list: Resid[] = predicted.map((p, i) => {
      const pred = K * p
      const ratio = actual[i] > 0.01 ? pred / actual[i] : 1
      const c = chars[i]
      const desc = `${c.weapon?.baseKey}/${c.weapon?.grade}/${c.weapon?.trait}+${c.armor?.baseKey}/${c.armor?.grade}/${c.armor?.trait} (힘${c.stats.힘}민${c.stats.민첩}체${c.stats.체력}마${c.stats.마력}행${c.stats.행운})`
      return { i, pred, actual: actual[i], ratio, label: desc }
    }).filter((r) => Math.abs(Math.log(Math.max(0.01, r.ratio))) > 0)
    list.sort((a, b) => Math.abs(Math.log(b.ratio)) - Math.abs(Math.log(a.ratio)))
    console.log(`\n${label}: pred / actual 비율 큰 top 5`)
    for (const r of list.slice(0, 5)) {
      console.log(`  ${r.label}`)
      console.log(`    pred=${r.pred.toFixed(2)}, actual=${r.actual.toFixed(2)}, ratio=${r.ratio.toFixed(2)}×`)
    }
  }
  showWorst(testPredAtk, test.dps, atkFit.K, test.chars, '공격')
  showWorst(testPredDef, test.eHp, defFit.K, test.chars, '방어')

  console.log(`\n=== 완료 ===\n`)
}

if (typeof process !== 'undefined' && process.argv?.[1]?.includes('bestFormula')) {
  runBestFormula()
}
