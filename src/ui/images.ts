import type { ChapterTheme, StatKey, StatusKind } from '@/types'
import type { SpecialEventKey } from '@/core/events'

// =========================================================
// 챕터 테마별 배경 (모바일 / WIDE 분기)
// 파일명 대소문자 혼재(WIDE / wide) 때문에 매핑 테이블 사용
// =========================================================
const WIDE_SUFFIX: Record<ChapterTheme, string> = {
  고블린: 'WIDE',
  골렘: 'WIDE',
  언데드: 'WIDE',
  환영: 'WIDE',
  흡혈귀: 'wide',
  심해: 'wide',
  기계: 'wide',
  용암: 'wide',
  암흑: 'wide',
  천공: 'wide',
  맹독: 'wide',
}

const WIDE_BREAKPOINT = 768

/** 현재 뷰포트가 wide(데스크탑/태블릿)인지 */
export function isWideViewport(): boolean {
  if (typeof window === 'undefined') return false
  return window.innerWidth >= WIDE_BREAKPOINT
}

/** 챕터 테마 배경 URL — wide=true면 WIDE 버전(웹), false면 모바일 */
export function themeBgUrl(theme: ChapterTheme, wide?: boolean): string {
  const w = wide ?? isWideViewport()
  if (w) {
    return `/images/BACKGROUND/${theme}${WIDE_SUFFIX[theme]}.png`
  }
  return `/images/BACKGROUND/${theme}.png`
}

/** 기본 메뉴/타이틀 배경 */
export function defaultBgUrl(): string {
  return '/images/BACKGROUND/배경.png'
}

// =========================================================
// 클리어 등급 아이콘
// =========================================================
const RANK_KEYS = ['F', 'E', 'D', 'C', 'B', 'A', 'S', 'SS', 'SSS', 'EX'] as const
export type RankKey = typeof RANK_KEYS[number]

export function rankIconUrl(rank: string): string | null {
  if ((RANK_KEYS as readonly string[]).includes(rank)) {
    return `/images/UI/${rank}등급.png`
  }
  return null
}

// =========================================================
// 스탯 아이콘
// =========================================================
const STAT_FILE: Record<StatKey, string | null> = {
  공격력: '물공',   // 통합 — 기존 물공 아이콘 재사용
  방어력: '물방',
  체력: '체력',
  마력: '마력',
  속도: '속도',
  행운: '행운',
  명중률: '명중',
  회피율: '회피',
  관통: '물관',
  상태저항: '저항',
}

export function statIconUrl(stat: StatKey): string | null {
  const f = STAT_FILE[stat]
  return f ? `/images/UI/${f}.png` : null
}

// =========================================================
// 상태이상 아이콘
// =========================================================
const STATUS_FILE: Record<StatusKind, string | null> = {
  점화: '점화',
  출혈: '출혈',
  독: '중독',  // 파일명은 "중독"
  둔화: '둔화',
  감전: '감전',
  암흑: null,  // 이미지 없음 → 이모지 폴백
}

export function statusIconUrl(kind: StatusKind): string | null {
  const f = STATUS_FILE[kind]
  return f ? `/images/UI/${f}.png` : null
}

// =========================================================
// 특별 이벤트 NPC 아이콘
// =========================================================
const NPC_FILE: Record<SpecialEventKey, string> = {
  crisis_adventurer: '모험가',
  wandering_smith: '대장장이',
  cursed_gambler: '도박사',
  exchange_altar: '제단',
  black_market: '암시장',
  greedy_collector: '수집가',
}

export function npcIconUrl(key: SpecialEventKey): string {
  return `/images/NPC/${NPC_FILE[key]}.png`
}

export function shopIconUrl(): string {
  return '/images/NPC/상점.png'
}

// 게임 메인 일러스트 (최초 실행 화면)
export function mainImageUrl(): string {
  return '/images/main.png'
}

