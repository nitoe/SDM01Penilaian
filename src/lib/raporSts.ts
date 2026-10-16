/**
 * Data & HTML Rapor STS (Sumatif Tengah Semester) — "rapor bayangan" untuk orang tua.
 * Format mengikuti rapor PAS/SAS v1: A.1 Muatan Wajib, A.2 Muatan Yayasan, lalu ketidakhadiran,
 * catatan wali, dan tanggapan orang tua untuk diisi tangan. Seluruh isinya hanya dari hasil STS.
 * Nilai akhir = rata tertimbang nilai STS murni dari TP yang masuk cakupan STS (asesmenRumus.ts).
 * Mapel tanpa nilai tetap muncul dengan "—" agar cetak kosong tetap rapi.
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
import { hitungStsMapel, kalimatCapaian, muatanMapel } from './asesmenRumus'
import type { ConfigAkademik, Mapel, Semester, TujuanPembelajaran } from '../types/akademik'

export interface BarisRaporSts {
  mapel: string
  /** Nama yang ditampilkan (Seni Budaya bisa dilengkapi disiplin). */
  labelMapel: string
  urutan: number
  /** A.1 Muatan Wajib atau A.2 Muatan Yayasan. */
  muatan: 'wajib' | 'yayasan'
  nilaiAkhir: number | null
  capaianTerbaik: string
  capaianPerluBimbingan: string
}

export interface DataRaporSts {
  config: ConfigAkademik
  siswa: { id: string; nama: string; nisn?: string; nipd?: string }
  kelas: string
  fase: string
  semester: Semester
  semLabel: string
  tahunAjaran: string
  daftarNilai: BarisRaporSts[]
  waliNama: string
  kota: string
  tanggal: string
}

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

function escapeHtml(str: string): string {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** Bahan satu mapel yang sama untuk semua siswa di kelas: dimuat sekali, dihitung per siswa di memori. */
interface SumberMapelSts {
  mapel: Mapel
  labelMapel: string
  tpCakupan: TujuanPembelajaran[]
  nilaiKelas: Awaited<ReturnType<typeof getNilaiAsesmenKelas>>
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
      return {
        mapel: m,
        labelMapel: m.nama === 'Seni Budaya' ? labelSeniBudaya(disiplinAktif) : m.nama,
        tpCakupan: tpList.filter((tp) => ids.has(tp.id) && tpMasukSemester(tp, semester)),
        nilaiKelas,
      }
    }),
  )
}

