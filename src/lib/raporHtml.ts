import type { ConfigAkademik } from '../types/akademik.ts'
import { kalimatCapaian } from './asesmenRumus.ts'

// Pembangun HTML rapor cetak (murni, tanpa Firebase) agar bisa diuji dan dipakai pratinjau + cetak
// dengan hasil identik. Format mengikuti rapor PAS/SAS v1 (rapor/preview.html), ANTIREGRESI §21.
//   - 'sts': rapor bayangan untuk orang tua — HANYA nilai dan capaian. Tanda tangan: Ortu + Wali + Kepsek
//            dengan gambar digital bila tersedia (pelaporan STS sering online).
//   - 'sas': rapor akhir lengkap (kokurikuler, ekstrakurikuler, ketidakhadiran, catatan wali, tanggapan,
//            keputusan kenaikan, tanda tangan tiga pihak). Formnya dipertahankan untuk Rapor SAS nanti.

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
  /** Indeks level KKTP (0–3) TP bernilai tertinggi — memilih awalan kalimat capaian. */
  levelIndexTerbaik?: number | null
  /** Level KKTP TP terendah — awalan baris kedua. */
  levelIndexTerendah?: number | null
}

export interface DataRaporSts {
  config: ConfigAkademik
  siswa: { id: string; nama: string; nisn?: string; nipd?: string }
  kelas: string
  fase: string
  semester: '1' | '2'
  semLabel: string
  tahunAjaran: string
  daftarNilai: BarisRaporSts[]
  waliNama: string
  kota: string
  tanggal: string
  /** URL gambar tanda tangan digital wali kelas (STS online). */
  ttdWaliUrl?: string
  /** URL gambar tanda tangan digital kepala sekolah (STS online). */
  ttdKepsekUrl?: string
  /** Hanya dipakai rapor SAS. Bila kosong, bagian tetap tercetak sebagai isian kosong. */
  kokurikuler?: string
  ekskul?: { nama: string; predikat?: string; ket: string }[]
  absensi?: { sakit: number; izin: number; tk: number }
  catatanWali?: string
  /** Hanya semester 2. 'Naik'/'Tinggal' mencoret pilihan lain; null/kosong = belum diputuskan: kedua pilihan dicetak tanpa coretan (dicoret tangan). */
  keputusan?: 'Naik' | 'Tinggal' | null
}

export type JenisRapor = 'sts' | 'sas'

