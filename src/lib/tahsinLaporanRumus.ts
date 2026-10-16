import type { MenulisRecord, SetoranRecord } from '../types/tahsin.ts'

// Rumus murni laporan perkembangan Tahsin-Tahfizh per siswa (untuk orang tua), mengikuti
// tahsin-tahfizh/cetak-laporan.html di penilaian-v2. Tanpa Firebase agar bisa diuji:
// node --experimental-strip-types scripts/cek-laporan-cetak.mjs  (ANTIREGRESI §22)

type Waktu = SetoranRecord['createdAt'] | string | number | null | undefined

export function keMs(v: Waktu): number {
  if (!v) return 0
  if (typeof v === 'number') return v
  if (v instanceof Date) return v.getTime()
  if (typeof v === 'string') return new Date(v).getTime() || 0
  return typeof v === 'object' && 'seconds' in v ? v.seconds * 1000 : 0
}

/** Rentang tanggal bawaan semester (ISO yyyy-mm-dd): Ganjil Jul–Des tahun pertama, Genap Jan–Jun tahun kedua. */
export function rentangSemester(tahunAjaran: string, semester: '1' | '2'): { dari: string; sampai: string } {
  const [a, b] = tahunAjaran.split('/').map((x) => parseInt(x, 10))
  const awal = Number.isFinite(a) ? a : new Date().getFullYear()
  const akhir = Number.isFinite(b) ? b : awal + 1
  return semester === '1'
    ? { dari: `${awal}-07-01`, sampai: `${awal}-12-31` }
    : { dari: `${akhir}-01-01`, sampai: `${akhir}-06-30` }
}

/** Apakah waktu jatuh dalam [dari, sampai] (tanggal ISO, sampai = akhir hari tersebut). */
export function dalamRentang(v: Waktu, dari: string, sampai: string): boolean {
  const t = keMs(v)
  if (!t) return false
  const a = new Date(`${dari}T00:00:00`).getTime()
  const b = new Date(`${sampai}T23:59:59.999`).getTime()
  return t >= a && t <= b
}

export function tanggalPendek(ms: number): string {
  return new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(ms))
}

/** Kelompokkan per siswa, terbaru dulu (urutan dipakai posisiIqro). */
export function kelompokkanSetoran(setoran: SetoranRecord[]): Record<string, SetoranRecord[]> {
  const hasil: Record<string, SetoranRecord[]> = {}
  for (const s of setoran) (hasil[s.siswaId] ||= []).push(s)
  for (const k of Object.keys(hasil)) hasil[k].sort((a, b) => keMs(b.createdAt) - keMs(a.createdAt))
  return hasil
}

export function kelompokkanMenulis(menulis: MenulisRecord[]): Record<string, MenulisRecord[]> {
  const hasil: Record<string, MenulisRecord[]> = {}
  for (const m of menulis) (hasil[m.siswaId] ||= []).push(m)
  const waktu = (m: MenulisRecord) => keMs((m.tanggalPeriksa as Waktu) || m.createdAt)
  for (const k of Object.keys(hasil)) hasil[k].sort((a, b) => waktu(b) - waktu(a))
  return hasil
}

export interface ItemLog {
  tanggal: number
  materi: string
  meta: string
  dot: 'green' | 'gold' | 'red'
}

export interface Akurasi {
  pct: number
  label: 'Istimewa' | 'Baik' | 'Cukup' | 'Perlu Bimbingan'
  warna: string
}

/** Perkiraan akurasi bacaan dari catatan Baca & Tandai (rumus v2: 100 − 35 × galat per ayat). */
export function akurasiBacaan(tajwid: number, makhroj: number, ayatDinilai: number): Akurasi | null {
  if (!ayatDinilai) return null
  const galat = (tajwid + makhroj) / ayatDinilai
  const pct = Math.max(5, Math.min(100, Math.round(100 - galat * 35)))
  if (galat <= 0.3) return { pct, label: 'Istimewa', warna: '#1f6b4a' }
  if (galat <= 0.7) return { pct, label: 'Baik', warna: '#2f7d5c' }
  if (galat <= 1.5) return { pct, label: 'Cukup', warna: '#9a6a12' }
  return { pct, label: 'Perlu Bimbingan', warna: '#b3261e' }
}

