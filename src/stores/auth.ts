import { defineStore } from 'pinia'
import type { User } from 'firebase/auth'
import { signInWithGoogle, signOut, onAuthChange } from '@/lib/auth'
import { upsertUserProfile, saveCloudMeta, loadCloudMeta, submitLeaderboard, type CloudMeta } from '@/lib/cloudSync'
import type { MetaBonuses } from '@/types'

// 클라우드와 로컬 meta 핵심 필드 비교 — 다를 때만 사용자 확인 모달을 띄운다.
function cloudDiffersFromLocal(cloud: CloudMeta, local: MetaBonuses): boolean {
  return cloud.clearCount !== local.clearCount
    || cloud.totalBonusStats !== local.totalBonusStats
    || cloud.permanentStartBonus !== local.permanentStartBonus
    || (cloud.realBossClearCount ?? 0) !== (local.realBossClearCount ?? 0)
    || (cloud.currentBossBestDrain ?? 0) !== (local.currentBossBestDrain ?? 0)
    || cloud.totalGoldEarned !== local.totalGoldEarned
    || cloud.realBossDefeated !== local.realBossDefeated
}
import { useGameStore } from './game'

interface AuthState {
  user: User | null
  loading: boolean
  error: string | null
  initialized: boolean
}

// 클라우드 sync 정책 — persistMeta() 는 로컬만 저장하고 클라우드는 명시적 시점
// (캐릭터 클리어 / 로그아웃 / 탭 숨김 / 로그인 직후) 에서만 push 한다.
// 이 사이 변경분이 있는지는 cloudDirty 플래그로 추적. Firestore 쓰기 한도
// (무료 20K/일) 를 크게 절약 — 게임 1 세션당 약 1 write 수준.
//
// 트레이드오프: 진행 중 브라우저 강제 종료 (visibilitychange 미발화) 시
// 마지막 명시 sync 이후 변경분은 cloud 에 못 들어감. 단 localStorage 에는
// 항상 있으므로 다음 로그인 시 _onLoggedIn 의 cloud merge 가 로컬을 push.
let cloudDirty = false

