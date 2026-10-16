import { getConfigAkademik } from './akademik'
import { getMenulisKelas, getSetoranKelasPeriode, getSiswaList, getTargetHafalan, type ScopePeriode } from './tahsinData'
import { hitungProgresSurah, iqroTercapai, persenSurah, posisiIqro, surahTercapai } from './target'
import { surahByNo } from './quranSurah'
import { dalamRentang, kelompokkanMenulis, kelompokkanSetoran, susunLaporanSiswa } from './tahsinLaporanRumus'
import type { BagianTarget, HalamanTahsin } from './tahsinLaporanHtml'
import { tanggalIndonesia } from './raporSts'
import type { TargetHafalan } from './target'
import type { SetoranRecord, SiswaTahsin } from '../types/tahsin'

/** Bagian "Target Hafalan" satu siswa dari setoran periode ini (pola v2: Iqro = jilid+halaman, Al-Qur'an = surah). */
function bagianTarget(siswa: SiswaTahsin, target: TargetHafalan | null, riwayat: SetoranRecord[]): BagianTarget | null {
  if (!target) return null
  if (siswa.jenjang === 'iqro' && target.jenjang === 'iqro' && target.targetJilid) {
    const pos = posisiIqro(riwayat)
    const tercapai = iqroTercapai(target, pos)
    const nama = siswa.nama.trim().split(/\s+/)[0]
    return {
      judul: target.labelSemester ?? '',
      stat: [
        { n: `Iqro ${target.targetJilid}:${target.targetHalaman ?? '-'}`, l: 'Target' },
        { n: `Iqro ${pos.jilid}:${pos.halaman || '-'}`, l: 'Posisi Saat Ini' },
      ],
      hasil: {
        tercapai,
        teks: tercapai
          ? `Target tercapai — ${nama} sudah mencapai atau melampaui target semester ini.`
          : `Target belum tercapai — ${nama} masih dalam proses menuju target semester ini.`,
      },
    }
  }
  if (siswa.jenjang !== 'iqro' && target.jenjang === 'quran' && target.targetSurah?.length) {
    const progres = hitungProgresSurah(target.targetSurah, riwayat)
    return {
      judul: target.labelSemester ?? '',
      stat: [{ n: `${progres.filter(surahTercapai).length}/${progres.length}`, l: 'Surah Tercapai' }],
      surah: progres.map((p) => ({ nama: surahByNo(p.surahNo)?.nama ?? `Surah ${p.surahNo}`, persen: persenSurah(p) })),
    }
  }
  return null
}

export interface HasilLaporanTahsin {
  halaman: (HalamanTahsin & { siswaId: string })[]
  labelPeriode: string
}

/**
 * Laporan Tahsin-Tahfizh seluruh siswa aktif satu kelas. HANYA MEMBACA: satu query setoran (kelas + periode)
 * dan satu query catatan menulis (kelas), lalu dikelompokkan di klien — bukan query per siswa (ANTIREGRESI §22).
 * `dari`/`sampai` (ISO) menyaring isi laporan dalam periode; target dihitung dari seluruh setoran periode.
 */
export async function muatLaporanTahsin(ctx: {
  kelas: string
  periode: ScopePeriode
  labelPeriode: string
  dari: string
  sampai: string
  role: string
  guruNama: string
}): Promise<HasilLaporanTahsin> {
  const [config, siswaList, setoran, menulis, target] = await Promise.all([
    getConfigAkademik(),
    getSiswaList(ctx.kelas, { role: ctx.role, kelasAmpu: [] }),
    getSetoranKelasPeriode(ctx.kelas, ctx.periode),
    getMenulisKelas(ctx.kelas),
    getTargetHafalan(ctx.kelas, ctx.periode),
  ])
  const perSiswa = kelompokkanSetoran(setoran)
  const menulisPerSiswa = kelompokkanMenulis(menulis)
  const tanggalCetak = tanggalIndonesia()
  const rentang = `${tanggalIndonesia(new Date(`${ctx.dari}T00:00:00`))} – ${tanggalIndonesia(new Date(`${ctx.sampai}T00:00:00`))}`

  const halaman = siswaList.map((s) => {
    const penuh = perSiswa[s.id] ?? []
    const dalam = penuh.filter((r) => dalamRentang(r.createdAt, ctx.dari, ctx.sampai))
    const tulis = (menulisPerSiswa[s.id] ?? []).filter((m) =>
      dalamRentang((m.tanggalPeriksa as string | undefined) || (m.createdAt as SetoranRecord['createdAt']), ctx.dari, ctx.sampai),
    )
    return {
      siswaId: s.id,
      sekolah: config.namaSekolah?.trim() || 'SD Muhammadiyah 01 Kukusan',
      labelPeriode: ctx.labelPeriode,
      rentang,
      siswa: { nama: s.nama, nomor: s.nisn || s.nis || s.nipd || '', kelas: s.kelas, jenjang: s.jenjang },
      guruNama: ctx.guruNama,
      laporan: susunLaporanSiswa(s, dalam, tulis),
      target: bagianTarget(s, target, penuh),
      kota: config.kotaRapor?.trim() || 'Depok',
      tanggal: tanggalCetak,
      namaKepsek: config.namaKepsek || '',
      nbmKepsek: config.nbmKepsek,
    }
  })
  return { halaman, labelPeriode: ctx.labelPeriode }
}
