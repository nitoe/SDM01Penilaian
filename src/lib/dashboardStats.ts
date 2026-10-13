import { collection, doc, getCountFromServer, getDoc, getDocs, query, where } from 'firebase/firestore'
import { db } from './firebase'
import { getMapelList, getTPList } from './akademik'
import { aksesMapelTingkatan } from './aksesAkademik'
import { SEMUA_KELAS } from '../types/tahsin'
import type { AppUser } from '../types/user'

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

/** Ringkasan progres akademik untuk guru (Setup TP + bobot). */
export interface GuruAkademikProgress {
  /** Jumlah kombinasi mapel × tingkatan yang diampu */
  totalKombinasi: number
  /** Sudah punya ≥1 TP */
  sudahAdaTp: number
  /** Belum ada TP sama sekali */
  belumAdaTp: number
  /** Total TP di semua kombinasi */
  totalTp: number
  /** TP yang belum diatur semester & bobot mapel */
  tpTanpaBobot: number
}

/**
 * Hitung progres Setup TP / bobot untuk akun guru akademik.
 * Query paralel per kombinasi mapel×tingkatan (biasanya kecil: 5–20).
 */
export async function loadGuruAkademikProgress(profile: AppUser): Promise<GuruAkademikProgress> {
  const mapel = await getMapelList()
  const pilihan = aksesMapelTingkatan(profile, mapel)
  if (pilihan.length === 0) {
    return { totalKombinasi: 0, sudahAdaTp: 0, belumAdaTp: 0, totalTp: 0, tpTanpaBobot: 0 }
  }

  const hasil = await Promise.all(
    pilihan.map(async (p) => {
      try {
        const daftar = await getTPList(p.mapel, p.tingkatan)
        return {
          n: daftar.length,
          tanpaBobot: daftar.filter((t) => !t.semester).length,
        }
      } catch {
        return { n: 0, tanpaBobot: 0 }
      }
    }),
  )

  let sudahAdaTp = 0
  let totalTp = 0
  let tpTanpaBobot = 0
  for (const h of hasil) {
    if (h.n > 0) sudahAdaTp += 1
    totalTp += h.n
    tpTanpaBobot += h.tanpaBobot
  }

  return {
    totalKombinasi: pilihan.length,
    sudahAdaTp,
    belumAdaTp: pilihan.length - sudahAdaTp,
    totalTp,
    tpTanpaBobot,
  }
}

/** Jumlah siswa aktif di daftar kelas (count aggregation). */
export async function loadSiswaCountKelas(kelasList: string[]): Promise<number> {
  if (kelasList.length === 0) return 0
  const col = collection(db, 'siswa')
  const counts = await Promise.all(
    kelasList.map(async (kelas) => {
      const snap = await getCountFromServer(
        query(col, where('kelas', '==', kelas), where('aktif', '==', true)),
      )
      return snap.data().count
    }),
  )
  return counts.reduce((a, b) => a + b, 0)
}

/** Jumlah setoran tahsin 7 hari terakhir untuk kelas ampu. Gagal → 0. */
export async function loadSetoranMingguIni(kelasAmpu: string[]): Promise<number> {
  if (kelasAmpu.length === 0) return 0
  try {
    const sejak = new Date()
    sejak.setDate(sejak.getDate() - 7)
    const iso = sejak.toISOString().slice(0, 10)
    let total = 0
    for (const kelas of kelasAmpu.slice(0, 6)) {
      const q = query(
        collection(db, 'setoran'),
        where('kelas', '==', kelas),
        where('tanggal', '>=', iso),
      )
      const snap = await getDocs(q)
      total += snap.size
    }
    return total
  } catch {
    return 0
  }
}
