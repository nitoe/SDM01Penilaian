import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  type User,
} from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'
import { auth, db, isFirebaseConfigured } from './firebase'
import type { AppUser } from '../types/user'

/**
 * Login dengan email + password Firebase Auth.
 * Setelah sukses, profil lengkap diambil dari koleksi `users/{uid}`.
 */
export async function loginWithEmail(email: string, password: string) {
  if (!isFirebaseConfigured) {
    throw new Error(
      'Firebase belum dikonfigurasi. Isi file .env terlebih dahulu (lihat docs/SETUP_FIREBASE.md).',
    )
  }
  const cred = await signInWithEmailAndPassword(auth, email.trim().toLowerCase(), password)
  const profile = await fetchUserProfile(cred.user.uid)
  return { user: cred.user, profile }
}

export async function logout() {
  await signOut(auth)
}

/** Ambil dokumen profil di Firestore. Return null jika belum ada. */
export async function fetchUserProfile(uid: string): Promise<AppUser | null> {
  if (!isFirebaseConfigured) return null
  const snap = await getDoc(doc(db, 'users', uid))
  if (!snap.exists()) return null
  const data = snap.data()
  return {
    uid,
    email: (data.email as string) || '',
    nama: (data.nama as string) || '',
    role: data.role,
    kelasAmpu: data.kelasAmpu,
    status: data.status,
    anakIds: data.anakIds,
    penugasan: data.penugasan,
    waliKelas: data.waliKelas,
    penugasanKelas: data.penugasanKelas,
    penugasanKelasMapel: data.penugasanKelasMapel,
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
  }
}

/**
 * Subscribe perubahan status auth.
 * Callback menerima (firebaseUser, profile) — profile bisa null
 * jika dokumen users/{uid} belum dibuat di Firestore.
 */
export function subscribeAuth(
  callback: (user: User | null, profile: AppUser | null) => void,
) {
  return onAuthStateChanged(auth, async (user) => {
    if (!user) {
      callback(null, null)
      return
    }
    try {
      const profile = await fetchUserProfile(user.uid)
      callback(user, profile)
    } catch {
      callback(user, null)
    }
  })
}
