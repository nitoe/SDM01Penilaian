import { tanggalPendek, type ItemLog, type LaporanSiswa } from './tahsinLaporanRumus.ts'

// Pembangun HTML laporan Tahsin-Tahfizh satu siswa (satu halaman A4). Murni string, dipakai untuk
// pratinjau (iframe) dan cetak agar keduanya identik. Tanpa emoji; tabel/daftar sederhana.

export interface BagianTarget {
  judul: string
  stat: { n: string; l: string }[]
  /** Kalimat hasil untuk target Iqro */
  hasil?: { teks: string; tercapai: boolean }
  /** Baris progres per surah (target Al-Qur'an) */
  surah?: { nama: string; persen: number }[]
}

export interface HalamanTahsin {
  sekolah: string
  labelPeriode: string
  rentang: string
  siswa: { nama: string; nomor: string; kelas: string; jenjang: 'iqro' | 'quran' | string }
  guruNama: string
  laporan: LaporanSiswa
  target: BagianTarget | null
  kota: string
  tanggal: string
  namaKepsek: string
  nbmKepsek?: string
}

export function esc(s: unknown): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

const stat = (n: string | number, l: string) =>
  `<div class="lpr-stat"><span class="n">${esc(n)}</span><span class="l">${esc(l)}</span></div>`

function daftarLog(log: ItemLog[], kosong: string, maks = 4): string {
  if (!log.length) return `<p class="lpr-kosong">${esc(kosong)}</p>`
  const tampil = log.slice(0, maks)
  const sisa = log.length - tampil.length
  return `<ul class="lpr-log">${tampil
    .map(
      (i) =>
        `<li class="${i.dot}"><span class="tgl">${i.tanggal ? esc(tanggalPendek(i.tanggal)) : '-'}</span><span class="materi">${esc(i.materi)}</span>${i.meta ? `<span class="meta">${esc(i.meta)}</span>` : ''}</li>`,
    )
    .join('')}</ul>${sisa > 0 ? `<p class="lpr-lagi">…dan ${sisa} entri lainnya pada periode ini</p>` : ''}`
}

export function bangunHalamanTahsin(d: HalamanTahsin): string {
  const l = d.laporan
  const a = l.membaca.akurasi
  const iqro = d.siswa.jenjang === 'iqro'

  const target = d.target
    ? `<div class="lpr-section"><h2>Target Hafalan${d.target.judul ? ` — ${esc(d.target.judul)}` : ''}</h2>
  <div class="lpr-stat-row">${d.target.stat.map((s) => stat(s.n, s.l)).join('')}</div>
  ${d.target.hasil ? `<p class="lpr-narasi ${d.target.hasil.tercapai ? 'ok' : 'belum'}">${esc(d.target.hasil.teks)}</p>` : ''}
  ${
    d.target.surah?.length
      ? `<ul class="lpr-log">${d.target.surah
          .map(
            (s) =>
              `<li class="${s.persen >= 100 ? 'green' : s.persen > 0 ? 'gold' : 'red'}"><span class="materi">${esc(s.nama)}</span><span class="meta">${s.persen}%</span></li>`,
          )
          .join('')}</ul>`
      : ''
  }
</div>`
    : ''

  return `<section class="lpr-page">
<div class="lpr-head">
  <div>
    <h1>Laporan Perkembangan Tahsin-Tahfizh</h1>
    <p class="sub">${esc(d.sekolah)} · ${esc(d.labelPeriode)}</p>
    <p class="sub">Periode ${esc(d.rentang)}</p>
  </div>
  <span class="badge">${iqro ? 'JENJANG IQRO' : "JENJANG AL-QUR'AN"}</span>
</div>

<div class="lpr-info">
  <div><span class="k">Nama Siswa</span><span class="v">${esc(d.siswa.nama)}</span></div>
  <div><span class="k">NIS/NISN</span><span class="v">${esc(d.siswa.nomor || '-')}</span></div>
  <div><span class="k">Kelas</span><span class="v">${esc(d.siswa.kelas)}</span></div>
  <div><span class="k">Guru Pembimbing</span><span class="v">${esc(d.guruNama || '-')}</span></div>
</div>

<div class="lpr-section">
  <h2>1. Membaca Al-Qur'an</h2>
  <div class="lpr-stat-row">${stat(l.membaca.ayatDinilai, 'Ayat Dinilai')}${stat(l.membaca.tajwid, 'Catatan Tajwid')}${stat(l.membaca.makhroj, 'Catatan Makhraj')}</div>
  ${
    a
      ? `<div class="lpr-gauge"><div class="p" style="color:${a.warna}"><span class="n">${a.pct}%</span><span class="l">${esc(a.label)}</span></div>
  <div class="bar"><div class="track"><div class="fill" style="width:${a.pct}%;background:${a.warna}"></div></div>
  <p class="cap">Perkiraan akurasi bacaan berdasarkan catatan Baca &amp; Tandai selama periode ini</p></div></div>`
      : ''
  }
  <p class="lpr-narasi">${esc(l.membaca.narasi)}</p>
  ${daftarLog(l.membaca.log, 'Belum ada sesi dengan data Baca & Tandai pada periode ini.')}
</div>

<div class="lpr-section">
  <h2>2. Menghapal Al-Qur'an</h2>
  <div class="lpr-stat-row">${
    iqro
      ? stat(l.hafalan.totalSesi, 'Total Sesi')
      : `${stat(l.hafalan.ziyadahLulus, 'Materi Baru Lulus')}${stat(l.hafalan.murojaah, "Sesi Muroja'ah")}`
  }</div>
  <p class="lpr-narasi">${esc(l.hafalan.narasi)}</p>
  ${daftarLog(l.hafalan.log, 'Belum ada riwayat setoran hafalan pada periode ini.')}
</div>

${target}

<div class="lpr-section">
  <h2>${iqro ? '3. Menulis (Iqro)' : "3. Menulis Al-Qur'an"}</h2>
  <div class="lpr-stat-row">${
    l.menulis.aspek.length
      ? `${stat(l.menulis.rata != null ? `${l.menulis.rata}/4` : '-', 'Rata-rata Periode')}${l.menulis.aspek.map((x) => stat(x.nilai, x.label)).join('')}`
      : `${stat(l.menulis.nilaiTerakhir, 'Capaian Terakhir')}${stat(l.menulis.total, 'Kali Diperiksa')}`
  }</div>
  <p class="lpr-narasi">${esc(l.menulis.narasi)}${l.menulis.latihan ? ` ${esc(l.menulis.latihan)}` : ''}</p>
  ${daftarLog(l.menulis.log, 'Belum ada catatan pemeriksaan menulis pada periode ini.')}
</div>

<div class="lpr-ttd-wrap">
  <p class="tanda">${esc(d.kota)}, ${esc(d.tanggal)}</p>
  <div class="ttd">
    <div><p>Orang Tua/Wali,</p><div class="sp"></div><p class="nm">(……………………………)</p></div>
    <div><p>Kepala Sekolah,</p><div class="sp"></div><p class="nm">${esc(d.namaKepsek || '(……………………………)')}</p><p class="nbm">${d.nbmKepsek ? `NBM. ${esc(d.nbmKepsek)}` : ''}</p></div>
    <div><p>Guru Tahsin-Tahfizh,</p><div class="sp"></div><p class="nm">${esc(d.guruNama || '(……………………………)')}</p></div>
  </div>
</div>
</section>`
}

