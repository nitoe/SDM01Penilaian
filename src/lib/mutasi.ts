/**
 * Mutasi siswa masuk/keluar.
 * - Pengajuan: hanya wali kelas (bukan admin).
 * - Persetujuan: hanya admin → arsip ke `siswa_mutasi` + efek ke `siswa`.
 */
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
  type DocumentData,
} from 'firebase/firestore'
import { auth, db } from './firebase'
import type {
  ArsipSiswaMutasi,
  ArahMutasi,
  PengajuanMutasi,
  SnapshotSiswaMutasi,
  StatusPengajuanMutasi,
} from '../types/mutasi'
import { BATAS_ALASAN, BATAS_CATATAN } from '../types/mutasi'
import type { SiswaTahsin } from '../types/tahsin'

const KOLEKSI_PENGAJUAN = 'pengajuan_mutasi'
const KOLEKSI_ARSIP = 'siswa_mutasi'

function keDate(v: unknown): Date | null {
  if (!v) return null
  if (v instanceof Date) return v
  if (typeof v === 'object' && v && 'toDate' in v && typeof (v as { toDate: () => Date }).toDate === 'function') {
    return (v as { toDate: () => Date }).toDate()
  }
  if (typeof v === 'object' && v && 'seconds' in v) {
    return new Date((v as { seconds: number }).seconds * 1000)
  }
  return null
}

function snapshotDariSiswa(s: SiswaTahsin): SnapshotSiswaMutasi {
  return {
    id: s.id,
    nama: s.nama,
    nis: s.nis || s.nipd,
    nisn: s.nisn,
    kelas: s.kelas,
    jk: typeof s.jk === 'string' ? s.jk : undefined,
    tempatLahir: s.tempatLahir,
    tanggalLahir: s.tanggalLahir,
    sekolahAsal: s.sekolahAsal,
  }
}

function dariPengajuan(id: string, d: DocumentData): PengajuanMutasi {
  return {
    id,
    arah: d.arah,
    status: d.status,
    tanggal: d.tanggal,
    alasan: d.alasan ?? '',
    sekolahTerkait: d.sekolahTerkait,
    catatan: d.catatan,
    kelas: d.kelas,
    siswaId: d.siswaId,
    siswaNama: d.siswaNama ?? '',
    snapshot: d.snapshot,
    calonMasuk: d.calonMasuk,
    diajukanOleh: d.diajukanOleh,
    diajukanNama: d.diajukanNama ?? '',
    diajukanAt: keDate(d.diajukanAt),
    diprosesOleh: d.diprosesOleh,
    diprosesNama: d.diprosesNama,
    diprosesAt: keDate(d.diprosesAt),
    catatanAdmin: d.catatanAdmin,
    arsipId: d.arsipId,
  }
}

function dariArsip(id: string, d: DocumentData): ArsipSiswaMutasi {
  return {
    id,
    arah: d.arah,
    tanggal: d.tanggal,
    alasan: d.alasan ?? '',
    sekolahTerkait: d.sekolahTerkait,
    catatan: d.catatan,
    kelas: d.kelas,
    siswaId: d.siswaId,
    siswaNama: d.siswaNama ?? '',
    snapshot: d.snapshot,
    pengajuanId: d.pengajuanId,
    diajukanOleh: d.diajukanOleh,
    diajukanNama: d.diajukanNama ?? '',
    disetujuiOleh: d.disetujuiOleh,
    disetujuiNama: d.disetujuiNama ?? '',
    disetujuiAt: keDate(d.disetujuiAt),
    tahunAjaran: d.tahunAjaran,
    semester: d.semester,
  }
}

const TANGGAL_RE = /^\d{4}-\d{2}-\d{2}$/

export interface MasukanMutasiKeluar {
  arah: 'keluar'
  siswa: SiswaTahsin
  tanggal: string
  alasan: string
  sekolahTerkait?: string
  catatan?: string
}

