import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore'
import { auth, db } from './firebase'
import type {
  AuthScope,
  JenisSetoran,
  MenulisRecord,
  SetoranPayload,
  SetoranRecord,
  SiswaTahsin,
  StatusHafalan,
} from '../types/tahsin'
import { recordSetoran } from './bacaTandai'
import type { TargetHafalan } from './target'
import { SEMUA_KELAS } from '../types/tahsin'

export async function getSiswaList(
  kelasFilter: string | null,
  scope: AuthScope,
): Promise<SiswaTahsin[]> {
  const allowedKelas = kelasFilter
    ? [kelasFilter]
    : scope.role === 'admin'
      ? [...SEMUA_KELAS]
      : scope.kelasAmpu || []

  if (!allowedKelas.length) return []

  const q = query(
    collection(db, 'siswa'),
    where('kelas', 'in', allowedKelas),
    where('aktif', '==', true),
  )
  const snap = await getDocs(q)
  const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as SiswaTahsin)
  return list.sort((a, b) => a.nama.localeCompare(b.nama, 'id'))
}

export async function getSiswaById(id: string): Promise<SiswaTahsin | null> {
  const snap = await getDoc(doc(db, 'siswa', id))
  if (!snap.exists()) return null
  return { id: snap.id, ...snap.data() } as SiswaTahsin
}

export async function saveSetoran(payload: SetoranPayload) {
  const docRef = await addDoc(collection(db, 'setoran'), {
    ...payload,
    createdBy: auth.currentUser?.uid || null,
    createdAt: serverTimestamp(),
  })
  return { id: docRef.id, ...payload }
}

export async function updateTamatIqro(siswaId: string, value: boolean) {
  await updateDoc(doc(db, 'siswa', siswaId), { tamatIqro: value })
}

/** Riwayat setoran satu siswa (terbaru dulu). Filter kelas wajib. Istilah status data lama disamakan (recordSetoran). */
export async function getRiwayatSetoran(
  siswaId: string,
  kelas: string,
): Promise<SetoranRecord[]> {
  try {
    const q = query(
      collection(db, 'setoran'),
      where('siswaId', '==', siswaId),
      where('kelas', '==', kelas),
      orderBy('createdAt', 'desc'),
    )
    const snap = await getDocs(q)
    return snap.docs.map((d) => recordSetoran(d.id, d.data()))
  } catch {
    // Fallback jika index belum ada
    const q = query(
      collection(db, 'setoran'),
      where('siswaId', '==', siswaId),
      where('kelas', '==', kelas),
    )
    const snap = await getDocs(q)
    const list = snap.docs.map((d) => recordSetoran(d.id, d.data()))
    return list.sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt))
  }
}

/**
 * Ubah field sederhana satu setoran: jenis, status hafalan, catatan. Materi dan Baca & Tandai SENGAJA tidak
 * bisa diubah (hapus lalu input ulang) agar riwayat konsisten. Rules hanya mengizinkan pembuatnya (v2 §5).
 */
export async function updateSetoranFields(
  id: string,
  patch: { jenis: JenisSetoran; statusHafalan: StatusHafalan | null; catatan: string },
) {
  await updateDoc(doc(db, 'setoran', id), patch)
}

/** Hapus satu setoran. Rules: pembuatnya sendiri atau admin. */
export async function deleteSetoran(id: string) {
  await deleteDoc(doc(db, 'setoran', id))
}

/** Target hafalan satu kelas; null bila belum diatur. */
export async function getTargetHafalan(kelas: string): Promise<TargetHafalan | null> {
  const snap = await getDoc(doc(db, 'target_hafalan', kelas))
  return snap.exists() ? ({ ...snap.data(), kelas } as TargetHafalan) : null
}

/** Simpan (timpa) target satu kelas. ID dokumen = kode kelas. Rules: admin atau guru yang mengampu kelas itu. */
export async function saveTargetHafalan(kelas: string, data: Omit<TargetHafalan, 'kelas'>) {
  await setDoc(doc(db, 'target_hafalan', kelas), {
    ...data,
    kelas,
    updatedBy: auth.currentUser?.uid || null,
    updatedAt: serverTimestamp(),
  })
}

export async function getMenulisLog(
  siswaId: string,
  kelas: string,
): Promise<MenulisRecord[]> {
  try {
    const q = query(
      collection(db, 'menulis_log'),
      where('siswaId', '==', siswaId),
      where('kelas', '==', kelas),
      orderBy('createdAt', 'desc'),
    )
    const snap = await getDocs(q)
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as MenulisRecord)
  } catch {
    const q = query(
      collection(db, 'menulis_log'),
      where('siswaId', '==', siswaId),
      where('kelas', '==', kelas),
    )
    const snap = await getDocs(q)
    const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as MenulisRecord)
    return list.sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt))
  }
}

export function toMillis(
  value: { seconds: number; nanoseconds?: number } | string | Date | null | undefined,
): number {
  if (!value) return 0
  if (value instanceof Date) return value.getTime()
  if (typeof value === 'string') return new Date(value).getTime() || 0
  if (typeof value === 'object' && 'seconds' in value) return value.seconds * 1000
  return 0
}

export function formatTanggal(
  value: { seconds: number; nanoseconds?: number } | string | Date | null | undefined,
): string {
  const ms = toMillis(value)
  if (!ms) return '—'
  return new Date(ms).toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}
