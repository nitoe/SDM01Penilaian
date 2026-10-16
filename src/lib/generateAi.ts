import { getFunctions, httpsCallable } from 'firebase/functions'
import { app } from './firebase'
import type { TipeTp } from '../types/akademik'

/** Hanya akun ini yang boleh memanggil generate TP/KKTP. */
export const UID_GENERATE_AI = 'v4fQXsqCzYUtHrqcDM0u48sxIfn1'

const REGION_FUNGSI = 'asia-southeast2'

export type ProviderAi = 'gemini' | 'openai'

export function bolehGenerateAi(uid: string | undefined): boolean {
  return uid === UID_GENERATE_AI
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
}): Promise<HasilTpAi[]> {
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