export interface CalonSiswaMasuk {
  nis?: string
  nisn?: string
  jk?: string
  tempatLahir?: string
  tanggalLahir?: string
  jenjang?: 'iqro' | 'quran'
}

export interface MasukanMutasiMasuk {
  arah: 'masuk'
  kelas: string
  siswaNama: string
  tanggal: string
  alasan: string
  sekolahTerkait?: string
  catatan?: string
  calonMasuk?: CalonSiswaMasuk
  calon?: CalonSiswaMasuk
}

export type MasukanMutasi = MasukanMutasiKeluar | MasukanMutasiMasuk

export function validasiPengajuan(m: MasukanMutasi): string[] {
  const salah: string[] = []
  if (!m.tanggal || !TANGGAL_RE.test(m.tanggal)) salah.push('Tanggal mutasi wajib diisi (YYYY-MM-DD).')
  const alasan = m.alasan?.trim() ?? ''
  if (!alasan) salah.push('Alasan mutasi wajib diisi.')
  if (alasan.length > BATAS_ALASAN) salah.push(`Alasan maksimal ${BATAS_ALASAN} karakter.`)
  if (m.catatan && m.catatan.trim().length > BATAS_CATATAN) {
    salah.push(`Catatan maksimal ${BATAS_CATATAN} karakter.`)
  }
  if (m.arah === 'keluar') {
    if (!m.siswa?.id) salah.push('Pilih siswa yang keluar.')
    if (!m.siswa?.kelas) salah.push('Kelas siswa tidak valid.')
  } else {
    if (!m.siswaNama?.trim()) salah.push('Nama siswa masuk wajib diisi.')
    if (!m.kelas?.trim()) salah.push('Kelas tujuan wajib diisi.')
  }
  return salah
}

/** Ajukan mutasi — hanya dipanggil dari UI wali kelas. */
export async function ajukanMutasi(
  m: MasukanMutasi,
  dari: { uid: string; nama: string },
): Promise<string> {
  const salah = validasiPengajuan(m)
  if (salah.length) throw new Error(salah[0])
  const uid = auth.currentUser?.uid
  if (!uid || uid !== dari.uid) throw new Error('Sesi tidak valid.')

  const dasar: Record<string, unknown> = {
    arah: m.arah,
    status: 'diajukan' as StatusPengajuanMutasi,
    tanggal: m.tanggal,
    alasan: m.alasan.trim(),
    diajukanOleh: dari.uid,
    diajukanNama: dari.nama,
    diajukanAt: serverTimestamp(),
  }
  if (m.sekolahTerkait?.trim()) dasar.sekolahTerkait = m.sekolahTerkait.trim()
  if (m.catatan?.trim()) dasar.catatan = m.catatan.trim()

  if (m.arah === 'keluar') {
    const snap = snapshotDariSiswa(m.siswa)
    dasar.kelas = m.siswa.kelas
    dasar.siswaId = m.siswa.id
    dasar.siswaNama = m.siswa.nama
    dasar.snapshot = snap
  } else {
    const calon = m.calonMasuk ?? m.calon
    dasar.kelas = m.kelas
    dasar.siswaNama = m.siswaNama.trim()
    if (calon) {
      const c: Record<string, string> = {}
      if (calon.nis?.trim()) c.nis = calon.nis.trim()
      if (calon.nisn?.trim()) c.nisn = calon.nisn.trim()
      if (calon.jk?.trim()) c.jk = calon.jk.trim()
      if (calon.tempatLahir?.trim()) c.tempatLahir = calon.tempatLahir.trim()
      if (calon.tanggalLahir?.trim()) c.tanggalLahir = calon.tanggalLahir.trim()
      if (calon.jenjang) c.jenjang = calon.jenjang
      if (Object.keys(c).length) dasar.calonMasuk = c
    }
  }

  const ref = await addDoc(collection(db, KOLEKSI_PENGAJUAN), dasar)
  return ref.id
}

