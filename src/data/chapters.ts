import type { ChapterThemeDef, ChapterTheme } from '@/types'

// 1.3 / 7.1 11개 챕터 테마 풀
export const CHAPTER_THEMES: Record<ChapterTheme, ChapterThemeDef> = {
  고블린: {
    key: '고블린', baseName: '고블린 군락', hardName: '고블린 해방군',
    description: '다수 출몰, 연계 공격',
    normalMonsters: [
      { name: '고블린 전사' },
      { name: '고블린 궁수', atkMod: 1.1, defMod: 0.8 },
      { name: '고블린 주술사', atkMod: 0.9, defMod: 0.7 },
    ],
    boss: { name: '고블린 족장', hpMod: 1.1, trait: 'summon_minions' },
    hardBoss: { name: '고블린 해방군 사령관', hpMod: 3.5, atkMod: 1.15, trait: 'summon_minions' },
    encounterMin: 2, encounterMax: 3,
  },
  골렘: {
    key: '골렘', baseName: '골렘의 무덤', hardName: '고대 마도 골렘',
    description: '단일 출몰, 고방어',
    normalMonsters: [
      { name: '바위 골렘', defMod: 1.5, atkMod: 0.9 },
      { name: '철갑 골렘', defMod: 1.8, trait: 'reflect_physical' },
      { name: '룬 골렘', defMod: 1.2, element: '번개', trait: 'magic_attacker' },
    ],
    boss: { name: '고대 거신 골렘', hpMod: 1.2, defMod: 1.5 },
    hardBoss: { name: '고대 마도 골렘 군주', hpMod: 1.6, defMod: 1.6, trait: 'magic_immune' },
    encounterMin: 1, encounterMax: 1,
  },
  언데드: {
    key: '언데드', baseName: '언데드 미궁', hardName: '저주받은 군대',
    description: '부활, 최대 HP 디버프',
    normalMonsters: [
      { name: '부패한 좀비', trait: 'revive_chance' },
      { name: '무덤 스켈레톤', trait: 'first_hit_immune' },
      { name: '구울', trait: 'heal_reduction' },
    ],
    boss: { name: '리치왕', hpMod: 1.2, trait: 'summon_undead' },
    hardBoss: { name: '저주받은 리치 황제', hpMod: 1.4, trait: 'max_hp_curse' },
    encounterMin: 2, encounterMax: 3,
  },
  환영: {
    key: '환영', baseName: '환영의 숲', hardName: '신기루 환영',
    description: '회피, 환술',
    normalMonsters: [
      { name: '신기루 새', trait: 'accuracy_debuff' },
      { name: '환영 고양이', trait: 'high_evasion' },
      { name: '환영 슬라임', trait: 'copy_player' },
    ],
    boss: { name: '환영의 지배자', trait: 'split_3' },
    hardBoss: { name: '신기루 군주', hpMod: 2.5, trait: 'split_3_reflect' },
    encounterMin: 1, encounterMax: 2,
  },
  흡혈귀: {
    key: '흡혈귀', baseName: '흡혈귀의 성', hardName: '블러드 로드',
    description: '흡혈, 출혈',
    normalMonsters: [
      { name: '흡혈 박쥐', trait: 'lifesteal' },
      { name: '핏빛 사도', trait: 'bleed_chance' },
      { name: '흡혈 기사', trait: 'crit_vs_bleeding' },
    ],
    boss: { name: '백작 블러드 로드', trait: 'blood_strike' },
    hardBoss: { name: '진조 블러드 로드', hpMod: 1.2, trait: 'blood_strike_amplified' },
    encounterMin: 1, encounterMax: 2,
  },
  심해: {
    key: '심해', baseName: '심해의 침수 구역', hardName: '심해의 압박',
    description: '둔화, 턴 제한',
    normalMonsters: [
      { name: '심해 아귀', trait: 'priority_attack' },
      { name: '심해 물고기', trait: 'speed_debuff' },
      { name: '심해 문어', trait: 'crit_immune' },
    ],
    boss: { name: '크라켄', trait: 'bind' },
    hardBoss: { name: '심해의 압박자', hpMod: 0.2, trait: 'bind_oxygen' },
    encounterMin: 1, encounterMax: 1,
  },
  기계: {
    key: '기계', baseName: '기계 장치 탑', hardName: '자동화 공장',
    description: '포탑, 자폭',
    normalMonsters: [
      { name: '스파이더 마인', trait: 'self_destruct' },
      { name: '경비 거미 로봇', trait: 'compound_atk' },
      { name: '강화 거미 로봇', trait: 'element_counter' },
    ],
    boss: { name: '거대 메카닉 거미', trait: 'laser_charge' },
    hardBoss: { name: '자동화 공장 코어', hpMod: 4.0, trait: 'spawn_drones' },
    encounterMin: 2, encounterMax: 3,
  },
  용암: {
    key: '용암', baseName: '용암 동굴', hardName: '종말의 화산',
    description: '화상, 반사',
    normalMonsters: [
      { name: '화염 슬라임', element: '불', trait: 'burn_reflect' },
      { name: '라바 하운드', element: '불', trait: 'lava_pool' },
      { name: '파이어 엘리멘탈', element: '불', trait: 'magic_attacker' },
    ],
    boss: { name: '화염의 군주 이프리트', element: '불', trait: 'burn_aura' },
    hardBoss: { name: '종말의 화신', element: '불', hpMod: 0.45, atkMod: 0.7, trait: 'reflect_all_atk' },
    encounterMin: 1, encounterMax: 2,
  },
  암흑: {
    key: '암흑', baseName: '암흑 신전', hardName: '공허의 심연',
    description: '시야, 침묵',
    normalMonsters: [
      { name: '그림자 고양이', trait: 'first_attack_dodge' },
      { name: '그림자 슬라임', trait: 'silence_chance' },
      { name: '암흑 정령', trait: 'gold_curse' },
    ],
    boss: { name: '어둠의 마왕', trait: 'screen_darken' },
    hardBoss: { name: '공허의 군주', hpMod: 0.7, trait: 'silence_all' },
    encounterMin: 1, encounterMax: 2,
  },
  천공: {
    key: '천공', baseName: '천공의 성', hardName: '폭풍의 제단',
    description: '비행, 환경',
    normalMonsters: [
      { name: '하늘 새', trait: 'aerial' },
      { name: '천공 페가수스', trait: 'item_block' },
      { name: '폭풍 천사', element: '번개', trait: 'shock_chance' },
    ],
    boss: { name: '천공의 용', trait: 'aerial_invincible' },
    hardBoss: { name: '폭풍룡', hpMod: 0.85, trait: 'lightning_rain' },
    encounterMin: 1, encounterMax: 2,
  },
  맹독: {
    key: '맹독', baseName: '맹독의 늪', hardName: '치명적 역병',
    description: '중독, 회복 감소',
    normalMonsters: [
      { name: '독 개구리', trait: 'poison_stack' },
      { name: '역병 슬라임', trait: 'heal_pollution' },
      { name: '맹독 거미', trait: 'petrify' },
    ],
    boss: { name: '독룡 히드라', trait: 'poison_aura' },
    hardBoss: { name: '치명적 역병 그 자체', hpMod: 0.7, trait: 'heal_reverse' },
    encounterMin: 2, encounterMax: 3,
  },
}

