/**
 * Publikasikan rapor STS ke portal orang tua (bukan leger).
 * Wali kelas: kelas wali saja. Admin: semua kelas (hanya pantau + boleh publish).
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { PageHeader, StatStrip, Badge } from '../../components/ui'
import { kelasSaya } from '../../lib/kelasSaya'
import { getSiswaList } from '../../lib/tahsinData'
import { usePeriodeAkademik } from '../../lib/usePeriodeAkademik'
import { isAdminRole } from '../../lib/roles'
import {
  batalkanPublikasiSts,
  getStsPublikasi,
  publikasikanSts,
  ringkasKelengkapanSts,
  type RingkasKelengkapanSts,
  type StsPublikasi,
} from '../../lib/stsPublikasi'
import { SEMUA_KELAS } from '../../types/tahsin'
import type { AppUser } from '../../types/user'
import {
  BackLink,
  Notice,
  Spinner,
  btnGhost,
  btnPrimary,
  btnWarn,
  selectCls,
  useToast,
} from './shared'

const FMT = new Intl.DateTimeFormat('id-ID', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})

export default function PublikasiSts({ profile }: { profile: AppUser }) {
  const admin = isAdminRole(profile.role)
  const periodeAk = usePeriodeAkademik()
  const { wali } = kelasSaya(profile)
  const kelasBoleh = useMemo(
    () => (admin ? [...SEMUA_KELAS] : [...wali]),
    [admin, wali],
  )

  const [kelas, setKelas] = useState(kelasBoleh[0] || '')
  const [pub, setPub] = useState<StsPublikasi | null>(null)
  const [ringkas, setRingkas] = useState<RingkasKelengkapanSts | null>(null)
  const [memuat, setMemuat] = useState(false)
  const [galat, setGalat] = useState('')
  const [konfirmasi, setKonfirmasi] = useState<'publish' | 'revoke' | null>(null)
  const [menyimpan, setMenyimpan] = useState(false)
  const toast = useToast()

  const periode = useMemo(
    () =>
      periodeAk.ready
        ? { tahunAjaran: periodeAk.tahunAjaran, semester: periodeAk.semester as '1' | '2' }
        : null,
    [periodeAk.ready, periodeAk.tahunAjaran, periodeAk.semester],
  )

  // Sesuaikan kelas default jika daftar berubah
  useEffect(() => {
    if (!kelasBoleh.length) {
      setKelas('')
      return
    }
    if (!kelasBoleh.includes(kelas)) setKelas(kelasBoleh[0])
  }, [kelasBoleh, kelas])

  const muat = useCallback(async () => {
    if (!kelas || !periode) return
    setMemuat(true)
    setGalat('')
    try {
      const siswa = await getSiswaList(kelas, { role: profile.role, kelasAmpu: [] })
      const aktif = siswa.filter((s) => s.aktif !== false)
      const [p, r] = await Promise.all([
        getStsPublikasi(kelas, periode.tahunAjaran, periode.semester),
        ringkasKelengkapanSts(kelas, periode.tahunAjaran, periode.semester, aktif.length),
      ])
      setPub(p)
      setRingkas(r)
    } catch (err) {
      console.error(err)
      setGalat(
        'Gagal memuat data. Periksa koneksi, hak akses, dan apakah rules sts_publikasi sudah di-deploy.',
      )
      setPub(null)
      setRingkas(null)
    } finally {
      setMemuat(false)
    }
  }, [kelas, periode, profile.role])

  useEffect(() => {
    void muat()
  }, [muat])

  async function jalankanPublish() {
    if (!periode || !kelas) return
    setMenyimpan(true)
    try {
      const nama = [profile.nama, profile.gelar].filter(Boolean).join(', ')
      await publikasikanSts(kelas, periode.tahunAjaran, periode.semester, nama)
      toast.show(`Rapor STS kelas ${kelas} dipublikasikan ke portal orang tua.`)
      setKonfirmasi(null)
      await muat()
    } catch (err) {
      console.error(err)
      toast.show('Gagal mempublikasikan. Periksa rules dan koneksi.', true)
    } finally {
      setMenyimpan(false)
    }
  }

  async function jalankanRevoke() {
    if (!periode || !kelas) return
    setMenyimpan(true)
    try {
      await batalkanPublikasiSts(kelas, periode.tahunAjaran, periode.semester)
      toast.show(`Publikasi rapor STS kelas ${kelas} dibatalkan.`)
      setKonfirmasi(null)
      await muat()
    } catch (err) {
      console.error(err)
      toast.show('Gagal membatalkan publikasi.', true)
    } finally {
      setMenyimpan(false)
    }
  }

  const sudahPublish = pub?.published === true
  const nMapel = ringkas?.mapel.length ?? 0
  const nSiswa = ringkas?.nSiswa ?? 0
  const lengkapSebagian =
    ringkas &&
    ringkas.mapel.some((m) => nSiswa > 0 && m.nBerNilai < nSiswa)

  if (!kelasBoleh.length) {
    return (
      <div className="space-y-4">
        {toast.node}
        <BackLink to="/akademik">Akademik</BackLink>
        <PageHeader
          title="Publikasikan rapor STS"
          subtitle="Hanya wali kelas (atau admin) yang dapat mempublikasikan rapor ke portal orang tua."
        />
        <Notice tone="warn">
          Akun Anda belum ditetapkan sebagai wali kelas. Hubungi admin untuk penugasan wali kelas.
        </Notice>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {toast.node}
      <BackLink to="/akademik">Akademik</BackLink>
      <PageHeader
        title="Publikasikan rapor STS"
        subtitle="Orang tua melihat lembar rapor STS anak di portal — bukan leger atau tabel rekap guru."
        actions={
          periode ? (
            <span className="rounded-md bg-muh-50 px-2.5 py-1 text-[12px] font-medium text-muh-800">
              Semester {periode.semester} · {periode.tahunAjaran}
            </span>
          ) : null
        }
      />

      <div className="flex flex-wrap items-end gap-3">
        <label className="block min-w-[140px]">
          <span className="mb-1 block text-[12px] font-medium text-muted">Kelas</span>
          <select
            className={selectCls + ' min-w-[120px]'}
            value={kelas}
            onChange={(e) => {
              setKelas(e.target.value)
              setKonfirmasi(null)
            }}
            disabled={memuat}
          >
            {kelasBoleh.map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </select>
        </label>
        <button type="button" className={btnGhost} disabled={memuat || !periode} onClick={() => void muat()}>
          Muat ulang
        </button>
      </div>

      {galat && <Notice tone="error">{galat}</Notice>}

      {memuat && (
        <div className="flex items-center gap-2 text-[13px] text-muted">
          <Spinner /> Memuat status publikasi…
        </div>
      )}

      {!memuat && periode && (
        <>
          <StatStrip
            items={[
              { label: 'Siswa di kelas', value: nSiswa },
              {
                label: 'Mapel ada nilai STS',
                value: nMapel,
                hint: nMapel === 0 ? 'Belum ada isian' : undefined,
              },
              {
                label: 'Status portal',
                value: sudahPublish ? 'Dipublikasikan' : 'Belum',
              },
            ]}
          />

          {lengkapSebagian && (
            <Notice tone="warn">
              Sebagian mapel belum lengkap untuk semua siswa. Ortu hanya melihat mapel yang sudah
              ada nilainya pada rapor STS.
            </Notice>
          )}

          {ringkas && ringkas.mapel.length > 0 && (
            <section className="card-soft overflow-hidden">
              <div className="border-b border-border bg-slate-50/80 px-3.5 py-2.5">
                <h2 className="text-[12px] font-semibold uppercase tracking-wider text-slate-500">
                  Kelengkapan nilai STS
                </h2>
              </div>
              <ul className="divide-y divide-border">
                {ringkas.mapel.map((m) => {
                  const full = nSiswa > 0 && m.nBerNilai >= nSiswa
                  return (
                    <li
                      key={m.nama}
                      className="flex items-center justify-between gap-3 px-3.5 py-2.5 text-[13px]"
                    >
                      <span className="font-medium text-slate-900">{m.nama}</span>
                      <span className="flex items-center gap-2 tabular text-muted">
                        {m.nBerNilai}/{nSiswa || '—'}
                        <Badge tone={full ? 'ok' : 'peach'}>{full ? 'Lengkap' : 'Sebagian'}</Badge>
                      </span>
                    </li>
                  )
                })}
              </ul>
            </section>
          )}

          {ringkas && ringkas.mapel.length === 0 && (
            <Notice tone="warn">
              Belum ada nilai STS tersimpan untuk kelas {kelas} pada periode ini. Isi nilai di menu
              Nilai STS & SAS terlebih dahulu.
            </Notice>
          )}

          <section className="card-soft p-4 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-[14px] font-semibold text-slate-900">Status di portal ortu</h2>
              {sudahPublish ? (
                <Badge tone="ok">Dipublikasikan</Badge>
              ) : (
                <Badge tone="peach">Belum dipublikasikan</Badge>
              )}
            </div>

            {sudahPublish && pub?.publishedAt && (
              <p className="text-[13px] text-muted">
                {FMT.format(pub.publishedAt)}
                {pub.publishedByNama ? ` · oleh ${pub.publishedByNama}` : ''}
              </p>
            )}

            {!sudahPublish && (
              <p className="text-[13px] text-muted">
                Setelah dipublikasikan, orang tua kelas ini dapat membuka{' '}
                <strong className="font-semibold text-slate-800">rapor STS</strong> anak di portal
                (bukan leger kelas).
              </p>
            )}

            {/* Konfirmasi inline */}
            {konfirmasi === 'publish' && (
              <div className="rounded-lg border border-border bg-slate-50 p-3 space-y-2">
                <p className="text-[13px] text-slate-800">
                  Publikasikan <strong>rapor STS</strong> kelas <strong>{kelas}</strong> ke portal
                  orang tua? Ortu hanya melihat rapor anaknya, bukan tabel nilai seluruh kelas.
                </p>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className={btnPrimary}
                    disabled={menyimpan}
                    onClick={() => void jalankanPublish()}
                  >
                    {menyimpan ? 'Menyimpan…' : 'Ya, publikasikan rapor'}
                  </button>
                  <button
                    type="button"
                    className={btnGhost}
                    disabled={menyimpan}
                    onClick={() => setKonfirmasi(null)}
                  >
                    Batal
                  </button>
                </div>
              </div>
            )}

            {konfirmasi === 'revoke' && (
              <div className="rounded-lg border border-border bg-slate-50 p-3 space-y-2">
                <p className="text-[13px] text-slate-800">
                  Batalkan publikasi rapor STS kelas <strong>{kelas}</strong>? Rapor disembunyikan
                  dari portal; data nilai di sistem penilaian tidak dihapus.
                </p>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className={btnWarn}
                    disabled={menyimpan}
                    onClick={() => void jalankanRevoke()}
                  >
                    {menyimpan ? 'Menyimpan…' : 'Ya, batalkan publikasi'}
                  </button>
                  <button
                    type="button"
                    className={btnGhost}
                    disabled={menyimpan}
                    onClick={() => setKonfirmasi(null)}
                  >
                    Batal
                  </button>
                </div>
              </div>
            )}

            {konfirmasi === null && (
              <div className="flex flex-wrap gap-2 pt-1">
                {!sudahPublish ? (
                  <button
                    type="button"
                    className={btnPrimary}
                    disabled={menyimpan || nMapel === 0}
                    onClick={() => setKonfirmasi('publish')}
                  >
                    Publikasikan rapor ke portal
                  </button>
                ) : (
                  <div className="w-full space-y-2">
                    <p className="text-[12px] font-semibold uppercase tracking-wider text-slate-500">
                      Tindakan lain
                    </p>
                    <button
                      type="button"
                      className={btnGhost}
                      disabled={menyimpan}
                      onClick={() => setKonfirmasi('revoke')}
                    >
                      Batalkan publikasi
                    </button>
                  </div>
                )}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  )
}
