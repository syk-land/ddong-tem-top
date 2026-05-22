// ============================================================
// 무기별 "최고가 되는" 스탯/특성 niche 탐색
//
// 목적: itemValue.ts 공식에서 각 무기가 다른 무기들을 제치고
//       1위로 측정되는 (스탯 분배 + 무기 특성 + 갑옷) 조합이
//       존재하는지 brute-force 로 확인.
//
// 방법:
//   - 스탯 분배 13종 (총 120pt, 한 스탯 몰빵 / 2스탯 분산 / 균등)
//   - 무기 특성 전 14종
//   - 갑옷 베이스 4종 × 갑옷 특성 단단한 고정
//   - 등급 레전드 고정 (coef 격차 가장 크게 드러남)
//   - 챕터 5 고정 (중간값)
//
//   각 조합마다 무기 15종의 atkValue 를 동일 조건에서 계산 → 순위 매김
//   → 각 무기가 도달한 "최고 순위" 와 그 때의 조합 기록
//
// 출력:
//   1) 무기별 최고 순위 + 그 때의 조합 (스탯 / 특성 / 갑옷)
//   2) 각 무기가 1위로 측정된 조합 개수
//
// 사용: npx tsx src/core/__sim__/itemValueWeaponNiche.ts
// ============================================================

import { rollItem } from '../items'
import { computeItemValue } from '../itemValue'
import { computeMaxHp } from '../character'
import { WEAPON_KEYS, WEAPONS } from '@/data/weapons'
import { ARMOR_KEYS } from '@/data/armor'
import { WEAPON_TRAITS } from '@/data/traits'
import type { Character, Stats, ItemInstance } from '@/types'

const GRADE = '레전드' as const
const CHAPTER = 5
const ARMOR_TRAIT = '단단한'

// 스탯 분배 — 총 120pt, 한 스탯 최소 4
type StatBuild = { label: string; stats: Stats }
const STAT_BUILDS: StatBuild[] = [
  { label: '균등',      stats: { 힘: 24, 민첩: 24, 체력: 24, 마력: 24, 행운: 24 } },
  { label: '힘몰빵',    stats: { 힘: 104, 민첩: 4, 체력: 4, 마력: 4, 행운: 4 } },
  { label: '민첩몰빵',  stats: { 힘: 4, 민첩: 104, 체력: 4, 마력: 4, 행운: 4 } },
  { label: '체력몰빵',  stats: { 힘: 4, 민첩: 4, 체력: 104, 마력: 4, 행운: 4 } },
  { label: '마력몰빵',  stats: { 힘: 4, 민첩: 4, 체력: 4, 마력: 104, 행운: 4 } },
  { label: '행운몰빵',  stats: { 힘: 4, 민첩: 4, 체력: 4, 마력: 4, 행운: 104 } },
  { label: '힘+민첩',   stats: { 힘: 54, 민첩: 54, 체력: 4, 마력: 4, 행운: 4 } },
  { label: '힘+행운',   stats: { 힘: 54, 민첩: 4, 체력: 4, 마력: 4, 행운: 54 } },
  { label: '민첩+행운', stats: { 힘: 4, 민첩: 54, 체력: 4, 마력: 4, 행운: 54 } },
  { label: '마력+행운', stats: { 힘: 4, 민첩: 4, 체력: 4, 마력: 54, 행운: 54 } },
  { label: '마력+민첩', stats: { 힘: 4, 민첩: 54, 체력: 4, 마력: 54, 행운: 4 } },
  { label: '힘+체력',   stats: { 힘: 54, 민첩: 4, 체력: 54, 마력: 4, 행운: 4 } },
  { label: '힘+마력',   stats: { 힘: 54, 민첩: 4, 체력: 4, 마력: 54, 행운: 4 } },
]

const WEAPON_TRAIT_KEYS = Object.keys(WEAPON_TRAITS)

function makeChar(stats: Stats, w: ItemInstance, a: ItemInstance): Character {
  return {
    stats: { ...stats },
    hp: computeMaxHp(stats.체력), maxHp: computeMaxHp(stats.체력),
    mp: 1e9, maxMp: 1e9,
    weapon: w, armor: a, gold: 100, statuses: [], actionGauge: 0,
  }
}

interface Eval {
  weapon: string
  atkValue: number
}

interface BestRecord {
  weapon: string
  bestRank: number
  bestAtk: number
  bestConfig: string
  topAtk: number   // 동일 조합에서 1위의 값
  topWeapon: string
  win1Count: number  // 1위 도달 횟수
  win2Count: number  // 2위까지
  win3Count: number  // 3위까지
}

