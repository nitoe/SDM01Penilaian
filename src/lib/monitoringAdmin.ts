import { collection, getCountFromServer, getDocs, query, where } from 'firebase/firestore'
import { db } from './firebase'
import { getMapelList } from './akademik'
import { listAkunStaf } from './akunGuruData'
import { ekuivalenMapel, aliasNamaMapel } from './tpImport'
import { SEMUA_KELAS } from '../types/tahsin'
import type { TujuanPembelajaran } from '../types/akademik'
import {
  akunDipantau,
  hitungPasangan,
  keGuruPantau,
  ringkasPerGuru,
  ringkasRaporPerKelas,
  type RingkasRaporKelas,
  ringkasTahsin,
  ringkasTp,
  statusNilai,
  type BarisPasangan,
  type GuruPantau,
  type RingkasGuru,
  type RingkasTahsinGuru,
} from './monitoringAdminRumus'

/**
 * Pemuat data dashboard admin (Tahap 2). HANYA MEMBACA (ANTIREGRESI §17.6).
 * - Satu pembacaan `tp_kktp` (admin boleh list), dikelompokkan per mapel×kelas di memori.
 * - Nilai: getCountFromServer per mapel×kelas (query selalu memuat mapel DAN kelas, §7.3).
 * - Setoran Tahsin: getCountFromServer per guru (createdBy + periode), admin boleh baca (lihatKelas).
 */

export interface PantauanAdmin {
  periode: { tahunAjaran: string; semester: '1' | '2' }
  dimuatPada: Date
  guru: GuruPantau[]
  perGuru: RingkasGuru[]
  tanpaPenanggung: BarisPasangan[]
  /** Semua pasangan mapel×kelas beserta status (dipakai grafik per kelas) */
  semuaPasangan: BarisPasangan[]
  tahsin: RingkasTahsinGuru[]
  /** Kelengkapan data Rapor SAS per kelas (absensi, kokurikuler, keputusan, ekskul) */
  rapor: RingkasRaporKelas[]
  /** Akun guru yang masih menunggu persetujuan (tidak ikut hitungan) */
  menunggu: number
  /** Catatan bila sebagian data gagal dimuat */
  peringatan: string[]
}

async function paralel<T, R>(items: T[], batas: number, fn: (x: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length)
  let i = 0
  async function kerja() {
    while (i < items.length) {
      const idx = i++
      out[idx] = await fn(items[idx])
    }
  }
  await Promise.all(Array.from({ length: Math.min(batas, items.length) }, kerja))
  return out
}

