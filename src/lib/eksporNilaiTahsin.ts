/**
 * Ekspor semua nilai Tahsin-Tahfizh (setoran + catatan menulis) satu kelas + periode
 * ke file Excel (.xlsx). Hanya membaca data — tidak mengubah Firestore.
 */
import type { MenulisRecord, SetoranRecord } from '../types/tahsin'
import { JENIS_LABEL, JENIS_TUGAS_MENULIS_LABEL, KESALAHAN_MENULIS_LABEL, STATUS_LABEL } from '../types/tahsin'
import { bangunKesalahan, rataInti } from './menulis'
import { formatTanggal, getMenulisKelas, getSetoranKelasPeriode, type ScopePeriode } from './tahsinData'
import { unduhBlob } from './tpImport'

export interface BarisEksporSetoran {
  no: number
  tanggal: string
  siswaId: string
  siswaNama: string
  kelas: string
  jenjang: string
  jenis: string
  materi: string
  statusHafalan: string
  catatan: string
  guru: string
  tahunAjaran: string
  semester: string
}

export interface BarisEksporMenulis {
  no: number
  tanggal: string
  siswaId: string
  siswaNama: string
  kelas: string
  materi: string
  jenisTugas: string
  hurufSambungan: number | ''
  harakat: number | ''
  kelengkapan: number | ''
  /** Rata-rata tiga aspek inti (tanpa Kerapian). */
  rata: number | ''
  kerapian: number | ''
  kesalahan: string
  catatan: string
}

const skorAtauKosong = (v: unknown): number | '' => (typeof v === 'number' ? v : '')

function labelMateri(m: SetoranRecord['materi'] | undefined): string {
  if (!m) return ''
  if ('label' in m && m.label) return String(m.label)
  return ''
}

function isoAtauTanggal(
  value: SetoranRecord['createdAt'] | string | null | undefined,
): string {
  return formatTanggal(value)
}

/** Ubah daftar setoran menjadi baris siap Excel (urut nama siswa, lalu tanggal naik). */
export function susunBarisSetoran(list: SetoranRecord[]): BarisEksporSetoran[] {
  const sorted = [...list].sort((a, b) => {
    const n = (a.siswaNama || '').localeCompare(b.siswaNama || '', 'id')
    if (n !== 0) return n
    const ta = formatTanggal(a.createdAt)
    const tb = formatTanggal(b.createdAt)
    return ta.localeCompare(tb, 'id')
  })
  return sorted.map((r, i) => ({
    no: i + 1,
    tanggal: isoAtauTanggal(r.createdAt),
    siswaId: r.siswaId,
    siswaNama: r.siswaNama || '',
    kelas: r.kelas,
    jenjang: r.jenjang === 'iqro' ? 'Iqro' : r.jenjang === 'quran' ? "Al-Qur'an" : r.jenjang || '',
    jenis: r.jenis ? JENIS_LABEL[r.jenis] || r.jenis : '',
    materi: labelMateri(r.materi),
    statusHafalan: r.statusHafalan ? STATUS_LABEL[r.statusHafalan] || r.statusHafalan : '',
    catatan: r.catatan || '',
    guru: r.createdByNama || '',
    tahunAjaran: r.tahunAjaran || '',
    semester: r.semester ? String(r.semester) : '',
  }))
}

/** Ubah daftar menulis menjadi baris siap Excel. */
export function susunBarisMenulis(list: MenulisRecord[]): BarisEksporMenulis[] {
  const sorted = [...list].sort((a, b) => {
    const n = (a.siswaNama || '').localeCompare(b.siswaNama || '', 'id')
    if (n !== 0) return n
    const ta = (a.tanggalPeriksa as string | undefined) || formatTanggal(a.createdAt)
    const tb = (b.tanggalPeriksa as string | undefined) || formatTanggal(b.createdAt)
    return String(ta).localeCompare(String(tb), 'id')
  })
  return sorted.map((r, i) => ({
    no: i + 1,
    tanggal: (r.tanggalPeriksa as string | undefined) || formatTanggal(r.createdAt),
    siswaId: r.siswaId,
    siswaNama: r.siswaNama || '',
    kelas: r.kelas,
    materi: (r.materi && typeof r.materi === 'object' && r.materi.label) || '',
    jenisTugas: r.jenisTugas ? JENIS_TUGAS_MENULIS_LABEL[r.jenisTugas] || '' : '',
    hurufSambungan: skorAtauKosong(r.penilaian?.hurufSambungan),
    harakat: skorAtauKosong(r.penilaian?.harakat),
    kelengkapan: skorAtauKosong(r.penilaian?.keutuhanTeks),
    rata: skorAtauKosong(rataInti(r.penilaian)),
    kerapian: skorAtauKosong(r.penilaian?.kerapian),
    kesalahan: bangunKesalahan(r.kesalahan ?? [])
      .map((k) => KESALAHAN_MENULIS_LABEL[k])
      .join('; '),
    catatan: r.catatan || '',
  }))
}

const HEADER_SETORAN = [
  'No',
  'Tanggal',
  'ID Siswa',
  'Nama Siswa',
  'Kelas',
  'Jenjang',
  'Jenis',
  'Materi',
  'Status Hafalan',
  'Catatan',
  'Guru',
  'Tahun Ajaran',
  'Semester',
] as const

