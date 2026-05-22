// ====== 몬스터 trait 효과 레지스트리 ======
//
// 문서: tower-rpg-design.md / DOCS.md 의 챕터 테마 특수능력 시스템.
// chapters.ts 의 MonsterTemplate.trait 키에 대응하는 효과 정의를 한곳에 모음.
// combat.ts 가 정해진 훅 지점에서 dispatch* 헬퍼를 호출하여 효과를 적용한다.
//
// 효과 등록 규칙:
//   1. 키가 chapters.ts 에 정의되어 있다면 여기에도 entry 가 있어야 한다.
//      (개발 모드에서는 누락 시 console.warn — validateMonsterTraitKeys 참조)
//   2. 효과 함수는 pure 하지 않다 (CombatContext mutation OK).
//   3. 발동 확률은 함수 내부에서 결정 (각 trait 별 고유 확률).

import type { CombatContext } from './combat'
import { pushLog, makeMonster } from './combat'
import type { MonsterInstance, StatusKind, Character } from '@/types'
import { applyStatus } from './status'
import { CHAPTER_THEMES } from '@/data/chapters'

// trait 훅에서 사용하는 표준 페이로드
export interface TraitHookPayload {
  ctx: CombatContext
  monster: MonsterInstance
}

export interface AttackedPayload extends TraitHookPayload {
  damage: number       // 적이 입은 데미지 (반사 계산 기반)
  isMagic: boolean     // 마법 공격 여부 (스킬 kind 기반)
  isPhysical: boolean  // 물리 공격 여부
}

export interface PlayerHitPayload extends TraitHookPayload {
  damage: number       // 플레이어가 입은 데미지
}

export interface HpThresholdPayload extends TraitHookPayload {
  threshold: number    // 트리거된 임계값 (0.5, 0.3 등)
}

export interface MonsterTraitDef {
  key: string
  description: string
  // 모든 훅은 옵셔널. 미정의 = no-op.
  onSpawn?(p: TraitHookPayload): void
  onBeforeAttack?(p: TraitHookPayload): { skipBasicAttack?: boolean } | void
  onAfterAttacked?(p: AttackedPayload): void
  onPlayerHit?(p: PlayerHitPayload): void
  onTickStart?(p: TraitHookPayload): void
  onHpThreshold?(p: HpThresholdPayload): void
  onDeath?(p: TraitHookPayload): { revived?: boolean } | void
}

// ============================================================
// 효과 헬퍼
// ============================================================

// 일정 확률로 플레이어에게 상태이상 적용
function tryApplyStatusOnPlayer(
  ctx: CombatContext,
  kind: StatusKind,
  chance: number,
  snapshotAtk: number,
): boolean {
  if (chance <= 0) return false
  if (Math.random() >= chance) return false
  return applyStatus(ctx.player, kind, snapshotAtk, ctx.tick, 0)
}

// 플레이어 HP 직접 손실 (heal_reverse 같은 음수 회복은 별도. 여기는 trait 발 환경 데미지)
function damagePlayer(ctx: CombatContext, dmg: number, source: string): void {
  if (dmg <= 0) return
  ctx.player.hp = Math.max(0, ctx.player.hp - dmg)
  pushLog(ctx, `${source}: -${dmg} HP`, 'status')
}

// 부하 몬스터 수 — 소환형 보스의 캡 검사용
//   _spawnedBy = parent.template.name 로 식별
function aliveMinionCount(ctx: CombatContext, parent: MonsterInstance): number {
  return ctx.monsters.filter((m) => m.hp > 0 && m._spawnedBy === parent.template.name).length
}

const MINION_CAP = 2  // 부하 몬스터 최대 동시 생존 수

// ============================================================
// 레지스트리
// ============================================================

