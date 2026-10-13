/**
 * Parser & normalisasi impor Tujuan Pembelajaran (TP/KKTP).
 * Murni (tanpa Firebase) agar bisa diuji di Node.
 *
 * Format JSON yang diterima (fleksibel):
 * 1. Format sistem (disarankan):
 *    { version, tingkatan, fase?, items: [{ mapel, nomorTp, namaTp, cp?, tipe?, bobotSlm?, bobotSas?, levels? }] }
 * 2. Format ekspor kurikulum (file tujuan-pembelajaran-*.json):
 *    { version, className, phase, tp: [{ code, subjectKey, element, order, statement, ... }] }
 *    Field materiBuku diabaikan.
 */

import { LEVEL_RANGE_DEFAULT } from './akademikRumus'
import type { LevelKktp, TipeTp } from '../types/akademik'

/** Nama mapel resmi di sistem (sama dengan MAPEL_BAWAAN). */
export const SUBJECT_KEY_KE_MAPEL: Record<string, string> = {
  'al-islam': 'Al-Islam',
  'bahasa-indonesia': 'Bahasa Indonesia',
  'bahasa-inggris': 'Bahasa Inggris',
  'bahasa-sunda': 'Bahasa Sunda',
  'bahasa-arab': 'Bahasa Arab',
  ipas: 'IPAS',
  kemuhammadiyahan: 'Kemuhammadiyahan',
  matematika: 'Matematika',
  'pendidikan-pancasila': 'Pendidikan Pancasila',
  // Seni musik & rupa digabung ke Seni Budaya (satu mapel di sistem)
  'seni-musik': 'Seni Budaya',
  'seni-rupa': 'Seni Budaya',
  'seni-budaya': 'Seni Budaya',
  pjok: 'PJOK',
  informatika: 'Informatika',
}

export interface TpImportItem {
  mapel: string
  /** Kelas paralel, contoh "5A". Kunci unik bersama mapel. */
  kelas: string
  /** Turunan angka dari kelas (disimpan di Firestore untuk fase). */
  tingkatan?: string
  fase?: string
  nomorTp: number
  namaTp: string
  cp?: string
  tipe: TipeTp
  bobotSlm: number
  bobotSas: number
  levels: LevelKktp[]
  /** Metadata opsional (tidak disimpan ke Firestore kecuali di-extend). */
  code?: string
  source?: string
  element?: string
}

export interface TpImportHasil {
  items: TpImportItem[]
  /** Peringatan non-fatal (mapel tidak dikenal, nomor bentrok, dll.). */
  peringatan: string[]
  /** Ringkasan per mapel|kelas → jumlah item. */
  ringkasan: Record<string, number>
}

/** "5A" / "5a" → "5A". Mempertahankan huruf rombel. */
export function normalisasiKelas(v: unknown): string {
  const t = String(v ?? '').trim().toUpperCase().replace(/\s+/g, '')
  return t || ''
}

function clean(v: unknown): string {
  if (v == null) return ''
  return String(v).trim()
}

function asNum(v: unknown, fallback: number): number {
  const n = Number(v)
  return Number.isFinite(n) ? n : fallback
}

/** "5A" / "5" / 5 → "5" */
export function normalisasiTingkatan(v: unknown): string {
  const digits = String(v ?? '').replace(/[^0-9]/g, '')
  return digits || ''
}

export function normalisasiMapel(raw: unknown): string {
  const t = clean(raw)
  if (!t) return ''
  const key = t.toLowerCase().replace(/\s+/g, '-')
  if (SUBJECT_KEY_KE_MAPEL[key]) return SUBJECT_KEY_KE_MAPEL[key]
  // Sudah nama resmi?
  const resmi = Object.values(SUBJECT_KEY_KE_MAPEL).find((m) => m.toLowerCase() === t.toLowerCase())
  if (resmi) return resmi
  return t
}

function defaultLevels(): LevelKktp[] {
  return LEVEL_RANGE_DEFAULT.map((l) => ({ min: l.min, maks: l.maks, deskripsi: '' }))
}

