// ============================================================
// 인게임 튜토리얼 — 단계별 문구
// ============================================================
// 각 단계는 처음 만날 때 1회만 노출. meta.tutorialSeen[step] 으로 추적.
// 문구는 "조작법 한 줄 + 서사 힌트 (작은 회색)" 구조.
// 서사 힌트는 시간의 신 / 진짜 보스를 직접 언급하지 않음 — 분위기만.
// ============================================================

import type { TutorialStep } from '@/types'

export interface TutorialPage {
  title: string         // 상단 제목 (조작 주제)
  body: string          // 본문 — 조작법 설명
  hint?: string         // 서사 힌트 (작은 회색 텍스트). 없으면 미표시.
  cta?: string          // 닫기 버튼 문구. 기본 "알겠어요".
  // 가리킬 UI 요소의 CSS selector (`[data-tutorial-target="xxx"]` 권장).
  // 없으면 화면 중앙에 정적 카드. 있으면 그 요소 근처로 동적 배치 +
  // 방향 화살표 + 시안 ring 스포트라이트 + 위·아래 부유 애니메이션.
  target?: string
  // 자동 스크롤 위치 — 'center' (기본): 타겟이 viewport 중앙.
  //                'end':            타겟의 하단이 viewport 의 하단에 닿음
  //                                  (예: 누적 보너스 분배 패널 — 페이지 최 하단으로)
  scrollMode?: 'center' | 'end'
  // true 면 타겟이 버튼이어도 자동 클릭 위임을 끈다 — 강조만 하고 카드 CTA "알겠어요"
  // 로만 진행. 사용자가 무심코 누르면 자원이 소모되는 버튼에 사용 (예: 상점 새로고침).
  noAutoAction?: boolean
}

export interface TutorialStepDef {
  // 단계 식별자
  step: TutorialStep
  // 한 단계가 여러 페이지 일 수 있음. 클릭으로 넘김.
  pages: TutorialPage[]
}

