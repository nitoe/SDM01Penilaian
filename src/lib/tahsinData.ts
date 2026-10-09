import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore'
import { auth, db } from './firebase'
import type {
  AuthScope,
  MenulisRecord,
  SetoranPayload,
  SetoranRecord,
  SiswaTahsin,
} from '../types/tahsin'
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

/** Riwayat setoran satu siswa (terbaru dulu). Filter kelas wajib. */
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
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as SetoranRecord)
  } catch {
    // Fallback jika index belum ada
    const q = query(
      collection(db, 'setoran'),
      where('siswaId', '==', siswaId),
      where('kelas', '==', kelas),
    )
    const snap = await getDocs(q)
    const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as SetoranRecord)
    return list.sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt))
  }
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
