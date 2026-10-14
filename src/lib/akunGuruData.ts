import { deleteApp, getApps, initializeApp } from 'firebase/app'
import {
  createUserWithEmailAndPassword,
  getAuth,
  inMemoryPersistence,
  sendPasswordResetEmail,
  setPersistence,
  signInWithEmailAndPassword,
  signOut,
} from 'firebase/auth'
import { collection, deleteDoc, doc, getDoc, getDocs, getFirestore, setDoc, type DocumentData } from 'firebase/firestore'
import { getFunctions, httpsCallable } from 'firebase/functions'
import { adalahRole, susunDokumenAkun, type InputAkunGuru } from './akunGuru'
import { app, auth, db, firebaseConfig } from './firebase'
import type { AppUser, UserRole } from '../types/user'

/** Nama app sekunder. Auth-nya in-memory supaya sesi admin di app utama tidak terganti. */
const NAMA_APP_SEKUNDER = 'sdm-buat-akun'
/** App sekunder untuk pendaftaran mandiri guru (halaman /register). Lihat `daftarMandiriGuru`. */
const NAMA_APP_DAFTAR = 'sdm-daftar-mandiri'
/** Batas tunggu pendaftaran. Tulis Firestore yang offline tidak pernah gagal, hanya menggantung. */
const BATAS_DAFTAR_MS = 30_000
/** Wilayah Cloud Function `hapusAkunAuth`. Harus sama dengan `region` di functions/index.js. */
const REGION_FUNGSI = 'asia-southeast2'

export interface AkunStaf extends AppUser {
  /** Terisi bila `role` di Firestore bukan salah satu peran yang dikenal. */
  roleRusak?: string
}

export function pesanGalatAuth(err: unknown): string {
  const code = err && typeof err === 'object' && 'code' in err ? String((err as { code: unknown }).code) : ''
  if (code === 'auth/email-already-in-use') {
    return 'Email ini sudah terdaftar di Firebase Auth. Jika tidak ada di daftar, profilnya belum tertulis — jangan buat ulang dengan email yang sama.'
  }
  if (code === 'auth/invalid-email') return 'Format email ditolak Firebase.'
  if (code === 'auth/weak-password') return 'Password terlalu lemah. Gunakan minimal 8 karakter.'
  if (code === 'auth/operation-not-allowed') {
    return 'Login email/password belum diaktifkan di Firebase Authentication.'
  }
  if (code === 'auth/too-many-requests') return 'Terlalu banyak percobaan. Coba lagi nanti.'
  if (code === 'functions/internal' || code === 'functions/unavailable') {
    return 'Cloud Function hapus akun tidak dapat dijangkau. Pastikan sudah di-deploy (npm run deploy:functions) dan koneksi stabil.'
  }
  if (err instanceof Error && err.message) return err.message
  return 'Gagal menyimpan akun.'
}

function sebagaiStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return []
  return v.filter((x): x is string => typeof x === 'string' && x.trim() !== '')
}

function sebagaiPenugasan(v: unknown): { kelas: string; mapel: string }[] {
  if (!Array.isArray(v)) return []
  return v.flatMap((item) => {
    if (!item || typeof item !== 'object') return []
    const kelas = 'kelas' in item ? String((item as { kelas: unknown }).kelas ?? '') : ''
    const mapel = 'mapel' in item ? String((item as { mapel: unknown }).mapel ?? '') : ''
    return kelas && mapel ? [{ kelas, mapel }] : []
  })
}

function keIso(v: unknown): string | undefined {
  if (typeof v === 'string' && v) return v
  if (v instanceof Date) return v.toISOString()
  if (v && typeof v === 'object' && 'toDate' in v && typeof (v as { toDate: unknown }).toDate === 'function') {
    return (v as { toDate: () => Date }).toDate().toISOString()
  }
  if (v && typeof v === 'object' && typeof (v as { seconds?: unknown }).seconds === 'number') {
    return new Date((v as { seconds: number }).seconds * 1000).toISOString()
  }
  return undefined
}

