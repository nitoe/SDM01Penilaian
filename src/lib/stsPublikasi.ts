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
  writeBatch,
} from 'firebase/firestore'
import { auth, db } from './firebase'
import { kalimatCapaian } from './asesmenRumus'
import { muatDataRaporStsKelas } from './raporSts'
import { cariWaliKelasLengkap } from './penandatangan'
import type { AppUser } from '../types/user'
import type { DataRaporSts } from './raporHtml'

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
  /** ID dokumen `rapor_sts_ortu` yang ditulis saat publikasi ini. Dipakai saat batal. */
  snapshotIds?: string[]
  /** Waktu jadwal rilis otomatis. Null jika tidak dijadwalkan. */
  jadwalAt?: Date | null
  jadwalOlehNama?: string
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
    snapshotIds: Array.isArray(d.snapshotIds) ? d.snapshotIds.map(String) : [],
    jadwalAt: toDate(d.jadwalAt),
    jadwalOlehNama: d.jadwalOlehNama ? String(d.jadwalOlehNama) : '',
  }
}

/** ID dokumen salinan rapor resmi untuk satu siswa. Slash tahun ajaran jadi '-'. */
export function idRaporStsOrtu(siswaId: string, tahunAjaran: string, semester: string): string {
  return `${siswaId}_${tahunAjaran}_${semester}`.replace(/\//g, '-')
}

function teks(v: unknown): string {
  return String(v ?? '').trim()
}

/** Satu baris tabel rapor, sudah berupa kalimat capaian final (bukan bahan mentah KKTP). */
function barisUntukOrtu(d: DataRaporSts) {
  return d.daftarNilai.map((item) => ({
    mapel: item.labelMapel,
    muatan: item.muatan,
    nilaiAkhir: item.nilaiAkhir,
    capaian: kalimatCapaian(
      item.capaianTerbaik,
      item.capaianPerluBimbingan,
      item.levelIndexTerbaik,
      item.levelIndexTerendah,
    ),
  }))
}

/**
 * Salin rapor STS yang SAMA dengan cetak aplikasi penilaian ke `rapor_sts_ortu`.
 * Portal orang tua hanya menampilkan dokumen ini — tidak menghitung ulang rata-rata.
 * Rumus, capaian, identitas, TTD, dan stempel diambil dari `muatDataRaporStsKelas`.
 */
export async function tulisSnapshotRaporOrtu(opts: {
  kelas: string
  tahunAjaran: string
  semester: '1' | '2'
  profil: AppUser
  kotaRapor?: string
  tanggalRapor?: string
}): Promise<string[]> {
  const wali = await cariWaliKelasLengkap(opts.kelas, opts.profil)
  const daftar = await muatDataRaporStsKelas({
    kelas: opts.kelas,
    waliNama: wali.nama,
    role: opts.profil.role,
    ttdWaliUrl: wali.ttdUrl,
    waliNbm: wali.nbm,
    semester: opts.semester,
    tahunAjaran: opts.tahunAjaran,
    kotaRapor: opts.kotaRapor,
    tanggalRapor: opts.tanggalRapor,
  })

  const ids: string[] = []
  for (let i = 0; i < daftar.length; i += 400) {
    const batch = writeBatch(db)
    for (const d of daftar.slice(i, i + 400)) {
      const id = idRaporStsOrtu(d.siswa.id, opts.tahunAjaran, opts.semester)
      ids.push(id)
      const cfg = d.config
      batch.set(doc(db, 'rapor_sts_ortu', id), {
        siswaId: d.siswa.id,
        nama: teks(d.siswa.nama),
        nisn: teks(d.siswa.nisn || d.siswa.nipd),
        kelas: d.kelas,
        fase: d.fase,
        semester: d.semester,
        tahunAjaran: d.tahunAjaran,
        sekolah: teks(cfg.namaSekolah) || 'SD Muhammadiyah 01 Kukusan',
        alamat: teks(cfg.alamatSekolah),
        kota: teks(d.kota) || 'Depok',
        tanggal: teks(d.tanggal),
        waliNama: teks(d.waliNama),
        waliNbm: teks(d.waliNbm),
        ttdWaliUrl: teks(d.ttdWaliUrl),
        namaKepsek: teks(cfg.namaKepsek),
        nbmKepsek: teks(cfg.nbmKepsek),
        ttdKepsekUrl: teks(d.ttdKepsekUrl || cfg.ttdKepsekUrl),
        stempelUrl: teks(cfg.stempelUrl),
        baris: barisUntukOrtu(d),
        published: true,
        updatedAt: serverTimestamp(),
      })
    }
    await batch.commit()
  }
  return ids
}

async function tandaiSnapshot(ids: string[], published: boolean): Promise<void> {
  const unik = [...new Set(ids.filter(Boolean))]
  for (let i = 0; i < unik.length; i += 400) {
    const batch = writeBatch(db)
    for (const id of unik.slice(i, i + 400)) {
      batch.set(
        doc(db, 'rapor_sts_ortu', id),
        { published, updatedAt: serverTimestamp() },
        { merge: true },
      )
    }
    await batch.commit()
  }
}

/**
 * Publikasikan rapor STS kelas ke portal orang tua.
 * Menulis salinan resmi dulu, baru gerbang `sts_publikasi`.
 * @param namaPublisher nama tampilan guru/admin
 * @param opsi profil pemanggil (wajib agar TTD wali kelas ikut tersalin) + tanggal/kota rapor
 */
/** Jadwalkan rilis otomatis rapor STS. Tidak langsung mempublikasikan. */
export async function jadwalkanPublikasiSts(
  kelas: string,
  tahunAjaran: string,
  semester: '1' | '2',
  jadwalAt: Date,
  namaPublisher: string,
): Promise<void> {
  if (!(jadwalAt instanceof Date) || Number.isNaN(jadwalAt.getTime())) {
    throw new Error('Waktu jadwal tidak valid.')
  }
  if (jadwalAt.getTime() <= Date.now() + 60_000) {
    throw new Error('Jadwal harus minimal 1 menit dari sekarang.')
  }
  const id = idStsPublikasi(kelas, tahunAjaran, semester)
  await setDoc(
    doc(db, 'sts_publikasi', id),
    {
      kelas,
      tahunAjaran,
      semester,
      jadwalAt,
      jadwalOleh: uid(),
      jadwalOlehNama: namaPublisher.trim() || 'Guru',
      jadwalDibuatAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  )
}

/** Hapus jadwal rilis. Tidak mengubah status published. */
export async function batalkanJadwalPublikasiSts(
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
      jadwalAt: null,
      jadwalOleh: null,
      jadwalOlehNama: null,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  )
}

export async function publikasikanSts(
  kelas: string,
  tahunAjaran: string,
  semester: '1' | '2',
  namaPublisher: string,
  opsi?: {
    profil?: AppUser
    kotaRapor?: string
    tanggalRapor?: string
  },
): Promise<void> {
  if (!opsi?.profil) {
    throw new Error('Profil pemanggil wajib agar salinan rapor (TTD wali kelas) bisa ditulis.')
  }
  const snapshotIds = await tulisSnapshotRaporOrtu({
    kelas,
    tahunAjaran,
    semester,
    profil: opsi.profil,
    kotaRapor: opsi.kotaRapor,
    tanggalRapor: opsi.tanggalRapor,
  })
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
      snapshotIds,
      jadwalAt: null,
      jadwalOleh: null,
      jadwalOlehNama: null,
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
  const prev = await getDoc(doc(db, 'sts_publikasi', id))
  const snapshotIds =
    prev.exists() && Array.isArray(prev.data().snapshotIds)
      ? (prev.data().snapshotIds as unknown[]).map(String)
      : []
  if (snapshotIds.length) await tandaiSnapshot(snapshotIds, false)
  await setDoc(
    doc(db, 'sts_publikasi', id),
    {
      kelas,
      tahunAjaran,
      semester,
      published: false,
      revokedAt: serverTimestamp(),
      revokedBy: uid(),
      jadwalAt: null,
      jadwalOleh: null,
      jadwalOlehNama: null,
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
