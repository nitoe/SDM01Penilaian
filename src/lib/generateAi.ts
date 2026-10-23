import { getFunctions, httpsCallable } from 'firebase/functions'
import { app, auth } from './firebase'
import type { TipeTp } from '../types/akademik'

/** Hanya akun ini yang boleh memanggil generate TP/KKTP. UID dan email harus cocok keduanya. */
export const UID_GENERATE_AI = 'v4fQXsqCzYUtHrqcDM0u48sxIfn1'
export const EMAIL_GENERATE_AI = 'arif.azwar79@gmail.com'

const REGION_FUNGSI = 'asia-southeast2'

export type ProviderAi = 'gemini' | 'openai'

/**
 * Penentu tampilan fitur AI. Hanya kosmetik: yang benar-benar menjaga API key adalah Cloud Function
 * (`bolehPemanggilAi` di functions/generateAi.js). Dicek terhadap sesi Firebase Auth yang aktif,
 * bukan hanya argumen, sehingga data profil Firestore tidak bisa membuat fitur ini muncul.
 */
export function bolehGenerateAi(uid: string | undefined): boolean {
  if (!uid || uid !== UID_GENERATE_AI) return false
  const sesi = auth.currentUser
  if (!sesi || sesi.uid !== UID_GENERATE_AI) return false
  return (sesi.email ?? '').trim().toLowerCase() === EMAIL_GENERATE_AI
}

function pastikanBerhak() {
  if (!bolehGenerateAi(auth.currentUser?.uid)) {
    throw new Error('Fitur ini tidak tersedia untuk akun Anda.')
  }
}

export interface HasilTpAi {
  namaTp: string
  tipe: TipeTp
  bobotSlm: number
  bobotSas: number
}

function pesan(err: unknown): string {
  if (err && typeof err === 'object' && 'message' in err) {
    const m = String((err as { message: unknown }).message || '')
    if (m && m !== 'internal') return m
  }
  return 'Gagal menghubungi layanan AI.'
}

export async function generateTpAi(input: {
  provider: ProviderAi
  mapel: string
  kelas: string
  fase: string
  elemen: string
  teksCp: string
  disiplinSeni?: string
  /** IPAS: teks lengkap elemen Keterampilan Proses fase yang sama. */
  keterampilanProses?: string
  /** IPAS: satu unit pemahaman (sudah dipisah ;). Jika diisi, AI membuat tepat 1 TP. */
  pemahamanUnit?: string
}): Promise<HasilTpAi[]> {
  pastikanBerhak()
  const panggil = httpsCallable<typeof input, { tp: HasilTpAi[] }>(
    getFunctions(app, REGION_FUNGSI),
    'generateTpAi',
  )
  try {
    const res = await panggil(input)
    return res.data.tp
  } catch (e) {
    throw new Error(pesan(e))
  }
}

export async function generateKktpAi(input: {
  provider: ProviderAi
  mapel: string
  kelas: string
  namaTp: string
  tipe: TipeTp
  teksCp: string
}): Promise<string[]> {
  pastikanBerhak()
  const panggil = httpsCallable<typeof input, { deskripsi: string[] }>(
    getFunctions(app, REGION_FUNGSI),
    'generateKktpAi',
  )
  try {
    const res = await panggil(input)
    return res.data.deskripsi
  } catch (e) {
    throw new Error(pesan(e))
  }
}


/** Katalog TP ringkas untuk pemilihan AI (id harus ada di Firestore). */
export interface KatalogTpStem {
  id: string
  mapel: string
  namaTp: string
}

export interface KatalogDplStem {
  id: string
  nama: string
  /** Bank deskripsi level kelas (4 kalimat); kosong bila belum diisi wali kelas. */
  levelDeskripsi?: string[]
}

/** Satu aspek rubrik hasil AI: 4 deskripsi untuk rentang 0–74 (D), 75–83 (C), 84–89 (B), 90–100 (A). */
export interface RubrikAiStem {
  nama: string
  mapel?: string
  deskripsiRentang: string[]
}

/** Usulan 4 deskripsi level untuk DPL terpilih yang bank-nya masih kosong. */
export interface DplLevelAiStem {
  dplId: string
  levelDeskripsi: string[]
}

export interface HasilStemAi {
  judul: string
  deskripsi: string
  jumlahPertemuan: number
  scaffolding: string[]
  mapelTerlibat: {
    tpId: string
    mapel: string
    namaTp?: string
    jenisNilai: 'SLM' | 'SAS'
  }[]
  dplId: string[]
  daftarNilai: string[]
  rubrik: RubrikAiStem[]
  dplLevel: DplLevelAiStem[]
}

/**
 * Rancang Proyek STEM dari keterangan aktivitas saja.
 * Server memilih mapel/TP & 3 DPL HANYA dari katalog yang dikirim (bukan mengarang id), lalu
 * menyusun rubrik berdeskripsi. Katalog DPL berisi SEMUA DPL kelas, aktif maupun belum.
 * Hanya akun UID_GENERATE_AI + EMAIL_GENERATE_AI.
 */
export async function generateStemAi(input: {
  provider: ProviderAi
  ide: string
  kelas: string
  katalogTp: KatalogTpStem[]
  katalogDpl: KatalogDplStem[]
}): Promise<HasilStemAi> {
  pastikanBerhak()
  const panggil = httpsCallable<typeof input, HasilStemAi>(
    getFunctions(app, REGION_FUNGSI),
    'generateStemAi',
  )
  try {
    const res = await panggil(input)
    return res.data
  } catch (e) {
    throw new Error(pesan(e))
  }
}

/** Predikat huruf untuk isi otomatis nilai instrumen proyek STEM. */
export const PREDIKAT_NILAI_PROYEK = [
  'D',
  'D+',
  'C-',
  'C',
  'C+',
  'B-',
  'B',
  'B+',
  'A-',
  'A',
  'A+',
] as const

export type PredikatNilaiProyek = (typeof PREDIKAT_NILAI_PROYEK)[number]

/**
 * Isi skor 0–100 per aspek rubrik untuk satu siswa, selaras predikat huruf.
 * Hanya UID_GENERATE_AI + EMAIL_GENERATE_AI.
 */
export async function generateNilaiProyekAi(input: {
  provider: ProviderAi
  predikat: PredikatNilaiProyek | string
  namaSiswa: string
  aspek: { id: string; nama: string; mapel?: string }[]
}): Promise<{ nilai: Record<string, number> }> {
  pastikanBerhak()
  const panggil = httpsCallable<typeof input, { nilai: Record<string, number> }>(
    getFunctions(app, REGION_FUNGSI),
    'generateNilaiProyekAi',
  )
  try {
    const res = await panggil(input)
    return res.data
  } catch (e) {
    throw new Error(pesan(e))
  }
}
