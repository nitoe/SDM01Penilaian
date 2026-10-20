import {
  getCakupanTP,
  getMapelList,
  getNilaiAsesmenKelas,
  getNilaiTPKelas,
  getTPList,
  mapelBerlakuDiTingkatan,
  tingkatanDariKelas,
  tpMasukSemester,
} from './akademik'
import { getSeniKelas, labelSeniBudaya } from './seniKelas'
import { getSiswaList } from './tahsinData'
import { hitungSasMapel, muatanMapel } from './asesmenRumus'
import { konteksData, faseDariKelas } from './raporSts'
import { getAbsensiKelas, getEkskulSiswaKelas, getKokurikulerKelas } from './raporData'
import { ekskulUntukRapor, keputusanRapor } from './raporDataRumus'
import type { BarisRaporSts, DataRaporSts } from './raporHtml'
import { EKS_LEVEL_LABEL } from '../types/raporData'
import type { Semester, TujuanPembelajaran, Mapel } from '../types/akademik'

/**
 * Rapor SAS (rapor akhir semester). HANYA MEMBACA (ANTIREGRESI §23).
 * Bahan tiap mapel (TP, cakupan SAS, nilai SLM/STS/SAS kelas) dimuat sekali per kelas, lalu dihitung
 * per siswa di memori dengan `hitungSasMapel`. Absensi, kokurikuler, dan ekskul: satu query per kelas.
 */
interface SumberMapelSas {
  mapel: Mapel
  labelMapel: string
  tpSemester: TujuanPembelajaran[]
  slm: Awaited<ReturnType<typeof getNilaiTPKelas>>
  sts: Awaited<ReturnType<typeof getNilaiAsesmenKelas>>
  sas: Awaited<ReturnType<typeof getNilaiAsesmenKelas>>
  cakupanSas: Set<string>
}

async function muatSumberSas(kelas: string, semester: Semester, tahunAjaran: string): Promise<SumberMapelSas[]> {
  const tingkatan = tingkatanDariKelas(kelas)
  const [mapelList, seni] = await Promise.all([getMapelList(), getSeniKelas(kelas)])
  const disiplin = semester === '2' ? seni.genap : seni.ganjil
  const berlaku = mapelList
    .filter((m) => mapelBerlakuDiTingkatan(m, tingkatan))
    .sort((a, b) => (a.urutan ?? 0) - (b.urutan ?? 0) || a.nama.localeCompare(b.nama, 'id'))
  const per = { kelas, semester, tahunAjaran }
  return Promise.all(
    berlaku.map(async (m) => {
      const [tpList, cakupan, slm, sts, sas] = await Promise.all([
        getTPList(m.nama, kelas),
        getCakupanTP({ mapel: m.nama, ...per, jenis: 'sas' }),
        getNilaiTPKelas({ mapel: m.nama, ...per }),
        getNilaiAsesmenKelas({ jenis: 'sts', mapel: m.nama, ...per }),
        getNilaiAsesmenKelas({ jenis: 'sas', mapel: m.nama, ...per }),
      ])
      return {
        mapel: m,
        labelMapel: m.nama === 'Seni Budaya' ? labelSeniBudaya(disiplin) : m.nama,
        tpSemester: tpList.filter((tp) => tpMasukSemester(tp, semester)),
        slm,
        sts,
        sas,
        cakupanSas: new Set(cakupan?.tpIds ?? []),
      }
    }),
  )
}

function barisDariSumberSas(
  sumber: SumberMapelSas[],
  siswaId: string,
  semester: Semester,
): BarisRaporSts[] {
  return sumber.map((m) => {
    const h = hitungSasMapel(
      m.tpSemester,
      { slm: m.slm, sts: m.sts, sas: m.sas, cakupanSas: m.cakupanSas },
      siswaId,
      semester,
    )
    return {
      mapel: m.mapel.nama,
      labelMapel: m.labelMapel,
      urutan: m.mapel.urutan ?? 0,
      muatan: muatanMapel(m.mapel.nama),
      nilaiAkhir: h.nilaiAkhir,
      capaianTerbaik: h.capaianTerbaik,
      capaianPerluBimbingan: h.capaianPerluBimbingan,
      levelIndexTerbaik: h.levelIndexTerbaik,
    }
  })
}