function parseLevels(raw: unknown): LevelKktp[] {
  if (!Array.isArray(raw) || raw.length !== 4) return defaultLevels()
  return raw.map((l, i) => {
    const row = (l && typeof l === 'object' ? l : {}) as Record<string, unknown>
    const def = LEVEL_RANGE_DEFAULT[i]!
    return {
      min: asNum(row.min, def.min),
      maks: asNum(row.maks, def.maks),
      deskripsi: clean(row.deskripsi),
    }
  })
}

function parseTipe(raw: unknown): TipeTp {
  return clean(raw).toLowerCase() === 'kinerja' ? 'kinerja' : 'pengetahuan'
}

/**
 * Parse isi file JSON (sudah di-JSON.parse) menjadi daftar TP siap impor.
 * Tidak menulis ke Firestore.
 */
export function parseTpImport(data: unknown): TpImportHasil {
  const peringatan: string[] = []
  const items: TpImportItem[] = []

  if (!data || typeof data !== 'object') {
    return { items: [], peringatan: ['JSON tidak valid: akar harus objek.'], ringkasan: {} }
  }

  const root = data as Record<string, unknown>

  // --- Format kurikulum (tp[]) ---
  if (Array.isArray(root.tp)) {
    const kelasDefault = normalisasiKelas(root.className || root.kelas)
    const faseDefault = clean(root.phase || root.fase) || undefined

    // Nomor ulang per mapel|kelas (order di sumber tidak selalu 1..n per mapel)
    const counterPerMapel: Record<string, number> = {}

    for (const row of root.tp) {
      if (!row || typeof row !== 'object') continue
      const r = row as Record<string, unknown>
      if (r.active === false) continue

      const mapel = normalisasiMapel(r.subjectKey || r.mapel)
      if (!mapel) {
        peringatan.push(`Baris tanpa mapel dilewati (code=${clean(r.code)})`)
        continue
      }
      if (!SUBJECT_KEY_KE_MAPEL[clean(r.subjectKey).toLowerCase()] && !Object.values(SUBJECT_KEY_KE_MAPEL).includes(mapel)) {
        peringatan.push(`Mapel tidak standar: "${mapel}" (code=${clean(r.code)}) — tetap diimpor apa adanya.`)
      }

      const kelas = normalisasiKelas(r.className || r.kelas) || kelasDefault
      if (!kelas || !/[A-Z]/.test(kelas)) {
        peringatan.push(`Baris tanpa kelas rombel (contoh 5A) dilewati (code=${clean(r.code)})`)
        continue
      }

      const namaTp = clean(r.statement || r.namaTp || r.nama)
      if (!namaTp) {
        peringatan.push(`Baris tanpa rumusan TP dilewati (code=${clean(r.code)})`)
        continue
      }

      const kunciMapel = `${mapel}|${kelas}`
      counterPerMapel[kunciMapel] = (counterPerMapel[kunciMapel] || 0) + 1
      let nomorTp = asNum(r.order ?? r.nomorTp, 0)
      if (!Number.isInteger(nomorTp) || nomorTp < 1) nomorTp = counterPerMapel[kunciMapel]!

      const element = clean(r.element)
      const cp = clean(r.cp) || element

      items.push({
        mapel,
        kelas,
        tingkatan: normalisasiTingkatan(kelas),
        fase: clean(r.phase || r.fase) || faseDefault,
        nomorTp,
        namaTp,
        cp: cp || undefined,
        tipe: parseTipe(r.tipe),
        bobotSlm: asNum(r.bobotSlm, 60),
        bobotSas: asNum(r.bobotSas, 40),
        levels: parseLevels(r.levels),
        code: clean(r.code) || undefined,
        source: clean(r.source) || undefined,
        element: element || undefined,
      })
    }
  }

  // --- Format sistem (items[]) ---
  if (Array.isArray(root.items)) {
    const kelasDefault = normalisasiKelas(root.kelas || root.className)
    const faseDefault = clean(root.fase || root.phase) || undefined

    for (const row of root.items) {
      if (!row || typeof row !== 'object') continue
      const r = row as Record<string, unknown>
      const mapel = normalisasiMapel(r.mapel || r.subjectKey)
      const kelas = normalisasiKelas(r.kelas || r.className) || kelasDefault
      const namaTp = clean(r.namaTp || r.statement || r.nama)
      if (!mapel || !kelas || !namaTp) {
        peringatan.push('Item items[] tidak lengkap (mapel/kelas/namaTp) — dilewati.')
        continue
      }
      items.push({
        mapel,
        kelas,
        tingkatan: normalisasiTingkatan(kelas),
        fase: clean(r.fase || r.phase) || faseDefault,
        nomorTp: asNum(r.nomorTp ?? r.order, 0) || 1,
        namaTp,
        cp: clean(r.cp || r.element) || undefined,
        tipe: parseTipe(r.tipe),
        bobotSlm: asNum(r.bobotSlm, 60),
        bobotSas: asNum(r.bobotSas, 40),
        levels: parseLevels(r.levels),
        code: clean(r.code) || undefined,
        source: clean(r.source) || undefined,
        element: clean(r.element) || undefined,
      })
    }
  }

  // Array langsung di akar
  if (Array.isArray(data)) {
    for (const row of data) {
      if (!row || typeof row !== 'object') continue
      const r = row as Record<string, unknown>
      const mapel = normalisasiMapel(r.mapel || r.subjectKey)
      const kelas = normalisasiKelas(r.kelas || r.className)
      const namaTp = clean(r.namaTp || r.statement)
      if (!mapel || !kelas || !namaTp) continue
      items.push({
        mapel,
        kelas,
        tingkatan: normalisasiTingkatan(kelas),
        fase: clean(r.fase || r.phase) || undefined,
        nomorTp: asNum(r.nomorTp ?? r.order, 1),
        namaTp,
        cp: clean(r.cp || r.element) || undefined,
        tipe: parseTipe(r.tipe),
        bobotSlm: asNum(r.bobotSlm, 60),
        bobotSas: asNum(r.bobotSas, 40),
        levels: parseLevels(r.levels),
      })
    }
  }

  // Deteksi nomor ganda dalam file yang sama
  const seen = new Map<string, number>()
  for (const it of items) {
    const k = `${it.mapel}|${it.kelas}|${it.nomorTp}`
    const n = (seen.get(k) || 0) + 1
    seen.set(k, n)
    if (n > 1) {
      peringatan.push(`Nomor TP ${it.nomorTp} ganda di ${it.mapel} kelas ${it.kelas}.`)
    }
  }

  const ringkasan: Record<string, number> = {}
  for (const it of items) {
    const k = `${it.mapel}|${it.kelas}`
    ringkasan[k] = (ringkasan[k] || 0) + 1
  }

  if (items.length === 0) {
    peringatan.push('Tidak ada TP yang bisa diimpor. Pastikan file berisi array "tp" atau "items".')
  }

  return { items, peringatan, ringkasan }
}

