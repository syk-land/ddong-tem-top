// 옛 진짜보스 클리어자 마이그레이션 검증
//   - 옛 시스템에서 진짜보스 클리어한 사용자가 새 시스템(REAL_BOSS_ORDER) 으로 전환 시
//     보스 순서는 고블린부터 다시, 영구 보너스는 보존되는지 확인
//   - loadMeta 실제 로직 재현 (브라우저 외부에서 localStorage 흉내)

import { defaultMeta } from '../meta'
import type { MetaBonuses } from '@/types'

let pass = 0, fail = 0
function ok(label: string, cond: boolean, detail?: string) {
  if (cond) { console.log(`  ✓ ${label}${detail ? ` ${detail}` : ''}`); pass++ }
  else { console.log(`  ✗ ${label}${detail ? ` ${detail}` : ''}`); fail++ }
}
function eq<T>(label: string, actual: T, expected: T) {
  ok(label, actual === expected, `[got ${String(actual)}, expect ${String(expected)}]`)
}

// loadMeta 내부의 마이그레이션 블록을 그대로 재현
function migrate(input: Partial<MetaBonuses>): MetaBonuses {
  const m = input
  const loaded: any = {
    ...defaultMeta(),
    clearCount: m.clearCount ?? 0,
    climbCount: m.climbCount ?? 0,
    totalBonusStats: m.totalBonusStats ?? 0,
    allocations: m.allocations ?? {},
    pendingStartBonus: m.pendingStartBonus ?? 0,
    permanentStartBonus: m.permanentStartBonus ?? 0,
    legacyPermanentBonus: m.legacyPermanentBonus ?? 0,
    lastBossDrainRatio: m.lastBossDrainRatio ?? 0,
    realBossCompleted: m.realBossCompleted ?? false,
    realBossDefeated: m.realBossDefeated ?? false,
    realBossClearCount: m.realBossClearCount ?? 0,
    currentBossBestDrain: m.currentBossBestDrain ?? 0,
    totalGoldEarned: m.totalGoldEarned ?? 0,
  }
  const hasOldProgress = loaded.realBossDefeated
    || (m.realBossClearCount ?? 0) > 0
    || (loaded.permanentStartBonus ?? 0) > 0
  if ((loaded.legacyPermanentBonus ?? 0) === 0 && hasOldProgress) {
    loaded.legacyPermanentBonus = loaded.permanentStartBonus ?? 0
    loaded.realBossClearCount = 0
    loaded.currentBossBestDrain = 0
    // permanentStartBonus 유지
  } else {
    const expected = (loaded.legacyPermanentBonus ?? 0)
      + (loaded.realBossClearCount * 60)
      + Math.floor(60 * (loaded.currentBossBestDrain ?? 0))
    if (loaded.permanentStartBonus !== expected) {
      loaded.permanentStartBonus = expected
    }
  }
  return loaded as MetaBonuses
}

console.log('\n========== 시나리오 A: 옛 클리어자 1회 (realBossDefeated=true, bonus=60) ==========')
{
  const meta = migrate({
    realBossDefeated: true,
    permanentStartBonus: 60,
    // realBossClearCount, legacyPermanentBonus 없음 (옛 세이브)
  })
  eq('legacyPermanentBonus = 60 (이전 보너스 백업)', meta.legacyPermanentBonus, 60)
  eq('realBossClearCount = 0 (고블린부터 다시)', meta.realBossClearCount, 0)
  eq('permanentStartBonus = 60 (유지)', meta.permanentStartBonus, 60)
  eq('currentBossBestDrain = 0', meta.currentBossBestDrain, 0)
  ok('realBossDefeated 유지 (게임 클리어 플래그)', meta.realBossDefeated)
}

console.log('\n========== 시나리오 B: 옛 부분 클리어자 (defeated=false, bonus=27) ==========')
{
  const meta = migrate({
    realBossDefeated: false,
    permanentStartBonus: 27,  // 46% drain 결과
  })
  eq('legacyPermanentBonus = 27', meta.legacyPermanentBonus, 27)
  eq('realBossClearCount = 0', meta.realBossClearCount, 0)
  eq('permanentStartBonus = 27 (유지)', meta.permanentStartBonus, 27)
}

