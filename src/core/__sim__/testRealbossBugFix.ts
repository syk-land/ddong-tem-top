// ============================================================
// 진짜보스 보상 누적 버그 수정 검증 (단위 테스트 스타일)
// ============================================================
// 사용자 예시 시나리오 재현:
//   1보스 46% → +46 (실제 27pt)
//   1보스 100% → +60 lock
//   2보스 30% → +18 (총 78)
//   2보스 50% → +30 (총 90) — 30→50 베스트 갱신
//   2보스 20% → 변동 없음 (총 90 유지) — 베스트 미달
//   2보스 30% 후 20% → 30%만 반영 (90 유지, 50 제거 후 다시 50 돌아오는 그런 거 아님)

import { defaultMeta } from '../meta'
import type { MetaBonuses } from '@/types'

// 실제 game store finishRealBossCombat 로직과 동일한 처리 (불변식 기반)
function simulateRealBossAttempt(meta: MetaBonuses, ratio: number): {
  prevBonus: number
  gain: number
  fullClear: boolean
  newBonus: number
} {
  const prevBonus = meta.permanentStartBonus ?? 0
  const fullClear = ratio >= 0.9999

  if (fullClear) {
    meta.realBossDefeated = true
    meta.realBossClearCount = (meta.realBossClearCount ?? 0) + 1
    meta.currentBossBestDrain = 0
  } else if (ratio > (meta.currentBossBestDrain ?? 0)) {
    meta.currentBossBestDrain = ratio
  }
  meta.permanentStartBonus =
    (meta.realBossClearCount * 60) +
    Math.floor(60 * (meta.currentBossBestDrain ?? 0))
  const gain = Math.max(0, meta.permanentStartBonus - prevBonus)
  return { prevBonus, gain, fullClear, newBonus: meta.permanentStartBonus }
}

let passCount = 0
let failCount = 0

function assert(label: string, actual: number | boolean, expected: number | boolean) {
  const ok = actual === expected
  if (ok) {
    console.log(`  ✓ ${label}: ${actual}`)
    passCount++
  } else {
    console.log(`  ✗ ${label}: expected ${expected}, got ${actual}`)
    failCount++
  }
}

console.log('\n========== 시나리오 1: 사용자 보고 버그 (정확 재현) ==========')
{
  const meta = defaultMeta()

  // 1보스 46%
  let r = simulateRealBossAttempt(meta, 0.46)
  assert('1보스 46% gain', r.gain, 27)  // floor(60 * 0.46) = 27
  assert('1보스 46% bonus', meta.permanentStartBonus, 27)

  // 1보스 100% (재도전 풀클)
  r = simulateRealBossAttempt(meta, 1.0)
  assert('1보스 100% clearCount', meta.realBossClearCount, 1)
  assert('1보스 100% bonus', meta.permanentStartBonus, 60)
  assert('1보스 100% currentBest reset', meta.currentBossBestDrain, 0)

  // 2보스 30%
  r = simulateRealBossAttempt(meta, 0.30)
  assert('2보스 30% gain', r.gain, 18)
  assert('2보스 30% bonus', meta.permanentStartBonus, 78)

  // 2보스 50% (베스트 갱신)
  r = simulateRealBossAttempt(meta, 0.50)
  assert('2보스 50% gain', r.gain, 12)  // 30 - 18 = 12
  assert('2보스 50% bonus', meta.permanentStartBonus, 90)

  // 2보스 20% (베스트 미달 — 변동 없어야 함)
  r = simulateRealBossAttempt(meta, 0.20)
  assert('2보스 20% gain (= 0, 베스트 미달)', r.gain, 0)
  assert('2보스 20% bonus (90 유지)', meta.permanentStartBonus, 90)
  assert('2보스 20% currentBest (0.5 유지)', meta.currentBossBestDrain, 0.50)
}

console.log('\n========== 시나리오 2: 30% 후 20% (50% 합산 안 됨) ==========')
{
  const meta = defaultMeta()

  // 30%
  let r = simulateRealBossAttempt(meta, 0.30)
  assert('30% bonus', meta.permanentStartBonus, 18)

  // 20% (이전 30% 보다 낮음)
  r = simulateRealBossAttempt(meta, 0.20)
  assert('30→20% gain (= 0)', r.gain, 0)
  assert('30→20% bonus (18 유지)', meta.permanentStartBonus, 18)
  assert('30→20% currentBest (0.3 유지)', meta.currentBossBestDrain, 0.30)
}

