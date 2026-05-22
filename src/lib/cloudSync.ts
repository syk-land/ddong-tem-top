import {
  doc, setDoc, getDoc, deleteDoc, serverTimestamp,
  collection, query, orderBy, limit, getDocs,
} from 'firebase/firestore'
import { firestore } from './firebase'
import type { MetaBonuses, CharacterRecord } from '@/types'
import type { User } from 'firebase/auth'

// ============================================================
// Firestore 데이터 모델
//   users/{uid}            — 프로필 (displayName, photoURL, 닉네임)
//   meta/{uid}             — 게임 진행도 (MetaBonuses 일부 또는 전체)
//   leaderboard/{uid}      — 공개 리더보드 (최고 점수, 등급, 닉네임)
// ============================================================

export interface UserProfile {
  uid: string
  displayName: string | null
  photoURL: string | null
  // email 은 Firestore 에 저장하지 않는다 (보안 — 공개 read 노출 방지).
  // 필요하면 firebase Auth 에서 직접 user.email 로 접근.
  nickname?: string  // 게임 내 닉네임 (없으면 displayName 사용)
  createdAt?: unknown
  updatedAt?: unknown
}

export interface CloudMeta {
  clearCount: number
  totalBonusStats: number
  permanentStartBonus: number
  realBossCompleted: boolean
  realBossDefeated: boolean
  totalGoldEarned: number
  // 최근 캐릭터 히스토리는 양이 많아서 별도 처리 가능 — 일단 최대 50개 그대로 저장
  characterHistory: CharacterRecord[]
  updatedAt?: unknown
}

export interface LeaderboardEntry {
  uid: string
  nickname: string
  bestScore: number
  bestRank: string
  clearCount: number
  updatedAt?: unknown
}

// ── 프로필 ────────────────────────────────────────────────
export async function upsertUserProfile(user: User, nickname?: string): Promise<void> {
  const ref = doc(firestore, 'users', user.uid)
  const existing = await getDoc(ref)
  // 보안: email 은 Firestore 에 저장하지 않는다. Firebase Auth 에 이미 있고,
  // users/{uid} 는 리더보드용으로 다른 사용자가 read 가능하므로 공개해선 안 됨.
  const base: Partial<UserProfile> = {
    uid: user.uid,
    displayName: user.displayName,
    photoURL: user.photoURL,
    updatedAt: serverTimestamp(),
  }
  if (!existing.exists()) {
    base.createdAt = serverTimestamp()
  }
  if (nickname !== undefined) base.nickname = nickname
  await setDoc(ref, base, { merge: true })
}

export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  const snap = await getDoc(doc(firestore, 'users', uid))
  return snap.exists() ? (snap.data() as UserProfile) : null
}

// ── 메타 진행도 ───────────────────────────────────────────
export async function saveCloudMeta(uid: string, meta: MetaBonuses): Promise<void> {
  const payload: CloudMeta = {
    clearCount: meta.clearCount,
    totalBonusStats: meta.totalBonusStats,
    permanentStartBonus: meta.permanentStartBonus,
    realBossCompleted: meta.realBossCompleted,
    realBossDefeated: meta.realBossDefeated,
    totalGoldEarned: meta.totalGoldEarned,
    characterHistory: meta.characterHistory ?? [],
    updatedAt: serverTimestamp(),
  }
  await setDoc(doc(firestore, 'meta', uid), payload, { merge: true })
}

export async function loadCloudMeta(uid: string): Promise<CloudMeta | null> {
  const snap = await getDoc(doc(firestore, 'meta', uid))
  return snap.exists() ? (snap.data() as CloudMeta) : null
}

// 데이터 리셋 — Firestore 의 사용자별 문서 삭제 (meta + 리더보드).
// 로컬 localStorage 는 호출자가 별도로 비움. 로그아웃은 호출자 결정.
// 실패해도 throw 하지 않고 로그만 — 로컬 리셋은 항상 진행되어야 하므로.
export async function deleteCloudUserData(uid: string): Promise<void> {
  const targets = [
    doc(firestore, 'meta', uid),
    doc(firestore, 'leaderboard', uid),
  ]
  await Promise.all(
    targets.map((ref) =>
      deleteDoc(ref).catch((err) => {
        console.warn(`[cloudSync] deleteDoc ${ref.path} failed:`, err)
      }),
    ),
  )
}

// ── 리더보드 ──────────────────────────────────────────────
export async function submitLeaderboard(
  uid: string,
  nickname: string,
  record: { score: number; rank: string },
  clearCount: number,
): Promise<void> {
  const ref = doc(firestore, 'leaderboard', uid)
  const existing = await getDoc(ref)
  const prevBest = existing.exists() ? (existing.data() as LeaderboardEntry).bestScore ?? 0 : 0
  // 본인 최고 점수만 갱신 (낮은 점수로 덮어쓰지 않음)
  if (record.score <= prevBest && existing.exists()) {
    // clearCount/nickname 같은 메타데이터만 갱신
    await setDoc(ref, {
      nickname, clearCount, updatedAt: serverTimestamp(),
    }, { merge: true })
    return
  }
  await setDoc(ref, {
    uid,
    nickname,
    bestScore: record.score,
    bestRank: record.rank,
    clearCount,
    updatedAt: serverTimestamp(),
  } satisfies LeaderboardEntry, { merge: true })
}

export async function fetchTopLeaderboard(n: number = 50): Promise<LeaderboardEntry[]> {
  const q = query(
    collection(firestore, 'leaderboard'),
    orderBy('bestScore', 'desc'),
    limit(n),
  )
  const snap = await getDocs(q)
  return snap.docs.map((d) => d.data() as LeaderboardEntry)
}