function dariDokumen(uid: string, data: DocumentData): AkunStaf | null {
  if (data.role === 'orangtua') return null
  const roleRusak = adalahRole(data.role) ? undefined : String(data.role ?? '')
  const role: UserRole = adalahRole(data.role) ? data.role : 'guru'
  return {
    uid,
    email: typeof data.email === 'string' ? data.email : '',
    nama: typeof data.nama === 'string' && data.nama ? data.nama : '(tanpa nama)',
    gelar: typeof data.gelar === 'string' ? data.gelar : undefined,
    role,
    roleRusak,
    kelasAmpu: sebagaiStringArray(data.kelasAmpu),
    penugasan: sebagaiPenugasan(data.penugasan),
    waliKelas: sebagaiStringArray(data.waliKelas),
    penugasanKelas: sebagaiStringArray(data.penugasanKelas),
    penugasanKelasMapel: sebagaiStringArray(data.penugasanKelasMapel),
    aktif: typeof data.aktif === 'boolean' ? data.aktif : undefined,
    status: typeof data.status === 'string' ? data.status as any : undefined,
    createdAt: keIso(data.createdAt),
    updatedAt: keIso(data.updatedAt),
  }
}

export async function listAkunStaf(): Promise<AkunStaf[]> {
  const snap = await getDocs(collection(db, 'users'))
  return snap.docs
    .map((d) => dariDokumen(d.id, d.data()))
    .filter((u): u is AkunStaf => u !== null)
    .sort((a, b) => a.nama.localeCompare(b.nama, 'id'))
}

export async function simpanAkunGuru(uid: string, input: InputAkunGuru, createdAt?: string): Promise<void> {
  const dokumen = susunDokumenAkun(input, new Date().toISOString(), createdAt)
  await setDoc(doc(db, 'users', uid), dokumen, { merge: true })
}

/**
 * Buat user Firebase Auth lewat app sekunder (persistence memori), lalu tulis profil.
 * App utama tidak dipakai untuk `createUser` — itu akan mengganti sesi admin yang sedang login.
 */
export async function buatAkunGuru(input: InputAkunGuru, password: string): Promise<void> {
  const email = input.email.trim().toLowerCase()
  const lama = getApps().find((a) => a.name === NAMA_APP_SEKUNDER)
  if (lama) await deleteApp(lama)
  const sekunder = initializeApp(firebaseConfig, NAMA_APP_SEKUNDER)
  const authSekunder = getAuth(sekunder)
  let uid: string | null = null
  try {
    await setPersistence(authSekunder, inMemoryPersistence)
    const cred = await createUserWithEmailAndPassword(authSekunder, email, password)
    uid = cred.user.uid
    await signOut(authSekunder)
    await simpanAkunGuru(uid, { ...input, email }, new Date().toISOString())
  } catch (err) {
    if (uid) {
      const detail = err instanceof Error ? err.message : 'profil gagal ditulis'
      throw new Error(
        `Login Firebase sudah terbuat (UID ${uid}), tetapi profil gagal disimpan. Jangan daftar ulang email yang sama. ${detail}`,
      )
    }
    throw err
  } finally {
    await deleteApp(sekunder)
  }
}

export async function setAkunAktif(uid: string, aktif: boolean): Promise<void> {
  await setDoc(doc(db, 'users', uid), { aktif, updatedAt: new Date().toISOString() }, { merge: true })
}

export async function setStatusAkun(uid: string, status: 'pending' | 'approved' | 'rejected'): Promise<void> {
  await setDoc(doc(db, 'users', uid), { status, updatedAt: new Date().toISOString() }, { merge: true })
}

export async function kirimResetPassword(email: string): Promise<void> {
  await sendPasswordResetEmail(auth, email.trim().toLowerCase())
}

export interface HasilHapusAkun {
  /** true = user Firebase Authentication ikut terhapus (atau memang sudah tidak ada). */
  authDihapus: boolean
}

/**
 * Hapus akun staf sepenuhnya lewat Cloud Function `hapusAkunAuth` (Admin SDK): user Firebase
 * Authentication dan dokumen `users/{uid}`. SDK web tidak bisa menghapus user lain, karena itu lewat fungsi.
 * Aturan (hanya admin aktif, bukan diri sendiri, bukan admin terakhir) dijaga di fungsi, bukan di UI.
 *
 * Bila fungsi belum di-deploy (`functions/not-found`), jatuh kembali ke cara lama: hanya profil Firestore
 * yang dihapus dan `authDihapus` = false, supaya UI menampilkan petunjuk hapus manual di Console.
 * Galat lain dilempar apa adanya (jangan menghapus profil diam-diam saat fungsi gagal di tengah jalan).
 */