export const TUTORIAL_STEPS: Record<TutorialStep, TutorialStepDef> = {
  // ── [1] 인트로 만화 종료 후 메인 메뉴 — 새 캐릭터 시작 버튼 안내 ─────
  menu_start: {
    step: 'menu_start',
    pages: [
      {
        title: '여정의 시작',
        body:
          '"새 캐릭터 시작" 을 눌러 첫 등반을 시작해보세요.\n주사위를 굴려 5스탯을 분배하고 챌린지를 골라 출발합니다.',
        hint: '탑이 너를 부르고 있다.',
        target: '[data-tutorial-target="new-character-btn"]',
      },
    ],
  },

  // ── [2] 첫 캐릭터 생성 진입 — 페이지별로 다른 영역 타겟 ──────
  //   p1: 주사위 굴림 버튼 → CTA 위임 = 한 번 굴리고 페이지 2 로
  //   p2: 챌린지 패널 (화면 아래) → 자동 스크롤로 들어감 + "알겠어요"
  creation_intro: {
    step: 'creation_intro',
    pages: [
      {
        title: '주사위 굴리기',
        body:
          '5스탯에 60포인트를 분배해요.\n버튼을 눌러 주사위를 굴려보세요.\n총 3번까지 다시 굴릴 수 있어요.',
        hint: '당신에게 힘이 부여되고 있다…',
        target: '[data-tutorial-target="dice-roll-btn"]',
      },
      {
        title: '챌린지 선택',
        body:
          '3장의 챌린지 카드 중 1개를 선택해요.\n어려운 조건일수록 클리어 보상이 큽니다.\n선택 안 해도 시작할 수 있어요.',
        target: '[data-tutorial-target="challenge-area"]',
      },
    ],
  },

  // ── [3] 첫 던전 진입 ──────────────────────────────────────
  //   target = "진입" 버튼. CTA 라벨 자동으로 "진입" + 누르면 닫기 + 진입 실행.
  first_node: {
    step: 'first_node',
    pages: [
      {
        title: '탑 등반',
        body:
          '진입 버튼을 눌러 노드로 들어갑니다.\n일반 몬스터·상점·보물·회복샘 등 다양한 노드가 있어요.\n10층마다 보스가 있습니다.',
        hint: '이 풍경… 어쩐지 익숙하다.',
        target: '[data-tutorial-target="enter-floor-btn"]',
      },
    ],
  },

  // ── [3] 첫 전투 ───────────────────────────────────────────
  first_combat: {
    step: 'first_combat',
    pages: [
      {
        title: '전투 — 자동',
        body:
          '전투는 게이지가 차면 자동으로 진행됩니다.\nHP(빨강) / MP(파랑) 가 0이면 위험.\n무기·갑옷에 묶인 스킬이 확률로 자동 발동해요.',
        hint: '약하다. 왜 이렇게 약할까…',
        target: '[data-tutorial-target="combat-bars"]',
      },
    ],
  },

  // ── [5] 첫 보물 — 인벤 버튼 안내 ──────────────────────────
  //   트리거: 보물 노드에서 receiveItem 호출 시 pendingTreasureTutorial 만 set,
  //   다음 Dungeon onMounted 에서 발화 → 인벤 버튼이 DOM 에 있는 상태에서 타겟 발사.
  //   강제로 무기+방어구 각 1개씩 드랍되어 인벤토리에 들어가 있음.
  first_treasure: {
    step: 'first_treasure',
    pages: [
      {
        title: '아이템 획득',
        body:
          '보물 상자에서 무기와 갑옷이 나왔어요.\n인벤 버튼을 눌러 인벤토리를 열어보세요.',
        target: '[data-tutorial-target="inventory-btn"]',
      },
    ],
  },

  // ── [6] 인벤 모달 첫 진입 — 장비 카드 + 장착 ──────────────
  first_inventory: {
    step: 'first_inventory',
    pages: [
      {
        title: '장비 카드 보는 법',
        body:
          '카드 테두리 색이 등급을 나타내요 (노말→레어→스페셜→레전드).\n공격·방어 점수로 현재 장비와 비교할 수 있어요.\n점수가 높을수록 강한 장비입니다.',
        target: '[data-tutorial-target="inventory-item-card"]',
      },
      {
        title: '장착하기',
        body:
          '장착 버튼을 누르면 현재 장비와 자동 교체됩니다.\n빠진 장비는 인벤토리로 옮겨져요.\n원치 않으면 카드 옆 폐기 버튼으로 버릴 수도 있어요.',
        target: '[data-tutorial-target="inventory-equip-btn"]',
      },
    ],
  },

  // ── [7] 인벤 모달 닫힌 후 — "상태" 버튼 안내 (CTA 위임 → 상태 모달 열기) ──
  prompt_status: {
    step: 'prompt_status',
    pages: [
      {
        title: '상태창 확인하기',
        body:
          '장비를 바꿨으니 능력치도 한번 봐봐요.\n상단의 "상태" 버튼을 눌러보세요.',
        target: '[data-tutorial-target="status-btn"]',
      },
    ],
  },

  // ── [7] 첫 상점 — 매물 / 판매 / 새로고침 (다중 페이지) ─────
  //   첫 진입 시 게임 스토어가 100골드를 1회 지급 — 구매 학습 가능.
  first_shop: {
    step: 'first_shop',
    pages: [
      {
        title: '상점 매물 보는 법',
        body:
          '카드 테두리 색이 등급을 나타내요.\n공/방 옆 숫자가 장비 점수 — 클수록 강한 장비.\n가격 아래 버튼으로 즉시 구매할 수 있어요.\n(첫 상점 학습용으로 100G를 드렸어요)',
        target: '[data-tutorial-target="shop-slot"]',
      },
      {
        title: '판매하기',
        body:
          '장착 중인 장비도, 인벤토리 장비도 골드로 팔 수 있어요.\n전부 판매 버튼은 인벤토리를 한 번에 비웁니다.',
        target: '[data-tutorial-target="shop-sell"]',
      },
      {
        title: '새로고침',
        body:
          '매물이 맘에 안 들면 새로고침으로 다시 뽑을 수 있어요.\n챕터마다 충전이 갱신됩니다.\n(지금은 누르지 말고 안내만 확인해주세요.)',
        target: '[data-tutorial-target="shop-refresh"]',
        noAutoAction: true,
      },
    ],
  },

  // ── [8] 상태창 모달 첫 진입 — 스탯/능력치 확인 ────────────
  first_status: {
    step: 'first_status',
    pages: [
      {
        title: '상태창 — 기본 능력치',
        body:
          '5스탯(힘/민첩/체력/마력/행운) 이 모두 표시돼요.\n장비 + 트레이트 + 챌린지 + 메타 보너스를 합산한 최종 값입니다.\n각 항목을 누르면 어떤 요소가 얼마씩 기여했는지 분해도 볼 수 있어요.',
        target: '[data-tutorial-target="status-stats"]',
      },
      {
        title: '상세 능력치',
        body:
          '"상세 능력치" 탭도 눌러보세요.\n공격력·방어·명중·회피·크리·관통 등 전투에 직접 쓰이는 값을 모두 볼 수 있어요.\n\n— 시너지 —\n• 마법공격력은 마력 스탯이 핵심이에요.\n• 마법 무기는 로브와 묶이면 마법공격력 시너지가 큽니다.\n• 활은 민첩 스탯과 묶이면 명중·크리가 더 잘 살아나요.',
        target: '[data-tutorial-target="status-detail-tab"]',
      },
    ],
  },

  // ── [6] 챕터 1 4층 일반 몬스터 — 2배속 잠금 해제 + 안내 ──────────
  second_combat: {
    step: 'second_combat',
    pages: [
      {
        title: '2배속 해금!',
        body:
          '이제 좌측 상단 패널에서 2배속을 쓸 수 있어요.\n전투가 답답하면 2배속을 활성화해보세요.',
        hint: '시간이 조금 가까워진 느낌이다.',
        cta: '좋아요',
        target: '[data-tutorial-target="speed-control"]',
      },
    ],
  },

  // ── [7] 챕터 2 1층 일반 몬스터 — 4배속·자동진입 광고 해금 안내 ──────
  first_chapter_clear: {
    step: 'first_chapter_clear',
    pages: [
      {
        title: '챕터 2 진입',
        body:
          '챕터가 바뀌면 HP/MP가 모두 회복돼요.\n4배속과 자동 진입은 광고를 보면 등반당 1회 해금돼요.\n좌측 상단 패널에서 시도해보세요.',
        hint: '탑은 더 높아진다. 누군가 너를 지켜보는 것 같다.',
        target: '[data-tutorial-target="speed-control"]',
      },
    ],
  },

  // ── [7] 첫 사망/클리어 후 캐릭터 생성 ─────────────────────
  meta_creation: {
    step: 'meta_creation',
    pages: [
      {
        title: '누적 보너스',
        body:
          '지난 등반의 결과로 누적 보너스가 생겼어요.\n캐릭터 생성에서 원하는 스탯에 자유롭게 분배할 수 있습니다.\n분배해도 보너스 풀은 차감되지 않아요 — 매번 같은 풀로 새로 분배.',
        hint: '받은 힘이 너의 안에 쌓이고 있다.',
        target: '[data-tutorial-target="bonus-alloc"]',
        scrollMode: 'end',
      },
    ],
  },

  // ── [8] 첫 진짜 보스 클리어 후 ────────────────────────────
  realboss_clear: {
    step: 'realboss_clear',
    pages: [
      {
        title: '영구 시작 보너스',
        body:
          '진짜 보스에서 깎은 비율만큼 영구 시작 스탯이 추가됐어요.\n다음 캐릭터 생성에 자동으로 분배됩니다.\n완전히 처치하면 더 큰 보너스를 받을 수 있어요.',
        hint: '깊은 곳에서 누군가가 너를 도와주고 있다.',
        target: '[data-tutorial-target="realboss-bonus"]',
      },
    ],
  },
}

// 단계 키 목록 (헬퍼)
export const TUTORIAL_KEYS: TutorialStep[] = [
  'menu_start',
  'creation_intro',
  'first_node',
  'first_combat',
  'first_treasure',
  'first_inventory',
  'prompt_status',
  'first_shop',
  'first_status',
  'second_combat',
  'first_chapter_clear',
  'meta_creation',
  'realboss_clear',
]
