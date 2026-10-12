import { deleteApp, getApps, initializeApp } from 'firebase/app'
import {
  createUserWithEmailAndPassword,
  getAuth,
  inMemoryPersistence,
  sendPasswordResetEmail,
  setPersistence,
  signOut,
} from 'firebase/auth'
import { collection, doc, getDocs, setDoc, type DocumentData } from 'firebase/firestore'
import { adalahRole, susunDokumenAkun, type InputAkunGuru } from './akunGuru'
import { auth, db, firebaseConfig } from './firebase'
import type { AppUser, UserRole } from '../types/user'

/** Nama app sekunder. Auth-nya in-memory supaya sesi admin di app utama tidak terganti. */
const NAMA_APP_SEKUNDER = 'sdm-buat-akun'

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

export async function kirimResetPassword(email: string): Promise<void> {
  await sendPasswordResetEmail(auth, email.trim().toLowerCase())
}