export const CSS_LAPORAN_TAHSIN = `
.lpr-page{font-family:Arial,Helvetica,sans-serif;font-size:10pt;line-height:1.4;color:#111}
.lpr-page + .lpr-page{page-break-before:always;break-before:page}
.lpr-head{display:flex;justify-content:space-between;align-items:flex-start;gap:12pt;border-bottom:3pt double #000;padding-bottom:8pt;margin-bottom:10pt}
.lpr-head h1{font-size:14pt;text-transform:uppercase;letter-spacing:.3pt}
.lpr-head .sub{font-size:10pt;color:#333}
.lpr-head .badge{border:1pt solid #000;padding:2pt 8pt;font-size:8.5pt;font-weight:bold;white-space:nowrap}
.lpr-info{display:grid;grid-template-columns:1fr 1fr;gap:3pt 24pt;margin-bottom:10pt}
.lpr-info .k{display:inline-block;width:104pt;font-weight:bold}
.lpr-section{margin-top:8pt;page-break-inside:avoid;break-inside:avoid}
.lpr-section h2{font-size:11pt;border-bottom:1pt solid #000;padding-bottom:2pt;margin-bottom:6pt;page-break-after:avoid}
.lpr-stat-row{display:flex;gap:10pt;margin-bottom:6pt}
.lpr-stat{flex:1;border:1pt solid #000;text-align:center;padding:3pt 4pt}
.lpr-stat .n{display:block;font-size:14pt;font-weight:bold}
.lpr-stat .l{display:block;font-size:8.5pt;color:#333}
.lpr-gauge{display:flex;gap:10pt;align-items:center;margin-bottom:6pt}
.lpr-gauge .p{text-align:center;min-width:64pt}
.lpr-gauge .p .n{display:block;font-size:15pt;font-weight:bold}
.lpr-gauge .p .l{display:block;font-size:9pt;font-weight:bold}
.lpr-gauge .bar{flex:1}
.lpr-gauge .track{height:7pt;border:1pt solid #555;background:#fff}
.lpr-gauge .fill{height:100%}
.lpr-gauge .cap{font-size:8.5pt;color:#444;margin-top:2pt}
.lpr-narasi{margin:4pt 0 6pt;text-align:justify}
.lpr-narasi.ok{font-weight:bold}
.lpr-narasi.belum{font-weight:bold}
.lpr-kosong{color:#666;font-style:italic}
.lpr-log{list-style:none}
.lpr-log li{display:flex;gap:8pt;align-items:baseline;border-bottom:.5pt solid #ccc;padding:2pt 0 2pt 6pt;font-size:9.5pt}
.lpr-log li.green{border-left:3pt solid #2f7d5c}.lpr-log li.gold{border-left:3pt solid #d9a21b}.lpr-log li.red{border-left:3pt solid #b3261e}
.lpr-log .tgl{width:62pt;flex-shrink:0;color:#333}
.lpr-log .materi{flex:1}
.lpr-log .meta{color:#333;white-space:nowrap}
.lpr-lagi{font-size:8.5pt;color:#555;margin-top:2pt}
.lpr-ttd-wrap{margin-top:12pt;page-break-inside:avoid;break-inside:avoid}
.lpr-ttd-wrap .tanda{text-align:right;margin-bottom:4pt}
.lpr-ttd-wrap .ttd{display:grid;grid-template-columns:1fr 1fr 1fr;gap:8pt;text-align:center}
.lpr-ttd-wrap .sp{height:38pt}
.lpr-ttd-wrap .nm{font-weight:bold;border-top:1pt solid #000;padding-top:2pt}
.lpr-ttd-wrap .nbm{font-size:9pt;color:#444;min-height:11pt}
`