export function escapeHtml(str: unknown): string {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/**
 * Nama file default saat "Simpan sebagai PDF".
 * Format: "Rapor STS - Nama Siswa" / "Rapor SAS - Nama Siswa".
 */
export function namaFileRapor(jenis: JenisRapor, namaSiswa: string): string {
  const label = jenis === 'sas' ? 'Rapor SAS' : 'Rapor STS'
  const nama = String(namaSiswa ?? '')
    .trim()
    .replace(/[\\/:*?"<>|]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return nama ? `${label} - ${nama}` : label
}

export function namaFileRaporKelas(jenis: JenisRapor, kelas: string): string {
  const label = jenis === 'sas' ? 'Rapor SAS' : 'Rapor STS'
  const k = String(kelas ?? '').trim() || 'Kelas'
  return `${label} - Kelas ${k}`
}

const nomorKelas = (kelas: string) => parseInt(String(kelas).replace(/[^0-9]/g, ''), 10)
const faseDariNomor = (n: number) => (isNaN(n) ? '?' : n <= 2 ? 'A' : n <= 4 ? 'B' : n <= 6 ? 'C' : 'D')

/**
 * Teks baku Fase A (kelas 1–2) untuk Muatan Yayasan — disimpan untuk reaktifasi
 * bila kebijakan kurikulum mengubah penerapan Bahasa Arab / Kemuhammadiyahan di Fase A.
 * Saat ini DINONAKTIFKAN: tidak disisipkan ke cetak rapor STS/SAS (permintaan 26 Okt 2026).
 * Mapel tetap di master (`tingkatanBerlaku` kelas 3–6); filter `mapelBerlakuDiTingkatan`
 * sudah mengeluarkannya dari daftar nilai kelas 1–2.
 */
const FASE_A_YAYASAN: { nama: string; teks: string }[] = [
  {
    nama: 'Bahasa Arab',
    teks: 'Belum menjadi fokus tersendiri di Fase A (kelas 1 dan 2). Pengenalan kosakata dan ungkapan bahasa Arab dasar diintegrasikan dalam mata pelajaran Al-Islam dan kegiatan Tahsin-Tahfizh.',
  },
  {
    nama: 'Kemuhammadiyahan',
    teks: 'Belum menjadi fokus tersendiri di Fase A (kelas 1 dan 2). Nilai-nilai ke-Muhammadiyahan ditanamkan melalui pembiasaan dan keteladanan dalam keseharian di sekolah.',
  },
]
// Sengaja tidak di-export / tidak dipakai di bagianNilai agar tidak masuk print.
void FASE_A_YAYASAN

function barisTabel(no: number, item: BarisRaporSts): string {
  const nilai = item.nilaiAkhir == null ? '—' : String(item.nilaiAkhir)
  const kalimat = kalimatCapaian(item.capaianTerbaik, item.capaianPerluBimbingan, item.levelIndexTerbaik, item.levelIndexTerendah)
  const capaian = kalimat.length
    ? kalimat.map((k, i) => `<div class="${i === 0 ? 'desc-best' : 'desc-worst'}">${escapeHtml(k)}</div>`).join('')
    : item.nilaiAkhir == null
      ? '<span class="kosong">Belum ada nilai</span>'
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

function bagianNilai(d: DataRaporSts): { html: string; terakhir: number } {
  const wajib = d.daftarNilai.filter((b) => b.muatan === 'wajib')
  const yayasan = d.daftarNilai.filter((b) => b.muatan === 'yayasan')
  let no = 0
  const barisWajib = wajib.map((b) => barisTabel(++no, b)).join('')
  // Hanya mapel yayasan yang benar-benar berlaku di tingkatan (ada di daftarNilai).
  // Placeholder Fase A (Bahasa Arab / Kemuhammadiyahan) DINONAKTIFKAN — tidak disisipkan
  // agar tidak muncul di print rapor STS kelas 1–2. Aktifkan kembali lewat FASE_A_YAYASAN
  // jika kebijakan kurikulum mengubah penerapan di Fase A.
  const barisYayasan = yayasan.map((b) => barisTabel(++no, b)).join('')
  const kosong = `<tr><td colspan="4" class="kosong" style="text-align:center;font-style:italic">Belum ada mata pelajaran terdaftar.</td></tr>`
  // Sembunyikan seluruh blok A.2 bila tidak ada mapel yayasan untuk tingkatan ini
  // (kelas 1–2 / Fase A: Bahasa Arab & Kemuhammadiyahan tidak berlaku).
  const blokYayasan = yayasan.length
    ? `<div class="rpr-sub-title" style="margin-top:8pt">A.2. Muatan Yayasan</div>
  <table>${KEPALA_TABEL}<tbody>${barisYayasan}</tbody></table>`
    : ''
  return {
    terakhir: no,
    html: `<div class="rpr-section">
  <div class="rpr-section-title">A. Nilai dan Ketercapaian Kompetensi</div>
  <div class="rpr-sub-title">A.1. Muatan Wajib</div>
  <table>${KEPALA_TABEL}<tbody>${barisWajib || kosong}</tbody></table>
  ${blokYayasan}
</div>`,
  }
}

function kepala(d: DataRaporSts, jenis: JenisRapor): string {
  const info = (label: string, nilai: string) =>
    `<div class="rpr-info-row"><span class="rpr-info-label">${label}</span><span class="rpr-info-sep">:</span><span class="rpr-info-val">${escapeHtml(nilai)}</span></div>`
  return `<div class="rpr-title">Laporan Hasil Belajar</div>
<div class="rpr-subtitle">${jenis === 'sts' ? 'Sumatif Tengah Semester' : 'Sumatif Akhir Semester'}</div>
<div class="rpr-header">
  <div class="rpr-info-grid">
    <div>
      ${info('Nama', d.siswa.nama)}
      ${info('NISN', d.siswa.nisn || d.siswa.nipd || '—')}
      ${info('Sekolah', d.config.namaSekolah || 'SD Muhammadiyah 01 Kukusan')}
      ${info('Alamat', d.config.alamatSekolah || '—')}
    </div>
    <div class="rpr-info-kanan">
      ${info('Kelas', d.kelas)}
      ${info('Fase', d.fase)}
      ${info('Semester', d.semester === '2' ? 'II (Genap)' : 'I (Ganjil)')}

      ${info('Tahun Pelajaran', d.tahunAjaran || '—')}
    </div>
  </div>
</div>`
}

/**
 * Ruang tanda tangan digital.
 * - Biasa (wali/ortu): hanya TTD atau kosong.
 * - Kepsek: TTD dulu (lapisan bawah), stempel di atasnya — urutan resmi: tanda tangan lalu cap.
 */
function ruangTtd(opts: { ttdUrl?: string; stempelUrl?: string; denganStempel?: boolean }): string {
  const ttd = (opts.ttdUrl || '').trim()
  const stempel = (opts.stempelUrl || '').trim()
  const pakaiStempel = Boolean(opts.denganStempel && stempel)

  if (pakaiStempel) {
    // Urutan DOM: TTD dulu (bawah), stempel kemudian (atas) — cap menindih tanda tangan.
    const imgTtd = ttd
      ? `<img class="rpr-ttd-img rpr-ttd-img--bawah-stempel" src="${escapeHtml(ttd)}" alt="" />`
      : ''
    const imgStempel = `<img class="rpr-stempel" src="${escapeHtml(stempel)}" alt="" />`
    return `<div class="rpr-ttd-space rpr-ttd-space--stempel">${imgTtd}${imgStempel}</div>`
  }

  if (ttd) {
    return `<div class="rpr-ttd-space"><img class="rpr-ttd-img" src="${escapeHtml(ttd)}" alt="" /></div>`
  }
  return `<div class="rpr-ttd-space"></div>`
}

const tandaTangan = (d: DataRaporSts, jenis: JenisRapor): string => {
  // Tempat dan tanggal berada DI DALAM kolom Wali Kelas (rata tengah, sejajar dengan "Wali Kelas,"),
  // bukan rata kanan halaman. Kolom lain diberi baris kosong setinggi sama agar jabatan tetap sejajar.
  const kolom = (
    peran: string,
    nama: string,
    nbm = '',
    tempat = '',
    opts?: { ttdUrl?: string; stempelUrl?: string; denganStempel?: boolean },
  ) =>
    `<div class="rpr-ttd-col"><div class="rpr-ttd-tempat">${tempat || '&nbsp;'}</div><div>${peran}</div>${ruangTtd(opts || {})}<div class="rpr-ttd-name">${nama}</div><div class="rpr-ttd-nbm">${nbm}</div></div>`
  const tempat = `${escapeHtml(d.kota)}, ${escapeHtml(d.tanggal)}`
  const stempelUrl = (String((d.config as { stempelUrl?: string }).stempelUrl || '')).trim() || undefined
  const ttdKepsek = (d.ttdKepsekUrl || d.config.ttdKepsekUrl || '').trim() || undefined
  const ortu = kolom('Orang Tua/Wali', '(………………………………)')
  const wali = kolom('Wali Kelas,', escapeHtml(d.waliNama), '', tempat, { ttdUrl: d.ttdWaliUrl })
  const kepsek = kolom(
    'Kepala Sekolah,',
    escapeHtml(d.config.namaKepsek || '—'),
    d.config.nbmKepsek ? `NBM. ${escapeHtml(d.config.nbmKepsek)}` : '',
    '',
    { ttdUrl: ttdKepsek, stempelUrl, denganStempel: true },
  )
  // STS (online): Ortu + Wali + Kepsek agar TTD digital guru & kepsek ikut tercetak.
  // SAS: tetap tiga pihak (Ortu + Kepsek + Wali) — TTD digital tidak dipaksa (cetak offline).
  if (jenis === 'sts') {
    return `<div class="rpr-ttd-wrap">
    <div class="rpr-ttd">${ortu}${wali}${kepsek}</div>
  </div>`
  }
  return `<div class="rpr-ttd-wrap">
    <div class="rpr-ttd">${ortu}${kepsek}${wali}</div>
  </div>`
}

/** Bagian B–D dan keputusan khusus rapor SAS (pola v1). */
function bagianSas(d: DataRaporSts): string {
  const kok = d.kokurikuler?.trim()
  const ekskul = d.ekskul?.length
    ? d.ekskul
        .map(
          (e, i) =>
            `<tr><td class="td-no">${i + 1}</td><td style="font-weight:bold">${escapeHtml(e.nama)}</td><td style="text-align:center">${escapeHtml(e.predikat || '—')}</td><td>${escapeHtml(e.ket) || '<span class="kosong">—</span>'}</td></tr>`,
        )
        .join('')
    : '<tr><td colspan="4" class="kosong" style="text-align:center">Peserta didik tidak mengikuti kegiatan ekstrakurikuler semester ini.</td></tr>'
  const hari = (n: number | undefined) => (n == null ? '……… hari' : `${n} hari`)
  const n = nomorKelas(d.kelas)
  // Pilihan yang tidak terpilih dicoret; belum diputuskan = tidak ada yang dicoret (dicoret tangan).
  const tandai = (pilih: 'Naik' | 'Tinggal', teks: string) =>
    d.keputusan == null ? teks : d.keputusan === pilih ? `<strong>${teks}</strong>` : `<s>${teks}</s>`
  const keputusan =
    d.semester === '2'
      ? `<div class="rpr-keputusan-wrap"><div class="rpr-keputusan">
  <p>Berdasarkan pencapaian kompetensi pada semester ke-1 dan ke-2, peserta didik ditetapkan *)</p>
  <p>${tandai('Naik', `Naik ke Fase ${faseDariNomor(n + 1)} | Kelas ${isNaN(n) ? d.kelas : n + 1}`)}</p>
  <p>${tandai('Tinggal', `Tinggal di kelas ${isNaN(n) ? d.kelas : n}`)}</p>
  <p><em>*) coret yang tidak perlu</em></p>
</div></div>`
      : ''
  return `<div class="rpr-section">
  <div class="rpr-section-title">B. Kokurikuler</div>
  <div class="kok-header">Kokurikuler</div>
  <div class="kok-box">${kok ? escapeHtml(kok) : '<span class="kosong">—</span>'}</div>
</div>
<div class="rpr-section">
  <div class="rpr-section-title">C. Ekstrakurikuler</div>
  <table><thead><tr><th class="td-no">No.</th><th>Kegiatan Ekstrakurikuler</th><th style="width:56pt">Predikat</th><th>Keterangan</th></tr></thead><tbody>${ekskul}</tbody></table>
</div>
<div class="rpr-footer-group">
  <div class="rpr-section rpr-bagian-d">
    <div class="rpr-section-title">D. Ketidakhadiran</div>
    <div class="abs-catatan">
      <table class="abs-table">
        <tr><td>Sakit</td><td>:</td><td>${hari(d.absensi?.sakit)}</td></tr>
        <tr><td>Izin</td><td>:</td><td>${hari(d.absensi?.izin)}</td></tr>
        <tr><td>Tanpa Keterangan</td><td>:</td><td>${hari(d.absensi?.tk)}</td></tr>
      </table>
      <div class="catatan-box">
        <div class="catatan-header">Catatan Wali</div>
        <div class="catatan-body">${escapeHtml(d.catatanWali ?? '')}</div>
      </div>
    </div>
    <div class="tanggapan-box">
      <div class="tanggapan-header">Tanggapan Orang Tua/Wali Murid</div>
      <div class="tanggapan-body"></div>
    </div>
  </div>
  ${keputusan}
  ${tandaTangan(d, 'sas')}
</div>`
}

export function buildBodyPrintRapor(d: DataRaporSts, jenis: JenisRapor): string {
  const nilai = bagianNilai(d).html
  const isi =
    jenis === 'sts'
      ? `${nilai}\n<div class="rpr-footer-group">${tandaTangan(d, 'sts')}</div>`
      : `${nilai}\n${bagianSas(d)}`
  return `<section class="rpr-page">\n${kepala(d, jenis)}\n${isi}\n</section>`
}

/** Rapor STS (rapor bayangan): nilai dan capaian + TTD digital Ortu/Wali/Kepsek. */
export const buildBodyPrintSts = (d: DataRaporSts) => buildBodyPrintRapor(d, 'sts')
/** Rapor SAS: form lengkap v1 (dipertahankan). Belum ada halaman yang memakainya. */
export const buildBodyPrintSas = (d: DataRaporSts) => buildBodyPrintRapor(d, 'sas')

/** Gaya rapor (mengikuti rapor v1). Dipakai pratinjau layar dan cetak. */
export const CSS_ISI_RAPOR = `
.rpr-title{text-align:center;font-size:14pt;font-weight:bold;text-transform:uppercase;letter-spacing:.4px;margin-bottom:2pt}
.rpr-subtitle{text-align:center;font-size:11pt;font-weight:bold;margin-bottom:10pt}
.rpr-header{border-bottom:3pt double #000;padding-bottom:9pt;margin-bottom:12pt}
.rpr-info-grid{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:1pt 20pt}
.rpr-info-kanan{justify-self:end}
.rpr-info-row{display:flex;font-size:10.5pt}
.rpr-info-label{width:92pt;flex-shrink:0;font-weight:bold}
.rpr-info-kanan .rpr-info-label{width:92pt}
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
.kok-header{border:1pt solid #000;border-bottom:none;padding:4pt 6pt;background:#e0e0e0;font-weight:bold;font-size:10pt;page-break-after:avoid}
.kok-box{border:1pt solid #000;padding:8pt 10pt;min-height:60pt;line-height:1.6;page-break-inside:avoid;break-inside:avoid}
.abs-catatan{display:flex;gap:10pt;align-items:flex-start;margin-top:4pt}
.abs-table{width:auto;flex-shrink:0;border-collapse:collapse}
.abs-table td{border:1pt solid #000;padding:4pt 8pt}
.abs-table td:nth-child(2){border-left:none;border-right:none;padding:4pt 2pt}
.abs-table td:first-child{border-right:none;min-width:95pt}
.abs-table td:last-child{border-left:none;white-space:nowrap;min-width:60pt}
.catatan-box{flex:1;border:1pt solid #000;min-height:64pt}
.catatan-header,.tanggapan-header{padding:3pt 6pt;background:#e0e0e0;font-weight:bold;font-size:10pt;text-align:center;border-bottom:1pt solid #000}
.catatan-body{min-height:46pt;padding:4pt 8pt}
.tanggapan-box{border:1pt solid #000;margin-top:8pt}
.tanggapan-body{height:66pt}
.rpr-keputusan-wrap{margin-top:10pt}
.rpr-keputusan{border:2pt solid #000;padding:7pt 10pt;display:inline-block;max-width:230pt;line-height:1.7}
.rpr-ttd-wrap{margin-top:18pt}
.rpr-ttd-tempat{min-height:14pt;margin-bottom:2pt}
.rpr-ttd{display:grid;grid-template-columns:1fr 1fr 1fr;gap:8pt;font-size:10.5pt}
.rpr-ttd.dua{grid-template-columns:1fr 1fr;gap:80pt;padding:0 20pt}
.rpr-ttd-col{text-align:center}
.rpr-ttd-space{height:50pt;display:flex;align-items:flex-end;justify-content:center}
.rpr-ttd-space--stempel{position:relative;height:64pt;align-items:center;justify-content:center}
.rpr-stempel{position:absolute;left:50%;top:50%;transform:translate(-50%,-48%);max-height:62pt;max-width:62pt;width:auto;height:auto;object-fit:contain;opacity:.9;z-index:2;pointer-events:none}
.rpr-ttd-img{max-height:42pt;max-width:100pt;object-fit:contain;display:block;position:relative;z-index:1}
.rpr-ttd-img--bawah-stempel{max-height:38pt;max-width:92pt;z-index:1}
.rpr-ttd-name{font-weight:bold;border-top:1pt solid #000;padding-top:2pt}
.rpr-ttd-nbm{font-size:9.5pt;color:#444;min-height:12pt}
.rpr-bagian-d,.rpr-ttd-wrap,.rpr-ttd,.rpr-footer-group,.rpr-keputusan-wrap{page-break-inside:avoid;break-inside:avoid}
`

export const PRINT_CSS = `
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
body{font-family:Arial,Helvetica,sans-serif;font-size:10.5pt;line-height:1.45;color:#000;background:#fff}
.rpr-page + .rpr-page{page-break-before:always;break-before:page}
${CSS_ISI_RAPOR}
`

/** @page tunggal (dengan pengaki nama/NISN + nomor halaman) atau tanpa pengaki untuk cetak banyak siswa. */
export function cssHalaman(d?: DataRaporSts): string {
  if (!d) return '@page{size:A4;margin:1.5cm}'
  const nisn = d.siswa.nisn || d.siswa.nipd || '—'
  const teks = `Kelas ${d.kelas} | ${d.siswa.nama} | ${nisn}`.replace(/["\\]/g, '')
  return `@page{
  size:A4;margin:1.5cm 1.5cm 1.8cm;
  @bottom-left{content:"${teks}";font-family:Arial,sans-serif;font-size:8.5pt;color:#888;border-top:1px solid #ccc;vertical-align:top;padding-top:3pt}
  @bottom-right{content:"Halaman " counter(page) " dari " counter(pages);font-family:Arial,sans-serif;font-size:8.5pt;color:#888;border-top:1px solid #ccc;vertical-align:top;padding-top:3pt}
}`
}

/** Dokumen HTML lengkap untuk pratinjau di layar (iframe srcDoc): tampilan sama dengan hasil cetak. */
export function dokumenPratinjauRapor(daftar: DataRaporSts[], jenis: JenisRapor): string {
  return `<!DOCTYPE html><html lang="id"><head><meta charset="UTF-8"><style>${PRINT_CSS}
body{padding:18pt 22pt;max-width:640pt;margin:0 auto}
.rpr-page + .rpr-page{margin-top:24pt;padding-top:24pt;border-top:2px dashed #94a3b8;page-break-before:auto;break-before:auto}
</style></head><body>${daftar.map((d) => buildBodyPrintRapor(d, jenis)).join('\n')}</body></html>`
}

export const dokumenPratinjauSts = (daftar: DataRaporSts[]) => dokumenPratinjauRapor(daftar, 'sts')
