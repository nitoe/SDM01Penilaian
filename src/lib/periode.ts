import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
} from 'firebase/firestore'
import { db } from './firebase'
import type { PeriodeAkademik, Semester } from '../types/periode'
import { buatIdPeriode } from '../types/periode'

const KOLEKSI = 'periode_akademik'

function kePeriode(id: string, data: Record<string, unknown>): PeriodeAkademik {
  return {
    id,
    tahunAjaran: String(data.tahunAjaran ?? ''),
    semester: data.semester === '2' ? '2' : '1',
    aktif: data.aktif !== false,
    label: typeof data.label === 'string' ? data.label : undefined,
    tglRaporKelas1sampai6Sem1:
      typeof data.tglRaporKelas1sampai6Sem1 === 'string'
        ? data.tglRaporKelas1sampai6Sem1
        : undefined,
    tglRaporKelas1sampai5Sem2:
      typeof data.tglRaporKelas1sampai5Sem2 === 'string'
        ? data.tglRaporKelas1sampai5Sem2
        : undefined,
    tglRaporKelas6Sem2:
      typeof data.tglRaporKelas6Sem2 === 'string' ? data.tglRaporKelas6Sem2 : undefined,
    kotaRapor: typeof data.kotaRapor === 'string' ? data.kotaRapor : undefined,
    isDefault: data.isDefault === true,
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
  }
}

function urutkan(list: PeriodeAkademik[]): PeriodeAkademik[] {
  return [...list].sort((a, b) => {
    // Tahun ajaran desc (2026/2027 > 2025/2026)
    if (a.tahunAjaran !== b.tahunAjaran) return b.tahunAjaran.localeCompare(a.tahunAjaran)
    // Semester desc (2 > 1)
    return Number(b.semester) - Number(a.semester)
  })
}

/**
 * Semua periode (untuk admin).
 * Sort di klien — tidak butuh composite index Firestore.
 * Ini menghindari error "Gagal memuat daftar periode" saat indeks belum di-deploy.
 */

/**
 * Sinkronkan config/akademik agar kode legacy (yang masih baca semesterAktif/tahunAjaran)
 * selalu cocok dengan periode default.
 * Hanya field konteks periode yang diubah — identitas sekolah tidak disentuh.
 */
async function sinkronConfigDariPeriode(p: {
  tahunAjaran: string
  semester: Semester
  kotaRapor?: string
  tglRaporKelas1sampai6Sem1?: string
  tglRaporKelas1sampai5Sem2?: string
  tglRaporKelas6Sem2?: string
}): Promise<void> {
  const data: Record<string, unknown> = {
    tahunAjaran: p.tahunAjaran.trim(),
    semesterAktif: p.semester,
    updatedAt: serverTimestamp(),
  }
  if (p.kotaRapor?.trim()) data.kotaRapor = p.kotaRapor.trim()
  // Field legacy tanggal rapor (masih dibaca beberapa path lama)
  if (p.semester === '1' && p.tglRaporKelas1sampai6Sem1?.trim()) {
    data.tglRapor = p.tglRaporKelas1sampai6Sem1.trim()
  }
  if (p.semester === '2') {
    if (p.tglRaporKelas1sampai5Sem2?.trim()) data.tglRapor1sampai5 = p.tglRaporKelas1sampai5Sem2.trim()
    if (p.tglRaporKelas6Sem2?.trim()) data.tglRapor = p.tglRaporKelas6Sem2.trim()
  }
  await setDoc(doc(db, 'config', 'akademik'), data, { merge: true })
}

export async function listSemuaPeriode(): Promise<PeriodeAkademik[]> {
  const snap = await getDocs(collection(db, KOLEKSI))
  const list = snap.docs.map((d) => kePeriode(d.id, d.data() as Record<string, unknown>))
  return urutkan(list)
}

/**
 * Periode aktif saja.
 * Query where aktif==true agar bisa dibaca di halaman login (sebelum auth)
 * sesuai rules: read diizinkan bila resource.data.aktif == true.
 */
export async function listPeriodeAktif(): Promise<PeriodeAkademik[]> {
  const snap = await getDocs(query(collection(db, KOLEKSI), where('aktif', '==', true)))
  const list = snap.docs.map((d) => kePeriode(d.id, d.data() as Record<string, unknown>))
  return urutkan(list)
}

