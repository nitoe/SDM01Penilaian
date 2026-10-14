import { useEffect, useState, type FormEvent } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { getConfigAkademik, simpanProfilSekolah } from '../../lib/akademik'
import type { AppUser } from '../../types/user'
import Icon from '../../components/Icon'

const field =
  'w-full rounded-xl border border-border bg-white px-3.5 py-2.5 text-[13.5px] outline-none transition focus:border-muh-500 focus:ring-2 focus:ring-muh-500/15'

function Section({
  icon,
  title,
  desc,
  children,
}: {
  icon: 'book' | 'users'
  title: string
  desc?: string
  children: React.ReactNode
}) {
  return (
    <section className="card-soft overflow-hidden">
      <div className="flex items-start gap-3 border-b border-border bg-slate-50/80 px-4 py-3.5">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muh-600 text-white">
          <Icon name={icon} />
        </span>
        <div className="min-w-0">
          <h2 className="text-[14.5px] font-semibold text-slate-900">{title}</h2>
          {desc && <p className="mt-0.5 text-[12px] leading-snug text-muted">{desc}</p>}
        </div>
      </div>
      <div className="space-y-3.5 p-4">{children}</div>
    </section>
  )
}

function Label({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <span className="mb-1.5 block text-[12px] font-medium text-slate-600">
      {children}
      {required && <span className="ml-0.5 text-peach-500">*</span>}
    </span>
  )
}

export default function TahunAjaran({ profile }: { profile: AppUser }) {
  const [namaSekolah, setNamaSekolah] = useState('SD Muhammadiyah 01 Kukusan')
  const [npsn, setNpsn] = useState('')
  const [alamat, setAlamat] = useState('')
  const [telp, setTelp] = useState('')
  const [kepsek, setKepsek] = useState('')
  const [nbm, setNbm] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [pesan, setPesan] = useState<string | null>(null)
  const [galat, setGalat] = useState<string | null>(null)

  useEffect(() => {
    void getConfigAkademik()
      .then((c) => {
        if (c.namaSekolah) setNamaSekolah(c.namaSekolah)
        if (c.npsn) setNpsn(c.npsn)
        if (c.alamatSekolah) setAlamat(c.alamatSekolah)
        if (c.telpSekolah) setTelp(c.telpSekolah)
        if (c.namaKepsek) setKepsek(c.namaKepsek)
        if (c.nbmKepsek) setNbm(c.nbmKepsek)
      })
      .catch(() => setGalat('Gagal memuat data sekolah.'))
      .finally(() => setLoading(false))
  }, [])

  if (profile.role !== 'admin') return <Navigate to="/" replace />

  async function simpan(e: FormEvent) {
    e.preventDefault()
    if (!namaSekolah.trim() || !npsn.trim() || !alamat.trim()) {
      setGalat('Nama sekolah, NPSN, dan alamat wajib diisi.')
      return
    }
    if (!kepsek.trim() || !nbm.trim()) {
      setGalat('Nama dan NBM kepala sekolah wajib diisi.')
      return
    }
    setBusy(true)
    setPesan(null)
    setGalat(null)
    try {
      // Simpan hanya profil sekolah. Tahun/semester/DPL/tanggal rapor sudah dipindah ke periode.
      await simpanProfilSekolah({
        namaSekolah,
        npsn,
        alamatSekolah: alamat,
        telpSekolah: telp,
        namaKepsek: kepsek,
        nbmKepsek: nbm,
        // Field lama dikirim kosong / default agar tidak merusak dokumen existing
        tahunAjaran: '',
        semesterAktif: '1',
        tglRapor: '',
        tglRapor1sampai5: '',
        kotaRapor: '',
        dplSemesterIni: [],
      })
      setPesan('Data sekolah tersimpan.')
    } catch (err) {
      console.error(err)
      setGalat('Gagal menyimpan.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5 pb-24">
      <div>
        <Link to="/admin" className="text-[11px] font-medium text-muh-700 hover:underline">
          ← Administrasi
        </Link>
        <h1 className="mt-0.5 text-lg font-semibold tracking-tight text-slate-900">Data Sekolah</h1>
        <p className="mt-1 text-[12.5px] leading-relaxed text-muted">
          Identitas yang muncul di kop rapor dan dokumen resmi. Tahun ajaran & semester dikelola di
          halaman Periode Akademik.
        </p>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <div key={i} className="card-soft h-36 animate-pulse bg-slate-50" />
          ))}
        </div>
      ) : (
        <form onSubmit={(e) => void simpan(e)} className="space-y-4">
          <Section icon="book" title="Identitas sekolah" desc="Muncul di kop rapor dan dokumen resmi.">
            <label className="block">
              <Label required>Nama sekolah</Label>
              <input className={field} value={namaSekolah} onChange={(e) => setNamaSekolah(e.target.value)} />
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <Label required>NPSN</Label>
                <input
                  className={field}
                  value={npsn}
                  onChange={(e) => setNpsn(e.target.value)}
                  inputMode="numeric"
                  placeholder="2022xxxx"
                />
              </label>
              <label className="block">
                <Label>Telepon atau email</Label>
                <input className={field} value={telp} onChange={(e) => setTelp(e.target.value)} />
              </label>
            </div>
            <label className="block">
              <Label required>Alamat</Label>
              <textarea className={field} rows={2} value={alamat} onChange={(e) => setAlamat(e.target.value)} />
            </label>
          </Section>

          <Section icon="users" title="Kepala sekolah" desc="Penandatangan rapor.">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <Label required>Nama</Label>
                <input className={field} value={kepsek} onChange={(e) => setKepsek(e.target.value)} />
              </label>
              <label className="block">
                <Label required>NBM</Label>
                <input className={field} value={nbm} onChange={(e) => setNbm(e.target.value)} />
              </label>
            </div>
          </Section>

          {pesan && (
            <div className="rounded-xl border border-muh-200 bg-muh-50 px-3.5 py-2.5 text-[12.5px] text-muh-900">
              {pesan}
            </div>
          )}
          {galat && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-[12.5px] text-red-800">
              {galat}
            </div>
          )}

          <div className="fixed bottom-0 left-0 right-0 z-20 border-t border-border bg-white/95 px-4 py-3 backdrop-blur sm:static sm:border-0 sm:bg-transparent sm:p-0 sm:backdrop-blur-none">
            <div className="mx-auto flex max-w-2xl items-center justify-between gap-3">
              <p className="hidden text-[11.5px] text-muted sm:block">
                Field bertanda <span className="text-peach-500">*</span> wajib diisi
              </p>
              <button
                type="submit"
                disabled={busy}
                className="w-full rounded-xl bg-muh-600 px-5 py-2.5 text-[13.5px] font-semibold text-white shadow-sm hover:bg-muh-700 disabled:opacity-60 sm:w-auto"
              >
                {busy ? 'Menyimpan…' : 'Simpan data sekolah'}
              </button>
            </div>
          </div>
        </form>
      )}
    </div>
  )
}
