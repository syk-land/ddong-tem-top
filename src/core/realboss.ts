// 진짜 보스 도전 시스템
//   - 메인 메뉴 진입 시 runsSinceLastChallenge >= nextChallengeAt 인지 검사
//   - 가장 클리어 등급이 낮았던 (= score 최소) 캐릭터를 부활
//   - 그 캐릭터가 도달한 마지막 챕터 테마의 챕터 보스를 진짜 보스로
//   - 결과: 깎은 비율(0~1) → meta.pendingStartBonus = floor(60 * ratio)
//   - 다음 캐릭터 1회 시작 스탯에 적용
//
// 시작 스탯 베이스 = 60pt (4스탯 50 + 속도 10)

import type { CharacterRecord, ChapterTheme, MetaBonuses, MonsterInstance } from '@/types'
import { CHAPTER_THEMES } from '@/data/chapters'
import { makeMonster } from './combat'

export const START_STAT_BASE = 60

// v6: 진짜 보스 도전 조건 — 클리어 시 남은 골드 누적 5만 이상.
//   누적은 표시하지 않음 (내부 카운터). 도전 후 누적 리셋.
export const REAL_BOSS_GOLD_THRESHOLD = 50000

export function isChallengeDue(meta: MetaBonuses): boolean {
  if (meta.characterHistory.length === 0) return false
  return (meta.totalGoldEarned ?? 0) >= REAL_BOSS_GOLD_THRESHOLD
}

// 가장 점수가 낮은 캐릭터 (동률은 가장 오래된 것) — 옛 의도(폐기)
export function pickWeakestRecord(meta: MetaBonuses): CharacterRecord | null {
  if (meta.characterHistory.length === 0) return null
  let weakest = meta.characterHistory[0]
  for (const r of meta.characterHistory) {
    if (r.score < weakest.score || (r.score === weakest.score && r.recordedAt < weakest.recordedAt)) {
      weakest = r
    }
  }
  return weakest
}

// 가장 최근에 클리어한 캐릭터 — 게임 최종 목표 도전용.
// "5번째 클리어 한 그 캐릭터로 진짜 보스에 도전" 의도.
export function pickLatestRecord(meta: MetaBonuses): CharacterRecord | null {
  if (meta.characterHistory.length === 0) return null
  return meta.characterHistory[meta.characterHistory.length - 1]
}

// 진짜 보스 몬스터 — 챕터 10 하드 보스를 더 강하게 증폭
//   설계 목표: 평범한 캐릭터는 거의 못 깎고, "레전드 상급 무기 + 능력치 총합 120pt 이상"
//   정도의 매우 강한 캐릭터만 클리어 가능.
//
// 일반 챕터 10 하드 보스 대비:
//   HP × REAL_BOSS_HP_MULT
//   ATK × REAL_BOSS_ATK_MULT
//   DEF × REAL_BOSS_DEF_MULT
//
// 시뮬레이션 기반 권장값:
//   레전드 상급(coef 3.0+) 무기 + 능력치 120pt 캐릭터의 DPS 시 ~30턴 클리어 → HP 약 +3.0배
//   능력치 90pt 평범한 캐릭터는 보스 ATK가 압도 → HP 거의 못 깎음
export const REAL_BOSS_HP_MULT = 3.0
export const REAL_BOSS_ATK_MULT = 1.8
export const REAL_BOSS_DEF_MULT = 1.6

export function makeRealBoss(theme: ChapterTheme): MonsterInstance {
  const def = CHAPTER_THEMES[theme]
  const template = def.hardBoss ?? def.boss
  // 챕터 10 보스 baseline → 추가 증폭
  // makeMonster 는 template.hpMod/atkMod/defMod 를 곱해 인스턴스를 만들므로,
  // template 을 그대로 두고 인스턴스 단계에서 후처리 강화.
  const inst = makeMonster(template, 10, 'boss')
  inst.maxHp = Math.round(inst.maxHp * REAL_BOSS_HP_MULT)
  inst.hp = inst.maxHp
  inst.atk = Math.round(inst.atk * REAL_BOSS_ATK_MULT)
  inst.def = Math.round(inst.def * REAL_BOSS_DEF_MULT)
  return inst
}

// 깎은 비율 → 시작 스탯 보너스 포인트
export function computeStartBonusFromDrain(drainRatio: number): number {
  const clamped = Math.max(0, Math.min(1, drainRatio))
  return Math.floor(START_STAT_BASE * clamped)
}