export async function hapusAkunStaf(uid: string): Promise<HasilHapusAkun> {
  try {
    const panggil = httpsCallable<{ uid: string }, { authDihapus: boolean; authSudahTidakAda: boolean }>(
      getFunctions(app, REGION_FUNGSI),
      'hapusAkunAuth',
    )
    await panggil({ uid })
    return { authDihapus: true }
  } catch (err) {
    if (kodeGalat(err) !== 'functions/not-found') throw err
    await deleteDoc(doc(db, 'users', uid))
    return { authDihapus: false }
  }
}


/** Kode galat Firebase (`auth/...`, `permission-denied`, dst.), atau string kosong. */
export function kodeGalat(err: unknown): string {
  return err && typeof err === 'object' && 'code' in err ? String((err as { code: unknown }).code) : ''
}

function batasWaktu<T>(janji: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((selesai, gagal) => {
    const timer = setTimeout(() => {
      gagal(Object.assign(new Error('Waktu tunggu habis. Periksa jaringan lalu coba lagi.'), { code: 'sdm/timeout' }))
    }, ms)
    janji.then(
      (v) => {
        clearTimeout(timer)
        selesai(v)
      },
      (e) => {
        clearTimeout(timer)
        gagal(e)
      },
    )
  })
}

export type HasilDaftar = 'dibuat' | 'dipulihkan'

/**
 * Pendaftaran mandiri guru dari halaman /register.
 *
 * Seluruhnya berjalan di app Firebase SEKUNDER (persistence memori), tidak menyentuh `auth` utama.
 * Kalau memakai `auth` utama, `onAuthStateChanged` di App.tsx langsung melihat "user ada, profil belum ada"
 * lalu memanggil `logout()` di tengah penulisan profil (ANTIREGRESI §15.1).
 *
 * - Email belum ada di Auth: buat user, tulis profil `pending`. Hasil `dibuat`.
 * - Email sudah ada di Auth tetapi profil `users/{uid}` tidak ada (profil dihapus admin; user Auth tersisa):
 *   masuk dengan password yang diketik, tulis ulang profil `pending`. Hasil `dipulihkan`.
 *   Kalau passwordnya salah, galat `auth/invalid-credential` dilempar apa adanya agar UI menawarkan atur ulang password.
 * - Email sudah ada dan profilnya masih ada: galat `sdm/profil-sudah-ada`.
 */
export async function daftarMandiriGuru(
  email: string,
  password: string,
  profil: Record<string, unknown>,
): Promise<HasilDaftar> {
  const lama = getApps().find((a) => a.name === NAMA_APP_DAFTAR)
  if (lama) await deleteApp(lama)
  const sekunder = initializeApp(firebaseConfig, NAMA_APP_DAFTAR)

  async function jalankan(): Promise<HasilDaftar> {
    const authSekunder = getAuth(sekunder)
    await setPersistence(authSekunder, inMemoryPersistence)
    const dbSekunder = getFirestore(sekunder)

    let uid: string
    let hasil: HasilDaftar = 'dibuat'
    try {
      const cred = await createUserWithEmailAndPassword(authSekunder, email, password)
      uid = cred.user.uid
    } catch (err) {
      if (kodeGalat(err) !== 'auth/email-already-in-use') throw err
      const cred = await signInWithEmailAndPassword(authSekunder, email, password)
      uid = cred.user.uid
      hasil = 'dipulihkan'
      const snap = await getDoc(doc(dbSekunder, 'users', uid))
      if (snap.exists()) {
        throw Object.assign(
          new Error('Email ini sudah terdaftar dan profilnya masih ada. Masuk lewat halaman login, atau hubungi admin.'),
          { code: 'sdm/profil-sudah-ada' },
        )
      }
    }
    await setDoc(doc(dbSekunder, 'users', uid), profil)
    await signOut(authSekunder)
    return hasil
  }

  try {
    return await batasWaktu(jalankan(), BATAS_DAFTAR_MS)
  } finally {
    await deleteApp(sekunder).catch(() => undefined)
  }
}
