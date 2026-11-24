/**
 * Tugas kelompok — ANTIREGRESI §Tugas.Kelompok.
 *
 * Satu dokumen per kelompok di `lms_tugas_kelompok/{id}`.
 * - Siswa membentuk kelompok + pilih ketua (tanpa konfirmasi anggota — hasil diskusi di kelas).
 * - Hanya ketua yang boleh mengunggah pengumpulan; anggota otomatis dianggap terkumpul
 *   setelah ketua mengirim (status dihitung di klien dari keanggotaan + pengumpulan ketua).
 * - Tidak ada dokumen shadow pengumpulan untuk anggota (hindari regresi rules & storage).
 */

import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore'
import { db } from './firebase'
import type { SiswaDasar } from './siswaAuth'

export type AnggotaKelompok = {
  id: string
  nama: string
}

/** Dokumen `lms_tugas_kelompok/{id}`. */
export type TugasKelompokDok = {
  id: string
  tugasId: string
  kelas: string
  ketuaId: string
  ketuaNama: string
  /** Termasuk ketua. */
  anggotaIds: string[]
  anggotaList: AnggotaKelompok[]
  dibuatOleh: string
  dibuatMs: number
  diubahMs: number
}

function koleksi() {
  return collection(db, 'lms_tugas_kelompok')
}

function normalisasiAnggota(raw: unknown): AnggotaKelompok[] {
  if (!Array.isArray(raw)) return []
  const out: AnggotaKelompok[] = []
  const seen = new Set<string>()
  for (const x of raw) {
    if (!x || typeof x !== 'object') continue
    const o = x as Record<string, unknown>
    const id = String(o.id || '').trim()
    const nama = String(o.nama || '').trim()
    if (!id || seen.has(id)) continue
    seen.add(id)
    out.push({ id, nama: nama || id })
  }
  return out
}

function docKeKelompok(id: string, data: Record<string, unknown>): TugasKelompokDok {
  const anggotaList = normalisasiAnggota(data.anggotaList)
  const anggotaIds = Array.isArray(data.anggotaIds)
    ? (data.anggotaIds as unknown[]).map(String).filter(Boolean)
    : anggotaList.map((a) => a.id)
  // Pastikan ketua selalu di daftar
  const ketuaId = String(data.ketuaId || '')
  const ketuaNama = String(data.ketuaNama || '')
  if (ketuaId && !anggotaIds.includes(ketuaId)) {
    anggotaIds.unshift(ketuaId)
    if (!anggotaList.some((a) => a.id === ketuaId)) {
      anggotaList.unshift({ id: ketuaId, nama: ketuaNama || ketuaId })
    }
  }
  return {
    id,
    tugasId: String(data.tugasId || ''),
    kelas: String(data.kelas || '').toUpperCase(),
    ketuaId,
    ketuaNama,
    anggotaIds,
    anggotaList,
    dibuatOleh: String(data.dibuatOleh || ''),
    dibuatMs: typeof data.dibuatMs === 'number' ? data.dibuatMs : 0,
    diubahMs: typeof data.diubahMs === 'number' ? data.diubahMs : 0,
  }
}

/** Semua kelompok untuk satu tugas (guru + siswa sekelas). */
export async function daftarKelompokTugas(tugasId: string): Promise<TugasKelompokDok[]> {
  const snap = await getDocs(query(koleksi(), where('tugasId', '==', tugasId)))
  const list = snap.docs.map((d) => docKeKelompok(d.id, d.data() as Record<string, unknown>))
  list.sort((a, b) => a.ketuaNama.localeCompare(b.ketuaNama, 'id'))
  return list
}

/** Kelompok yang memuat siswa tertentu pada tugas ini (0 atau 1). */
export async function kelompokSaya(
  tugasId: string,
  siswaId: string,
): Promise<TugasKelompokDok | null> {
  if (!tugasId || !siswaId) return null
  const snap = await getDocs(
    query(
      koleksi(),
      where('tugasId', '==', tugasId),
      where('anggotaIds', 'array-contains', siswaId),
    ),
  )
  if (snap.empty) return null
  // Ambil yang pertama (seharusnya maksimal satu)
  const d = snap.docs[0]
  return docKeKelompok(d.id, d.data() as Record<string, unknown>)
}

export async function ambilKelompok(id: string): Promise<TugasKelompokDok | null> {
  const snap = await getDoc(doc(db, 'lms_tugas_kelompok', id))
  if (!snap.exists()) return null
  return docKeKelompok(snap.id, snap.data() as Record<string, unknown>)
}