export const MONSTER_TRAITS: Record<string, MonsterTraitDef> = {
  // ──────────────────────────────────────
  // Tier A — 단순 스탯 / 상태이상 proc
  // ──────────────────────────────────────

  high_evasion: {
    key: 'high_evasion',
    description: '회피 +20 (미라주 팬텀)',
    onSpawn({ monster }) {
      monster.def = monster.def * 0.7   // 방어 약, 회피로 회피
      // 회피는 monster 에 직접 필드가 없음 — 명중 공식이 attacker.acc - defender.eva 이므로
      // 적의 회피 효과를 내려면 _evaBonus 필드를 활용. combat.rollHit 가 단순화돼 있어서
      // 여기선 데미지를 받으면 명중률 페널티 형태로 처리 (간략화)
      // (정확한 회피 cap 도입은 단계 2~3 의 보강 대상)
    },
    onAfterAttacked(p) {
      // 30% 확률로 회피 시뮬레이션 — 받은 데미지를 무효화
      if (Math.random() < 0.3) {
        const m = p.monster
        m.hp = Math.min(m.maxHp, m.hp + p.damage)
        pushLog(p.ctx, `${m.template.name}: 회피! 데미지 무효`, 'miss')
      }
    },
  },

  crit_immune: {
    key: 'crit_immune',
    description: '크리티컬 면역 (갑각 크랩) — 받은 크리티컬 보너스를 거의 무효화',
    onAfterAttacked(p) {
      // 크리티컬을 추적할 수 없으므로 데미지의 40% 를 회복 (실질적으로 크리 보너스 감쇄 효과)
      const refund = Math.round(p.damage * 0.4)
      if (refund > 0) {
        p.monster.hp = Math.min(p.monster.maxHp, p.monster.hp + refund)
      }
    },
  },

  aerial: {
    key: 'aerial',
    description: '비행 — 회피 보너스, 빠른 첫 행동 (하피 스카우트)',
    onSpawn({ monster }) {
      monster.actionGauge = 40  // 시작 게이지 +40 (빠른 첫 행동)
    },
    onAfterAttacked(p) {
      // 20% 확률 회피 (비행)
      if (Math.random() < 0.2) {
        const m = p.monster
        m.hp = Math.min(m.maxHp, m.hp + p.damage)
        pushLog(p.ctx, `${m.template.name}: 비행 회피`, 'miss')
      }
    },
  },

  priority_attack: {
    key: 'priority_attack',
    description: '선제권 — 첫 행동 게이지 +60 (심해 아귀)',
    onSpawn({ monster }) {
      monster.actionGauge = 60
    },
  },

  first_hit_immune: {
    key: 'first_hit_immune',
    description: '첫 피격 무효 (무덤 스켈레톤)',
    onAfterAttacked(p) {
      const m = p.monster
      if ((m._hitsTaken ?? 0) === 1) {
        // 막 _hitsTaken 이 1로 증가했음 → 첫 피격이므로 무효화
        m.hp = Math.min(m.maxHp, m.hp + p.damage)
        pushLog(p.ctx, `${m.template.name}: 첫 피격 무효!`, 'miss')
      }
    },
  },

  first_attack_dodge: {
    key: 'first_attack_dodge',
    description: '첫 공격 회피 — 자신을 향한 첫 공격을 1회 회피 (그림자 스토커)',
    onAfterAttacked(p) {
      const m = p.monster
      if ((m._hitsTaken ?? 0) === 1) {
        m.hp = Math.min(m.maxHp, m.hp + p.damage)
        pushLog(p.ctx, `${m.template.name}: 첫 공격 회피!`, 'miss')
      }
    },
  },

  accuracy_debuff: {
    key: 'accuracy_debuff',
    description: '명중 디버프 — 30% 확률로 플레이어에게 암흑 부여 (신기루 나비)',
    onBeforeAttack({ ctx }) {
      if (tryApplyStatusOnPlayer(ctx, '암흑', 0.3, 5)) {
        pushLog(ctx, '신기루 나비: 플레이어 시야 흐림 (암흑)', 'status')
      }
    },
  },

  speed_debuff: {
    key: 'speed_debuff',
    description: '둔화 — 30% 확률로 플레이어 둔화 (맹독 해파리)',
    onBeforeAttack({ ctx }) {
      if (tryApplyStatusOnPlayer(ctx, '둔화', 0.3, 5)) {
        pushLog(ctx, '맹독 해파리: 플레이어 둔화', 'status')
      }
    },
  },

  bleed_chance: {
    key: 'bleed_chance',
    description: '출혈 — 35% 확률로 플레이어 출혈 (혈랑)',
    onBeforeAttack({ ctx, monster }) {
      if (tryApplyStatusOnPlayer(ctx, '출혈', 0.35, monster.atk)) {
        pushLog(ctx, `${monster.template.name}: 플레이어 출혈`, 'status')
      }
    },
  },

  lifesteal: {
    key: 'lifesteal',
    description: '흡혈 — 플레이어에게 입힌 데미지의 40% HP 회복 (흡혈 박쥐)',
    onPlayerHit({ ctx, monster, damage }) {
      const heal = Math.round(damage * 0.4)
      if (heal > 0) {
        monster.hp = Math.min(monster.maxHp, monster.hp + heal)
        pushLog(ctx, `${monster.template.name}: 흡혈 +${heal} HP`, 'enemy')
      }
    },
  },

  shock_chance: {
    key: 'shock_chance',
    description: '감전 — 30% 확률 (썬더 버드)',
    onBeforeAttack({ ctx, monster }) {
      if (tryApplyStatusOnPlayer(ctx, '감전', 0.3, monster.atk)) {
        pushLog(ctx, `${monster.template.name}: 플레이어 감전`, 'status')
      }
    },
  },

  poison_stack: {
    key: 'poison_stack',
    description: '독 누적 — 50% 확률 + 보너스 1스택 (독화살 개구리)',
    onBeforeAttack({ ctx, monster }) {
      if (Math.random() < 0.5) {
        applyStatus(ctx.player, '독', monster.atk, ctx.tick, 0)
        // 추가 한 번 더 (스택 가속)
        applyStatus(ctx.player, '독', monster.atk, ctx.tick, 0)
        pushLog(ctx, `${monster.template.name}: 독 누적 +2`, 'status')
      }
    },
  },

  self_destruct: {
    key: 'self_destruct',
    description: 'HP 30% 이하 시 자폭 — 자신 사망 + 광역 데미지 (스파이더 마인)',
    onHpThreshold(p) {
      if (p.threshold !== 0.3) return
      const m = p.monster
      const dmg = Math.round(m.atk * 2.5)
      damagePlayer(p.ctx, dmg, `${m.template.name}: 자폭`)
      m.hp = 0
    },
  },

  // ──────────────────────────────────────
  // Tier B — 반사 · 조건부
  // ──────────────────────────────────────

  reflect_physical: {
    key: 'reflect_physical',
    description: '물리 반사 — 받은 물리 데미지의 30% 반사 (철갑 골렘)',
    onAfterAttacked(p) {
      if (!p.isPhysical) return
      const reflect = Math.round(p.damage * 0.3)
      if (reflect > 0) {
        damagePlayer(p.ctx, reflect, `${p.monster.template.name}: 물리 반사`)
      }
    },
  },

  burn_reflect: {
    key: 'burn_reflect',
    description: '점화 반사 — 점화 상태로 적중 시 데미지 50% 반사 (화염 슬라임)',
    onAfterAttacked(p) {
      // 플레이어가 자신이 점화 상태일 때 화염 마법으로 피격되면 반사
      // 단순화: 마법 공격 받았을 때 50% 확률로 반사
      if (!p.isMagic) return
      if (Math.random() < 0.5) {
        const reflect = Math.round(p.damage * 0.5)
        damagePlayer(p.ctx, reflect, `${p.monster.template.name}: 화염 반사`)
      }
    },
  },

  element_counter: {
    key: 'element_counter',
    description: '원소 카운터 — 마법 공격에 대해 30% 반사 (마도 마네킹)',
    onAfterAttacked(p) {
      if (!p.isMagic) return
      const reflect = Math.round(p.damage * 0.3)
      if (reflect > 0) {
        damagePlayer(p.ctx, reflect, `${p.monster.template.name}: 원소 반사`)
      }
    },
  },

  crit_vs_bleeding: {
    key: 'crit_vs_bleeding',
    description: '출혈 플레이어에게 크리티컬 — 데미지 × 1.5 (뱀파이어 네오파이트)',
    onBeforeAttack({ ctx, monster }) {
      const hasBleed = ctx.player.statuses.some((s) => s.kind === '출혈')
      if (hasBleed) {
        // 다음 공격 데미지를 임시로 +50% — monster.atk 를 잠깐 조정
        monster.atk *= 1.5
        pushLog(ctx, `${monster.template.name}: 출혈 사냥! 데미지 ↑`, 'status')
        // 공격 후 원복은 onPlayerHit 에서 (또는 _phaseTriggered 류 플래그)
        monster._chargingTicks = -1  // 사후 복원 표시
      }
    },
    onPlayerHit({ monster }) {
      if (monster._chargingTicks === -1) {
        monster.atk = monster.atk / 1.5
        monster._chargingTicks = undefined
      }
    },
  },

  compound_atk: {
    key: 'compound_atk',
    description: '복합 공격 — 50% 확률로 2회 연속 공격 (자동 경비 포탑)',
    onPlayerHit({ ctx, monster }) {
      // 첫 공격이 끝난 직후 50% 확률로 추가 1회 공격 게이지 즉시 부여
      // 단, 무한 루프 방지를 위해 이미 페이즈에 들어갔으면 스킵
      if (Math.random() < 0.5 && !monster._phaseTriggered?.compound) {
        monster._phaseTriggered ??= {}
        monster._phaseTriggered.compound = true
        monster.actionGauge = 100  // 즉시 추가 행동 가능
        pushLog(ctx, `${monster.template.name}: 복합 공격!`, 'enemy')
        // 한 틱 후 재사용 가능하도록 onTickStart 에서 플래그 해제
      }
    },
    onTickStart({ monster }) {
      if (monster._phaseTriggered?.compound) {
        // 다음 틱에 플래그 해제 — 매 행동마다 굴림
        monster._phaseTriggered.compound = false
      }
    },
  },

  // ──────────────────────────────────────
  // Tier C — 헬퍼 필요
  // ──────────────────────────────────────

  // magic_attacker: combat.ts monsterAttack 에서 직접 처리 (방어력 ×0.5)
  // 여기서는 onSpawn 으로 시각적 표식만
  magic_attacker: {
    key: 'magic_attacker',
    description: '마법 공격자 — 방어력 절반 적용 (룬 골렘, 파이어 엘리멘탈)',
    onSpawn({ ctx, monster }) {
      pushLog(ctx, `${monster.template.name} (마법 공격)`, 'info')
    },
  },

  // heal_reduction / heal_pollution: combat.ts applyHealing 에서 직접 처리
  heal_reduction: {
    key: 'heal_reduction',
    description: '회복 감소 — 플레이어 회복 ×0.5 (구울)',
    onSpawn({ ctx, monster }) {
      pushLog(ctx, `${monster.template.name}: 회복 봉인 오라`, 'info')
    },
  },

  heal_pollution: {
    key: 'heal_pollution',
    description: '회복 오염 — 플레이어 회복 ×0.3 (역병 쥐)',
    onSpawn({ ctx, monster }) {
      pushLog(ctx, `${monster.template.name}: 회복 오염`, 'info')
    },
  },

  lava_pool: {
    key: 'lava_pool',
    description: '용암 웅덩이 — 매 5틱 환경 데미지 (라바 하운드)',
    onTickStart({ ctx, monster }) {
      if (ctx.tick > 0 && ctx.tick % 5 === 0) {
        const dmg = Math.max(2, Math.round(monster.atk * 0.15))
        damagePlayer(ctx, dmg, `${monster.template.name}: 용암 웅덩이`)
      }
    },
  },

  revive_chance: {
    key: 'revive_chance',
    description: '부활 — 30% 확률, HP 30% 회복 (부패한 좀비)',
    onDeath({ ctx, monster }) {
      if (monster._revived) return { revived: false }
      if (Math.random() < 0.30) {
        monster._revived = true
        monster.hp = Math.max(1, Math.round(monster.maxHp * 0.30))
        // 첫 피격 면역 카운터 등은 리셋하지 않음 — 한 인스턴스 평생 1회만
        pushLog(ctx, `${monster.template.name}: 부활! (HP ${monster.hp}/${monster.maxHp})`, 'enemy')
        return { revived: true }
      }
      return { revived: false }
    },
  },

  copy_player: {
    key: 'copy_player',
    description: '플레이어 복사 — 스폰 시 플레이어 공/방을 모방 (도플갱어)',
    onSpawn({ ctx, monster }) {
      // 플레이어의 공격력/방어%를 기반으로 보정
      // monster.def 는 % 단위 (combat.ts: effectiveDefPct = def / 100)
      // 이전: 체력 × 3 → 체력 30+ 에서 def 90%+ 가 되어 데미지 1로 클램프되는 버그
      const p: Character = ctx.player
      monster.atk = Math.max(monster.atk, p.stats.힘 * 1.5 + p.stats.마력 + 5)
      // 체력 % 단위로 환산: 체력 × 0.6 + 기본 10 → 체력 30이면 28%, 50이면 40%, 상한 70%
      const copiedDef = Math.min(70, Math.round(p.stats.체력 * 0.6 + 10))
      monster.def = Math.max(monster.def, copiedDef)
      pushLog(ctx, `${monster.template.name}: 플레이어 복사 (방어 ${copiedDef}%)`, 'info')
    },
  },

  petrify: {
    key: 'petrify',
    description: '석화 — 15% 확률로 플레이어 둔화 +3스택 (바실리스크)',
    onBeforeAttack({ ctx, monster }) {
      if (Math.random() < 0.15) {
        applyStatus(ctx.player, '둔화', monster.atk, ctx.tick, 0)
        applyStatus(ctx.player, '둔화', monster.atk, ctx.tick, 0)
        applyStatus(ctx.player, '둔화', monster.atk, ctx.tick, 0)
        pushLog(ctx, `${monster.template.name}: 석화! 둔화 +3`, 'status')
      }
    },
  },

  // ──────────────────────────────────────
  // Tier D — game.ts 연동 (현 단계는 코어 측 스텁만)
  // ──────────────────────────────────────

  silence_chance: {
    key: 'silence_chance',
    description: '침묵 — 20% 확률로 플레이어 스킬 사용 20틱간 봉인 (샤도우 가고일)',
    onBeforeAttack({ ctx, monster }) {
      if (Math.random() < 0.2) {
        const dur = 20
        const until = ctx.tick + dur
        if ((ctx.player.silencedUntilTick ?? 0) < until) {
          ctx.player.silencedUntilTick = until
        }
        pushLog(ctx, `${monster.template.name}: 침묵! ${dur}틱 스킬 봉인`, 'status')
      }
    },
  },

  gold_curse: {
    key: 'gold_curse',
    description: '골드 저주 — 10% 확률로 골드 -5% (다크 컬티스트). game.ts 연동 필요',
    onBeforeAttack({ ctx, monster }) {
      if (Math.random() < 0.1) {
        const before = ctx.player.gold
        const loss = Math.max(1, Math.round(before * 0.05))
        ctx.player.gold = Math.max(0, before - loss)
        pushLog(ctx, `${monster.template.name}: 골드 저주 -${loss}g`, 'gold')
      }
    },
  },

  item_block: {
    key: 'item_block',
    description: '아이템 차단 — 처치 시 드랍 봉쇄 (그리폰). game.ts onMonsterKilled 연동 필요',
    onSpawn({ ctx, monster }) {
      pushLog(ctx, `${monster.template.name}: 아이템 봉쇄 (드랍 차단)`, 'info')
    },
    // 실제 드랍 차단은 game.ts 가 monster.template.trait === 'item_block' 인 적의 보상을 제외하는 식으로 구현
  },

  // ──────────────────────────────────────
  // Tier E — 보스 trait (단계 4)
  //   HP 임계값 페이즈 분기 + 광역기 + 소환
  // ──────────────────────────────────────

  summon_minions: {
    key: 'summon_minions',
    description: '미니언 소환 — HP 50% 에서 일반 몹 최대 2마리 (고블린 보스/해방군 사령관)',
    onHpThreshold({ ctx, monster, threshold }) {
      if (threshold !== 0.5) return
      const slots = Math.max(0, MINION_CAP - aliveMinionCount(ctx, monster))
      if (slots <= 0) return
      const theme = CHAPTER_THEMES['고블린']
      const templates = theme.normalMonsters.slice(0, slots)
      const chapter = Math.max(1, Math.min(10, ctx.monsters.length + 1))
      for (const t of templates) {
        const m = makeMonster(t, chapter, 'normal')
        m._spawnedBy = monster.template.name
        ctx.monsters.push(m)
      }
      pushLog(ctx, `${monster.template.name}: 미니언 ${templates.length}마리 소환!`, 'enemy')
    },
  },

  magic_immune: {
    key: 'magic_immune',
    description: '마법 면역 — 마법 공격으로 받은 데미지 95% 무효 (고대 마도 골렘 군주)',
    onAfterAttacked(p) {
      if (!p.isMagic) return
      const refund = Math.round(p.damage * 0.95)
      if (refund > 0) {
        p.monster.hp = Math.min(p.monster.maxHp, p.monster.hp + refund)
        pushLog(p.ctx, `${p.monster.template.name}: 마법 면역!`, 'miss')
      }
    },
  },

  summon_undead: {
    key: 'summon_undead',
    description: '언데드 소환 — HP 50% 에서 좀비/스켈레톤 최대 2마리 (리치왕)',
    onHpThreshold({ ctx, monster, threshold }) {
      if (threshold !== 0.5) return
      const slots = Math.max(0, MINION_CAP - aliveMinionCount(ctx, monster))
      if (slots <= 0) return
      const theme = CHAPTER_THEMES['언데드']
      const templates = theme.normalMonsters.slice(0, slots)
      const chapter = 3
      for (const t of templates) {
        const m = makeMonster(t, chapter, 'normal')
        m._spawnedBy = monster.template.name
        ctx.monsters.push(m)
      }
      pushLog(ctx, `${monster.template.name}: 언데드 ${templates.length}마리 소환!`, 'enemy')
    },
  },

  max_hp_curse: {
    key: 'max_hp_curse',
    description: '최대 HP 저주 — 매 50틱 플레이어 최대 HP -5% (저주받은 리치 황제)',
    onTickStart({ ctx, monster }) {
      if (ctx.tick > 0 && ctx.tick % 50 === 0) {
        const cut = Math.max(1, Math.round(ctx.player.maxHp * 0.05))
        ctx.player.maxHp = Math.max(1, ctx.player.maxHp - cut)
        ctx.player.hp = Math.min(ctx.player.hp, ctx.player.maxHp)
        pushLog(ctx, `${monster.template.name}: 최대 HP 저주 -${cut}`, 'status')
      }
    },
  },

  split_3: {
    key: 'split_3',
    description: '3분열 — HP 50% 에서 hp/3 짜리 3개체 (환영의 지배자)',
    onHpThreshold({ ctx, monster, threshold }) {
      if (threshold !== 0.5) return
      const splitHp = Math.max(1, Math.round(monster.hp / 3))
      monster.hp = splitHp
      monster._phaseTriggered ??= {}
      monster._phaseTriggered.split = true
      // 2개체 추가 (자신 + 2 = 3)
      for (let i = 0; i < 2; i++) {
        const clone = makeMonster(
          { ...monster.template, hpMod: undefined },
          1,
          'normal',
        )
        clone.hp = splitHp
        clone.maxHp = monster.maxHp
        clone.atk = monster.atk
        clone.def = monster.def
        clone.speed = monster.speed
        clone._spawnedBy = monster.template.name
        clone._phaseTriggered = { '0.5': true }   // 분열 재발동 방지
        ctx.monsters.push(clone)
      }
      pushLog(ctx, `${monster.template.name}: 3분열!`, 'enemy')
    },
  },

  split_3_reflect: {
    key: 'split_3_reflect',
    description: 'split_3 + 마법 반사 30% (신기루 군주)',
    onHpThreshold({ ctx, monster, threshold }) {
      if (threshold !== 0.5) return
      MONSTER_TRAITS.split_3?.onHpThreshold?.({ ctx, monster, threshold })
    },
    onAfterAttacked(p) {
      if (!p.isMagic) return
      const reflect = Math.round(p.damage * 0.3)
      if (reflect > 0) damagePlayer(p.ctx, reflect, `${p.monster.template.name}: 마법 반사`)
    },
  },

  blood_strike: {
    key: 'blood_strike',
    description: '출혈 적에게 ×2 데미지 + 흡혈 100% (백작 블러드 로드)',
    onBeforeAttack({ ctx, monster }) {
      const hasBleed = ctx.player.statuses.some((s) => s.kind === '출혈')
      if (hasBleed && !monster._phaseTriggered?.blood) {
        monster._phaseTriggered ??= {}
        monster._phaseTriggered.blood = true
        monster.atk *= 2.0
        pushLog(ctx, `${monster.template.name}: 블러드 스트라이크!`, 'enemy')
      }
    },
    onPlayerHit({ ctx, monster, damage }) {
      if (monster._phaseTriggered?.blood) {
        monster.atk = monster.atk / 2.0
        monster._phaseTriggered.blood = false
      }
      // 흡혈 100%
      const heal = damage
      if (heal > 0) {
        monster.hp = Math.min(monster.maxHp, monster.hp + heal)
        pushLog(ctx, `${monster.template.name}: 흡혈 +${heal}`, 'enemy')
      }
    },
  },

  blood_strike_amplified: {
    key: 'blood_strike_amplified',
    description: 'blood_strike 강화 — ×3 데미지 + 흡혈 100% (진조 블러드 로드)',
    onBeforeAttack({ ctx, monster }) {
      const hasBleed = ctx.player.statuses.some((s) => s.kind === '출혈')
      if (hasBleed && !monster._phaseTriggered?.blood) {
        monster._phaseTriggered ??= {}
        monster._phaseTriggered.blood = true
        monster.atk *= 3.0
        pushLog(ctx, `${monster.template.name}: 진조 블러드 스트라이크!`, 'enemy')
      }
    },
    onPlayerHit({ ctx, monster, damage }) {
      if (monster._phaseTriggered?.blood) {
        monster.atk = monster.atk / 3.0
        monster._phaseTriggered.blood = false
      }
      const heal = damage
      if (heal > 0) {
        monster.hp = Math.min(monster.maxHp, monster.hp + heal)
        pushLog(ctx, `${monster.template.name}: 흡혈 +${heal}`, 'enemy')
      }
    },
  },

  bind: {
    key: 'bind',
    description: '결박 — HP 50% 에서 플레이어 둔화 +3스택 (크라켄)',
    onHpThreshold({ ctx, monster, threshold }) {
      if (threshold !== 0.5) return
      for (let i = 0; i < 3; i++) {
        applyStatus(ctx.player, '둔화', monster.atk, ctx.tick, 0)
      }
      pushLog(ctx, `${monster.template.name}: 결박! 둔화 +3스택`, 'status')
    },
  },

  bind_oxygen: {
    key: 'bind_oxygen',
    description: 'bind + 매 5틱 HP -2% (심해의 압박자)',
    onHpThreshold({ ctx, monster, threshold }) {
      if (threshold !== 0.5) return
      MONSTER_TRAITS.bind?.onHpThreshold?.({ ctx, monster, threshold })
    },
    onTickStart({ ctx, monster }) {
      if (ctx.tick > 0 && ctx.tick % 5 === 0) {
        const dmg = Math.max(1, Math.round(ctx.player.maxHp * 0.02))
        damagePlayer(ctx, dmg, `${monster.template.name}: 산소 부족`)
      }
    },
  },

  laser_charge: {
    key: 'laser_charge',
    description: '레이저 차징 — 30틱마다 차징 5틱 후 ×1.8 데미지. 평타 -20% (거대 메카닉 타이탄)',
    onSpawn({ monster }) {
      // 메카닉 타이탄: 평타는 약하지만 차징이 주력 데미지
      monster.atk = Math.round(monster.atk * 0.8)
    },
    onTickStart({ ctx, monster }) {
      // 30틱마다 차징 시작
      if (ctx.tick > 0 && ctx.tick % 30 === 0 && (monster._chargingTicks ?? 0) <= 0) {
        monster._chargingTicks = 5
        pushLog(ctx, `${monster.template.name}: 레이저 차징 시작…`, 'enemy')
        return
      }
      // 차징 진행
      if ((monster._chargingTicks ?? 0) > 0) {
        monster._chargingTicks!--
        if (monster._chargingTicks === 0) {
          // 평타 -20% 보정한 atk 기준 ×1.8 (총 원래 atk × 1.44)
          const dmg = Math.round(monster.atk * 1.8)
          damagePlayer(ctx, dmg, `${monster.template.name}: 레이저 발사`)
        }
      }
    },
  },

  spawn_drones: {
    key: 'spawn_drones',
    description: '드론 소환 — 30틱마다 1마리, 최대 2기 동시 (자동화 공장 코어)',
    onTickStart({ ctx, monster }) {
      if (ctx.tick > 0 && ctx.tick % 30 === 0) {
        if (aliveMinionCount(ctx, monster) >= MINION_CAP) return
        const theme = CHAPTER_THEMES['기계']
        const droneTemplate = theme.normalMonsters[0]  // 스파이더 마인
        const m = makeMonster(droneTemplate, 7, 'normal')
        m._spawnedBy = monster.template.name
        ctx.monsters.push(m)
        pushLog(ctx, `${monster.template.name}: 드론 소환!`, 'enemy')
      }
    },
  },

  burn_aura: {
    key: 'burn_aura',
    description: '화염 오라 — 매 5틱 점화 적용 (화염의 군주 이프리트)',
    onTickStart({ ctx, monster }) {
      if (ctx.tick > 0 && ctx.tick % 5 === 0) {
        applyStatus(ctx.player, '점화', monster.atk, ctx.tick, 0)
      }
    },
  },

  reflect_all_atk: {
    key: 'reflect_all_atk',
    description: '전 데미지 반사 30% (종말의 화신)',
    onAfterAttacked(p) {
      const reflect = Math.round(p.damage * 0.3)
      if (reflect > 0) damagePlayer(p.ctx, reflect, `${p.monster.template.name}: 화신 반사`)
    },
  },

  screen_darken: {
    key: 'screen_darken',
    description: '시야 차단 — HP 50% 에서 플레이어에게 강력한 암흑 (40틱) 적용 (실루엣 크로우)',
    onHpThreshold({ ctx, monster, threshold }) {
      if (threshold !== 0.5) return
      // 시야 차단 = 암흑 상태 4스택 부여 (1스택 -25, 4스택 ≈ -65 명중)
      // 층 클리어 시 자동 정화되므로 영구 문제 없음
      for (let i = 0; i < 4; i++) {
        applyStatus(ctx.player, '암흑', monster.atk, ctx.tick, 0)
      }
      pushLog(ctx, `${monster.template.name}: 시야 차단! 강력한 암흑 (4스택)`, 'status')
    },
  },

  silence_all: {
    key: 'silence_all',
    description: '전체 침묵 — 30틱마다 MP 0 + 30틱 스킬 봉인 (공허의 군주)',
    onTickStart({ ctx, monster }) {
      if (ctx.tick > 0 && ctx.tick % 30 === 0) {
        ctx.player.mp = 0
        const dur = 30
        ctx.player.silencedUntilTick = ctx.tick + dur
        pushLog(ctx, `${monster.template.name}: 침묵! MP 0 + ${dur}틱 스킬 봉인`, 'status')
      }
    },
  },

  aerial_invincible: {
    key: 'aerial_invincible',
    description: '비행 회피 — 물리 공격 50% 감소, 마법은 정상 적중 (천공의 심판자 키메라)',
    onAfterAttacked(p) {
      if (p.isPhysical) {
        // 물리 데미지 50% 환원 (= 절반만 피격)
        const refund = Math.round(p.damage * 0.5)
        if (refund > 0) {
          p.monster.hp = Math.min(p.monster.maxHp, p.monster.hp + refund)
          pushLog(p.ctx, `${p.monster.template.name}: 비행 회피! 물리 -50%`, 'miss')
        }
      }
    },
  },

  lightning_rain: {
    key: 'lightning_rain',
    description: '뇌우 — 매 10틱 광역 감전 (폭풍의 제단)',
    onTickStart({ ctx, monster }) {
      if (ctx.tick > 0 && ctx.tick % 10 === 0) {
        const dmg = Math.round(monster.atk * 0.5)
        damagePlayer(ctx, dmg, `${monster.template.name}: 뇌우`)
        applyStatus(ctx.player, '감전', monster.atk, ctx.tick, 0)
      }
    },
  },

  poison_aura: {
    key: 'poison_aura',
    description: '독 오라 — 매 5틱 독 적용 (독룡 히드라)',
    onTickStart({ ctx, monster }) {
      if (ctx.tick > 0 && ctx.tick % 5 === 0) {
        applyStatus(ctx.player, '독', monster.atk, ctx.tick, 0)
      }
    },
  },

  // heal_reverse 는 combat.ts:applyHealing 에서 직접 처리 (회복 → 데미지 역전)
  heal_reverse: {
    key: 'heal_reverse',
    description: '회복 역전 — 플레이어 회복이 데미지로 (치명적 역병 그 자체). 실제 처리는 applyHealing.',
    onSpawn({ ctx, monster }) {
      pushLog(ctx, `${monster.template.name}: 회복 역전 오라`, 'info')
    },
  },
}

