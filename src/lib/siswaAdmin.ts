import {
  collection,
  doc,
  getDocs,
  query,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore'
import { db } from './firebase'
import type { JenjangTahsin, SiswaTahsin } from '../types/tahsin'
import { SEMUA_KELAS } from '../types/tahsin'

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

/** Normalisasi → document id = NIPD (atau NIS / NISN fallback) */
export function normalizeSiswa(raw: SiswaInput): SiswaTahsin {
  const nipd = clean(raw.nipd || raw.nis || raw.id)
  const nisn = clean(raw.nisn)
  const id = nipd || nisn
  if (!id) throw new Error('NIPD atau NISN wajib diisi')
  const nama = clean(raw.nama)
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
    tanggalLahir: clean(raw.tanggalLahir) || undefined,
    agama: clean(raw.agama) || 'Islam',
    alamat: clean(raw.alamat) || undefined,
    rt: clean(raw.rt) || undefined,
    rw: clean(raw.rw) || undefined,
    kelurahan: clean(raw.kelurahan) || undefined,
    kecamatan: clean(raw.kecamatan) || undefined,
    kodePos: clean(raw.kodePos) || undefined,
    hp: clean(raw.hp) || undefined,
    email: clean(raw.email) || undefined,
    ayahNama: clean(raw.ayahNama) || undefined,
    ayahPekerjaan: clean(raw.ayahPekerjaan) || undefined,
    ibuNama: clean(raw.ibuNama) || undefined,
    ibuPekerjaan: clean(raw.ibuPekerjaan) || undefined,
    sekolahAsal: clean(raw.sekolahAsal) || undefined,
    beratBadan: numOrNull(raw.beratBadan),
    tinggiBadan: numOrNull(raw.tinggiBadan),
  }
}

export async function listAllSiswa(kelasFilter?: string | null): Promise<SiswaTahsin[]> {
  if (kelasFilter) {
    const q = query(collection(db, 'siswa'), where('kelas', '==', kelasFilter))
    const snap = await getDocs(q)
    return snap.docs
      .map((d) => ({ id: d.id, ...d.data() }) as SiswaTahsin)
      .sort((a, b) => a.nama.localeCompare(b.nama, 'id'))
  }

  const results: SiswaTahsin[] = []
  for (let i = 0; i < SEMUA_KELAS.length; i += 10) {
    const chunk = SEMUA_KELAS.slice(i, i + 10)
    const q = query(collection(db, 'siswa'), where('kelas', 'in', [...chunk]))
    const snap = await getDocs(q)
    snap.docs.forEach((d) => results.push({ id: d.id, ...d.data() } as SiswaTahsin))
  }
  return results.sort((a, b) => {
    const c = a.kelas.localeCompare(b.kelas, 'id')
    return c !== 0 ? c : a.nama.localeCompare(b.nama, 'id')
  })
}

export async function upsertSiswa(raw: SiswaInput) {
  const s = normalizeSiswa(raw)
  const { id, ...data } = s
  await setDoc(doc(db, 'siswa', id), data, { merge: true })
  return s
}

export async function upsertSiswaBatch(rows: SiswaInput[]) {
  const normalized = rows.map(normalizeSiswa)
  let written = 0
  for (let i = 0; i < normalized.length; i += 400) {
    const chunk = normalized.slice(i, i + 400)
    const batch = writeBatch(db)
    for (const s of chunk) {
      const { id, ...data } = s
      batch.set(doc(db, 'siswa', id), data, { merge: true })
    }
    await batch.commit()
    written += chunk.length
  }
  return written
}

export async function setSiswaAktif(id: string, aktif: boolean) {
  await updateDoc(doc(db, 'siswa', id), { aktif })
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

export function downloadText(filename: string, content: string, mime = 'text/csv;charset=utf-8') {
  const blob = new Blob(['\ufeff' + content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