/** Ubah hasil parse menjadi JSON siap unduh (format sistem). */
export function keFormatSistem(hasil: TpImportHasil, meta?: { version?: string }): object {
  const kelasSet = [...new Set(hasil.items.map((i) => i.kelas))]
  return {
    version: meta?.version || 'tp-import-1',
    kelas: kelasSet.length === 1 ? kelasSet[0] : kelasSet,
    items: hasil.items.map((it) => ({
      mapel: it.mapel,
      kelas: it.kelas,
      fase: it.fase,
      nomorTp: it.nomorTp,
      namaTp: it.namaTp,
      cp: it.cp || '',
      tipe: it.tipe,
      bobotSlm: it.bobotSlm,
      bobotSas: it.bobotSas,
      levels: it.levels,
      ...(it.code ? { code: it.code } : {}),
      ...(it.source ? { source: it.source } : {}),
    })),
  }
}

/* ==========================================================================
   Template Excel (untuk guru yang mengisi di spreadsheet)
   ========================================================================== */

/** Header resmi template — urutan kolom tetap. Jangan ubah tanpa migrasi. */
export const TP_EXCEL_HEADERS = [
  'mapel',
  'kelas',
  'nomorTp',
  'namaTp',
  'cp',
  'tipe',
  'bobotSlm',
  'bobotSas',
  'level1_min',
  'level1_maks',
  'level1_deskripsi',
  'level2_min',
  'level2_maks',
  'level2_deskripsi',
  'level3_min',
  'level3_maks',
  'level3_deskripsi',
  'level4_min',
  'level4_maks',
  'level4_deskripsi',
] as const