function dataSiswaDariSumber(
  s: { id: string; nama: string; nisn?: string; nipd?: string },
  ctx: { kelas: string; waliNama: string },
  k: Awaited<ReturnType<typeof konteksData>>,
  sumber: SumberMapelSas[],
  absensi: Awaited<ReturnType<typeof getAbsensiKelas>>,
  kokurikuler: Record<string, string>,
  ekskulSemua: Awaited<ReturnType<typeof getEkskulSiswaKelas>>,
): DataRaporSts {
  const a = absensi[s.id]
  return {
    config: k.config,
    siswa: { id: s.id, nama: s.nama, nisn: s.nisn, nipd: s.nipd },
    kelas: ctx.kelas,
    fase: faseDariKelas(ctx.kelas),
    semester: k.semester,
    semLabel: k.semester === '2' ? 'Genap' : 'Ganjil',
    tahunAjaran: k.tahunAjaran,
    daftarNilai: barisDariSumberSas(sumber, s.id, k.semester),
    waliNama: ctx.waliNama,
    kota: k.kota,
    tanggal: k.tanggal,
    kokurikuler: kokurikuler[s.id] ?? '',
    ekskul: ekskulUntukRapor(ekskulSemua.filter((e) => e.siswaId === s.id)).map((e) => ({
      nama: e.nama,
      predikat: EKS_LEVEL_LABEL[e.level - 1],
      ket: e.deskripsi,
    })),
    absensi: a ? { sakit: a.sakit, izin: a.izin, tk: a.tanpaKeterangan } : undefined,
    catatanWali: a?.catatanWali ?? '',
    keputusan: keputusanRapor(a?.keputusan),
  }
}

/** Satu siswa — dipakai halaman pratinjau/cetak Rapor SAS. Hanya membaca. */
export async function muatDataRaporSas(ctx: {
  siswa: { id: string; nama: string; nisn?: string; nipd?: string }
  kelas: string
  waliNama: string
  semester?: Semester
  tahunAjaran?: string
  kotaRapor?: string
  tanggalRapor?: string
}): Promise<DataRaporSts> {
  const k = await konteksData(ctx)
  const periode = { tahunAjaran: k.tahunAjaran, semester: k.semester }
  const [sumber, absensi, kokurikuler, ekskulSemua] = await Promise.all([
    muatSumberSas(ctx.kelas, k.semester, k.tahunAjaran),
    getAbsensiKelas(ctx.kelas, periode),
    getKokurikulerKelas(ctx.kelas, periode),
    getEkskulSiswaKelas(ctx.kelas, periode),
  ])
  return dataSiswaDariSumber(ctx.siswa, ctx, k, sumber, absensi, kokurikuler, ekskulSemua)
}

/**
 * Rapor SAS SELURUH siswa aktif satu kelas. Bahan tiap mapel dimuat sekali, lalu dihitung per siswa.
 */
export async function muatDataRaporSasKelas(ctx: {
  kelas: string
  waliNama: string
  role: string
  semester?: Semester
  tahunAjaran?: string
  kotaRapor?: string
  tanggalRapor?: string
}): Promise<DataRaporSts[]> {
  const k = await konteksData(ctx)
  const periode = { tahunAjaran: k.tahunAjaran, semester: k.semester }
  const [siswaList, sumber, absensi, kokurikuler, ekskulSemua] = await Promise.all([
    getSiswaList(ctx.kelas, { role: ctx.role, kelasAmpu: [] }),
    muatSumberSas(ctx.kelas, k.semester, k.tahunAjaran),
    getAbsensiKelas(ctx.kelas, periode),
    getKokurikulerKelas(ctx.kelas, periode),
    getEkskulSiswaKelas(ctx.kelas, periode),
  ])
  return siswaList.map((s) =>
    dataSiswaDariSumber(
      { id: s.id, nama: s.nama, nisn: s.nisn, nipd: s.nipd },
      ctx,
      k,
      sumber,
      absensi,
      kokurikuler,
      ekskulSemua,
    ),
  )
}
