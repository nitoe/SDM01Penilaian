import { initializeApp, getApps } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore, initializeFirestore } from 'firebase/firestore'
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

const isNewApp = getApps().length === 0
const app = isNewApp ? initializeApp(firebaseConfig) : getApps()[0]!

export { app }
export const auth = getAuth(app)
// ignoreUndefinedProperties: normalizeSiswa() menghasilkan field `undefined` untuk kolom
// yang kosong. Tanpa opsi ini setDoc/set melempar "Unsupported field value: undefined".
// initializeFirestore hanya boleh dipanggil sekali per app (HMR → pakai getFirestore).
export const db = isNewApp
  ? initializeFirestore(app, { ignoreUndefinedProperties: true })
  : getFirestore(app)
export const storage = getStorage(app)
export { firebaseConfig }

/** True jika config sudah diisi di file .env (bukan placeholder) */
export const isFirebaseConfigured =
  Boolean(import.meta.env.VITE_FIREBASE_API_KEY) &&
  import.meta.env.VITE_FIREBASE_API_KEY !== 'PLACEHOLDER_API_KEY' &&
  import.meta.env.VITE_FIREBASE_API_KEY !== 'ganti_dengan_api_key'
