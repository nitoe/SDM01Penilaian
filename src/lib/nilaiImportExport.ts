/**
 * Ekspor / impor / paste nilai SLM · STS · SAS.
 * Format Excel: baris = siswa, kolom = materi (TP).
 * Cocokkan impor berdasarkan NIS (prioritas) lalu nama (case-insensitive).
 * Paste clipboard: intercept TSV/CSV dari Excel/Google Sheets ke sel fokus.
 */

import type { TujuanPembelajaran } from '../types/akademik'
import type { SiswaTahsin } from '../types/tahsin'
import { unduhBlob } from './tpImport'

export type JenisNilaiSheet = 'slm' | 'sts' | 'sas'

export interface KolomMateri {
  id: string
  /** Label singkat di header, mis. "TP 3" atau "Materi 3" */
  label: string
  /** Nama lengkap materi (baris 2 header opsional / tooltip) */
  namaTp: string
  nomorTp?: number
}

export interface OpsiSheetNilai {
  jenis: JenisNilaiSheet
  mapel: string
  kelas: string
  semester: string
  tahunAjaran: string
  siswa: SiswaTahsin[]
  kolom: KolomMateri[]
  /**
   * Nilai efektif per (tpId → siswaId → angka | null).
   * Untuk template kosong, kirim objek kosong / semua null.
   */
  nilai: Record<string, Record<string, number | null | undefined>>
  /** true = isi sel kosong (template). false = ekspor nilai terkini. */
  template?: boolean
}

export interface HasilParseNilai {
  /** Perubahan yang berhasil dicocokkan: tpId → siswaId → nilai */
  isi: Record<string, Record<string, number>>
  /** Jumlah sel terisi valid */
  terisi: number
  /** Jumlah siswa yang berhasil dicocokkan (punya ≥1 nilai) */
  siswaCocok: number
  /** Siswa di file yang tidak cocok dengan daftar kelas */
  tidakCocok: string[]
  /** Kolom header yang tidak dikenali */
  kolomTakDikenal: string[]
  peringatan: string[]
}

const META_KEYS = new Set(['no', 'nomor', 'nis', 'nisn', 'nama', 'nama siswa', 'siswa', 'name'])

function cellStr(v: unknown): string {
  if (v == null) return ''
  if (typeof v === 'number' && Number.isFinite(v)) {
    // Hindari notasi ilmiah (NIS panjang) dan trailing .0
    if (Math.abs(v) >= 1e12 || (Math.abs(v) > 0 && Math.abs(v) < 1e-6)) {
      // tetap String biasa; pemanggil NIS akan menormalisasi digit
      return String(v)
    }
    if (Number.isInteger(v) || Math.abs(v - Math.round(v)) < 1e-9) {
      return String(Math.round(v))
    }
    return String(v)
  }
  return String(v).trim()
}

/** Stringifikasi khusus identitas (NIS): bulatkan float Excel, buang notasi ilmiah. */
function cellStrId(v: unknown): string {
  if (v == null) return ''
  if (typeof v === 'number' && Number.isFinite(v)) {
    // Excel kadang simpan NIS sebagai float; ambil digit bulat aman hingga 15 digit
    const bulat = Math.round(v)
    if (Math.abs(v - bulat) < 1e-6) return String(bulat)
    // fallback: hapus non-digit dari representasi
    return String(v).replace(/[^0-9]/g, '')
  }
  const t = String(v).trim()
  // "12345.0" dari CSV
  if (/^\d+\.0+$/.test(t)) return t.replace(/\.0+$/, '')
  return t
}

function parseAngka(v: unknown): number | null {
  if (v == null || v === '') return null
  if (typeof v === 'number' && Number.isFinite(v)) return v
  const t = String(v).trim().replace(',', '.')
  if (!t) return null
  const n = Number(t)
  return Number.isFinite(n) ? n : NaN
}

