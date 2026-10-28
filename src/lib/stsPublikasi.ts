/**
 * Publikasi rapor STS ke portal orang tua.
 * Dokumen: sts_publikasi/{kelas}_{tahunAjaran}_{semester}
 * ID: slash pada tahun ajaran diganti '-'.
 */
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  where,
} from 'firebase/firestore'
import { auth, db } from './firebase'

export interface StsPublikasi {
  id: string
  kelas: string
  tahunAjaran: string
  semester: '1' | '2'
  published: boolean
  publishedAt: Date | null
  publishedBy: string | null
  publishedByNama: string
  revokedAt?: Date | null
  revokedBy?: string | null
}

export interface RingkasKelengkapanSts {
  /** Jumlah siswa aktif di kelas (dari daftar siswa). */
  nSiswa: number
  /** Mapel yang punya ≥1 nilai STS pada periode. */
  mapel: { nama: string; nBerNilai: number }[]
  /** Jumlah siswa unik yang punya minimal 1 nilai STS. */
  nSiswaBerNilai: number
}

function uid(): string {
  const u = auth.currentUser
  if (!u) throw new Error('Belum login.')
  return u.uid
}

/** ID dokumen stabil, selaras portal-orangtua. */
export function idStsPublikasi(
  kelas: string,
  tahunAjaran: string,
  semester: string,
): string {
  return `${kelas}_${tahunAjaran}_${semester}`.replace(/\//g, '-')
}

function toDate(v: unknown): Date | null {
  if (!v) return null
  if (v instanceof Date) return v
  if (typeof v === 'object' && v !== null && 'toDate' in v && typeof (v as { toDate: () => Date }).toDate === 'function') {
    try {
      return (v as { toDate: () => Date }).toDate()
    } catch {
      return null
    }
  }
  if (typeof v === 'string' || typeof v === 'number') {
    const d = new Date(v)
    return Number.isNaN(d.getTime()) ? null : d
  }
  return null
}

export async function getStsPublikasi(
  kelas: string,
  tahunAjaran: string,
  semester: string,
): Promise<StsPublikasi | null> {
  const id = idStsPublikasi(kelas, tahunAjaran, semester)
  const snap = await getDoc(doc(db, 'sts_publikasi', id))
  if (!snap.exists()) return null
  const d = snap.data()
  return {
    id,
    kelas: String(d.kelas ?? kelas),
    tahunAjaran: String(d.tahunAjaran ?? tahunAjaran),
    semester: d.semester === '2' ? '2' : '1',
    published: d.published === true,
    publishedAt: toDate(d.publishedAt),
    publishedBy: d.publishedBy ? String(d.publishedBy) : null,
    publishedByNama: String(d.publishedByNama ?? ''),
    revokedAt: toDate(d.revokedAt),
    revokedBy: d.revokedBy ? String(d.revokedBy) : null,
  }
}

/**
 * Publikasikan rapor STS kelas ke portal orang tua.
 * @param namaPublisher nama tampilan guru/admin
 */
export async function publikasikanSts(
  kelas: string,
  tahunAjaran: string,
  semester: '1' | '2',
  namaPublisher: string,
): Promise<void> {
  const id = idStsPublikasi(kelas, tahunAjaran, semester)
  await setDoc(
    doc(db, 'sts_publikasi', id),
    {
      kelas,
      tahunAjaran,
      semester,
      published: true,
      publishedAt: serverTimestamp(),
      publishedBy: uid(),
      publishedByNama: namaPublisher.trim() || 'Guru',
      revokedAt: null,
      revokedBy: null,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  )
}

/** Sembunyikan rapor STS dari portal (nilai di Firestore tetap ada). */
export async function batalkanPublikasiSts(
  kelas: string,
  tahunAjaran: string,
  semester: '1' | '2',
): Promise<void> {
  const id = idStsPublikasi(kelas, tahunAjaran, semester)
  await setDoc(
    doc(db, 'sts_publikasi', id),
    {
      kelas,
      tahunAjaran,
      semester,
      published: false,
      revokedAt: serverTimestamp(),
      revokedBy: uid(),
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  )
}

/**
 * Ringkasan kelengkapan nilai STS per mapel di kelas + periode.
 * Dipakai sebelum memutuskan publikasi rapor.
 */
export async function ringkasKelengkapanSts(
  kelas: string,
  tahunAjaran: string,
  semester: string,
  nSiswa: number,
): Promise<RingkasKelengkapanSts> {
  const q = query(collection(db, 'nilai_sts'), where('kelas', '==', kelas))
  const snap = await getDocs(q)

  const byMapel = new Map<string, Set<string>>()
  const siswaBerNilai = new Set<string>()

  snap.forEach((docSnap) => {
    const d = docSnap.data()
    if (tahunAjaran && d.tahunAjaran && String(d.tahunAjaran) !== tahunAjaran) return
    if (d.semester != null && String(d.semester) !== String(semester)) return
    const mapel = String(d.mapel || '').trim()
    const sid = String(d.siswaId || '')
    if (!mapel || !sid) return
    if (!byMapel.has(mapel)) byMapel.set(mapel, new Set())
    byMapel.get(mapel)!.add(sid)
    siswaBerNilai.add(sid)
  })

  const mapel = [...byMapel.entries()]
    .map(([nama, set]) => ({ nama, nBerNilai: set.size }))
    .sort((a, b) => a.nama.localeCompare(b.nama, 'id'))

  return {
    nSiswa,
    mapel,
    nSiswaBerNilai: siswaBerNilai.size,
  }
}