// 플레이어 캐릭터 이미지 — 사용자 선택 (없으면 fallback)
// USER 폴더의 21개 카드 (F 11 + M 10)
const USER_AVATAR_KEYS: string[] = [
  'F_r0_c0', 'F_r0_c2', 'F_r0_c3',
  'F_r1_c0', 'F_r1_c1', 'F_r1_c2', 'F_r1_c3',
  'F_r2_c0', 'F_r2_c1', 'F_r2_c2', 'F_r2_c3',
  'M_r0_c0', 'M_r0_c1', 'M_r0_c3',
  'M_r1_c0', 'M_r1_c1', 'M_r1_c2', 'M_r1_c3',
  'M_r2_c1', 'M_r2_c2', 'M_r2_c3',
]

export function userAvatarUrl(key: string): string {
  return `/images/USER/${key}.png`
}

export function allUserAvatarKeys(): string[] {
  return [...USER_AVATAR_KEYS]
}

export function isValidAvatarKey(key: string): boolean {
  return USER_AVATAR_KEYS.includes(key)
}

// 랜덤 N개 추첨 (중복 X)
export function pickRandomUserAvatars(n: number): string[] {
  const arr = [...USER_AVATAR_KEYS]
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr.slice(0, n)
}

// 플레이어 이미지 — 사용자가 선택한 캐릭터 (LS에서 로드)
export function playerImageUrl(avatarKey?: string | null): string {
  if (avatarKey) return userAvatarUrl(avatarKey)
  return '/images/user.png'  // fallback
}

// =========================================================
// 스킬 아이콘 (19종)
// =========================================================
const SKILL_FILE_OVERRIDE: Record<string, string> = {
  스매쉬: '스매시',
  불굴의의지: '불굴의의지',
}

export function skillIconUrl(skillKey: string): string {
  const name = SKILL_FILE_OVERRIDE[skillKey] ?? skillKey
  return `/images/SKILL/${name}.png`
}

// =========================================================
// 무기 / 갑옷 이미지
// =========================================================
const WEAPON_FILE: Record<string, string> = {
  단검: '단검',
  건틀릿: '건틀릿',
  검: '검',
  창: '창',
  대검: '대검-도끼',
  도끼: '양손도끼',
  철퇴: '철퇴-해머',
  해머: '철퇴-해머',
  양날도끼: '양날도끼',
  사슬낫: '사슬낫',
  숏보우: '숏보우',
  롱보우: '롱보우-석궁',
  석궁: '롱보우-석궁',
}

const ARMOR_FILE: Record<string, string> = {
  판금: '판갑',
  중갑: '판갑',
  가죽갑: '가죽갑',
  로브: '로브',
}

export function itemImageUrl(kind: 'weapon' | 'armor', baseKey: string): string | null {
  if (kind === 'weapon') {
    // 마법 무기: 완드_불, 스태프_번개 등 — prefix만 사용
    for (const prefix of ['완드_', '스태프_', '마도서_']) {
      if (baseKey.startsWith(prefix)) {
        return `/images/ITEM/${prefix.slice(0, -1)}.png`
      }
    }
    const f = WEAPON_FILE[baseKey]
    return f ? `/images/ITEM/${f}.png` : null
  }
  const f = ARMOR_FILE[baseKey]
  return f ? `/images/ITEM/${f}.png` : null
}