export function narasiMembaca(ayat: number, tajwid: number, makhroj: number, nama: string): string {
  if (!ayat) return `Belum ada data penilaian bacaan (Baca & Tandai) untuk ${nama} pada periode ini.`
  const rate = (tajwid + makhroj) / ayat
  const kualitas =
    rate < 0.3
      ? 'menunjukkan penguasaan bacaan yang baik'
      : rate < 0.6
        ? 'cukup baik, dengan beberapa bagian yang masih perlu latihan lebih lanjut'
        : 'masih memerlukan bimbingan lebih intensif, terutama pada aspek tajwid dan makhraj'
  return `Selama periode ini, bacaan ${nama} telah dinilai sebanyak ${ayat} ayat, dengan ${tajwid} catatan tajwid dan ${makhroj} catatan makhraj. Secara umum, bacaan ${nama} ${kualitas}.`
}

export function narasiHafalan(
  iqro: boolean,
  ziyadahLulus: number,
  murojaah: number,
  posisiTerakhir: string,
  totalSesi: number,
  nama: string,
): string {
  if (!totalSesi) return `Belum ada catatan setoran untuk ${nama} pada periode ini.`
  if (iqro) {
    return `Selama periode ini, ${nama} mengikuti ${totalSesi} kali sesi bimbingan membaca Iqro, dengan posisi terakhir pada ${posisiTerakhir || '-'}.`
  }
  return `Pada periode ini, ${nama} menyelesaikan ${ziyadahLulus} materi hafalan baru dan melakukan ${murojaah} kali muroja'ah untuk menjaga hafalan yang telah dikuasai. Posisi hafalan terakhir: ${posisiTerakhir || '-'}.`
}

/** Bentuk longgar catatan menulis (data lama v2 tidak seragam). */
interface MenulisLonggar {
  materi?: { label?: string; tipe?: string; buku?: number; jilidIqro?: number; halamanMulai?: number; halamanAkhir?: number }
  penilaian?: Record<string, unknown>
  jilidIqro?: number
  halamanMulai?: number
  halamanAkhir?: number
}
const longgar = (r: MenulisRecord) => r as unknown as MenulisLonggar

export function posisiMenulis(rec: MenulisRecord | undefined): string {
  if (!rec) return '-'
  const r = longgar(rec)
  const m = r.materi
  if (m?.tipe === 'quran') return m.label || '-'
  const rentang = (a?: number, b?: number) => `${a ?? '-'}${b != null && b !== a ? `–${b}` : ''}`
  if (m?.tipe === 'iqro') return `Iqro ${m.jilidIqro ?? m.buku ?? '-'} — Hal. ${rentang(m.halamanMulai, m.halamanAkhir)}`
  return `${r.jilidIqro ? `Iqro ${r.jilidIqro} — ` : ''}Halaman ${rentang(r.halamanMulai, r.halamanAkhir)}`
}

/** Rata-rata empat aspek menulis (skala 1–4), satu desimal; null bila tidak ada penilaian. */
export function rataMenulis(rec: MenulisRecord | undefined): number | null {
  const p = rec ? longgar(rec).penilaian : undefined
  if (!p) return null
  const v = ['hurufSambungan', 'harakat', 'keutuhanTeks', 'kerapian']
    .map((k) => p[k])
    .filter((x): x is number => typeof x === 'number')
  return v.length ? Math.round((v.reduce((a, b) => a + b, 0) / v.length) * 10) / 10 : null
}

export function narasiMenulis(terakhir: MenulisRecord | undefined, total: number, nama: string): string {
  if (!terakhir) return `Belum ada catatan pemeriksaan buku salinan Al-Qur'an untuk ${nama} pada periode ini.`
  const posisi = posisiMenulis(terakhir)
  const rata = rataMenulis(terakhir)
  if (longgar(terakhir).materi?.tipe === 'quran' && rata != null) {
    const kualitas =
      rata >= 3.5
        ? 'sangat baik'
        : rata >= 2.5
          ? 'baik'
          : rata >= 1.5
            ? 'cukup, dengan beberapa aspek yang masih perlu dibimbing'
            : 'masih memerlukan bimbingan intensif, terutama pada kebenaran huruf dan kelengkapan harakat'
    return `${nama} telah menyalin hingga ${posisi}, dengan ${total} kali pemeriksaan oleh guru selama periode ini. Rata-rata penilaian menulis (kebenaran huruf & sambungan, kelengkapan harakat, keutuhan teks, serta kerapian & keterbacaan) berada pada level ${kualitas} (skor ${rata}/4).`
  }
  return `${nama} telah menyalin hingga ${posisi}, dengan ${total} kali pemeriksaan oleh guru selama periode ini.`
}

