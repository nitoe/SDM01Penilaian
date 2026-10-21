import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import type { AppUser } from '../../types/user'
import { namaDenganGelar } from '../../types/user'
import { SEMUA_KELAS, type SiswaTahsin } from '../../types/tahsin'
import { getSiswaList } from '../../lib/tahsinData'
import { kelasSaya } from '../../lib/kelasSaya'
import { isAdminRole } from '../../lib/roles'
import {
  cetakRapor,
  cetakRaporBanyak,
  dokumenPratinjauRapor,
  muatDataRaporSts,
  muatDataRaporStsKelas,
  type DataRaporSts,
  type JenisRapor,
} from '../../lib/raporSts'
import { muatDataRaporSasKelas } from '../../lib/raporSas'
import { cariWaliKelas } from '../../lib/penandatangan'
import { PageHeader } from '../../components/ui'
import { BackLink, Notice, Spinner, btnGhost, btnPrimary, inputCls } from './shared'
import { usePeriodeAkademik } from '../../lib/usePeriodeAkademik'

/**
 * Rapor STS ("rapor bayangan" untuk orang tua, hanya dari hasil STS) dan Rapor SAS (rapor akhir lengkap:
 * nilai, kokurikuler, ekstrakurikuler, ketidakhadiran, catatan wali, keputusan) — satu halaman, dua mode.
 * Wali kelas: kelas yang diwalikan. Admin: semua kelas (hanya mencetak, tidak mengubah nilai).
 * Alur: pilih jenis (STS/SAS) → pilih kelas → pilih siswa → pratinjau + cetak PDF, atau cetak seluruh kelas.
 *
 * Prop `jenis` dari rute lama (/rapor-sas) tetap dihormati; tanpa prop, toggle di UI + query ?jenis=.
 */
