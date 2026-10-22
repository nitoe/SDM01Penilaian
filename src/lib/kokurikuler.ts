/**
 * Lapisan data Kokurikuler: DPL, Proyek STEM, nilai DPL per siswa, 7KAIH.
 * Tidak menulis ke nilai_tp / SLM / STS / SAS — keterkaitan mapel/TP di STEM hanya metadata.
 */
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  where,
  writeBatch,
} from 'firebase/firestore'
import { db } from './firebase'
import { tingkatanDariKelas } from './akademikRumus'
import type { Semester } from '../types/akademik'
import type {
  CatatanKebiasaan,
  Dpl,
  G7kaih,
  LevelDpl,
  MapelTerlibatStem,
  NilaiDplStem,
  NilaiProyekStem,
  ProyekStem,
  RubrikAspekStem,
} from '../types/kokurikuler'
import {
  BATAS_7KAIH_CATATAN,
  BATAS_DPL_DESKRIPSI,
  BATAS_NILAI_DPL_DESKRIPSI,
  BATAS_STEM_JUDUL,
  DAFTAR_KEBIASAAN_7KAIH,
  DPL_NAMA_BAKU,
} from '../types/kokurikuler'

export interface PeriodeScope {
  tahunAjaran: string
  semester: Semester
}

function potong(s: string, max: number): string {
  return s.trim().slice(0, max)
}

function normalisasiLevelDeskripsi(raw: unknown): [string, string, string, string] {
  const arr = Array.isArray(raw) ? raw : []
  return [
    potong(String(arr[0] ?? ''), BATAS_DPL_DESKRIPSI),
    potong(String(arr[1] ?? ''), BATAS_DPL_DESKRIPSI),
    potong(String(arr[2] ?? ''), BATAS_DPL_DESKRIPSI),
    potong(String(arr[3] ?? ''), BATAS_DPL_DESKRIPSI),
  ]
}

function dariDocDpl(id: string, data: Record<string, unknown>): Dpl {
  return {
    id,
    kelas: String(data.kelas ?? ''),
    tingkatan: String(data.tingkatan ?? ''),
    nama: String(data.nama ?? ''),
    urutan: Number(data.urutan) || 0,
    aktif: data.aktif === true,
    levelDeskripsi: normalisasiLevelDeskripsi(data.levelDeskripsi),
  }
}

// ── DPL ──────────────────────────────────────────────────────────────────────

export async function getDplByKelas(
  kelas: string,
  opts?: { hanyaAktif?: boolean },
): Promise<Dpl[]> {
  const s = await getDocs(query(collection(db, 'dpl'), where('kelas', '==', kelas)))
  let list = s.docs.map((d) => dariDocDpl(d.id, d.data() as Record<string, unknown>))
  list.sort((a, b) => a.urutan - b.urutan || a.nama.localeCompare(b.nama, 'id'))
  if (opts?.hanyaAktif) list = list.filter((d) => d.aktif)
  return list
}

/**
 * Jika kelas belum punya DPL, isi 8 nama baku (tidak aktif) agar wali tinggal
 * mengaktifkan dan mengisi deskripsi level.
 */