export async function muatPantauanAdmin(periode: {
  tahunAjaran: string
  semester: '1' | '2'
}): Promise<PantauanAdmin> {
  const peringatan: string[] = []
  const [akun, mapel] = await Promise.all([listAkunStaf(), getMapelList()])
  const guruAktif = akun.filter(akunDipantau).map(keGuruPantau)
  const menunggu = akun.filter(
    (u) => u.role !== 'orangtua' && u.role !== 'admin' && u.aktif !== false && u.status === 'pending',
  ).length

  // TP: satu kali baca, kelompokkan per mapel×kelas (nama mapel dinormalisasi lewat alias).
  const tpSnap = await getDocs(collection(db, 'tp_kktp'))
  const semuaTp = tpSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as TujuanPembelajaran)
  const tpPasangan = (nama: string, kelas: string) =>
    semuaTp.filter((t) => String(t.kelas).toUpperCase() === kelas && ekuivalenMapel(t.mapel, nama))

  const pasangan = hitungPasangan(guruAktif, mapel, ekuivalenMapel, SEMUA_KELAS)

  // Siswa aktif per kelas
  const aktifPerKelas: Record<string, number> = {}
  await paralel([...SEMUA_KELAS], 8, async (kelas) => {
    try {
      const s = await getCountFromServer(
        query(collection(db, 'siswa'), where('kelas', '==', kelas), where('aktif', '==', true)),
      )
      aktifPerKelas[kelas] = s.data().count
    } catch {
      aktifPerKelas[kelas] = 0
      if (!peringatan.includes('Jumlah siswa aktif sebagian kelas gagal dimuat.'))
        peringatan.push('Jumlah siswa aktif sebagian kelas gagal dimuat.')
    }
  })

  const baris: BarisPasangan[] = await paralel(pasangan, 10, async (p) => {
    const tps = tpPasangan(p.mapel, p.kelas)
    const tp = ringkasTp(tps, periode.semester)
    const tpSem = tps.filter((t) => ringkasTp([t], periode.semester).dialokasi > 0).length
    let terisi = 0
    if (tpSem > 0 && p.penanggung.length > 0) {
      try {
        const nama = aliasNamaMapel(p.mapel)
        const hitung = await Promise.all(
          nama.map((n) =>
            getCountFromServer(
              query(
                collection(db, 'nilai_tp'),
                where('mapel', '==', n),
                where('kelas', '==', p.kelas),
                where('semester', '==', periode.semester),
                where('tahunAjaran', '==', periode.tahunAjaran),
              ),
            ),
          ),
        )
        terisi = hitung.reduce((n, h) => n + h.data().count, 0)
      } catch {
        if (!peringatan.includes('Sebagian hitungan nilai gagal dimuat (cek indeks Firestore).'))
          peringatan.push('Sebagian hitungan nilai gagal dimuat (cek indeks Firestore).')
      }
    }
    const diharapkan = tpSem * (aktifPerKelas[p.kelas] ?? 0)
    return { ...p, tp, terisi, diharapkan, nilai: statusNilai(tpSem, aktifPerKelas[p.kelas] ?? 0, terisi) }
  })

  const { perGuru, tanpaPenanggung } = ringkasPerGuru(guruAktif, baris)

  // Setoran Tahsin per guru pada periode aktif
  const setoranPerUid: Record<string, number> = {}
  const guruTahsin = guruAktif.filter((g) => ringkasTahsin([g], {}).length > 0)
  await paralel(guruTahsin, 6, async (g) => {
    try {
      const s = await getCountFromServer(
        query(
          collection(db, 'setoran'),
          where('createdBy', '==', g.uid),
          where('tahunAjaran', '==', periode.tahunAjaran),
          where('semester', '==', periode.semester),
        ),
      )
      setoranPerUid[g.uid] = s.data().count
    } catch {
      setoranPerUid[g.uid] = 0
      if (!peringatan.includes('Hitungan setoran Tahsin gagal dimuat.')) peringatan.push('Hitungan setoran Tahsin gagal dimuat.')
    }
  })

  // Data pelengkap rapor: 3 query tingkat periode (admin boleh list), bukan per kelas.
  const perPeriode = [where('semester', '==', periode.semester), where('tahunAjaran', '==', periode.tahunAjaran)]
  const bacaDok = async <T,>(koleksi: string, nama: string): Promise<T[]> => {
    try {
      const s = await getDocs(query(collection(db, koleksi), ...perPeriode))
      return s.docs.map((d) => d.data() as T)
    } catch {
      peringatan.push(`Data ${nama} gagal dimuat (cek rules terbaru).`)
      return []
    }
  }
  const [dokAbsensi, dokKokur, dokEkskul] = await Promise.all([
    bacaDok<{ siswaId: string; kelas: string; catatanWali?: string; keputusan?: string }>('absensi_rapor', 'ketidakhadiran'),
    bacaDok<{ siswaId: string; kelas: string; deskripsi?: string }>('kokurikuler_rapor', 'kokurikuler'),
    bacaDok<{ siswaId: string; kelas: string; level?: number }>('ekstrakurikuler_siswa', 'ekstrakurikuler'),
  ])
  const rapor = ringkasRaporPerKelas(aktifPerKelas, guruAktif, dokAbsensi, dokKokur, dokEkskul, periode.semester)

  return {
    periode,
    dimuatPada: new Date(),
    guru: guruAktif,
    perGuru,
    tanpaPenanggung,
    semuaPasangan: baris,
    tahsin: ringkasTahsin(guruAktif, setoranPerUid),
    rapor,
    menunggu,
    peringatan,
  }
}
