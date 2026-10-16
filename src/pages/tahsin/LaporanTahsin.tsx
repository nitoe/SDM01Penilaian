import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import type { AppUser } from '../../types/user'
import { isAdminRole } from '../../lib/roles'
import { SEMUA_KELAS } from '../../types/tahsin'
import { usePeriodeAkademik } from '../../lib/usePeriodeAkademik'
import { muatLaporanTahsin, type HasilLaporanTahsin } from '../../lib/laporanTahsin'
import { cariGuruTahsin } from '../../lib/penandatangan'
import { bangunHalamanTahsin, CSS_LAPORAN_TAHSIN } from '../../lib/tahsinLaporanHtml'
import { rentangSemester } from '../../lib/tahsinLaporanRumus'
import { cetakDokumenHtml } from '../../lib/cetakIframe'
import { PageHeader } from '../../components/ui'
import { BackLink, Notice, Spinner, btnPrimary, inputCls, selectCls } from '../akademik/shared'

type Mode = 'siswa' | 'kelas'

function dokumen(isi: string, cetak: boolean): string {
  const dasar = `*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}body{background:#fff}${CSS_LAPORAN_TAHSIN}`
  const gaya = cetak
    ? `@page{size:A4;margin:1.4cm 1.5cm}${dasar}`
    : `${dasar}body{padding:18pt 22pt;max-width:640pt;margin:0 auto}.lpr-page + .lpr-page{margin-top:24pt;padding-top:24pt;border-top:2px dashed #94a3b8;page-break-before:auto;break-before:auto}`
  return `<!DOCTYPE html><html lang="id"><head><meta charset="UTF-8"><title>Laporan Tahsin-Tahfizh</title><style>${gaya}</style></head><body>${isi}</body></html>`
}

/**
 * Laporan perkembangan Tahsin-Tahfizh untuk orang tua (mengikuti cetak-laporan.html di penilaian-v2):
 * membaca, menghapal, target hafalan, menulis, lalu tanda tangan. Satu siswa atau seluruh kelas (satu siswa per halaman).
 * Hanya membaca: admin mencetak, guru Tahsin menyusun datanya lewat Input Setoran.
 */
