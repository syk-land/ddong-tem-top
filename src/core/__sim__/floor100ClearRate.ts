// ============================================================
// 라운드 × 스탯 구성별 100층 보스(가짜) 클리어율
//
// 시나리오:
//   - 캐릭터 stats 총합 = 60 × 라운드
//   - 5가지 stat 구성 (균등 / 힘 몰빵 / 민첩 몰빵 / 체력 몰빵 / 마력 몰빵)
//   - 장비 = 스페셜 grade + 특별 trait (무기/갑옷)
//   - 적 = 챕터10 일반 보스 (theme.boss). 11종 중 랜덤 1개.
//          누적 HP 배수 (1+0.9·(라운드-1)) 적용
//   - 1v1 자동 전투. 캐릭터 사망 또는 보스 사망까지.
//
// 출력: 라운드별, stat 구성별 클리어율
//
// 사용: npx tsx src/core/__sim__/floor100ClearRate.ts
// ============================================================

import {
  createCombatContext, advanceTick, monsterAttack, consumeAction, playerBasicAttack,
  makeMonster,
} from '../combat'
import { computeEffectiveStats } from '../stats'
import { useSkill, pickAutoAction } from '../skills'
import { rollItem } from '../items'
import { computeMaxHp, computeMaxMp } from '../character'
import { CHAPTER_THEMES } from '@/data/chapters'
import { REAL_BOSS_ORDER } from '../realboss'
import type { Character, Stats, StatKey, ItemInstance } from '@/types'

const N = 10_000
const MAX_TICKS = 1200

// stat 구성 + 매칭 빌드 (무기/갑옷 카테고리) — 라운드 N에서 총합 60×N pt 분배.
type StatConfig = {
  name: string
  build: (total: number) => Stats
  weaponBase?: () => string  // forceBaseKey (랜덤 1개). 미지정 시 전체 랜덤
  armorBase?: () => string
}
const RANGED_KEYS = ['숏보우', '롱보우', '석궁']
const MAGIC_KEYS = ['완드', '스태프', '마도서']
function pickOne<T>(arr: readonly T[]): T { return arr[Math.floor(Math.random() * arr.length)] }
const STAT_CONFIGS: StatConfig[] = [
  { name: '균등', build: even },
  { name: '힘 몰빵', build: (t) => allTo('힘', t) },
  { name: '민첩(활)',  build: (t) => allTo('민첩', t), weaponBase: () => pickOne(RANGED_KEYS) },
  { name: '체력 몰빵', build: (t) => allTo('체력', t) },
  { name: '마력(마법)', build: (t) => allTo('마력', t), weaponBase: () => pickOne(MAGIC_KEYS), armorBase: () => '로브' },
]

function even(total: number): Stats {
  const each = Math.floor(total / 5)
  const rem = total - each * 5
  const s: Stats = { 힘: each, 민첩: each, 체력: each, 마력: each, 행운: each }
  const keys: StatKey[] = ['힘', '민첩', '체력', '마력', '행운']
  for (let i = 0; i < rem; i++) s[keys[i]] += 1
  return s
}

// 몰빵 — 한 스탯에 총합의 50%, 나머지 50%는 4스탯에 균등.
//   실제 주사위 결과는 한 스탯이 100% 가는 일이 드물어서 baseline 보장.
function allTo(key: StatKey, total: number): Stats {
  const focused = Math.floor(total * 0.5)
  const remainder = total - focused
  const each = Math.floor(remainder / 4)
  const rem2 = remainder - each * 4
  const s: Stats = { 힘: 0, 민첩: 0, 체력: 0, 마력: 0, 행운: 0 }
  s[key] = focused
  const others: StatKey[] = (['힘', '민첩', '체력', '마력', '행운'] as StatKey[]).filter((k) => k !== key)
  for (const k of others) s[k] = each
  for (let i = 0; i < rem2; i++) s[others[i]] += 1
  return s
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

// 라운드 N의 100층 보스 — 11종 중 랜덤 1개 (가짜 보스 = theme.boss).
//   누적 HP 배수 (1+0.9·(N-1))는 makeMonster 내부에서 realBossClearCount 로 자동 적용.
function makeFloor100Boss(round: number) {
  const themeIdx = Math.floor(Math.random() * REAL_BOSS_ORDER.length)
  const theme = REAL_BOSS_ORDER[themeIdx]
  const def = CHAPTER_THEMES[theme]
  return makeMonster(def.boss, 10, 'boss', round - 1)
}

function runFight(c: Character, round: number): boolean {
  c.hp = c.maxHp; c.mp = c.maxMp; c.statuses = []; c.actionGauge = 0
  const boss = makeFloor100Boss(round)
  const ctx = createCombatContext(c, [boss], round - 1)
  for (let t = 0; t < MAX_TICKS; t++) {
    advanceTick(ctx)
    if (ctx.ended) break
    if (boss.hp <= 0) return true   // 클리어
    if (c.hp <= 0) return false     // 사망
    if (boss.actionGauge >= boss.ticks) {
      monsterAttack(ctx, boss)
      consumeAction(boss, boss.ticks)
    }
    if (c.hp <= 0) return false
    const eff = computeEffectiveStats(ctx.player)
    if (ctx.player.actionGauge >= eff.무기ticks) {
      const action = pickAutoAction(ctx, {})
      if (action.kind === 'skill') {
        if (!useSkill(ctx, action.key)) playerBasicAttack(ctx)
      } else playerBasicAttack(ctx)
      consumeAction(ctx.player, eff.무기ticks)
    }
  }
  // 시간 초과 — 보스 HP가 1 이하만 남았으면 클리어, 아니면 실패
  return boss.hp <= 0
}

function main() {
  console.log(`[floor100ClearRate] N=${N}, MAX_TICKS=${MAX_TICKS}`)
  console.log(`장비: 스페셜 grade + 특별 trait (무기/갑옷)`)
  console.log(`적: 챕터10 일반 보스 11종 중 랜덤 + 누적 HP 배수 (1+0.9·(라운드-1))`)
  console.log()

  const tStart = Date.now()
  const header = `라운드  stats총합  ${STAT_CONFIGS.map((c) => c.name.padStart(10)).join('  ')}`
  console.log(header)
  console.log('─'.repeat(header.length))

  for (let round = 1; round <= REAL_BOSS_ORDER.length; round++) {
    const total = 60 * round
    const rates: string[] = []
    for (const config of STAT_CONFIGS) {
      const stats = config.build(total)
      let clears = 0
      for (let n = 0; n < N; n++) {
        const wOpts = { kind: 'weapon' as const, forceGrade: '스페셜' as const, forceTraitTier: '특별' as const,
                        forceBaseKey: config.weaponBase?.() }
        const aOpts = { kind: 'armor'  as const, forceGrade: '스페셜' as const, forceTraitTier: '특별' as const,
                        forceBaseKey: config.armorBase?.() }
        const w = rollItem(wOpts)
        const a = rollItem(aOpts)
        const c = makeChar(stats, w, a)
        if (runFight(c, round)) clears++
      }
      rates.push(`${(clears / N * 100).toFixed(1)}%`.padStart(10))
    }
    console.log(`  ${round.toString().padStart(2)}    ${total.toString().padStart(5)}    ${rates.join('  ')}`)
  }

  const elapsed = (Date.now() - tStart) / 1000
  console.log(`\n시뮬 ${elapsed.toFixed(1)}s`)
}

main()
