import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import type { AppUser } from '../../types/user'
import { namaDenganGelar } from '../../types/user'
import type { SiswaTahsin } from '../../types/tahsin'
import { getSiswaList } from '../../lib/tahsinData'
import { kelasSaya } from '../../lib/kelasSaya'
import { isAdminRole } from '../../lib/roles'
import {
  cetakRaporSts,
  cetakRaporStsBanyak,
  dokumenPratinjauSts,
  muatDataRaporSts,
  muatDataRaporStsKelas,
  type DataRaporSts,
} from '../../lib/raporSts'
import { cariWaliKelas } from '../../lib/penandatangan'
import { SEMUA_KELAS } from '../../types/tahsin'
import { PageHeader } from '../../components/ui'
import { BackLink, Notice, Spinner, btnGhost, btnPrimary, inputCls } from './shared'
import { usePeriodeAkademik } from '../../lib/usePeriodeAkademik'

/**
 * Rapor STS ("rapor bayangan" untuk orang tua, hanya dari hasil STS).
 * Wali kelas: kelas yang diwalikan. Admin: semua kelas (hanya mencetak, tidak mengubah nilai).
 * Alur: pilih kelas → pilih siswa → pratinjau + cetak PDF, atau cetak seluruh kelas.
 * Pengaturan disiplin Seni Budaya: Setup TP → Seni Budaya → tab Setup.
 */
export default function Rapor({ profile }: { profile: AppUser }) {
  const admin = isAdminRole(profile.role)
  const periodeAk = usePeriodeAkademik()
  const { wali } = kelasSaya(profile)
  const kelasWali = useMemo<string[]>(() => (admin ? [...SEMUA_KELAS] : wali), [admin, wali])

  const [kelas, setKelas] = useState(kelasWali[0] || '')
  const [siswaList, setSiswaList] = useState<SiswaTahsin[] | null>(null)
  const [siswaId, setSiswaId] = useState('')
  const [data, setData] = useState<DataRaporSts | null>(null)
  const [loadingSiswa, setLoadingSiswa] = useState(false)
  const [loadingRapor, setLoadingRapor] = useState(false)
  const [galat, setGalat] = useState('')
  const [waliNama, setWaliNama] = useState(namaDenganGelar(profile))
  const [cetakKelas, setCetakKelas] = useState(false)
  const [tinggiPratinjau, setTinggiPratinjau] = useState(900)

  /** Tanggal rapor dari metadata periode (kelas 6 sem 2 beda). */
  function tanggalDariPeriode(): string | undefined {
    const p = periodeAk.periode
    if (!p) return undefined
    if (p.semester === '1') return p.tglRaporKelas1sampai6Sem1
    const isKelas6 = /^6/i.test(kelas)
    return isKelas6 ? p.tglRaporKelas6Sem2 : p.tglRaporKelas1sampai5Sem2
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

  useEffect(() => {
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
  }, [kelas, siswaId, siswaList, profile, waliNama, periodeAk.ready, periodeAk.semester, periodeAk.tahunAjaran, periodeAk.periode])

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
      const semua = await muatDataRaporStsKelas({
        kelas,
        waliNama,
        role: profile.role,
        semester: periodeAk.semester,
        tahunAjaran: periodeAk.tahunAjaran,
        kotaRapor: periodeAk.periode?.kotaRapor,
        tanggalRapor: tanggalDariPeriode(),
      })
      if (!semua.length) setGalat(`Tidak ada siswa aktif di kelas ${kelas}.`)
      else cetakRaporStsBanyak(semua)
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
          title={admin ? 'Cetak Rapor STS' : 'Rapor STS'}
          subtitle={
            periodeAk.ready
              ? `Periode ${periodeAk.label} · ${admin ? 'Pratinjau dan cetak rapor STS semua kelas. Admin hanya mencetak; nilai diinput guru.' : 'Pratinjau dan cetak rapor STS untuk kelas yang Anda walikan.'}`
              : 'Pratinjau dan cetak Laporan Hasil Belajar STS. Pilih periode di header atau login ulang.'
          }
        />
      </div>

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

      {kelas && (
        <p className="text-[11.5px] text-muted print:hidden">
          Pengaturan disiplin Seni Budaya ada di{' '}
          <Link
            to={`/akademik/setup-tp?mapel=${encodeURIComponent('Seni Budaya')}&kelas=${encodeURIComponent(kelas)}`}
            className="font-medium text-muh-700 underline"
          >
            Setup TP → Seni Budaya
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
          <p className="text-[13px] text-muted">Pilih siswa untuk menampilkan pratinjau rapor STS.</p>
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
              <button type="button" className={btnPrimary} onClick={() => cetakRaporSts(data)}>
                Cetak / Simpan PDF
              </button>
            </div>
          </div>

          <div className="mx-auto max-w-[760px] overflow-hidden rounded-xl border border-border bg-white shadow-sm print:hidden">
            <iframe
              title="Pratinjau rapor STS"
              sandbox="allow-same-origin"
              srcDoc={dokumenPratinjauSts([data])}
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
