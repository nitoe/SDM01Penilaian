import { collection, doc, getCountFromServer, getDoc, query, where } from 'firebase/firestore'
import { db } from './firebase'
import { SEMUA_KELAS } from '../types/tahsin'

export interface DashboardStats {
  /** Seluruh siswa terdaftar (aktif + nonaktif) */
  total: number
  nonaktif: number
  perKelas: { kelas: string; jumlah: number }[]
}

/**
 * Hitung siswa lewat count aggregation (tanpa mengunduh dokumen).
 * 15 query per kelas + 1 query nonaktif. Butuh hak `list` pada `siswa` (semua guru).
 */
export async function loadDashboardStats(): Promise<DashboardStats> {
  const col = collection(db, 'siswa')
  const [perKelas, nonaktifSnap] = await Promise.all([
    Promise.all(
      SEMUA_KELAS.map(async (kelas) => {
        const snap = await getCountFromServer(query(col, where('kelas', '==', kelas)))
        return { kelas: kelas as string, jumlah: snap.data().count }
      }),
    ),
    getCountFromServer(query(col, where('aktif', '==', false))),
  ])

  return {
    total: perKelas.reduce((n, k) => n + k.jumlah, 0),
    nonaktif: nonaktifSnap.data().count,
    perKelas,
  }
}

export interface AkademikConfig {
  /** Contoh: "2026/2027" */
  tahunAjaran: string
  /** "1" (ganjil) atau "2" (genap) */
  semesterAktif: string
}

/** Dokumen `config/akademik` (satu dokumen untuk seluruh sekolah). Null bila belum diatur. */
export async function loadAkademikConfig(): Promise<AkademikConfig | null> {
  const snap = await getDoc(doc(db, 'config', 'akademik'))
  if (!snap.exists()) return null
  const d = snap.data()
  if (!d.tahunAjaran || !d.semesterAktif) return null
  return { tahunAjaran: String(d.tahunAjaran), semesterAktif: String(d.semesterAktif) }
}
