import {
  EmailAuthProvider,
  onAuthStateChanged,
  reauthenticateWithCredential,
  signInWithEmailAndPassword,
  signOut,
  updatePassword,
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
  if (!profile) {
    await signOut(auth)
    throw new Error(
      'Akun login ada di Firebase, tetapi profil staf sudah dihapus. Hubungi administrator bila ini keliru.',
    )
  }
  if (profile.aktif === false) {
    await signOut(auth)
    throw new Error('Akun ini dinonaktifkan. Hubungi administrator.')
  }
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
    gelar: (data.gelar as string) || undefined,
    ttdUrl: typeof data.ttdUrl === 'string' && data.ttdUrl.trim() ? data.ttdUrl.trim() : undefined,
    nbm: typeof data.nbm === 'string' && data.nbm.trim() ? data.nbm.trim() : undefined,
    role: data.role,
    kelasAmpu: data.kelasAmpu,
    status: data.status,
    anakIds: data.anakIds,
    penugasan: data.penugasan,
    waliKelas: data.waliKelas,
    penugasanKelas: data.penugasanKelas,
    penugasanKelasMapel: data.penugasanKelasMapel,
    aktif: typeof data.aktif === 'boolean' ? data.aktif : undefined,
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

/**
 * Ubah password akun yang sedang login.
 * Wajib re-autentikasi dengan password lama (syarat Firebase untuk sesi yang sudah lama).
 * Hanya untuk staf (admin, guru akademik, tahsin-tahfizh, bidang studi) yang login sendiri.
 */
export async function ubahPasswordSendiri(
  passwordLama: string,
  passwordBaru: string,
): Promise<void> {
  if (!isFirebaseConfigured) {
    throw new Error('Firebase belum dikonfigurasi.')
  }
  const user = auth.currentUser
  if (!user || !user.email) {
    throw new Error('Sesi login tidak ditemukan. Masuk ulang lalu coba lagi.')
  }
  const baru = passwordBaru.trim()
  if (baru.length < 8) {
    throw Object.assign(new Error('Password baru minimal 8 karakter.'), {
      code: 'auth/weak-password',
    })
  }
  if (baru === passwordLama) {
    throw new Error('Password baru harus berbeda dari password lama.')
  }
  const credential = EmailAuthProvider.credential(user.email, passwordLama)
  await reauthenticateWithCredential(user, credential)
  await updatePassword(user, baru)
}

/** Pesan galat yang ramah untuk form ubah password. */
export function pesanGalatUbahPassword(err: unknown): string {
  const code =
    err && typeof err === 'object' && 'code' in err ? String((err as { code: unknown }).code) : ''
  if (code === 'auth/wrong-password' || code === 'auth/invalid-credential') {
    return 'Password lama salah.'
  }
  if (code === 'auth/weak-password') {
    return 'Password baru terlalu lemah. Gunakan minimal 8 karakter.'
  }
  if (code === 'auth/requires-recent-login') {
    return 'Sesi sudah lama. Keluar, masuk lagi, lalu ubah password.'
  }
  if (code === 'auth/too-many-requests') {
    return 'Terlalu banyak percobaan. Coba lagi beberapa menit kemudian.'
  }
  if (err instanceof Error && err.message) return err.message
  return 'Gagal mengubah password.'
}
