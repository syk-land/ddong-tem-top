// ============================================================
// i18n — 자체 reactive 헬퍼
//
// 설계 원칙 (안전 보장):
//   - 한국어 모드: 사전을 거치지 않고 fallback(코드의 한글) 그대로 반환.
//     → 영어 사전이 비어있거나 깨져도 한국어 표시는 영향 0.
//   - 영어 모드: en 사전에서 key lookup, 없으면 fallback(한글) 반환.
//     → 영어 사전이 partial이면 그 부분만 영어, 나머지는 한국어.
//
// 사용:
//   <template>{{ t('settings.title', '설정') }}</template>
//   <template>{{ td('stat', '힘') }}</template>  // 데이터 키(스탯/무기 등) 표시
// ============================================================

import { ref, computed } from 'vue'
import { en } from '@/i18n/en'

const STORAGE_KEY = 'climetop:lang:v1'
export type Lang = 'ko' | 'en'

function loadLang(): Lang {
  try {
    const v = localStorage.getItem(STORAGE_KEY)
    if (v === 'en' || v === 'ko') return v
  } catch { /* localStorage 차단 환경 */ }
  // 기본값 영어 — GameMonetize 검수 요구사항 (모든 in-game 텍스트 기본 언어 영어)
  return 'en'
}

const _lang = ref<Lang>(loadLang())

export const currentLang = computed(() => _lang.value)
export function getLang(): Lang { return _lang.value }

export function setLang(v: Lang) {
  if (_lang.value === v) return
  _lang.value = v
  try { localStorage.setItem(STORAGE_KEY, v) } catch { /* ignore */ }
}

// 일반 UI 문자열 lookup. fallback 은 코드에 박힌 한글 그대로.
export function t(key: string, fallback: string, params?: Record<string, string | number>): string {
  let s: string
  if (_lang.value === 'ko') {
    s = fallback
  } else {
    const found = (en as Record<string, string | undefined>)[key]
    s = (found !== undefined && found !== null && found !== '') ? found : fallback
  }
  if (params) {
    for (const k of Object.keys(params)) {
      s = s.replace(new RegExp(`\\{${k}\\}`, 'g'), String(params[k]))
    }
  }
  return s
}

// 데이터 raw key (스탯명 '힘', 무기 baseKey '검' 등) 표시 헬퍼.
//   - 한국어: rawKey 그대로 반환
//   - 영어: en 사전에서 `${prefix}.${rawKey}` lookup, 없으면 rawKey 그대로 반환
//
// 예: td('stat', '힘')      → 한국어: '힘',  영어: 'STR'
//     td('weapon', '검')    → 한국어: '검',  영어: 'Sword'
//     td('grade', '레전드') → 한국어: '레전드', 영어: 'Legendary'
export function td(prefix: string, rawKey: string | null | undefined): string {
  if (!rawKey) return ''
  if (_lang.value === 'ko') return rawKey
  const found = (en as Record<string, string | undefined>)[`${prefix}.${rawKey}`]
  return (found !== undefined && found !== null && found !== '') ? found : rawKey
}

