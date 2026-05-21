import type { StatKey } from '@/types'

export type ChallengeCategory = 'instant' | 'risk'

export interface ChallengeDef {
  key: string
  category: ChallengeCategory
  name: string
  group: string                  // 분류 그룹
  description: string
  reward: string                 // 보상 설명
  penalty: string                // 페널티/조건 설명
  // 즉시 보상형: 시작 스탯 보너스
  instantBonus?: Partial<Record<StatKey, number>>
  instantStartGold?: number
  // 시스템 플래그 (런타임 체크용)
  flags?: ChallengeFlags
  // 리스크 베팅형: 클리어 시 메타 보상
  metaBonus?: number             // 추가 보너스 스탯 (자유 분배)
  permanentStat?: Partial<Record<StatKey, number>>  // 영구 시작 스탯 가산
}

export interface ChallengeFlags {
  forceLowTraitsOnly?: boolean       // 하급 특성만
  forceCommonNormalOnly?: boolean    // 보통-노말만
  forceLowNormalOnly?: boolean       // 하급-노말 (티어 1)만
  noArmor?: boolean
  lockStartingGear?: boolean
  forbidPlateHeavy?: boolean
  forbidLargeWeapon?: boolean
  forbidMagicWeapon?: boolean
  forceRangedWeapon?: boolean        // 활(ranged) 무기만
  onlySpeedCoef1?: boolean
  maxAtk?: number                    // v9 곱셈 스케일에 맞춰 의미 변경 (예: 200)
  speedFixed?: number                // (deprecated) v9 의미 없음
  weaponTicksMin?: number            // v9: 무기 ticks 최소값 (14+ = 한방형만)
  mpCapFixed?: number
  goldZero?: boolean
  goldMax500Death?: boolean
  noShop?: boolean
  noShopRefresh?: boolean
  noBuyback?: boolean
  noShopDiscount?: boolean
  noHealingSpring?: boolean
  noRescueAdventurer?: boolean
  noIronWill?: boolean
  noActiveSkills?: boolean
  onlyActiveSkills?: boolean
  combatTimeLimit?: number
  blindExtra?: number
  bleedBadLuckPct?: number
  healEffMult?: number
  // v9 신규: 빌드 강제 flag
  forceMagicLobeBuild?: boolean      // 마법무기 + 로브 강제 (그 외 장착 시 실패)
  forceHeavyArmor?: boolean          // 판금 강제 (그 외 갑옷 실패)
  // v9 신규: track stat 조건
  trackAgilityBelow?: number         // 민첩 N 이하 유지
  trackAgilityAtLeast?: number       // 민첩 N 이상
  trackLuckAtLeast?: number          // 행운 N 이상
  trackStrengthAtLeast?: number      // 힘 N 이상
  // 기존 track
  trackNoLegendaryEver?: boolean
  trackOnlyTier1?: boolean
  trackNoShopBuy?: boolean
  trackNoTraitEquip?: boolean
  trackNoArmorEver?: boolean
  trackLuckOnly?: boolean
  trackPacifist?: boolean
  trackAltarEveryChapter?: boolean
  trackSkillOnly?: boolean
  trackGoldZeroAtFinalBoss?: boolean
  trackUseRefreshEveryChapter?: boolean
  trackTotalSpendUnder300?: boolean
  trackKillAllMimics?: boolean
  trackBlackMarketCount?: number
  trackDodgeAllMirage?: boolean
  trackRouletteGreat3?: boolean
  trackSmith80PctBet?: boolean
  trackBetrayalPerfect?: boolean
  trackBoss100Tick?: boolean
  trackLowHp500Tick?: boolean
  trackCursedNeverRemove?: boolean
  trackNoRefreshEver?: boolean   // 상점 새로고침 1회라도 사용 시 실패
  trackSpeedBelow6?: boolean     // (deprecated) v9에서 trackAgilityBelow 6 으로 동작
  trackAvgTier3OrLower?: boolean
}