export default function Rapor({ profile, jenis: jenisProp }: { profile: AppUser; jenis?: JenisRapor }) {
  const [params, setParams] = useSearchParams()
  const jenisDariQuery = params.get('jenis') === 'sas' ? 'sas' : params.get('jenis') === 'sts' ? 'sts' : null
  const jenis: JenisRapor = jenisProp ?? jenisDariQuery ?? 'sts'
  const sas = jenis === 'sas'
  const NAMA = sas ? 'Rapor SAS' : 'Rapor STS'
  const admin = isAdminRole(profile.role)
  const periodeAk = usePeriodeAkademik()
  const { wali } = kelasSaya(profile)
  const kelasWali = useMemo<string[]>(() => (admin ? [...SEMUA_KELAS] : wali), [admin, wali])

  const [kelas, setKelas] = useState(kelasWali[0] || '')
  const [siswaList, setSiswaList] = useState<SiswaTahsin[] | null>(null)
  const [siswaId, setSiswaId] = useState('')
  const [data, setData] = useState<DataRaporSts | null>(null)
  /** Rapor SAS: seluruh siswa satu kelas dimuat sekali; pratinjau tinggal memilih siswa. */
  const [kelasData, setKelasData] = useState<DataRaporSts[] | null>(null)
  const [loadingSiswa, setLoadingSiswa] = useState(false)
  const [loadingRapor, setLoadingRapor] = useState(false)
  const [galat, setGalat] = useState('')
  const [waliNama, setWaliNama] = useState(namaDenganGelar(profile))
  const [cetakKelas, setCetakKelas] = useState(false)
  const [tinggiPratinjau, setTinggiPratinjau] = useState(900)

  function gantiJenis(next: JenisRapor) {
    // Jangan ubah path jika dipaksa lewat prop rute lama (/rapor-sas)
    if (jenisProp) return
    const q = new URLSearchParams(params)
    q.set('jenis', next)
    setParams(q, { replace: true })
    setSiswaId('')
    setData(null)
    setKelasData(null)
  }

  /**
   * STS: tanggal penyerahan rapor STS (Admin → Periode Akademik), BUKAN tanggal rapor akhir semester.
   * SAS: tanggal rapor akhir (semester 1 semua kelas; semester 2 kelas 1–5 dan kelas 6 berbeda).
   * Kosong → rapor memakai tanggal hari ini.
   */
  function tanggalDariPeriode(): string | undefined {
    const p = periodeAk.periode
    if (!p) return undefined
    if (!sas) return p.tglRaporSts?.trim() || undefined
    if (p.semester === '1') return p.tglRaporKelas1sampai6Sem1?.trim() || undefined
    const isKelas6 = /^6/i.test(kelas)
    return (isKelas6 ? p.tglRaporKelas6Sem2 : p.tglRaporKelas1sampai5Sem2)?.trim() || undefined
  }

  useEffect(() => {
    if (!kelas && kelasWali.length) setKelas(kelasWali[0])
  }, [kelas, kelasWali])

  // Nama wali kelas untuk tanda tangan: wali = dirinya; admin = wali kelas terdaftar untuk kelas itu.
  useEffect(() => {
    if (!admin) {
      setWaliNama(namaDenganGelar(profile))
      return
    }
    if (!kelas) return
    let batal = false
    void cariWaliKelas(kelas, profile).then((n) => !batal && setWaliNama(n))
    return () => {
      batal = true
    }
  }, [admin, kelas, profile])

  useEffect(() => {
    if (!kelas) {
      setSiswaList(null)
      setSiswaId('')
      setData(null)
      return
    }
    let batal = false
    setLoadingSiswa(true)
    setSiswaId('')
    setData(null)
    setGalat('')
    void (async () => {
      try {
        const list = await getSiswaList(kelas, { role: profile.role, kelasAmpu: [] })
        if (batal) return
        setSiswaList(list)
      } catch (e) {
        console.error(e)
        if (!batal) {
          setGalat('Gagal memuat daftar siswa. Periksa koneksi dan hak akses.')
          setSiswaList([])
        }
      } finally {
        if (!batal) setLoadingSiswa(false)
      }
    })()
    return () => {
      batal = true
    }
  }, [kelas, profile.role])

  // Rapor SAS: muat seluruh kelas sekali (nilai + absensi + kokurikuler + ekskul), bukan per siswa.
  useEffect(() => {
    if (!sas) return
    if (!kelas || !periodeAk.ready || !siswaList) {
      setKelasData(null)
      return
    }
    let batal = false
    setLoadingRapor(true)
    setKelasData(null)
    setGalat('')
    void muatDataRaporSasKelas({
      kelas,
      waliNama,
      role: profile.role,
      semester: periodeAk.semester,
      tahunAjaran: periodeAk.tahunAjaran,
      kotaRapor: periodeAk.periode?.kotaRapor,
      tanggalRapor: tanggalDariPeriode(),
    })
      .then((d) => !batal && setKelasData(d))
      .catch((e) => {
        console.error(e)
        if (!batal) setGalat('Gagal memuat data rapor SAS. Periksa koneksi, hak akses, dan rules terbaru.')
      })
      .finally(() => !batal && setLoadingRapor(false))
    return () => {
      batal = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sas, kelas, siswaList, waliNama, profile.role, periodeAk.ready, periodeAk.semester, periodeAk.tahunAjaran, periodeAk.periode])

  useEffect(() => {
    if (sas) {
      setData(siswaId ? (kelasData?.find((d) => d.siswa.id === siswaId) ?? null) : null)
      return
    }
    if (!kelas || !siswaId || !siswaList) {
      setData(null)
      return
    }
    const siswa = siswaList.find((s) => s.id === siswaId)
    if (!siswa) {
      setData(null)
      return
    }
    let batal = false
    setLoadingRapor(true)
    setGalat('')
    if (!periodeAk.ready) {
      setGalat('Periode akademik belum dipilih. Login ulang atau pilih periode di header.')
      setLoadingRapor(false)
      return
    }
    void muatDataRaporSts({
      siswa: { id: siswa.id, nama: siswa.nama, nisn: siswa.nisn, nipd: siswa.nipd },
      kelas,
      waliNama,
      semester: periodeAk.semester,
      tahunAjaran: periodeAk.tahunAjaran,
      kotaRapor: periodeAk.periode?.kotaRapor,
      tanggalRapor: tanggalDariPeriode(),
    })
      .then((d) => {
        if (!batal) setData(d)
      })
      .catch((e) => {
        console.error(e)
        if (!batal) setGalat('Gagal memuat data rapor. Coba muat ulang.')
      })
      .finally(() => {
        if (!batal) setLoadingRapor(false)
      })
    return () => {
      batal = true
    }
  }, [sas, kelasData, kelas, siswaId, siswaList, profile, waliNama, periodeAk.ready, periodeAk.semester, periodeAk.tahunAjaran, periodeAk.periode])

  if (!periodeAk.loading && !periodeAk.ready) {
    return (
      <div className="space-y-4">
        <BackLink to="/akademik">Akademik & Rapor</BackLink>
        <Notice tone="warn">
          Belum ada periode akademik yang dipilih. Minta admin membuat periode di Administrasi →
          Periode Akademik, lalu login ulang atau pilih periode di header.
        </Notice>
      </div>
    )
  }

  if (!kelasWali.length) {
    return (
      <div className="space-y-4">
        <BackLink to="/akademik">Akademik & Rapor</BackLink>
        <Notice tone="warn">
          Anda bukan wali kelas manapun saat ini. Hubungi admin agar kelas wali ditetapkan di Kelola
          Akun.
        </Notice>
      </div>
    )
  }

  async function cetakSeluruhKelas() {
    if (!kelas || !periodeAk.ready) return
    setCetakKelas(true)
    setGalat('')
    try {
      const semua =
        sas && kelasData
          ? kelasData
          : await (sas ? muatDataRaporSasKelas : muatDataRaporStsKelas)({
              kelas,
              waliNama,
              role: profile.role,
              semester: periodeAk.semester,
              tahunAjaran: periodeAk.tahunAjaran,
              kotaRapor: periodeAk.periode?.kotaRapor,
              tanggalRapor: tanggalDariPeriode(),
            })
      if (!semua.length) setGalat(`Tidak ada siswa aktif di kelas ${kelas}.`)
      else cetakRaporBanyak(semua, jenis)
    } catch (e) {
      console.error(e)
      setGalat('Gagal menyiapkan rapor satu kelas. Periksa koneksi dan hak akses.')
    } finally {
      setCetakKelas(false)
    }
  }

  const idxSiswa = siswaList?.findIndex((s) => s.id === siswaId) ?? -1

  return (
    <div className="space-y-5 pb-16">
      <div className="print:hidden">
        <PageHeader
          back={{ to: '/akademik', label: admin ? 'Pantauan Akademik' : 'Akademik & Rapor' }}
          eyebrow="Akademik"
          title={admin ? `Cetak ${NAMA}` : NAMA}
          subtitle={
            periodeAk.ready
              ? `Periode ${periodeAk.label} · ${admin ? `Pratinjau dan cetak ${NAMA} semua kelas. Admin hanya mencetak; data diisi guru.` : `Pratinjau dan cetak ${NAMA} untuk kelas yang Anda walikan.`}`
              : `Pratinjau dan cetak Laporan Hasil Belajar ${sas ? 'SAS' : 'STS'}. Pilih periode di header atau login ulang.`
          }
        />
      </div>

      {/* Toggle STS / SAS — disembunyikan jika rute lama memaksa jenis (mis. /rapor-sas) */}
      {!jenisProp && (
        <div className="grid grid-cols-2 gap-2 sm:max-w-md print:hidden">
          {(
            [
              { j: 'sts' as JenisRapor, judul: 'STS', sub: 'Ujian tengah semester' },
              { j: 'sas' as JenisRapor, judul: 'SAS', sub: 'Ujian akhir semester' },
            ] as const
          ).map(({ j, judul, sub }) => (
            <button
              key={j}
              type="button"
              onClick={() => gantiJenis(j)}
              className={`rounded-lg border-2 px-3 py-3 text-left transition ${
                jenis === j ? 'border-muh-600 bg-muh-50' : 'border-border bg-white hover:border-muh-300'
              }`}
            >
              <p className={`text-[14px] font-bold ${jenis === j ? 'text-muh-800' : 'text-slate-800'}`}>{judul}</p>
              <p className="mt-0.5 text-[11px] text-muted">{sub}</p>
            </button>
          ))}
        </div>
      )}

      <div className="card-soft grid gap-3 p-4 print:hidden sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-[11px] font-medium text-slate-600">Kelas</span>
          <select className={inputCls} value={kelas} onChange={(e) => setKelas(e.target.value)}>
            {kelasWali.map((k) => (
              <option key={k} value={k}>
                Kelas {k}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-[11px] font-medium text-slate-600">Siswa</span>
          <select
            className={inputCls}
            value={siswaId}
            disabled={!siswaList || loadingSiswa}
            onChange={(e) => setSiswaId(e.target.value)}
          >
            <option value="">— Pilih siswa —</option>
            {(siswaList ?? []).map((s) => (
              <option key={s.id} value={s.id}>
                {s.nama}
              </option>
            ))}
          </select>
        </label>
      </div>

      {kelas && sas && (
        <p className="text-[11.5px] text-muted print:hidden">
          Data pelengkap (absensi, kokurikuler, ekskul) diisi di{' '}
          <Link to="/akademik/kelengkapan-rapor" className="font-medium text-muh-700 underline">
            Kelengkapan Rapor SAS
          </Link>
          .
        </p>
      )}

      {galat && (
        <div className="print:hidden">
          <Notice tone="error">{galat}</Notice>
        </div>
      )}

      {loadingSiswa || loadingRapor ? (
        <div className="print:hidden">
          <Spinner />
        </div>
      ) : !siswaId ? (
        <div className="card-soft p-8 text-center print:hidden">
          <p className="text-[13px] text-muted">Pilih siswa untuk menampilkan pratinjau {NAMA}.</p>
        </div>
      ) : data ? (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2 print:hidden">
            <div className="flex gap-2">
              <button
                type="button"
                className={btnGhost}
                disabled={idxSiswa <= 0}
                onClick={() => {
                  if (siswaList && idxSiswa > 0) setSiswaId(siswaList[idxSiswa - 1].id)
                }}
              >
                ◀ Sebelumnya
              </button>
              <button
                type="button"
                className={btnGhost}
                disabled={!siswaList || idxSiswa < 0 || idxSiswa >= siswaList.length - 1}
                onClick={() => {
                  if (siswaList && idxSiswa >= 0 && idxSiswa < siswaList.length - 1) {
                    setSiswaId(siswaList[idxSiswa + 1].id)
                  }
                }}
              >
                Berikutnya ▶
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" className={btnGhost} disabled={cetakKelas} onClick={cetakSeluruhKelas}>
                {cetakKelas ? 'Menyiapkan…' : `Cetak seluruh kelas (${siswaList?.length ?? 0})`}
              </button>
              <button type="button" className={btnPrimary} onClick={() => cetakRapor(data, jenis)}>
                Cetak / Simpan PDF
              </button>
            </div>
          </div>

          <div className="mx-auto max-w-[760px] overflow-hidden rounded-xl border border-border bg-white shadow-sm print:hidden">
            <iframe
              title={`Pratinjau ${NAMA}`}
              sandbox="allow-same-origin"
              srcDoc={dokumenPratinjauRapor([data], jenis)}
              className="block w-full"
              style={{ height: tinggiPratinjau }}
              onLoad={(e) => {
                const h = e.currentTarget.contentDocument?.body?.scrollHeight
                if (h) setTinggiPratinjau(h + 24)
              }}
            />
          </div>
        </>
      ) : null}
    </div>
  )
}
