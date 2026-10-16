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
 * Lapisan Firestore data pelengkap Rapor SAS (ANTIREGRESI §23). Penulisan HANYA oleh wali kelas
 * (rules `waliKelasSendiri`); admin membaca dan mencetak. Semua query berfilter kelas + periode.
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

export async function getEkskulMaster(): Promise<Ekstrakurikuler[]> {
  const s = await getDocs(collection(db, 'ekstrakurikuler'))
  return s.docs
    .map((d) => ({ id: d.id, nama: String(d.data().nama ?? d.id), aktif: d.data().aktif !== false }))
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

export async function simpanEkskulSiswa(
  kelas: string,
  p: PeriodeScope,
  e: { siswaId: string; ekskulId: string; nama: string; level: LevelEkskul; deskripsi: string },
): Promise<void> {
  await setDoc(doc(db, 'ekstrakurikuler_siswa', idEkskulSiswa(e.siswaId, e.ekskulId, p.tahunAjaran, p.semester)), {
    siswaId: e.siswaId,
    kelas,
    semester: p.semester,
    tahunAjaran: p.tahunAjaran,
    ekskulId: e.ekskulId,
    nama: e.nama,
    level: e.level,
    deskripsi: e.deskripsi.trim().slice(0, BATAS_EKSKUL_DESKRIPSI),
    updatedAt: serverTimestamp(),
  })
}

export async function hapusEkskulSiswa(id: string): Promise<void> {
  await deleteDoc(doc(db, 'ekstrakurikuler_siswa', id))
}