/** Batalkan pengajuan sendiri (status masih diajukan). */
export async function batalkanPengajuan(id: string): Promise<void> {
  const uid = auth.currentUser?.uid
  if (!uid) throw new Error('Sesi tidak valid.')
  const ref = doc(db, KOLEKSI_PENGAJUAN, id)
  const snap = await getDoc(ref)
  if (!snap.exists()) throw new Error('Pengajuan tidak ditemukan.')
  const d = snap.data()
  if (d.diajukanOleh !== uid) throw new Error('Hanya pengaju yang boleh membatalkan.')
  if (d.status !== 'diajukan') throw new Error('Pengajuan sudah diproses.')
  await updateDoc(ref, { status: 'dibatalkan', diprosesAt: serverTimestamp() })
}

/** Daftar pengajuan untuk kelas yang diwalikan. */
export async function listPengajuanWali(opts: {
  uid: string
  kelasWali: string[]
}): Promise<PengajuanMutasi[]> {
  if (!opts.kelasWali.length) return []
  // Satu query per kelas (where ==) agar lolos rules tanpa indeks komposit
  // dan tanpa bergantung pada pembuktian `in` di security rules.
  const hasil: PengajuanMutasi[] = []
  for (const kelas of opts.kelasWali) {
    const snap = await getDocs(
      query(collection(db, KOLEKSI_PENGAJUAN), where('kelas', '==', kelas), limit(80)),
    )
    snap.docs.forEach((d) => hasil.push(dariPengajuan(d.id, d.data())))
  }
  return hasil.sort((a, b) => (b.diajukanAt?.getTime() ?? 0) - (a.diajukanAt?.getTime() ?? 0))
}

/** Inbox admin: semua pengajuan, terbaru dulu (urut di klien — tanpa orderBy agar tidak wajib indeks). */
export async function listPengajuanAdmin(batas = 150): Promise<PengajuanMutasi[]> {
  const snap = await getDocs(query(collection(db, KOLEKSI_PENGAJUAN), limit(batas)))
  const list = snap.docs.map((d) => dariPengajuan(d.id, d.data()))
  return list
    .sort((a, b) => (b.diajukanAt?.getTime() ?? 0) - (a.diajukanAt?.getTime() ?? 0))
    .slice(0, batas)
}

/** Arsip mutasi — hanya admin. */
export async function listArsipMutasi(batas = 200): Promise<ArsipSiswaMutasi[]> {
  const snap = await getDocs(query(collection(db, KOLEKSI_ARSIP), limit(batas)))
  const list = snap.docs.map((d) => dariArsip(d.id, d.data()))
  return list
    .sort((a, b) => (b.disetujuiAt?.getTime() ?? 0) - (a.disetujuiAt?.getTime() ?? 0))
    .slice(0, batas)
}

export async function tolakPengajuan(
  id: string,
  admin: { uid: string; nama: string },
  catatanAdmin?: string,
): Promise<void> {
  const ref = doc(db, KOLEKSI_PENGAJUAN, id)
  const snap = await getDoc(ref)
  if (!snap.exists()) throw new Error('Pengajuan tidak ditemukan.')
  if (snap.data().status !== 'diajukan') throw new Error('Pengajuan sudah diproses.')
  const patch: Record<string, unknown> = {
    status: 'ditolak',
    diprosesOleh: admin.uid,
    diprosesNama: admin.nama,
    diprosesAt: serverTimestamp(),
  }
  if (catatanAdmin?.trim()) patch.catatanAdmin = catatanAdmin.trim()
  await updateDoc(ref, patch)
}

/**
 * Setujui pengajuan.
 * - Keluar: siswa.aktif = false + arsip siswa_mutasi
 * - Masuk: buat dokumen siswa aktif + arsip
 */
