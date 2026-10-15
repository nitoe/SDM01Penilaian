import type { JenisNotifikasi, Notifikasi, StatusNotifikasi, MutasiSiswa } from '../types/notifikasi.ts'
import { BATAS_ISI, BATAS_JUDUL } from '../types/notifikasi.ts'

// Logika murni notifikasi (tanpa Firebase) agar bisa diuji:
// node --experimental-strip-types scripts/cek-notifikasi.mjs

export interface MasukanLaporan {
  jenis: JenisNotifikasi
  judul: string
  isi: string
  kelas?: string
  mutasi?: Partial<MutasiSiswa>
}

const TANGGAL = /^\d{4}-\d{2}-\d{2}$/

/** Daftar pesan kesalahan; kosong = valid. Cermin dari rules `notifikasi` (ANTIREGRESI §19). */
export function validasiLaporan(m: MasukanLaporan): string[] {
  const salah: string[] = []
  const judul = m.judul.trim()
  const isi = m.isi.trim()
  if (!judul) salah.push('Judul wajib diisi.')
  if (judul.length > BATAS_JUDUL) salah.push(`Judul maksimal ${BATAS_JUDUL} karakter.`)
  if (!isi) salah.push('Isi laporan wajib diisi.')
  if (isi.length > BATAS_ISI) salah.push(`Isi maksimal ${BATAS_ISI} karakter.`)
  if (m.jenis === 'mutasi_siswa') {
    const mu = m.mutasi
    if (!mu?.arah) salah.push('Pilih siswa masuk atau keluar.')
    if (!mu?.namaSiswa?.trim()) salah.push('Nama siswa wajib diisi.')
    if (!mu?.tanggal || !TANGGAL.test(mu.tanggal)) salah.push('Tanggal mutasi wajib diisi.')
  } else if (m.mutasi) {
    salah.push('Data mutasi hanya untuk laporan mutasi siswa.')
  }
  return salah
}

/** Bentuk dokumen yang ditulis ke Firestore (tanpa field kosong; rules memakai hasOnly). */
export function susunDokumen(m: MasukanLaporan, dari: { uid: string; nama: string }) {
  const dok: Record<string, unknown> = {
    jenis: m.jenis,
    judul: m.judul.trim(),
    isi: m.isi.trim(),
    status: 'baru' as StatusNotifikasi,
    dariUid: dari.uid,
    dariNama: dari.nama,
  }
  if (m.kelas) dok.kelas = m.kelas
  if (m.jenis === 'mutasi_siswa' && m.mutasi) {
    const mu: Record<string, unknown> = {
      arah: m.mutasi.arah,
      namaSiswa: m.mutasi.namaSiswa?.trim(),
      tanggal: m.mutasi.tanggal,
    }
    if (m.mutasi.keterangan?.trim()) mu.keterangan = m.mutasi.keterangan.trim()
    dok.mutasi = mu
  }
  return dok
}

export type SaringJenis = JenisNotifikasi | 'semua'
export type SaringStatus = StatusNotifikasi | 'aktif' | 'semua'

/** 'aktif' = baru + diproses (belum selesai). */
export function saringInbox(
  daftar: Notifikasi[],
  jenis: SaringJenis,
  status: SaringStatus,
): Notifikasi[] {
  return daftar.filter((n) => {
    if (jenis !== 'semua' && n.jenis !== jenis) return false
    if (status === 'semua') return true
    if (status === 'aktif') return n.status !== 'selesai'
    return n.status === status
  })
}

export function hitungPerJenis(daftar: Notifikasi[]): Record<SaringJenis, number> {
  const baru = daftar.filter((n) => n.status === 'baru')
  return {
    semua: baru.length,
    laporan_tugas: baru.filter((n) => n.jenis === 'laporan_tugas').length,
    laporan_kendala: baru.filter((n) => n.jenis === 'laporan_kendala').length,
    mutasi_siswa: baru.filter((n) => n.jenis === 'mutasi_siswa').length,
  }
}

/** Urutan status yang boleh dipilih admin dari status sekarang. */
export function statusBerikut(s: StatusNotifikasi): StatusNotifikasi[] {
  if (s === 'baru') return ['diproses', 'selesai']
  if (s === 'diproses') return ['selesai', 'baru']
  return ['diproses']
}
