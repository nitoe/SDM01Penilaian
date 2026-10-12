import { useEffect, useState, type FormEvent } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { getConfigAkademik, simpanSemesterAktif } from '../../lib/akademik'
import type { Semester } from '../../types/akademik'
import type { AppUser } from '../../types/user'

export default function TahunAjaran({ profile }: { profile: AppUser }) {
  const [semester, setSemester] = useState<Semester>('1')
  const [tahun, setTahun] = useState('2026/2027')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [pesan, setPesan] = useState<string | null>(null)
  const [galat, setGalat] = useState<string | null>(null)

  useEffect(() => {
    void getConfigAkademik()
      .then((c) => {
        setSemester(c.semesterAktif === '2' ? '2' : '1')
        if (c.tahunAjaran) setTahun(c.tahunAjaran)
      })
      .catch(() => setGalat('Gagal memuat pengaturan.'))
      .finally(() => setLoading(false))
  }, [])

  if (profile.role !== 'admin') return <Navigate to="/" replace />

  async function simpan(e: FormEvent) {
    e.preventDefault()
    const t = tahun.trim()
    if (!/^\d{4}\/\d{4}$/.test(t)) {
      setGalat('Tahun ajaran harus berbentuk 2026/2027.')
      return
    }
    setBusy(true)
    setPesan(null)
    setGalat(null)
    try {
      await simpanSemesterAktif({ semesterAktif: semester, tahunAjaran: t })
      setPesan('Disimpan. Nilai SLM baru akan memakai semester dan tahun ajaran ini.')
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
    <div className="mx-auto max-w-lg space-y-4">
      <div>
        <Link to="/admin" className="text-[11px] font-medium text-muh-700 hover:underline">
          ← Administrasi
        </Link>
        <h1 className="mt-0.5 text-lg font-semibold tracking-tight text-slate-900">Tahun Ajaran</h1>
        <p className="text-[12px] text-muted">
          Dipakai saat guru menyimpan nilai SLM. Mengganti semester tidak memindahkan nilai yang sudah tersimpan.
        </p>
      </div>

      {loading ? (
        <p className="text-[12px] text-muted">Memuat…</p>
      ) : (
        <form onSubmit={(e) => void simpan(e)} className="card-soft space-y-3 p-4">
          <label className="block text-[12px] font-medium text-slate-600">
            Tahun ajaran
            <input className={`${field} mt-1`} value={tahun} onChange={(e) => setTahun(e.target.value)} placeholder="2026/2027" />
          </label>
          <fieldset>
            <legend className="text-[12px] font-medium text-slate-600">Semester berjalan</legend>
            <div className="mt-1 flex gap-2">
              {(['1', '2'] as Semester[]).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSemester(s)}
                  className={`flex-1 rounded-xl border px-3 py-2 text-[13px] font-medium ${
                    semester === s ? 'border-muh-600 bg-muh-50 text-muh-800' : 'border-border bg-white text-slate-600'
                  }`}
                >
                  Semester {s}
                </button>
              ))}
            </div>
          </fieldset>
          {pesan && <p className="text-[12px] text-muh-800">{pesan}</p>}
          {galat && <p className="text-[12px] text-red-700">{galat}</p>}
          <button
            type="submit"
            disabled={busy}
            className="rounded-xl bg-muh-600 px-4 py-2 text-[13px] font-semibold text-white hover:bg-muh-700 disabled:opacity-60"
          >
            {busy ? 'Menyimpan…' : 'Simpan'}
          </button>
        </form>
      )}
    </div>
  )
}
