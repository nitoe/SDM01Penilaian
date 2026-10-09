import { initializeApp, getApps } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'
import { getStorage } from 'firebase/storage'

/**
 * Konfigurasi Firebase dibaca dari environment variables (.env).
 * Lihat .env.example dan docs/SETUP_FIREBASE.md.
 */
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'PLACEHOLDER_API_KEY',
  authDomain:
    import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'sdm01kukusan-2e735.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'sdm01kukusan-2e735',
  storageBucket:
    import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'sdm01kukusan-2e735.firebasestorage.app',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '000000000000',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:000000000000:web:placeholder',
}

const app = getApps().length ? getApps()[0]! : initializeApp(firebaseConfig)

export { app }
export const auth = getAuth(app)
export const db = getFirestore(app)
export const storage = getStorage(app)
export { firebaseConfig }

/** True jika config sudah diisi di file .env (bukan placeholder) */
export const isFirebaseConfigured =
  Boolean(import.meta.env.VITE_FIREBASE_API_KEY) &&
  import.meta.env.VITE_FIREBASE_API_KEY !== 'PLACEHOLDER_API_KEY' &&
  import.meta.env.VITE_FIREBASE_API_KEY !== 'ganti_dengan_api_key'
