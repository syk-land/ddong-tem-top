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

export function isChallengeDue(meta: MetaBonuses): boolean {
  if (meta.characterHistory.length === 0) return false
  return meta.runsSinceLastChallenge >= meta.nextChallengeAt
}

// 가장 점수가 낮은 캐릭터 (동률은 가장 오래된 것)
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

// 진짜 보스 몬스터 인스턴스 생성 (해당 챕터 테마의 일반 보스, 챕터 10 강도)
export function makeRealBoss(theme: ChapterTheme): MonsterInstance {
  const def = CHAPTER_THEMES[theme]
  const template = def.hardBoss ?? def.boss
  return makeMonster(template, 10, 'boss')
}

// 깎은 비율 → 시작 스탯 보너스 포인트
export function computeStartBonusFromDrain(drainRatio: number): number {
  const clamped = Math.max(0, Math.min(1, drainRatio))
  return Math.floor(START_STAT_BASE * clamped)
}
