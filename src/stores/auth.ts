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
        game.meta.totalGoldEarned = cloud.totalGoldEarned
        if (Array.isArray(cloud.characterHistory)) {
          game.meta.characterHistory = cloud.characterHistory
        }
      }
      // 첫 로그인이면 로컬을 클라우드로 푸시
      await saveCloudMeta(user.uid, game.meta)
    },

    // 외부에서 호출: 게임 진행도를 클라우드로 푸시
    async syncMetaToCloud() {
      if (!this.user) return
      const game = useGameStore()
      await saveCloudMeta(this.user.uid, game.meta)
    },

    // 외부에서 호출: 리더보드 제출 (캐릭터 클리어 시점)
    async submitScore(score: number, rank: string) {
      if (!this.user) return
      const game = useGameStore()
      const nickname = this.user.displayName ?? '익명'
      await submitLeaderboard(this.user.uid, nickname, { score, rank }, game.meta.clearCount)
    },
  },
})
