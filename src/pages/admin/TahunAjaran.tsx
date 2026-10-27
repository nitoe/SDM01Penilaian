import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { getConfigAkademik, simpanProfilSekolah } from '../../lib/akademik'
import { hapusTtdKepsek, unggahTtdKepsek } from '../../lib/tandaTangan'
import type { Semester } from '../../types/akademik'
import type { AppUser } from '../../types/user'
import { PageHeader } from '../../components/ui'
import { Field, Notice, Spinner, btnPrimary, inputCls } from '../akademik/shared'

/**
 * Data Sekolah — hanya identitas yang dipakai di kop rapor & dokumen.
 * Tahun ajaran, semester, tanggal rapor → Kelola Periode Akademik.
 * Dimensi profil lulusan → ditentukan guru kelas (bukan admin).
 */
export default function TahunAjaran({ profile }: { profile: AppUser }) {
  const [namaSekolah, setNamaSekolah] = useState('SD Muhammadiyah 01 Kukusan')
  const [npsn, setNpsn] = useState('')
  const [alamat, setAlamat] = useState('')
  const [telp, setTelp] = useState('')
  const [kepsek, setKepsek] = useState('')
  const [nbm, setNbm] = useState('')
  /** Disimpan apa adanya agar simpanProfilSekolah tidak mengosongkan field konteks periode. */
  const [legacyTahun, setLegacyTahun] = useState('2026/2027')
  const [legacySemester, setLegacySemester] = useState<Semester>('1')
  const [legacyTglRapor, setLegacyTglRapor] = useState('')
  const [legacyTglRapor15, setLegacyTglRapor15] = useState('')
  const [legacyKota, setLegacyKota] = useState('Depok')
  const [legacyDpl, setLegacyDpl] = useState<string[]>([])

  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [pesan, setPesan] = useState<string | null>(null)
  const [galat, setGalat] = useState<string | null>(null)
  const [ttdKepsekUrl, setTtdKepsekUrl] = useState('')
  const [busyTtd, setBusyTtd] = useState(false)
  const [msgTtd, setMsgTtd] = useState<string | null>(null)
  const inputTtdRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    void getConfigAkademik()
      .then((c) => {
        if (c.namaSekolah) setNamaSekolah(c.namaSekolah)
        if (c.npsn) setNpsn(c.npsn)
        if (c.alamatSekolah) setAlamat(c.alamatSekolah)
        if (c.telpSekolah) setTelp(c.telpSekolah)
        if (c.namaKepsek) setKepsek(c.namaKepsek)
        if (c.nbmKepsek) setNbm(c.nbmKepsek)
        if (typeof c.ttdKepsekUrl === 'string' && c.ttdKepsekUrl) setTtdKepsekUrl(c.ttdKepsekUrl)
        if (c.tahunAjaran) setLegacyTahun(c.tahunAjaran)
        setLegacySemester(c.semesterAktif === '2' ? '2' : '1')
        if (c.tglRapor) setLegacyTglRapor(c.tglRapor)
        if (c.tglRapor1sampai5) setLegacyTglRapor15(c.tglRapor1sampai5)
        if (c.kotaRapor) setLegacyKota(c.kotaRapor)
        if (Array.isArray(c.dplSemesterIni)) setLegacyDpl(c.dplSemesterIni.map(String))
      })
      .catch(() => setGalat('Gagal memuat data sekolah.'))
      .finally(() => setLoading(false))
  }, [])

  if (profile.role !== 'admin') return <Navigate to="/" replace />

  async function simpan(e: FormEvent) {
    e.preventDefault()
    setPesan(null)
    setGalat(null)
    if (!namaSekolah.trim() || !npsn.trim() || !alamat.trim()) {
      setGalat('Nama sekolah, NPSN, dan alamat wajib diisi.')
      return
    }
    if (!kepsek.trim() || !nbm.trim()) {
      setGalat('Nama dan NBM kepala sekolah wajib diisi.')
      return
    }
    setBusy(true)
    try {
      // Hanya tulis identitas. Tahun/semester/tanggal/DPL dipertahankan dari nilai yang ada
      // agar tidak menimpa hasil sinkronisasi dari Periode Akademik.
      await simpanProfilSekolah({
        namaSekolah: namaSekolah.trim(),
        npsn: npsn.trim(),
        alamatSekolah: alamat.trim(),
        telpSekolah: telp.trim(),
        namaKepsek: kepsek.trim(),
        nbmKepsek: nbm.trim(),
        tahunAjaran: legacyTahun,
        semesterAktif: legacySemester,
        tglRapor: legacyTglRapor,
        tglRapor1sampai5: legacyTglRapor15,
        kotaRapor: legacyKota,
        dplSemesterIni: legacyDpl,
      })
      setPesan('Identitas sekolah tersimpan. Tahun ajaran & semester diatur di Periode Akademik.')
    } catch (err) {
      console.error(err)
      setGalat('Gagal menyimpan.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-5 pb-16">
      <PageHeader
        back={{ to: '/admin', label: 'Administrasi' }}
        title="Data Sekolah"
        subtitle="Identitas yang muncul di kop rapor dan dokumen resmi."
      />

      {/* Konteks periode ada di menu lain: cukup satu baris, bukan banner besar */}
      <div className="max-w-3xl">
        <Notice tone="info">
          Periode di sistem saat ini: <strong>{legacyTahun}</strong> · Semester{' '}
          <strong>{legacySemester === '2' ? '2 (genap)' : '1 (ganjil)'}</strong>
          {legacyKota ? (
            <>
              {' '}
              · Kota rapor <strong>{legacyKota}</strong>
            </>
          ) : null}
          . Tahun ajaran, semester, dan tanggal rapor diatur di{' '}
          <Link to="/admin/periode" className="font-semibold text-muh-700 underline">
            Periode Akademik
          </Link>
          .
        </Notice>
      </div>

      {loading ? (
        <Spinner />
      ) : (
        <form onSubmit={(e) => void simpan(e)} className="card-soft max-w-3xl divide-y divide-border overflow-hidden">
          <section className="space-y-4 p-5">
            <div>
              <h2 className="text-[14px] font-semibold text-slate-900">Identitas sekolah</h2>
              <p className="mt-0.5 text-[12px] text-muted">Muncul di kop rapor dan dokumen resmi.</p>
            </div>
            <Field label="Nama sekolah" required>
              <input
                className={inputCls}
                value={namaSekolah}
                onChange={(e) => setNamaSekolah(e.target.value)}
              />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="NPSN" required>
                <input
                  className={inputCls}
                  value={npsn}
                  onChange={(e) => setNpsn(e.target.value)}
                  inputMode="numeric"
                  placeholder="2022xxxx"
                />
              </Field>
              <Field label="Telepon atau email">
                <input className={inputCls} value={telp} onChange={(e) => setTelp(e.target.value)} />
              </Field>
            </div>
            <Field label="Alamat" required>
              <textarea
                className={inputCls}
                rows={2}
                value={alamat}
                onChange={(e) => setAlamat(e.target.value)}
              />
            </Field>
          </section>

          <section className="space-y-4 p-5">
            <div>
              <h2 className="text-[14px] font-semibold text-slate-900">Kepala sekolah</h2>
              <p className="mt-0.5 text-[12px] text-muted">Penandatangan rapor.</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Nama lengkap" required hint="Tulis dengan gelar.">
                <input
                  className={inputCls}
                  value={kepsek}
                  onChange={(e) => setKepsek(e.target.value)}
                />
              </Field>
              <Field label="NBM" required>
                <input
                  className={inputCls}
                  value={nbm}
                  onChange={(e) => setNbm(e.target.value)}
                  inputMode="numeric"
                />
              </Field>
            </div>
            <div className="pt-2">
              <p className="mb-1 text-[12px] font-medium text-slate-700">Tanda tangan digital (Rapor STS)</p>
              <p className="mb-2 text-[11px] text-muted">
                Muncul otomatis di cetak Rapor STS (pelaporan online). PNG/JPG, akan diperkecil.
              </p>
              {ttdKepsekUrl ? (
                <div className="flex flex-wrap items-end gap-3">
                  <img
                    src={ttdKepsekUrl}
                    alt="TTD Kepala Sekolah"
                    className="max-h-16 max-w-[160px] rounded border border-border bg-white object-contain p-1.5"
                  />
                  <button
                    type="button"
                    disabled={busyTtd}
                    className="rounded-lg border border-border bg-white px-3 py-1.5 text-[12px] font-medium hover:bg-slate-50 disabled:opacity-60"
                    onClick={() => inputTtdRef.current?.click()}
                  >
                    Ganti
                  </button>
                  <button
                    type="button"
                    disabled={busyTtd}
                    className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-[12px] font-medium text-red-700 disabled:opacity-60"
                    onClick={() => {
                      void (async () => {
                        setBusyTtd(true)
                        setMsgTtd(null)
                        try {
                          await hapusTtdKepsek()
                          setTtdKepsekUrl('')
                          setMsgTtd('Tanda tangan kepala sekolah dihapus.')
                        } catch (e) {
                          setGalat(e instanceof Error ? e.message : 'Gagal menghapus TTD.')
                        } finally {
                          setBusyTtd(false)
                        }
                      })()
                    }}
                  >
                    Hapus
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  disabled={busyTtd}
                  className="rounded-lg bg-muh-600 px-3 py-1.5 text-[12px] font-semibold text-white hover:bg-muh-700 disabled:opacity-60"
                  onClick={() => inputTtdRef.current?.click()}
                >
                  {busyTtd ? 'Mengunggah…' : 'Unggah tanda tangan'}
                </button>
              )}
              <input
                ref={inputTtdRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/jpg"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (!f) return
                  void (async () => {
                    setBusyTtd(true)
                    setMsgTtd(null)
                    setGalat(null)
                    try {
                      const url = await unggahTtdKepsek(f)
                      setTtdKepsekUrl(url)
                      setMsgTtd('Tanda tangan kepala sekolah tersimpan.')
                    } catch (err) {
                      setGalat(err instanceof Error ? err.message : 'Gagal mengunggah.')
                    } finally {
                      setBusyTtd(false)
                      if (inputTtdRef.current) inputTtdRef.current.value = ''
                    }
                  })()
                }}
              />
              {msgTtd && <p className="mt-2 text-[12px] text-muh-800">{msgTtd}</p>}
            </div>
          </section>

          {(pesan || galat) && (
            <div className="p-4">
              {pesan && <Notice tone="ok">{pesan}</Notice>}
              {galat && <Notice tone="error">{galat}</Notice>}
            </div>
          )}

          <div className="flex items-center justify-between gap-3 bg-slate-50/70 px-5 py-3.5">
            <p className="text-[12px] text-muted">
              Isian bertanda <span className="text-peach-500">*</span> wajib diisi.
            </p>
            <button type="submit" disabled={busy} className={btnPrimary}>
              {busy ? 'Menyimpan…' : 'Simpan data sekolah'}
            </button>
          </div>
        </form>
      )}
    </div>
  )
}