export async function pastikanDplBaku(kelas: string): Promise<Dpl[]> {
  const existing = await getDplByKelas(kelas)
  if (existing.length > 0) return existing
  const tingkatan = tingkatanDariKelas(kelas)
  const batch = writeBatch(db)
  for (let i = 0; i < DPL_NAMA_BAKU.length; i++) {
    const ref = doc(collection(db, 'dpl'))
    batch.set(ref, {
      kelas,
      tingkatan,
      nama: DPL_NAMA_BAKU[i],
      urutan: i + 1,
      aktif: false,
      levelDeskripsi: ['', '', '', ''],
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
  }
  await batch.commit()
  return getDplByKelas(kelas)
}

export async function simpanDpl(input: {
  id?: string
  kelas: string
  nama: string
  urutan: number
  aktif: boolean
  levelDeskripsi: [string, string, string, string]
}): Promise<string> {
  const tingkatan = tingkatanDariKelas(input.kelas)
  const data = {
    kelas: input.kelas,
    tingkatan,
    nama: potong(input.nama, 80),
    urutan: input.urutan,
    aktif: !!input.aktif,
    levelDeskripsi: normalisasiLevelDeskripsi(input.levelDeskripsi),
    updatedAt: serverTimestamp(),
  }
  if (input.id) {
    await setDoc(doc(db, 'dpl', input.id), data, { merge: true })
    return input.id
  }
  const ref = await addDoc(collection(db, 'dpl'), {
    ...data,
    createdAt: serverTimestamp(),
  })
  return ref.id
}

export async function hapusDpl(id: string): Promise<void> {
  await deleteDoc(doc(db, 'dpl', id))
}

// ── Proyek STEM ──────────────────────────────────────────────────────────────

function normalisasiMapelTerlibat(raw: unknown): MapelTerlibatStem[] {
  if (!Array.isArray(raw)) return []
  return raw
    .filter((x) => x && typeof x === 'object')
    .map((x) => {
      const o = x as Record<string, unknown>
      const jenis = String(o.jenisNilai ?? 'SLM').toUpperCase() === 'SAS' ? 'SAS' : 'SLM'
      return {
        mapel: potong(String(o.mapel ?? ''), 80),
        tpId: potong(String(o.tpId ?? ''), 120),
        namaTp: potong(String(o.namaTp ?? ''), 200) || undefined,
        jenisNilai: jenis as 'SLM' | 'SAS',
      }
    })
    .filter((m) => m.mapel)
}

function normalisasiScaffolding(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  return raw.map((s) => potong(String(s ?? ''), 300)).filter(Boolean).slice(0, 12)
}

function normalisasiDaftarNilai(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  return raw.map((s) => potong(String(s ?? ''), 200)).filter(Boolean).slice(0, 10)
}

function normalisasiRubrik(raw: unknown): RubrikAspekStem[] {
  if (!Array.isArray(raw)) return []
  const out: RubrikAspekStem[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const o = item as Record<string, unknown>
    const id = potong(String(o.id ?? ''), 40)
    const nama = potong(String(o.nama ?? ''), 120)
    if (!id || !nama) continue
    const dr = Array.isArray(o.deskripsiRentang) ? o.deskripsiRentang : []
    const deskripsiRentang: [string, string, string, string] = [
      potong(String(dr[0] ?? ''), 400),
      potong(String(dr[1] ?? ''), 400),
      potong(String(dr[2] ?? ''), 400),
      potong(String(dr[3] ?? ''), 400),
    ]
    out.push({
      id,
      nama,
      mapel: potong(String(o.mapel ?? ''), 80) || undefined,
      deskripsiRentang,
    })
    if (out.length >= 12) break
  }
  return out
}

/** Bangun rubrik dari daftarNilai legacy jika rubrik kosong. */
function rubrikDariLegacy(daftar: string[]): RubrikAspekStem[] {
  return daftar.slice(0, 10).map((nama, i) => ({
    id: `legacy_${i + 1}`,
    nama,
    deskripsiRentang: ['', '', '', ''] as [string, string, string, string],
  }))
}

function dariDocProyek(id: string, data: Record<string, unknown>): ProyekStem {
  const daftarNilai = normalisasiDaftarNilai(data.daftarNilai)
  let rubrik = normalisasiRubrik(data.rubrik)
  if (!rubrik.length && daftarNilai.length) {
    rubrik = rubrikDariLegacy(daftarNilai)
  }
  return {
    id,
    kelas: String(data.kelas ?? ''),
    tingkatan: String(data.tingkatan ?? ''),
    semester: String(data.semester ?? '1') as Semester,
    tahunAjaran: String(data.tahunAjaran ?? ''),
    judul: String(data.judul ?? ''),
    deskripsi: potong(String(data.deskripsi ?? ''), 2000) || undefined,
    mapelTerlibat: normalisasiMapelTerlibat(data.mapelTerlibat),
    dplId: Array.isArray(data.dplId) ? data.dplId.map((x) => String(x)).filter(Boolean) : [],
    tanggalMulai: String(data.tanggalMulai ?? ''),
    tanggalSelesai: String(data.tanggalSelesai ?? ''),
    jumlahPertemuan: Number(data.jumlahPertemuan) || 0,
    scaffolding: normalisasiScaffolding(data.scaffolding),
    daftarNilai,
    rubrik,
  }
}

export async function getProyekStemByKelas(
  kelas: string,
  p: PeriodeScope,
): Promise<ProyekStem[]> {
  const s = await getDocs(
    query(
      collection(db, 'proyek_stem'),
      where('kelas', '==', kelas),
      where('semester', '==', p.semester),
      where('tahunAjaran', '==', p.tahunAjaran),
    ),
  )
  return s.docs
    .map((d) => dariDocProyek(d.id, d.data() as Record<string, unknown>))
    .sort((a, b) => (b.tanggalMulai || '').localeCompare(a.tanggalMulai || ''))
}

export async function simpanProyekStem(input: {
  id?: string
  kelas: string
  semester: Semester
  tahunAjaran: string
  judul: string
  deskripsi?: string
  mapelTerlibat: MapelTerlibatStem[]
  dplId: string[]
  tanggalMulai: string
  tanggalSelesai: string
  jumlahPertemuan: number
  scaffolding?: string[]
  daftarNilai?: string[]
  rubrik?: RubrikAspekStem[]
}): Promise<string> {
  const mapelUnik = new Set(input.mapelTerlibat.map((m) => m.mapel))
  if (mapelUnik.size < 2) {
    throw new Error('Proyek STEM wajib melibatkan minimal 2 mata pelajaran berbeda.')
  }
  if (input.mapelTerlibat.length < 2) {
    throw new Error('Pilih minimal 2 tautan mapel–TP.')
  }
  if (input.dplId.length < 2 || input.dplId.length > 4) {
    throw new Error('Pilih 2–4 DPL yang diamati lewat proyek ini.')
  }
  const rubrik = normalisasiRubrik(input.rubrik)
  const data = {
    kelas: input.kelas,
    tingkatan: tingkatanDariKelas(input.kelas),
    semester: input.semester,
    tahunAjaran: input.tahunAjaran,
    judul: potong(input.judul, BATAS_STEM_JUDUL),
    deskripsi: potong(input.deskripsi ?? '', 2000),
    mapelTerlibat: normalisasiMapelTerlibat(input.mapelTerlibat),
    dplId: [...new Set(input.dplId.map((x) => x.trim()).filter(Boolean))].slice(0, 4),
    tanggalMulai: input.tanggalMulai || '',
    tanggalSelesai: input.tanggalSelesai || '',
    jumlahPertemuan: Math.max(0, Math.floor(Number(input.jumlahPertemuan) || 0)),
    scaffolding: normalisasiScaffolding(input.scaffolding),
    daftarNilai: normalisasiDaftarNilai(input.daftarNilai),
    rubrik,
    updatedAt: serverTimestamp(),
  }
  if (input.id) {
    await setDoc(doc(db, 'proyek_stem', input.id), data, { merge: true })
    return input.id
  }
  const ref = await addDoc(collection(db, 'proyek_stem'), {
    ...data,
    createdAt: serverTimestamp(),
  })
  return ref.id
}

export async function hapusProyekStem(id: string): Promise<void> {
  await deleteDoc(doc(db, 'proyek_stem', id))
}

// ── Nilai DPL per siswa × proyek (koleksi `kokurikuler`) ─────────────────────

/** ID deterministik: proyek × siswa × DPL. */
export function idNilaiDpl(proyekStemId: string, siswaId: string, dplId: string): string {
  return `${proyekStemId}__${siswaId}__${dplId}`.replace(/[/\\]/g, '_')
}

/**
 * Map: siswaId → { dplId → { id, level, deskripsi } }
 */
export async function getNilaiDplByProyek(
  proyekStemId: string,
  kelas: string,
): Promise<Record<string, Record<string, { id: string; level: LevelDpl; deskripsi: string }>>> {
  const s = await getDocs(
    query(
      collection(db, 'kokurikuler'),
      where('proyekStemId', '==', proyekStemId),
      where('kelas', '==', kelas),
    ),
  )
  const map: Record<string, Record<string, { id: string; level: LevelDpl; deskripsi: string }>> = {}
  s.forEach((d) => {
    const data = d.data() as NilaiDplStem
    const sid = String(data.siswaId ?? '')
    const did = String(data.dplId ?? '')
    if (!sid || !did) return
    if (!map[sid]) map[sid] = {}
    const lvl = Number(data.level)
    map[sid][did] = {
      id: d.id,
      level: (lvl >= 1 && lvl <= 4 ? lvl : 1) as LevelDpl,
      deskripsi: String(data.deskripsi ?? ''),
    }
  })
  return map
}

export async function simpanNilaiDpl(input: {
  siswaId: string
  dplId: string
  kelas: string
  semester: Semester
  tahunAjaran: string
  proyekStemId: string
  level: LevelDpl
  deskripsi: string
}): Promise<void> {
  const id = idNilaiDpl(input.proyekStemId, input.siswaId, input.dplId)
  await setDoc(doc(db, 'kokurikuler', id), {
    siswaId: input.siswaId,
    dplId: input.dplId,
    kelas: input.kelas,
    tingkatan: tingkatanDariKelas(input.kelas),
    semester: input.semester,
    tahunAjaran: input.tahunAjaran,
    proyekStemId: input.proyekStemId,
    level: input.level,
    deskripsi: potong(input.deskripsi, BATAS_NILAI_DPL_DESKRIPSI),
    updatedAt: serverTimestamp(),
  })
}

// ── 7KAIH ────────────────────────────────────────────────────────────────────

export function idG7kaih(siswaId: string, tahunAjaran: string, semester: Semester): string {
  return `${siswaId}_${tahunAjaran}_${semester}`.replace(/[/\\]/g, '_')
}

function normalisasiLevel7kaih(raw: unknown): LevelDpl | null {
  if (raw === null || raw === undefined || raw === '') return null
  const n = Math.round(Number(raw))
  return n >= 1 && n <= 4 ? (n as LevelDpl) : null
}

function normalisasiKebiasaan(raw: unknown): Record<string, CatatanKebiasaan> {
  const out: Record<string, CatatanKebiasaan> = {}
  const src = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  for (const k of DAFTAR_KEBIASAAN_7KAIH) {
    const item = src[k.id]
    if (item && typeof item === 'object') {
      const o = item as Record<string, unknown>
      // catatan/dplId adalah data lama: dipertahankan bila ada, tidak pernah dibuat baru oleh UI.
      const catatan = potong(String(o.catatan ?? ''), BATAS_7KAIH_CATATAN)
      const dplId = String(o.dplId ?? '')
      out[k.id] = {
        level: normalisasiLevel7kaih(o.level),
        ...(catatan ? { catatan } : {}),
        ...(dplId ? { dplId } : {}),
      }
    } else {
      out[k.id] = { level: null }
    }
  }
  return out
}

export async function getG7kaihByKelas(
  kelas: string,
  p: PeriodeScope,
): Promise<Record<string, G7kaih>> {
  const s = await getDocs(
    query(
      collection(db, 'g7kaih'),
      where('kelas', '==', kelas),
      where('semester', '==', p.semester),
      where('tahunAjaran', '==', p.tahunAjaran),
    ),
  )
  const map: Record<string, G7kaih> = {}
  s.forEach((d) => {
    const data = d.data() as Record<string, unknown>
    const siswaId = String(data.siswaId ?? '')
    if (!siswaId) return
    map[siswaId] = {
      id: d.id,
      siswaId,
      kelas: String(data.kelas ?? ''),
      tingkatan: String(data.tingkatan ?? ''),
      semester: String(data.semester ?? p.semester) as Semester,
      tahunAjaran: String(data.tahunAjaran ?? p.tahunAjaran),
      kebiasaan: normalisasiKebiasaan(data.kebiasaan),
    }
  })
  return map
}

export async function simpanG7kaih(input: {
  siswaId: string
  kelas: string
  semester: Semester
  tahunAjaran: string
  kebiasaan: Record<string, CatatanKebiasaan>
}): Promise<void> {
  const id = idG7kaih(input.siswaId, input.tahunAjaran, input.semester)
  await setDoc(doc(db, 'g7kaih', id), {
    siswaId: input.siswaId,
    kelas: input.kelas,
    tingkatan: tingkatanDariKelas(input.kelas),
    semester: input.semester,
    tahunAjaran: input.tahunAjaran,
    kebiasaan: normalisasiKebiasaan(input.kebiasaan),
    updatedAt: serverTimestamp(),
  })
}

/** Simpan 7KAIH banyak siswa sekaligus (batch). Dipakai tabel isian: hanya baris yang berubah. */
export async function simpanG7kaihBanyak(input: {
  kelas: string
  semester: Semester
  tahunAjaran: string
  items: { siswaId: string; kebiasaan: Record<string, CatatanKebiasaan> }[]
}): Promise<void> {
  const tingkatan = tingkatanDariKelas(input.kelas)
  for (let i = 0; i < input.items.length; i += 400) {
    const batch = writeBatch(db)
    for (const it of input.items.slice(i, i + 400)) {
      batch.set(doc(db, 'g7kaih', idG7kaih(it.siswaId, input.tahunAjaran, input.semester)), {
        siswaId: it.siswaId,
        kelas: input.kelas,
        tingkatan,
        semester: input.semester,
        tahunAjaran: input.tahunAjaran,
        kebiasaan: normalisasiKebiasaan(it.kebiasaan),
        updatedAt: serverTimestamp(),
      })
    }
    await batch.commit()
  }
}


// ── Nilai proyek STEM (skor 0–100 per aspek rubrik) ─────────────────────────

function idNilaiProyek(proyekStemId: string, siswaId: string): string {
  return `${proyekStemId}_${siswaId}`
}

function dariDocNilaiProyek(id: string, data: Record<string, unknown>): NilaiProyekStem {
  const raw = data.nilai && typeof data.nilai === 'object' ? (data.nilai as Record<string, unknown>) : {}
  const nilai: Record<string, number | null> = {}
  for (const [k, v] of Object.entries(raw)) {
    if (v === null || v === undefined || v === '') {
      nilai[k] = null
    } else {
      const n = Math.round(Number(v))
      if (Number.isFinite(n)) nilai[k] = Math.max(0, Math.min(100, n))
    }
  }
  return {
    id,
    proyekStemId: String(data.proyekStemId ?? ''),
    siswaId: String(data.siswaId ?? ''),
    kelas: String(data.kelas ?? ''),
    tingkatan: String(data.tingkatan ?? ''),
    semester: String(data.semester ?? '1') as Semester,
    tahunAjaran: String(data.tahunAjaran ?? ''),
    nilai,
  }
}

export async function getNilaiProyekByProyek(proyekStemId: string): Promise<NilaiProyekStem[]> {
  const s = await getDocs(
    query(collection(db, 'nilai_proyek_stem'), where('proyekStemId', '==', proyekStemId)),
  )
  return s.docs.map((d) => dariDocNilaiProyek(d.id, d.data() as Record<string, unknown>))
}

export async function simpanNilaiProyek(input: {
  proyekStemId: string
  siswaId: string
  kelas: string
  semester: Semester
  tahunAjaran: string
  nilai: Record<string, number | null>
}): Promise<void> {
  const id = idNilaiProyek(input.proyekStemId, input.siswaId)
  const bersih: Record<string, number | null> = {}
  for (const [k, v] of Object.entries(input.nilai)) {
    if (v === null || v === undefined || (typeof v === 'number' && Number.isNaN(v))) {
      bersih[k] = null
    } else {
      const n = Math.round(Number(v))
      if (Number.isFinite(n)) bersih[k] = Math.max(0, Math.min(100, n))
    }
  }
  await setDoc(
    doc(db, 'nilai_proyek_stem', id),
    {
      proyekStemId: input.proyekStemId,
      siswaId: input.siswaId,
      kelas: input.kelas,
      tingkatan: tingkatanDariKelas(input.kelas),
      semester: input.semester,
      tahunAjaran: input.tahunAjaran,
      nilai: bersih,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  )
}
