import { useEffect, useState, type FormEvent } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { getConfigAkademik, simpanProfilSekolah } from '../../lib/akademik'
import type { Semester } from '../../types/akademik'
import type { AppUser } from '../../types/user'

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

  const field =
    'w-full rounded-xl border border-border bg-white px-3 py-2 text-[13px] outline-none focus:border-muh-500 focus:ring-2 focus:ring-muh-500/15'

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div>
        <Link to="/admin" className="text-[11px] font-medium text-muh-700 hover:underline">
          ← Administrasi
        </Link>
        <h1 className="mt-0.5 text-lg font-semibold tracking-tight text-slate-900">Data Sekolah</h1>
        <p className="text-[12px] text-muted">
          Identitas rapor dan tahun ajaran yang sedang berjalan. Mengganti tahun ajaran tidak memindahkan nilai yang sudah tersimpan.
        </p>
      </div>

      {loading ? (
        <p className="text-[12px] text-muted">Memuat…</p>
      ) : (
        <form onSubmit={(e) => void simpan(e)} className="space-y-4">
          <section className="card-soft space-y-3 p-4">
            <h2 className="text-[14px] font-semibold text-slate-900">Identitas sekolah</h2>
            <label className="block text-[12px] font-medium text-slate-600">
              Nama sekolah
              <input className={`${field} mt-1`} value={namaSekolah} onChange={(e) => setNamaSekolah(e.target.value)} />
            </label>
            <label className="block text-[12px] font-medium text-slate-600">
              NPSN
              <input className={`${field} mt-1`} value={npsn} onChange={(e) => setNpsn(e.target.value)} inputMode="numeric" />
            </label>
            <label className="block text-[12px] font-medium text-slate-600">
              Alamat
              <textarea className={`${field} mt-1`} rows={2} value={alamat} onChange={(e) => setAlamat(e.target.value)} />
            </label>
            <label className="block text-[12px] font-medium text-slate-600">
              Telepon atau email
              <input className={`${field} mt-1`} value={telp} onChange={(e) => setTelp(e.target.value)} />
            </label>
          </section>

          <section className="card-soft space-y-3 p-4">
            <h2 className="text-[14px] font-semibold text-slate-900">Kepala sekolah</h2>
            <label className="block text-[12px] font-medium text-slate-600">
              Nama
              <input className={`${field} mt-1`} value={kepsek} onChange={(e) => setKepsek(e.target.value)} />
            </label>
            <label className="block text-[12px] font-medium text-slate-600">
              NBM
              <input className={`${field} mt-1`} value={nbm} onChange={(e) => setNbm(e.target.value)} />
            </label>
          </section>

          <section className="card-soft space-y-3 p-4">
            <h2 className="text-[14px] font-semibold text-slate-900">Tahun ajaran dan semester</h2>
            <p className="text-[12px] text-muted">
              Semua nilai SLM baru disimpan di tahun dan semester ini. Tahun depan cukup mengganti tahun ajaran, tanpa migrasi data lama.
            </p>
            <label className="block text-[12px] font-medium text-slate-600">
              Tahun ajaran
              <input className={`${field} mt-1`} value={tahun} onChange={(e) => setTahun(e.target.value)} placeholder="2026/2027" />
            </label>
            <div className="flex gap-2">
              {(['1', '2'] as Semester[]).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSemester(s)}
                  className={`flex-1 rounded-xl border px-3 py-2 text-[13px] font-medium ${
                    semester === s ? 'border-muh-600 bg-muh-50 text-muh-800' : 'border-border bg-white text-slate-600'
                  }`}
                >
                  Semester {s} {s === '1' ? '(ganjil)' : '(genap)'}
                </button>
              ))}
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-[12px] font-medium text-slate-600">
                Seni Budaya semester ganjil
                <select className={`${field} mt-1`} value={seniGanjil} onChange={(e) => setSeniGanjil(e.target.value)}>
                  <option value="">— Pilih —</option>
                  {SENI.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </label>
              <label className="block text-[12px] font-medium text-slate-600">
                Seni Budaya semester genap
                <select className={`${field} mt-1`} value={seniGenap} onChange={(e) => setSeniGenap(e.target.value)}>
                  <option value="">— Pilih —</option>
                  {SENI.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </label>
            </div>
            <label className="block text-[12px] font-medium text-slate-600">
              Tanggal penerimaan rapor kelas 6 dan semester ganjil
              <input className={`${field} mt-1`} value={tglRapor} onChange={(e) => setTglRapor(e.target.value)} placeholder="22 Desember 2026" />
            </label>
            <label className="block text-[12px] font-medium text-slate-600">
              Tanggal penerimaan rapor kelas 1–5 semester genap
              <input className={`${field} mt-1`} value={tglRapor15} onChange={(e) => setTglRapor15(e.target.value)} placeholder="21 Juni 2027" />
            </label>
            <label className="block text-[12px] font-medium text-slate-600">
              Kota penerbitan rapor
              <input className={`${field} mt-1`} value={kota} onChange={(e) => setKota(e.target.value)} />
            </label>
          </section>

          <section className="card-soft space-y-3 p-4">
            <h2 className="text-[14px] font-semibold text-slate-900">Dimensi profil lulusan semester ini</h2>
            <p className="text-[12px] text-muted">Pilih minimal 3. Berlaku untuk semua kelas pada semester berjalan.</p>
            <div className="flex flex-wrap gap-1.5">
              {DPL.map((d) => {
                const aktif = dpl.includes(d.id)
                return (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => toggleDpl(d.id)}
                    className={`rounded-full px-3 py-1 text-[12px] font-medium ${
                      aktif ? 'bg-muh-600 text-white' : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {d.nama}
                  </button>
                )
              })}
            </div>
          </section>

          {pesan && <p className="text-[12px] text-muh-800">{pesan}</p>}
          {galat && <p className="text-[12px] text-red-700">{galat}</p>}
          <button
            type="submit"
            disabled={busy}
            className="rounded-xl bg-muh-600 px-4 py-2 text-[13px] font-semibold text-white hover:bg-muh-700 disabled:opacity-60"
          >
            {busy ? 'Menyimpan…' : 'Simpan data sekolah'}
          </button>
        </form>
      )}
    </div>
  )
}
