import { initializeApp, getApps, type FirebaseApp } from 'firebase/app'
import { getAuth, type Auth } from 'firebase/auth'
import { getFirestore, type Firestore } from 'firebase/firestore'

// Firebase Web API key 는 공개돼도 안전한 식별자. 보안은 Firestore Rules 로.
const firebaseConfig = {
  apiKey: 'AIzaSyD_DhDBH5PKiRHustwM3uUKgk2A7cH7HRU',
  authDomain: 'ddongtop-bea1d.firebaseapp.com',
  projectId: 'ddongtop-bea1d',
  storageBucket: 'ddongtop-bea1d.firebasestorage.app',
  messagingSenderId: '765295712321',
  appId: '1:765295712321:web:e36aac55a81dd21ae78ec0',
}

const app: FirebaseApp = getApps().length ? getApps()[0] : initializeApp(firebaseConfig)
export const firebaseApp = app
export const firebaseAuth: Auth = getAuth(app)
export const firestore: Firestore = getFirestore(app)
