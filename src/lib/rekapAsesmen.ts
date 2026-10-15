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
import { nilaiSasMapel, nilaiStsMapel, susunRekap, type RekapKelas } from './asesmenRumus'
import type { JenisAsesmen, Semester } from '../types/akademik'

/**
 * Rekap nilai STS atau SAS satu kelas untuk semua mapel (cetak admin/wali kelas). HANYA MEMBACA.
 * Tiap mapel: query selalu memuat mapel + kelas (ANTIREGRESI §7.3). Mapel tanpa data tetap menjadi kolom ("–").
 */
export async function muatRekapAsesmenKelas(ctx: {
  kelas: string
  jenis: JenisAsesmen
  semester: Semester
  tahunAjaran: string
  role: string
}): Promise<RekapKelas> {
  const { kelas, jenis, semester, tahunAjaran } = ctx
  const tingkatan = tingkatanDariKelas(kelas)
  const [mapelSemua, seni, siswaRaw] = await Promise.all([
    getMapelList(),
    getSeniKelas(kelas),
    getSiswaList(kelas, { role: ctx.role, kelasAmpu: [] }),
  ])
  const siswa = siswaRaw.map((s) => ({ id: s.id, nama: s.nama }))
  const disiplin = semester === '2' ? seni.genap : seni.ganjil
  const daftarMapel = mapelSemua
    .filter((m) => mapelBerlakuDiTingkatan(m, tingkatan))
    .sort((a, b) => (a.urutan ?? 0) - (b.urutan ?? 0) || a.nama.localeCompare(b.nama, 'id'))

  const nilai: Record<string, Record<string, number | null>> = {}
  for (const s of siswa) nilai[s.id] = {}
  const per = { kelas, semester, tahunAjaran }

  await Promise.all(
    daftarMapel.map(async (m) => {
      const [tpSemuaMapel, cakupan, angka] = await Promise.all([
        getTPList(m.nama, kelas),
        getCakupanTP({ mapel: m.nama, ...per, jenis }),
        getNilaiAsesmenKelas({ jenis, mapel: m.nama, ...per }),
      ])
      const tpSemester = tpSemuaMapel.filter((tp) => tpMasukSemester(tp, semester))
      const ids = new Set(cakupan?.tpIds ?? [])

      if (jenis === 'sts') {
        const tpCakupan = tpSemester.filter((tp) => ids.has(tp.id))
        for (const s of siswa) nilai[s.id][m.nama] = tpCakupan.length ? nilaiStsMapel(tpCakupan, angka, s.id, semester) : null
        return
      }
      const [slm, sts] = await Promise.all([
        getNilaiTPKelas({ mapel: m.nama, ...per }),
        getNilaiAsesmenKelas({ jenis: 'sts', mapel: m.nama, ...per }),
      ])
      for (const s of siswa) {
        nilai[s.id][m.nama] = tpSemester.length
          ? nilaiSasMapel(tpSemester, { slm, sts, sas: angka, cakupanSas: ids }, s.id, semester)
          : null
      }
    }),
  )

  const mapel = daftarMapel.map((m) => ({
    nama: m.nama,
    label: m.nama === 'Seni Budaya' ? labelSeniBudaya(disiplin) : m.nama,
  }))
  return susunRekap(mapel, siswa, nilai)
}