function normalisasiNama(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Varian kunci NIS untuk toleransi leading zero / non-digit. */
function varianNis(raw: string): string[] {
  const t = raw.trim().toLowerCase()
  if (!t) return []
  const digits = t.replace(/\D/g, '')
  const noLead = digits.replace(/^0+/, '') || (digits ? '0' : '')
  const out = [t]
  if (digits && digits !== t) out.push(digits)
  if (noLead && noLead !== digits && noLead !== t) out.push(noLead)
  return out
}

function labelJenis(j: JenisNilaiSheet): string {
  if (j === 'slm') return 'SLM'
  if (j === 'sts') return 'STS'
  return 'SAS'
}

/** Bangun peta pencarian siswa: nis → id, nama → id. */
function indeksSiswa(siswa: SiswaTahsin[]): {
  byNis: Map<string, string>
  byNama: Map<string, string>
} {
  const byNis = new Map<string, string>()
  const byNama = new Map<string, string>()
  for (const s of siswa) {
    const nis = cellStrId(s.nis || s.nipd || s.nisn)
    for (const v of varianNis(nis)) {
      if (!byNis.has(v)) byNis.set(v, s.id)
    }
    const nama = normalisasiNama(s.nama)
    if (nama) {
      // Jika nama ganda, prioritaskan yang pertama (urut abjad biasanya)
      if (!byNama.has(nama)) byNama.set(nama, s.id)
    }
  }
  return { byNis, byNama }
}

function cariSiswaId(
  nisRaw: string,
  namaRaw: string,
  byNis: Map<string, string>,
  byNama: Map<string, string>,
): string | undefined {
  if (nisRaw) {
    for (const v of varianNis(nisRaw)) {
      const hit = byNis.get(v)
      if (hit) return hit
    }
  }
  if (namaRaw) {
    const n = normalisasiNama(namaRaw)
    if (n) {
      const hit = byNama.get(n)
      if (hit) return hit
    }
  }
  return undefined
}

/** Cocokkan header kolom ke id materi. */
function cocokkanKolom(
  header: string,
  kolom: KolomMateri[],
): string | null {
  const h = header.trim()
  if (!h || META_KEYS.has(h.toLowerCase())) return null

  // Exact label (mis. "STS 1", "TP 3")
  for (const k of kolom) {
    if (k.label.toLowerCase() === h.toLowerCase()) return k.id
  }
  // "TP 3" / "Materi 3" / "STS 3" / "SAS 3" / "SLM 3" / "M.3" / "M 3" / "3"
  const mNomor = h.match(/^(?:tp|materi|m|sts|sas|slm)?\s*[.\-–]?\s*(\d+)$/i)
  if (mNomor) {
    const n = Number(mNomor[1])
    const hit = kolom.find((k) => k.nomorTp === n)
    if (hit) return hit.id
  }
  // Nama TP (substring / exact)
  const hn = normalisasiNama(h)
  for (const k of kolom) {
    if (normalisasiNama(k.namaTp) === hn) return k.id
  }
  for (const k of kolom) {
    const kn = normalisasiNama(k.namaTp)
    if (kn && (hn.includes(kn) || kn.includes(hn))) return k.id
  }
  // id langsung (jarang, tapi aman)
  for (const k of kolom) {
    if (k.id === h) return k.id
  }
  return null
}

/**
 * Buat Blob .xlsx nilai (template atau terisi).
 * Sheet 1 = data; Sheet 2 = petunjuk.
 */
export async function buatExcelNilai(opts: OpsiSheetNilai): Promise<Blob> {
  const XLSX = await import('xlsx')
  const { jenis, mapel, kelas, semester, tahunAjaran, siswa, kolom, nilai, template } = opts

  const header1 = ['No', 'NIS', 'Nama', ...kolom.map((k) => k.label)]
  const header2 = ['', '', '', ...kolom.map((k) => k.namaTp)]

  const rows: (string | number | null)[][] = [
    header1,
    header2,
    ...siswa.map((s, i) => {
      // Paksa NIS sebagai teks agar Excel tidak mengubah ke angka/notasi ilmiah
      const nis = cellStrId(s.nis || s.nipd || s.nisn)
      const cells: (string | number | null)[] = [i + 1, nis, s.nama]
      for (const k of kolom) {
        if (template) {
          cells.push(null)
        } else {
          const v = nilai[k.id]?.[s.id]
          cells.push(v == null || Number.isNaN(v) ? null : Math.round(v * 100) / 100)
        }
      }
      return cells
    }),
  ]

  const ws = XLSX.utils.aoa_to_sheet(rows)

  // Tandai kolom NIS sebagai teks (hindari hilangnya leading zero saat dibuka ulang)
  const range = XLSX.utils.decode_range(ws['!ref'] || 'A1')
  for (let R = 2; R <= range.e.r; R++) {
    const addr = XLSX.utils.encode_cell({ r: R, c: 1 }) // kolom B = NIS
    const cell = ws[addr]
    if (cell && cell.v != null && cell.v !== '') {
      cell.t = 's'
      cell.v = String(cell.v)
      cell.z = '@'
    }
  }

  ws['!cols'] = [
    { wch: 5 },
    { wch: 14 },
    { wch: 28 },
    ...kolom.map(() => ({ wch: 10 })),
  ]
  // Freeze baris header + 3 kolom identitas (No, NIS, Nama)
  ws['!views'] = [{ state: 'frozen', xSplit: 3, ySplit: 2, topLeftCell: 'D3', activePane: 'bottomRight' }]

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, labelJenis(jenis))

  const petunjuk = XLSX.utils.aoa_to_sheet([
    [`Petunjuk pengisian nilai ${labelJenis(jenis)}`],
    [],
    [`Mapel: ${mapel}`],
    [`Kelas: ${kelas}`],
    [`Semester: ${semester} · Tahun ajaran: ${tahunAjaran}`],
    [],
    ['1. Jangan mengubah baris 1 (kode kolom) dan baris 2 (nama materi).'],
    ['2. Jangan mengubah urutan / nama siswa. Boleh mengisi kolom NIS jika kosong.'],
    ['3. Isi angka 0–100 di sel nilai. Desimal pakai titik atau koma (contoh 87.5).'],
    ['4. Sel kosong = tidak mengubah nilai yang sudah ada di sistem saat impor.'],
    ['5. Impor: buka halaman input nilai mapel ini → tombol Impor Excel → pilih file ini.'],
    ['6. Alternatif cepat: salin blok nilai di Excel → klik sel pertama di tabel web → Ctrl+V / Cmd+V.'],
    [],
    ['Kolom materi (urutan):'],
    ...kolom.map((k, i) => [`${i + 1}. ${k.label} — ${k.namaTp}`]),
  ])
  petunjuk['!cols'] = [{ wch: 72 }]
  XLSX.utils.book_append_sheet(wb, petunjuk, 'Petunjuk')

  const out = XLSX.write(wb, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer
  return new Blob([out], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
}

export async function unduhExcelNilai(opts: OpsiSheetNilai & { namaFile?: string }): Promise<void> {
  const blob = await buatExcelNilai(opts)
  const tag = opts.template ? 'template' : 'nilai'
  const nama =
    opts.namaFile ||
    `${tag}-${opts.jenis}-${opts.mapel.replace(/\s+/g, '-').toLowerCase()}-${opts.kelas.toLowerCase()}-s${opts.semester}.xlsx`
  unduhBlob(blob, nama)
}

export async function bacaExcelNilai(buf: ArrayBuffer | Uint8Array): Promise<unknown[][]> {
  const XLSX = await import('xlsx')
  const wb = XLSX.read(buf, { type: 'array', cellDates: false })
  const nama = wb.SheetNames[0]
  if (!nama) throw new Error('File Excel kosong.')
  return XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[nama]!, {
    header: 1,
    defval: null,
    raw: true,
  })
}

/**
 * Parse baris Excel (atau array 2D lain) menjadi nilai siap digabung ke draf.
 * Baris 1 = header label; baris 2 boleh nama materi (diabaikan jika tidak punya angka).
 */
export function parseNilaiExcelRows(
  rows: unknown[][],
  siswa: SiswaTahsin[],
  kolom: KolomMateri[],
): HasilParseNilai {
  const peringatan: string[] = []
  const tidakCocok: string[] = []
  const kolomTakDikenal: string[] = []
  const isi: Record<string, Record<string, number>> = {}
  let terisi = 0

  if (!rows.length) {
    return { isi, terisi: 0, siswaCocok: 0, tidakCocok, kolomTakDikenal, peringatan: ['File kosong.'] }
  }

  // Cari baris header (mengandung "Nama" atau "NIS")
  let headerIdx = -1
  for (let i = 0; i < Math.min(rows.length, 10); i++) {
    const row = rows[i]
    if (!Array.isArray(row)) continue
    const teks = row.map(cellStr).map((t) => t.toLowerCase())
    if (teks.some((t) => t === 'nama' || t === 'nama siswa' || t === 'nis' || t === 'nisn')) {
      headerIdx = i
      break
    }
  }
  if (headerIdx < 0) {
    // Fallback: baris pertama
    headerIdx = 0
    peringatan.push('Header "Nama"/"NIS" tidak ditemukan — baris 1 dipakai sebagai header.')
  }

  const headerRow = rows[headerIdx] as unknown[]
  const colMap: { idx: number; tpId: string }[] = []
  let idxNama = -1
  let idxNis = -1

  headerRow.forEach((cell, j) => {
    const h = cellStr(cell)
    if (!h) return
    const low = h.toLowerCase()
    if (low === 'nama' || low === 'nama siswa' || low === 'siswa' || low === 'name') {
      idxNama = j
      return
    }
    if (low === 'nis' || low === 'nisn') {
      idxNis = j
      return
    }
    if (META_KEYS.has(low)) return
    const tpId = cocokkanKolom(h, kolom)
    if (tpId) colMap.push({ idx: j, tpId })
    else kolomTakDikenal.push(h)
  })

  if (idxNama < 0 && idxNis < 0) {
    return {
      isi,
      terisi: 0,
      siswaCocok: 0,
      tidakCocok,
      kolomTakDikenal,
      peringatan: ['Kolom Nama atau NIS wajib ada di file.'],
    }
  }
  if (!colMap.length) {
    return {
      isi,
      terisi: 0,
      siswaCocok: 0,
      tidakCocok,
      kolomTakDikenal,
      peringatan: ['Tidak ada kolom materi yang dikenali. Unduh template dari halaman ini agar header cocok.'],
    }
  }

  const { byNis, byNama } = indeksSiswa(siswa)
  const dipakai = new Set<string>()

  // Kumpulkan baris data dulu (lewatkan baris header materi)
  type BarisData = { row: unknown[]; nis: string; nama: string; rowIdx: number }
  const barisData: BarisData[] = []

  for (let r = headerIdx + 1; r < rows.length; r++) {
    const row = rows[r]
    if (!Array.isArray(row)) continue

    // Lewati baris kedua jika isinya teks panjang (nama materi) tanpa angka nilai
    if (r === headerIdx + 1) {
      const sample = colMap.map((c) => parseAngka(row[c.idx]))
      const semuaKosongAtauNaN = sample.every((n) => n == null || Number.isNaN(n))
      const adaTeksPanjang = colMap.some((c) => cellStr(row[c.idx]).length > 15)
      const adaTeksNonAngka = colMap.some((c) => {
        const t = cellStr(row[c.idx])
        return t.length > 0 && parseAngka(row[c.idx]) == null
      })
      if (semuaKosongAtauNaN && (adaTeksPanjang || adaTeksNonAngka)) continue
    }

    const nis = idxNis >= 0 ? cellStrId(row[idxNis]) : ''
    const nama = idxNama >= 0 ? cellStr(row[idxNama]) : ''
    if (!nis && !nama) {
      // baris benar-benar kosong
      const adaNilai = colMap.some((c) => {
        const n = parseAngka(row[c.idx])
        return n != null && !Number.isNaN(n)
      })
      if (!adaNilai) continue
    }
    barisData.push({ row, nis, nama, rowIdx: r })
  }

  // Apakah urutan baris data selaras dengan daftar siswa (template tidak diacak)?
  const bisaPosisi =
    barisData.length === siswa.length &&
    siswa.length > 0 &&
    barisData.length > 0

  let dipakaiPosisi = 0

  for (let i = 0; i < barisData.length; i++) {
    const { row, nis, nama } = barisData[i]!

    let siswaId = cariSiswaId(nis, nama, byNis, byNama)

    // Fallback urutan: template app mengisi siswa terurut nama — jika NIS/nama gagal
    // tapi jumlah baris = jumlah siswa, pakai posisi (hanya bila belum dipakai).
    if (!siswaId && bisaPosisi) {
      const kandidat = siswa[i]
      if (kandidat && !dipakai.has(kandidat.id)) {
        siswaId = kandidat.id
        dipakaiPosisi++
      }
    }

    if (!siswaId) {
      tidakCocok.push(nama || nis || `baris ${i + 1}`)
      continue
    }
    if (dipakai.has(siswaId)) {
      peringatan.push(`Siswa ganda di file: ${nama || nis} — baris berikutnya diabaikan.`)
      continue
    }
    dipakai.add(siswaId)

    for (const { idx, tpId } of colMap) {
      const n = parseAngka(row[idx])
      if (n == null) continue // kosong = tidak ubah
      if (Number.isNaN(n) || n < 0 || n > 100) {
        peringatan.push(`Nilai tidak valid (${nama || nis}, kolom ${idx + 1}): diabaikan.`)
        continue
      }
      const rounded = Math.round(n * 100) / 100
      if (!isi[tpId]) isi[tpId] = {}
      isi[tpId]![siswaId] = rounded
      terisi++
    }
  }

  if (dipakaiPosisi > 0) {
    peringatan.push(
      `${dipakaiPosisi} siswa dicocokkan lewat urutan baris (NIS/nama di file tidak tepat). Periksa sekilas.`,
    )
  }

  // unshift: halaman input hanya menampilkan 2 peringatan pertama di toast
  if (kolomTakDikenal.length) {
    peringatan.unshift(
      `Kolom tidak dikenali: ${kolomTakDikenal.slice(0, 5).join(', ')}${kolomTakDikenal.length > 5 ? '…' : ''}`,
    )
  }
  if (tidakCocok.length) {
    peringatan.unshift(`${tidakCocok.length} baris siswa tidak cocok dengan daftar kelas.`)
  }

  return {
    isi,
    terisi,
    siswaCocok: dipakai.size,
    tidakCocok,
    kolomTakDikenal,
    peringatan,
  }
}

/**
 * Parse teks clipboard (TSV dari Excel / CSV) menjadi matriks string.
 */
export function parseClipboardMatrix(text: string): string[][] {
  const t = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  if (!t.trim()) return []
  // Deteksi delimiter: tab (Excel) vs koma/titik-koma
  const firstLine = t.split('\n')[0] || ''
  const delim = firstLine.includes('\t') ? '\t' : firstLine.includes(';') ? ';' : ','
  return t
    .split('\n')
    .filter((line, i, arr) => !(i === arr.length - 1 && line === '')) // trailing newline
    .map((line) => line.split(delim).map((c) => c.trim()))
}

/**
 * Terapkan matriks paste mulai dari sel (siswaIdx, tpIdx).
 * Mengembalikan patch draf: tpId → siswaId → teks.
 */
export function terapkanPasteNilai(
  matrix: string[][],
  siswaIdx: number,
  tpIdx: number,
  siswa: SiswaTahsin[],
  kolom: KolomMateri[],
): { patch: Record<string, Record<string, string>>; terisi: number; invalid: number } {
  const patch: Record<string, Record<string, string>> = {}
  let terisi = 0
  let invalid = 0

  for (let r = 0; r < matrix.length; r++) {
    const sIdx = siswaIdx + r
    if (sIdx < 0 || sIdx >= siswa.length) break
    const row = matrix[r] || []
    for (let c = 0; c < row.length; c++) {
      const tIdx = tpIdx + c
      if (tIdx < 0 || tIdx >= kolom.length) break
      const raw = row[c] ?? ''
      if (raw.trim() === '') continue
      const n = parseAngka(raw)
      if (n == null || Number.isNaN(n) || n < 0 || n > 100) {
        invalid++
        continue
      }
      const tpId = kolom[tIdx]!.id
      const siswaId = siswa[sIdx]!.id
      if (!patch[tpId]) patch[tpId] = {}
      // Simpan sebagai teks yang sama dengan input (tanpa trailing .0 berlebih)
      const teks = Number.isInteger(n) ? String(n) : String(Math.round(n * 100) / 100)
      patch[tpId]![siswaId] = teks
      terisi++
    }
  }
  return { patch, terisi, invalid }
}

/** Gabungkan patch isi (angka) ke state draf (teks). */
export function gabungIsiKeDraf(
  draf: Record<string, Record<string, string>>,
  isi: Record<string, Record<string, number>>,
): Record<string, Record<string, string>> {
  const next: Record<string, Record<string, string>> = { ...draf }
  for (const [tpId, bySiswa] of Object.entries(isi)) {
    next[tpId] = { ...(next[tpId] || {}) }
    for (const [siswaId, n] of Object.entries(bySiswa)) {
      next[tpId]![siswaId] = Number.isInteger(n) ? String(n) : String(n)
    }
  }
  return next
}

/** Helper: bangun KolomMateri dari daftar TP. */
export function kolomDariTp(daftar: TujuanPembelajaran[], prefix = 'TP'): KolomMateri[] {
  return daftar.map((t) => ({
    id: t.id,
    label: `${prefix} ${t.nomorTp}`,
    namaTp: t.namaTp,
    nomorTp: t.nomorTp,
  }))
}
