import type { ChapterTheme, StatKey, StatusKind } from '@/types'
import type { SpecialEventKey } from '@/core/events'

// 자산 경로 BASE_URL prefix — vite base 가 './' 또는 '/'.
// GameMonetize(서브디렉토리 호스팅) 호환 위해 모든 정적 자산 URL 은
// 절대(/images) 가 아닌 ${A}/images 로 prefix.
const A = import.meta.env.BASE_URL.replace(/\/$/, '')

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
    return `${A}/images/BACKGROUND/${theme}${WIDE_SUFFIX[theme]}.webp`
  }
  return `${A}/images/BACKGROUND/${theme}.webp`
}

/** 기본 메뉴/타이틀 배경 */
export function defaultBgUrl(): string {
  return `${A}/images/BACKGROUND/배경.webp`
}

// =========================================================
// 클리어 등급 아이콘
// =========================================================
const RANK_KEYS = ['F', 'E', 'D', 'C', 'B', 'A', 'S', 'SS', 'SSS', 'EX'] as const
export type RankKey = typeof RANK_KEYS[number]

export function rankIconUrl(rank: string): string | null {
  if ((RANK_KEYS as readonly string[]).includes(rank)) {
    return `${A}/images/UI/${rank}등급.webp`
  }
  return null
}

// =========================================================
// 스탯 아이콘
// =========================================================
// v6 5스탯 아이콘 매핑 (기존 자산 재활용)
const STAT_FILE: Record<StatKey, string | null> = {
  힘: '물공',
  민첩: '속도',
  체력: '체력',
  마력: '마력',
  행운: '행운',
}

export function statIconUrl(stat: StatKey): string | null {
  const f = STAT_FILE[stat]
  return f ? `${A}/images/UI/${f}.webp` : null
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
  return f ? `${A}/images/UI/${f}.webp` : null
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
  return `${A}/images/NPC/${NPC_FILE[key]}.webp`
}

export function shopIconUrl(): string {
  return `${A}/images/NPC/상점.webp`
}

// 게임 메인 일러스트 (최초 실행 화면)
// ?v 쿼리는 워터마크 제거 후 브라우저 캐시 무효화용
export function mainImageUrl(): string {
  return `${A}/images/main.webp?v=3`
}

// 세로 화면 (안드로이드 / portrait) 전용 메인 일러스트
export function mainImagePortraitUrl(): string {
  return `${A}/images/main-portrait.webp?v=2`
}

// 진짜 보스 도전 이미지 (챕터 테마 → 보스 일러스트)
export function realBossImageUrl(theme: ChapterTheme): string {
  return `${A}/images/REALBOSS/${theme}.webp`
}

// 인트로 만화 페이지 (1, 2, 3) — v=3 캐시 무효화
export function tutorialImageUrl(page: 1 | 2 | 3): string {
  return `${A}/images/TUTORIAL/${page}.webp?v=3`
}

// 플레이어 캐릭터 이미지 — 사용자 선택
// 거지템 모에 캐릭터 10명 (전신 + 흉상 페어).
//   전신: public/images/USER/01.png ~ 10.webp       (캐릭터 생성 화면)
//   흉상: public/images/USER_BUST/01.png ~ 10.webp  (전투 화면)
const USER_AVATAR_KEYS: string[] = [
  '01', '02', '03', '04', '05', '06', '07', '08', '09', '10',
]

// 기본 추천 이름 — 사용자가 따로 변경하지 않으면 이 이름이 보임.
// 변경하면 game store 의 customNames 가 덮어쓴다.
export const DEFAULT_CHARACTER_NAMES: Record<string, string> = {
  '01': '아이리스',  // 은발 트윈테일
  '02': '히나타',    // 빨간 사이드포니
  '03': '쿠로네',    // 흑발 후드
  '04': '루미네',    // 금발 성녀
  '05': '미코',      // 갈색 궁수
  '06': '레온',      // 금발 기사
  '07': '카이',      // 흑발 수인
  '08': '사이',      // 민트 연금술사
  '09': '노아르',    // 보라 악마
  '10': '타카시',    // 흑발 사무라이
}

export function defaultCharacterName(key: string): string {
  return DEFAULT_CHARACTER_NAMES[key] ?? `캐릭터 ${key}`
}

// 라벨 (커스텀 이름 적용 안 한 fallback)
export function userAvatarLabel(key: string): string {
  return defaultCharacterName(key)
}

export function userAvatarUrl(key: string): string {
  return `${A}/images/USER/${key}.webp`
}