const HEADER_MENULIS = [
  'No',
  'Tanggal',
  'ID Siswa',
  'Nama Siswa',
  'Kelas',
  'Materi',
  'Jenis Tugas',
  'Huruf & Sambungan',
  'Harakat & Tanda Baca',
  'Kelengkapan Teks',
  'Rata-rata (3 aspek)',
  'Kerapian',
  'Kesalahan Umum',
  'Catatan',
] as const

function barisSetoranKeArray(b: BarisEksporSetoran): (string | number)[] {
  return [
    b.no,
    b.tanggal,
    b.siswaId,
    b.siswaNama,
    b.kelas,
    b.jenjang,
    b.jenis,
    b.materi,
    b.statusHafalan,
    b.catatan,
    b.guru,
    b.tahunAjaran,
    b.semester,
  ]
}

function barisMenulisKeArray(b: BarisEksporMenulis): (string | number)[] {
  return [
    b.no,
    b.tanggal,
    b.siswaId,
    b.siswaNama,
    b.kelas,
    b.materi,
    b.jenisTugas,
    b.hurufSambungan,
    b.harakat,
    b.kelengkapan,
    b.rata,
    b.kerapian,
    b.kesalahan,
    b.catatan,
  ]
}

/**
 * Buat Blob Excel berisi sheet Setoran dan sheet Menulis.
 * Sheet kosong tetap dibuat agar struktur file konsisten.
 */
export async function buatExcelNilaiTahsin(opts: {
  setoran: SetoranRecord[]
  menulis: MenulisRecord[]
  kelas: string
  labelPeriode: string
}): Promise<Blob> {
  const XLSX = await import('xlsx')
  const barisS = susunBarisSetoran(opts.setoran)
  const barisM = susunBarisMenulis(opts.menulis)

  const dataS: (string | number)[][] = [[...HEADER_SETORAN], ...barisS.map(barisSetoranKeArray)]
  const dataM: (string | number)[][] = [[...HEADER_MENULIS], ...barisM.map(barisMenulisKeArray)]

  const wsS = XLSX.utils.aoa_to_sheet(dataS)
  wsS['!cols'] = [
    { wch: 5 },
    { wch: 14 },
    { wch: 12 },
    { wch: 28 },
    { wch: 8 },
    { wch: 10 },
    { wch: 12 },
    { wch: 36 },
    { wch: 14 },
    { wch: 28 },
    { wch: 22 },
    { wch: 12 },
    { wch: 10 },
  ]

  const wsM = XLSX.utils.aoa_to_sheet(dataM)
  wsM['!cols'] = [
    { wch: 5 },
    { wch: 14 },
    { wch: 12 },
    { wch: 28 },
    { wch: 8 },
    { wch: 28 },
    { wch: 14 },
    { wch: 12 },
    { wch: 12 },
    { wch: 12 },
    { wch: 12 },
    { wch: 10 },
    { wch: 30 },
    { wch: 28 },
  ]

  const petunjuk = XLSX.utils.aoa_to_sheet([
    ['Ekspor Nilai Tahsin-Tahfizh'],
    [],
    ['Kelas', opts.kelas],
    ['Periode', opts.labelPeriode],
    ['Jumlah setoran', barisS.length],
    ['Jumlah catatan menulis', barisM.length],
    [],
    ['Sheet "Setoran": semua catatan setoran (ziyadah, muroja\'ah, tahsin) pada periode ini.'],
    ['Sheet "Menulis": semua catatan menulis pada kelas ini (tidak terikat semester). Skor 1-4; rata-rata dihitung dari tiga aspek inti, Kerapian tidak ikut.'],
    ['File ini hanya untuk arsip/rekap. Tidak diimpor kembali ke sistem.'],
  ])

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, wsS, 'Setoran')
  XLSX.utils.book_append_sheet(wb, wsM, 'Menulis')
  XLSX.utils.book_append_sheet(wb, petunjuk, 'Info')

  const out = XLSX.write(wb, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer
  return new Blob([out], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
}

/** Muat data kelas+periode lalu unduh sebagai .xlsx. */
export async function eksporNilaiTahsinKelas(ctx: {
  kelas: string
  periode: ScopePeriode
  labelPeriode: string
}): Promise<{ jumlahSetoran: number; jumlahMenulis: number; namaFile: string }> {
  const [setoran, menulis] = await Promise.all([
    getSetoranKelasPeriode(ctx.kelas, ctx.periode),
    getMenulisKelas(ctx.kelas),
  ])
  const blob = await buatExcelNilaiTahsin({
    setoran,
    menulis,
    kelas: ctx.kelas,
    labelPeriode: ctx.labelPeriode,
  })
  const ta = ctx.periode.tahunAjaran.replace(/\//g, '-')
  const namaFile = `nilai-tahsin-${ctx.kelas}-${ta}-S${ctx.periode.semester}.xlsx`
  unduhBlob(blob, namaFile)
  return { jumlahSetoran: setoran.length, jumlahMenulis: menulis.length, namaFile }
}
