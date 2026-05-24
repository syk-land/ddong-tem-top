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
//   - cleared === false 인 사망 기록은 거른다. (이전엔 사망 기록까지 last 로
//     잡혀, 7챕터에서 죽은 약한 캐릭터로 진짜 보스에 도전하게 되는 버그)
//   - cleared === undefined 는 옛 세이브 호환 → true 로 간주.
export function pickLatestRecord(meta: MetaBonuses): CharacterRecord | null {
  for (let i = meta.characterHistory.length - 1; i >= 0; i--) {
    const r = meta.characterHistory[i]
    if (r.cleared !== false) return r
  }
  return null
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
export const REAL_BOSS_ATK_MULT = 9.0  // v6.1: 1.8 → 9.0 (×5 강화). 평범 캐릭터에게 한 방 압도하도록.
export const REAL_BOSS_DEF_MULT = 1.6

// 진짜 보스 등장 고정 순서 — 22장 만화 구성과 동일.
// realBossClearCount % 11 을 인덱스로 사용 → 11회 클리어 후 다시 고블린부터 순환.
export const REAL_BOSS_ORDER: ChapterTheme[] = [
  '고블린', '기계', '천공', '골렘', '환영',
  '언데드', '흡혈귀', '심해', '용암', '암흑', '맹독',
]

// 클리어 횟수에 따라 다음 진짜 보스 테마 결정 (순환).
export function pickNextRealBossTheme(realBossClearCount: number): ChapterTheme {
  const idx = ((realBossClearCount % REAL_BOSS_ORDER.length) + REAL_BOSS_ORDER.length) % REAL_BOSS_ORDER.length
  return REAL_BOSS_ORDER[idx]
}

// 클리어 횟수에 따른 모든 몬스터의 HP 배수 — 클리어 1회마다 +90% 누적.
// 0회: 1.0, 1회: 1.9, 2회: 2.8, 3회: 3.7, ...
export const HP_MULT_PER_REAL_BOSS_CLEAR = 0.9
export function getMonsterHpMultiplier(realBossClearCount: number): number {
  return 1 + HP_MULT_PER_REAL_BOSS_CLEAR * Math.max(0, realBossClearCount)
}

// 진짜 보스: chapter 10 보스를 강화 + 클리어 누적 HP 멀티플라이어 적용.
export function makeRealBoss(theme: ChapterTheme, realBossClearCount: number = 0): MonsterInstance {
  const def = CHAPTER_THEMES[theme]
  const template = def.hardBoss ?? def.boss
  // 챕터 10 보스 baseline → 추가 증폭
  // makeMonster 는 template.hpMod/atkMod/defMod 를 곱해 인스턴스를 만들므로,
  // template 을 그대로 두고 인스턴스 단계에서 후처리 강화.
  // 누적 HP 배수는 makeMonster 안에서 적용되어, 여기선 진짜 보스 전용 HP×3.0만 추가로 곱한다.
  const inst = makeMonster(template, 10, 'boss', realBossClearCount)
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
