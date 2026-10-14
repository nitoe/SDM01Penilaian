/**
 * Data & HTML Rapor STS (Sumatif Tengah Semester).
 * Nilai akhir = rata tertimbang nilai STS murni dari TP yang masuk cakupan STS.
 * Capaian = deskripsi KKTP TP bernilai tertinggi / terendah (pola v1 & SAS v2).
 * Mapel tanpa nilai tetap muncul dengan "—" agar cetak kosong tetap rapi.
 */
import {
  bobotTpDiSemester,
  getCakupanTP,
  getConfigAkademik,
  getMapelList,
  getNilaiAsesmenKelas,
  getTPList,
  hitungNilaiAkhirMapel,
  mapelBerlakuDiTingkatan,
  tentukanLevel,
  tingkatanDariKelas,
  tpMasukSemester,
} from './akademik'
import { getSeniKelas, labelSeniBudaya } from './seniKelas'
import type { ConfigAkademik, Semester, TujuanPembelajaran } from '../types/akademik'

export interface BarisRaporSts {
  mapel: string
  /** Nama yang ditampilkan (Seni Budaya bisa dilengkapi disiplin). */
  labelMapel: string
  urutan: number
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

function bobotUntukSts(tp: TujuanPembelajaran, semester: string): number {
  const b = bobotTpDiSemester(tp, semester)
  if (b != null && b > 0) return b
  return tp.bobotMapel != null && tp.bobotMapel > 0 ? Number(tp.bobotMapel) : 1
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
  const tingkatan = tingkatanDariKelas(ctx.kelas)
  const [mapelList, seni] = await Promise.all([
    getMapelList(),
    getSeniKelas(ctx.kelas),
  ])
  const disiplinAktif = ctx.semester === '2' ? seni.genap : seni.ganjil

  const mapelBerlaku = mapelList
    .filter((m) => mapelBerlakuDiTingkatan(m, tingkatan))
    .sort((a, b) => (a.urutan ?? 0) - (b.urutan ?? 0) || a.nama.localeCompare(b.nama, 'id'))

  const hasil: BarisRaporSts[] = []

  for (const m of mapelBerlaku) {
    const labelMapel =
      m.nama === 'Seni Budaya' ? labelSeniBudaya(disiplinAktif) : m.nama

    const [tpList, cakupan, nilaiKelas] = await Promise.all([
      getTPList(m.nama, ctx.kelas),
      getCakupanTP({
        mapel: m.nama,
        kelas: ctx.kelas,
        semester: ctx.semester,
        tahunAjaran: ctx.tahunAjaran,
        jenis: 'sts',
      }),
      getNilaiAsesmenKelas({
        jenis: 'sts',
        mapel: m.nama,
        kelas: ctx.kelas,
        semester: ctx.semester,
        tahunAjaran: ctx.tahunAjaran,
      }),
    ])

    const tpIds = new Set(cakupan?.tpIds ?? [])
    const tpCakupan = tpList.filter(
      (tp) => tpIds.has(tp.id) && tpMasukSemester(tp, ctx.semester),
    )

    let nilaiAkhir: number | null = null
    let capaianTerbaik = ''
    let capaianPerluBimbingan = ''

    if (tpCakupan.length) {
      const perTP = tpCakupan.map((tp) => {
        const nilai = nilaiKelas[tp.id]?.[ctx.siswaId]?.nilai ?? null
        return { tp, nilai, bobot: bobotUntukSts(tp, ctx.semester) }
      })

      nilaiAkhir = hitungNilaiAkhirMapel(
        perTP.map((x) => ({ nilai: x.nilai, bobot: x.bobot })),
      )

      const terisi = perTP.filter((x) => x.nilai != null && Number.isFinite(x.nilai))
      if (terisi.length) {
        const sorted = [...terisi].sort((a, b) => Number(b.nilai) - Number(a.nilai))
        const best = sorted[0]
        const worst = sorted[sorted.length - 1]
        capaianTerbaik = tentukanLevel(best.nilai, best.tp)?.deskripsi || ''
        if (worst.tp.id !== best.tp.id) {
          capaianPerluBimbingan = tentukanLevel(worst.nilai, worst.tp)?.deskripsi || ''
        }
      }
    }

    hasil.push({
      mapel: m.nama,
      labelMapel,
      urutan: m.urutan ?? 0,
      nilaiAkhir,
      capaianTerbaik,
      capaianPerluBimbingan,
    })
  }

  return hasil
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
  const config = await getConfigAkademik()
  const semester: Semester = ctx.semester ?? config.semesterAktif
  const tahunAjaran = (ctx.tahunAjaran ?? config.tahunAjaran).trim()
  const daftarNilai = await getRaporSTSSiswa({
    siswaId: ctx.siswa.id,
    kelas: ctx.kelas,
    semester,
    tahunAjaran,
  })
  const semLabel = semester === '2' ? 'Genap' : 'Ganjil'
  const kota =
    (ctx.kotaRapor ?? config.kotaRapor)?.trim() || 'Depok'
  const tanggal = ctx.tanggalRapor?.trim() || tanggalIndonesia()
  return {
    config,
    siswa: ctx.siswa,
    kelas: ctx.kelas,
    fase: faseDariKelas(ctx.kelas),
    semester,
    semLabel,
    tahunAjaran,
    daftarNilai,
    waliNama: ctx.waliNama,
    kota,
    tanggal,
  }
}

/** HTML isi rapor (tanpa <html>/@page) — dipakai pratinjau & cetak. */
export function buildBodyPrintSts(d: DataRaporSts): string {
  const rows = d.daftarNilai
    .map((item, i) => {
      const capaianParts: string[] = []
      if (item.capaianTerbaik) capaianParts.push(item.capaianTerbaik)
      if (item.capaianPerluBimbingan) capaianParts.push(item.capaianPerluBimbingan)
      const capaian = capaianParts.length
        ? escapeHtml(capaianParts.join(' '))
        : '<span style="color:#999">—</span>'
      const nilai =
        item.nilaiAkhir === null || item.nilaiAkhir === undefined
          ? '—'
          : String(item.nilaiAkhir)
      return `<tr>
        <td class="td-no">${i + 1}</td>
        <td class="td-mapel">${escapeHtml(item.labelMapel)}</td>
        <td class="td-nilai">${nilai}</td>
        <td class="td-capaian">${capaian}</td>
      </tr>`
    })
    .join('')

  const kosong =
    '<tr><td colspan="4" style="text-align:center;color:#999;font-style:italic">Belum ada mata pelajaran terdaftar untuk tingkatan ini.</td></tr>'

  const tanda = `${escapeHtml(d.kota)}, ${escapeHtml(d.tanggal)}`

  return `
<div class="rpr-title">Laporan Hasil Belajar</div>
<div class="rpr-subtitle">Sumatif Tengah Semester ${escapeHtml(d.semLabel)}</div>
<div class="rpr-header">
  <div class="rpr-info-grid">
    <div>
      <div class="rpr-info-row"><span class="rpr-info-label">Nama Peserta Didik</span><span class="rpr-info-sep">:</span><span class="rpr-info-val">${escapeHtml(d.siswa.nama)}</span></div>
      <div class="rpr-info-row"><span class="rpr-info-label">NISN</span><span class="rpr-info-sep">:</span><span class="rpr-info-val">${escapeHtml(d.siswa.nisn || d.siswa.nipd || '—')}</span></div>
      <div class="rpr-info-row"><span class="rpr-info-label">Sekolah</span><span class="rpr-info-sep">:</span><span class="rpr-info-val">${escapeHtml(d.config.namaSekolah || 'SD Muhammadiyah 01 Kukusan')}</span></div>
      <div class="rpr-info-row"><span class="rpr-info-label">Alamat</span><span class="rpr-info-sep">:</span><span class="rpr-info-val">${escapeHtml(d.config.alamatSekolah || '—')}</span></div>
    </div>
    <div>
      <div class="rpr-info-row"><span class="rpr-info-label">Kelas</span><span class="rpr-info-sep">:</span><span class="rpr-info-val">${escapeHtml(d.kelas)}</span></div>
      <div class="rpr-info-row"><span class="rpr-info-label">Fase</span><span class="rpr-info-sep">:</span><span class="rpr-info-val">${escapeHtml(d.fase)}</span></div>
      <div class="rpr-info-row"><span class="rpr-info-label">Semester</span><span class="rpr-info-sep">:</span><span class="rpr-info-val">${escapeHtml(d.semLabel)}</span></div>
      <div class="rpr-info-row"><span class="rpr-info-label">Tahun Pelajaran</span><span class="rpr-info-sep">:</span><span class="rpr-info-val">${escapeHtml(d.tahunAjaran || '—')}</span></div>
    </div>
  </div>
</div>
<table>
  <thead>
    <tr>
      <th class="td-no">No.</th>
      <th>Mata Pelajaran</th>
      <th class="td-nilai">Nilai<br>Akhir</th>
      <th>Capaian Kompetensi</th>
    </tr>
  </thead>
  <tbody>${rows || kosong}</tbody>
</table>
<div class="rpr-ttd-wrap">
  <div class="rpr-ttd-tanda">${tanda}</div>
  <div class="rpr-ttd">
    <div class="rpr-ttd-col">
      <div>Orang Tua/Wali</div>
      <div class="rpr-ttd-space"></div>
      <div class="rpr-ttd-name">(…………………………)</div>
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
</div>`
}

const PRINT_CSS = `
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
@page{
  size: A4;
  margin: 1.4cm 1.5cm 1.8cm;
  @bottom-left{
    content: "Kelas __KELAS__ | __NAMA__ | __NISN__";
    font-family: Arial, sans-serif;
    font-size: 8.5pt;
    color: #888;
    border-top: 1px solid #ccc;
    vertical-align: top;
    padding-top: 3pt;
  }
  @bottom-right{
    content: "Halaman " counter(page) " dari " counter(pages);
    font-family: Arial, sans-serif;
    font-size: 8.5pt;
    color: #888;
    border-top: 1px solid #ccc;
    vertical-align: top;
    padding-top: 3pt;
  }
}
body{
  font-family: Arial, Helvetica, sans-serif;
  font-size: 10.5pt;
  line-height: 1.45;
  color: #000;
  background: #fff;
}
.rpr-title{text-align:center;font-size:14pt;font-weight:700;margin-bottom:2pt}
.rpr-subtitle{text-align:center;font-size:11pt;font-weight:600;margin-bottom:12pt}
.rpr-header{margin-bottom:12pt}
.rpr-info-grid{display:grid;grid-template-columns:1fr 1fr;gap:4pt 16pt}
.rpr-info-row{display:flex;gap:4pt;font-size:10pt;margin-bottom:2pt}
.rpr-info-label{min-width:118pt;flex-shrink:0}
.rpr-info-sep{flex-shrink:0}
.rpr-info-val{font-weight:600}
table{width:100%;border-collapse:collapse;margin-top:6pt;page-break-inside:auto}
thead{display:table-header-group}
th,td{border:1px solid #333;padding:5pt 6pt;vertical-align:top}
th{background:#f0f0f0;font-size:9.5pt;font-weight:700;text-align:center}
.td-no{width:28pt;text-align:center}
.td-nilai{width:52pt;text-align:center;font-weight:700}
.td-mapel{font-weight:600;min-width:90pt}
.td-capaian{font-size:9.5pt;line-height:1.4}
tr{page-break-inside:avoid}
.rpr-ttd-wrap{margin-top:22pt;page-break-inside:avoid}
.rpr-ttd-tanda{text-align:right;margin-bottom:8pt;font-size:10pt}
.rpr-ttd{display:grid;grid-template-columns:1fr 1fr 1fr;gap:8pt;text-align:center;font-size:10pt}
.rpr-ttd-space{height:48pt}
.rpr-ttd-name{font-weight:700;text-decoration:underline;text-underline-offset:2pt}
.rpr-ttd-nbm{font-size:9pt;margin-top:1pt}
`

/**
 * Cetak rapor lewat iframe tersembunyi — tidak memakai window.open,
 * sehingga tidak diblokir popup blocker browser.
 */
export function cetakRaporSts(d: DataRaporSts): void {
  const body = buildBodyPrintSts(d)
  const css = PRINT_CSS
    .replace('__KELAS__', d.kelas)
    .replace('__NAMA__', d.siswa.nama)
    .replace('__NISN__', d.siswa.nisn || d.siswa.nipd || '—')

  const html = `<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="UTF-8">
<title>Rapor STS — ${escapeHtml(d.siswa.nama)} — Kelas ${escapeHtml(d.kelas)}</title>
<style>${css}</style>
</head>
<body>
${body}
</body>
</html>`

  const FRAME_ID = 'sdm-rapor-print-frame'
  let iframe = document.getElementById(FRAME_ID) as HTMLIFrameElement | null
  if (!iframe) {
    iframe = document.createElement('iframe')
    iframe.id = FRAME_ID
    iframe.setAttribute('aria-hidden', 'true')
    iframe.style.cssText =
      'position:fixed;right:0;bottom:0;width:0;height:0;border:0;opacity:0;pointer-events:none'
    document.body.appendChild(iframe)
  }

  const win = iframe.contentWindow
  const doc = iframe.contentDocument
  if (!win || !doc) {
    alert('Browser tidak mendukung cetak lewat iframe. Coba peramban lain.')
    return
  }

  doc.open()
  doc.write(html)
  doc.close()

  // Tunggu layout siap, lalu panggil print di konteks iframe (bukan jendela baru).
  const doPrint = () => {
    try {
      win.focus()
      win.print()
    } catch (e) {
      console.error(e)
      alert('Gagal membuka dialog cetak. Coba lagi.')
    }
  }
  // load event + cadangan timeout (beberapa browser tidak memicu onload setelah document.write)
  iframe.onload = () => setTimeout(doPrint, 50)
  setTimeout(doPrint, 250)
}