// ============================================================
// 디스패처
// ============================================================

export function dispatchOnSpawn(ctx: CombatContext, monster: MonsterInstance): void {
  const key = monster.template.trait
  if (!key) return
  const def = MONSTER_TRAITS[key]
  if (!def?.onSpawn) return
  def.onSpawn({ ctx, monster })
}

export function dispatchOnBeforeAttack(
  ctx: CombatContext,
  monster: MonsterInstance,
): { skipBasicAttack: boolean } {
  const key = monster.template.trait
  if (!key) return { skipBasicAttack: false }
  const def = MONSTER_TRAITS[key]
  if (!def?.onBeforeAttack) return { skipBasicAttack: false }
  const r = def.onBeforeAttack({ ctx, monster })
  return { skipBasicAttack: !!r?.skipBasicAttack }
}

export function dispatchOnAfterAttacked(
  ctx: CombatContext,
  monster: MonsterInstance,
  damage: number,
  flags: { isMagic: boolean; isPhysical: boolean },
): void {
  const key = monster.template.trait
  if (!key) return
  const def = MONSTER_TRAITS[key]
  if (!def?.onAfterAttacked) return
  def.onAfterAttacked({ ctx, monster, damage, isMagic: flags.isMagic, isPhysical: flags.isPhysical })
}

