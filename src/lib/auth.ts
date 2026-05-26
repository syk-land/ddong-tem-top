import {
  GoogleAuthProvider,
  signInWithPopup,
  signOut as fbSignOut,
  onAuthStateChanged,
  type User,
} from 'firebase/auth'
import { firebaseAuth } from './firebase'

// Firebase JS SDK popup 으로 Google 로그인.
export async function signInWithGoogle(): Promise<User> {
  const provider = new GoogleAuthProvider()
  const userCred = await signInWithPopup(firebaseAuth, provider)
  return userCred.user
}

export async function signOut(): Promise<void> {
  await fbSignOut(firebaseAuth)
}

export function onAuthChange(cb: (user: User | null) => void): () => void {
  return onAuthStateChanged(firebaseAuth, cb)
}

export function currentUser(): User | null {
  return firebaseAuth.currentUser
}