export const useAuthStore = defineStore('auth', {
  state: (): AuthState => ({
    user: null,
    loading: false,
    error: null,
    initialized: false,
  }),

  getters: {
    isLoggedIn: (s) => !!s.user,
    uid: (s) => s.user?.uid ?? null,
    displayName: (s) => s.user?.displayName ?? null,
    photoURL: (s) => s.user?.photoURL ?? null,
    email: (s) => s.user?.email ?? null,
    // 테스트 권한 계정 (개발자 본인) — 100배 가속 등 디버그 옵션 노출용
    isDevAccount: (s) => s.user?.email === 'syk4441@gmail.com',
  },

  actions: {
    // App.vue mount 시 1회 호출 — 이미 로그인된 세션 복원
    initAuthListener() {
      if (this.initialized) return
      this.initialized = true
      onAuthChange((user) => {
        this.user = user
        // 세션 복원(페이지 reload/재접속)에서는 덮어쓰기 모달을 띄우지 않는다.
        // 모달은 사용자가 방금 명시적으로 로그인을 누른 경우에만 의미가 있음.
        if (user) this._onLoggedIn(user, false).catch((e) => console.warn('post-login sync failed', e))
      })
    },

    async login() {
      this.loading = true
      this.error = null
      try {
        const user = await signInWithGoogle()
        this.user = user
        await this._onLoggedIn(user, true)
      } catch (e: any) {
        this.error = e?.message ?? String(e)
        throw e
      } finally {
        this.loading = false
      }
    },

    async logout() {
      this.loading = true
      try {
        // 보류된 클라우드 변경이 있으면 로그아웃 전에 마지막으로 푸시.
        await this.flushSyncMetaToCloud()
        await signOut()
        this.user = null
      } finally {
        this.loading = false
      }
    },

    // 로그인 직후: 프로필 upsert + 클라우드 meta 발견 시 사용자에게 덮어쓰기 확인.
    //   예 → 클라우드 → 로컬 머지 + localStorage 저장 + 페이지 reload (UI 즉시 갱신)
    //   아니오 → 어느 쪽도 건드리지 않음 (로컬/클라우드 둘 다 그대로 유지)
    //   클라우드 == 로컬 또는 클라우드 없음 → 모달 없이 한 번 sync (첫 로그인 케이스)
    //
    // interactive=false (페이지 reload 로 인한 세션 복원) 인 경우 덮어쓰기 모달을 띄우지 않는다.
    // 모달은 사용자가 방금 로그인 버튼을 눌렀을 때만 의미가 있음. 세션 복원 경로에서는
    // cloud 가 다르더라도 무시하고, cloud 가 없을 때만 로컬을 한 번 push 한다.
    async _onLoggedIn(user: User, interactive: boolean) {
      await upsertUserProfile(user)
      const game = useGameStore()
      const cloud = await loadCloudMeta(user.uid)
      if (cloud && cloudDiffersFromLocal(cloud, game.meta)) {
        if (!interactive) return
        const localLine = `로컬 — 클리어 ${game.meta.clearCount}회 · 보너스 +${game.meta.totalBonusStats}pt · 라운드 ${game.meta.realBossClearCount ?? 0}`
        const cloudLine = `클라우드 — 클리어 ${cloud.clearCount}회 · 보너스 +${cloud.totalBonusStats}pt · 라운드 ${cloud.realBossClearCount ?? 0}`
        const overwrite = await game.confirmModal(
          `클라우드에 저장된 데이터가 있어요.\n로컬 데이터를 클라우드 데이터로 덮어쓸까요?\n\n${localLine}\n${cloudLine}`,
          { title: '클라우드 데이터 복원', okLabel: '클라우드로 덮어쓰기', cancelLabel: '로컬 유지' },
        )
        if (overwrite) {
          game.meta.clearCount = cloud.clearCount
          game.meta.totalBonusStats = cloud.totalBonusStats
          game.meta.permanentStartBonus = cloud.permanentStartBonus
          game.meta.realBossCompleted = cloud.realBossCompleted
          game.meta.realBossDefeated = cloud.realBossDefeated
          game.meta.realBossClearCount = cloud.realBossClearCount ?? 0
          game.meta.currentBossBestDrain = cloud.currentBossBestDrain ?? 0
          game.meta.totalGoldEarned = cloud.totalGoldEarned
          if (Array.isArray(cloud.characterHistory)) {
            game.meta.characterHistory = cloud.characterHistory
          }
          game.meta.challengeChampion = cloud.challengeChampion ?? null
          if (cloud.prologueRiftSeen !== undefined) game.meta.prologueRiftSeen = cloud.prologueRiftSeen
          if (cloud.prologueBonusGranted !== undefined) game.meta.prologueBonusGranted = cloud.prologueBonusGranted
          if (Array.isArray(cloud.discoveredQuirks)) game.meta.discoveredQuirks = cloud.discoveredQuirks
          game.persistMeta()
          // UI 즉시 갱신 — Vue/Pinia 일부 화면이 onMounted 시점 값에 의존하므로 reload 가 가장 안전.
          window.location.reload()
          return
        }
        // 로컬 유지 — 로컬/클라우드 어느 쪽도 건드리지 않음. 이후 사용자가 직접 진행하면
        // 그 시점의 변경분이 정상 sync 경로로 클라우드에 push 된다.
        return
      }
      // 클라우드 없음 또는 동일 — 일반 sync (첫 로그인의 초기 push 또는 동기화 유지).
      await this.syncMetaToCloud()
    },

    // 즉시 클라우드 푸시. dirty 플래그도 함께 해제.
    async syncMetaToCloud() {
      if (!this.user) return
      cloudDirty = false
      const game = useGameStore()
      await saveCloudMeta(this.user.uid, game.meta)
    },

    // game.persistMeta() 가 호출 — 로컬 변경이 클라우드와 어긋났음을 표시만 한다.
    // 실제 push 는 명시 시점 (캐릭터 클리어 / 로그아웃 / 탭 숨김) 의 flush 에서 일어남.
    queueSyncMetaToCloud() {
      if (!this.user) return
      cloudDirty = true
    },

    // dirty 면 즉시 push, 아니면 no-op. 명시 sync 지점에서 호출.
    async flushSyncMetaToCloud() {
      if (!cloudDirty) return
      await this.syncMetaToCloud()
    },

    // dirty 플래그만 해제 (쓰기 X). 데이터 리셋 직전에 사용 — 삭제 직후
    // flush 가 발화해 삭제된 cloud 문서가 다시 쓰여지는 걸 막는다.
    cancelPendingSync() {
      cloudDirty = false
    },

    // 외부에서 호출: 리더보드 제출 (캐릭터 클리어 시점).
    // 리더보드와 meta(cloud) 의 clearCount 가 일관되도록 먼저 flush.
    async submitScore(score: number, rank: string) {
      if (!this.user) return
      await this.flushSyncMetaToCloud()
      const game = useGameStore()
      const nickname = this.user.displayName ?? '익명'
      await submitLeaderboard(this.user.uid, nickname, { score, rank }, game.meta.clearCount)
    },
  },
})
