/**
 * Data Rapor STS (Sumatif Tengah Semester) — "rapor bayangan" untuk orang tua: hanya nilai dan capaian dari STS.
 * Nilai akhir = rata tertimbang nilai STS murni dari TP cakupan; bobot dari tpBobot cakupan (default setara), bukan bobot semester.
 * Mapel tanpa nilai tetap muncul dengan "—" agar cetak kosong tetap rapi.
 * HTML dan gaya cetak ada di raporHtml.ts (murni, diuji); form SAS lengkap dipertahankan di sana.
 */
import {
  getCakupanTP,
  getConfigAkademik,
  getMapelList,
  getNilaiAsesmenKelas,
  getTPList,
  mapelBerlakuDiTingkatan,
  tingkatanDariKelas,
  tpMasukSemester,
} from './akademik'
import { getSeniKelas, labelSeniBudaya } from './seniKelas'
import { getSiswaList } from './tahsinData'
import { cetakDokumenHtml } from './cetakIframe'
import { hitungStsMapel, muatanMapel } from './asesmenRumus'
import type { ConfigAkademik, Mapel, Semester, TujuanPembelajaran } from '../types/akademik'

import { buildBodyPrintRapor, cssHalaman, escapeHtml, namaFileRapor, namaFileRaporKelas, PRINT_CSS, type BarisRaporSts, type DataRaporSts, type JenisRapor } from './raporHtml'
export type { BarisRaporSts, DataRaporSts } from './raporHtml'
export {
  buildBodyPrintRapor,
  buildBodyPrintSts,
  buildBodyPrintSas,
  dokumenPratinjauSts,
  dokumenPratinjauRapor,
  type JenisRapor,
} from './raporHtml'

const NAMA_BULAN = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
]

export function tanggalIndonesia(d = new Date()): string {
  return `${d.getDate()} ${NAMA_BULAN[d.getMonth()]} ${d.getFullYear()}`
}

export function faseDariKelas(kelas: string): string {
  const n = parseInt(String(kelas).replace(/[^0-9]/g, ''), 10)
  if (isNaN(n)) return '?'
  return n <= 2 ? 'A' : n <= 4 ? 'B' : 'C'
}

/** Bahan satu mapel yang sama untuk semua siswa di kelas: dimuat sekali, dihitung per siswa di memori. */
interface SumberMapelSts {
  mapel: Mapel
  labelMapel: string
  /** TP masuk cakupan STS — dasar nilai akhir. */
  tpCakupan: TujuanPembelajaran[]
  /** Semua TP mapel di semester ini — pool diferensiasi capaian terbaik/terburuk. */
  tpSemester: TujuanPembelajaran[]
  nilaiKelas: Awaited<ReturnType<typeof getNilaiAsesmenKelas>>
  /** Bobot relatif antar TP cakupan (leger/rapor STS saja). */
  tpBobot?: Record<string, number>
}

/** Query selalu memuat mapel + kelas (ANTIREGRESI §7.3). Tidak ada nilai yang ditulis. */
async function muatSumberSts(kelas: string, semester: Semester, tahunAjaran: string): Promise<SumberMapelSts[]> {
  const tingkatan = tingkatanDariKelas(kelas)
  const [mapelList, seni] = await Promise.all([getMapelList(), getSeniKelas(kelas)])
  const disiplinAktif = semester === '2' ? seni.genap : seni.ganjil
  const mapelBerlaku = mapelList
    .filter((m) => mapelBerlakuDiTingkatan(m, tingkatan))
    .sort((a, b) => (a.urutan ?? 0) - (b.urutan ?? 0) || a.nama.localeCompare(b.nama, 'id'))

  return Promise.all(
    mapelBerlaku.map(async (m) => {
      const [tpList, cakupan, nilaiKelas] = await Promise.all([
        getTPList(m.nama, kelas),
        getCakupanTP({ mapel: m.nama, kelas, semester, tahunAjaran, jenis: 'sts' }),
        getNilaiAsesmenKelas({ jenis: 'sts', mapel: m.nama, kelas, semester, tahunAjaran }),
      ])
      const ids = new Set(cakupan?.tpIds ?? [])
      const tpSemester = tpList.filter((tp) => tpMasukSemester(tp, semester))
      return {
        mapel: m,
        labelMapel: m.nama === 'Seni Budaya' ? labelSeniBudaya(disiplinAktif) : m.nama,
        tpCakupan: tpSemester.filter((tp) => ids.has(tp.id)),
        tpSemester,
        nilaiKelas,
        tpBobot: cakupan?.tpBobot,
      }
    }),
  )
}

function barisDariSumber(sumber: SumberMapelSts[], siswaId: string, semester: Semester): BarisRaporSts[] {
  return sumber.map((s) => {
    const h = hitungStsMapel(s.tpCakupan, s.nilaiKelas, siswaId, semester, s.tpSemester, s.tpBobot)
    return {
      mapel: s.mapel.nama,
      labelMapel: s.labelMapel,
      urutan: s.mapel.urutan ?? 0,
      muatan: muatanMapel(s.mapel.nama),
      nilaiAkhir: h.nilaiAkhir,
      capaianTerbaik: h.capaianTerbaik,
      capaianPerluBimbingan: h.capaianPerluBimbingan,
      levelIndexTerbaik: h.levelIndexTerbaik,
      levelIndexTerendah: h.levelIndexTerendah,
    }
  })
}

