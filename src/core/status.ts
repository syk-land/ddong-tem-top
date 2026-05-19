import type { StatusInstance, StatusKind, Character, MonsterInstance } from '@/types'
import { STATUSES, MAX_STACKS, stackMultiplier, SLOW_CAP, BLIND_CAP, SHOCK_CAP } from '@/data/statuses'
import { clamp } from './rng'

// 새 상태이상 적용 (또는 스택 갱신)
export function applyStatus(
  target: Character | MonsterInstance,
  kind: StatusKind,
  snapshotAtk: number,
  currentTick: number,
  resistChance: number = 0
): boolean {
  // 저항 굴림
  if (Math.random() < resistChance) return false

  const def = STATUSES[kind]
  const existing = target.statuses.find((s) => s.kind === kind)

  if (existing) {
    existing.stacks = Math.min(MAX_STACKS, existing.stacks + 1)
    existing.duration = def.baseDuration  // 리프레시
    existing.snapshotAtk = Math.max(existing.snapshotAtk, snapshotAtk)
    if (def.dotInterval > 0) {
      existing.nextDotAt = currentTick + def.dotInterval
    }
    existing.appliedTick = currentTick
  } else {
    target.statuses.push({
      kind,
      appliedTick: currentTick,
      duration: def.baseDuration,
      stacks: 1,
      snapshotAtk,
      nextDotAt: def.dotInterval > 0 ? currentTick + def.dotInterval : undefined,
    })
  }
  return true
}

// 매 틱 처리: DoT 발동, 지속 시간 감소, 만료 효과 제거
export interface TickResult {
  damageTaken: number
  expired: StatusKind[]
  dotEvents: Array<{ kind: StatusKind; dmg: number; stacks: number }>
}

export function tickStatuses(
  target: Character | MonsterInstance,
  currentTick: number
): TickResult {
  const result: TickResult = { damageTaken: 0, expired: [], dotEvents: [] }
  const remaining: StatusInstance[] = []

  for (const s of target.statuses) {
    const def = STATUSES[s.kind]
    s.duration -= 1

    // DoT 트리거
    if (def.dotInterval > 0 && s.nextDotAt !== undefined && currentTick >= s.nextDotAt) {
      const intensity = def.baseValue * stackMultiplier(s.stacks)
      const dmg = Math.max(1, Math.round(s.snapshotAtk * intensity))
      result.damageTaken += dmg
      result.dotEvents.push({ kind: s.kind, dmg, stacks: s.stacks })
      s.nextDotAt += def.dotInterval
    }

    if (s.duration > 0) {
      remaining.push(s)
    } else {
      result.expired.push(s.kind)
    }
  }
  target.statuses = remaining
  return result
}

// 디버프 값 계산 (둔화/암흑/감전)
export function getSpeedModifier(target: Character | MonsterInstance): number {
  const slow = target.statuses.find((s) => s.kind === '둔화')
  if (!slow) return 1.0
  const intensity = STATUSES.둔화.baseValue * stackMultiplier(slow.stacks)
  return 1.0 + Math.max(SLOW_CAP, intensity)  // 최저 0.10x
}

export function getAccuracyModifier(target: Character | MonsterInstance): number {
  const blind = target.statuses.find((s) => s.kind === '암흑')
  if (!blind) return 0
  const intensity = STATUSES.암흑.baseValue * stackMultiplier(blind.stacks)
  return Math.max(BLIND_CAP, intensity)
}

export function getDamageTakenModifier(target: Character | MonsterInstance): number {
  const shock = target.statuses.find((s) => s.kind === '감전')
  if (!shock) return 1.0
  const intensity = STATUSES.감전.baseValue * stackMultiplier(shock.stacks)
  return 1.0 + Math.min(SHOCK_CAP, intensity)
}

// 모든 디버프 정화 (정화의 광선)
export function purgeDebuffs(target: Character | MonsterInstance): StatusKind[] {
  const purged: StatusKind[] = []
  target.statuses = target.statuses.filter((s) => {
    // 디버프만 정화 (양수 효과는 게임에 없음, 모두 디버프)
    purged.push(s.kind)
    return false
  })
  return purged
}
