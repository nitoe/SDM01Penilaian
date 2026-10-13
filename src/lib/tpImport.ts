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
  tingkatan: string
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
  /** Ringkasan per mapel|tingkatan → jumlah item. */
  ringkasan: Record<string, number>
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
    const tingkatanDefault = normalisasiTingkatan(root.className || root.tingkatan || root.kelas)
    const faseDefault = clean(root.phase || root.fase) || undefined

    // Nomor ulang per mapel (order di sumber tidak selalu 1..n per mapel)
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

      const tingkatan = normalisasiTingkatan(r.className || r.tingkatan) || tingkatanDefault
      if (!tingkatan) {
        peringatan.push(`Baris tanpa tingkatan dilewati (code=${clean(r.code)})`)
        continue
      }

      const namaTp = clean(r.statement || r.namaTp || r.nama)
      if (!namaTp) {
        peringatan.push(`Baris tanpa rumusan TP dilewati (code=${clean(r.code)})`)
        continue
      }

      const kunciMapel = `${mapel}|${tingkatan}`
      counterPerMapel[kunciMapel] = (counterPerMapel[kunciMapel] || 0) + 1
      // Prefer order bila unik & masuk akal; jika tidak, pakai urutan per mapel
      let nomorTp = asNum(r.order ?? r.nomorTp, 0)
      if (!Number.isInteger(nomorTp) || nomorTp < 1) nomorTp = counterPerMapel[kunciMapel]!
      // Jika order besar (mis. 91, 101) dari kurikulum BIN, tetap pakai — guru bisa rapikan

      const element = clean(r.element)
      const cp = clean(r.cp) || element

      items.push({
        mapel,
        tingkatan,
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
    const tingkatanDefault = normalisasiTingkatan(root.tingkatan || root.className)
    const faseDefault = clean(root.fase || root.phase) || undefined

    for (const row of root.items) {
      if (!row || typeof row !== 'object') continue
      const r = row as Record<string, unknown>
      const mapel = normalisasiMapel(r.mapel || r.subjectKey)
      const tingkatan = normalisasiTingkatan(r.tingkatan || r.className) || tingkatanDefault
      const namaTp = clean(r.namaTp || r.statement || r.nama)
      if (!mapel || !tingkatan || !namaTp) {
        peringatan.push('Item items[] tidak lengkap (mapel/tingkatan/namaTp) — dilewati.')
        continue
      }
      items.push({
        mapel,
        tingkatan,
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
      const tingkatan = normalisasiTingkatan(r.tingkatan || r.className)
      const namaTp = clean(r.namaTp || r.statement)
      if (!mapel || !tingkatan || !namaTp) continue
      items.push({
        mapel,
        tingkatan,
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
    const k = `${it.mapel}|${it.tingkatan}|${it.nomorTp}`
    const n = (seen.get(k) || 0) + 1
    seen.set(k, n)
    if (n > 1) {
      peringatan.push(`Nomor TP ${it.nomorTp} ganda di ${it.mapel} tingkat ${it.tingkatan}.`)
    }
  }

  const ringkasan: Record<string, number> = {}
  for (const it of items) {
    const k = `${it.mapel}|${it.tingkatan}`
    ringkasan[k] = (ringkasan[k] || 0) + 1
  }

  if (items.length === 0) {
    peringatan.push('Tidak ada TP yang bisa diimpor. Pastikan file berisi array "tp" atau "items".')
  }

  return { items, peringatan, ringkasan }
}

/** Ubah hasil parse menjadi JSON siap unduh (format sistem). */
export function keFormatSistem(hasil: TpImportHasil, meta?: { version?: string }): object {
  const tingkatanSet = [...new Set(hasil.items.map((i) => i.tingkatan))]
  return {
    version: meta?.version || 'tp-import-1',
    tingkatan: tingkatanSet.length === 1 ? tingkatanSet[0] : tingkatanSet,
    items: hasil.items.map((it) => ({
      mapel: it.mapel,
      tingkatan: it.tingkatan,
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
