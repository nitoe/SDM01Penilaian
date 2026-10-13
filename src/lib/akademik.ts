import {
  addDoc,
  collection,
  deleteField,
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
import { faseDariTingkatan, LEVEL_RANGE_DEFAULT, tingkatanDariKelas } from './akademikRumus'
import { aliasNamaMapel } from './tpImport'
import { MAPEL_BAWAAN } from './mapelBawaan'
import type {
  AsesmenCakupan,
  ConfigAkademik,
  JenisAsesmen,
  LevelKktp,
  Mapel,
  NilaiAsesmenDoc,
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

/** Identitas sekolah dan pengaturan akademik. Nilai lama di tahun ajaran lain tidak dipindahkan. */
export async function simpanProfilSekolah(p: {
  namaSekolah: string
  npsn: string
  alamatSekolah: string
  telpSekolah: string
  namaKepsek: string
  nbmKepsek: string
  tahunAjaran: string
  semesterAktif: Semester
  /** @deprecated Dipindah ke seni_kelas/{kelas} — diisi wali kelas. */
  seniSemesterGanjil?: string
  seniSemesterGenap?: string
  tglRapor: string
  tglRapor1sampai5: string
  kotaRapor: string
  dplSemesterIni: string[]
}): Promise<void> {
  const data: Record<string, unknown> = {
    namaSekolah: p.namaSekolah.trim(),
    npsn: p.npsn.trim(),
    alamatSekolah: p.alamatSekolah.trim(),
    telpSekolah: p.telpSekolah.trim(),
    namaKepsek: p.namaKepsek.trim(),
    nbmKepsek: p.nbmKepsek.trim(),
    tahunAjaran: p.tahunAjaran.trim(),
    semesterAktif: p.semesterAktif,
    tglRapor: p.tglRapor.trim(),
    tglRapor1sampai5: p.tglRapor1sampai5.trim(),
    kotaRapor: p.kotaRapor.trim(),
    dplSemesterIni: p.dplSemesterIni,
  }
  // Legacy field global tidak lagi ditulis dari admin.
  await setDoc(doc(db, 'config', 'akademik'), data, { merge: true })
}

/**
 * Daftar TP satu mapel di satu kelas paralel (5A ≠ 5B).
 * Argumen kedua adalah KELAS (mis. "5A"), bukan tingkatan.
 *
 * Tidak difilter per penginput: TP milik "dapur" mapel×kelas — guru kelas dan
 * guru bidang studi yang mengampu mapel ini di kelas yang sama melihat data yang sama.
 * Nama mapel ekuivalen (IPAS ↔ nama panjang, PJOK ↔ …) digabung agar tidak "hilang"
 * hanya karena beda penamaan di penugasan vs master mapel.
 */
export async function getTPList(mapel: string, kelas: string): Promise<TujuanPembelajaran[]> {
  const kelasU = String(kelas).toUpperCase()
  const namaKandidat = aliasNamaMapel(mapel)
  const hasil = await Promise.all(
    namaKandidat.map(async (nama) => {
      const q = query(
        collection(db, 'tp_kktp'),
        where('mapel', '==', nama),
        where('kelas', '==', kelasU),
      )
      const snap = await getDocs(q)
      return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as TujuanPembelajaran)
    }),
  )
  const byId = new Map<string, TujuanPembelajaran>()
  for (const daftar of hasil) {
    for (const tp of daftar) byId.set(tp.id, tp)
  }
  return [...byId.values()].sort((a, b) => (a.nomorTp || 0) - (b.nomorTp || 0))
}

export interface TpPayload {
  id?: string
  mapel: string
  /** Kelas paralel, contoh "5A". */
  kelas: string
  nomorTp: number
  namaTp: string
  cp?: string
  tipe: TipeTp
  bobotSlm?: number
  bobotSas?: number
  levels: LevelKktp[]
}

/**
 * Simpan TP. `semester`, `bobotMapel`, dan `bobotPerSemester` SENGAJA tidak ditulis di sini —
 * ketiganya milik halaman Bobot Semester. Menulisnya di sini menimpa balik pengaturan guru
 * (v2 antiregresi §20.3).
 */
export async function saveTP(p: TpPayload): Promise<void> {
  const kelas = String(p.kelas || '').toUpperCase()
  const tingkatan = tingkatanDariKelas(kelas)
  const data = {
    mapel: p.mapel,
    kelas,
    tingkatan,
    fase: faseDariTingkatan(tingkatan),
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

export type ModeImporTp = 'tambah' | 'ganti'

/** Normalisasi teks TP untuk deteksi duplikat (abaikan spasi/tanda baca/kapital). */
function kunciNamaTp(nama: string): string {
  return String(nama || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Impor banyak TP sekaligus.
 * - mode `tambah`: lewati jika nomorTp ATAU teks namaTp (dinormalisasi) sudah ada di mapel×kelas.
 *   Duplikat di dalam file yang sama juga dilewati (pertahankan yang pertama).
 * - mode `ganti`: hapus dulu semua TP mapel×kelas yang muncul di payload, lalu tulis ulang.
 * Tidak menyentuh semester/bobotMapel/bobotPerSemester (milik halaman Bobot Semester).
 */
export async function importTPBatch(
  items: {
    mapel: string
    kelas: string
    nomorTp: number
    namaTp: string
    cp?: string
    tipe?: TipeTp
    bobotSlm?: number
    bobotSas?: number
    levels?: LevelKktp[]
  }[],
  mode: ModeImporTp = 'tambah',
): Promise<{ ditulis: number; dilewati: number; dihapus: number }> {
  if (!items.length) return { ditulis: 0, dilewati: 0, dihapus: 0 }

  // Kelompokkan per mapel|kelas
  const grup = new Map<string, typeof items>()
  for (const it of items) {
    const k = `${it.mapel}|${String(it.kelas).toUpperCase()}`
    if (!grup.has(k)) grup.set(k, [])
    grup.get(k)!.push(it)
  }

  let ditulis = 0
  let dilewati = 0
  let dihapus = 0

  for (const [kunci, daftarMentah] of grup) {
    const [mapel, kelas] = kunci.split('|') as [string, string]

    // Dedup di dalam payload: nomorTp sama atau namaTp sama → ambil yang pertama
    const seenNomorFile = new Set<number>()
    const seenNamaFile = new Set<string>()
    const daftar: typeof items = []
    for (const it of daftarMentah) {
      const kn = kunciNamaTp(it.namaTp)
      if (seenNomorFile.has(it.nomorTp) || (kn && seenNamaFile.has(kn))) {
        dilewati += 1
        continue
      }
      seenNomorFile.add(it.nomorTp)
      if (kn) seenNamaFile.add(kn)
      daftar.push(it)
    }

    const existing = await getTPList(mapel, kelas)
    const byNomor = new Map(existing.map((t) => [t.nomorTp, t]))
    const byNama = new Map(
      existing.map((t) => [kunciNamaTp(t.namaTp), t] as const).filter(([k]) => k),
    )

    if (mode === 'ganti') {
      for (let i = 0; i < existing.length; i += 400) {
        const batch = writeBatch(db)
        existing.slice(i, i + 400).forEach((t) => batch.delete(doc(db, 'tp_kktp', t.id)))
        await batch.commit()
        dihapus += Math.min(400, existing.length - i)
      }
      byNomor.clear()
      byNama.clear()
    }

    const yangAkanDitulis = daftar.filter((it) => {
      if (mode !== 'tambah') return true
      const kn = kunciNamaTp(it.namaTp)
      if (byNomor.has(it.nomorTp) || (kn && byNama.has(kn))) {
        dilewati += 1
        return false
      }
      // Cegah dua item file yang lolos filter internal tetap bentrok dengan yang baru ditulis di batch ini
      byNomor.set(it.nomorTp, { id: '', nomorTp: it.nomorTp, namaTp: it.namaTp } as TujuanPembelajaran)
      if (kn) byNama.set(kn, { id: '', nomorTp: it.nomorTp, namaTp: it.namaTp } as TujuanPembelajaran)
      return true
    })

    for (let i = 0; i < yangAkanDitulis.length; i += 400) {
      const batch = writeBatch(db)
      for (const it of yangAkanDitulis.slice(i, i + 400)) {
        const ref = doc(collection(db, 'tp_kktp'))
        const kls = String(it.kelas).toUpperCase()
        const tingkatan = tingkatanDariKelas(kls)
        batch.set(ref, {
          mapel: it.mapel,
          kelas: kls,
          tingkatan,
          fase: faseDariTingkatan(tingkatan),
          nomorTp: it.nomorTp,
          namaTp: it.namaTp,
          cp: it.cp || '',
          tipe: it.tipe === 'kinerja' ? 'kinerja' : 'pengetahuan',
          bobotSlm: it.bobotSlm ?? 60,
          bobotSas: it.bobotSas ?? 40,
          levels: it.levels?.length === 4 ? it.levels : LEVEL_RANGE_DEFAULT.map((l) => ({ ...l, deskripsi: '' })),
          createdAt: serverTimestamp(),
          createdBy: uid(),
        })
        ditulis += 1
      }
      await batch.commit()
    }
  }

  return { ditulis, dilewati, dihapus }
}

/**
 * Simpan alokasi semester + bobot TP.
 * Menulis `bobotPerSemester` (sumber kebenaran baru) serta field legacy
 * `semester` + `bobotMapel` agar dokumen tetap terbaca oleh klien lama.
 * TP tanpa alokasi (kosong) → hapus ketiga field.
 */
export async function saveBobotSemesterBatch(
  daftar: {
    id: string
    /** Alokasi modern: key = semester yang dipakai, value = bobot %. */
    bobotPerSemester: Partial<Record<Semester, number>>
  }[],
): Promise<void> {
  for (let i = 0; i < daftar.length; i += 400) {
    const batch = writeBatch(db)
    daftar.slice(i, i + 400).forEach((d) => {
      const keys = (Object.keys(d.bobotPerSemester) as Semester[]).filter(
        (s) => d.bobotPerSemester[s] != null,
      )
      if (!keys.length) {
        batch.update(doc(db, 'tp_kktp', d.id), {
          semester: deleteField(),
          bobotMapel: deleteField(),
          bobotPerSemester: deleteField(),
        })
        return
      }
      const bps: Partial<Record<Semester, number>> = {}
      keys.forEach((s) => {
        bps[s] = Number(d.bobotPerSemester[s])
      })
      // Legacy: semester primer = yang pertama (urut 1 lalu 2); bobotMapel = bobot semester primer
      const primer: Semester = keys.includes('1') ? '1' : '2'
      batch.update(doc(db, 'tp_kktp', d.id), {
        bobotPerSemester: bps,
        semester: primer,
        bobotMapel: bps[primer] ?? 0,
      })
    })
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

const KOLEKSI_ASESMEN: Record<JenisAsesmen, 'nilai_sts' | 'nilai_sas'> = {
  sts: 'nilai_sts',
  sas: 'nilai_sas',
}

/** Cakupan TP untuk STS atau SAS. Query wajib menyertakan mapel dan kelas. */
export async function getCakupanTP(ctx: {
  mapel: string
  kelas: string
  semester: Semester
  tahunAjaran: string
  jenis: JenisAsesmen
}): Promise<AsesmenCakupan | null> {
  const q = query(
    collection(db, 'asesmen_cakupan'),
    where('mapel', '==', ctx.mapel),
    where('kelas', '==', ctx.kelas),
    where('semester', '==', ctx.semester),
    where('tahunAjaran', '==', ctx.tahunAjaran),
    where('jenis', '==', ctx.jenis),
  )
  const snap = await getDocs(q)
  if (snap.empty) return null
  const d = snap.docs[0]
  const data = d.data()
  return {
    id: d.id,
    mapel: String(data.mapel ?? ctx.mapel),
    kelas: String(data.kelas ?? ctx.kelas),
    tingkatan: String(data.tingkatan ?? ''),
    semester: data.semester === '2' ? '2' : '1',
    tahunAjaran: String(data.tahunAjaran ?? ctx.tahunAjaran),
    jenis: data.jenis === 'sas' ? 'sas' : 'sts',
    tpIds: Array.isArray(data.tpIds) ? data.tpIds.map(String) : [],
  }
}

export async function saveCakupanTP(payload: Omit<AsesmenCakupan, 'id'>, existingId?: string): Promise<void> {
  const data = {
    mapel: payload.mapel,
    kelas: payload.kelas,
    tingkatan: String(payload.tingkatan),
    semester: payload.semester,
    tahunAjaran: payload.tahunAjaran,
    jenis: payload.jenis,
    tpIds: payload.tpIds,
  }
  if (existingId) {
    await updateDoc(doc(db, 'asesmen_cakupan', existingId), {
      ...data,
      updatedAt: serverTimestamp(),
      updatedBy: uid(),
    })
  } else {
    await addDoc(collection(db, 'asesmen_cakupan'), {
      ...data,
      createdAt: serverTimestamp(),
      createdBy: uid(),
    })
  }
}

/** Nilai STS/SAS satu mapel+kelas, dikelompokkan tpId → siswaId. */
export async function getNilaiAsesmenKelas(ctx: {
  jenis: JenisAsesmen
  mapel: string
  kelas: string
  semester: Semester
  tahunAjaran: string
}): Promise<Record<string, Record<string, NilaiAsesmenDoc>>> {
  const q = query(
    collection(db, KOLEKSI_ASESMEN[ctx.jenis]),
    where('mapel', '==', ctx.mapel),
    where('kelas', '==', ctx.kelas),
    where('semester', '==', ctx.semester),
    where('tahunAjaran', '==', ctx.tahunAjaran),
  )
  const snap = await getDocs(q)
  const map: Record<string, Record<string, NilaiAsesmenDoc>> = {}
  snap.forEach((d) => {
    const raw = d.data()
    const tpId = String(raw.tpId ?? '')
    const siswaId = String(raw.siswaId ?? '')
    if (!tpId || !siswaId) return
    if (!map[tpId]) map[tpId] = {}
    map[tpId][siswaId] = {
      id: d.id,
      tpId,
      siswaId,
      mapel: String(raw.mapel ?? ctx.mapel),
      kelas: String(raw.kelas ?? ctx.kelas),
      tingkatan: String(raw.tingkatan ?? ''),
      semester: raw.semester === '2' ? '2' : '1',
      tahunAjaran: String(raw.tahunAjaran ?? ctx.tahunAjaran),
      nilai: Number(raw.nilai),
    }
  })
  return map
}

export async function saveNilaiAsesmenBatch(
  ctx: {
    jenis: JenisAsesmen
    tpId: string
    mapel: string
    kelas: string
    tingkatan: string
    semester: Semester
    tahunAjaran: string
  },
  entries: { siswaId: string; nilai: number }[],
  existing: Record<string, NilaiAsesmenDoc>,
): Promise<number> {
  const kol = KOLEKSI_ASESMEN[ctx.jenis]
  let n = 0
  for (let i = 0; i < entries.length; i += 400) {
    const batch = writeBatch(db)
    for (const { siswaId, nilai } of entries.slice(i, i + 400)) {
      const data = {
        tpId: ctx.tpId,
        siswaId,
        mapel: ctx.mapel,
        kelas: ctx.kelas,
        tingkatan: String(ctx.tingkatan),
        semester: ctx.semester,
        tahunAjaran: ctx.tahunAjaran,
        nilai,
      }
      const found = existing[siswaId]
      if (found) {
        batch.update(doc(db, kol, found.id), { ...data, updatedAt: serverTimestamp(), updatedBy: uid() })
      } else {
        batch.set(doc(collection(db, kol)), { ...data, createdAt: serverTimestamp(), createdBy: uid() })
      }
      n++
    }
    await batch.commit()
  }
  return n
}
