import {
  GoogleAuthProvider,
  signInWithCredential,
  signInWithPopup,
  signOut as fbSignOut,
  onAuthStateChanged,
  type User,
} from 'firebase/auth'
import { Capacitor } from '@capacitor/core'
import { firebaseAuth } from './firebase'

// Capacitor 네이티브 환경(Android) 이면 네이티브 Google Sign-In 플러그인 사용,
// 웹/PC dev 환경이면 Firebase JS SDK 의 popup 사용.
function isNative(): boolean {
  try {
    return Capacitor.isNativePlatform()
  } catch {
    return false
  }
}

export async function signInWithGoogle(): Promise<User> {
  if (isNative()) {
    // 동적 import — 웹 빌드에서 capacitor 플러그인 코드를 끌어오지 않도록
    const { FirebaseAuthentication } = await import('@capacitor-firebase/authentication')
    const result = await FirebaseAuthentication.signInWithGoogle()
    const idToken = result.credential?.idToken
    if (!idToken) throw new Error('Google ID token 을 받지 못했습니다.')
    const credential = GoogleAuthProvider.credential(idToken)
    const userCred = await signInWithCredential(firebaseAuth, credential)
    return userCred.user
  }
  const provider = new GoogleAuthProvider()
  const userCred = await signInWithPopup(firebaseAuth, provider)
  return userCred.user
}

export async function signOut(): Promise<void> {
  if (isNative()) {
    const { FirebaseAuthentication } = await import('@capacitor-firebase/authentication')
    await FirebaseAuthentication.signOut()
  }
  await fbSignOut(firebaseAuth)
}

export function onAuthChange(cb: (user: User | null) => void): () => void {
  return onAuthStateChanged(firebaseAuth, cb)
}

export function currentUser(): User | null {
  return firebaseAuth.currentUser
}
