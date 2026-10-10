import type { JenjangTahsin, SiswaTahsin } from '../types/tahsin'
import { SEMUA_KELAS } from '../types/tahsin'

/* Bagian murni (tanpa Firebase) dari manajemen data siswa: normalisasi, parser, pemisahan penyimpanan, dan
   pratinjau impor. Dipisah dari siswaAdmin.ts agar bisa diuji di Node. */

export type SiswaInput = Partial<SiswaTahsin> & {
  nama: string
  kelas: string
  /** minimal salah satu: nipd / nis / nisn */
  nipd?: string
  nis?: string
  nisn?: string
}

export function inferJenjang(kelas: string): JenjangTahsin {
  const n = parseInt(kelas, 10)
  if (!Number.isNaN(n) && n <= 2) return 'iqro'
  return 'quran'
}

function clean(v: unknown): string {
  if (v == null) return ''
  return String(v).trim()
}

function numOrNull(v: unknown): number | null {
  if (v == null || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

/**
 * Nama yang tertulis HURUF BESAR SEMUA → Title Case per kata (aturan v2: nama campuran tidak
 * disentuh, jadi aman dijalankan berulang; dipisah per kata supaya "Syafi'i" tidak jadi "Syafi'I").
 */
export function rapikanNama(v: unknown): string {
  const t = clean(v)
  if (!t || !/[A-Za-z]/.test(t) || t !== t.toUpperCase()) return t
  return t
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ')
}

/** Tanggal → "YYYY-MM-DD". Menerima ISO, d/m/yyyy, d-m-yyyy, d.m.yyyy, atau objek Date. Selain itu dikembalikan apa adanya. */
export function normalisasiTanggal(v: unknown): string {
  if (v instanceof Date && !Number.isNaN(v.getTime())) {
    const p = (n: number) => String(n).padStart(2, '0')
    return `${v.getFullYear()}-${p(v.getMonth() + 1)}-${p(v.getDate())}`
  }
  const t = clean(v)
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t
  const m = t.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/)
  if (m) return `${m[3]}-${m[2]!.padStart(2, '0')}-${m[1]!.padStart(2, '0')}`
  return t
}

/** Normalisasi → document id = NIPD (atau NIS / NISN fallback) */
export function normalizeSiswa(raw: SiswaInput): SiswaTahsin {
  const nipd = clean(raw.nipd || raw.nis || raw.id)
  const nisn = clean(raw.nisn)
  const id = nipd || nisn
  if (!id) throw new Error('NIPD atau NISN wajib diisi')
  const nama = rapikanNama(raw.nama)
  const kelas = clean(raw.kelas).toUpperCase()
  if (!nama) throw new Error('Nama wajib diisi')
  if (!kelas) throw new Error('Kelas wajib diisi')

  const jenjang = (raw.jenjang as JenjangTahsin) || inferJenjang(kelas)
  const jk = clean(raw.jk).toUpperCase().slice(0, 1)

  return {
    id,
    nipd: nipd || id,
    nis: nipd || id,
    nisn: nisn || undefined,
    nama,
    kelas,
    jenjang,
    aktif: raw.aktif !== false,
    tamatIqro: jenjang === 'iqro' ? Boolean(raw.tamatIqro) : false,
    jk: jk === 'L' || jk === 'P' ? jk : jk || undefined,
    tempatLahir: clean(raw.tempatLahir) || undefined,
    tanggalLahir: normalisasiTanggal(raw.tanggalLahir) || undefined,
    agama: clean(raw.agama) || 'Islam',
    alamat: clean(raw.alamat) || undefined,
    rt: clean(raw.rt) || undefined,
    rw: clean(raw.rw) || undefined,
    kelurahan: clean(raw.kelurahan) || undefined,
    kecamatan: clean(raw.kecamatan) || undefined,
    kodePos: clean(raw.kodePos) || undefined,
    hp: clean(raw.hp) || undefined,
    email: clean(raw.email) || undefined,
    ayahNama: rapikanNama(raw.ayahNama) || undefined,
    ayahPekerjaan: clean(raw.ayahPekerjaan) || undefined,
    ibuNama: rapikanNama(raw.ibuNama) || undefined,
    ibuPekerjaan: clean(raw.ibuPekerjaan) || undefined,
    sekolahAsal: clean(raw.sekolahAsal) || undefined,
    beratBadan: numOrNull(raw.beratBadan),
    tinggiBadan: numOrNull(raw.tinggiBadan),
  }
}

/** Header standar aplikasi */
export const CSV_HEADERS = [
  'nipd',
  'nisn',
  'nama',
  'kelas',
  'jk',
  'tempatLahir',
  'tanggalLahir',
  'agama',
  'alamat',
  'rt',
  'rw',
  'kelurahan',
  'kecamatan',
  'kodePos',
  'hp',
  'email',
  'ayahNama',
  'ayahPekerjaan',
  'ibuNama',
  'ibuPekerjaan',
  'sekolahAsal',
  'beratBadan',
  'tinggiBadan',
  'jenjang',
] as const

/** Alias header DAPODIK / Excel sekolah → field internal */
const HEADER_MAP: Record<string, string> = {
  nipd: 'nipd',
  'no induk': 'nipd',
  'nomor induk': 'nipd',
  nis: 'nipd',
  nisn: 'nisn',
  nama: 'nama',
  'nama siswa': 'nama',
  kelas: 'kelas',
  rombel: 'kelas',
  'rombel saat ini': 'kelas',
  jk: 'jk',
  'jenis kelamin': 'jk',
  'tempat lahir': 'tempatLahir',
  tempatlahir: 'tempatLahir',
  'tanggal lahir': 'tanggalLahir',
  tanggallahir: 'tanggalLahir',
  agama: 'agama',
  alamat: 'alamat',
  rt: 'rt',
  rw: 'rw',
  kelurahan: 'kelurahan',
  kecamatan: 'kecamatan',
  'kode pos': 'kodePos',
  kodepos: 'kodePos',
  hp: 'hp',
  telepon: 'hp',
  'e-mail': 'email',
  email: 'email',
  'ayah nama': 'ayahNama',
  'nama ayah': 'ayahNama',
  ayahnama: 'ayahNama',
  'ayah pekerjaan': 'ayahPekerjaan',
  'pekerjaan ayah': 'ayahPekerjaan',
  ayahpekerjaan: 'ayahPekerjaan',
  'ibu nama': 'ibuNama',
  'nama ibu': 'ibuNama',
  ibunama: 'ibuNama',
  'ibu pekerjaan': 'ibuPekerjaan',
  'pekerjaan ibu': 'ibuPekerjaan',
  ibupekerjaan: 'ibuPekerjaan',
  'sekolah asal': 'sekolahAsal',
  sekolahasal: 'sekolahAsal',
  'berat badan': 'beratBadan',
  beratbadan: 'beratBadan',
  'tinggi badan': 'tinggiBadan',
  tinggibadan: 'tinggiBadan',
  jenjang: 'jenjang',
}

function splitLine(line: string): string[] {
  // simple CSV with quotes
  const out: string[] = []
  let cur = ''
  let inQ = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!
    if (ch === '"') {
      inQ = !inQ
      continue
    }
    if (!inQ && (ch === ',' || ch === '\t' || ch === ';')) {
      out.push(cur.trim())
      cur = ''
      continue
    }
    cur += ch
  }
  out.push(cur.trim())
  return out
}

