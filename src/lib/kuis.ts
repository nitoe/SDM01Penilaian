/**
 * CRUD kuis LMS — model baru: soal di-snapshot di dokumen `lms_kuis`.
 * Sumber: paket bank `lms_paket_soal` berstatus `siap`.
 */
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  updateDoc,
  deleteField,
  where,
} from 'firebase/firestore'
import { auth, db } from './firebase'
import type { PaketSoal } from '../types/soal'
import type {
  FilterSusunKuis,
  KuisLms,
  ModeSusunKuis,
  SoalKuis,
  TahapTryOutTka,
} from '../types/kuis'
import { BATAS_PAKET_SUMBER, BATAS_SOAL_PER_KUIS } from '../types/kuis'
import {
  hitungRingkasanKuis,
  kumpulkanKandidat,
  susunManual,
  susunOtomatis,
} from './susunKuis'
import { daftarPaket, daftarPaketLombaSemua } from './soal'
import { adalahMapelGabungan } from './lombaAkses'
import { normalisasiKelasList } from './kelasLms'

function koleksi() {
  return collection(db, 'lms_kuis')
}

/** Firestore menolak `undefined`. */
function bersihkan<T>(x: T): T {
  return JSON.parse(JSON.stringify(x)) as T
}

function mapDokKuis(id: string, data: Record<string, unknown>): KuisLms {
  return {
    id,
    ...data,
    kelas: String(data.kelas || '').toUpperCase(),
    kelasList: Array.isArray(data.kelasList)
      ? (data.kelasList as string[]).map((x) => String(x).toUpperCase()).filter(Boolean)
      : undefined,
    sumberPaketIds: Array.isArray(data.sumberPaketIds) ? data.sumberPaketIds : [],
    soal: Array.isArray(data.soal) ? data.soal : [],
    modeSusun: (data.modeSusun as ModeSusunKuis) || 'manual',
    jumlahSoal: typeof data.jumlahSoal === 'number' ? data.jumlahSoal : ((data.soal as unknown[])?.length ?? 0),
    totalPoin: typeof data.totalPoin === 'number' ? data.totalPoin : 0,
  } as KuisLms
}

export async function daftarKuis(kelas: string, mapel: string): Promise<KuisLms[]> {
  const k = String(kelas).toUpperCase()
  const map = new Map<string, KuisLms>()

  const snap = await getDocs(
    query(koleksi(), where('kelas', '==', k), where('mapel', '==', mapel)),
  )
  for (const d of snap.docs) {
    map.set(d.id, mapDokKuis(d.id, d.data() as Record<string, unknown>))
  }

  // Query harus menyertakan mapel agar rules list evaluation lolos
  // (lmsLihatViaKelasList + mapel ter-constraint). ANTIREGRESI §128.
  try {
    const snap2 = await getDocs(
      query(koleksi(), where('mapel', '==', mapel), where('kelasList', 'array-contains', k)),
    )
    for (const d of snap2.docs) {
      if (map.has(d.id)) continue
      map.set(d.id, mapDokKuis(d.id, d.data() as Record<string, unknown>))
    }
  } catch (e) {
    console.warn('daftarKuis kelasList', e)
  }

  const list = [...map.values()]
  list.sort((a, b) => {
    const ta = (a.updatedAt as { seconds?: number })?.seconds ?? 0
    const tb = (b.updatedAt as { seconds?: number })?.seconds ?? 0
    return tb - ta
  })
  return list
}

/** Semua kuis yang dibuat user saat ini (agar kuis lama tetap bisa digabung di panel). */
export async function daftarKuisDibuatOleh(uid?: string): Promise<KuisLms[]> {
  const id = uid || auth.currentUser?.uid
  if (!id) return []
  const q = query(koleksi(), where('dibuatOleh', '==', id))
  const snap = await getDocs(q)
  return snap.docs.map((d) => {
    const data = d.data()
    return {
      id: d.id,
      ...data,
      kelas: String(data.kelas || '').toUpperCase(),
      kelasList: Array.isArray(data.kelasList)
        ? (data.kelasList as string[]).map((x) => String(x).toUpperCase()).filter(Boolean)
        : undefined,
      sumberPaketIds: Array.isArray(data.sumberPaketIds) ? data.sumberPaketIds : [],
      soal: Array.isArray(data.soal) ? data.soal : [],
      modeSusun: (data.modeSusun as ModeSusunKuis) || 'manual',
      jumlahSoal: typeof data.jumlahSoal === 'number' ? data.jumlahSoal : (data.soal?.length ?? 0),
      totalPoin: typeof data.totalPoin === 'number' ? data.totalPoin : 0,
    } as KuisLms
  })
}

export async function ambilKuis(id: string): Promise<KuisLms | null> {
  const s = await getDoc(doc(db, 'lms_kuis', id))
  if (!s.exists()) return null
  const data = s.data()
  return {
    id: s.id,
    ...data,
    sumberPaketIds: Array.isArray(data.sumberPaketIds) ? data.sumberPaketIds : [],
    soal: Array.isArray(data.soal) ? data.soal : [],
    modeSusun: (data.modeSusun as ModeSusunKuis) || 'manual',
    jumlahSoal: typeof data.jumlahSoal === 'number' ? data.jumlahSoal : (data.soal?.length ?? 0),
    totalPoin: typeof data.totalPoin === 'number' ? data.totalPoin : 0,
  } as KuisLms
}


