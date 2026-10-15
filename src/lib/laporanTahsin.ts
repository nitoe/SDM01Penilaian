import { getConfigAkademik } from './akademik'
import { getSetoranKelasPeriode, getSiswaList, getTargetHafalan, type ScopePeriode } from './tahsinData'
import { hitungProgresSurah, iqroTercapai, persenSurah, posisiIqro, surahTercapai, type TargetHafalan } from './target'
import {
  kelompokkanSetoran,
  ringkasKelasTahsin,
  ringkasSetoranSiswa,
  type RingkasKelasTahsin,
  type RingkasSetoranSiswa,
} from './tahsinLaporanRumus'
import type { ConfigAkademik } from '../types/akademik'
import type { SiswaTahsin } from '../types/tahsin'

export interface BarisLaporanTahsin {
  siswa: SiswaTahsin
  ringkas: RingkasSetoranSiswa
  /** Teks capaian: posisi Iqro atau progres surah target; '–' bila belum ada */
  capaian: string
  /** true/false = tercapai/belum terhadap target; null = tidak ada target */
  tercapai: boolean | null
}

export interface LaporanTahsinKelas {
  config: ConfigAkademik
  kelas: string
  periode: ScopePeriode
  target: TargetHafalan | null
  baris: BarisLaporanTahsin[]
  ringkasKelas: RingkasKelasTahsin
}

/**
 * Laporan Tahsin-Tahfizh satu kelas pada satu periode. HANYA MEMBACA: satu query setoran (kelas + periode),
 * lalu dikelompokkan di klien; tidak ada query per siswa.
 */
export async function muatLaporanTahsinKelas(ctx: {
  kelas: string
  periode: ScopePeriode
  role: string
}): Promise<LaporanTahsinKelas> {
  const [config, siswa, setoran, target] = await Promise.all([
    getConfigAkademik(),
    getSiswaList(ctx.kelas, { role: ctx.role, kelasAmpu: [] }),
    getSetoranKelasPeriode(ctx.kelas, ctx.periode),
    getTargetHafalan(ctx.kelas, ctx.periode),
  ])
  const per = kelompokkanSetoran(setoran)
  const ringkasPer: Record<string, RingkasSetoranSiswa> = {}
  const tercapaiPer: Record<string, boolean | null> = {}

  const baris = siswa.map((s): BarisLaporanTahsin => {
    const riwayat = per[s.id] ?? []
    const ringkas = ringkasSetoranSiswa(riwayat)
    ringkasPer[s.id] = ringkas
    let capaian = '–'
    let tercapai: boolean | null = null
    const jenjang = s.jenjang
    if (jenjang === 'iqro') {
      if (riwayat.some((r) => r.materi?.tipe === 'iqro')) {
        const pos = posisiIqro(riwayat)
        capaian = `Iqro ${pos.jilid} hal. ${pos.halaman}`
        if (target?.jenjang === 'iqro' && target.targetJilid) tercapai = iqroTercapai(target, pos)
      } else if (target?.jenjang === 'iqro' && target.targetJilid) {
        tercapai = false
      }
    } else if (target?.jenjang === 'quran' && target.targetSurah?.length) {
      const progres = hitungProgresSurah(target.targetSurah, riwayat)
      const selesai = progres.filter(surahTercapai).length
      const rata = Math.round(progres.reduce((n, p) => n + persenSurah(p), 0) / progres.length)
      capaian = `${selesai}/${progres.length} surah target · ${rata}%`
      tercapai = selesai === progres.length
    }
    tercapaiPer[s.id] = tercapai
    return { siswa: s, ringkas, capaian, tercapai }
  })

  return {
    config,
    kelas: ctx.kelas,
    periode: ctx.periode,
    target,
    baris,
    ringkasKelas: ringkasKelasTahsin(
      siswa.map((s) => s.id),
      ringkasPer,
      tercapaiPer,
    ),
  }
}
