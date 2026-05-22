// ============================================================
// sim 공통 통계 유틸 — Pearson / Spearman / AUC + Bootstrap CI.
//
// AUC 는 Mann-Whitney U 항등식으로 O(n log n) 구현 (rank 기반).
//   AUC = (R_pos − n_pos(n_pos+1)/2) / (n_pos × n_neg)
//
// Bootstrap CI 는 with-replacement 재샘플링 1000회로 percentile 분위
// 산출. paired 비교는 같은 인덱스 재샘플로 두 statistic 의 차이 CI.
// ============================================================

import { mulberry32 } from './_seededRng'

// ── Ranks (평균순위로 동률 처리) ──
function avgRanks(arr: number[]): number[] {
  const n = arr.length
  const idx = arr.map((v, i) => ({ v, i })).sort((a, b) => a.v - b.v)
  const r = new Array(n).fill(0)
  let i = 0
  while (i < n) {
    let j = i
    while (j + 1 < n && idx[j + 1].v === idx[i].v) j++
    const avg = (i + j) / 2 + 1 // 1-based 평균순위
    for (let k = i; k <= j; k++) r[idx[k].i] = avg
    i = j + 1
  }
  return r
}

export function pearson(xs: number[], ys: number[]): number {
  const n = xs.length
  if (n === 0) return 0
  let sx = 0, sy = 0
  for (let i = 0; i < n; i++) { sx += xs[i]; sy += ys[i] }
  const mx = sx / n, my = sy / n
  let num = 0, dx = 0, dy = 0
  for (let i = 0; i < n; i++) {
    const a = xs[i] - mx, b = ys[i] - my
    num += a * b; dx += a * a; dy += b * b
  }
  const den = Math.sqrt(dx * dy)
  return den > 0 ? num / den : 0
}

export function spearman(xs: number[], ys: number[]): number {
  return pearson(avgRanks(xs), avgRanks(ys))
}

// AUC — Mann-Whitney U. labels: 0/1 (또는 ≥0.5/<0.5)
export function auc(scores: number[], labels: number[]): number {
  const n = scores.length
  if (n === 0) return 0.5
  const ranks = avgRanks(scores)
  let rPos = 0, nPos = 0
  for (let i = 0; i < n; i++) {
    if (labels[i] > 0.5) { rPos += ranks[i]; nPos++ }
  }
  const nNeg = n - nPos
  if (nPos === 0 || nNeg === 0) return 0.5
  return (rPos - (nPos * (nPos + 1)) / 2) / (nPos * nNeg)
}

// ── Bootstrap CI ──
interface BootOpts {
  nBoot?: number
  alpha?: number
  seed?: number
}

export interface CIResult {
  est: number
  lo: number
  hi: number
}

// 단일 표본(예: 점수 배열, 레이블 배열)에 대한 statistic 의 CI
// statistic(indices) 형태로 받아 인덱스 기반 재샘플링.
export function bootstrapCI(
  n: number,
  statistic: (indices: Uint32Array) => number,
  opts: BootOpts = {},
): CIResult {
  const { nBoot = 1000, alpha = 0.05, seed = 0xc1ebf00d } = opts
  if (n === 0) return { est: 0, lo: 0, hi: 0 }
  const identity = new Uint32Array(n)
  for (let i = 0; i < n; i++) identity[i] = i
  const est = statistic(identity)
  const rng = mulberry32(seed)
  const sample = new Uint32Array(n)
  const stats = new Float64Array(nBoot)
  for (let b = 0; b < nBoot; b++) {
    for (let i = 0; i < n; i++) sample[i] = Math.floor(rng() * n)
    stats[b] = statistic(sample)
  }
  const sorted = Array.from(stats).sort((a, b) => a - b)
  const lo = sorted[Math.max(0, Math.floor((alpha / 2) * nBoot))]
  const hi = sorted[Math.min(nBoot - 1, Math.floor((1 - alpha / 2) * nBoot))]
  return { est, lo, hi }
}

// 두 statistic 의 차이 (paired — 같은 인덱스 재샘플)
export function pairedBootstrapDiff(
  n: number,
  statA: (indices: Uint32Array) => number,
  statB: (indices: Uint32Array) => number,
  opts: BootOpts = {},
): CIResult {
  const { nBoot = 1000, alpha = 0.05, seed = 0xc1ebf00d } = opts
  if (n === 0) return { est: 0, lo: 0, hi: 0 }
  const identity = new Uint32Array(n)
  for (let i = 0; i < n; i++) identity[i] = i
  const est = statA(identity) - statB(identity)
  const rng = mulberry32(seed)
  const sample = new Uint32Array(n)
  const diffs = new Float64Array(nBoot)
  for (let b = 0; b < nBoot; b++) {
    for (let i = 0; i < n; i++) sample[i] = Math.floor(rng() * n)
    diffs[b] = statA(sample) - statB(sample)
  }
  const sorted = Array.from(diffs).sort((a, b) => a - b)
  const lo = sorted[Math.max(0, Math.floor((alpha / 2) * nBoot))]
  const hi = sorted[Math.min(nBoot - 1, Math.floor((1 - alpha / 2) * nBoot))]
  return { est, lo, hi }
}