const HEADER_ALIAS: Record<string, (typeof TP_EXCEL_HEADERS)[number]> = {
  mapel: 'mapel',
  'mata pelajaran': 'mapel',
  subject: 'mapel',
  subjectkey: 'mapel',
  kelas: 'kelas',
  'rombongan belajar': 'kelas',
  rombel: 'kelas',
  tingkatan: 'kelas',  // legacy: jika hanya tingkatan, tetap masuk kolom kelas bila "5A"
  tingkat: 'kelas',
  nomortp: 'nomorTp',
  'nomor tp': 'nomorTp',
  nomor: 'nomorTp',
  order: 'nomorTp',
  namatp: 'namaTp',
  'nama tp': 'namaTp',
  statement: 'namaTp',
  rumusan: 'namaTp',
  cp: 'cp',
  'capaian pembelajaran': 'cp',
  element: 'cp',
  elemen: 'cp',
  tipe: 'tipe',
  jenis: 'tipe',
  bobotslm: 'bobotSlm',
  'bobot slm': 'bobotSlm',
  bobotsas: 'bobotSas',
  'bobot sas': 'bobotSas',
  level1_min: 'level1_min',
  level1_maks: 'level1_maks',
  level1_deskripsi: 'level1_deskripsi',
  level2_min: 'level2_min',
  level2_maks: 'level2_maks',
  level2_deskripsi: 'level2_deskripsi',
  level3_min: 'level3_min',
  level3_maks: 'level3_maks',
  level3_deskripsi: 'level3_deskripsi',
  level4_min: 'level4_min',
  level4_maks: 'level4_maks',
  level4_deskripsi: 'level4_deskripsi',
}

function cellStr(v: unknown): string {
  if (v == null) return ''
  if (typeof v === 'number' && Number.isFinite(v)) return String(v)
  return String(v).trim()
}

function itemKeBarisExcel(it: TpImportItem): (string | number)[] {
  const lv = it.levels?.length === 4 ? it.levels : defaultLevels()
  return [
    it.mapel,
    it.kelas,
    it.nomorTp,
    it.namaTp,
    it.cp || '',
    it.tipe,
    it.bobotSlm,
    it.bobotSas,
    lv[0]!.min,
    lv[0]!.maks,
    lv[0]!.deskripsi || '',
    lv[1]!.min,
    lv[1]!.maks,
    lv[1]!.deskripsi || '',
    lv[2]!.min,
    lv[2]!.maks,
    lv[2]!.deskripsi || '',
    lv[3]!.min,
    lv[3]!.maks,
    lv[3]!.deskripsi || '',
  ]
}

/** Baris contoh di template kosong agar guru tahu format isian. */
function barisContohTemplate(mapel?: string, kelas?: string): (string | number)[] {
  return itemKeBarisExcel({
    mapel: mapel || 'Matematika',
    kelas: (kelas || '5A').toUpperCase(),
    nomorTp: 1,
    namaTp: 'Contoh: Membaca, menulis, dan membandingkan bilangan cacah sampai 100.000',
    cp: 'Bilangan',
    tipe: 'pengetahuan',
    bobotSlm: 60,
    bobotSas: 40,
    levels: [
      { min: 0, maks: 60, deskripsi: 'Perlu bimbingan: belum konsisten membaca bilangan besar' },
      { min: 61, maks: 75, deskripsi: 'Cukup: membaca dan menulis bilangan dengan sedikit bantuan' },
      { min: 76, maks: 85, deskripsi: 'Baik: membaca, menulis, membandingkan bilangan secara mandiri' },
      { min: 86, maks: 100, deskripsi: 'Sangat baik: menguasai dan menjelaskan ke teman' },
    ],
  })
}

/**
 * Parse baris Excel (header + data) menjadi TpImportHasil.
 * Header boleh alias (mis. "Nama TP", "Mata Pelajaran").
 */