export function userBustUrl(key: string): string {
  return `${A}/images/USER_BUST/${key}.webp`
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

// 플레이어 이미지 — 캐릭터 생성/던전 등의 전신 컷
export function playerImageUrl(avatarKey?: string | null): string {
  if (avatarKey && isValidAvatarKey(avatarKey)) return userAvatarUrl(avatarKey)
  return `${A}/images/user.webp`  // fallback
}

// 플레이어 흉상 — 전투 화면 전용.
//   유효 키 우선, 없으면 첫 번째 캐릭터 흉상으로 폴백 (전신 user.png 폴백 금지)
export function playerBustUrl(avatarKey?: string | null): string {
  if (avatarKey && isValidAvatarKey(avatarKey)) return userBustUrl(avatarKey)
  return userBustUrl(USER_AVATAR_KEYS[0])
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
  return `${A}/images/SKILL/${name}.webp`
}

// =========================================================
// 무기 / 갑옷 이미지
// =========================================================
const WEAPON_FILE: Record<string, string> = {
  // 근접
  건틀릿: '건틀릿',
  단검: '단검',
  사슬낫: '사슬낫',
  검: '검',
  창: '창',
  철퇴: '철퇴',
  대검: '대검',
  양날도끼: '양날도끼',
  할버드: '할버드',
  // 활
  숏보우: '숏보우',
  롱보우: '롱보우',
  석궁: '석궁',
  // 마법
  완드: '완드',
  스태프: '스태프',
  마도서: '마도서',
}

const ARMOR_FILE: Record<string, string> = {
  판금: '판갑',
  중갑: '판갑',
  가죽갑: '가죽갑',
  로브: '로브',
}

export function itemImageUrl(kind: 'weapon' | 'armor', baseKey: string): string | null {
  if (kind === 'weapon') {
    const f = WEAPON_FILE[baseKey]
    return f ? `${A}/images/ITEM/${f}.webp` : null
  }
  const f = ARMOR_FILE[baseKey]
  return f ? `${A}/images/ITEM/${f}.webp` : null
}

// =========================================================
// 몬스터 이미지 (이름 → 파일 매핑)
//
// 자산 파일의 실제 시각 콘텐츠에 맞춰 몬스터 이름을 chapters.ts 에서 재정의.
// (자산은 귀여운 파스텔 톤 — 어두운 fantasy 이름과 불일치한 케이스를 시각에 맞춤)
//
// 라벨이 잘못된 파일 메모 (시각 콘텐츠 기준):
//   - 거대기계거미.webp → 보라색 큰 거미 로봇 (기계 보스에 활용)
//   - 증기로봇.webp     → 발광 안테나 물고기 (미사용)
//   - 태엽로봇.webp     → 핑크 아귀 (아귀물고기와 중복, 미사용)
//   - 용암게.webp       → 주황 강아지 (라바 하운드용)
//   - 날개달린뱀.webp   → 날개 달린 유니콘 = 페가수스 (천공)
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
  // 환영 — 자산 시각에 맞춰 이름 변경 (chapters.ts)
  '신기루 새': '환영새',
  '환영 짐승': '환영짐승',
  '환영 슬라임': '환영슬라임',
  '환영의 지배자': '환영드래곤',
  '신기루 군주': '환영드래곤',
  // 흡혈귀 — '핏빛 사도'(작은 뱀파이어), '흡혈 기사'(갑옷)
  '흡혈 박쥐': '흡혈박쥐',
  '핏빛 사도': '흡혈하수인',
  '흡혈 기사': '흡혈기사',
  '백작 블러드 로드': '흡혈귀공작',
  '진조 블러드 로드': '흡혈귀공작',
  // 심해 — 자산 시각에 맞춰 이름 변경
  '심해 아귀': '아귀물고기',
  '심해 물고기': '심해어',
  '심해 문어': '촉수괴물',
  '크라켄': '크라켄',
  '심해의 압박자': '거대기계거미',
  // 기계 — 거대기계거미.webp(큰 거미 로봇)를 보스에 활용. 일반 3종은 스파이더로봇.
  '스파이더 마인': '스파이더로봇',
  '경비 거미 로봇': '스파이더로봇',
  '강화 거미 로봇': '스파이더로봇',
  '거대 메카닉 거미': '거대기계거미',
  '자동화 공장 코어': '거대기계거미',
  // 용암
  '화염 슬라임': '용암슬라임',
  '라바 하운드': '용암게',
  '파이어 엘리멘탈': '용암정령',
  '화염의 군주 이프리트': '파이어드래곤',
  '종말의 화신': '파이어드래곤',
  // 암흑 — 자산 시각에 맞춰 이름 변경
  '그림자 고양이': '그림자짐승',
  '그림자 슬라임': '어둠슬라임',
  '암흑 정령': '암흑정령',
  '어둠의 마왕': '암흑의마왕',
  '공허의 군주': '암흑의마왕',
  // 천공 — 자산 시각에 맞춰 이름 변경 (페가수스, 천사)
  '하늘 새': '하늘새',
  '천공 페가수스': '날개달린뱀',
  '폭풍 천사': '천사',
  '천공의 용': '천공의용',
  '폭풍룡': '천공의용',
  // 맹독 — 자산 시각에 맞춰 이름 변경
  '독 개구리': '독개구리',
  '역병 슬라임': '독슬라임',
  '맹독 거미': '독거미',
  '독룡 히드라': '하이드라',
  '치명적 역병 그 자체': '하이드라',
  // 특수
  '악당 모험가': '악당',
  '격노한 수집가': '강도',
}

export function monsterImageUrl(name: string): string {
  // "미믹 (X 모방)" 같은 동적 이름도 매칭
  if (name.startsWith('미믹')) return `${A}/images/MONSTER/미믹.webp`
  // 정확 매칭
  if (MONSTER_FILE_MAP[name]) return `${A}/images/MONSTER/${MONSTER_FILE_MAP[name]}.webp`
  // 부분 매칭 (fallback): 키 중 일부가 이름에 포함되면 해당 이미지
  for (const [key, file] of Object.entries(MONSTER_FILE_MAP)) {
    if (name.includes(key)) return `${A}/images/MONSTER/${file}.webp`
  }
  return `${A}/images/MONSTER/몬스터.webp`
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
      // 적절한 보물상자 일러스트가 없음 — null 반환해 배경+라벨만 표시
      return null
    case 'healing_spring':
      return null
    case 'special_event':
      return null
    default:
      return null
  }
}
