import {
  collection,
  doc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  deleteDoc,
  where,
  writeBatch,
} from 'firebase/firestore'
import { db } from './firebase'
import {
  bersihkanAbsensi,
  idAbsensi,
  idEkskulSiswa,
  slugEkskul,
} from './raporDataRumus'
import type {
  AbsensiRapor,
  Ekstrakurikuler,
  EkskulSiswa,
  KokurikulerRapor,
  LevelEkskul,
} from '../types/raporData'
import { BATAS_EKSKUL_DESKRIPSI, BATAS_KOKURIKULER } from '../types/raporData'
import type { Semester } from '../types/akademik'

/**
 * Lapisan Firestore data pelengkap Rapor SAS (ANTIREGRESI §23).
 * Absensi/kokurikuler: wali kelas. Ekskul siswa: wali kelas ATAU pengampu ekskul.
 * Admin membaca dan mencetak. Semua query berfilter kelas + periode.
 */

export interface PeriodeScope {
  tahunAjaran: string
  semester: Semester
}

const filterPeriode = (kelas: string, p: PeriodeScope) => [
  where('kelas', '==', kelas),
  where('semester', '==', p.semester),
  where('tahunAjaran', '==', p.tahunAjaran),
]

// ── Absensi, catatan wali, keputusan ──

export async function getAbsensiKelas(kelas: string, p: PeriodeScope): Promise<Record<string, AbsensiRapor>> {
  const s = await getDocs(query(collection(db, 'absensi_rapor'), ...filterPeriode(kelas, p)))
  const peta: Record<string, AbsensiRapor> = {}
  s.forEach((d) => {
    const a = bersihkanAbsensi(d.data() as AbsensiRapor)
    peta[a.siswaId] = a
  })
  return peta
}

/** Simpan banyak siswa sekaligus (upsert, ID deterministik). Maksimal 500 per batch Firestore. */
export async function simpanAbsensiBanyak(daftar: AbsensiRapor[]): Promise<void> {
  for (let i = 0; i < daftar.length; i += 400) {
    const batch = writeBatch(db)
    for (const a of daftar.slice(i, i + 400)) {
      const b = bersihkanAbsensi(a)
      batch.set(doc(db, 'absensi_rapor', idAbsensi(b.siswaId, b.tahunAjaran, b.semester)), {
        ...b,
        updatedAt: serverTimestamp(),
      })
    }
    await batch.commit()
  }
}

// ── Deskripsi kokurikuler ──

export async function getKokurikulerKelas(kelas: string, p: PeriodeScope): Promise<Record<string, string>> {
  const s = await getDocs(query(collection(db, 'kokurikuler_rapor'), ...filterPeriode(kelas, p)))
  const peta: Record<string, string> = {}
  s.forEach((d) => {
    const x = d.data() as KokurikulerRapor
    peta[x.siswaId] = String(x.deskripsi ?? '')
  })
  return peta
}

export async function simpanKokurikulerBanyak(
  kelas: string,
  p: PeriodeScope,
  perSiswa: Record<string, string>,
): Promise<void> {
  const entri = Object.entries(perSiswa)
  for (let i = 0; i < entri.length; i += 400) {
    const batch = writeBatch(db)
    for (const [siswaId, teks] of entri.slice(i, i + 400)) {
      batch.set(doc(db, 'kokurikuler_rapor', idAbsensi(siswaId, p.tahunAjaran, p.semester)), {
        siswaId,
        kelas,
        semester: p.semester,
        tahunAjaran: p.tahunAjaran,
        deskripsi: teks.trim().slice(0, BATAS_KOKURIKULER),
        updatedAt: serverTimestamp(),
      })
    }
    await batch.commit()
  }
}

// ── Ekstrakurikuler ──

/** Master ringkas (nama + aktif). Untuk form yang hanya butuh daftar pilihan. */
export async function getEkskulMaster(): Promise<Ekstrakurikuler[]> {
  const s = await getDocs(collection(db, 'ekstrakurikuler'))
  return s.docs
    .map((d) => {
      const data = d.data()
      return {
        id: d.id,
        nama: String(data.nama ?? d.id),
        aktif: data.aktif !== false,
        pengampuUids: Array.isArray(data.pengampuUids)
          ? data.pengampuUids.map((u: unknown) => String(u)).filter(Boolean)
          : [],
        aktivitas: Array.isArray(data.aktivitas)
          ? data.aktivitas.map((a: unknown) => String(a ?? '').trim()).filter(Boolean)
          : [],
        deskripsiCapaian: Array.isArray(data.deskripsiCapaian)
          ? data.deskripsiCapaian
              .filter((x: unknown) => x && typeof x === 'object')
              .map((x: { predikat?: string; teks?: string }) => ({
                predikat: String(x.predikat ?? '').toUpperCase() as 'C' | 'B' | 'A',
                teks: String(x.teks ?? '').trim(),
              }))
              .filter((t: { predikat: string; teks: string }) => ['C', 'B', 'A'].includes(t.predikat) && t.teks)
          : [],
      } as Ekstrakurikuler
    })
    .sort((a, b) => a.nama.localeCompare(b.nama, 'id'))
}

export async function simpanEkskulMaster(nama: string, aktif = true): Promise<void> {
  const bersih = nama.trim().slice(0, 80)
  const id = slugEkskul(bersih)
  if (!id) throw new Error('Nama kegiatan tidak valid.')
  await setDoc(doc(db, 'ekstrakurikuler', id), { nama: bersih, aktif, updatedAt: serverTimestamp() }, { merge: true })
}

export async function getEkskulSiswaKelas(kelas: string, p: PeriodeScope): Promise<EkskulSiswa[]> {
  const s = await getDocs(query(collection(db, 'ekstrakurikuler_siswa'), ...filterPeriode(kelas, p)))
  return s.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<EkskulSiswa, 'id'>) }))
}

/**
 * Upsert nilai ekskul satu siswa. Field aktivitas & diisiOleh opsional (kompatibel data lama).
 * Penulis: wali kelas atau pengampu (ditegakkan di rules).
 */
export async function simpanEkskulSiswa(
  kelas: string,
  p: PeriodeScope,
  e: {
    siswaId: string
    ekskulId: string
    nama: string
    level: LevelEkskul
    deskripsi: string
    aktivitas?: string
    diisiOleh?: string
  },
): Promise<void> {
  const payload: Record<string, unknown> = {
    siswaId: e.siswaId,
    kelas,
    semester: p.semester,
    tahunAjaran: p.tahunAjaran,
    ekskulId: e.ekskulId,
    nama: e.nama,
    level: e.level,
    deskripsi: e.deskripsi.trim().slice(0, BATAS_EKSKUL_DESKRIPSI),
    updatedAt: serverTimestamp(),
  }
  if (e.aktivitas?.trim()) payload.aktivitas = e.aktivitas.trim().slice(0, 120)
  if (e.diisiOleh) payload.diisiOleh = e.diisiOleh
  await setDoc(
    doc(db, 'ekstrakurikuler_siswa', idEkskulSiswa(e.siswaId, e.ekskulId, p.tahunAjaran, p.semester)),
    payload,
  )
}

export async function hapusEkskulSiswa(id: string): Promise<void> {
  await deleteDoc(doc(db, 'ekstrakurikuler_siswa', id))
}
