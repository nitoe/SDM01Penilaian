import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore'
import { auth, db } from './firebase'
import type {
  AuthScope,
  JenisSetoran,
  MenulisRecord,
  SetoranPayload,
  SetoranRecord,
  SiswaTahsin,
  StatusHafalan,
} from '../types/tahsin'
import { recordSetoran } from './bacaTandai'
import type { TargetHafalan } from './target'
import { SEMUA_KELAS } from '../types/tahsin'

export async function getSiswaList(
  kelasFilter: string | null,
  scope: AuthScope,
): Promise<SiswaTahsin[]> {
  const allowedKelas = kelasFilter
    ? [kelasFilter]
    : scope.role === 'admin'
      ? [...SEMUA_KELAS]
      : scope.kelasAmpu || []

  if (!allowedKelas.length) return []

  const q = query(
    collection(db, 'siswa'),
    where('kelas', 'in', allowedKelas),
    where('aktif', '==', true),
  )
  const snap = await getDocs(q)
  const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as SiswaTahsin)
  return list.sort((a, b) => a.nama.localeCompare(b.nama, 'id'))
}

export async function getSiswaById(id: string): Promise<SiswaTahsin | null> {
  const snap = await getDoc(doc(db, 'siswa', id))
  if (!snap.exists()) return null
  return { id: snap.id, ...snap.data() } as SiswaTahsin
}

export async function saveSetoran(payload: SetoranPayload) {
  const docRef = await addDoc(collection(db, 'setoran'), {
    ...payload,
    createdBy: auth.currentUser?.uid || null,
    createdAt: serverTimestamp(),
  })
  return { id: docRef.id, ...payload }
}

export async function updateTamatIqro(siswaId: string, value: boolean) {
  await updateDoc(doc(db, 'siswa', siswaId), { tamatIqro: value })
}

/** Riwayat setoran satu siswa (terbaru dulu). Filter kelas wajib. Istilah status data lama disamakan (recordSetoran). */
export interface ScopePeriode {
  tahunAjaran: string
  semester: '1' | '2'
}

/** Cocokkan dokumen setoran dengan periode aktif. Dokumen lama tanpa field → tidak ikut (isolasi). */
function cocokPeriode(
  data: { tahunAjaran?: string; semester?: string },
  scope?: ScopePeriode | null,
): boolean {
  if (!scope?.tahunAjaran || !scope.semester) return true // tanpa scope = semua (admin/debug)
  return data.tahunAjaran === scope.tahunAjaran && String(data.semester) === scope.semester
}

/**
 * Riwayat setoran satu siswa (terbaru dulu).
 * `scope` = periode login → hanya setoran tahun ajaran + semester itu.
 * Dokumen lama tanpa tahunAjaran/semester tidak ditampilkan di mode ter-scope.
 */
export async function getRiwayatSetoran(
  siswaId: string,
  kelas: string,
  scope?: ScopePeriode | null,
): Promise<SetoranRecord[]> {
  const mapFilter = (docs: { id: string; data: () => Record<string, unknown> }[]) =>
    docs
      .map((d) => recordSetoran(d.id, d.data()))
      .filter((r) => cocokPeriode(r, scope))

  try {
    const q = query(
      collection(db, 'setoran'),
      where('siswaId', '==', siswaId),
      where('kelas', '==', kelas),
      orderBy('createdAt', 'desc'),
    )
    const snap = await getDocs(q)
    return mapFilter(snap.docs)
  } catch {
    const q = query(
      collection(db, 'setoran'),
      where('siswaId', '==', siswaId),
      where('kelas', '==', kelas),
    )
    const snap = await getDocs(q)
    const list = mapFilter(snap.docs)
    return list.sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt))
  }
}

/**
 * Semua setoran satu kelas pada satu periode (untuk laporan cetak). Satu query berfilter kelas + periode;
 * dokumen lama tanpa tahunAjaran/semester tidak ikut (isolasi periode, sama dengan getRiwayatSetoran).
 */
export async function getSetoranKelasPeriode(kelas: string, scope: ScopePeriode): Promise<SetoranRecord[]> {
  const q = query(
    collection(db, 'setoran'),
    where('kelas', '==', kelas),
    where('tahunAjaran', '==', scope.tahunAjaran),
    where('semester', '==', scope.semester),
  )
  const snap = await getDocs(q)
  return snap.docs
    .map((d) => recordSetoran(d.id, d.data()))
    .sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt))
}