/**
 * Susun baris rapor STS untuk satu siswa.
 * Mapel difilter `tingkatanBerlaku`; Seni Budaya memakai label disiplin kelas.
 */
export async function getRaporSTSSiswa(ctx: {
  siswaId: string
  kelas: string
  semester: Semester
  tahunAjaran: string
}): Promise<BarisRaporSts[]> {
  const sumber = await muatSumberSts(ctx.kelas, ctx.semester, ctx.tahunAjaran)
  return barisDariSumber(sumber, ctx.siswaId, ctx.semester)
}

export interface KonteksData {
  config: ConfigAkademik
  semester: Semester
  tahunAjaran: string
  kota: string
  tanggal: string
}

export async function konteksData(ctx: {
  semester?: Semester
  tahunAjaran?: string
  kotaRapor?: string
  tanggalRapor?: string
}): Promise<KonteksData> {
  const config = await getConfigAkademik()
  return {
    config,
    semester: ctx.semester ?? config.semesterAktif,
    tahunAjaran: (ctx.tahunAjaran ?? config.tahunAjaran).trim(),
    kota: (ctx.kotaRapor ?? config.kotaRapor)?.trim() || 'Depok',
    tanggal: ctx.tanggalRapor?.trim() || tanggalIndonesia(),
  }
}

/**
 * Muat semua data yang dibutuhkan halaman pratinjau/cetak.
 * Semester + tahun ajaran sebaiknya dari periode aktif (login).
 * Identitas sekolah tetap dari config/akademik.
 * Tanggal rapor: pakai override dari periode jika ada, else hari ini.
 */
export async function muatDataRaporSts(ctx: {
  siswa: { id: string; nama: string; nisn?: string; nipd?: string }
  kelas: string
  waliNama: string
  /** Dari PeriodeContext — wajib agar nilai sesuai periode login */
  semester?: Semester
  tahunAjaran?: string
  kotaRapor?: string
  /** Teks tanggal rapor siap cetak, mis. "20 Desember 2026" */
  tanggalRapor?: string
}): Promise<DataRaporSts> {
  const k = await konteksData(ctx)
  const daftarNilai = await getRaporSTSSiswa({
    siswaId: ctx.siswa.id,
    kelas: ctx.kelas,
    semester: k.semester,
    tahunAjaran: k.tahunAjaran,
  })
  return {
    config: k.config,
    siswa: ctx.siswa,
    kelas: ctx.kelas,
    fase: faseDariKelas(ctx.kelas),
    semester: k.semester,
    semLabel: k.semester === '2' ? 'Genap' : 'Ganjil',
    tahunAjaran: k.tahunAjaran,
    daftarNilai,
    waliNama: ctx.waliNama,
    kota: k.kota,
    tanggal: k.tanggal,
  }
}

/**
 * Rapor STS SELURUH siswa aktif satu kelas. Bahan tiap mapel dimuat sekali (bukan per siswa),
 * lalu dihitung per siswa dengan fungsi yang sama dengan rapor satu siswa.
 */
export async function muatDataRaporStsKelas(ctx: {
  kelas: string
  waliNama: string
  role: string
  semester?: Semester
  tahunAjaran?: string
  kotaRapor?: string
  tanggalRapor?: string
}): Promise<DataRaporSts[]> {
  const k = await konteksData(ctx)
  const [siswaList, sumber] = await Promise.all([
    getSiswaList(ctx.kelas, { role: ctx.role, kelasAmpu: [] }),
    muatSumberSts(ctx.kelas, k.semester, k.tahunAjaran),
  ])
  return siswaList.map((s) => ({
    config: k.config,
    siswa: { id: s.id, nama: s.nama, nisn: s.nisn, nipd: s.nipd },
    kelas: ctx.kelas,
    fase: faseDariKelas(ctx.kelas),
    semester: k.semester,
    semLabel: k.semester === '2' ? 'Genap' : 'Ganjil',
    tahunAjaran: k.tahunAjaran,
    daftarNilai: barisDariSumber(sumber, s.id, k.semester),
    waliNama: ctx.waliNama,
    kota: k.kota,
    tanggal: k.tanggal,
  }))
}

export { namaFileRapor, namaFileRaporKelas } from './raporHtml'

function cetakHtml(judul: string, body: string, d?: DataRaporSts): void {
  const html = `<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="UTF-8">
<title>${escapeHtml(judul)}</title>
<style>${cssHalaman(d)}${PRINT_CSS}</style>
</head>
<body>
${body}
</body>
</html>`

  cetakDokumenHtml(html, judul)
}

export function cetakRapor(d: DataRaporSts, jenis: JenisRapor): void {
  cetakHtml(namaFileRapor(jenis, d.siswa.nama), buildBodyPrintRapor(d, jenis), d)
}

/** Cetak banyak siswa sekaligus: satu siswa per halaman (atau lebih bila rapornya panjang). */
export function cetakRaporBanyak(daftar: DataRaporSts[], jenis: JenisRapor): void {
  if (!daftar.length) return
  cetakHtml(namaFileRaporKelas(jenis, daftar[0].kelas), daftar.map((d) => buildBodyPrintRapor(d, jenis)).join('\n'))
}

export const cetakRaporSts = (d: DataRaporSts) => cetakRapor(d, 'sts')
export const cetakRaporStsBanyak = (daftar: DataRaporSts[]) => cetakRaporBanyak(daftar, 'sts')