export const ALL_THEME_KEYS = Object.keys(CHAPTER_THEMES) as ChapterTheme[]

// 7.2 챕터별 몬스터 스탯 베이스라인 (v9)
//   def = % 단위 방어율 (0~100)
//   acc/eva = %p 단위 명중/회피
//   ticks = 게이지 임계값 (작을수록 빠름) — 모두 틱당 +1 게이지 누적

export interface BaselineStats {
  hp: number
  atk: number
  def: number      // v9: % 방어율
  speed: number    // (deprecated)
  ticks: number    // v9: 게이지 임계값
  acc: number      // v9: 명중 (%p)
  eva: number      // v9: 회피 (%p)
}

// v9 일반 몬스터
// v10: HP ×2 (플레이어 HP ×2 와 보조 맞춤). 보스/미믹 베이스라인이 이 값에서 파생되므로
//   여기만 늘리면 자동 전파.
export function getNormalMonsterBaseline(chapter: number): BaselineStats {
  return {
    hp: 100 + 12 * chapter,
    atk: 8 + 1.2 * chapter,
    def: 3 + 1.0 * chapter,       // 챕터 1 = 4%, 챕터 10 = 13%
    speed: 8,
    ticks: 10,
    acc: 30 + 3 * chapter,        // 챕터 1 = 33, 챕터 10 = 60
    eva: 5 + 1 * chapter,         // 챕터 1 = 6, 챕터 10 = 15
  }
}

// v9 보스 — 도전감 위해 hp/atk 강화
// v10: 챕터 1~4 보스는 초반 진입 장벽 완화 위해 hp/atk 일부 감산.
//   ch5+ 부터는 풀 강도(=1.0). 챕터 6~10 하드 보스는 영향 없음.
const EARLY_BOSS_SOFTNESS: Record<number, { hp: number; atk: number }> = {
  1: { hp: 0.70, atk: 0.80 },
  2: { hp: 0.78, atk: 0.85 },
  3: { hp: 0.86, atk: 0.90 },
  4: { hp: 0.93, atk: 0.95 },
}
export function getBossBaseline(chapter: number): BaselineStats {
  const n = getNormalMonsterBaseline(chapter)
  const soft = EARLY_BOSS_SOFTNESS[chapter] ?? { hp: 1.0, atk: 1.0 }
  return {
    hp: n.hp * 16.0 * soft.hp,
    atk: n.atk * 1.7 * soft.atk,
    def: n.def * 1.55,
    speed: 10,
    ticks: 8,                     // 보스는 빠름
    acc: n.acc + 10,              // 보스 명중 +10
    eva: n.eva + 5,               // 보스 회피 +5
  }
}

export function getMimicBaseline(chapter: number): BaselineStats {
  const b = getBossBaseline(chapter)
  return {
    hp: b.hp * 0.7,
    atk: b.atk * 0.85,
    def: b.def * 0.9,
    speed: 8,
    ticks: 12,                    // 미믹은 느림
    acc: b.acc - 5,
    eva: b.eva - 3,
  }
}