// =========================================================
// 몬스터 이미지 (이름 → 파일 매핑)
// =========================================================
const MONSTER_FILE_MAP: Record<string, string> = {
  // 고블린
  '고블린 전사': '고블린전사',
  '고블린 궁수': '고블린궁수',
  '고블린 주술사': '고블린주술사',
  '고블린 족장': '고블린왕',
  '고블린 해방군 사령관': '고블린왕',
  // 골렘
  '바위 골렘': '바위골렘',
  '철갑 골렘': '돌골렘',
  '룬 골렘': '대지골렘',
  '고대 거신 골렘': '고대골렘',
  '고대 마도 골렘 군주': '고대골렘',
  // 언데드
  '부패한 좀비': '좀비',
  '무덤 스켈레톤': '해골병사',
  '구울': '유령',
  '리치왕': '리치',
  '저주받은 리치 황제': '리치',
  // 환영
  '신기루 나비': '환영새',
  '미라주 팬텀': '환영짐승',
  '도플갱어': '환영슬라임',
  '환영의 지배자': '환영드래곤',
  '신기루 군주': '환영드래곤',
  // 흡혈귀
  '흡혈 박쥐': '흡혈박쥐',
  '혈랑': '흡혈하수인',
  '뱀파이어 네오파이트': '흡혈기사',
  '백작 블러드 로드': '흡혈귀공작',
  '진조 블러드 로드': '흡혈귀공작',
  // 심해
  '심해 아귀': '아귀물고기',
  '맹독 해파리': '심해어',
  '갑각 크랩': '촉수괴물',
  '크라켄': '크라켄',
  '심해의 압박자': '크라켄',
  // 기계
  '스파이더 마인': '스파이더로봇',
  '자동 경비 포탑': '증기로봇',
  '마도 마네킹': '태엽로봇',
  '거대 메카닉 타이탄': '거대기계거미',
  '자동화 공장 코어': '거대기계거미',
  // 용암
  '화염 슬라임': '용암슬라임',
  '라바 하운드': '용암게',
  '파이어 엘리멘탈': '용암정령',
  '화염의 군주 이프리트': '파이어드래곤',
  '종말의 화신': '파이어드래곤',
  // 암흑
  '그림자 스토커': '그림자짐승',
  '샤도우 가고일': '어둠슬라임',
  '다크 컬티스트': '암흑정령',
  '실루엣 크로우': '암흑의마왕',
  '공허의 군주': '암흑의마왕',
  // 천공
  '하피 스카우트': '하늘새',
  '그리폰': '천사',
  '썬더 버드': '날개달린뱀',
  '천공의 심판자 키메라': '천공의용',
  '폭풍의 제단': '천공의용',
  // 맹독
  '독화살 개구리': '독개구리',
  '역병 쥐': '독슬라임',
  '바실리스크': '독거미',
  '독룡 히드라': '하이드라',
  '치명적 역병 그 자체': '하이드라',
  // 특수
  '악당 모험가': '악당',
  '격노한 수집가': '강도',
}

export function monsterImageUrl(name: string): string {
  // "미믹 (X 모방)" 같은 동적 이름도 매칭
  if (name.startsWith('미믹')) return '/images/MONSTER/미믹.png'
  // 정확 매칭
  if (MONSTER_FILE_MAP[name]) return `/images/MONSTER/${MONSTER_FILE_MAP[name]}.png`
  // 부분 매칭 (fallback): 키 중 일부가 이름에 포함되면 해당 이미지
  for (const [key, file] of Object.entries(MONSTER_FILE_MAP)) {
    if (name.includes(key)) return `/images/MONSTER/${file}.png`
  }
  return '/images/MONSTER/몬스터.png'
}

// =========================================================
// 던전 층 콘텐츠 이미지 (진입 카드용)
// =========================================================
import type { ChapterTheme as _CT, FloorEventType } from '@/types'
import { CHAPTER_THEMES } from '@/data/chapters'

export function floorContentImage(floorType: FloorEventType, _theme: _CT, _isHard: boolean): string | null {
  switch (floorType) {
    // 몬스터/보스: 배경만 보여주고 콘텐츠 이미지 없음
    case 'monster':
    case 'boss':
      return null
    case 'shop':
      return shopIconUrl()
    case 'treasure':
      return '/images/ITEM/보물상자.png'
    case 'healing_spring':
      return null
    case 'special_event':
      return null
    default:
      return null
  }
}
