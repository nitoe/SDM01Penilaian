import type { AbsensiRapor, EkskulSiswa, KeputusanKenaikan } from '../types/raporData.ts'
import { BATAS_CATATAN, BATAS_HARI, KEPUTUSAN_OPSI } from '../types/raporData.ts'

// Rumus murni data pelengkap rapor SAS (tanpa Firebase, bisa diuji): ANTIREGRESI §23.

export const slugEkskul = (nama: string): string =>
  nama
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

/** ID dokumen deterministik agar simpan = upsert tanpa query tambahan. */
export const idPeriode = (tahunAjaran: string, semester: string) => `${tahunAjaran.replace(/\//g, '-')}-${semester}`
export const idAbsensi = (siswaId: string, tahunAjaran: string, semester: string) =>
  `${siswaId}_${idPeriode(tahunAjaran, semester)}`
export const idEkskulSiswa = (siswaId: string, ekskulId: string, tahunAjaran: string, semester: string) =>
  `${siswaId}__${ekskulId}__${idPeriode(tahunAjaran, semester)}`

const hari = (n: unknown): number => {
  const x = Math.floor(Number(n))
  return Number.isFinite(x) ? Math.min(BATAS_HARI, Math.max(0, x)) : 0
}

/** Bersihkan isian absensi dari formulir (angka bulat 0..366, teks dipangkas, keputusan valid). */
export function bersihkanAbsensi(a: Partial<AbsensiRapor> & Pick<AbsensiRapor, 'siswaId' | 'kelas' | 'semester' | 'tahunAjaran'>): AbsensiRapor {
  const keputusan = (KEPUTUSAN_OPSI as readonly string[]).includes(String(a.keputusan))
    ? (a.keputusan as KeputusanKenaikan)
    : 'Belum diputuskan'
  return {
    siswaId: a.siswaId,
    kelas: a.kelas,
    semester: a.semester,
    tahunAjaran: a.tahunAjaran,
    sakit: hari(a.sakit),
    izin: hari(a.izin),
    tanpaKeterangan: hari(a.tanpaKeterangan),
    catatanWali: String(a.catatanWali ?? '').trim().slice(0, BATAS_CATATAN),
    keputusan,
  }
}

/** Keputusan untuk rapor: null = belum diputuskan (kotak dicetak tanpa coretan, dicoret tangan). */
export function keputusanRapor(k: KeputusanKenaikan | undefined): 'Naik' | 'Tinggal' | null {
  if (k === 'Naik Kelas') return 'Naik'
  if (k === 'Tinggal Kelas') return 'Tinggal'
  return null
}

/** Ekskul yang tampil di rapor: level 1–3 saja, urut nama. Level 4 (tidak ikut) disaring. */
export function ekskulUntukRapor(daftar: Pick<EkskulSiswa, 'nama' | 'level' | 'deskripsi'>[]) {
  return daftar
    .filter((e) => e.level >= 1 && e.level <= 3)
    .sort((a, b) => a.nama.localeCompare(b.nama, 'id'))
}
