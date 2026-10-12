import {
  addDoc,
  collection,
  doc,
  deleteDoc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore'
import { auth, db } from './firebase'
import { faseDariTingkatan } from './akademikRumus'
import { MAPEL_BAWAAN } from './mapelBawaan'
import type {
  ConfigAkademik,
  LevelKktp,
  Mapel,
  NilaiTpDoc,
  Semester,
  TipeTp,
  TujuanPembelajaran,
} from '../types/akademik'

// Rumus & konstanta ada di akademikRumus.ts; diekspor ulang agar halaman cukup impor dari sini.
export * from './akademikRumus'

/* ==========================================================================
   Firestore
   ========================================================================== */

const uid = () => auth.currentUser?.uid ?? null

function dokumenKeMapel(id: string, data: Record<string, unknown>): Mapel {
  return {
    id,
    nama: typeof data.nama === 'string' && data.nama ? data.nama : id,
    urutan: typeof data.urutan === 'number' ? data.urutan : 0,
    tingkatanBerlaku: Array.isArray(data.tingkatanBerlaku)
      ? data.tingkatanBerlaku.filter((x): x is string => typeof x === 'string')
      : undefined,
  }
}

export async function getMapelList(): Promise<Mapel[]> {
  try {
    const snap = await getDocs(collection(db, 'mapel'))
    if (snap.empty) return MAPEL_BAWAAN.map((m) => ({ ...m, tingkatanBerlaku: [...(m.tingkatanBerlaku ?? [])] }))
    return snap.docs
      .map((d) => dokumenKeMapel(d.id, d.data() as Record<string, unknown>))
      .sort((a, b) => (a.urutan ?? 0) - (b.urutan ?? 0) || a.nama.localeCompare(b.nama, 'id'))
  } catch {
    return MAPEL_BAWAAN.map((m) => ({ ...m, tingkatanBerlaku: [...(m.tingkatanBerlaku ?? [])] }))
  }
}

/** True bila koleksi Firestore `mapel` sudah berisi dokumen. */
export async function adaMapelTersimpan(): Promise<boolean> {
  const snap = await getDocs(collection(db, 'mapel'))
  return !snap.empty
}

export async function simpanMapel(m: Mapel): Promise<void> {
  const nama = m.nama.trim()
  await setDoc(doc(db, 'mapel', nama), {
    nama,
    urutan: m.urutan ?? 0,
    tingkatanBerlaku: m.tingkatanBerlaku ?? [],
  })
}

export async function hapusMapel(nama: string): Promise<void> {
  await deleteDoc(doc(db, 'mapel', nama))
}

/** Tulis daftar bawaan yang belum ada. Tidak menimpa mapel yang sudah disimpan. */
export async function unggahMapelBawaan(): Promise<number> {
  const snap = await getDocs(collection(db, 'mapel'))
  const punya = new Set(snap.docs.map((d) => d.id))
  let n = 0
  for (const m of MAPEL_BAWAAN) {
    if (punya.has(m.nama)) continue
    await simpanMapel(m)
    n += 1
  }
  return n
}

/** Satu mapel. Dokumen yang belum ada memakai daftar bawaan. Nama yang tidak dikenal dianggap berlaku di semua tingkatan. Kesalahan jaringan dilempar — pemanggil yang memutuskan apakah boleh lanjut. */
export async function getMapelByNama(nama: string): Promise<Mapel> {
  const snap = await getDoc(doc(db, 'mapel', nama))
  if (snap.exists()) return dokumenKeMapel(snap.id, snap.data() as Record<string, unknown>)
  const bawaan = MAPEL_BAWAAN.find((m) => m.nama === nama)
  if (bawaan) return { ...bawaan, tingkatanBerlaku: [...(bawaan.tingkatanBerlaku ?? [])] }
  return { id: nama, nama, tingkatanBerlaku: [] }
}

const CONFIG_BAWAAN: ConfigAkademik = { semesterAktif: '1', tahunAjaran: '2026/2027' }

export async function getConfigAkademik(): Promise<ConfigAkademik> {
  const snap = await getDoc(doc(db, 'config', 'akademik'))
  return snap.exists() ? ({ ...CONFIG_BAWAAN, ...snap.data() } as ConfigAkademik) : CONFIG_BAWAAN
}

/** Tahun ajaran dan semester aktif. Field lain di dokumen yang sama tidak ditimpa. */
export async function simpanSemesterAktif(p: { semesterAktif: Semester; tahunAjaran: string }): Promise<void> {
  await setDoc(
    doc(db, 'config', 'akademik'),
    { semesterAktif: p.semesterAktif, tahunAjaran: p.tahunAjaran.trim() },
    { merge: true },
  )
}

export async function getTPList(mapel: string, tingkatan: string): Promise<TujuanPembelajaran[]> {
  const q = query(
    collection(db, 'tp_kktp'),
    where('mapel', '==', mapel),
    where('tingkatan', '==', String(tingkatan)),
  )
  const snap = await getDocs(q)
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }) as TujuanPembelajaran)
    .sort((a, b) => (a.nomorTp || 0) - (b.nomorTp || 0))
}