export async function daftarKuisLomba(lombaId: string, mapel: string): Promise<KuisLms[]> {
  if (!lombaId) return []
  const snap = await getDocs(
    query(koleksi(), where('lombaId', '==', lombaId), where('mapel', '==', mapel)),
  )
  return snap.docs.map((d) => {
    const data = d.data()
    return {
      id: d.id,
      ...data,
      kelas: String(data.kelas || '').toUpperCase(),
      sumberPaketIds: Array.isArray(data.sumberPaketIds) ? data.sumberPaketIds : [],
      soal: Array.isArray(data.soal) ? data.soal : [],
      modeSusun: (data.modeSusun as ModeSusunKuis) || 'manual',
      jumlahSoal: typeof data.jumlahSoal === 'number' ? data.jumlahSoal : (data.soal?.length ?? 0),
      totalPoin: typeof data.totalPoin === 'number' ? data.totalPoin : 0,
    } as KuisLms
  })
}

/** Semua kuis aktif milik satu lomba (semua mapel + Gabungan). Untuk siswa peserta. */
export async function daftarKuisLombaAktif(lombaId: string): Promise<KuisLms[]> {
  if (!lombaId) return []
  const snap = await getDocs(
    query(koleksi(), where('lombaId', '==', lombaId), where('aktif', '==', true)),
  )
  const list = snap.docs.map((d) => mapDokKuis(d.id, d.data() as Record<string, unknown>))
  list.sort((a, b) => {
    const ta = (a.updatedAt as { seconds?: number })?.seconds ?? 0
    const tb = (b.updatedAt as { seconds?: number })?.seconds ?? 0
    return tb - ta
  })
  return list
}

export type InputBuatKuis = {
  kelas: string
  mapel: string
  judul: string
  deskripsi?: string
  namaGuru?: string
  sumberPaketIds: string[]
  modeSusun: ModeSusunKuis
  filterSusun?: FilterSusunKuis
  /** Mode manual: daftar pilihan. Mode otomatis diisi lib. */
  pilihanManual?: { paketId: string; soalId: string }[]
  /** Jika sudah dihitung di UI (mis. setelah AI filter). */
  soalSiap?: SoalKuis[]
  durasiMenit?: number
  acakSoal?: boolean
  acakOpsi?: boolean
  tpIds?: string[]
  tpNamaList?: string[]
  /** TKA saja: tahap Try Out I–V (untuk rekap nilai TKA). */
  tahapTryOutTka?: TahapTryOutTka
  /** Scope modul Lomba. */
  lombaId?: string
}

/**
 * Buat kuis baru dari paket siap.
 * - Manual: pakai `pilihanManual` atau `soalSiap`.
 * - Otomatis / otomatis_ai: susun dari filter; pemanggil AI boleh kirim `soalSiap` hasil penyesuaian.
 */