export function parseSiswaText(text: string): SiswaInput[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'))
  if (!lines.length) return []

  const headerCells = splitLine(lines[0]!).map((h) => h.toLowerCase().replace(/\s+/g, ' ').trim())
  const mapped = headerCells.map((h) => HEADER_MAP[h] || HEADER_MAP[h.replace(/\s/g, '')] || null)
  const hasHeader = mapped.some((m) => m === 'nama' || m === 'nipd' || m === 'nisn')

  if (!hasHeader) {
    // legacy: nis,nama,kelas[,jenjang]
    const rows: SiswaInput[] = []
    for (const line of lines) {
      const parts = splitLine(line)
      if (parts.length < 3) continue
      rows.push({
        nipd: parts[0],
        nama: parts[1],
        kelas: parts[2],
        jenjang: parts[3] as JenjangTahsin | undefined,
      })
    }
    return rows
  }

  const rows: SiswaInput[] = []
  for (const line of lines.slice(1)) {
    const parts = splitLine(line)
    const obj: Record<string, string> = {}
    mapped.forEach((key, i) => {
      if (key && parts[i] != null) obj[key] = parts[i]!
    })
    if (!obj.nama || !(obj.nipd || obj.nisn)) continue
    rows.push(obj as unknown as SiswaInput)
  }
  return rows
}

/** Parse baris Excel DAPODIK mentah (tanpa header map sempurna) — kolom tetap */
export function parseDapodikRows(rows: unknown[][]): SiswaInput[] {
  // expect: [no, rombel, nama, nipd, jk, nisn, ...]
  const out: SiswaInput[] = []
  for (const r of rows) {
    if (!r || r.length < 6) continue
    const kelas = clean(r[1])
    const nama = clean(r[2])
    const nipd = clean(r[3])
    if (!nama || !nipd || !kelas) continue
    if (/^no$/i.test(nipd) || /^nama$/i.test(nama)) continue
    out.push({
      nipd,
      nama,
      kelas,
      jk: clean(r[4]),
      nisn: clean(r[5]),
      tempatLahir: clean(r[6]),
      tanggalLahir: clean(r[7]),
      agama: clean(r[8]),
      alamat: clean(r[9]),
      rt: clean(r[10]),
      rw: clean(r[11]),
      kelurahan: clean(r[12]),
      kecamatan: clean(r[13]),
      kodePos: clean(r[14]),
      hp: clean(r[15]),
      email: clean(r[16]),
      ayahNama: clean(r[17]),
      ayahPekerjaan: clean(r[18]),
      ibuNama: clean(r[19]),
      ibuPekerjaan: clean(r[20]),
      sekolahAsal: clean(r[21]),
      beratBadan: numOrNull(r[22]) ?? undefined,
      tinggiBadan: numOrNull(r[23]) ?? undefined,
    })
  }
  return out
}