// v6 5스탯 기반 챌린지 (힘/민첩/체력/마력/행운).
// 시작 stats 보너스는 위 5스탯 중 하나로만 표현. 파생 효과(공격력/방어력/회피 등)는 stat 가산으로 자동 반영.
export const CHALLENGES: ChallengeDef[] = [
  // ===== 즉시 보상형 =====
  {
    key: '과유불급', category: 'instant', group: '공격력 제약', name: '과유불급',
    description: '튼튼함을 얻는 대가로 화력을 봉인한다.',
    reward: '시작 체력 +10',
    penalty: '최종 공격력이 200 초과 시 즉사 (똥템 무기 강제)',
    instantBonus: { 체력: 10 },
    flags: { maxAtk: 200 },
  },
  {
    key: '녹슨칼날의맹세', category: 'instant', group: '공격력 제약', name: '녹슨 칼날의 맹세',
    description: '하급 무기만이 진정한 똥템.',
    reward: '시작 민첩 +5, 행운 +3',
    penalty: '하급 특성 무기만 장착 가능 (위반 시 소멸)',
    instantBonus: { 민첩: 5, 행운: 3 },
    flags: { forceLowTraitsOnly: true },
  },
  {
    key: '유리대포', category: 'instant', group: '공격력 제약', name: '유리 대포 계약',
    description: '갑옷 따위 거추장스럽다.',
    reward: '시작 힘 +16',
    penalty: '갑옷 장착 불가',
    instantBonus: { 힘: 16 },
    flags: { noArmor: true },
  },
  {
    key: '체중감량', category: 'instant', group: '공격력 제약', name: '체중 감량',
    description: '가볍게, 더 가볍게.',
    reward: '시작 민첩 +12',
    penalty: '속도계수 0.8 이하 무기 장착 불가 (대형 무기 금지)',
    instantBonus: { 민첩: 12 },
    flags: { forbidLargeWeapon: true },
  },
  {
    key: '마법혐오증', category: 'instant', group: '공격력 제약', name: '마법 혐오증',
    description: '마법은 사기다.',
    reward: '시작 체력 +6',
    penalty: '마법 무기 장착 불가',
    instantBonus: { 체력: 6 },
    flags: { forbidMagicWeapon: true },
  },
  {
    key: '명사수', category: 'instant', group: '공격력 제약', name: '명사수',
    description: '활만이 진정한 무기.',
    reward: '시작 민첩 +8',
    penalty: '활(원거리) 무기만 장착 가능',
    instantBonus: { 민첩: 8 },
    flags: { forceRangedWeapon: true },
  },
  {
    key: '진정한무소유', category: 'instant', group: '재화 제약', name: '진정한 무소유',
    description: '돈은 악의 근원.',
    reward: '시작 체력 +6, 행운 +4',
    penalty: '소지 골드 0 고정 (획득 즉시 소멸, 상점 이용 불가)',
    instantBonus: { 체력: 6, 행운: 4 },
    flags: { goldZero: true, noShop: true },
  },
  {
    key: '단벌신사', category: 'instant', group: '재화 제약', name: '단벌 신사',
    description: '시작 장비가 곧 운명.',
    reward: '시작 골드 +300',
    penalty: '시작 장비 해제/변경 불가',
    instantStartGold: 300,
    flags: { lockStartingGear: true },
  },
  {
    key: '미니멀리스트', category: 'instant', group: '재화 제약', name: '미니멀리스트',
    description: '가볍게 살아간다.',
    reward: '시작 민첩 +6',
    penalty: '인벤토리 슬롯 1칸 (장착 외 보유 불가)',
    instantBonus: { 민첩: 6 },
  },
  {
    key: '파괴주의자', category: 'instant', group: '재화 제약', name: '파괴주의자',
    description: '판매보단 분해.',
    reward: '시작 힘 +8',
    penalty: '장비 되사기 불가',
    instantBonus: { 힘: 8 },
    flags: { noBuyback: true },
  },
  {
    key: '황금알레르기', category: 'instant', group: '재화 제약', name: '황금 알레르기',
    description: '돈만 만지면 두드러기.',
    reward: '전 스탯 +3',
    penalty: '누적 획득 골드 2000 초과 시 사망',
    instantBonus: { 힘: 3, 민첩: 3, 체력: 3, 마력: 3, 행운: 3 },
    flags: { goldMax500Death: true },
  },
  {
    key: '불매운동', category: 'instant', group: '상점 제약', name: '불매 운동',
    description: '황금고블린 추방.',
    reward: '시작 행운 +8',
    penalty: '상점 진입 불가',
    instantBonus: { 행운: 8 },
    flags: { noShop: true },
  },
  {
    key: '요행은없다', category: 'instant', group: '상점 제약', name: '요행은 없다',
    description: '치유는 사치.',
    reward: '시작 힘 +6',
    penalty: '회복샘 이용 불가',
    instantBonus: { 힘: 6 },
    flags: { noHealingSpring: true },
  },
  {
    key: '불신주의자', category: 'instant', group: '상점 제약', name: '불신주의자',
    description: '낯선 모험가? 적이다.',
    reward: '시작 민첩 +10',
    penalty: '위기에 빠진 모험가 구출 시 즉사',
    instantBonus: { 민첩: 10 },
    flags: { noRescueAdventurer: true },
  },
  {
    key: '리롤금지령', category: 'instant', group: '상점 제약', name: '리롤 금지령',
    description: '주어진 운명을 받아들여라.',
    reward: '시작 체력 +3, 마력 +3',
    penalty: '상점 새로고침 불가',
    instantBonus: { 체력: 3, 마력: 3 },
    flags: { noShopRefresh: true },
  },
  {
    key: '정가매입', category: 'instant', group: '상점 제약', name: '정가 매입',
    description: '할인은 없다.',
    reward: '시작 체력 +6',
    penalty: '상점 할인 효과 없음',
    instantBonus: { 체력: 6 },
    flags: { noShopDiscount: true },
  },
  {
    key: '굼벵이전술', category: 'instant', group: '속도 제약', name: '굼벵이 전술',
    description: '느릿느릿하지만 강하게.',
    reward: '시작 체력 +15',
    penalty: '무기 공격주기 14틱 이상 (한방형만) 장착 가능',
    instantBonus: { 체력: 15 },
    flags: { weaponTicksMin: 14 },
  },
  {
    key: '조급증', category: 'instant', group: '속도 제약', name: '조급증',
    description: '빠르게, 그러나 단조롭게.',
    reward: '시작 민첩 +10',
    penalty: '공격 스킬 사용 불가 (평타만 가능)',
    instantBonus: { 민첩: 10 },
    flags: { noActiveSkills: true },
  },
  {
    key: '강박증', category: 'instant', group: '속도 제약', name: '강박증',
    description: '딱 1.0의 미학.',
    reward: '시작 행운 +6',
    penalty: '속도계수 1.0 무기만 장착 가능',
    instantBonus: { 행운: 6 },
    flags: { onlySpeedCoef1: true },
  },
  {
    key: '속전속결', category: 'instant', group: '속도 제약', name: '속전속결',
    description: '80틱 안에 끝장낸다.',
    reward: '시작 힘 +7',
    penalty: '매 전투 80틱 이내 미승리 시 패배',
    instantBonus: { 힘: 7 },
    flags: { combatTimeLimit: 80 },
  },
  {
    key: '유지력상실', category: 'instant', group: '속도 제약', name: '유지력 상실',
    description: '폭발적 한 방.',
    reward: '시작 힘 +10',
    penalty: '최대 마나 30 고정',
    instantBonus: { 힘: 10 },
    flags: { mpCapFixed: 30 },
  },
  {
    key: '혈우병', category: 'instant', group: '생존 제약', name: '혈우병',
    description: '피를 보면 운이 나빠진다.',
    reward: '시작 행운 +10',
    penalty: '출혈 상태일 때 룰렛 대실패 +20%',
    instantBonus: { 행운: 10 },
    flags: { bleedBadLuckPct: 20 },
  },
  {
    key: '야맹증', category: 'instant', group: '생존 제약', name: '야맹증',
    description: '어둠은 천적.',
    reward: '시작 힘 +8',
    penalty: '암흑 상태/챕터에서 명중 추가 -30',
    instantBonus: { 힘: 8 },
    flags: { blindExtra: 30 },
  },
  {
    key: '절대정수', category: 'instant', group: '생존 제약', name: '절대 정수',
    description: '독은 통하지 않지만 회복도 거부한다.',
    reward: '시작 체력 +10',
    penalty: '회복 효율 -50%',
    instantBonus: { 체력: 10 },
    flags: { healEffMult: 0.5 },
  },
  {
    key: '의지박약', category: 'instant', group: '생존 제약', name: '의지박약',
    description: '의지가 약한 자.',
    reward: '시작 마력 +8',
    penalty: '불굴의 의지 스킬 사용 불가',
    instantBonus: { 마력: 8 },
    flags: { noIronWill: true },
  },
  {
    key: '연약한피부', category: 'instant', group: '생존 제약', name: '연약한 피부',
    description: '단단한 갑옷은 답답하다.',
    reward: '시작 민첩 +4, 힘 +4',
    penalty: '판금/중갑 장착 불가',
    instantBonus: { 민첩: 4, 힘: 4 },
    flags: { forbidPlateHeavy: true },
  },

  // ===== 리스크 베팅형 =====
  {
    key: '무소유의장노말', category: 'risk', group: '장비 제한', name: '무소유의 장 — 노말',
    description: '특별/레전드 등급을 거부한다.',
    reward: '100층 클리어 시 보너스 스탯 +10점',
    penalty: '특별/레전드 장비 1회라도 착용 시 챌린지 실패',
    metaBonus: 10,
    flags: { trackNoLegendaryEver: true },
  },
  {
    key: '순수가난', category: 'risk', group: '장비 제한', name: '순수 가난 챌린지',
    description: '오직 1티어로 50층 보스까지.',
    reward: '50층 보스 격파 시 보너스 +6점',
    penalty: '1티어 외 장비 착용 시 실패',
    metaBonus: 6,
    flags: { trackOnlyTier1: true },
  },
  {
    key: '명품거부증', category: 'risk', group: '장비 제한', name: '명품 거부증',
    description: '상점 구매 거부.',
    reward: '100층 돌파 시 보너스 +8점',
    penalty: '상점에서 1개라도 구매 시 실패',
    metaBonus: 8,
    flags: { trackNoShopBuy: true },
  },
  {
    key: '특성봉인', category: 'risk', group: '장비 제한', name: '특성 봉인',
    description: '형용사 없는 순수 보통-노말만.',
    reward: '100층 돌파 시 보너스 +12점',
    penalty: '특성 붙은 장비 착용 시 실패',
    metaBonus: 12,
    flags: { trackNoTraitEquip: true },
  },
  {
    key: '알몸의순례자', category: 'risk', group: '장비 제한', name: '알몸의 순례자',
    description: '갑옷 없이 50층까지.',
    reward: '50층 돌파 시 보너스 +7점',
    penalty: '갑옷 1회라도 장착 시 실패',
    metaBonus: 7,
    flags: { trackNoArmorEver: true },
  },
  {
    key: '운칠기삼', category: 'risk', group: '전투 스타일', name: '운칠기삼',
    description: '행운만 믿는다.',
    reward: '50층 돌파 시 다음 회차 행운 시작값 +5 영구',
    penalty: '행운 외 모든 스탯 최소치 3으로 시작 강제',
    permanentStat: { 행운: 5 },
    flags: { trackLuckOnly: true },
  },
  {
    key: '평화주의자', category: 'risk', group: '전투 스타일', name: '평화주의자',
    description: '오직 평타로 100층.',
    reward: '보너스 +15점 (초고난도)',
    penalty: '공격 스킬 사용 시 실패',
    metaBonus: 15,
    flags: { trackPacifist: true, noActiveSkills: true },
  },
  {
    key: '철저한등가교환', category: 'risk', group: '전투 스타일', name: '철저한 등가교환',
    description: '제단을 만나면 무조건 3회 교환.',
    reward: '다음 회차 분배 포인트 +5',
    penalty: '제단 무시 또는 3회 미달 시 실패',
    permanentStat: {},
    metaBonus: 0,
    flags: { trackAltarEveryChapter: true },
  },
  {
    key: '스킬미학', category: 'risk', group: '전투 스타일', name: '스킬 미학',
    description: '평타 금지, 스킬만.',
    reward: '50층 돌파 시 보너스 +5점',
    penalty: '평타 사용 시 실패',
    metaBonus: 5,
    flags: { trackSkillOnly: true, onlyActiveSkills: true },
  },
  {
    key: '자산동결', category: 'risk', group: '경제', name: '자산 동결',
    description: '100층 보스 클리어 시 골드 0.',
    reward: '보너스 +10점',
    penalty: '최종 보스 시 골드 > 0 이면 실패',
    metaBonus: 10,
    flags: { trackGoldZeroAtFinalBoss: true },
  },
  {
    key: '황금고블린파트너', category: 'risk', group: '경제', name: '황금고블린의 파트너',
    description: '매 챕터 새로고침 전량 소모.',
    reward: '다음 회차 시작 골드 +200 영구',
    penalty: '새로고침 1회라도 안 쓰면 실패',
    permanentStat: {},
    flags: { trackUseRefreshEveryChapter: true },
  },
  {
    key: '짠돌이의탑', category: 'risk', group: '경제', name: '짠돌이의 탑',
    description: '누적 소비 골드 300 이하.',
    reward: '100층 돌파 시 보너스 +9점',
    penalty: '누적 소비 300 초과 시 실패',
    metaBonus: 9,
    flags: { trackTotalSpendUnder300: true },
  },
  {
    key: '미믹사냥꾼', category: 'risk', group: '경제', name: '미믹 사냥꾼',
    description: '미믹은 절대 도주 불가.',
    reward: '다음 회차 미믹 출현 확률 ↓',
    penalty: '미믹 1회라도 도주 시 실패',
    permanentStat: {},
    flags: { trackKillAllMimics: true },
  },
  {
    key: '암시장VIP', category: 'risk', group: '경제', name: '암시장 단골',
    description: '암시장 누적 10회 이상.',
    reward: '다음 회차 암시장 비용 20% 영구 할인',
    penalty: '암시장 누적 10회 미만 시 실패',
    permanentStat: {},
    flags: { trackBlackMarketCount: 10 },
  },
  {
    key: '환영파괴자', category: 'risk', group: '테마 특화', name: '환영 파괴자',
    description: '환영 챕터 무피격.',
    reward: '다음 회차 민첩 +5 영구',
    penalty: '환영 챕터에서 1회라도 피격 시 실패',
    permanentStat: { 민첩: 5 },
    flags: { trackDodgeAllMirage: true },
  },
  {
    key: '도박중독', category: 'risk', group: '테마 특화', name: '도박중독',
    description: '룰렛 대성공 3회.',
    reward: '100층 돌파 시 보너스 +8점',
    penalty: '룰렛 무조건 베팅, 대성공 3회 미달 시 실패',
    metaBonus: 8,
    flags: { trackRouletteGreat3: true },
  },
  {
    key: '대장장이은인', category: 'risk', group: '테마 특화', name: '대장장이의 은인',
    description: '전 재산 80% 베팅 + 성공.',
    reward: '다음 회차 대장장이 기본 성공률 +15%',
    penalty: '베팅 80% 미만 또는 실패 시 실패',
    permanentStat: {},
    flags: { trackSmith80PctBet: true },
  },
  {
    key: '배신저항군', category: 'risk', group: '테마 특화', name: '배신 저항군',
    description: '대전에서 피격 3회 이하 승리.',
    reward: '다음 회차 체력 +5 영구',
    penalty: '대전에서 피격 3회 초과 시 실패',
    permanentStat: { 체력: 5 },
    flags: { trackBetrayalPerfect: true },
  },
  {
    key: '속전속결의장', category: 'risk', group: '테마 특화', name: '속전속결의 장',
    description: '매 보스 100틱 이내.',
    reward: '100층 돌파 시 보너스 +11점',
    penalty: '보스 1회라도 100틱 초과 시 실패',
    metaBonus: 11,
    flags: { trackBoss100Tick: true },
  },
  {
    key: '빈사의유령', category: 'risk', group: '가혹', name: '빈사 상태의 유령',
    description: '체력 30% 이하 누적 500틱.',
    reward: '100층 돌파 시 보너스 +14점',
    penalty: '체력 30% 이하 500틱 미달성 시 실패',
    metaBonus: 14,
    flags: { trackLowHp500Tick: true },
  },
  {
    key: '저주의동반자', category: 'risk', group: '가혹', name: '저주의 동반자',
    description: '저주의 무기 1~100층 절대 해제 불가.',
    reward: '100층 돌파 시 보너스 +13점',
    penalty: '저주의 무기 해제 시 실패',
    metaBonus: 13,
    flags: { trackCursedNeverRemove: true },
  },
  {
    key: '고집불통', category: 'risk', group: '가혹', name: '고집불통',
    description: '상점 새로고침 절대 사용 불가.',
    reward: '100층 돌파 시 보너스 +10점',
    penalty: '상점 새로고침 1회라도 사용 시 실패',
    metaBonus: 10,
    flags: { trackNoRefreshEver: true },
  },
  {
    key: '만성피로', category: 'risk', group: '가혹', name: '만성 피로',
    description: '민첩 10 이하 유지 + 50층.',
    reward: '50층 돌파 시 보너스 +7점',
    penalty: '민첩 11 이상 시 실패',
    metaBonus: 7,
    flags: { trackAgilityBelow: 10 },
  },
  {
    key: '가난이체질', category: 'risk', group: '가혹', name: '가난이 체질',
    description: '평균 티어 3 이하 + 100층.',
    reward: 'EX 등급 보상 + 영구 스탯 선택권',
    penalty: '평균 티어 3 초과 시 실패',
    metaBonus: 10,
    flags: { trackAvgTier3OrLower: true },
  },

  // ===== v9 신규 (곱셈 모델·게이지·크리·로브시너지 활용) =====
  {
    key: '크리광인', category: 'instant', group: '신규', name: '크리 광인',
    description: '오직 크리만이 진리.',
    reward: '시작 민첩 +10, 행운 +6',
    penalty: '민첩 25 미만 시 즉사 (장비/소모 후 매 틱 체크)',
    instantBonus: { 민첩: 10, 행운: 6 },
    flags: { trackAgilityAtLeast: 25 },
  },
  {
    key: '로브의길', category: 'instant', group: '신규', name: '로브의 길',
    description: '마법무기 + 로브만이 진정한 마법사.',
    reward: '시작 마력 +14',
    penalty: '마법무기 + 로브 조합만 장착 가능 (그 외 즉시 실패)',
    instantBonus: { 마력: 14 },
    flags: { forceMagicLobeBuild: true },
  },
  {
    key: '강철요새', category: 'instant', group: '신규', name: '강철 요새',
    description: '판금 외엔 안 입는다.',
    reward: '시작 체력 +12, 힘 +4',
    penalty: '판금 외 갑옷 장착 시 실패',
    instantBonus: { 체력: 12, 힘: 4 },
    flags: { forceHeavyArmor: true },
  },
  {
    key: '둔감', category: 'risk', group: '신규', name: '둔감',
    description: '민첩 5 이하로 50층.',
    reward: '50층 돌파 시 보너스 +9점',
    penalty: '민첩 6 이상 시 실패',
    metaBonus: 9,
    flags: { trackAgilityBelow: 5 },
  },
  {
    key: '독재자의일격', category: 'risk', group: '신규', name: '독재자의 일격',
    description: '힘 25 이상 유지 + 100층.',
    reward: '보너스 +10점',
    penalty: '힘 24 이하 시 실패',
    metaBonus: 10,
    flags: { trackStrengthAtLeast: 25 },
  },
  {
    key: '운명의주사위', category: 'risk', group: '신규', name: '운명의 주사위',
    description: '행운 25 이상 유지 (크리 데미지 +25%).',
    reward: '100층 돌파 시 보너스 +8점',
    penalty: '행운 24 이하 시 실패',
    metaBonus: 8,
    flags: { trackLuckAtLeast: 25 },
  },
]

export const CHALLENGES_MAP: Record<string, ChallengeDef> = Object.fromEntries(
  CHALLENGES.map((c) => [c.key, c])
)

export const INSTANT_CHALLENGES = CHALLENGES.filter((c) => c.category === 'instant')
export const RISK_CHALLENGES = CHALLENGES.filter((c) => c.category === 'risk')

export function pickThreeRandomChallenges(): ChallengeDef[] {
  const shuffleArr = <T>(arr: readonly T[]): T[] => {
    const c = [...arr]
    for (let i = c.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[c[i], c[j]] = [c[j], c[i]]
    }
    return c
  }
  const inst = shuffleArr(INSTANT_CHALLENGES).slice(0, 2)
  const risk = shuffleArr(RISK_CHALLENGES).slice(0, 1)
  return shuffleArr([...inst, ...risk])
}
