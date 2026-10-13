import { useEffect, useState, type FormEvent } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { getConfigAkademik, simpanProfilSekolah } from '../../lib/akademik'
import type { Semester } from '../../types/akademik'
import type { AppUser } from '../../types/user'
import Icon from '../../components/Icon'

const DPL = [
  { id: 'DPL1', nama: 'Keimanan dan Ketakwaan' },
  { id: 'DPL2', nama: 'Kewargaan' },
  { id: 'DPL3', nama: 'Penalaran Kritis' },
  { id: 'DPL4', nama: 'Kreativitas' },
  { id: 'DPL5', nama: 'Kolaborasi' },
  { id: 'DPL6', nama: 'Kemandirian' },
  { id: 'DPL7', nama: 'Kesehatan' },
  { id: 'DPL8', nama: 'Komunikasi' },
]

const SENI = ['Seni Musik', 'Seni Rupa']

const field =
  'w-full rounded-xl border border-border bg-white px-3.5 py-2.5 text-[13.5px] outline-none transition focus:border-muh-500 focus:ring-2 focus:ring-muh-500/15'

function Section({
  icon,
  title,
  desc,
  children,
}: {
  icon: 'book' | 'users' | 'calendar' | 'target'
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
  const [tahun, setTahun] = useState('2026/2027')
  const [semester, setSemester] = useState<Semester>('1')
  const [seniGanjil, setSeniGanjil] = useState('')
  const [seniGenap, setSeniGenap] = useState('')
  const [tglRapor, setTglRapor] = useState('')
  const [tglRapor15, setTglRapor15] = useState('')
  const [kota, setKota] = useState('Depok')
  const [dpl, setDpl] = useState<string[]>([])
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
        if (c.tahunAjaran) setTahun(c.tahunAjaran)
        setSemester(c.semesterAktif === '2' ? '2' : '1')
        if (c.seniSemesterGanjil) setSeniGanjil(c.seniSemesterGanjil)
        if (c.seniSemesterGenap) setSeniGenap(c.seniSemesterGenap)
        if (c.tglRapor) setTglRapor(c.tglRapor)
        if (c.tglRapor1sampai5) setTglRapor15(c.tglRapor1sampai5)
        if (c.kotaRapor) setKota(c.kotaRapor)
        if (Array.isArray(c.dplSemesterIni)) setDpl(c.dplSemesterIni.map(String))
      })
      .catch(() => setGalat('Gagal memuat data sekolah.'))
      .finally(() => setLoading(false))
  }, [])

  if (profile.role !== 'admin') return <Navigate to="/" replace />

  function toggleDpl(id: string) {
    setDpl((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  async function simpan(e: FormEvent) {
    e.preventDefault()
    const t = tahun.trim()
    if (!namaSekolah.trim() || !npsn.trim() || !alamat.trim()) {
      setGalat('Nama sekolah, NPSN, dan alamat wajib diisi.')
      return
    }
    if (!/^\d{4}\/\d{4}$/.test(t)) {
      setGalat('Tahun ajaran harus berbentuk 2026/2027. Nilai tersimpan menempel pada tahun ini.')
      return
    }
    if (!kepsek.trim() || !nbm.trim()) {
      setGalat('Nama dan NBM kepala sekolah wajib diisi.')
      return
    }
    if (!seniGanjil || !seniGenap) {
      setGalat('Pilih Seni Budaya untuk semester ganjil dan genap.')
      return
    }
    if (seniGanjil === seniGenap) {
      setGalat('Seni Budaya semester ganjil dan genap tidak boleh sama.')
      return
    }
    if (dpl.length < 3) {
      setGalat('Pilih minimal 3 dimensi profil lulusan untuk semester ini.')
      return
    }
    setBusy(true)
    setPesan(null)
    setGalat(null)
    try {
      await simpanProfilSekolah({
        namaSekolah,
        npsn,
        alamatSekolah: alamat,
        telpSekolah: telp,
        namaKepsek: kepsek,
        nbmKepsek: nbm,
        tahunAjaran: t,
        semesterAktif: semester,
        seniSemesterGanjil: seniGanjil,
        seniSemesterGenap: seniGenap,
        tglRapor,
        tglRapor1sampai5: tglRapor15,
        kotaRapor: kota,
        dplSemesterIni: dpl,
      })
      setPesan('Tersimpan. Nilai baru memakai tahun ajaran dan semester ini. Data tahun lalu tetap di tempatnya.')
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
          Identitas yang muncul di rapor, tahun ajaran berjalan, dan dimensi profil lulusan semester ini.
          Mengganti tahun ajaran tidak memindahkan nilai yang sudah tersimpan.
        </p>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
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
                <input className={field} value={npsn} onChange={(e) => setNpsn(e.target.value)} inputMode="numeric" placeholder="2022xxxx" />
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

          <Section icon="calendar" title="Tahun ajaran dan semester" desc="Semua nilai SLM/STS/SAS baru menempel pada tahun dan semester ini.">
            <label className="block">
              <Label required>Tahun ajaran</Label>
              <input className={field} value={tahun} onChange={(e) => setTahun(e.target.value)} placeholder="2026/2027" />
            </label>
            <div>
              <Label required>Semester aktif</Label>
              <div className="mt-1 flex gap-2">
                {(['1', '2'] as Semester[]).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setSemester(s)}
                    className={`flex-1 rounded-xl border px-3 py-2.5 text-[13px] font-medium transition ${
                      semester === s
                        ? 'border-muh-600 bg-muh-50 text-muh-800 shadow-sm'
                        : 'border-border bg-white text-slate-600 hover:border-slate-300'
                    }`}
                  >
                    Semester {s} {s === '1' ? '(ganjil)' : '(genap)'}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <Label required>Seni Budaya semester ganjil</Label>
                <select className={field} value={seniGanjil} onChange={(e) => setSeniGanjil(e.target.value)}>
                  <option value="">— Pilih —</option>
                  {SENI.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </label>
              <label className="block">
                <Label required>Seni Budaya semester genap</Label>
                <select className={field} value={seniGenap} onChange={(e) => setSeniGenap(e.target.value)}>
                  <option value="">— Pilih —</option>
                  {SENI.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </label>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <Label>Tanggal rapor kelas 6 & sem. ganjil</Label>
                <input className={field} value={tglRapor} onChange={(e) => setTglRapor(e.target.value)} placeholder="22 Desember 2026" />
              </label>
              <label className="block">
                <Label>Tanggal rapor kelas 1–5 sem. genap</Label>
                <input className={field} value={tglRapor15} onChange={(e) => setTglRapor15(e.target.value)} placeholder="21 Juni 2027" />
              </label>
            </div>
            <label className="block">
              <Label>Kota penerbitan rapor</Label>
              <input className={field} value={kota} onChange={(e) => setKota(e.target.value)} />
            </label>
          </Section>

          <Section icon="target" title="Dimensi profil lulusan semester ini" desc="Pilih minimal 3. Berlaku untuk semua kelas pada semester berjalan.">
            <div className="flex flex-wrap gap-2">
              {DPL.map((d) => {
                const aktif = dpl.includes(d.id)
                return (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => toggleDpl(d.id)}
                    className={`rounded-full px-3.5 py-1.5 text-[12.5px] font-medium transition ${
                      aktif ? 'bg-muh-600 text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {d.nama}
                  </button>
                )
              })}
            </div>
            <p className="text-[11.5px] text-muted">
              Terpilih: <strong className="text-slate-700">{dpl.length}</strong> / minimal 3
            </p>
          </Section>

          {pesan && (
            <div className="rounded-xl border border-muh-200 bg-muh-50 px-3.5 py-2.5 text-[12.5px] text-muh-900">{pesan}</div>
          )}
          {galat && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-[12.5px] text-red-800">{galat}</div>
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
