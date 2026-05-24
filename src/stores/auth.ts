import { defineStore } from 'pinia'
import type { User } from 'firebase/auth'
import { signInWithGoogle, signOut, onAuthChange } from '@/lib/auth'
import { upsertUserProfile, saveCloudMeta, loadCloudMeta, submitLeaderboard } from '@/lib/cloudSync'
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
        if (user) this._onLoggedIn(user).catch((e) => console.warn('post-login sync failed', e))
      })
    },

    async login() {
      this.loading = true
      this.error = null
      try {
        const user = await signInWithGoogle()
        this.user = user
        await this._onLoggedIn(user)
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

    // 로그인 직후: 프로필 upsert + 클라우드 meta 로 로컬 meta 갱신 시도
    async _onLoggedIn(user: User) {
      await upsertUserProfile(user)
      const game = useGameStore()
      const cloud = await loadCloudMeta(user.uid)
      // 클라우드가 더 진행돼 있으면 (clearCount 기준) 클라우드 → 로컬 머지
      if (cloud && cloud.clearCount > game.meta.clearCount) {
        game.meta.clearCount = cloud.clearCount
        game.meta.totalBonusStats = cloud.totalBonusStats
        game.meta.permanentStartBonus = cloud.permanentStartBonus
        game.meta.realBossCompleted = cloud.realBossCompleted
        game.meta.realBossDefeated = cloud.realBossDefeated
        game.meta.realBossClearCount = cloud.realBossClearCount ?? (cloud.realBossDefeated ? 1 : 0)
        game.meta.currentBossBestDrain = cloud.currentBossBestDrain ?? 0
        game.meta.totalGoldEarned = cloud.totalGoldEarned
        if (Array.isArray(cloud.characterHistory)) {
          game.meta.characterHistory = cloud.characterHistory
        }
      }
      // 첫 로그인이면 로컬을 클라우드로 푸시 (이후 dirty 추적 시작점)
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
