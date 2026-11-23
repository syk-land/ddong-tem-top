import type { Character, ItemInstance, JunkResonanceId, TraitQuirkId } from '@/types'
import { WEAPON_TRAITS, ARMOR_TRAITS } from '@/data/traits'

export interface QuirkInfo {
  id: TraitQuirkId
  nameKo: string
  nameEn: string
  hintKo: string
  hintEn: string
  descKo: string
  descEn: string
}

export interface ResonanceInfo {
  id: JunkResonanceId
  nameKo: string
  nameEn: string
  descKo: string
  descEn: string
}

export const QUIRK_INFO: Record<TraitQuirkId, QuirkInfo> = {
  old_weapon: {
    id: 'old_weapon',
    nameKo: '집념 (헛스윙 역전)',
    nameEn: 'Grudge (Miss Reversal)',
    hintKo: '자꾸 빗나가는 데엔 숨은 허점이 있을지도...?',
    hintEn: 'Missing attacks might hide an unexpected loophole...',
    descKo: '공격이 빗나갈 때마다 집념 +1 (최대 5). 다음 명중 시 스택당 +60% 피해, 3스택↑이면 확정 치명타 + 적 방어 100% 무시.',
    descEn: 'Each miss grants +1 Grudge (max 5). Next hit deals +60% dmg/stack; at 3+ stacks, guaranteed crit & ignores 100% DEF.',
  },
  rust_weapon: {
    id: 'rust_weapon',
    nameKo: '부식된 틈새 (고방어 저격)',
    nameEn: 'Corroded Crack (Anti-DEF)',
    hintKo: '단단한 적일수록 녹이 더 잘 파고들지도...?',
    hintEn: 'Rust might bite deeper into heavily armored foes...',
    descKo: '명중 시 20% 확률로 독 부여 + 적 방어% 비례 방어 무시 고정 피해 (공격력 × 적방어% × 1.5).',
    descEn: '20% chance to inflict Poison + bonus true damage scaling with enemy DEF% (ATK × EnemyDEF% × 1.5).',
  },
  heavy_weapon: {
    id: 'heavy_weapon',
    nameKo: '느림의 미학 (턴 캔슬)',
    nameEn: 'Heavy Timing (Turn Cancel)',
    hintKo: '적이 공격하기 직전에 내려치면 허점이 생길지도...?',
    hintEn: 'Striking right before an enemy acts might break their rhythm...',
    descKo: '명중 시 적 행동 게이지가 70%↑이면 카운터 격돌: 피해 ×2.2 + 적 게이지 0 초기화.',
    descEn: 'If enemy action gauge is >=70% on hit: Counter Clash deals 2.2x damage and resets enemy gauge to 0.',
  },
  rust_armor: {
    id: 'rust_armor',
    nameKo: '파상풍 덫 (피격 반격)',
    nameEn: 'Tetanus Trap (Hit Counter)',
    hintKo: '녹슨 갑옷은 맞는 쪽보다 때리는 쪽이 더 위험할지도...?',
    hintEn: 'Hitting rusty armor might hurt the attacker more...',
    descKo: '피격 시 35% 확률로 적에게 독+출혈 부여. 이미 상태이상인 적에겐 총 스택 × 적 최대HP 2% 반격.',
    descEn: '35% chance on hit to inflict Poison+Bleed. If attacker already has statuses, counters for 2% enemy MaxHP per stack.',
  },
  heavy_armor: {
    id: 'heavy_armor',
    nameKo: '체중 실어 넘기기 (강타 반사)',
    nameEn: 'Deadweight Reversal (Heavy Reflect)',
    hintKo: '한 방에 크게 맞을수록 되돌려줄 허점이 보일지도...?',
    hintEn: 'Taking a massive single blow might open a lethal counter...',
    descKo: '단일 피격으로 최대 HP 15%↑ 피해를 받으면 초과분의 150% 즉시 반사 + 다음 공격 관통 +40%.',
    descEn: 'When taking >=15% MaxHP in one hit, reflects 150% of excess damage and grants +40% PEN on next attack.',
  },
  broken_armor: {
    id: 'broken_armor',
    nameKo: '깨진 조각의 틈 (딸피 폭주)',
    nameEn: 'Shattered Edge (Low-HP Frenzy)',
    hintKo: '벼랑 끝에 몰렸을 때 진짜 허점이 열릴지도...?',
    hintEn: 'Being on the brink of death might unlock hidden power...',
    descKo: 'HP 35% 이하일 때 회피 +35%p, 공격력 +50%, 게이지 가속 +25% 활성화.',
    descEn: 'While HP <=35%, gain +35%p EVA, +50% ATK, and +25% gauge speed.',
  },
}

