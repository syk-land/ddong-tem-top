import type { StatusDef, StatusKind } from '@/types'

// 6.1 상태이상 6종 (틱 기반)
export const STATUSES: Record<StatusKind, StatusDef> = {
  점화: { key: '점화', category: 'dot_magic',    baseValue: 0.15, baseDuration: 40, dotInterval: 10 },
  출혈: { key: '출혈', category: 'dot_physical', baseValue: 0.20, baseDuration: 20, dotInterval: 10 },
  독:   { key: '독',   category: 'dot_hybrid',   baseValue: 0.08, baseDuration: 30, dotInterval: 10 },
  둔화: { key: '둔화', category: 'speed_mod',    baseValue: -0.40, baseDuration: 20, dotInterval: 0 },
  암흑: { key: '암흑', category: 'accuracy_mod', baseValue: -25,   baseDuration: 30, dotInterval: 0 },
  감전: { key: '감전', category: 'damage_taken_mod', baseValue: 0.20, baseDuration: 20, dotInterval: 0 },
}

export const STATUS_KEYS: StatusKind[] = ['점화', '출혈', '독', '둔화', '암흑', '감전']

// 스택 룰
export const MAX_STACKS = 5
export const STACK_MULT_BASE = 1.3

export function stackMultiplier(stacks: number): number {
  const clamped = Math.min(Math.max(stacks, 1), MAX_STACKS)
  return Math.pow(STACK_MULT_BASE, clamped - 1)
}

// 디버프 클램프
export const SLOW_CAP = -0.90       // 최대 속도 -90%
export const BLIND_CAP = -75        // 최대 명중 -75
export const SHOCK_CAP = 1.00       // 최대 +100% 받는 데미지