/**
 * Buat kelompok baru. Pembuat otomatis menjadi ketua.
 * `anggota` boleh berisi teman yang dipilih (tanpa konfirmasi).
 * Ketua selalu dimasukkan.
 */
export async function buatKelompok(params: {
  tugasId: string
  kelas: string
  ketua: SiswaDasar
  anggotaLain: SiswaDasar[]
  maxAnggota: number
}): Promise<TugasKelompokDok> {
  const { tugasId, kelas, ketua, anggotaLain, maxAnggota } = params
  const max = Math.max(2, Math.min(12, maxAnggota || 4))
  const seen = new Set<string>([ketua.id])
  const list: AnggotaKelompok[] = [{ id: ketua.id, nama: ketua.nama || ketua.id }]
  for (const s of anggotaLain) {
    if (!s?.id || seen.has(s.id)) continue
    if (list.length >= max) break
    seen.add(s.id)
    list.push({ id: s.id, nama: s.nama || s.id })
  }
  const now = Date.now()
  const payload = {
    tugasId,
    kelas: String(kelas).toUpperCase(),
    ketuaId: ketua.id,
    ketuaNama: ketua.nama || ketua.id,
    anggotaIds: list.map((a) => a.id),
    anggotaList: list,
    dibuatOleh: ketua.id,
    dibuatMs: now,
    diubahMs: now,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  }
  const ref = await addDoc(koleksi(), payload)
  return { id: ref.id, ...payload, createdAt: undefined, updatedAt: undefined } as TugasKelompokDok
}

/**
 * Perbarui daftar anggota + (opsional) ketua.
 * Hanya boleh dipanggil oleh ketua saat ini (dicek di UI + rules).
 * Tidak ada konfirmasi dari anggota baru.
 */
export async function perbaruiAnggotaKelompok(params: {
  kelompokId: string
  ketua: SiswaDasar
  anggotaLain: SiswaDasar[]
  maxAnggota: number
}): Promise<TugasKelompokDok> {
  const { kelompokId, ketua, anggotaLain, maxAnggota } = params
  const max = Math.max(2, Math.min(12, maxAnggota || 4))
  const seen = new Set<string>([ketua.id])
  const list: AnggotaKelompok[] = [{ id: ketua.id, nama: ketua.nama || ketua.id }]
  for (const s of anggotaLain) {
    if (!s?.id || seen.has(s.id)) continue
    if (list.length >= max) break
    seen.add(s.id)
    list.push({ id: s.id, nama: s.nama || s.id })
  }
  const now = Date.now()
  await updateDoc(doc(db, 'lms_tugas_kelompok', kelompokId), {
    ketuaId: ketua.id,
    ketuaNama: ketua.nama || ketua.id,
    anggotaIds: list.map((a) => a.id),
    anggotaList: list,
    diubahMs: now,
    updatedAt: serverTimestamp(),
  })
  const updated = await ambilKelompok(kelompokId)
  if (!updated) throw new Error('Kelompok tidak ditemukan setelah diperbarui.')
  return updated
}

/** Anggota keluar dari kelompok (hapus diri sendiri). Jika ketua keluar → kelompok dihapus. */
export async function keluarKelompok(
  kelompok: TugasKelompokDok,
  siswaId: string,
): Promise<'hapus' | 'update'> {
  if (kelompok.ketuaId === siswaId) {
    await deleteDoc(doc(db, 'lms_tugas_kelompok', kelompok.id))
    return 'hapus'
  }
  const list = kelompok.anggotaList.filter((a) => a.id !== siswaId)
  const ids = list.map((a) => a.id)
  await updateDoc(doc(db, 'lms_tugas_kelompok', kelompok.id), {
    anggotaIds: ids,
    anggotaList: list,
    diubahMs: Date.now(),
    updatedAt: serverTimestamp(),
  })
  return 'update'
}

/** Guru/admin menghapus kelompok. */
export async function hapusKelompok(kelompokId: string): Promise<void> {
  await deleteDoc(doc(db, 'lms_tugas_kelompok', kelompokId))
}

/** Apakah siswa adalah ketua kelompok ini. */
export function isKetua(kelompok: TugasKelompokDok | null | undefined, siswaId: string): boolean {
  return !!kelompok && kelompok.ketuaId === siswaId
}

/** Apakah siswa anggota (termasuk ketua). */
export function isAnggota(kelompok: TugasKelompokDok | null | undefined, siswaId: string): boolean {
  return !!kelompok && kelompok.anggotaIds.includes(siswaId)
}
