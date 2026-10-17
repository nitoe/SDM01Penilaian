import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import type { AppUser } from '../../types/user'
import { namaDenganGelar } from '../../types/user'
import type { SiswaTahsin } from '../../types/tahsin'
import { getSiswaList } from '../../lib/tahsinData'
import { kelasSaya } from '../../lib/kelasSaya'
import { isAdminRole } from '../../lib/roles'
import {
  buildBodyPrintSts,
  cetakRaporSts,
  muatDataRaporSts,
  type DataRaporSts,
} from '../../lib/raporSts'
import { PageHeader } from '../../components/ui'
import { BackLink, Notice, Spinner, btnGhost, btnPrimary, inputCls } from './shared'
import { usePeriodeAkademik } from '../../lib/usePeriodeAkademik'

/**
 * Rapor STS — khusus wali kelas.
 * Alur: pilih kelas (hanya kelas yang diwalikan) → pilih siswa → pratinjau + cetak PDF.
 * Pengaturan disiplin Seni Budaya: Setup TP → Seni Budaya → tab Setup.
 */
export default function Rapor({ profile }: { profile: AppUser }) {
  const admin = isAdminRole(profile.role)
  const periodeAk = usePeriodeAkademik()
  const { wali } = kelasSaya(profile)
  const kelasWali = useMemo(() => (admin ? [] : wali), [admin, wali])

  const [kelas, setKelas] = useState(kelasWali[0] || '')
  const [siswaList, setSiswaList] = useState<SiswaTahsin[] | null>(null)
  const [siswaId, setSiswaId] = useState('')
  const [data, setData] = useState<DataRaporSts | null>(null)
  const [loadingSiswa, setLoadingSiswa] = useState(false)
  const [loadingRapor, setLoadingRapor] = useState(false)
  const [galat, setGalat] = useState('')

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
      waliNama: namaDenganGelar(profile),
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
  }, [kelas, siswaId, siswaList, profile, periodeAk.ready, periodeAk.semester, periodeAk.tahunAjaran, periodeAk.periode])

  if (admin) {
    return (
      <div className="space-y-4">
        <BackLink to="/akademik">Akademik & Rapor</BackLink>
        <Notice tone="warn">
          Rapor STS dibuka oleh wali kelas. Akun administrator tidak menjadi wali kelas.
        </Notice>
      </div>
    )
  }

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

  const idxSiswa = siswaList?.findIndex((s) => s.id === siswaId) ?? -1

  return (
    <div className="space-y-5 pb-16">
      <div className="print:hidden">
        <PageHeader
          back={{ to: '/akademik', label: 'Akademik & Rapor' }}
          eyebrow="Akademik"
          title="Rapor STS"
          subtitle={periodeAk.ready ? `Periode ${periodeAk.label} · Pratinjau & cetak rapor STS untuk kelas yang Anda walikan.` : "Pratinjau dan cetak Laporan Hasil Belajar STS. Pilih periode di header atau login ulang."}
        />
      </div>

      <div className="card-soft grid gap-3 p-4 print:hidden sm:grid-cols-2">
        <label className="block">
          <span className="mb-1.5 block text-[12px] font-medium text-slate-700">Kelas</span>
          <select className={inputCls} value={kelas} onChange={(e) => setKelas(e.target.value)}>
            {kelasWali.map((k) => (
              <option key={k} value={k}>
                Kelas {k}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1.5 block text-[12px] font-medium text-slate-700">Siswa</span>
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
                ← Sebelumnya
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
                Berikutnya →
              </button>
            </div>
            <button type="button" className={btnPrimary} onClick={() => cetakRaporSts(data)}>
              Cetak / Simpan PDF
            </button>
          </div>

          <div className="overflow-x-auto print:hidden">
            <div
              className="rapor-preview-frame mx-auto origin-top rounded-lg border border-border bg-white p-6 shadow-sm"
              style={{ maxWidth: 720 }}
              dangerouslySetInnerHTML={{ __html: buildBodyPrintSts(data) }}
            />
          </div>

          <style>{`
            .rapor-preview-frame .rpr-title{text-align:center;font-size:1.15rem;font-weight:700;margin-bottom:2px}
            .rapor-preview-frame .rpr-subtitle{text-align:center;font-size:0.95rem;font-weight:600;margin-bottom:12px;color:#334155}
            .rapor-preview-frame .rpr-info-grid{display:grid;grid-template-columns:1fr 1fr;gap:4px 16px;margin-bottom:12px;font-size:12.5px}
            .rapor-preview-frame .rpr-info-row{display:flex;gap:4px;margin-bottom:2px}
            .rapor-preview-frame .rpr-info-label{min-width:130px;flex-shrink:0;color:#64748b}
            .rapor-preview-frame .rpr-info-val{font-weight:600;color:#0f172a}
            .rapor-preview-frame table{width:100%;border-collapse:collapse;font-size:12px}
            .rapor-preview-frame th,.rapor-preview-frame td{border:1px solid #cbd5e1;padding:6px 8px;vertical-align:top}
            .rapor-preview-frame th{background:#f8fafc;font-size:11px;font-weight:700;text-align:center}
            .rapor-preview-frame .td-no{width:32px;text-align:center}
            .rapor-preview-frame .td-nilai{width:56px;text-align:center;font-weight:700}
            .rapor-preview-frame .td-mapel{font-weight:600}
            .rapor-preview-frame .rpr-ttd-wrap{margin-top:28px}
            .rapor-preview-frame .rpr-ttd-tanda{text-align:right;margin-bottom:10px;font-size:12.5px}
            .rapor-preview-frame .rpr-ttd{display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;text-align:center;font-size:12px}
            .rapor-preview-frame .rpr-ttd-space{height:56px}
            .rapor-preview-frame .rpr-ttd-name{font-weight:700;text-decoration:underline;text-underline-offset:2px}
            .rapor-preview-frame .rpr-ttd-nbm{font-size:11px;margin-top:2px;color:#64748b}
            @media (max-width:640px){
              .rapor-preview-frame .rpr-info-grid{grid-template-columns:1fr}
              .rapor-preview-frame .rpr-ttd{grid-template-columns:1fr}
            }
          `}</style>
        </>
      ) : null}
    </div>
  )
}