export default function LaporanTahsin({ profile }: { profile: AppUser }) {
  const [params, setParams] = useSearchParams()
  const admin = isAdminRole(profile.role)
  const kelasBoleh = useMemo<string[]>(
    () => (admin ? [...SEMUA_KELAS] : (profile.kelasAmpu ?? [])),
    [admin, profile.kelasAmpu],
  )
  const kelasParam = params.get('kelas') || ''
  const kelas = kelasBoleh.includes(kelasParam) ? kelasParam : ''
  const periodeAk = usePeriodeAkademik()

  const [mode, setMode] = useState<Mode>('siswa')
  const [siswaId, setSiswaId] = useState('')
  const [dari, setDari] = useState('')
  const [sampai, setSampai] = useState('')
  const [data, setData] = useState<HasilLaporanTahsin | null>(null)
  const [galat, setGalat] = useState('')
  const [tinggi, setTinggi] = useState(900)

  // Rentang bawaan mengikuti semester terpilih; guru/admin boleh mempersempit.
  useEffect(() => {
    if (!periodeAk.ready) return
    const r = rentangSemester(periodeAk.tahunAjaran, periodeAk.semester)
    setDari(r.dari)
    setSampai(r.sampai)
  }, [periodeAk.ready, periodeAk.tahunAjaran, periodeAk.semester])

  useEffect(() => {
    if (!kelas || !periodeAk.ready || !dari || !sampai || dari > sampai) return
    let batal = false
    setData(null)
    setGalat('')
    setSiswaId('')
    void (async () => {
      try {
        const guruNama = await cariGuruTahsin(kelas, profile)
        const d = await muatLaporanTahsin({
          kelas,
          periode: { tahunAjaran: periodeAk.tahunAjaran, semester: periodeAk.semester },
          labelPeriode: periodeAk.label,
          dari,
          sampai,
          role: profile.role,
          guruNama,
        })
        if (!batal) setData(d)
      } catch (e) {
        console.error(e)
        if (!batal) setGalat('Gagal memuat laporan. Periksa koneksi dan hak akses.')
      }
    })()
    return () => {
      batal = true
    }
  }, [kelas, dari, sampai, periodeAk.ready, periodeAk.tahunAjaran, periodeAk.semester, periodeAk.label, profile])

  const tampil = useMemo(() => {
    if (!data) return []
    return mode === 'kelas' ? data.halaman : data.halaman.filter((h) => h.siswaId === siswaId)
  }, [data, mode, siswaId])

  if (kelasBoleh.length === 0) {
    return (
      <div className="space-y-4">
        <BackLink to="/tahsin">Tahsin & Tahfizh</BackLink>
        <Notice>Belum ada kelas ampu pada akun Anda. Hubungi admin untuk mengatur kelas ampu.</Notice>
      </div>
    )
  }

  const isi = tampil.map(bangunHalamanTahsin).join('\n')
  const rentangSalah = Boolean(dari && sampai && dari > sampai)

  return (
    <div className="space-y-5">
      <PageHeader
        back={{ to: '/tahsin', label: admin ? 'Pantauan Tahsin & Tahfizh' : 'Tahsin & Tahfizh' }}
        title="Cetak Laporan Tahsin-Tahfizh"
        subtitle="Laporan perkembangan untuk orang tua: membaca, menghapal, target, dan menulis. Hanya membaca."
      />

      <div className="card-soft grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
        <label className="block">
          <span className="mb-1 block text-[11px] font-medium text-slate-600">Kelas</span>
          <select
            className={selectCls}
            value={kelas}
            onChange={(e) => {
              const p = new URLSearchParams(params)
              e.target.value ? p.set('kelas', e.target.value) : p.delete('kelas')
              setParams(p, { replace: true })
            }}
          >
            <option value="">Pilih kelas</option>
            {kelasBoleh.map((k) => (
              <option key={k} value={k}>
                Kelas {k}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-[11px] font-medium text-slate-600">Cakupan</span>
          <select className={selectCls} value={mode} onChange={(e) => setMode(e.target.value as Mode)}>
            <option value="siswa">Satu siswa</option>
            <option value="kelas">Seluruh kelas</option>
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-[11px] font-medium text-slate-600">Dari tanggal</span>
          <input type="date" className={inputCls} value={dari} onChange={(e) => setDari(e.target.value)} />
        </label>
        <label className="block">
          <span className="mb-1 block text-[11px] font-medium text-slate-600">Sampai tanggal</span>
          <input type="date" className={inputCls} value={sampai} onChange={(e) => setSampai(e.target.value)} />
        </label>
        {mode === 'siswa' && (
          <label className="block sm:col-span-2 lg:col-span-4">
            <span className="mb-1 block text-[11px] font-medium text-slate-600">Siswa</span>
            <select className={selectCls} value={siswaId} disabled={!data} onChange={(e) => setSiswaId(e.target.value)}>
              <option value="">— Pilih siswa —</option>
              {(data?.halaman ?? []).map((h) => (
                <option key={h.siswaId} value={h.siswaId}>
                  {h.siswa.nama}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      {rentangSalah && <Notice tone="warn">Tanggal awal tidak boleh setelah tanggal akhir.</Notice>}
      {!periodeAk.ready && <Notice tone="warn">Pilih periode akademik di header terlebih dahulu.</Notice>}
      {galat && <Notice tone="error">{galat}</Notice>}
      {kelas && periodeAk.ready && !galat && !data && !rentangSalah && <Spinner />}

      {data && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-[12px] text-muted">
              {mode === 'kelas'
                ? `${tampil.length} laporan, satu siswa per halaman.`
                : tampil.length
                  ? 'Pratinjau satu siswa.'
                  : 'Pilih siswa untuk menampilkan laporan.'}{' '}
              Setoran dihitung pada periode {data.labelPeriode} dalam rentang tanggal di atas.
            </p>
            <button
              type="button"
              className={btnPrimary}
              disabled={!tampil.length}
              onClick={() => cetakDokumenHtml(dokumen(isi, true))}
            >
              {mode === 'kelas' ? `Cetak seluruh kelas (${tampil.length})` : 'Cetak / Simpan PDF'}
            </button>
          </div>

          {tampil.length > 0 && (
            <div className="mx-auto max-w-[760px] overflow-hidden rounded-xl border border-border bg-white shadow-sm">
              <iframe
                title="Pratinjau laporan Tahsin-Tahfizh"
                sandbox="allow-same-origin"
                srcDoc={dokumen(isi, false)}
                className="block w-full"
                style={{ height: tinggi }}
                onLoad={(e) => {
                  const h = e.currentTarget.contentDocument?.body?.scrollHeight
                  if (h) setTinggi(Math.min(h + 24, 30000))
                }}
              />
            </div>
          )}
        </>
      )}
    </div>
  )
}
