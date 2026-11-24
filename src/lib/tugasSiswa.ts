import { collection, getDocs, query, where } from 'firebase/firestore'
import { db } from './firebase'
import type { TugasLms } from '../types/tugas'
import type { NilaiTugasDok } from './nilaiTugas'
import { rapikanBuktiList } from './buktiTugas'

/** Status tugas dari sudut pandang siswa (tanpa pengumpulan file dulu). */
export type StatusTugasSiswa = 'belum' | 'dinilai' | 'lewat'

export type TugasSiswaRingkas = {
  tugas: TugasLms
  status: StatusTugasSiswa
  nilai?: NilaiTugasDok
}

function docKeTugas(id: string, data: Record<string, unknown>): TugasLms {
  const jenis = data.jenis === 'proyek' ? 'proyek' : 'mapel'
  const jenisPenilaian =
    data.jenisPenilaian === 'latihan' ||
    data.jenisPenilaian === 'slm' ||
    data.jenisPenilaian === 'sts' ||
    data.jenisPenilaian === 'sas'
      ? data.jenisPenilaian
      : 'slm'

  return {
    id,
    kelas: String(data.kelas || '').toUpperCase(),
    kelasList: Array.isArray(data.kelasList)
      ? (data.kelasList as string[]).map((x) => String(x).toUpperCase()).filter(Boolean)
      : undefined,
    mapel: String(data.mapel || ''),
    mapelLain: Array.isArray(data.mapelLain)
      ? (data.mapelLain as string[]).filter(Boolean)
      : undefined,
    judul: String(data.judul || ''),
    deskripsi: typeof data.deskripsi === 'string' ? data.deskripsi : undefined,
    instruksi: typeof data.instruksi === 'string' ? data.instruksi : undefined,
    jenis,
    jenisPenilaian,
    tpList: Array.isArray(data.tpList) ? (data.tpList as TugasLms['tpList']) : undefined,
    tenggat: data.tenggat,
    aktif: data.aktif === true,
    statusTugas:
      data.statusTugas === 'draf' ||
      data.statusTugas === 'aktif_guru' ||
      data.statusTugas === 'aktif_siswa'
        ? data.statusTugas
        : data.aktif === true
          ? 'aktif_siswa'
          : 'draf',
    dibuatOleh: String(data.dibuatOleh || ''),
    dibuatOlehNama: typeof data.dibuatOlehNama === 'string' ? data.dibuatOlehNama : undefined,
    jumlahPengumpulan:
      typeof data.jumlahPengumpulan === 'number' ? data.jumlahPengumpulan : undefined,
    pengaturanPenilaian:
      data.pengaturanPenilaian && typeof data.pengaturanPenilaian === 'object'
        ? (data.pengaturanPenilaian as TugasLms['pengaturanPenilaian'])
        : undefined,
    buktiList: (() => {
      const b = rapikanBuktiList(data.buktiList)
      return b.length ? b : undefined
    })(),
    lampiranList: Array.isArray(data.lampiranList)
      ? (data.lampiranList as TugasLms['lampiranList'])
      : undefined,
    modeKelompok: data.modeKelompok === true,
    kelompokMaxAnggota:
      typeof data.kelompokMaxAnggota === 'number' && data.kelompokMaxAnggota >= 2
        ? Math.min(12, Math.floor(data.kelompokMaxAnggota))
        : undefined,
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
  }
}

/**
 * Tugas aktif untuk satu rombel (query selaras rules siswa:
 * aktif == true && kelas == claim kelas).
 */
export async function daftarTugasAktifKelas(kelas: string): Promise<TugasLms[]> {
  const k = String(kelas).toUpperCase()
  const map = new Map<string, TugasLms>()

  const q1 = query(
    collection(db, 'lms_tugas'),
    where('kelas', '==', k),
    where('aktif', '==', true),
  )
  const snap1 = await getDocs(q1)
  for (const d of snap1.docs) {
    map.set(d.id, docKeTugas(d.id, d.data() as Record<string, unknown>))
  }

  // Share: array-contains saja (filter aktif di klien) agar tidak butuh index compound baru
  try {
    const q2 = query(collection(db, 'lms_tugas'), where('kelasList', 'array-contains', k))
    const snap2 = await getDocs(q2)
    for (const d of snap2.docs) {
      if (map.has(d.id)) continue
      const t = docKeTugas(d.id, d.data() as Record<string, unknown>)
      if (t.aktif) map.set(d.id, t)
    }
  } catch (e) {
    console.warn('daftarTugasAktifKelas kelasList', e)
  }

  const list = [...map.values()]
  list.sort((a, b) => {
    const ta = tenggatMs(a.tenggat)
    const tb = tenggatMs(b.tenggat)
    if (ta && tb) return ta - tb
    if (ta) return -1
    if (tb) return 1
    return (a.judul || '').localeCompare(b.judul || '', 'id')
  })
  return list
}

export function tenggatMs(v: unknown): number {
  if (!v) return 0
  if (typeof v === 'object' && v !== null && 'seconds' in v) {
    return Number((v as { seconds: number }).seconds) * 1000
  }
  if (typeof v === 'string' || typeof v === 'number') {
    const t = new Date(v).getTime()
    return Number.isNaN(t) ? 0 : t
  }
  return 0
}

/** Apakah tenggat sudah lewat (hari ini melewati akhir hari tenggat). */
export function tenggatLewat(tenggat: unknown, sekarang = Date.now()): boolean {
  const ms = tenggatMs(tenggat)
  if (!ms) return false
  return ms < sekarang
}

/**
 * Status tampilan siswa:
 * - dinilai: ada dokumen nilai
 * - lewat: belum dinilai dan tenggat sudah lewat
 * - belum: selain itu
 */
export function statusTugasSiswa(
  tugas: Pick<TugasLms, 'tenggat'>,
  nilai?: Pick<NilaiTugasDok, 'nilai'> | null,
): StatusTugasSiswa {
  if (nilai && typeof nilai.nilai === 'number') return 'dinilai'
  if (tenggatLewat(tugas.tenggat)) return 'lewat'
  return 'belum'
}

/** Teks tenggat relatif untuk chip siswa. */
export function formatTenggatRelatif(tenggat: unknown, sekarang = Date.now()): string {
  const ms = tenggatMs(tenggat)
  if (!ms) return ''
  try {
    const tgl = new Date(ms)
    const absolut = tgl.toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: tgl.getFullYear() !== new Date(sekarang).getFullYear() ? 'numeric' : undefined,
    })
    const selisihHari = Math.ceil((ms - sekarang) / (24 * 60 * 60 * 1000))
    if (selisihHari < 0) {
      const lewat = Math.abs(selisihHari)
      return lewat === 0 ? `Hari ini (${absolut})` : `Lewat ${lewat} hari (${absolut})`
    }
    if (selisihHari === 0) return `Hari ini (${absolut})`
    if (selisihHari === 1) return `Besok (${absolut})`
    if (selisihHari <= 7) return `${selisihHari} hari lagi (${absolut})`
    return absolut
  } catch {
    return ''
  }
}
