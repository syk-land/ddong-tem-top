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

// 클라우드 sync 디바운스 — 게임 중 persistMeta() 가 5~10 회 호출되어도
// 마지막 변경만 한 번 푸시 (Firestore 쓰기 한도 절약, 무료 한도에서 DAU 5배↑).
// 즉시 보장이 필요한 시점 (클리어/로그아웃/탭 숨김/데이터 리셋) 에선
// flushSyncMetaToCloud() / cancelPendingSync() 로 우회.
const CLOUD_SYNC_DEBOUNCE_MS = 30_000
let cloudSyncTimer: ReturnType<typeof setTimeout> | null = null
function clearCloudSyncTimer() {
  if (cloudSyncTimer !== null) {
    clearTimeout(cloudSyncTimer)
    cloudSyncTimer = null
  }
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
        game.meta.totalGoldEarned = cloud.totalGoldEarned
        if (Array.isArray(cloud.characterHistory)) {
          game.meta.characterHistory = cloud.characterHistory
        }
      }
      // 첫 로그인이면 로컬을 클라우드로 푸시
      await saveCloudMeta(user.uid, game.meta)
    },

    // 즉시 클라우드 푸시 (디바운스 우회). 보류 타이머가 있어도 그것까지 취소.
    async syncMetaToCloud() {
      if (!this.user) return
      clearCloudSyncTimer()
      const game = useGameStore()
      await saveCloudMeta(this.user.uid, game.meta)
    },

    // 디바운스 큐잉 — game.persistMeta() 가 사용. 30초 안에 추가 호출이
    // 오면 타이머만 리셋, 마지막 호출 후 30초 뒤에 한 번만 실제 푸시.
    queueSyncMetaToCloud() {
      if (!this.user) return
      clearCloudSyncTimer()
      cloudSyncTimer = setTimeout(() => {
        cloudSyncTimer = null
        // 비로그인 상태로 바뀌었을 수 있으므로 syncMetaToCloud 내부에서 한 번 더 가드.
        this.syncMetaToCloud().catch((e) => console.warn('queued sync failed', e))
      }, CLOUD_SYNC_DEBOUNCE_MS)
    },

    // 보류 타이머가 있으면 즉시 실행, 없으면 no-op. await 가능.
    async flushSyncMetaToCloud() {
      if (cloudSyncTimer === null) return
      clearCloudSyncTimer()
      await this.syncMetaToCloud()
    },

    // 보류 타이머만 취소 (쓰기 X). 데이터 리셋 직전에 사용 — 삭제 직후 타이머가 발화해
    // 삭제된 cloud 문서가 다시 쓰여지는 걸 막는다.
    cancelPendingSync() {
      clearCloudSyncTimer()
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
