import { collection, getCountFromServer, query, where } from 'firebase/firestore'
import { db } from './firebase'
import { SEMUA_KELAS } from '../types/tahsin'

export interface DashboardStats {
  /** Seluruh siswa terdaftar (aktif + nonaktif) */
  total: number
  /** Siswa kelas 1–2 (jenjang Iqro, sama dengan inferJenjang) */
  iqro: number
  /** Siswa kelas 3–6 (jenjang Al-Qur'an) */
  quran: number
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

  const total = perKelas.reduce((n, k) => n + k.jumlah, 0)
  const iqro = perKelas
    .filter((k) => parseInt(k.kelas, 10) <= 2)
    .reduce((n, k) => n + k.jumlah, 0)

  return {
    total,
    iqro,
    quran: total - iqro,
    nonaktif: nonaktifSnap.data().count,
    perKelas,
  }
}