export function parseTpExcelRows(rows: unknown[][]): TpImportHasil {
  const peringatan: string[] = []
  const items: TpImportItem[] = []

  if (!rows.length) {
    return { items: [], peringatan: ['File Excel kosong.'], ringkasan: {} }
  }

  // Cari baris header (mengandung "mapel" atau "namaTp"/"nama tp")
  let headerIdx = -1
  let colIndex: Partial<Record<(typeof TP_EXCEL_HEADERS)[number], number>> = {}

  for (let i = 0; i < Math.min(rows.length, 20); i++) {
    const row = rows[i]
    if (!Array.isArray(row)) continue
    const map: Partial<Record<(typeof TP_EXCEL_HEADERS)[number], number>> = {}
    let hit = 0
    row.forEach((cell, j) => {
      const key = cellStr(cell).toLowerCase()
      const canon = HEADER_ALIAS[key]
      if (canon && map[canon] === undefined) {
        map[canon] = j
        hit++
      }
    })
    if (map.mapel !== undefined && (map.namaTp !== undefined || map.nomorTp !== undefined)) {
      headerIdx = i
      colIndex = map
      break
    }
    // Minimal: punya mapel + namaTp
    if (hit >= 2 && map.mapel !== undefined && map.namaTp !== undefined) {
      headerIdx = i
      colIndex = map
      break
    }
  }

  if (headerIdx < 0) {
    return {
      items: [],
      peringatan: [
        'Baris judul tidak ditemukan. Pastikan ada kolom "mapel" dan "namaTp" (unduh template resmi dari halaman Setup TP).',
      ],
      ringkasan: {},
    }
  }

  const get = (row: unknown[], field: (typeof TP_EXCEL_HEADERS)[number]): string => {
    const j = colIndex[field]
    if (j === undefined) return ''
    return cellStr(row[j])
  }

  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = rows[i]
    if (!Array.isArray(row) || !row.some((c) => cellStr(c) !== '')) continue

    const mapel = normalisasiMapel(get(row, 'mapel'))
    const kelas = normalisasiKelas(get(row, 'kelas'))
    const namaTp = get(row, 'namaTp')
    // Lewati baris contoh yang masih berawalan "Contoh:"
    if (namaTp.toLowerCase().startsWith('contoh:')) continue

    if (!mapel || !kelas || !namaTp) {
      peringatan.push(`Baris ${i + 1}: mapel/kelas/namaTp wajib — dilewati.`)
      continue
    }

    let nomorTp = asNum(get(row, 'nomorTp'), 0)
    if (!Number.isInteger(nomorTp) || nomorTp < 1) {
      // nomor otomatis per mapel nanti; sementara 0 → diisi di bawah
      nomorTp = 0
    }

    const levels = defaultLevels()
    for (let lv = 0; lv < 4; lv++) {
      const n = lv + 1
      const minS = get(row, `level${n}_min` as (typeof TP_EXCEL_HEADERS)[number])
      const maksS = get(row, `level${n}_maks` as (typeof TP_EXCEL_HEADERS)[number])
      const desk = get(row, `level${n}_deskripsi` as (typeof TP_EXCEL_HEADERS)[number])
      if (minS !== '') levels[lv]!.min = asNum(minS, levels[lv]!.min)
      if (maksS !== '') levels[lv]!.maks = asNum(maksS, levels[lv]!.maks)
      if (desk) levels[lv]!.deskripsi = desk
    }

    const bobotSlm = asNum(get(row, 'bobotSlm'), 60)
    let bobotSas = asNum(get(row, 'bobotSas'), 40)
    if (get(row, 'bobotSlm') !== '' && get(row, 'bobotSas') === '') bobotSas = 100 - bobotSlm

    items.push({
      mapel,
      kelas,
      tingkatan: normalisasiTingkatan(kelas),
      nomorTp,
      namaTp,
      cp: get(row, 'cp') || undefined,
      tipe: parseTipe(get(row, 'tipe')),
      bobotSlm,
      bobotSas,
      levels,
    })
  }

  // Isi nomorTp otomatis per mapel|kelas bila kosong
  const counter: Record<string, number> = {}
  for (const it of items) {
    const k = `${it.mapel}|${it.kelas}`
    if (!it.nomorTp || it.nomorTp < 1) {
      counter[k] = (counter[k] || 0) + 1
      it.nomorTp = counter[k]!
    } else {
      counter[k] = Math.max(counter[k] || 0, it.nomorTp)
    }
  }

  const seen = new Map<string, number>()
  for (const it of items) {
    const k = `${it.mapel}|${it.kelas}|${it.nomorTp}`
    const n = (seen.get(k) || 0) + 1
    seen.set(k, n)
    if (n > 1) peringatan.push(`Nomor TP ${it.nomorTp} ganda di ${it.mapel} kelas ${it.kelas}.`)
  }

  const ringkasan: Record<string, number> = {}
  for (const it of items) {
    const k = `${it.mapel}|${it.kelas}`
    ringkasan[k] = (ringkasan[k] || 0) + 1
  }

  if (!items.length) {
    peringatan.push('Tidak ada baris TP yang bisa diimpor dari Excel.')
  }

  return { items, peringatan, ringkasan }
}

