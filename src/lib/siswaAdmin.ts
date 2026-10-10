import {
  collection,
  deleteField,
  doc,
  getDoc,
  getDocs,
  query,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore'
import { db } from './firebase'
import type { SiswaTahsin } from '../types/tahsin'
import { SEMUA_KELAS } from '../types/tahsin'
import {
  IDENTITAS_KEY,
  gabungSiswa,
  normalizeSiswa,
  pisahSiswa,
  type BarisImpor,
  type SiswaInput,
} from './siswaImport'

// Bagian murni (normalisasi, parser, pratinjau impor) ada di siswaImport.ts; diekspor ulang agar import lama tetap jalan.
export * from './siswaImport'

/**
 * Biodata sensitif TIDAK disimpan di `siswa` (dibaca semua guru) melainkan di `identitas_siswa`
 * (admin + wali kelas). Setiap penulisan juga menghapus sisa field sensitif lama dari dokumen `siswa`.
 */
const hapusSensitif = () => Object.fromEntries(Object.keys(IDENTITAS_KEY).map((k) => [k, deleteField()]))

export async function listAllSiswa(kelasFilter?: string | null): Promise<SiswaTahsin[]> {
  if (kelasFilter) {
    const q = query(collection(db, 'siswa'), where('kelas', '==', kelasFilter))
    const snap = await getDocs(q)
    return snap.docs
      .map((d) => ({ id: d.id, ...d.data() }) as SiswaTahsin)
      .sort((a, b) => a.nama.localeCompare(b.nama, 'id'))
  }

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

/**
 * KHUSUS ADMIN: daftar siswa + biodata (identitas_siswa) digabung. Halaman guru memakai listAllSiswa
 * (data dasar saja) karena guru tidak boleh membaca identitas_siswa kecuali wali kelas.
 */
export async function listSiswaLengkap(kelasFilter?: string | null): Promise<SiswaTahsin[]> {
  const dasar = await listAllSiswa(kelasFilter)
  const ident = new Map<string, Record<string, unknown>>()
  if (kelasFilter) {
    const snaps = await Promise.all(dasar.map((s) => getDoc(doc(db, 'identitas_siswa', s.id))))
    snaps.forEach((sn, i) => {
      if (sn.exists()) ident.set(dasar[i]!.id, sn.data())
    })
  } else {
    const snap = await getDocs(collection(db, 'identitas_siswa'))
    snap.docs.forEach((d) => ident.set(d.id, d.data()))
  }
  return dasar.map((s) => gabungSiswa(s, ident.get(s.id)))
}

/**
 * Simpan satu siswa (form tambah/edit). `hapusKosong`: saat mengedit, kolom biodata yang dikosongkan di form
 * ikut dihapus dari identitas_siswa (bukan dibiarkan bernilai lama).
 */
export async function upsertSiswa(raw: SiswaInput, opsi: { hapusKosong?: boolean } = {}) {
  const s = normalizeSiswa(raw)
  const { dasar, identitas } = pisahSiswa(s)
  const batch = writeBatch(db)
  batch.set(doc(db, 'siswa', s.id), { ...dasar, ...hapusSensitif() }, { merge: true })

  const ident: Record<string, unknown> = { ...identitas }
  if (opsi.hapusKosong) {
    for (const kid of Object.values(IDENTITAS_KEY)) if (!(kid in ident)) ident[kid] = deleteField()
  }
  if (Object.keys(ident).length) batch.set(doc(db, 'identitas_siswa', s.id), ident, { merge: true })
  await batch.commit()
  return s
}

/**
 * Jalankan hasil praLihatImpor(). Baris berstatus 'error' dilewati. Untuk siswa yang sudah ada, impor TIDAK menimpa
 * `aktif`, `tamatIqro`, dan `jenjang` (kecuali aktif/tamatIqro memang ada di sumber) — seperti aturan v2.
 * Tiap siswa menulis paling banyak 2 dokumen; dipecah per 150 siswa agar di bawah batas 500 operasi per batch.
 */
export async function jalankanImpor(
  items: BarisImpor[],
  onProgress?: (selesai: number, total: number) => void,
): Promise<number> {
  const valid = items.filter((i) => i.status !== 'error' && i.s)
  let selesai = 0
  for (let i = 0; i < valid.length; i += 150) {
    const chunk = valid.slice(i, i + 150)
    const batch = writeBatch(db)
    for (const it of chunk) {
      const s = it.s!
      const { dasar, identitas } = pisahSiswa(s)
      if (it.status === 'update') {
        if (!it.adaAktif) delete dasar.aktif
        if (!it.adaTamat) delete dasar.tamatIqro
        delete dasar.jenjang
      }
      batch.set(doc(db, 'siswa', s.id), { ...dasar, ...hapusSensitif() }, { merge: true })
      if (Object.keys(identitas).length) batch.set(doc(db, 'identitas_siswa', s.id), identitas, { merge: true })
    }
    await batch.commit()
    selesai += chunk.length
    onProgress?.(selesai, valid.length)
  }
  return selesai
}

export async function setSiswaAktif(id: string, aktif: boolean) {
  await updateDoc(doc(db, 'siswa', id), { aktif })
}

export function downloadText(filename: string, content: string, mime = 'text/csv;charset=utf-8') {
  const blob = new Blob(['\ufeff' + content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