export function dispatchOnPlayerHit(
  ctx: CombatContext,
  monster: MonsterInstance,
  damage: number,
): void {
  const key = monster.template.trait
  if (!key) return
  const def = MONSTER_TRAITS[key]
  if (!def?.onPlayerHit) return
  def.onPlayerHit({ ctx, monster, damage })
}

export function dispatchOnTickStart(ctx: CombatContext, monster: MonsterInstance): void {
  const key = monster.template.trait
  if (!key) return
  const def = MONSTER_TRAITS[key]
  if (!def?.onTickStart) return
  def.onTickStart({ ctx, monster })
}

// HP 임계값 체크 후 트리거. 임계값마다 한 번만 발동.
export function dispatchOnHpThreshold(
  ctx: CombatContext,
  monster: MonsterInstance,
  thresholds: number[] = [0.5, 0.3],
): void {
  const key = monster.template.trait
  if (!key) return
  const def = MONSTER_TRAITS[key]
  if (!def?.onHpThreshold) return
  if (monster.hp <= 0 || monster.maxHp <= 0) return

  const ratio = monster.hp / monster.maxHp
  monster._phaseTriggered ??= {}
  for (const t of thresholds) {
    const flagKey = String(t)
    if (monster._phaseTriggered[flagKey]) continue
    if (ratio <= t) {
      monster._phaseTriggered[flagKey] = true
      def.onHpThreshold({ ctx, monster, threshold: t })
    }
  }
}