export async function setujuiPengajuan(
  id: string,
  admin: { uid: string; nama: string },
  opsi?: { catatanAdmin?: string; tahunAjaran?: string; semester?: string },
): Promise<void> {
  const ref = doc(db, KOLEKSI_PENGAJUAN, id)
  const snap = await getDoc(ref)
  if (!snap.exists()) throw new Error('Pengajuan tidak ditemukan.')
  const p = snap.data()
  if (p.status !== 'diajukan') throw new Error('Pengajuan sudah diproses.')

  const batch = writeBatch(db)
  const arsipRef = doc(collection(db, KOLEKSI_ARSIP))
  let siswaId = (p.siswaId as string) || ''
  let snapshot: SnapshotSiswaMutasi = p.snapshot as SnapshotSiswaMutasi

  if (p.arah === 'keluar') {
    if (!siswaId) throw new Error('Pengajuan keluar tanpa ID siswa.')
    const siswaRef = doc(db, 'siswa', siswaId)
    const siswaSnap = await getDoc(siswaRef)
    if (!siswaSnap.exists()) throw new Error('Siswa tidak ditemukan di roster.')
    const data = siswaSnap.data()
    snapshot = snapshotDariSiswa({ id: siswaId, ...data } as SiswaTahsin)
    batch.update(siswaRef, { aktif: false })
  } else {
    // Masuk: buat siswa baru
    const calon = (p.calonMasuk ?? {}) as Record<string, string>
    const nis = (calon.nis || '').trim()
    siswaId = nis || arsipRef.id.slice(0, 12)
    // Cegah tabrakan ID
    const cek = await getDoc(doc(db, 'siswa', siswaId))
    if (cek.exists()) {
      siswaId = `${siswaId}_${Date.now().toString(36).slice(-4)}`
    }
    const jenjang = calon.jenjang === 'quran' ? 'quran' : 'iqro'
    const baru: Record<string, unknown> = {
      nama: String(p.siswaNama).trim(),
      kelas: p.kelas,
      jenjang,
      aktif: true,
    }
    if (nis) {
      baru.nis = nis
      baru.nipd = nis
    }
    if (calon.nisn) baru.nisn = calon.nisn
    if (calon.jk) baru.jk = calon.jk
    if (calon.tempatLahir) baru.tempatLahir = calon.tempatLahir
    if (calon.tanggalLahir) baru.tanggalLahir = calon.tanggalLahir
    if (p.sekolahTerkait) baru.sekolahAsal = p.sekolahTerkait
    batch.set(doc(db, 'siswa', siswaId), baru)
    snapshot = {
      id: siswaId,
      nama: String(p.siswaNama).trim(),
      nis: nis || undefined,
      nisn: calon.nisn,
      kelas: p.kelas,
      jk: calon.jk,
      tempatLahir: calon.tempatLahir,
      tanggalLahir: calon.tanggalLahir,
      sekolahAsal: p.sekolahTerkait,
    }
  }

  const arsip: Record<string, unknown> = {
    arah: p.arah as ArahMutasi,
    tanggal: p.tanggal,
    alasan: p.alasan,
    kelas: p.kelas,
    siswaId,
    siswaNama: p.siswaNama,
    snapshot,
    pengajuanId: id,
    diajukanOleh: p.diajukanOleh,
    diajukanNama: p.diajukanNama,
    disetujuiOleh: admin.uid,
    disetujuiNama: admin.nama,
    disetujuiAt: serverTimestamp(),
  }
  if (p.sekolahTerkait) arsip.sekolahTerkait = p.sekolahTerkait
  if (p.catatan) arsip.catatan = p.catatan
  if (opsi?.tahunAjaran) arsip.tahunAjaran = opsi.tahunAjaran
  if (opsi?.semester) arsip.semester = opsi.semester

  batch.set(arsipRef, arsip)

  const patchPengajuan: Record<string, unknown> = {
    status: 'disetujui',
    diprosesOleh: admin.uid,
    diprosesNama: admin.nama,
    diprosesAt: serverTimestamp(),
    arsipId: arsipRef.id,
    siswaId,
    snapshot,
  }
  if (opsi?.catatanAdmin?.trim()) patchPengajuan.catatanAdmin = opsi.catatanAdmin.trim()
  batch.update(ref, patchPengajuan)

  await batch.commit()
}