function run() {
  const records: Record<string, BestRecord> = {}
  for (const wKey of WEAPON_KEYS) {
    records[wKey] = {
      weapon: wKey, bestRank: 999, bestAtk: 0, bestConfig: '',
      topAtk: 0, topWeapon: '',
      win1Count: 0, win2Count: 0, win3Count: 0,
    }
  }

  let totalConfigs = 0

  for (const build of STAT_BUILDS) {
    for (const traitName of WEAPON_TRAIT_KEYS) {
      for (const armorKey of ARMOR_KEYS) {
        totalConfigs += 1
        // 동일 (스탯, 무기 trait, 갑옷) 조건에서 15 무기 평가
        const armor = rollItem({
          kind: 'armor', forceBaseKey: armorKey,
          forceGrade: GRADE, forceTraitName: ARMOR_TRAIT,
        })
        const evals: Eval[] = []
        for (const wKey of WEAPON_KEYS) {
          const weapon = rollItem({
            kind: 'weapon', forceBaseKey: wKey,
            forceGrade: GRADE, forceTraitName: traitName,
          })
          const c = makeChar(build.stats, weapon, armor)
          const v = computeItemValue(weapon, c, { chapter: CHAPTER })
          evals.push({ weapon: wKey, atkValue: v.atkValue })
        }
        evals.sort((a, b) => b.atkValue - a.atkValue)
        const top = evals[0]
        for (let i = 0; i < evals.length; i++) {
          const rank = i + 1
          const e = evals[i]
          const rec = records[e.weapon]
          if (rank <= 3) rec.win3Count += 1
          if (rank <= 2) rec.win2Count += 1
          if (rank === 1) rec.win1Count += 1
          const improved = rank < rec.bestRank
            || (rank === rec.bestRank && e.atkValue > rec.bestAtk)
          if (improved) {
            rec.bestRank = rank
            rec.bestAtk = e.atkValue
            rec.bestConfig = `${build.label} / ${traitName} / ${armorKey}`
            rec.topAtk = top.atkValue
            rec.topWeapon = top.weapon
          }
        }
      }
    }
  }

  console.log(`\n=== 무기별 best rank niche 탐색 ===`)
  console.log(`설계: ${STAT_BUILDS.length} 스탯빌드 × ${WEAPON_TRAIT_KEYS.length} 무기특성 × ${ARMOR_KEYS.length} 갑옷 = ${totalConfigs} 조합 / 등급 ${GRADE} / ch${CHAPTER}\n`)

  console.log(`무기       | 분류 | best | best 조합                              | best atk vs 1위(${'무기'.padEnd(6)})`)
  console.log('-----------+------+------+----------------------------------------+-------------------------')
  const rows = WEAPON_KEYS.map((k) => records[k])
  rows.sort((a, b) => a.bestRank - b.bestRank || b.bestAtk - a.bestAtk)
  for (const r of rows) {
    const wbase = WEAPONS[r.weapon]
    const cat = wbase.isMagic ? '마법' : (wbase.category === 'ranged' ? '활' : '근접')
    const versus = r.bestRank === 1
      ? `1위 (${r.bestAtk.toFixed(1)})`
      : `${r.bestAtk.toFixed(1)} vs ${r.topWeapon}(${r.topAtk.toFixed(1)})`
    console.log(`${r.weapon.padEnd(10)} | ${cat.padEnd(4)} | #${r.bestRank.toString().padStart(2)}  | ${r.bestConfig.padEnd(38)} | ${versus}`)
  }

  console.log(`\n=== 1위/2위/3위 진입 횟수 (전체 ${totalConfigs} 조합 중) ===`)
  console.log(`무기       | 분류 | #1   | #2까지 | #3까지`)
  console.log('-----------+------+------+--------+-------')
  const ranked = [...rows].sort((a, b) => b.win1Count - a.win1Count)
  for (const r of ranked) {
    const wbase = WEAPONS[r.weapon]
    const cat = wbase.isMagic ? '마법' : (wbase.category === 'ranged' ? '활' : '근접')
    console.log(`${r.weapon.padEnd(10)} | ${cat.padEnd(4)} | ${r.win1Count.toString().padStart(3)}  | ${r.win2Count.toString().padStart(4)}   | ${r.win3Count.toString().padStart(4)}`)
  }
}

if (typeof process !== 'undefined' && process.argv?.[1]?.includes('itemValueWeaponNiche')) {
  run()
}
