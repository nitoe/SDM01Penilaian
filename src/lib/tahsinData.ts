import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore'
import { db } from './firebase'
import type { AuthScope, SetoranPayload, SiswaTahsin } from '../types/tahsin'
import { SEMUA_KELAS } from '../types/tahsin'

/**
 * Ambil daftar siswa aktif.
 * Filter `kelas` wajib ada di query (aturan Firestore + scope guru).
 */
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

  // Firestore `in` max 30 — SEMUA_KELAS = 15, aman
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

/** Simpan satu sesi setoran ke koleksi `setoran` */
export async function saveSetoran(payload: SetoranPayload) {
  const docRef = await addDoc(collection(db, 'setoran'), {
    ...payload,
    createdAt: serverTimestamp(),
  })
  return { id: docRef.id, ...payload }
}

/** Tandai siswa Iqro sudah / belum tamat Iqro */
export async function updateTamatIqro(siswaId: string, value: boolean) {
  await updateDoc(doc(db, 'siswa', siswaId), { tamatIqro: value })
}
