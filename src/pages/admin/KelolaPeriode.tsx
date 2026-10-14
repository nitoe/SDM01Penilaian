import { useEffect, useState, type FormEvent } from 'react'
import { Link, Navigate } from 'react-router-dom'
import {
  hapusPeriode,
  listSemuaPeriode,
  setDefaultPeriode,
  simpanPeriode,
  toggleAktifPeriode,
} from '../../lib/periode'
import type { PeriodeAkademik, Semester } from '../../types/periode'
import { labelPeriode } from '../../types/periode'
import type { AppUser } from '../../types/user'

const field =
  'w-full rounded-xl border border-border bg-white px-3.5 py-2.5 text-[13.5px] outline-none transition focus:border-muh-500 focus:ring-2 focus:ring-muh-500/15'

export default function KelolaPeriode({ profile }: { profile: AppUser }) {
  const [daftar, setDaftar] = useState<PeriodeAkademik[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [pesan, setPesan] = useState<string | null>(null)
  const [galat, setGalat] = useState<string | null>(null)

  // Form tambah
  const [tahun, setTahun] = useState('2026/2027')
  const [semester, setSemester] = useState<Semester>('1')
  const [label, setLabel] = useState('')
  const [tgl1, setTgl1] = useState('')
  const [tgl25, setTgl25] = useState('')
  const [tgl6, setTgl6] = useState('')
  const [kota, setKota] = useState('Depok')
  const [aktif, setAktif] = useState(true)
  const [isDefault, setIsDefault] = useState(false)

  async function muat() {
    setLoading(true)
    try {
      setDaftar(await listSemuaPeriode())
    } catch {
      setGalat('Gagal memuat daftar periode.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void muat()
  }, [])

  if (profile.role !== 'admin') return <Navigate to="/" replace />

  async function simpan(e: FormEvent) {
    e.preventDefault()
    if (!/^\d{4}\/\d{4}$/.test(tahun.trim())) {
      setGalat('Tahun ajaran harus berbentuk 2026/2027.')
      return
    }
    setBusy(true)
    setPesan(null)
    setGalat(null)
    try {
      await simpanPeriode({
        tahunAjaran: tahun.trim(),
        semester,
        label: label.trim() || undefined,
        aktif,
        isDefault,
        tglRaporKelas1sampai6Sem1: tgl1 || undefined,
        tglRaporKelas1sampai5Sem2: tgl25 || undefined,
        tglRaporKelas6Sem2: tgl6 || undefined,
        kotaRapor: kota || undefined,
      })
      setPesan('Periode tersimpan.')
      setLabel('')
      await muat()
    } catch (err) {
      console.error(err)
      setGalat('Gagal menyimpan.')
    } finally {
      setBusy(false)
    }
  }

  async function toggle(id: string, now: boolean) {
    try {
      await toggleAktifPeriode(id, !now)
      await muat()
    } catch {
      setGalat('Gagal mengubah status.')
    }
  }

  async function jadiDefault(id: string) {
    try {
      await setDefaultPeriode(id)
      await muat()
    } catch {
      setGalat('Gagal menetapkan default.')
    }
  }

  async function hapus(id: string, labelTxt: string) {
    if (!confirm(`Hapus periode "${labelTxt}"? Data nilai yang sudah ada tidak ikut terhapus.`)) return
    try {
      await hapusPeriode(id)
      await muat()
    } catch {
      setGalat('Gagal menghapus.')
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 pb-12">
      <div>
        <Link to="/admin" className="text-[11px] font-medium text-muh-700 hover:underline">
          ← Administrasi
        </Link>
        <h1 className="mt-0.5 text-lg font-semibold tracking-tight text-slate-900">
          Kelola Periode Akademik
        </h1>
        <p className="mt-1 text-[12.5px] leading-relaxed text-muted">
          Buat tahun ajaran + semester, aktifkan/nonaktifkan agar guru bisa memilihnya saat login,
          dan atur tanggal rapor per periode.
        </p>
      </div>

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

      {/* Form tambah */}
      <form onSubmit={(e) => void simpan(e)} className="card-soft space-y-4 p-4">
        <h2 className="text-[14.5px] font-semibold text-slate-900">Tambah / perbarui periode</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1.5 block text-[12px] font-medium text-slate-600">Tahun ajaran *</span>
            <input
              className={field}
              value={tahun}
              onChange={(e) => setTahun(e.target.value)}
              placeholder="2026/2027"
              required
            />
          </label>
          <div>
            <span className="mb-1.5 block text-[12px] font-medium text-slate-600">Semester *</span>
            <div className="flex gap-2">
              {(['1', '2'] as Semester[]).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSemester(s)}
                  className={`flex-1 rounded-xl border px-3 py-2.5 text-[13px] font-medium ${
                    semester === s
                      ? 'border-muh-600 bg-muh-50 text-muh-800'
                      : 'border-border bg-white text-slate-600'
                  }`}
                >
                  {s === '1' ? '1 (Ganjil)' : '2 (Genap)'}
                </button>
              ))}
            </div>
          </div>
        </div>
        <label className="block">
          <span className="mb-1.5 block text-[12px] font-medium text-slate-600">Label (opsional)</span>
          <input
            className={field}
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Ganjil 2026/2027"
          />
        </label>
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="block">
            <span className="mb-1.5 block text-[12px] font-medium text-slate-600">
              Tgl rapor sem.1 (1–6)
            </span>
            <input className={field} value={tgl1} onChange={(e) => setTgl1(e.target.value)} />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-[12px] font-medium text-slate-600">
              Tgl rapor sem.2 kelas 1–5
            </span>
            <input className={field} value={tgl25} onChange={(e) => setTgl25(e.target.value)} />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-[12px] font-medium text-slate-600">
              Tgl rapor sem.2 kelas 6
            </span>
            <input className={field} value={tgl6} onChange={(e) => setTgl6(e.target.value)} />
          </label>
        </div>
        <label className="block">
          <span className="mb-1.5 block text-[12px] font-medium text-slate-600">Kota rapor</span>
          <input className={field} value={kota} onChange={(e) => setKota(e.target.value)} />
        </label>
        <div className="flex flex-wrap gap-4 text-[13px]">
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={aktif} onChange={(e) => setAktif(e.target.checked)} />
            Aktif (bisa dipilih guru)
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={isDefault}
              onChange={(e) => setIsDefault(e.target.checked)}
            />
            Jadikan default
          </label>
        </div>
        <button
          type="submit"
          disabled={busy}
          className="rounded-xl bg-muh-600 px-5 py-2.5 text-[13.5px] font-semibold text-white hover:bg-muh-700 disabled:opacity-60"
        >
          {busy ? 'Menyimpan…' : 'Simpan periode'}
        </button>
      </form>

      {/* Daftar */}
      <div>
        <h2 className="mb-3 text-[14.5px] font-semibold text-slate-900">Daftar periode</h2>
        {loading ? (
          <div className="space-y-2">
            {[1, 2].map((i) => (
              <div key={i} className="card-soft h-20 animate-pulse bg-slate-50" />
            ))}
          </div>
        ) : daftar.length === 0 ? (
          <p className="text-[13px] text-muted">Belum ada periode. Tambahkan yang pertama di atas.</p>
        ) : (
          <div className="space-y-2">
            {daftar.map((p) => (
              <div
                key={p.id}
                className="card-soft flex flex-wrap items-center justify-between gap-3 p-3.5"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-slate-900">{labelPeriode(p)}</span>
                    {p.isDefault && (
                      <span className="rounded-full bg-muh-100 px-2 py-0.5 text-[10.5px] font-medium text-muh-800">
                        Default
                      </span>
                    )}
                    {!p.aktif && (
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10.5px] text-slate-600">
                        Nonaktif
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-[11.5px] text-muted">
                    {p.tahunAjaran} · Semester {p.semester}
                  </p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => void toggle(p.id, p.aktif)}
                    className="rounded-lg border border-border px-2.5 py-1 text-[12px] hover:bg-slate-50"
                  >
                    {p.aktif ? 'Nonaktifkan' : 'Aktifkan'}
                  </button>
                  {!p.isDefault && (
                    <button
                      type="button"
                      onClick={() => void jadiDefault(p.id)}
                      className="rounded-lg border border-border px-2.5 py-1 text-[12px] hover:bg-slate-50"
                    >
                      Jadikan default
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => void hapus(p.id, labelPeriode(p))}
                    className="rounded-lg border border-red-200 px-2.5 py-1 text-[12px] text-red-700 hover:bg-red-50"
                  >
                    Hapus
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