export interface TpPayload {
  id?: string
  mapel: string
  tingkatan: string
  nomorTp: number
  namaTp: string
  cp?: string
  tipe: TipeTp
  bobotSlm?: number
  bobotSas?: number
  levels: LevelKktp[]
}

/**
 * Simpan TP. `semester` & `bobotMapel` SENGAJA tidak ditulis di sini — keduanya milik halaman
 * Bobot Semester. Menulisnya di sini menimpa balik pengaturan guru (v2 antiregresi §20.3).
 */
export async function saveTP(p: TpPayload): Promise<void> {
  const data = {
    mapel: p.mapel,
    tingkatan: String(p.tingkatan),
    fase: faseDariTingkatan(p.tingkatan),
    nomorTp: p.nomorTp,
    namaTp: p.namaTp,
    cp: p.cp || '',
    tipe: p.tipe === 'kinerja' ? 'kinerja' : 'pengetahuan',
    bobotSlm: p.bobotSlm ?? 60,
    bobotSas: p.bobotSas ?? 40,
    levels: p.levels,
  }
  if (p.id) {
    await updateDoc(doc(db, 'tp_kktp', p.id), { ...data, updatedAt: serverTimestamp(), updatedBy: uid() })
  } else {
    await addDoc(collection(db, 'tp_kktp'), { ...data, createdAt: serverTimestamp(), createdBy: uid() })
  }
}

export async function deleteTP(id: string): Promise<void> {
  await deleteDoc(doc(db, 'tp_kktp', id))
}

/** Simpan semester + bobot banyak TP sekaligus (hanya dua field ini). */
export async function saveBobotSemesterBatch(
  daftar: { id: string; semester: Semester; bobotMapel: number }[],
): Promise<void> {
  for (let i = 0; i < daftar.length; i += 400) {
    const batch = writeBatch(db)
    daftar.slice(i, i + 400).forEach((d) =>
      batch.update(doc(db, 'tp_kktp', d.id), { semester: d.semester, bobotMapel: d.bobotMapel }),
    )
    await batch.commit()
  }
}

/**
 * Nilai SLM satu TP untuk satu kelas. mapel & kelas WAJIB ikut sebagai filter karena rules
 * `nilai_tp` memeriksa keduanya (v2 antiregresi §1.1).
 */
export async function getNilaiTPUntukTP(ctx: {
  tpId: string
  mapel: string
  kelas: string
  semester: Semester
  tahunAjaran: string
}): Promise<Record<string, NilaiTpDoc>> {
  const q = query(
    collection(db, 'nilai_tp'),
    where('tpId', '==', ctx.tpId),
    where('mapel', '==', ctx.mapel),
    where('kelas', '==', ctx.kelas),
    where('semester', '==', ctx.semester),
    where('tahunAjaran', '==', ctx.tahunAjaran),
  )
  const snap = await getDocs(q)
  const map: Record<string, NilaiTpDoc> = {}
  snap.forEach((d) => {
    const v = { id: d.id, ...d.data() } as NilaiTpDoc
    map[v.siswaId] = v
  })
  return map
}

/** Semua nilai SLM satu mapel+kelas pada semester berjalan, dikelompokkan tpId → siswaId. */
export async function getNilaiTPKelas(ctx: {
  mapel: string
  kelas: string
  semester: Semester
  tahunAjaran: string
}): Promise<Record<string, Record<string, NilaiTpDoc>>> {
  const q = query(
    collection(db, 'nilai_tp'),
    where('mapel', '==', ctx.mapel),
    where('kelas', '==', ctx.kelas),
    where('semester', '==', ctx.semester),
    where('tahunAjaran', '==', ctx.tahunAjaran),
  )
  const snap = await getDocs(q)
  const map: Record<string, Record<string, NilaiTpDoc>> = {}
  snap.forEach((d) => {
    const v = { id: d.id, ...d.data() } as NilaiTpDoc
    if (!v.tpId || !v.siswaId) return
    if (!map[v.tpId]) map[v.tpId] = {}
    map[v.tpId][v.siswaId] = v
  })
  return map
}

/** Simpan SLM banyak siswa untuk satu TP (upsert, batch). Nilai null/kosong dilewati. */
export async function saveNilaiTPBatch(
  ctx: { tpId: string; mapel: string; kelas: string; tingkatan: string; semester: Semester; tahunAjaran: string },
  entries: { siswaId: string; slm: number }[],
  existing: Record<string, NilaiTpDoc>,
): Promise<number> {
  let n = 0
  for (let i = 0; i < entries.length; i += 400) {
    const batch = writeBatch(db)
    for (const { siswaId, slm } of entries.slice(i, i + 400)) {
      const data = {
        tpId: ctx.tpId,
        siswaId,
        mapel: ctx.mapel,
        kelas: ctx.kelas,
        tingkatan: String(ctx.tingkatan),
        semester: ctx.semester,
        tahunAjaran: ctx.tahunAjaran,
        slm,
      }
      const found = existing[siswaId]
      if (found) {
        batch.update(doc(db, 'nilai_tp', found.id), { ...data, updatedAt: serverTimestamp(), updatedBy: uid() })
      } else {
        batch.set(doc(collection(db, 'nilai_tp')), { ...data, createdAt: serverTimestamp(), createdBy: uid() })
      }
      n++
    }
    await batch.commit()
  }
  return n
}