// 동적으로 합성된 한국어 라벨 (breakdown 'from', valueParts 'label/note', trait effect key 등)
// 단어 치환으로 부분 영문화. 영문 모드에서만 작동, 한국어 모드는 원본 그대로.
//
// 예: "힘 12 × 무기공격 0.9 × 등급 1.5 × (1+공격% 0%) × 3.0"
//     → "STR 12 × Weapon ATK 0.9 × Grade 1.5 × (1+ATK% 0%) × 3.0"
const LABEL_TRANSLATIONS_EN: Array<[string, string]> = [
  // 긴 단어 우선 (substring 매칭 충돌 회피)
  ['상태저항', 'Status Res'],
  ['공격력_pct', 'ATK %'],
  ['방어력_pct', 'DEF %'],
  ['속도_pct', 'SPD %'],
  ['전스탯_pct', 'All-stat %'],
  ['vs_undead_pct', 'vs Undead %'],
  ['damage_reflect_pct', 'Damage reflect %'],
  ['burn_chance', 'Burn chance'],
  ['slow_chance', 'Slow chance'],
  ['shock_chance', 'Shock chance'],
  ['bleed_chance', 'Bleed chance'],
  ['blind_chance', 'Blind chance'],
  ['poison_chance', 'Poison chance'],
  ['resist_burn', 'Burn resist'],
  ['resist_slow', 'Slow resist'],
  ['resist_shock', 'Shock resist'],
  ['resist_bleed', 'Bleed resist'],
  ['resist_blind', 'Blind resist'],
  ['resist_poison', 'Poison resist'],
  ['self_dot_pct', 'Self DoT %'],
  ['fixed_self_dot', 'Fixed self DoT'],
  ['lifesteal', 'Lifesteal'],
  // 합성 라벨
  ['미 착용', 'None'],
  ['미착용', 'None'],
  ['무기 없음', 'No weapon'],
  ['마법 무기 아님', 'Not a magic weapon'],
  ['기본 공격력', 'Base ATK'],
  ['기본 방어력', 'Base DEF'],
  ['등급계수', 'Grade coef'],
  ['곱셈 모델', 'Multiplicative model'],
  ['게이지 가속', 'Gauge Accel'],
  ['게이지', 'Gauge'],
  ['크리 확률', 'Crit chance'],
  ['크리 배수', 'Crit mult'],
  ['크리%', 'Crit%'],
  ['크리×', 'Crit×'],
  ['크리', 'Crit'],
  ['공격력', 'ATK'],
  ['공격주기', 'Atk cycle'],
  ['공속배율', 'Atk speed mult'],
  ['공격%', 'ATK%'],
  ['공격', 'Atk'],
  ['방어력', 'DEF'],
  ['방어', 'DEF'],
  ['명중률', 'ACC'],
  ['명중', 'ACC'],
  ['회피율', 'EVA'],
  ['회피', 'EVA'],
  ['속도', 'SPD'],
  ['관통', 'PEN'],
  ['마법공격력', 'Magic ATK'],
  ['마법공격', 'Magic ATK'],
  ['마력보너스', 'INT bonus'],
  ['마법계수', 'Magic coef'],
  ['마법 무기', 'Magic weapon'],
  ['마법', 'Magic'],
  ['무기공격', 'Weapon ATK'],
  ['무기', 'Weapon'],
  ['갑옷', 'Armor'],
  ['갑옷방어', 'Armor DEF'],
  ['로브 시너지', 'Robe synergy'],
  ['로브', 'Robe'],
  ['판금', 'Plate'],
  ['중갑', 'Heavy'],
  ['가죽갑', 'Leather'],
  ['트레이트', 'Trait'],
  ['특성', 'Trait'],
  ['등급', 'Grade'],
  ['상태이상', 'Status'],
  ['상태', 'Status'],
  ['저항', 'Resist'],
  ['스킬', 'Skill'],
  ['행운', 'LUK'],
  ['체력', 'VIT'],
  ['마력', 'INT'],
  ['민첩', 'DEX'],
  ['힘', 'STR'],
  ['베이스', 'Base'],
  ['보너스', 'Bonus'],
  ['아닌', 'is not'],
  ['아님', 'no'],
  ['없음', 'none'],
  ['없는', 'no'],
  ['있음', 'yes'],
  ['있는', 'with'],
  ['있을', 'when'],
  // monsterTraits 로그 (긴 것 먼저)
  ['신기루 새: 플레이어 시야 흐림 (암흑)', 'Mirage Bird: blurs player vision (Blind)'],
  ['심해 물고기: 플레이어 둔화', 'Abyss Fish: slows player'],
  ['데미지 무효', 'damage void'],
  ['첫 피격 무효', 'first hit void'],
  ['첫 공격 회피', 'first attack dodge'],
  ['비행 회피', 'flight dodge'],
  ['플레이어 출혈', 'bleeds player'],
  ['플레이어 둔화', 'slows player'],
  ['플레이어 감전', 'shocks player'],
  ['플레이어 복사', 'copies player'],
  ['독 누적', 'poison stack'],
  ['출혈 사냥', 'bleed hunt'],
  ['복합 공격', 'combo attack'],
  ['마법 공격', 'magic attack'],
  ['회복 봉인 오라', 'heal suppression aura'],
  ['회복 봉인', 'heal suppression'],
  ['회복 오염', 'heal pollution'],
  ['회복 감소', 'heal reduction'],
  ['회복 역전', 'heal reversal'],
  ['플레이어', 'Player'],
  ['데미지', 'dmg'],
  ['흡혈', 'lifesteal'],
  ['부활', 'revive'],
  ['복사', 'copy'],
  ['석화', 'petrify'],
  ['오라', 'aura'],
  ['오염', 'pollution'],
  ['사냥', 'hunt'],
  ['누적', 'stack'],
  ['소진', 'depleted'],
  ['첫 피격', 'first hit'],
  ['첫 공격', 'first attack'],
  ['비행', 'flight'],
  ['시야', 'vision'],
  ['흐림', 'blurred'],
  ['발동', 'proc'],
  // 자주 출현하는 phrase (긴 것 먼저)
  ['💸 불매 운동 챌린지: 상점 이용 불가', '💸 Boycott challenge: shop unavailable'],
  ['절대 정수 챌린지: 회복샘 이용 불가', 'Absolute Essence: healing spring unavailable'],
  ['리롤 금지령 챌린지: 새로고침 불가', 'Reroll Ban: refresh unavailable'],
  ['파괴주의자 챌린지로 인해 장비를 판매할 수 없습니다.', "Destructionist challenge prevents selling gear."],
  ['💀 불신주의자: 모험가를 구한 죄로 사망...', "💀 Distrustful: died for rescuing the adventurer..."],
  ['🤝 동료 모험가다! 다음 상점 새로고침 슬롯 +1', '🤝 Ally adventurer! Next shop refresh +1 slot'],
  ['모험가는 적이었다! 전투 개시!', 'The adventurer was an enemy! Combat begins!'],
  ['대장장이가 강화할 장비가 없다며 떠났다.', 'The blacksmith left, finding nothing to enhance.'],
  ['베팅이 0이라 대장장이가 떠났다.', 'The blacksmith left with no bet.'],
  ['수집가가 빈손인 당신을 보고 그냥 떠났다.', 'The collector left, seeing you empty-handed.'],
  ['수집가가 격노한다!', 'The collector rages!'],
  ['진짜 보스에 도전하시겠습니까?', 'Challenge the round boss?'],
  ['골드가 부족합니다.', 'Not enough gold.'],
  ['챌린지 제약으로 장착 불가', 'Cannot equip due to challenge restriction'],
  ['💸 골드 부족', '💸 Out of gold'],
  ['💸 거래 실패', '💸 Trade failed'],
  ['💸 구매 불가', '💸 Cannot buy'],
  ['💔 강화 실패', '💔 Enhancement failed'],
  ['🔨 대장장이', '🔨 Blacksmith'],
  ['악당 PVP', 'Villain PvP'],
  ['💀 사망', '💀 Defeat'],
  // 회복 메시지
  ['회복샘에서 HP', 'Healing spring HP'],
  ['회복했다', 'restored'],
  ['소실', 'lost'],
  ['양도 완료', 'Transfer complete'],
  // 진짜 보스
  // 특별 이벤트 / 모달
  ['위기에 빠진 모험가', 'Adventurer in Distress'],
  ['떠돌이 대장장이', 'Wandering Smith'],
  ['저주받은 도박사의 룰렛', "Cursed Gambler's Roulette"],
  ['고대 신의 등가교환 제단', 'Altar of Equivalent Exchange'],
  ['암시장 스탯 브로커', 'Black Market Stat Broker'],
  ['탐욕의 수집가', 'Greedy Collector'],
  ['황금고블린 상점', 'Golden Goblin Shop'],
  ['황금고블린', 'Golden Goblin'],
  ['진짜 보스에 도전하시겠습니까?', 'Challenge the round boss?'],
  ['대성공', 'Great Success'],
  ['대실패', 'Catastrophe'],
  ['무효', 'Void'],
  ['실패', 'Failure'],
  ['성공', 'Success'],
  ['거절', 'Decline'],
  ['수락', 'Accept'],
  ['포기', 'Refuse'],
  ['구매', 'Buy'],
  ['판매', 'Sell'],
  ['시청', 'Watch'],
  ['승리', 'Victory'],
  ['패배', 'Defeat'],
  ['취소', 'Cancel'],
  ['전투 개시', 'Combat begins'],
  ['전투 종료', 'Combat ended'],
  ['진행 중', 'Ongoing'],
  ['양도 완료', 'Transfer complete'],
  ['동료 발견', 'Ally found'],
  ['거래 실패', 'Trade failed'],
  ['강화 실패', 'Enhancement failed'],
  ['활성화 실패', 'Activation failed'],
  ['부활 실패', 'Revive failed'],
  ['종료', 'Exit'],
  ['닫기', 'Close'],
  ['뒤로', 'Back'],
  ['확인', 'OK'],
  ['예', 'Yes'],
  ['아니오', 'No'],
  ['아니요', 'No'],
  ['장착 실패', 'Equip failed'],
  ['해제 실패', 'Unequip failed'],
  ['판매 불가', 'Cannot sell'],
  ['구매 불가', 'Cannot buy'],
  ['장착 불가', 'Cannot equip'],
  ['이용 불가', 'Unavailable'],
  ['불가', 'Not allowed'],
  ['리롤 금지령', 'Reroll Ban'],
  ['불매 운동', 'Boycott'],
  ['절대 정수', 'Absolute Essence'],
  ['파괴주의자', 'Destructionist',],
  ['절대 정수 챌린지', 'Absolute Essence challenge'],
  ['불매 운동 챌린지', 'Boycott challenge'],
  ['리롤 금지령 챌린지', 'Reroll Ban challenge'],
  ['파괴주의자 챌린지', 'Destructionist challenge'],
  ['불신주의자', 'Distrustful'],
  ['회복샘', 'Healing Spring'],
  ['보물상자', 'Treasure Chest'],
  ['보물', 'Treasure'],
  ['상점', 'Shop'],
  ['대장장이', 'Blacksmith'],
  ['암시장', 'Black Market'],
  ['브로커', 'Broker'],
  ['룰렛', 'Roulette'],
  ['제단', 'Altar'],
  ['수집가', 'Collector'],
  ['모험가', 'Adventurer'],
  ['도박꾼', 'Gambler'],
  ['도박사', 'Gambler'],
  ['보스', 'Boss'],
  ['몬스터', 'Monster'],
  ['미믹', 'Mimic'],
  ['챌린지 위반', 'Challenge violation'],
  ['챌린지 제약', 'Challenge restriction'],
  ['챌린지', 'Challenge'],
  ['이용 불가', 'Unavailable'],
  ['새로고침', 'Refresh'],
  ['진행', 'Progress'],
  ['진입', 'Enter'],
  ['이어하기', 'Continue'],
  ['새 캐릭터', 'New Character'],
  ['플레이어', 'Player'],
  ['캐릭터', 'Character'],
  ['아이템', 'Item'],
  ['장비', 'Gear'],
  ['인벤토리', 'Inventory'],
  ['스탯', 'Stat'],
  ['능력치', 'Stats'],
  ['보스전', 'Boss fight'],
  ['보상', 'Reward'],
  ['페널티', 'Penalty'],
  ['조건', 'Condition'],
  ['소실', 'lost'],
  ['소멸', 'destroyed'],
  ['감소', 'decreased'],
  ['증가', 'increased'],
  ['추가', 'added'],
  ['고정', 'fixed'],
  ['해제', 'unequipped'],
  ['장착', 'equipped'],
  ['획득', 'gained'],
  ['회복', 'restored'],
  ['공격', 'attack'],
  ['방어', 'defense'],
  ['공격 시', 'on attack'],
  ['피격', 'on hit'],
  ['크리티컬', 'CRIT'],
  ['관통', 'PEN'],
  ['빗나갔다', 'missed'],
  ['시작', 'start'],
  ['끝', 'end'],
  ['턴', 'turn'],
  ['층', 'floor'],
  ['챕터', 'chapter'],
  ['라운드', 'round'],
  ['승급', 'promoted'],
  ['하급', 'Low'],
  ['보통', 'Common'],
  ['희귀', 'Rare'],
  ['특별', 'Unique'],
  ['노말', 'Normal'],
  ['레어', 'Rare'],
  ['스페셜', 'Special'],
  ['레전드', 'Legendary'],
  ['최소치', 'Min'],
  ['최대치', 'Max'],
  ['이상', '+'],
  ['이하', '-'],
  ['미만', '<'],
  ['초과', '>'],
  ['둔화', 'Slow'],
  ['점화', 'Burn'],
  ['출혈', 'Bleed'],
  ['감전', 'Shock'],
  ['암흑', 'Blind'],
  ['독', 'Poison'],
  ['첫', 'first'],
  ['복합', 'combo'],
  ['베팅', 'bet'],
  ['활', 'Bow'],
  ['원거리', 'ranged'],
  ['만', 'only'],
  ['가능', 'allowed'],
  ['시', 'on'],
  // 접속사/조사 류 — 너무 일반화하면 깨지므로 보수적으로
  [' 또는 ', ' or '],
  [' 그리고 ', ' and '],
]

// label 안의 한글 패턴을 영어로 부분 치환. 영어 모드 전용.
export function tLabel(label: string | null | undefined): string {
  if (!label) return ''
  if (_lang.value === 'ko') return label
  let s = label
  for (const [ko, en] of LABEL_TRANSLATIONS_EN) {
    if (s.includes(ko)) s = s.split(ko).join(en)
  }
  return s
}

// composable (script setup 친화)
export function useI18n() {
  return { t, td, tLabel, lang: _lang, currentLang, setLang, getLang }
}