/**
 * Ubah field sederhana satu setoran: jenis, status hafalan, catatan. Materi dan Baca & Tandai SENGAJA tidak
 * bisa diubah (hapus lalu input ulang) agar riwayat konsisten. Rules hanya mengizinkan pembuatnya (v2 §5).
 */
export async function updateSetoranFields(
  id: string,
  patch: { jenis: JenisSetoran; statusHafalan: StatusHafalan | null; catatan: string },
) {
  await updateDoc(doc(db, 'setoran', id), patch)
}

/** Hapus satu setoran. Rules: pembuatnya sendiri atau admin. */
export async function deleteSetoran(id: string) {
  await deleteDoc(doc(db, 'setoran', id))
}

/** ID dokumen target per kelas + periode, mis. "5A_2026-2027_1". */
export function idTargetHafalan(
  kelas: string,
  tahunAjaran: string,
  semester: '1' | '2' | string,
): string {
  const ta = tahunAjaran.trim().replace(/\//g, '-')
  return `${kelas}_${ta}_${semester}`
}

/**
 * Target hafalan satu kelas untuk periode tertentu.
 * Baca dokumen ber-ID periode; fallback ke ID lama `target_hafalan/{kelas}` hanya jika
 * dokumen lama belum punya tahunAjaran (migrasi sekali).
 */
export async function getTargetHafalan(
  kelas: string,
  scope?: ScopePeriode | null,
): Promise<TargetHafalan | null> {
  if (scope?.tahunAjaran && scope.semester) {
    const id = idTargetHafalan(kelas, scope.tahunAjaran, scope.semester)
    const snap = await getDoc(doc(db, 'target_hafalan', id))
    if (snap.exists()) {
      return { ...snap.data(), kelas, tahunAjaran: scope.tahunAjaran, semester: scope.semester } as TargetHafalan
    }
    // Fallback legacy (satu dokumen per kelas, tanpa periode) — hanya ditampilkan
    // bila admin belum menyimpan target ber-periode.
    const legacy = await getDoc(doc(db, 'target_hafalan', kelas))
    if (legacy.exists()) {
      const d = legacy.data() as Record<string, unknown>
      // Jika legacy sudah punya tahun/semester dan tidak cocok, anggap kosong
      if (d.tahunAjaran && d.semester && !cocokPeriode(d as { tahunAjaran?: string; semester?: string }, scope)) {
        return null
      }
      return { ...d, kelas, tahunAjaran: scope.tahunAjaran, semester: scope.semester } as TargetHafalan
    }
    return null
  }
  const snap = await getDoc(doc(db, 'target_hafalan', kelas))
  return snap.exists() ? ({ ...snap.data(), kelas } as TargetHafalan) : null
}

/**
 * Simpan target satu kelas untuk periode aktif.
 * ID dokumen = kelas_tahun-semester agar tidak saling timpa antar semester.
 */
export async function saveTargetHafalan(
  kelas: string,
  data: Omit<TargetHafalan, 'kelas'>,
  scope: ScopePeriode,
) {
  const id = idTargetHafalan(kelas, scope.tahunAjaran, scope.semester)
  await setDoc(doc(db, 'target_hafalan', id), {
    ...data,
    kelas,
    tahunAjaran: scope.tahunAjaran,
    semester: scope.semester,
    updatedBy: auth.currentUser?.uid || null,
    updatedAt: serverTimestamp(),
  })
}

export async function getMenulisLog(
  siswaId: string,
  kelas: string,
): Promise<MenulisRecord[]> {
  try {
    const q = query(
      collection(db, 'menulis_log'),
      where('siswaId', '==', siswaId),
      where('kelas', '==', kelas),
      orderBy('createdAt', 'desc'),
    )
    const snap = await getDocs(q)
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as MenulisRecord)
  } catch {
    const q = query(
      collection(db, 'menulis_log'),
      where('siswaId', '==', siswaId),
      where('kelas', '==', kelas),
    )
    const snap = await getDocs(q)
    const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as MenulisRecord)
    return list.sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt))
  }
}

export function toMillis(
  value: { seconds: number; nanoseconds?: number } | string | Date | null | undefined,
): number {
  if (!value) return 0
  if (value instanceof Date) return value.getTime()
  if (typeof value === 'string') return new Date(value).getTime() || 0
  if (typeof value === 'object' && 'seconds' in value) return value.seconds * 1000
  return 0
}

export function formatTanggal(
  value: { seconds: number; nanoseconds?: number } | string | Date | null | undefined,
): string {
  const ms = toMillis(value)
  if (!ms) return '—'
  return new Date(ms).toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}