function barisDariSumber(sumber: SumberMapelSts[], siswaId: string, semester: Semester): BarisRaporSts[] {
  return sumber.map((s) => {
    const h = hitungStsMapel(s.tpCakupan, s.nilaiKelas, siswaId, semester)
    return {
      mapel: s.mapel.nama,
      labelMapel: s.labelMapel,
      urutan: s.mapel.urutan ?? 0,
      muatan: muatanMapel(s.mapel.nama),
      nilaiAkhir: h.nilaiAkhir,
      capaianTerbaik: h.capaianTerbaik,
      capaianPerluBimbingan: h.capaianPerluBimbingan,
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

interface KonteksData {
  config: ConfigAkademik
  semester: Semester
  tahunAjaran: string
  kota: string
  tanggal: string
}

async function konteksData(ctx: {
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

/** Teks baku Fase A (kelas 1–2) untuk Muatan Yayasan, sama dengan rapor v1. */
const FASE_A_YAYASAN = [
  {
    nama: 'Bahasa Arab',
    teks: 'Belum menjadi fokus tersendiri di Fase A (kelas 1 dan 2). Pengenalan kosakata dan ungkapan bahasa Arab dasar diintegrasikan dalam mata pelajaran Al-Islam dan kegiatan Tahsin-Tahfizh.',
  },
  {
    nama: 'Kemuhammadiyahan',
    teks: 'Belum menjadi fokus tersendiri di Fase A (kelas 1 dan 2). Nilai-nilai ke-Muhammadiyahan ditanamkan melalui pembiasaan dan keteladanan dalam keseharian di sekolah.',
  },
]

function barisTabel(no: number, item: BarisRaporSts): string {
  const nilai = item.nilaiAkhir == null ? '—' : String(item.nilaiAkhir)
  const kalimat = kalimatCapaian(item.capaianTerbaik, item.capaianPerluBimbingan)
  const capaian = kalimat.length
    ? kalimat.map((k, i) => `<div class="${i === 0 ? 'desc-best' : 'desc-worst'}">${escapeHtml(k)}</div>`).join('')
    : item.nilaiAkhir == null
      ? '<span class="kosong">Belum ada nilai STS</span>'
      : '<span class="kosong">Deskripsi KKTP belum diisi</span>'
  return `<tr>
    <td class="td-no">${no}</td>
    <td class="td-mapel">${escapeHtml(item.labelMapel)}</td>
    <td class="td-nilai">${nilai}</td>
    <td class="td-capaian">${capaian}</td>
  </tr>`
}

const KEPALA_TABEL =
  '<thead><tr><th class="td-no">No.</th><th>Mata Pelajaran</th><th class="td-nilai">Nilai<br>Akhir</th><th>Capaian Kompetensi</th></tr></thead>'

/** HTML isi satu rapor (tanpa <html>/@page) — dipakai pratinjau & cetak. */
export function buildBodyPrintSts(d: DataRaporSts): string {
  const wajib = d.daftarNilai.filter((b) => b.muatan === 'wajib')
  const yayasan = d.daftarNilai.filter((b) => b.muatan === 'yayasan')
  let no = 0
  const barisWajib = wajib.map((b) => barisTabel(++no, b)).join('')
  let barisYayasan = yayasan.map((b) => barisTabel(++no, b)).join('')
  if (!yayasan.length && d.fase === 'A') {
    barisYayasan = FASE_A_YAYASAN.map(
      (f) =>
        `<tr><td class="td-no">${++no}</td><td class="td-mapel">${escapeHtml(f.nama)}</td><td class="td-nilai kosong">—</td><td class="td-capaian"><em>${escapeHtml(f.teks)}</em></td></tr>`,
    ).join('')
  }
  const kosong = (n: number) =>
    `<tr><td colspan="${n}" class="kosong" style="text-align:center;font-style:italic">Belum ada mata pelajaran terdaftar.</td></tr>`
  const tanda = `${escapeHtml(d.kota)}, ${escapeHtml(d.tanggal)}`
  const info = (label: string, nilai: string) =>
    `<div class="rpr-info-row"><span class="rpr-info-label">${label}</span><span class="rpr-info-sep">:</span><span class="rpr-info-val">${escapeHtml(nilai)}</span></div>`

  return `<section class="rpr-page">
<div class="rpr-title">Laporan Hasil Belajar</div>
<div class="rpr-subtitle">Sumatif Tengah Semester ${escapeHtml(d.semLabel)}</div>
<div class="rpr-header">
  <div class="rpr-info-grid">
    <div>
      ${info('Nama', d.siswa.nama)}
      ${info('NISN', d.siswa.nisn || d.siswa.nipd || '—')}
      ${info('Sekolah', d.config.namaSekolah || 'SD Muhammadiyah 01 Kukusan')}
      ${info('Alamat', d.config.alamatSekolah || '—')}
    </div>
    <div>
      ${info('Kelas', d.kelas)}
      ${info('Fase', d.fase)}
      ${info('Semester', d.semester === '2' ? 'II (Genap)' : 'I (Ganjil)')}
      ${info('Tahun Pelajaran', d.tahunAjaran || '—')}
    </div>
  </div>
</div>

<div class="rpr-section">
  <div class="rpr-section-title">A. Nilai dan Ketercapaian Kompetensi</div>
  <div class="rpr-sub-title">A.1. Muatan Wajib</div>
  <table>${KEPALA_TABEL}<tbody>${barisWajib || kosong(4)}</tbody></table>
  <div class="rpr-sub-title" style="margin-top:8pt">A.2. Muatan Yayasan</div>
  <table>${KEPALA_TABEL}<tbody>${barisYayasan || kosong(4)}</tbody></table>
</div>

<div class="rpr-footer-group">
  <div class="rpr-section rpr-bagian-d">
    <div class="rpr-section-title">B. Ketidakhadiran</div>
    <div class="abs-catatan">
      <table class="abs-table">
        <tr><td>Sakit</td><td>:</td><td>……… hari</td></tr>
        <tr><td>Izin</td><td>:</td><td>……… hari</td></tr>
        <tr><td>Tanpa Keterangan</td><td>:</td><td>……… hari</td></tr>
      </table>
      <div class="catatan-box">
        <div class="catatan-header">Catatan Wali</div>
        <div class="catatan-body"></div>
      </div>
    </div>
    <div class="tanggapan-box">
      <div class="tanggapan-header">Tanggapan Orang Tua/Wali Murid</div>
      <div class="tanggapan-body"></div>
    </div>
  </div>

  <div class="rpr-ttd-wrap">
    <div class="rpr-ttd-tanda">${tanda}</div>
    <div class="rpr-ttd">
      <div class="rpr-ttd-col">
        <div>Orang Tua/Wali</div>
        <div class="rpr-ttd-space"></div>
        <div class="rpr-ttd-name">(………………………………)</div>
      </div>
      <div class="rpr-ttd-col">
        <div>Kepala Sekolah,</div>
        <div class="rpr-ttd-space"></div>
        <div class="rpr-ttd-name">${escapeHtml(d.config.namaKepsek || '—')}</div>
        <div class="rpr-ttd-nbm">${d.config.nbmKepsek ? 'NBM. ' + escapeHtml(d.config.nbmKepsek) : ''}</div>
      </div>
      <div class="rpr-ttd-col">
        <div>Wali Kelas,</div>
        <div class="rpr-ttd-space"></div>
        <div class="rpr-ttd-name">${escapeHtml(d.waliNama)}</div>
      </div>
    </div>
  </div>
</div>
</section>`
}

/** Gaya rapor (mengikuti rapor v1). Dipakai pratinjau layar (dibatasi .rpr-doc) dan cetak. */
export const CSS_ISI_RAPOR = `
.rpr-title{text-align:center;font-size:14pt;font-weight:bold;text-transform:uppercase;letter-spacing:.4px;margin-bottom:2pt}
.rpr-subtitle{text-align:center;font-size:11pt;font-weight:bold;margin-bottom:10pt}
.rpr-header{border-bottom:3pt double #000;padding-bottom:9pt;margin-bottom:12pt}
.rpr-info-grid{display:grid;grid-template-columns:1fr 1fr;gap:1pt 30pt}
.rpr-info-row{display:flex;font-size:10.5pt}
.rpr-info-label{width:92pt;flex-shrink:0;font-weight:bold}
.rpr-info-sep{width:7pt;flex-shrink:0;margin-right:2pt}
.rpr-info-val{flex:1}
.rpr-section{margin-top:12pt}
.rpr-section-title{font-size:10.5pt;font-weight:bold;text-transform:uppercase;letter-spacing:.3px;border-bottom:1pt solid #000;padding-bottom:2pt;margin-bottom:6pt;page-break-after:avoid;break-after:avoid}
.rpr-sub-title{font-size:10.5pt;font-weight:bold;margin:6pt 0 4pt;page-break-after:avoid;break-after:avoid}
table{width:100%;border-collapse:collapse;font-size:10.5pt}
thead{display:table-header-group}
th{border:1pt solid #000;padding:4pt 6pt;background:#e0e0e0;font-weight:bold;text-align:center;font-size:10pt}
td{border:1pt solid #000;padding:4pt 6pt;vertical-align:top}
tr{page-break-inside:avoid;break-inside:avoid}
.td-no{text-align:center;width:24pt;font-size:9.5pt;color:#444}
.td-mapel{width:100pt}
.td-nilai{text-align:center;width:42pt;font-size:10.5pt}
.td-capaian{line-height:1.55;text-align:justify}
.desc-best{margin-bottom:2pt}
.kosong{color:#999;font-style:italic}
.abs-catatan{display:flex;gap:10pt;align-items:flex-start;margin-top:4pt}
.abs-table{width:auto;flex-shrink:0;border-collapse:collapse}
.abs-table td{border:1pt solid #000;padding:4pt 8pt}
.abs-table td:nth-child(2){border-left:none;border-right:none;padding:4pt 2pt}
.abs-table td:first-child{border-right:none;min-width:95pt}
.abs-table td:last-child{border-left:none;white-space:nowrap;min-width:60pt}
.catatan-box{flex:1;border:1pt solid #000;min-height:64pt}
.catatan-header,.tanggapan-header{padding:3pt 6pt;background:#e0e0e0;font-weight:bold;font-size:10pt;text-align:center;border-bottom:1pt solid #000}
.catatan-body{min-height:46pt}
.tanggapan-box{border:1pt solid #000;margin-top:8pt}
.tanggapan-body{height:66pt}
.rpr-ttd-wrap{margin-top:18pt}
.rpr-ttd-tanda{text-align:right;font-size:10.5pt;margin-bottom:4pt}
.rpr-ttd{display:grid;grid-template-columns:1fr 1fr 1fr;gap:8pt;font-size:10.5pt}
.rpr-ttd-col{text-align:center}
.rpr-ttd-space{height:50pt}
.rpr-ttd-name{font-weight:bold;border-top:1pt solid #000;padding-top:2pt}
.rpr-ttd-nbm{font-size:9.5pt;color:#444;min-height:12pt}
.rpr-bagian-d,.rpr-ttd-wrap,.rpr-ttd,.rpr-footer-group{page-break-inside:avoid;break-inside:avoid}
`

const PRINT_CSS = `
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
body{font-family:Arial,Helvetica,sans-serif;font-size:10.5pt;line-height:1.45;color:#000;background:#fff}
.rpr-page + .rpr-page{page-break-before:always;break-before:page}
${CSS_ISI_RAPOR}
`

/** @page tunggal (dengan pengaki nama/NISN + nomor halaman) atau tanpa pengaki untuk cetak banyak siswa. */
function cssHalaman(d?: DataRaporSts): string {
  if (!d) return '@page{size:A4;margin:1.5cm}'
  const nisn = d.siswa.nisn || d.siswa.nipd || '—'
  const teks = `Kelas ${d.kelas} | ${d.siswa.nama} | ${nisn}`.replace(/["\\]/g, '')
  return `@page{
  size:A4;margin:1.5cm 1.5cm 1.8cm;
  @bottom-left{content:"${teks}";font-family:Arial,sans-serif;font-size:8.5pt;color:#888;border-top:1px solid #ccc;vertical-align:top;padding-top:3pt}
  @bottom-right{content:"Halaman " counter(page) " dari " counter(pages);font-family:Arial,sans-serif;font-size:8.5pt;color:#888;border-top:1px solid #ccc;vertical-align:top;padding-top:3pt}
}`
}

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

  cetakDokumenHtml(html)
}

/** Dokumen HTML lengkap untuk pratinjau di layar (iframe srcDoc): tampilan sama dengan hasil cetak. */
export function dokumenPratinjauSts(daftar: DataRaporSts[]): string {
  return `<!DOCTYPE html><html lang="id"><head><meta charset="UTF-8"><style>${PRINT_CSS}
body{padding:18pt 22pt;max-width:640pt;margin:0 auto}
.rpr-page + .rpr-page{margin-top:24pt;padding-top:24pt;border-top:2px dashed #94a3b8;page-break-before:auto;break-before:auto}
</style></head><body>${daftar.map(buildBodyPrintSts).join('\n')}</body></html>`
}

export function cetakRaporSts(d: DataRaporSts): void {
  cetakHtml(`Rapor STS — ${d.siswa.nama} — Kelas ${d.kelas}`, buildBodyPrintSts(d), d)
}

/** Cetak banyak siswa sekaligus: satu siswa per halaman (atau lebih bila rapornya panjang). */
export function cetakRaporStsBanyak(daftar: DataRaporSts[]): void {
  if (!daftar.length) return
  cetakHtml(`Rapor STS — Kelas ${daftar[0].kelas}`, daftar.map(buildBodyPrintSts).join('\n'))
}