export async function buatKuisDariPaket(input: InputBuatKuis): Promise<string> {
  const uid = auth.currentUser?.uid
  if (!uid) throw new Error('Anda harus masuk terlebih dahulu.')

  const judul = input.judul.trim()
  if (!judul) throw new Error('Judul kuis wajib diisi.')
  if (!input.sumberPaketIds?.length) {
    throw new Error('Pilih minimal satu paket soal yang siap.')
  }
  if (input.sumberPaketIds.length > BATAS_PAKET_SUMBER) {
    throw new Error(`Maksimal ${BATAS_PAKET_SUMBER} paket sumber.`)
  }

  let soal: SoalKuis[] = input.soalSiap ?? []

  if (soal.length === 0) {
    const semuaPaket = input.lombaId
      ? (await daftarPaketLombaSemua(input.lombaId)).filter(
          (p) => adalahMapelGabungan(input.mapel) || p.mapel === input.mapel,
        )
      : await daftarPaket(input.kelas, input.mapel)
    const peta = new Map(semuaPaket.map((p) => [p.id, p]))
    const paketDipilih: PaketSoal[] = []
    for (const id of input.sumberPaketIds) {
      const p = peta.get(id)
      if (!p) throw new Error(`Paket ${id} tidak ditemukan.`)
      if (p.status !== 'siap') throw new Error(`Paket «${p.judul}» belum berstatus Siap.`)
      paketDipilih.push(p)
    }
    const kandidat = kumpulkanKandidat(paketDipilih)

    if (input.modeSusun === 'manual') {
      if (!input.pilihanManual?.length) {
        throw new Error('Pilih minimal satu soal secara manual.')
      }
      soal = susunManual(kandidat, input.pilihanManual)
    } else {
      soal = susunOtomatis(kandidat, input.filterSusun, { seedAcak: true })
    }
  }

  if (soal.length === 0) {
    throw new Error('Tidak ada soal yang memenuhi filter / pilihan.')
  }
  if (soal.length > BATAS_SOAL_PER_KUIS) {
    throw new Error(`Maksimal ${BATAS_SOAL_PER_KUIS} soal per kuis.`)
  }

  const ringkas = hitungRingkasanKuis(soal)
  const kelasU = String(input.kelas).toUpperCase()
  const payload = bersihkan({
    kelas: kelasU,
    kelasList: normalisasiKelasList(kelasU),
    mapel: input.mapel.trim(),
    ...(input.lombaId ? { lombaId: input.lombaId } : {}),
    judul,
    deskripsi: input.deskripsi?.trim() || undefined,
    sumberPaketIds: input.sumberPaketIds,
    modeSusun: input.modeSusun,
    filterSusun: input.filterSusun,
    soal,
    durasiMenit: typeof input.durasiMenit === 'number' ? input.durasiMenit : undefined,
    acakSoal: !!input.acakSoal,
    acakOpsi: input.acakOpsi !== false,
    aktif: false,
    dibuatOleh: uid,
    dibuatOlehNama: input.namaGuru || '',
    tpIds: input.tpIds,
    tpNamaList: input.tpNamaList,
    tahapTryOutTka: input.tahapTryOutTka,
    ...ringkas,
  })

  const refDoc = await addDoc(koleksi(), {
    ...payload,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
  return refDoc.id
}

export async function updateKuis(
  id: string,
  data: Partial<
    Pick<
      KuisLms,
      | 'judul'
      | 'deskripsi'
      | 'soal'
      | 'durasiMenit'
      | 'acakSoal'
      | 'acakOpsi'
      | 'waktuMulai'
      | 'waktuSelesai'
      | 'token'
      | 'jenisPenilaian'
      | 'tpIds'
      | 'tpNamaList'
      | 'nilaiPerTp'
      | 'sumberNilai'
      | 'aktif'
      | 'filterSusun'
      | 'modeSusun'
      | 'sumberPaketIds'
      | 'modePelaksanaan'
      | 'hasilDipublish'
      | 'tahapTryOutTka'
    >
  >,
): Promise<void> {
  const payload: Record<string, unknown> = { ...data }
  if (data.soal) {
    if (data.soal.length > BATAS_SOAL_PER_KUIS) {
      throw new Error(`Maksimal ${BATAS_SOAL_PER_KUIS} soal per kuis.`)
    }
    Object.assign(payload, hitungRingkasanKuis(data.soal))
  }
  // Izinkan penghapusan tahap: caller kirim null → deleteField
  const hapusTahap = (data as { tahapTryOutTka?: unknown }).tahapTryOutTka === null
  if (hapusTahap) {
    payload.tahapTryOutTka = deleteField()
  }
  for (const k of Object.keys(payload)) {
    if (payload[k] === undefined) delete payload[k]
  }
  const bersih = hapusTahap
    ? payload // jangan JSON.stringify (deleteField hilang)
    : bersihkan(payload)
  await updateDoc(doc(db, 'lms_kuis', id), {
    ...bersih,
    updatedAt: serverTimestamp(),
  })
}

export async function hapusKuis(kuisId: string): Promise<void> {
  await deleteDoc(doc(db, 'lms_kuis', kuisId))
}

/**
 * Semua paket yang boleh jadi sumber sebuah kuis. Kuis Lomba: paket se-lomba (kuis gabungan = semua mapel,
 * kuis biasa = hanya mapelnya); kuis ruang kelas: paket kelas×mapel. Jangan dipakai untuk kuis Lomba dengan
 * `daftarPaket(kuis.kelas, kuis.mapel)` — kelas «LB» tercampur antar-lomba dan ditolak rules guru pengampu.
 */
export async function daftarPaketUntukKuis(
  kuis: Pick<KuisLms, 'kelas' | 'mapel' | 'lombaId'>,
): Promise<PaketSoal[]> {
  if (kuis.lombaId) {
    const semua = await daftarPaketLombaSemua(kuis.lombaId)
    return adalahMapelGabungan(kuis.mapel) ? semua : semua.filter((p) => p.mapel === kuis.mapel)
  }
  return daftarPaket(kuis.kelas, kuis.mapel)
}

/** Paket siap saja untuk kelas×mapel (untuk wizard). */
export async function daftarPaketSiap(kelas: string, mapel: string): Promise<PaketSoal[]> {
  const semua = await daftarPaket(kelas, mapel)
  return semua.filter((p) => p.status === 'siap' && (p.soal?.length ?? 0) > 0)
}


/** Atur kelas yang boleh melihat kuis (paralel se-tingkat yang diampu). */
export async function aturBerbagiKuis(
  id: string,
  kelasUtama: string,
  kelasListBaru: string[],
): Promise<void> {
  const list = normalisasiKelasList(kelasUtama, kelasListBaru)
  await updateDoc(doc(db, 'lms_kuis', id), {
    kelasList: list,
    updatedAt: serverTimestamp(),
  })
}
