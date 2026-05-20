// ============================================================
// 몬스터 SFX 카테고리 분류
// ============================================================
// monster.template 의 이름/element/trait 패턴을 기반으로
// sfx.monsterHit/Death 가 사용할 카테고리를 결정한다.
//
// 카테고리:
//   - soft    : 슬라임/해파리/식물/곤충 등 (끈적한 plop)
//   - bone    : 언데드/스켈톤/좀비/구울 등 (마른 rattle)
//   - metal   : 기계/골렘/갑옷/크리스탈 등 (금속 ring)
//   - beast   : 야수/조류/곤충대형/파충류 등 (yelp/growl)
//   - fire    : 화염/용암/불 속성 (sizzle hiss)
//   - magical : 영혼/그림자/환영/마법체 (ethereal blur)

import type { MonsterTemplate, MonsterInstance } from '@/types'
import { sfx, type MonsterSfxCategory } from '@/ui/sound'

// 이름/trait 패턴 — 우선순위 높은 순
const NAME_PATTERNS: Array<[RegExp, MonsterSfxCategory]> = [
  // fire 우선 (element는 별도 처리, 이름에 '불/화염' 포함 시)
  [/화염|마그마|용암|라바|이프리트|불씨|연소|파이어/, 'fire'],

  // metal
  [/메카닉|타이탄|포탑|드론|마인|갑옷|골렘|기계|마법봇|마네킹|크리스탈|결정|광물|강철|미스릴|아이언/, 'metal'],

  // bone — 언데드 계열
  [/스켈|좀비|구울|와이트|리치|시체|뼈|언데드|미라|좀비|영혼술|네크로|크로우|레이스|망령/, 'bone'],

  // magical — 환영/그림자/영혼
  [/그림자|환영|영혼|키메라|뱀파이어|드라큘라|어둠|미라주|환각|결계|마도|마법/, 'magical'],

  // soft — 점액 / 무른 생물
  [/슬라임|해파리|크랩|히드라|개구리|아메바|점액|독화살|역병|쥐|진드기|구더기|벌레|곰팡이|식충|식물|꽃/, 'soft'],

  // beast — 야수/조류
  [/하피|버드|박쥐|늑대|호랑이|곰|뱀|드래곤|용|그리폰|독수리|울프|혼|짐승|야수|날개|페가수스/, 'beast'],

  // 일반 인간형
  [/고블린|오크|코볼트|컬티스트|도적|스토커|마법사/, 'beast'],
]

// trait 패턴 (fallback)
const TRAIT_PATTERNS: Array<[RegExp, MonsterSfxCategory]> = [
  [/^(poison|heal_pollut|venom|petrif|bleed)/, 'soft'],
  [/^(undead|revive|soul|necro|deathly)/, 'bone'],
  [/^(laser|mech|drone|compound_atk|element_counter|self_destruct)/, 'metal'],
  [/^(aerial|gravity|flight|wing|lightning_rain)/, 'beast'],
  [/^(shadow|silence|illusion|mirage|phantasm|screen_darken)/, 'magical'],
  [/^(burn|fire|lava|reflect_all)/, 'fire'],
  [/^(bind|oxygen|crit_immune)/, 'soft'],  // 심해
]

export function inferSfxCategory(template: MonsterTemplate): MonsterSfxCategory {
  // 1. element 우선 — '불'은 fire
  if (template.element === '불') return 'fire'

  // 2. 이름 패턴 매칭
  for (const [pattern, cat] of NAME_PATTERNS) {
    if (pattern.test(template.name)) return cat
  }

  // 3. trait 패턴 매칭
  if (template.trait) {
    for (const [pattern, cat] of TRAIT_PATTERNS) {
      if (pattern.test(template.trait)) return cat
    }
  }

  // 4. element fallback
  if (template.element === '물') return 'soft'    // 빙결도 soft (얼음 깨지는 느낌)
  if (template.element === '바람') return 'magical'
  if (template.element === '번개') return 'metal'
  if (template.element === '대지') return 'metal'
  if (template.element === '암흑') return 'magical'
  if (template.element === '빛') return 'magical'

  // 5. default
  return 'beast'
}

// 다단히트 스킬(화염구 스플래시/번개창 연쇄/폭풍칼날 3히트)에서 같은 카테고리
// 음이 동시에 겹쳐 마스킹되는 걸 방지. 같은 카테고리가 60ms 이내에 다시
// 요청되면 첫 음을 살리고 나머지는 스킵.
let lastHitTs = 0
let lastHitCat: MonsterSfxCategory | null = null

export function playMonsterHit(monster: MonsterInstance) {
  const cat = inferSfxCategory(monster.template)
  if (typeof performance !== 'undefined') {
    const now = performance.now()
    if (cat === lastHitCat && now - lastHitTs < 60) return
    lastHitTs = now
    lastHitCat = cat
  }
  sfx.monsterHit(cat)
}

export function playMonsterDeath(monster: MonsterInstance) {
  // 사망은 몬스터당 1회만 발생하므로 throttle 불필요
  sfx.monsterDeath(inferSfxCategory(monster.template))
}