console.log('\n========== 시나리오 3: 11회 풀클 후 순환 ==========')
{
  const meta = defaultMeta()
  for (let i = 0; i < 11; i++) {
    simulateRealBossAttempt(meta, 1.0)
  }
  assert('11회 풀클 후 clearCount', meta.realBossClearCount, 11)
  assert('11회 풀클 후 bonus', meta.permanentStartBonus, 660)

  // 12번째 = 다시 고블린부터 (인덱스 0)
  // pickNextRealBossTheme(11) = REAL_BOSS_ORDER[11 % 11] = REAL_BOSS_ORDER[0] = 고블린
}

console.log('\n========== 시나리오 4: 부분 클리어 후 풀클리어 ==========')
{
  const meta = defaultMeta()

  // 부분 50%
  simulateRealBossAttempt(meta, 0.50)
  assert('부분 50% bonus', meta.permanentStartBonus, 30)
  assert('부분 50% currentBest', meta.currentBossBestDrain, 0.50)

  // 풀클 (locked 됨)
  const r = simulateRealBossAttempt(meta, 1.0)
  assert('풀클 후 bonus (60 = 60×1 + 0)', meta.permanentStartBonus, 60)
  assert('풀클 후 clearCount', meta.realBossClearCount, 1)
  assert('풀클 후 currentBest 리셋', meta.currentBossBestDrain, 0)
  assert('풀클 gain (30 → 60, 즉 +30)', r.gain, 30)
}

console.log('\n========== 시나리오 5: 0% 시도 (보상 변동 없음) ==========')
{
  const meta = defaultMeta()
  meta.realBossClearCount = 2
  meta.currentBossBestDrain = 0.4
  meta.permanentStartBonus = 120 + 24  // 144

  const r = simulateRealBossAttempt(meta, 0)
  assert('0% gain', r.gain, 0)
  assert('0% bonus 유지', meta.permanentStartBonus, 144)
  assert('0% currentBest 유지', meta.currentBossBestDrain, 0.4)
}

console.log('\n========== 시나리오 6: 마이그레이션 (옛 부풀려진 세이브) ==========')
{
  // 옛 버그로 부풀려진 세이브: clearCount=2, permanentStartBonus=200 (정상은 120+ partial)
  //   → 정상값 = 120 + floor(60*partial) 이므로 초과분 80 = partial 1.33 → 클램프 1.0 → 60
  //   → 결과: permanentStartBonus = 120 + 60 = 180. currentBossBestDrain = 1.0
  // (실제 마이그레이션 코드는 loadMeta 안에 있어 여기선 로직만 재현)
  const lockedFromClears = 2 * 60
  const oldBonus = 200
  const excess = oldBonus - lockedFromClears  // 80
  const partial = Math.max(0, Math.min(1, excess / 60))  // 1.0 (clamp)
  const newBonus = lockedFromClears + Math.floor(60 * partial)
  assert('마이그레이션 - clamped partial', partial, 1.0)
  assert('마이그레이션 - newBonus', newBonus, 180)
}

console.log('\n========== 시나리오 7: makeMonster HP 스케일링 ==========')
{
  // makeMonster(template, chapter, kind, realBossClearCount) 의 HP×(1+0.9×N)
  function hpMult(rbcc: number): number {
    return 1 + 0.9 * Math.max(0, rbcc)
  }
  assert('0회 클리어 HP ×1.0', hpMult(0), 1.0)
  assert('1회 클리어 HP ×1.9', hpMult(1), 1.9)
  assert('2회 클리어 HP ×2.8', hpMult(2), 2.8)
  assert('10회 클리어 HP ×10.0', hpMult(10), 10.0)
}

console.log('\n========== 결과 요약 ==========')
console.log(`Pass: ${passCount}`)
console.log(`Fail: ${failCount}`)
if (failCount > 0) {
  console.log('\n❌ 일부 테스트 실패')
  process.exit(1)
} else {
  console.log('\n✅ 모든 단위 테스트 통과')
}