export interface LaporanSiswa {
  namaDepan: string
  iqro: boolean
  membaca: { ayatDinilai: number; tajwid: number; makhroj: number; akurasi: Akurasi | null; narasi: string; log: ItemLog[] }
  hafalan: { totalSesi: number; ziyadahLulus: number; murojaah: number; narasi: string; log: ItemLog[] }
  menulis: { total: number; nilaiTerakhir: string; narasi: string; log: ItemLog[] }
}

/**
 * Susun isi laporan satu siswa dari setoran dan catatan menulis PADA RENTANG laporan.
 * `setoran` harus terurut terbaru → lama (kelompokkanSetoran).
 */
export function susunLaporanSiswa(
  siswa: { nama: string; jenjang: string },
  setoran: SetoranRecord[],
  menulis: MenulisRecord[],
): LaporanSiswa {
  const namaDepan = siswa.nama.trim().split(/\s+/)[0] || siswa.nama
  const iqro = siswa.jenjang === 'iqro'

  let ayat = 0
  let tajwid = 0
  let makhroj = 0
  const logMembaca: ItemLog[] = []
  for (const r of setoran) {
    if (!(r.materi?.tipe === 'iqro' || r.detailAyat?.length || r.detailBacaanIqro)) continue
    let t = 0
    let m = 0
    const hitung = (k: { jenis: string }[] | undefined) => {
      for (const x of k ?? []) {
        if (x.jenis === 'tajwid') t++
        else if (x.jenis === 'makhroj') m++
      }
    }
    if (r.detailAyat?.length) {
      for (const a of r.detailAyat) {
        ayat++
        hitung(a.kataSalah)
      }
    } else if (r.detailBacaanIqro) {
      ayat++
      hitung(r.detailBacaanIqro.kataSalah)
    }
    tajwid += t
    makhroj += m
    const total = t + m
    logMembaca.push({
      tanggal: keMs(r.createdAt),
      materi: r.materi?.label || '-',
      meta: total === 0 ? 'Bersih' : `${t} tajwid • ${m} makhraj`,
      dot: total === 0 ? 'green' : total <= 2 ? 'gold' : 'red',
    })
  }

  const sesiHafalan = setoran.filter((r) => r.jenis !== 'tahsin')
  const ziyadahLulus = sesiHafalan.filter((r) => r.jenis === 'ziyadah' && r.statusHafalan === 'lulus').length
  const murojaah = sesiHafalan.filter((r) => r.jenis === 'murojaah').length
  const posisiTerakhir = setoran.length ? setoran[0].materi?.label || '-' : '-'
  const logHafalan: ItemLog[] = sesiHafalan.map((r) => ({
    tanggal: keMs(r.createdAt),
    materi: r.materi?.label || '-',
    meta: r.jenis === 'ziyadah' ? 'Ziyadah' : "Muroja'ah",
    dot: r.statusHafalan === 'lulus' ? 'green' : 'red',
  }))

  const terakhirMenulis = menulis[0]
  const logMenulis: ItemLog[] = menulis.map((r) => {
    const rata = rataMenulis(r)
    return {
      tanggal: keMs((r.tanggalPeriksa as Waktu) || r.createdAt),
      materi: posisiMenulis(r),
      meta: rata != null ? `Rata-rata ${rata}/4` : '',
      dot: 'green',
    }
  })
  const rataTerakhir = rataMenulis(terakhirMenulis)

  return {
    namaDepan,
    iqro,
    membaca: {
      ayatDinilai: ayat,
      tajwid,
      makhroj,
      akurasi: akurasiBacaan(tajwid, makhroj, ayat),
      narasi: narasiMembaca(ayat, tajwid, makhroj, namaDepan),
      log: logMembaca,
    },
    hafalan: {
      totalSesi: sesiHafalan.length,
      ziyadahLulus,
      murojaah,
      narasi: narasiHafalan(iqro, ziyadahLulus, murojaah, posisiTerakhir, sesiHafalan.length, namaDepan),
      log: logHafalan,
    },
    menulis: {
      total: menulis.length,
      nilaiTerakhir: terakhirMenulis
        ? longgar(terakhirMenulis).materi?.tipe === 'quran' && rataTerakhir != null
          ? `${rataTerakhir}/4`
          : posisiMenulis(terakhirMenulis)
        : '-',
      narasi: narasiMenulis(terakhirMenulis, menulis.length, namaDepan),
      log: logMenulis,
    },
  }
}
