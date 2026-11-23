// 진짜 보스 도전 시스템
//   - 메인 메뉴 진입 시 totalGoldEarned >= REAL_BOSS_GOLD_THRESHOLD(5만) 인지 검사
//   - 100층 클리어한 기록 중 (무기 atkValue + 갑옷 defValue) 합이 최소인 캐릭터를 부활
//   - 클리어 누적 횟수에 따라 REAL_BOSS_ORDER 순환으로 보스 테마 결정
//   - 결과: 깎은 비율(0~1) → permanentStartBonus 누적 (불변식 = clearCount×60 + floor(60×bestDrain))
//
// 시작 스탯 베이스 = 60pt (4스탯 50 + 속도 10)

import type { Character, CharacterRecord, ChapterTheme, MetaBonuses, MonsterInstance } from '@/types'
import { CHAPTER_THEMES } from '@/data/chapters'
import { makeMonster } from './combat'
import { computeItemValue } from './itemValue'

export const START_STAT_BASE = 60

// 진짜 보스 누적 보상에 따른 스탯 임계값 보정 배수.
// 캐릭터 시작 스탯이 (60 + permanentStartBonus) 이므로,
// 시작 임계값 60 대비 비율만큼 챌린지의 최소/최대 스탯 임계값도 비례 조정.
export function startStatScale(meta: MetaBonuses): number {
  const bonus = meta.permanentStartBonus ?? 0
  return (START_STAT_BASE + bonus) / START_STAT_BASE
}

// v6: 진짜 보스 도전 조건 — 클리어 시 남은 골드 누적 3만 이상.
//   누적은 표시하지 않음 (내부 카운터). 도전 후 누적 리셋.
export const REAL_BOSS_GOLD_THRESHOLD = 30000

export function isChallengeDue(meta: MetaBonuses): boolean {
  if (meta.characterHistory.length === 0) return false
  return (meta.totalGoldEarned ?? 0) >= REAL_BOSS_GOLD_THRESHOLD
}

// 100층 클리어 캐릭터 기록의 "공격 + 방어 밸류" 합 — 진짜 보스 도전 후보 비교 점수.
// 진짜보스(챕터10 hardBoss × realBoss multipliers) 관점에서 평가:
//   - 보스 def/eva 가 높음 → 관통/명중 가치 ↑
//   - 보스 atk/속도 강 → 방어/회피 가치 ↑
export function computeChallengeScore(rec: CharacterRecord): number {
  const ch = { stats: rec.stats, weapon: rec.weapon, armor: rec.armor } as Character
  const wv = computeItemValue(rec.weapon, ch, { chapter: 10, vsBoss: true })
  const av = computeItemValue(rec.armor, ch, { chapter: 10, vsBoss: true })
  return wv.atkValue + av.defValue
}

// 진짜 보스 도전 후보 — 100층 클리어 기록 중 (공격+방어 밸류) 합이 최대인 캐릭터.
//   클리어 시점에 캐싱된 챔피언 그대로 반환 (런타임 계산 0).
//   챔피언 갱신은 pushCharacterHistory(cleared=true) 내부에서 비교 후 교체.
//   옛 사용자 마이그레이션은 loadMeta() 에서 한 번 일괄 계산.
export function pickChallengeRecord(meta: MetaBonuses): CharacterRecord | null {
  return meta.challengeChampion ?? null
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
// 라운드 보스 HP = 3520 × boss.hpMod × HARD_BOSS_HP_MULT × 누적 × REAL_BOSS_HP_MULT.
// hardBoss 의 hpMod/atkMod/defMod 시뮬 fitting을 폐기하고 가짜 보스 (theme.boss) 기준으로
// 단순화 — 라운드 보스 stat은 multipliers 만으로 결정.
export const HARD_BOSS_HP_MULT = 2.0  // 가짜 → 라운드 변환 (v11.2 보스 HP 상향 보정)
export const REAL_BOSS_HP_MULT = 1.6  // 라운드 보스 전용 추가 HP 배수
export const REAL_BOSS_ATK_MULT = 7.0  // ATK 배수 (시뮬 기반 조정)
export const REAL_BOSS_DEF_MULT = 1.0  // DEF 배수 (시뮬 기반 조정)

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

// 라운드 보스 = 가짜 보스(theme.boss) 베이스 + 단순화된 multipliers.
//   HP  = 3520 × boss.hpMod × HARD_BOSS_HP_MULT × (1+0.9·N) × REAL_BOSS_HP_MULT
//   ATK = 34 × boss.atkMod × REAL_BOSS_ATK_MULT
//   DEF = 20.15 × boss.defMod × REAL_BOSS_DEF_MULT
//   이름/trait은 hardBoss 정의에서 override (라운드 보스 시그니처).
export function makeRealBoss(theme: ChapterTheme, realBossClearCount: number = 0): MonsterInstance {
  const def = CHAPTER_THEMES[theme]
  // 베이스는 항상 가짜 보스(theme.boss) — 누적 HP 배수는 makeMonster 안에서 자동 적용
  const inst = makeMonster(def.boss, 10, 'boss', realBossClearCount)
  // 라운드 보스 전용 multipliers
  inst.maxHp = Math.round(inst.maxHp * HARD_BOSS_HP_MULT * REAL_BOSS_HP_MULT)
  inst.hp = inst.maxHp
  inst.atk = Math.round(inst.atk * REAL_BOSS_ATK_MULT)
  inst.def = Math.round(inst.def * REAL_BOSS_DEF_MULT)
  // 라운드 보스 시그니처 — hardBoss 정의에서 이름·trait·element override
  // + 라운드 보스 전용 atkMod/defMod (hardBoss에 명시) 적용
  if (def.hardBoss) {
    inst.template = {
      ...inst.template,
      name: def.hardBoss.name,
      trait: def.hardBoss.trait ?? inst.template.trait,
      ...(def.hardBoss.element ? { element: def.hardBoss.element } : {}),
    }
    if (def.hardBoss.atkMod !== undefined) inst.atk = Math.round(inst.atk * def.hardBoss.atkMod)
    if (def.hardBoss.defMod !== undefined) inst.def = Math.round(inst.def * def.hardBoss.defMod)
  }
  return inst
}

// 깎은 비율 → 시작 스탯 보너스 포인트
export function computeStartBonusFromDrain(drainRatio: number): number {
  const clamped = Math.max(0, Math.min(1, drainRatio))
  return Math.floor(START_STAT_BASE * clamped)
}

// 프롤로그 균열 조우전용 환영 보스 (최초 1회 — 압도적 위압감 체험용)
export function makePrologueRiftBoss(): MonsterInstance {
  const theme: ChapterTheme = REAL_BOSS_ORDER[0]
  return makeRealBoss(theme, 0)
}

// 현실 균열 진행도 (누적 골드 / 30,000G) — UI 게이지 표시용
export function getRealBossProgress(meta: MetaBonuses): { current: number; target: number; pct: number } {
  const current = Math.max(0, meta.totalGoldEarned ?? 0)
  const target = REAL_BOSS_GOLD_THRESHOLD
  const pct = Math.min(100, Math.round((current / target) * 100))
  return { current, target, pct }
}