// ── 헬퍼: 점수/레이블 배열 → indices 기반 statistic ──
export function pearsonStat(xs: number[], ys: number[]) {
  return (idx: Uint32Array) => {
    const n = idx.length
    let sx = 0, sy = 0
    for (let i = 0; i < n; i++) { sx += xs[idx[i]]; sy += ys[idx[i]] }
    const mx = sx / n, my = sy / n
    let num = 0, dx = 0, dy = 0
    for (let i = 0; i < n; i++) {
      const a = xs[idx[i]] - mx, b = ys[idx[i]] - my
      num += a * b; dx += a * a; dy += b * b
    }
    const den = Math.sqrt(dx * dy)
    return den > 0 ? num / den : 0
  }
}

export function spearmanStat(xs: number[], ys: number[]) {
  // Spearman 은 ranks 가 인덱스에 의존하므로 매 부트마다 ranks 재계산 필요.
  return (idx: Uint32Array) => {
    const n = idx.length
    const sx = new Array<number>(n)
    const sy = new Array<number>(n)
    for (let i = 0; i < n; i++) { sx[i] = xs[idx[i]]; sy[i] = ys[idx[i]] }
    return pearson(avgRanks(sx), avgRanks(sy))
  }
}

export function aucStat(scores: number[], labels: number[]) {
  return (idx: Uint32Array) => {
    const n = idx.length
    const s = new Array<number>(n)
    const l = new Array<number>(n)
    for (let i = 0; i < n; i++) { s[i] = scores[idx[i]]; l[i] = labels[idx[i]] }
    return auc(s, l)
  }
}

// 보기 좋은 포맷팅
export function fmtCI(ci: CIResult, digits = 3): string {
  return `${ci.est.toFixed(digits)} [${ci.lo.toFixed(digits)}, ${ci.hi.toFixed(digits)}]`
}

// ── Percentile (선형 보간 없음, 단순 인덱스) ──
export function percentile(arr: number[], p: number): number {
  if (arr.length === 0) return 0
  const sorted = [...arr].sort((a, b) => a - b)
  const idx = Math.max(0, Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * p)))
  return sorted[idx]
}

export function percentiles(arr: number[], ps: number[]): number[] {
  if (arr.length === 0) return ps.map(() => 0)
  const sorted = [...arr].sort((a, b) => a - b)
  return ps.map((p) => {
    const idx = Math.max(0, Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * p)))
    return sorted[idx]
  })
}

// ── 단변량 로지스틱 회귀 (Newton-Raphson IRLS) ──
//   logit(P(y=1 | x)) = β₀ + β₁ · x
//   수렴 조건: |Δβ₀| + |Δβ₁| < tol 또는 maxIter 도달
export interface LogisticFit {
  b0: number
  b1: number
  iter: number
  converged: boolean
  // 진단
  logLik: number     // 최종 log-likelihood
  nPos: number
  nNeg: number
}

export function logisticFit(
  xs: number[],
  ys: number[],
  opts: { maxIter?: number; tol?: number } = {},
): LogisticFit {
  const { maxIter = 50, tol = 1e-7 } = opts
  const n = xs.length
  let b0 = 0, b1 = 0
  let iter = 0
  let converged = false
  for (; iter < maxIter; iter++) {
    let g0 = 0, g1 = 0
    let h00 = 0, h01 = 0, h11 = 0
    for (let i = 0; i < n; i++) {
      const z = b0 + b1 * xs[i]
      // p = σ(z) — overflow 안전 처리
      const p = z >= 0 ? 1 / (1 + Math.exp(-z)) : Math.exp(z) / (1 + Math.exp(z))
      const w = p * (1 - p)
      const r = ys[i] - p
      g0 += r
      g1 += r * xs[i]
      h00 += w
      h01 += w * xs[i]
      h11 += w * xs[i] * xs[i]
    }
    const det = h00 * h11 - h01 * h01
    if (Math.abs(det) < 1e-12) break
    const db0 = (h11 * g0 - h01 * g1) / det
    const db1 = (-h01 * g0 + h00 * g1) / det
    b0 += db0
    b1 += db1
    if (Math.abs(db0) + Math.abs(db1) < tol) {
      converged = true
      iter++
      break
    }
  }
  // 진단 — log-likelihood
  let logLik = 0
  let nPos = 0, nNeg = 0
  for (let i = 0; i < n; i++) {
    const z = b0 + b1 * xs[i]
    const logP = z >= 0
      ? -Math.log(1 + Math.exp(-z))
      : z - Math.log(1 + Math.exp(z))
    const log1mP = z >= 0
      ? -z - Math.log(1 + Math.exp(-z))
      : -Math.log(1 + Math.exp(z))
    logLik += ys[i] > 0.5 ? logP : log1mP
    if (ys[i] > 0.5) nPos++; else nNeg++
  }
  return { b0, b1, iter, converged, logLik, nPos, nNeg }
}

// 주어진 P_target 에서의 x 임계 (logit 역변환)
export function logisticThreshold(fit: LogisticFit, pTarget: number): number {
  if (fit.b1 === 0) return NaN
  const logit = Math.log(pTarget / (1 - pTarget))
  return (logit - fit.b0) / fit.b1
}