export const RESONANCE_INFO: Record<JunkResonanceId, ResonanceInfo> = {
  loophole_master: {
    id: 'loophole_master',
    nameKo: '허점의 달인',
    nameEn: 'Loophole Master',
    descKo: '무기·갑옷 모두 하급 특성: 모든 허점 기믹 효과 ×1.3 & 조건 완화 + 시간의 파동 충전 +30%',
    descEn: 'Both items Low-tier trait: All loophole effects x1.3 & easier triggers + Time Surge charge +30%',
  },
  david_stone: {
    id: 'david_stone',
    nameKo: '다윗의 돌멩이',
    nameEn: "David's Pebble",
    descKo: '무기·갑옷 모두 노말 등급: 보스 상대로 치명타 확률 +25%p, 방어 관통 +30%',
    descEn: 'Both items Normal grade: +25%p Crit Rate & +30% PEN against Bosses',
  },
  tetanus_set: {
    id: 'tetanus_set',
    nameKo: '파상풍 풀세트',
    nameEn: 'Full Tetanus Set',
    descKo: '녹슨 무기 + 녹슨 갑옷: 적 독/출혈 DoT 피해 +50%, 적 회복량 -50%',
    descEn: 'Rusty Weapon + Rusty Armor: +50% Poison/Bleed DoT damage & -50% enemy healing',
  },
}

export function getItemQuirk(item: ItemInstance | null | undefined): TraitQuirkId | null {
  if (!item) return null
  const def = item.kind === 'weapon' ? WEAPON_TRAITS[item.trait] : ARMOR_TRAITS[item.trait]
  return def?.quirk ?? null
}

export function getActiveResonances(player: Character): JunkResonanceId[] {
  const res: JunkResonanceId[] = []
  const w = player.weapon
  const a = player.armor
  if (!w || !a) return res

  const wDef = WEAPON_TRAITS[w.trait]
  const aDef = ARMOR_TRAITS[a.trait]

  if (wDef?.tier === '하급' && aDef?.tier === '하급') {
    res.push('loophole_master')
  }
  if (w.grade === '노말' && a.grade === '노말') {
    res.push('david_stone')
  }
  if (w.trait === '녹슨' && a.trait === '녹슨') {
    res.push('tetanus_set')
  }
  return res
}

export interface PlayerSynergyState {
  weaponQuirk: TraitQuirkId | null
  armorQuirk: TraitQuirkId | null
  resonances: JunkResonanceId[]
  hasLoopholeMaster: boolean
  hasDavidStone: boolean
  hasTetanusSet: boolean
  /** 허점의 달인 공명 배수 (1.0 또는 1.3) */
  loopholeMult: number
}

export function getPlayerSynergy(player: Character): PlayerSynergyState {
  const resonances = getActiveResonances(player)
  const hasLoopholeMaster = resonances.includes('loophole_master')
  return {
    weaponQuirk: getItemQuirk(player.weapon),
    armorQuirk: getItemQuirk(player.armor),
    resonances,
    hasLoopholeMaster,
    hasDavidStone: resonances.includes('david_stone'),
    hasTetanusSet: resonances.includes('tetanus_set'),
    loopholeMult: hasLoopholeMaster ? 1.3 : 1.0,
  }
}

export function isBrokenArmorActive(player: Character, hasLoopholeMaster: boolean): boolean {
  if (getItemQuirk(player.armor) !== 'broken_armor') return false
  if (player.maxHp <= 0) return false
  const threshold = hasLoopholeMaster ? 0.45 : 0.35
  return player.hp / player.maxHp <= threshold
}