/** Baca .xlsx/.xls → baris mentah sheet pertama (dynamic import xlsx). */
export async function bacaExcelTp(buf: ArrayBuffer | Uint8Array): Promise<unknown[][]> {
  const XLSX = await import('xlsx')
  const wb = XLSX.read(buf, { type: 'array', cellDates: true })
  const nama = wb.SheetNames[0]
  if (!nama) throw new Error('File Excel kosong.')
  return XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[nama]!, { header: 1, defval: null, raw: true })
}

/**
 * Buat file Excel template (kosong + 1 baris contoh) atau terisi data TP yang ada.
 * Mengembalikan Blob siap diunduh sebagai .xlsx.
 */
export async function buatExcelTp(opts?: {
  items?: TpImportItem[]
  /** Prefill mapel/kelas pada baris contoh (template kosong). */
  mapel?: string
  kelas?: string
  /** Nama sheet */
  sheetName?: string
}): Promise<Blob> {
  const XLSX = await import('xlsx')
  const items = opts?.items ?? []
  const data: (string | number)[][] = [
    [...TP_EXCEL_HEADERS],
    ...(items.length
      ? items.map(itemKeBarisExcel)
      : [barisContohTemplate(opts?.mapel, opts?.kelas)]),
  ]

  const ws = XLSX.utils.aoa_to_sheet(data)
  // Lebar kolom wajar untuk dibaca di Excel
  ws['!cols'] = [
    { wch: 22 }, // mapel
    { wch: 8 }, // kelas
    { wch: 9 }, // nomorTp
    { wch: 56 }, // namaTp
    { wch: 18 }, // cp
    { wch: 12 }, // tipe
    { wch: 10 },
    { wch: 10 },
    { wch: 10 },
    { wch: 10 },
    { wch: 36 },
    { wch: 10 },
    { wch: 10 },
    { wch: 36 },
    { wch: 10 },
    { wch: 10 },
    { wch: 36 },
    { wch: 10 },
    { wch: 10 },
    { wch: 36 },
  ]

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, opts?.sheetName || 'TP')

  // Petunjuk singkat di sheet kedua
  const petunjuk = XLSX.utils.aoa_to_sheet([
    ['Petunjuk pengisian template TP'],
    [],
    ['1. Jangan mengubah baris judul (header) di sheet TP.'],
    ['2. Kolom wajib: mapel, tingkatan, namaTp. nomorTp boleh dikosongkan (otomatis urut).'],
    ['3. kelas diisi rombel lengkap (contoh: 5A). TP kelas 5A tidak dipakai di 5B/5C.'],
    ['4. tipe: pengetahuan atau kinerja (default: pengetahuan).'],
    ['5. bobotSlm + bobotSas sebaiknya 100 (default 60 dan 40).'],
    ['6. Level 1–4: min/maks dan deskripsi capaian rapor (KKTP). Deskripsi boleh dikosongkan — dilengkapi nanti di website.'],
    ['7. Baris yang namaTp-nya diawali "Contoh:" diabaikan saat impor.'],
    ['8. Nama mapel harus sama dengan di sistem (Al-Islam, Bahasa Indonesia, Matematika, IPAS, …).'],
    [],
    ['Impor: Setup TP → Impor → pilih file .xlsx ini.'],
  ])
  petunjuk['!cols'] = [{ wch: 90 }]
  XLSX.utils.book_append_sheet(wb, petunjuk, 'Petunjuk')

  const out = XLSX.write(wb, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer
  return new Blob([out], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
}

/** Unduh Blob sebagai file di browser. */
export function unduhBlob(blob: Blob, namaFile: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = namaFile
  a.click()
  URL.revokeObjectURL(url)
}