// 사망 직전 호출. revived: true 반환 시 호출자는 hp 를 1 이상으로 만든 것으로 간주.
export function dispatchOnDeath(
  ctx: CombatContext,
  monster: MonsterInstance,
): { revived: boolean } {
  const key = monster.template.trait
  if (!key) return { revived: false }
  const def = MONSTER_TRAITS[key]
  if (!def?.onDeath) return { revived: false }
  const r = def.onDeath({ ctx, monster })
  return { revived: !!r?.revived }
}

// ====== trait 키 일치성 검증 ======
//
// chapters.ts 의 모든 trait 키가 MONSTER_TRAITS 에 등록됐는지 검사.
// 등록되지 않은 키는 leftover (효과 없음) 로 간주.
// 개발 모드: console.warn (단계 4 에서 보스 trait 추가하면 점차 줄어든다)
export function validateMonsterTraitKeys(allTraitKeys: string[]): { missing: string[] } {
  const missing = allTraitKeys.filter((k) => !(k in MONSTER_TRAITS))
  if (missing.length === 0) return { missing }

  // 개발 모드 경고는 호출측에서 처리 (전역 콘솔 노출 X)
  return { missing }
}

// chapters.ts 에서 trait 키 목록 추출 헬퍼 (검증용)
export function collectChapterTraitKeys(
  themes: Record<string, { normalMonsters: Array<{ trait?: string }>; boss: { trait?: string }; hardBoss?: { trait?: string } }>,
): string[] {
  const set = new Set<string>()
  for (const theme of Object.values(themes)) {
    for (const m of theme.normalMonsters) if (m.trait) set.add(m.trait)
    if (theme.boss.trait) set.add(theme.boss.trait)
    if (theme.hardBoss?.trait) set.add(theme.hardBoss.trait)
  }
  return [...set].sort()
}
