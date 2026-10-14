import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, Navigate } from 'react-router-dom'
import {
import { PageHeader } from '../../components/ui'
  hapusPeriode,
  listSemuaPeriode,
  setDefaultPeriode,
  simpanPeriode,
  toggleAktifPeriode,
} from '../../lib/periode'
import type { PeriodeAkademik, Semester } from '../../types/periode'
import { labelPeriode, labelSemester } from '../../types/periode'
import type { AppUser } from '../../types/user'

const field =
  'w-full rounded-xl border border-border bg-white px-3.5 py-2.5 text-[13.5px] outline-none transition focus:border-muh-500 focus:ring-2 focus:ring-muh-500/15'

export default function KelolaPeriode({ profile }: { profile: AppUser }) {
  const [daftar, setDaftar] = useState<PeriodeAkademik[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [pesan, setPesan] = useState<string | null>(null)
  const [galat, setGalat] = useState<string | null>(null)
  const [galatDetail, setGalatDetail] = useState<string | null>(null)

  // Form
  const [tahun, setTahun] = useState('2026/2027')
  const [semester, setSemester] = useState<Semester>('1')
  const [label, setLabel] = useState('')
  const [tgl1, setTgl1] = useState('')
  const [tgl25, setTgl25] = useState('')
  const [tgl6, setTgl6] = useState('')
  const [kota, setKota] = useState('Depok')
  const [aktif, setAktif] = useState(true)
  const [isDefault, setIsDefault] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)

  const defaultPeriode = useMemo(() => daftar.find((p) => p.isDefault) ?? null, [daftar])
  const aktifCount = useMemo(() => daftar.filter((p) => p.aktif).length, [daftar])

  async function muat() {
    setLoading(true)
    setGalat(null)
    setGalatDetail(null)
    try {
      const list = await listSemuaPeriode()
      setDaftar(list)
    } catch (err) {
      console.error(err)
      setGalat('Gagal memuat daftar periode.')
      setGalatDetail(
        err instanceof Error
          ? err.message
          : 'Periksa koneksi, rules Firestore, dan pastikan koleksi periode_akademik boleh dibaca admin.',
      )
      setDaftar([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void muat()
  }, [])

  if (profile.role !== 'admin') return <Navigate to="/" replace />

  function isiFormDari(p: PeriodeAkademik) {
    setEditId(p.id)
    setTahun(p.tahunAjaran)
    setSemester(p.semester)
    setLabel(p.label ?? '')
    setTgl1(p.tglRaporKelas1sampai6Sem1 ?? '')
    setTgl25(p.tglRaporKelas1sampai5Sem2 ?? '')
    setTgl6(p.tglRaporKelas6Sem2 ?? '')
    setKota(p.kotaRapor ?? 'Depok')
    setAktif(p.aktif)
    setIsDefault(!!p.isDefault)
    setPesan(null)
    setGalat(null)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function resetForm() {
    setEditId(null)
    setTahun('2026/2027')
    setSemester('1')
    setLabel('')
    setTgl1('')
    setTgl25('')
    setTgl6('')
    setKota('Depok')
    setAktif(true)
    setIsDefault(false)
  }

  async function simpan(e: FormEvent) {
    e.preventDefault()
    if (!/^\d{4}\/\d{4}$/.test(tahun.trim())) {
      setGalat('Tahun ajaran harus berbentuk 2026/2027.')
      return
    }
    setBusy(true)
    setPesan(null)
    setGalat(null)
    setGalatDetail(null)
    try {
      await simpanPeriode({
        tahunAjaran: tahun.trim(),
        semester,
        label: label.trim() || undefined,
        aktif,
        isDefault,
        // Hanya kirim tanggal yang relevan untuk semester yang dipilih
        tglRaporKelas1sampai6Sem1: semester === '1' ? tgl1 || undefined : undefined,
        tglRaporKelas1sampai5Sem2: semester === '2' ? tgl25 || undefined : undefined,
        tglRaporKelas6Sem2: semester === '2' ? tgl6 || undefined : undefined,
        kotaRapor: kota || undefined,
      })
      setPesan(
        editId
          ? `Periode ${labelPeriode({ tahunAjaran: tahun, semester, label })} diperbarui.`
          : `Periode ${labelPeriode({ tahunAjaran: tahun, semester, label })} berhasil ditambahkan.`,
      )
      resetForm()
      await muat()
    } catch (err) {
      console.error(err)
      setGalat('Gagal menyimpan periode.')
      setGalatDetail(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  async function toggle(id: string, now: boolean) {
    setGalat(null)
    try {
      await toggleAktifPeriode(id, !now)
      setPesan(now ? 'Periode dinonaktifkan. Guru tidak bisa memilihnya saat login.' : 'Periode diaktifkan. Guru bisa memilihnya saat login.')
      await muat()
    } catch (err) {
      setGalat('Gagal mengubah status aktif.')
      setGalatDetail(err instanceof Error ? err.message : String(err))
    }
  }

  async function jadiDefault(id: string) {
    setGalat(null)
    try {
      await setDefaultPeriode(id)
      setPesan('Periode dijadikan default dan diaktifkan. Config sistem (tahun ajaran & semester) ikut diselaraskan.')
      await muat()
    } catch (err) {
      setGalat('Gagal menetapkan default.')
      setGalatDetail(err instanceof Error ? err.message : String(err))
    }
  }

  async function hapus(id: string, labelTxt: string) {
    if (
      !confirm(
        `Hapus periode "${labelTxt}"?\n\nData nilai yang sudah tersimpan TIDAK ikut terhapus. Periode hanya dihapus dari daftar pilihan login.`,
      )
    )
      return
    setGalat(null)
    try {
      await hapusPeriode(id)
      if (editId === id) resetForm()
      setPesan(`Periode "${labelTxt}" dihapus.`)
      await muat()
    } catch (err) {
      setGalat('Gagal menghapus.')
      setGalatDetail(err instanceof Error ? err.message : String(err))
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5 pb-16">
      <PageHeader
        back={{ to: '/admin', label: 'Administrasi' }}
        title="Kelola Periode Akademik"
        subtitle="Setiap periode = satu tahun ajaran + satu semester. Guru memilih periode saat login sehingga sistem hanya memakai data konteks tersebut."
      />

      {/* Status ringkasan — bagian paling informatif */}
      {!loading && (
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="card-soft border-muh-200 bg-muh-50/60 p-4">
            <p className="text-[11px] font-medium uppercase tracking-wide text-muh-700">
              Periode default
            </p>
            {defaultPeriode ? (
              <>
                <p className="mt-1 text-[15px] font-semibold text-slate-900">
                  {labelPeriode(defaultPeriode)}
                </p>
                <p className="mt-0.5 text-[12px] text-muted">
                  {defaultPeriode.tahunAjaran} · {labelSemester(defaultPeriode.semester)}
                  {defaultPeriode.aktif ? ' · Aktif' : ' · Nonaktif'}
                </p>
                <p className="mt-2 text-[11.5px] leading-snug text-muh-800/80">
                  Otomatis dipilih saat login. Menetapkan default juga menyelaraskan config
                  sistem (tahun ajaran & semester) untuk kompatibilitas data lama.
                </p>
              </>
            ) : (
              <>
                <p className="mt-1 text-[15px] font-semibold text-slate-700">Belum ditetapkan</p>
                <p className="mt-1 text-[11.5px] text-muted">
                  Tambahkan periode lalu centang &quot;Jadikan default&quot;, atau tekan tombol di
                  daftar.
                </p>
              </>
            )}
          </div>

          <div className="card-soft p-4">
            <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
              Ringkasan
            </p>
            <p className="mt-1 text-[15px] font-semibold text-slate-900">
              {daftar.length === 0
                ? 'Belum ada periode'
                : `${daftar.length} periode · ${aktifCount} aktif`}
            </p>
            <p className="mt-2 text-[11.5px] leading-snug text-muted">
              <span className="font-medium text-slate-700">Aktif</span> = bisa dipilih guru saat
              login.
              <br />
              <span className="font-medium text-slate-700">Default</span> = pilihan awal otomatis.
              <br />
              Nonaktifkan periode lama agar tidak muncul di login guru.
            </p>
          </div>
        </div>
      )}

      {pesan && (
        <div className="rounded-xl border border-muh-200 bg-muh-50 px-3.5 py-2.5 text-[12.5px] text-muh-900">
          {pesan}
        </div>
      )}
      {galat && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-[12.5px] text-red-800">
          <p className="font-medium">{galat}</p>
          {galatDetail && (
            <p className="mt-1 font-mono text-[11px] text-red-700/80 break-all">{galatDetail}</p>
          )}
        </div>
      )}

      {/* Form */}
      <form onSubmit={(e) => void simpan(e)} className="card-soft space-y-4 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-[14.5px] font-semibold text-slate-900">
            {editId ? 'Perbarui periode' : 'Tambah periode baru'}
          </h2>
          {editId && (
            <button
              type="button"
              onClick={resetForm}
              className="text-[12px] font-medium text-muh-700 hover:underline"
            >
              Batal edit
            </button>
          )}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1.5 block text-[12px] font-medium text-slate-600">
              Tahun ajaran <span className="text-peach-500">*</span>
            </span>
            <input
              className={field}
              value={tahun}
              onChange={(e) => setTahun(e.target.value)}
              placeholder="2026/2027"
              required
              disabled={!!editId}
            />
            {editId && (
              <span className="mt-1 block text-[11px] text-muted">
                Tahun + semester menentukan ID; tidak bisa diubah.
              </span>
            )}
          </label>
          <div>
            <span className="mb-1.5 block text-[12px] font-medium text-slate-600">
              Semester <span className="text-peach-500">*</span>
            </span>
            <div className="flex gap-2">
              {(['1', '2'] as Semester[]).map((s) => (
                <button
                  key={s}
                  type="button"
                  disabled={!!editId}
                  onClick={() => setSemester(s)}
                  className={`flex-1 rounded-xl border px-3 py-2.5 text-[13px] font-medium transition ${
                    semester === s
                      ? 'border-muh-600 bg-muh-50 text-muh-800'
                      : 'border-border bg-white text-slate-600 hover:bg-slate-50'
                  } disabled:opacity-60`}
                >
                  {s === '1' ? '1 (Ganjil)' : '2 (Genap)'}
                </button>
              ))}
            </div>
          </div>
        </div>

        <label className="block">
          <span className="mb-1.5 block text-[12px] font-medium text-slate-600">
            Label tampilan (opsional)
          </span>
          <input
            className={field}
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder={
              semester === '1' ? `Ganjil ${tahun || '2026/2027'}` : `Genap ${tahun || '2026/2027'}`
            }
          />
        </label>

        {/* Tanggal rapor — conditional per semester */}
        <div className="rounded-xl border border-border bg-slate-50/60 p-3.5">
          <p className="mb-2.5 text-[12px] font-semibold text-slate-700">
            Tanggal rapor · {labelSemester(semester)}
          </p>
          {semester === '1' ? (
            <label className="block">
              <span className="mb-1.5 block text-[12px] font-medium text-slate-600">
                Tanggal rapor kelas 1–6 (semester 1)
              </span>
              <input
                className={field}
                value={tgl1}
                onChange={(e) => setTgl1(e.target.value)}
                placeholder="Contoh: 20 Desember 2026"
              />
              <span className="mt-1 block text-[11px] text-muted">
                Satu tanggal untuk semua kelas di semester ganjil.
              </span>
            </label>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1.5 block text-[12px] font-medium text-slate-600">
                  Tanggal rapor kelas 1–5
                </span>
                <input
                  className={field}
                  value={tgl25}
                  onChange={(e) => setTgl25(e.target.value)}
                  placeholder="Contoh: 15 Juni 2027"
                />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-[12px] font-medium text-slate-600">
                  Tanggal rapor kelas 6
                </span>
                <input
                  className={field}
                  value={tgl6}
                  onChange={(e) => setTgl6(e.target.value)}
                  placeholder="Contoh: 10 Juni 2027"
                />
                <span className="mt-1 block text-[11px] text-muted">
                  Kelas 6 biasanya lebih awal (kelulusan).
                </span>
              </label>
            </div>
          )}
          <label className="mt-3 block">
            <span className="mb-1.5 block text-[12px] font-medium text-slate-600">Kota di rapor</span>
            <input
              className={field}
              value={kota}
              onChange={(e) => setKota(e.target.value)}
              placeholder="Depok"
            />
          </label>
        </div>

        <div className="flex flex-wrap gap-x-5 gap-y-2 text-[13px]">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={aktif}
              onChange={(e) => setAktif(e.target.checked)}
              className="accent-muh-600"
            />
            <span>
              <span className="font-medium text-slate-800">Aktif</span>
              <span className="text-muted"> — bisa dipilih guru saat login</span>
            </span>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={isDefault}
              onChange={(e) => setIsDefault(e.target.checked)}
              className="accent-muh-600"
            />
            <span>
              <span className="font-medium text-slate-800">Jadikan default</span>
              <span className="text-muted"> — pilihan awal otomatis</span>
            </span>
          </label>
        </div>

        <button
          type="submit"
          disabled={busy}
          className="rounded-xl bg-muh-600 px-5 py-2.5 text-[13.5px] font-semibold text-white shadow-sm hover:bg-muh-700 disabled:opacity-60"
        >
          {busy ? 'Menyimpan…' : editId ? 'Simpan perubahan' : 'Tambah periode'}
        </button>
      </form>

      {/* Daftar */}
      <div>
        <h2 className="mb-3 text-[14.5px] font-semibold text-slate-900">Daftar periode</h2>
        {loading ? (
          <div className="space-y-2">
            {[1, 2].map((i) => (
              <div key={i} className="card-soft h-24 animate-pulse bg-slate-50" />
            ))}
          </div>
        ) : daftar.length === 0 ? (
          <div className="card-soft border-dashed p-6 text-center">
            <p className="text-[13.5px] font-medium text-slate-700">Belum ada periode</p>
            <p className="mt-1 text-[12.5px] text-muted">
              Tambahkan periode pertama di form di atas (mis. 2026/2027 · Semester 1), centang{' '}
              <strong>Aktif</strong> dan <strong>Jadikan default</strong>, lalu simpan.
            </p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {daftar.map((p) => {
              const isDef = !!p.isDefault
              return (
                <div
                  key={p.id}
                  className={`card-soft overflow-hidden ${
                    isDef ? 'ring-2 ring-muh-500/30' : ''
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3 p-3.5">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-[14.5px] font-semibold text-slate-900">
                          {labelPeriode(p)}
                        </span>
                        {isDef && (
                          <span className="rounded-full bg-muh-600 px-2 py-0.5 text-[10.5px] font-semibold text-white">
                            DEFAULT
                          </span>
                        )}
                        {p.aktif ? (
                          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10.5px] font-medium text-emerald-800">
                            Aktif
                          </span>
                        ) : (
                          <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10.5px] font-medium text-slate-600">
                            Nonaktif
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-[12px] text-muted">
                        {p.tahunAjaran} · {labelSemester(p.semester)}
                        <span className="mx-1.5 text-slate-300">·</span>
                        <span className="font-mono text-[11px] text-slate-500">{p.id}</span>
                      </p>
                      {/* Info tanggal rapor ringkas */}
                      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-0.5 text-[11.5px] text-slate-600">
                        {p.semester === '1' && p.tglRaporKelas1sampai6Sem1 && (
                          <span>Rapor 1–6: {p.tglRaporKelas1sampai6Sem1}</span>
                        )}
                        {p.semester === '2' && p.tglRaporKelas1sampai5Sem2 && (
                          <span>Rapor 1–5: {p.tglRaporKelas1sampai5Sem2}</span>
                        )}
                        {p.semester === '2' && p.tglRaporKelas6Sem2 && (
                          <span>Rapor kelas 6: {p.tglRaporKelas6Sem2}</span>
                        )}
                        {p.kotaRapor && <span>Kota: {p.kotaRapor}</span>}
                        {!p.tglRaporKelas1sampai6Sem1 &&
                          !p.tglRaporKelas1sampai5Sem2 &&
                          !p.tglRaporKelas6Sem2 && (
                            <span className="text-amber-700">Tanggal rapor belum diisi</span>
                          )}
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-1.5">
                      <button
                        type="button"
                        onClick={() => isiFormDari(p)}
                        className="rounded-lg border border-border px-2.5 py-1 text-[12px] font-medium hover:bg-slate-50"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => void toggle(p.id, p.aktif)}
                        className={`rounded-lg border px-2.5 py-1 text-[12px] font-medium ${
                          p.aktif
                            ? 'border-amber-200 text-amber-800 hover:bg-amber-50'
                            : 'border-emerald-200 text-emerald-800 hover:bg-emerald-50'
                        }`}
                      >
                        {p.aktif ? 'Nonaktifkan' : 'Aktifkan'}
                      </button>
                      {!isDef && (
                        <button
                          type="button"
                          onClick={() => void jadiDefault(p.id)}
                          className="rounded-lg border border-muh-200 px-2.5 py-1 text-[12px] font-medium text-muh-800 hover:bg-muh-50"
                        >
                          Jadikan default
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => void hapus(p.id, labelPeriode(p))}
                        className="rounded-lg border border-red-200 px-2.5 py-1 text-[12px] font-medium text-red-700 hover:bg-red-50"
                      >
                        Hapus
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Panduan singkat */}
      <div className="rounded-xl border border-border bg-slate-50/80 px-4 py-3.5 text-[12px] leading-relaxed text-slate-600">
        <p className="font-semibold text-slate-800">Cara kerja singkat</p>
        <ol className="mt-1.5 list-decimal space-y-1 pl-4">
          <li>
            Buat periode (mis. 2026/2027 semester 1), centang <strong>Aktif</strong> +{' '}
            <strong>Jadikan default</strong>.
          </li>
          <li>
            Saat login, guru memilih periode aktif. Default dipakai otomatis jika hanya ada satu
            atau belum pernah memilih.
          </li>
          <li>
            Periode lama bisa di-<strong>nonaktifkan</strong> agar tidak muncul di login, tanpa
            menghapus data nilai.
          </li>
          <li>
            Ganti default kapan saja lewat tombol <strong>Jadikan default</strong> — periode itu
            otomatis diaktifkan, dan <code className="text-[11px]">config/akademik</code> ikut
            diselaraskan (tahun ajaran + semester).
          </li>
        </ol>
      </div>
    </div>
  )
}