console.log('\n========== 시나리오 C: 옛 PR#4 진행자 (clearCount=1, bonus=60) ==========')
{
  // PR #4 (이번 PR) 머지 후 잠시 플레이했던 사람 — realBossClearCount 가 이미 1로 세이브됨
  const meta = migrate({
    realBossDefeated: true,
    realBossClearCount: 1,
    permanentStartBonus: 60,
    currentBossBestDrain: 0,
  })
  eq('legacyPermanentBonus = 60 (이전 진행분 백업)', meta.legacyPermanentBonus, 60)
  eq('realBossClearCount = 0 (다시 고블린부터)', meta.realBossClearCount, 0)
  eq('permanentStartBonus = 60 (유지)', meta.permanentStartBonus, 60)
}

console.log('\n========== 시나리오 D: 옛 PR#4 진행자 + 진행중 (clearCount=2, partial=0.5, bonus=150) ==========')
{
  // 새 시스템에서 2회 클리어 + 3번째 보스 50% 깎음 = 60+60+30 = 150
  const meta = migrate({
    realBossClearCount: 2,
    currentBossBestDrain: 0.5,
    permanentStartBonus: 150,
    realBossDefeated: true,
  })
  eq('legacyPermanentBonus = 150 (전체 이동)', meta.legacyPermanentBonus, 150)
  eq('realBossClearCount = 0', meta.realBossClearCount, 0)
  eq('currentBossBestDrain = 0 (리셋)', meta.currentBossBestDrain, 0)
  eq('permanentStartBonus = 150 (유지)', meta.permanentStartBonus, 150)
}

console.log('\n========== 시나리오 E: 신규 플레이어 (모두 0) ==========')
{
  const meta = migrate({})
  eq('legacyPermanentBonus = 0', meta.legacyPermanentBonus, 0)
  eq('realBossClearCount = 0', meta.realBossClearCount, 0)
  eq('permanentStartBonus = 0', meta.permanentStartBonus, 0)
}

console.log('\n========== 시나리오 F: 이미 마이그레이션된 사용자 (재로드) ==========')
{
  // 마이그레이션 이미 완료된 세이브 — 다시 로드해도 변동 없어야 함
  const meta = migrate({
    legacyPermanentBonus: 60,
    realBossClearCount: 0,
    currentBossBestDrain: 0,
    permanentStartBonus: 60,
    realBossDefeated: true,
  })
  eq('legacyPermanentBonus = 60 (변경 없음)', meta.legacyPermanentBonus, 60)
  eq('realBossClearCount = 0', meta.realBossClearCount, 0)
  eq('permanentStartBonus = 60', meta.permanentStartBonus, 60)
}

console.log('\n========== 시나리오 G: 마이그레이션 + 신규 클리어 (불변식) ==========')
{
  // 옛 사용자가 마이그레이션 → 고블린 풀클 → bonus 가 60(legacy) + 60(new) = 120 이어야 함
  const meta = migrate({
    realBossDefeated: true,
    permanentStartBonus: 60,
  })
  // 마이그레이션 후 신규 풀클
  meta.realBossClearCount = 1
  meta.currentBossBestDrain = 0
  const newBonus = (meta.legacyPermanentBonus ?? 0)
    + (meta.realBossClearCount * 60)
    + Math.floor(60 * (meta.currentBossBestDrain ?? 0))
  eq('마이그레이션 후 1차 풀클 bonus = 120 (legacy 60 + 새 60)', newBonus, 120)
}

console.log('\n========== 결과 ==========')
console.log(`Pass: ${pass}`)
console.log(`Fail: ${fail}`)
if (fail > 0) { console.log('\n❌ 일부 실패'); process.exit(1) }
else { console.log('\n✅ 마이그레이션 검증 통과') }
