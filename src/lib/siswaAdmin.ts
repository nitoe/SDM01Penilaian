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

export interface SiswaInput {
  id?: string
  nis: string
  nama: string
  kelas: string
  jenjang?: JenjangTahsin
  aktif?: boolean
  tamatIqro?: boolean
}

/** Infer jenjang from kelas: 1–2 → iqro, 3–6 → quran */
export function inferJenjang(kelas: string): JenjangTahsin {
  const n = parseInt(kelas, 10)
  if (!Number.isNaN(n) && n <= 2) return 'iqro'
  return 'quran'
}

export function normalizeSiswa(raw: SiswaInput): Omit<SiswaTahsin, 'id'> & { id: string } {
  const nis = String(raw.nis || '').trim()
  const nama = String(raw.nama || '').trim()
  const kelas = String(raw.kelas || '').trim().toUpperCase()
  if (!nis) throw new Error('NIS wajib diisi')
  if (!nama) throw new Error('Nama wajib diisi')
  if (!kelas) throw new Error('Kelas wajib diisi')

  const jenjang = raw.jenjang || inferJenjang(kelas)
  return {
    id: nis,
    nis,
    nama,
    kelas,
    jenjang,
    aktif: raw.aktif !== false,
    tamatIqro: jenjang === 'iqro' ? Boolean(raw.tamatIqro) : false,
  }
}

/** Ambil semua siswa (admin). Opsional filter kelas. */
export async function listAllSiswa(kelasFilter?: string | null): Promise<SiswaTahsin[]> {
  if (kelasFilter) {
    const q = query(collection(db, 'siswa'), where('kelas', '==', kelasFilter))
    const snap = await getDocs(q)
    return snap.docs
      .map((d) => ({ id: d.id, ...d.data() }) as SiswaTahsin)
      .sort((a, b) => a.nama.localeCompare(b.nama, 'id'))
  }

  // Admin: query per kelas agar tetap cocok dengan rules & skala
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

/** Upsert satu siswa (ID dokumen = NIS). */
export async function upsertSiswa(raw: SiswaInput) {
  const s = normalizeSiswa(raw)
  const { id, ...data } = s
  await setDoc(doc(db, 'siswa', id), data, { merge: true })
  return s
}

/** Batch upsert (maks ~400 per batch Firestore). */
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

/** Parse teks CSV/TSV: nis,nama,kelas[,jenjang] */
export function parseSiswaText(text: string): SiswaInput[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'))

  if (!lines.length) return []

  const first = lines[0]!.toLowerCase()
  const hasHeader =
    first.includes('nis') || first.includes('nama') || first.includes('kelas')
  const dataLines = hasHeader ? lines.slice(1) : lines

  const rows: SiswaInput[] = []
  for (const line of dataLines) {
    const parts = line.includes('\t')
      ? line.split('\t')
      : line.split(',').map((p) => p.trim())
    if (parts.length < 3) continue
    const [nis, nama, kelas, jenjangRaw] = parts
    const jenjang =
      jenjangRaw && /^(iqro|quran)$/i.test(jenjangRaw.trim())
        ? (jenjangRaw.trim().toLowerCase() as JenjangTahsin)
        : undefined
    rows.push({
      nis: nis!.trim(),
      nama: nama!.trim(),
      kelas: kelas!.trim(),
      jenjang,
    })
  }
  return rows
}

/** Data demo kecil untuk uji coba */
export const DEMO_SISWA: SiswaInput[] = [
  { nis: '24257021', nama: 'Keysa Mufida Faried', kelas: '3B', jenjang: 'quran' },
  { nis: '24257042', nama: 'Rheina Haura Bilqis', kelas: '3B', jenjang: 'quran' },
  { nis: '24257018', nama: 'Muhammad Idlal Al Matin', kelas: '4A', jenjang: 'quran' },
  { nis: '24257033', nama: 'Zein Zaenal Muttaqin', kelas: '2A', jenjang: 'iqro' },
  { nis: '24257009', nama: 'Muhammad Fathir Alfath', kelas: '1A', jenjang: 'iqro' },
  { nis: '24257051', nama: 'Muhammad Bilal Nur Ihsan', kelas: '1B', jenjang: 'iqro' },
]
