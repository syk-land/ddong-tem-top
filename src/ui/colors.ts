import type { Grade, TraitTier, StatusKind, StatKey, ChapterTheme, ItemInstance } from '@/types'

// 등급별 텍스트 색상 클래스
export const gradeColorClass: Record<Grade, string> = {
  노말: 'text-grade-normal',
  레어: 'text-grade-rare',
  스페셜: 'text-grade-special',
  레전드: 'text-grade-legend',
}

// 등급별 테두리 색상 (아이템 카드 외곽선)
export const gradeBorderClass: Record<Grade, string> = {
  노말: 'border-grade-normal',
  레어: 'border-grade-rare',
  스페셜: 'border-grade-special',
  레전드: 'border-grade-legend',
}

// 등급별 배경 광원 (선택적 — 살짝 빛나는 효과)
export const gradeGlowClass: Record<Grade, string> = {
  노말: 'shadow-grade-normal/0',
  레어: 'shadow-grade-rare/30 shadow-md',
  스페셜: 'shadow-grade-special/40 shadow-lg',
  레전드: 'shadow-grade-legend/50 shadow-lg',
}

export const traitTierColorClass: Record<TraitTier, string> = {
  하급: 'text-trait-low',
  보통: 'text-trait-common',
  희귀: 'text-trait-rare',
  특별: 'text-trait-special',
}

// 티어 인덱스 → 색상
export function tierColorClass(tier: number): string {
  if (tier <= 4) return 'text-trait-low'
  if (tier <= 8) return 'text-trait-common'
  if (tier <= 12) return 'text-trait-rare'
  return 'text-trait-special'
}

// 상태이상 색상
export const statusColorClass: Record<StatusKind, string> = {
  점화: 'text-status-burn',
  출혈: 'text-status-bleed',
  독: 'text-status-poison',
  둔화: 'text-status-slow',
  암흑: 'text-status-blind',
  감전: 'text-status-shock',
}

// 상태이상 배경/박스 색상 (배지용)
export const statusBgClass: Record<StatusKind, string> = {
  점화: 'bg-status-burn/20 border-status-burn/40 text-status-burn',
  출혈: 'bg-status-bleed/20 border-status-bleed/40 text-status-bleed',
  독: 'bg-status-poison/20 border-status-poison/40 text-status-poison',
  둔화: 'bg-status-slow/20 border-status-slow/40 text-status-slow',
  암흑: 'bg-status-blind/30 border-status-blind/40 text-purple-300',
  감전: 'bg-status-shock/20 border-status-shock/40 text-status-shock',
}

// v6 5스탯 카테고리 색상
export const statColorClass: Record<StatKey, string> = {
  힘: 'text-stat-phys_atk',
  민첩: 'text-stat-speed',
  체력: 'text-stat-hp',
  마력: 'text-stat-mp',
  행운: 'text-stat-luck',
}

// 클리어 등급 색상
export const rankColorClass: Record<string, string> = {
  F: 'text-rank-F',
  E: 'text-rank-E',
  D: 'text-rank-D',
  C: 'text-rank-C',
  B: 'text-rank-B',
  A: 'text-rank-A',
  S: 'text-rank-S font-bold',
  SS: 'text-rank-SS font-bold',
  SSS: 'text-rank-SSS font-bold',
  EX: 'text-rank-EX font-bold animate-ex-shimmer',
}

// 챕터 테마 강조 색상
export const themeColorClass: Record<ChapterTheme, string> = {
  고블린: 'text-theme-goblin',
  골렘: 'text-theme-golem',
  언데드: 'text-theme-undead',
  환영: 'text-theme-mirage',
  흡혈귀: 'text-theme-vampire',
  심해: 'text-theme-deep',
  기계: 'text-theme-machine',
  용암: 'text-theme-lava',
  암흑: 'text-theme-dark',
  천공: 'text-theme-sky',
  맹독: 'text-theme-venom',
}

// 전투 로그 라인 종류
export type LogKind =
  | 'player' | 'enemy' | 'critical' | 'miss' | 'heal'
  | 'damage' | 'status' | 'mp' | 'skill' | 'gold' | 'info' | 'reward'

export const logColorClass: Record<LogKind, string> = {
  player: 'text-log-player',
  enemy: 'text-log-enemy',
  critical: 'text-log-critical font-bold',
  miss: 'text-log-miss italic',
  heal: 'text-log-heal',
  damage: 'text-log-damage',
  status: 'text-log-status',
  mp: 'text-log-mp',
  skill: 'text-log-skill',
  gold: 'text-log-gold',
  info: 'text-log-info',
  reward: 'text-log-reward font-semibold',
}

// 로그 발신자별 prefix 아이콘 (시각 구분 강화)
export const logPrefix: Record<LogKind, string> = {
  player: '▶',
  enemy: '◀',
  critical: '✦',
  miss: '×',
  heal: '♥',
  damage: '▶',
  status: '◈',
  mp: '◆',
  skill: '▶',
  gold: '★',
  info: '·',
  reward: '★',
}

// HP 비율에 따른 바 색상
export function hpBarColorClass(hpPercent: number): string {
  if (hpPercent <= 30) return 'bg-bar-hp_low animate-pulse-low'
  if (hpPercent <= 60) return 'bg-bar-hp_mid'
  return 'bg-bar-hp_full'
}

// 아이템 전체 색상 (특성 + 등급 조합)
export function itemNameColorClass(item: ItemInstance | null): string {
  if (!item) return 'text-gray-500'
  return tierColorClass(item.tier)
}

// 무기/갑옷 종류별 색상 (살짝 차별화)
export function itemKindAccent(kind: 'weapon' | 'armor'): string {
  return kind === 'weapon' ? 'text-rose-200' : 'text-sky-200'
}

// "낡은 노말 단검" 형식의 표시명에서 특성/등급/무기 부분을 색상 분리
export function formatItemNameHTML(item: ItemInstance | null): { trait: string; traitClass: string; grade: string; gradeClass: string; base: string; baseClass: string } {
  if (!item) {
    return { trait: '', traitClass: '', grade: '', gradeClass: '', base: '미 착용', baseClass: 'text-gray-500' }
  }
  // 특성 색상은 tier 기반, grade 색상은 grade 기반
  return {
    trait: item.trait,
    traitClass: tierColorClass(item.tier),
    grade: item.grade,
    gradeClass: gradeColorClass[item.grade],
    base: item.baseKey.replace(/_/g, ' '),
    baseClass: itemKindAccent(item.kind),
  }
}