export function siswaToCsv(list: SiswaTahsin[]): string {
  const esc = (v: unknown) => {
    const s = v == null ? '' : String(v)
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const lines = [CSV_HEADERS.join(',')]
  for (const s of list) {
    lines.push(
      CSV_HEADERS.map((h) => {
        if (h === 'nipd') return esc(s.nipd || s.nis || s.id)
        return esc((s as unknown as Record<string, unknown>)[h])
      }).join(','),
    )
  }
  return lines.join('\n')
}


/* ==========================================================================
   Pemisahan penyimpanan: `siswa` (data dasar, dibaca semua guru) dan
   `identitas_siswa` (biodata sensitif, hanya admin + wali kelas).
   Nama kunci di identitas_siswa mengikuti v2 (namaAyah, alamatSiswa, jenisKelamin, ...).
   ========================================================================== */

/** Field yang tinggal di dokumen `siswa`. */
export const DASAR_KEYS = [
  'nipd', 'nis', 'nisn', 'nama', 'kelas', 'jenjang', 'aktif', 'tamatIqro', 'tempatLahir', 'tanggalLahir',
] as const

/** Kunci tampilan gabungan (SiswaTahsin) → kunci di `identitas_siswa`. */
export const IDENTITAS_KEY: Record<string, string> = {
  jk: 'jenisKelamin',
  agama: 'agama',
  alamat: 'alamatSiswa',
  rt: 'rt',
  rw: 'rw',
  kelurahan: 'kelurahan',
  kecamatan: 'kecamatan',
  kodePos: 'kodePos',
  hp: 'hp',
  email: 'email',
  ayahNama: 'namaAyah',
  ayahPekerjaan: 'pekerjaanAyah',
  ibuNama: 'namaIbu',
  ibuPekerjaan: 'pekerjaanIbu',
  sekolahAsal: 'sekolahAsal',
  beratBadan: 'beratBadan',
  tinggiBadan: 'tinggiBadan',
}

const adaIsi = (v: unknown) => v !== undefined && v !== null && v !== ''

/** Pisahkan satu siswa (tampilan gabungan) menjadi dokumen dasar dan dokumen identitas. Field kosong dibuang. */
export function pisahSiswa(s: SiswaTahsin): {
  dasar: Record<string, unknown>
  identitas: Record<string, unknown>
} {
  const sumber = s as unknown as Record<string, unknown>
  const dasar: Record<string, unknown> = {}
  for (const k of DASAR_KEYS) if (adaIsi(sumber[k])) dasar[k] = sumber[k]
  const identitas: Record<string, unknown> = {}
  for (const [k, kid] of Object.entries(IDENTITAS_KEY)) if (adaIsi(sumber[k])) identitas[kid] = sumber[k]
  return { dasar, identitas }
}

/** Gabungkan dokumen dasar + identitas menjadi satu objek tampilan. Nilai identitas menang atas sisa field lama di `siswa`. */
export function gabungSiswa(dasar: SiswaTahsin, identitas?: Record<string, unknown> | null): SiswaTahsin {
  if (!identitas) return dasar
  const out = { ...dasar } as unknown as Record<string, unknown>
  for (const [k, kid] of Object.entries(IDENTITAS_KEY)) if (adaIsi(identitas[kid])) out[k] = identitas[kid]
  return out as unknown as SiswaTahsin
}

/* ==========================================================================
   Impor: pratinjau (murni, tanpa Firestore) → hasilnya dijalankan oleh siswaAdmin.jalankanImpor
   ========================================================================== */

export type StatusImpor = 'baru' | 'update' | 'error'

export interface BarisImpor {
  /** Nomor baris data (mulai 1) */
  baris: number
  s?: SiswaTahsin
  status: StatusImpor
  pesan?: string
  /** True bila field aktif/tamatIqro memang ada di sumber (kalau tidak, data lama tidak ditimpa) */
  adaAktif: boolean
  adaTamat: boolean
}

export interface HasilPraLihat {
  items: BarisImpor[]
  baru: number
  update: number
  error: number
  perKelas: Record<string, number>
}

/**
 * Klasifikasi baris impor terhadap data yang sudah ada.
 * Menolak: kolom wajib kosong, kelas tidak dikenal, NIPD ganda di file, NISN ganda di file, dan NISN yang sudah
 * dipakai siswa LAIN (NIPD berbeda) — pencegah duplikat siswa (pelajaran v2 antiregresi §16).
 */
export function praLihatImpor(rows: SiswaInput[], existing: Map<string, SiswaTahsin>): HasilPraLihat {
  const items: BarisImpor[] = []
  const idDiFile = new Set<string>()
  const nisnDiFile = new Map<string, string>()
  const nisnLama = new Map<string, SiswaTahsin>()
  for (const e of existing.values()) if (e.nisn) nisnLama.set(e.nisn, e)

  rows.forEach((raw, i) => {
    const baris = i + 1
    const adaAktif = raw.aktif !== undefined
    const adaTamat = raw.tamatIqro !== undefined
    try {
      const s = normalizeSiswa(raw)
      let pesan: string | undefined
      if (!(SEMUA_KELAS as readonly string[]).includes(s.kelas)) pesan = `Kelas "${s.kelas}" tidak dikenal`
      else if (idDiFile.has(s.id)) pesan = `NIPD ${s.id} muncul lebih dari sekali di file`
      else if (s.nisn && nisnDiFile.has(s.nisn)) pesan = `NISN sama dengan baris NIPD ${nisnDiFile.get(s.nisn)}`
      else if (s.nisn && !existing.has(s.id) && nisnLama.has(s.nisn)) {
        pesan = `NISN sudah dipakai siswa lain (NIPD ${nisnLama.get(s.nisn)!.id}) — kemungkinan duplikat`
      }
      idDiFile.add(s.id)
      if (s.nisn) nisnDiFile.set(s.nisn, s.id)
      items.push({ baris, s, status: pesan ? 'error' : existing.has(s.id) ? 'update' : 'baru', pesan, adaAktif, adaTamat })
    } catch (e) {
      items.push({ baris, status: 'error', pesan: e instanceof Error ? e.message : 'Baris tidak valid', adaAktif, adaTamat })
    }
  })

  const perKelas: Record<string, number> = {}
  for (const it of items) if (it.status !== 'error' && it.s) perKelas[it.s.kelas] = (perKelas[it.s.kelas] ?? 0) + 1
  return {
    items,
    baru: items.filter((x) => x.status === 'baru').length,
    update: items.filter((x) => x.status === 'update').length,
    error: items.filter((x) => x.status === 'error').length,
    perKelas,
  }
}

/** Susunan kolom ekspor DAPODIK "Daftar Peserta Didik" yang didukung (baris judul + sub-judul Ayah/Ibu). */
const KOLOM_DAPODIK: [number, string][] = [
  [1, 'rombel saat ini'], [2, 'nama'], [3, 'nipd'], [4, 'jk'], [5, 'nisn'], [6, 'tempat lahir'], [7, 'tanggal lahir'],
  [8, 'agama'], [9, 'alamat'], [15, 'hp'], [16, 'e-mail'], [17, 'data ayah'], [19, 'data ibu'], [21, 'sekolah asal'],
]

/** Baca file .xlsx/.xls (ArrayBuffer) → baris mentah sheet pertama. Pustaka dimuat saat dibutuhkan agar bundle awal kecil. */
export async function bacaExcel(buf: ArrayBuffer | Uint8Array): Promise<unknown[][]> {
  const XLSX = await import('xlsx')
  const wb = XLSX.read(buf, { type: 'array', cellDates: true })
  const nama = wb.SheetNames[0]
  if (!nama) throw new Error('File Excel kosong.')
  return XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[nama]!, { header: 1, defval: null, raw: true })
}

/** Pastikan susunan kolom sesuai ekspor Dapodik sebelum dibaca per posisi. Melempar Error berisi penjelasan. */
export function validasiLayoutDapodik(rows: unknown[][]): void {
  const judul = rows.find((r) => r && r.some((c) => String(c ?? '').trim().toLowerCase() === 'nipd'))
  if (!judul) throw new Error('Baris judul (berisi kolom NIPD) tidak ditemukan. Pakai file ekspor "Daftar Peserta Didik" dari Dapodik.')
  const salah = KOLOM_DAPODIK.filter(([i, nama]) => String(judul[i] ?? '').trim().toLowerCase() !== nama)
  if (salah.length) {
    throw new Error(
      `Susunan kolom tidak sesuai ekspor Dapodik. Kolom ke-${salah[0]![0] + 1} seharusnya "${salah[0]![1]}" tetapi terbaca "${String(judul[salah[0]![0]] ?? '')}".`,
    )
  }
}
