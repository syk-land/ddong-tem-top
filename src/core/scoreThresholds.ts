// ============================================================
// 챕터별 통과 가능성 임계값 — ItemDetail 공/방 칩 색상 결정용.
//
// 데이터 원천: formulaAccuracyByRun.ts 의 50,000 RUN 시뮬레이션 (v5 v3 itemValue.ts 적용 후)
//   "챕터별 도달 임계 — 챕터 ≥ N 도달한 캐릭터의 score 분포 (기존공식)" 표
//   CRN=ON / BUILD_LOCK=ON / Bootstrap=1000, n=47,480 → 클리어 323
//   sim AUC 0.988 [0.985, 0.991], Pearson 0.778 [0.773, 0.783]
//
// 임계 분위:
//   - p5  : 사실상 통과 한계 (이보다 낮으면 거의 못 감)
//   - p25 : 운빨로 통과 가능
//   - p50 : 절반의 확률로 통과
//   - p75 : 안정적으로 통과
//   - p95 : 거의 확실히 통과
//
// 새 itemValue.ts (v5 v3 공식: v3_atk + def×50 + maxHp×0.02) 스케일에 맞춰진 값.
// itemValue 공식이 바뀌면 sim 다시 돌려서 갱신해야 함.
// ============================================================

export interface ChapterThreshold {
  p5: number   // 통과 한계
  p25: number  // 운빨
  p50: number  // 절반
  p75: number  // 안정
  p95: number  // 거의 확실
}

export const CHAPTER_THRESHOLDS: Record<number, ChapterThreshold> = {
  1:  { p5:  4.9, p25:  7.5, p50:  9.9, p75: 14.2, p95: 23.5 },
  2:  { p5:  6.8, p25: 10.1, p50: 13.6, p75: 18.1, p95: 30.6 },
  3:  { p5:  8.3, p25: 12.5, p50: 16.1, p75: 20.8, p95: 36.5 },
  4:  { p5: 10.1, p25: 14.7, p50: 18.4, p75: 23.6, p95: 41.8 },
  5:  { p5: 11.9, p25: 17.3, p50: 21.4, p75: 27.5, p95: 47.4 },
  6:  { p5: 14.2, p25: 20.2, p50: 25.2, p75: 33.3, p95: 53.5 },
  7:  { p5: 15.8, p25: 22.9, p50: 28.6, p75: 38.7, p95: 57.9 },
  8:  { p5: 17.9, p25: 26.3, p50: 33.5, p75: 44.0, p95: 62.8 },
  9:  { p5: 20.4, p25: 30.7, p50: 39.8, p75: 49.0, p95: 68.3 },
  10: { p5: 22.3, p25: 34.3, p50: 43.2, p75: 52.5, p95: 71.6 },
}

export type ScoreTier = 'impossible' | 'risky' | 'half' | 'stable' | 'safe'

export interface ScoreTierInfo {
  tier: ScoreTier
  label: string
  // Tailwind class 조각 — 칩 배경 / 테두리 / 텍스트 보조용
  // (사용처에서 적절히 조합)
  bgClass: string
  borderClass: string
  textClass: string
  shortLabel: string
}

const TIER_INFO: Record<ScoreTier, ScoreTierInfo> = {
  impossible: {
    tier: 'impossible',
    label: '통과 불가',
    bgClass: 'bg-slate-700/40',
    borderClass: 'border-slate-600',
    textClass: 'text-gray-400',
    shortLabel: '↓',
  },
  risky: {
    tier: 'risky',
    label: '운빨',
    bgClass: 'bg-orange-900/30',
    borderClass: 'border-orange-500/50',
    textClass: 'text-orange-300',
    shortLabel: '?',
  },
  half: {
    tier: 'half',
    label: '절반',
    bgClass: 'bg-yellow-900/30',
    borderClass: 'border-yellow-500/50',
    textClass: 'text-yellow-300',
    shortLabel: '~',
  },
  stable: {
    tier: 'stable',
    label: '안정',
    bgClass: 'bg-cyan-900/30',
    borderClass: 'border-cyan-400/60',
    textClass: 'text-cyan-200',
    shortLabel: '✓',
  },
  safe: {
    tier: 'safe',
    label: '확실',
    bgClass: 'bg-amber-900/30',
    borderClass: 'border-amber-400/70',
    textClass: 'text-amber-200',
    shortLabel: '✦',
  },
}

// 현재 챕터에서 score 가 어느 통과 가능성 구간인지
export function getScoreTier(chapter: number, score: number): ScoreTierInfo {
  const ch = Math.max(1, Math.min(10, Math.round(chapter)))
  const t = CHAPTER_THRESHOLDS[ch]
  if (score < t.p5)  return TIER_INFO.impossible
  if (score < t.p25) return TIER_INFO.risky
  if (score < t.p50) return TIER_INFO.half
  if (score < t.p75) return TIER_INFO.stable
  return TIER_INFO.safe
}

// 현재 챕터 임계값을 그대로 반환 (UI 에서 추가 정보 표시용)
export function getChapterThreshold(chapter: number): ChapterThreshold {
  const ch = Math.max(1, Math.min(10, Math.round(chapter)))
  return CHAPTER_THRESHOLDS[ch]
}

// ── 3-tier 단순화 (장비카드 테두리용) ──
//   위험 (빨강) — < p25  (impossible + risky)
//   적정 (노랑) — p25 ~ p75  (half + stable)
//   여유 (초록) — ≥ p75  (safe)
export type DangerTier = 'danger' | 'normal' | 'safe'

export interface DangerTierInfo {
  tier: DangerTier
  label: string
  borderClass: string  // Tailwind border-2 색
  glowClass: string    // 선택적 shadow glow (강조용)
}

const DANGER_INFO: Record<DangerTier, DangerTierInfo> = {
  danger: {
    tier: 'danger',
    label: '위험',
    borderClass: 'border-rose-500/70',
    glowClass: 'shadow-[0_0_10px_rgba(244,63,94,0.35)]',
  },
  normal: {
    tier: 'normal',
    label: '적정',
    borderClass: 'border-yellow-400/70',
    glowClass: 'shadow-[0_0_10px_rgba(250,204,21,0.30)]',
  },
  safe: {
    tier: 'safe',
    label: '여유',
    borderClass: 'border-emerald-300/50',
    glowClass: 'shadow-[0_0_10px_rgba(110,231,183,0.22)]',
  },
}

export function getDangerTier(chapter: number, score: number): DangerTierInfo {
  const t = getChapterThreshold(chapter)
  if (score < t.p25) return DANGER_INFO.danger
  if (score < t.p75) return DANGER_INFO.normal
  return DANGER_INFO.safe
}