export async function getPeriode(id: string): Promise<PeriodeAkademik | null> {
  const snap = await getDoc(doc(db, KOLEKSI, id))
  return snap.exists() ? kePeriode(snap.id, snap.data() as Record<string, unknown>) : null
}

export interface SimpanPeriodeInput {
  tahunAjaran: string
  semester: Semester
  aktif?: boolean
  label?: string
  tglRaporKelas1sampai6Sem1?: string
  tglRaporKelas1sampai5Sem2?: string
  tglRaporKelas6Sem2?: string
  kotaRapor?: string
  isDefault?: boolean
}

/** Buat atau perbarui. ID dihitung dari tahun+semester. */
export async function simpanPeriode(input: SimpanPeriodeInput): Promise<string> {
  const id = buatIdPeriode(input.tahunAjaran, input.semester)
  const ref = doc(db, KOLEKSI, id)
  const existing = await getDoc(ref)
  const data: Record<string, unknown> = {
    tahunAjaran: input.tahunAjaran.trim(),
    semester: input.semester,
    aktif: input.aktif !== false,
    label: input.label?.trim() || null,
    tglRaporKelas1sampai6Sem1: input.tglRaporKelas1sampai6Sem1?.trim() || null,
    tglRaporKelas1sampai5Sem2: input.tglRaporKelas1sampai5Sem2?.trim() || null,
    tglRaporKelas6Sem2: input.tglRaporKelas6Sem2?.trim() || null,
    kotaRapor: input.kotaRapor?.trim() || null,
    isDefault: input.isDefault === true,
    updatedAt: serverTimestamp(),
  }
  if (!existing.exists()) {
    data.createdAt = serverTimestamp()
  }
  await setDoc(ref, data, { merge: true })

  // Jika ini dijadikan default, matikan default yang lain + sinkron config
  if (input.isDefault) {
    const semua = await listSemuaPeriode()
    const batch = writeBatch(db)
    let n = 0
    for (const p of semua) {
      if (p.id !== id && p.isDefault) {
        batch.update(doc(db, KOLEKSI, p.id), {
          isDefault: false,
          updatedAt: serverTimestamp(),
        })
        n++
      }
    }
    if (n) await batch.commit()
    await sinkronConfigDariPeriode({
      tahunAjaran: input.tahunAjaran,
      semester: input.semester,
      kotaRapor: input.kotaRapor,
      tglRaporKelas1sampai6Sem1: input.tglRaporKelas1sampai6Sem1,
      tglRaporKelas1sampai5Sem2: input.tglRaporKelas1sampai5Sem2,
      tglRaporKelas6Sem2: input.tglRaporKelas6Sem2,
    })
  }
  return id
}

export async function toggleAktifPeriode(id: string, aktif: boolean): Promise<void> {
  await updateDoc(doc(db, KOLEKSI, id), { aktif, updatedAt: serverTimestamp() })
}

export async function setDefaultPeriode(id: string): Promise<void> {
  const semua = await listSemuaPeriode()
  const target = semua.find((p) => p.id === id)
  if (!target) throw new Error(`Periode ${id} tidak ditemukan.`)

  const batch = writeBatch(db)
  for (const p of semua) {
    batch.update(doc(db, KOLEKSI, p.id), {
      isDefault: p.id === id,
      // Default otomatis juga diaktifkan agar bisa dipilih guru
      ...(p.id === id ? { aktif: true } : {}),
      updatedAt: serverTimestamp(),
    })
  }
  await batch.commit()

  // Sinkron config/akademik → kode legacy tetap konsisten
  await sinkronConfigDariPeriode({
    tahunAjaran: target.tahunAjaran,
    semester: target.semester,
    kotaRapor: target.kotaRapor,
    tglRaporKelas1sampai6Sem1: target.tglRaporKelas1sampai6Sem1,
    tglRaporKelas1sampai5Sem2: target.tglRaporKelas1sampai5Sem2,
    tglRaporKelas6Sem2: target.tglRaporKelas6Sem2,
  })
}

export async function hapusPeriode(id: string): Promise<void> {
  const target = await getPeriode(id)
  await deleteDoc(doc(db, KOLEKSI, id))

  // Jika yang dihapus adalah default, pilih pengganti (aktif terbaru) lalu sinkron config
  if (target?.isDefault) {
    const sisa = await listSemuaPeriode()
    const pengganti = sisa.find((p) => p.aktif) ?? sisa[0]
    if (pengganti) {
      await setDefaultPeriode(pengganti.id)
    }
  }
}
