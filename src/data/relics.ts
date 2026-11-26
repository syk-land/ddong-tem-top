import type { RelicId } from '@/types'

export interface RelicDef {
  id: RelicId
  nameKo: string
  nameEn: string
  descKo: string
  descEn: string
  iconPath: string
}

const A = import.meta.env.BASE_URL.replace(/\/$/, '')

export const RELICS: Record<RelicId, RelicDef> = {
  cracked_watch: {
    id: 'cracked_watch',
    nameKo: '금 간 회중시계',
    nameEn: 'Cracked Pocket Watch',
    descKo: '전투 시작 시 시간의 파동 +35 충전 · 수동 파동 공격 배율 +0.25',
    descEn: 'Start combat with +35 Time Surge · Manual Surge ATK mult +0.25',
    iconPath: `${A}/images/UI/spd.webp`,
  },
  rusty_nail_jar: {
    id: 'rusty_nail_jar',
    nameKo: '녹슨 못 단지',
    nameEn: 'Jar of Rusty Nails',
    descKo: '공격 명중 시 독·출혈 추가 발동 확률 +15%p',
    descEn: '+15%p Poison & Bleed proc chance on basic hits',
    iconPath: `${A}/images/UI/poison.webp`,
  },
  lead_dice: {
    id: 'lead_dice',
    nameKo: '납 주사위',
    nameEn: 'Weighted Lead Dice',
    descKo: '행운 +8 · 상점 구매가 및 모루 연성 비용 15% 할인',
    descEn: 'LUK +8 · 15% discount on Shop purchases & Anvil Tempering',
    iconPath: `${A}/images/UI/luk.webp`,
  },
  broken_compass: {
    id: 'broken_compass',
    nameKo: '부서진 나침반',
    nameEn: 'Broken Compass',
    descKo: '공격 빗나감 시 MP 10% 회복 & 시간의 파동 추가 +10 충전',
    descEn: 'On miss: restore 10% MaxMP & +10 extra Time Surge',
    iconPath: `${A}/images/SKILL/manacharge.webp`,
  },
  tattered_cloak: {
    id: 'tattered_cloak',
    nameKo: '누더기 망토',
    nameEn: 'Tattered Cloak',
    descKo: '회피 +10%p · 적 공격 회피 시 최대 HP 4% 회복',
    descEn: 'EVA +10%p · Recover 4% MaxHP whenever you dodge an attack',
    iconPath: `${A}/images/SKILL/evade.webp`,
  },
  overloaded_coil: {
    id: 'overloaded_coil',
    nameKo: '과부하 코일',
    nameEn: 'Overloaded Coil',
    descKo: '무기 스킬 자동 발동률 +12%p',
    descEn: '+12%p Weapon auto-skill activation rate',
    iconPath: `${A}/images/SKILL/lightningspear.webp`,
  },
  beggar_bowl: {
    id: 'beggar_bowl',
    nameKo: '거지의 밥그릇',
    nameEn: "Beggar's Bowl",
    descKo: '착용 무기+갑옷 티어 합 10 이하일 때 공격력·마공 +15%, 방어 +12%',
    descEn: 'While equipped gear tier sum <= 10: +15% ATK/MagicATK & +12% DEF',
    iconPath: `${A}/images/UI/EX_grade.webp`,
  },
  cursed_anvil_shard: {
    id: 'cursed_anvil_shard',
    nameKo: '저주받은 모루 파편',
    nameEn: 'Cursed Anvil Shard',
    descKo: '부식 연성 계수 증폭 ×1.3 · 관통 +12%p',
    descEn: 'Corrosion Temper bonus x1.3 · +12%p PEN',
    iconPath: `${A}/images/SKILL/smash.webp`,
  },
}

export const ALL_RELIC_IDS = Object.keys(RELICS) as RelicId[]
