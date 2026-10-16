import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import { Badge, PageHeader, StatStrip } from '../../components/ui'
import {
  Field,
  Notice,
  Segmented,
  Spinner,
  btnDanger,
  btnDangerGhostSm,
  btnGhost,
  btnGhostSm,
  btnPrimary,
  inputCls,
} from '../akademik/shared'
import {
  hapusPeriode,
  listSemuaPeriode,
  setDefaultPeriode,
  simpanPeriode,
  toggleAktifPeriode,
} from '../../lib/periode'
import type { PeriodeAkademik, Semester } from '../../types/periode'
import { labelPeriode, labelSemester } from '../../types/periode'
import type { AppUser } from '../../types/user'

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
  /** ID periode yang diminta konfirmasi hapus (inline, bukan confirm() bawaan browser). */
  const [konfirmasiHapus, setKonfirmasiHapus] = useState<string | null>(null)
  const formRef = useRef<HTMLFormElement>(null)

  const defaultPeriode = useMemo(() => daftar.find((p) => p.isDefault) ?? null, [daftar])
  const aktifCount = useMemo(() => daftar.filter((p) => p.aktif).length, [daftar])
  /** Periode dikelompokkan per tahun ajaran agar daftar yang makin panjang tetap mudah dipindai. */
  const kelompok = useMemo(() => {
    const peta = new Map<string, PeriodeAkademik[]>()
    for (const p of daftar) peta.set(p.tahunAjaran, [...(peta.get(p.tahunAjaran) ?? []), p])
    return [...peta.entries()]
  }, [daftar])

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
    if (window.matchMedia('(max-width: 1023px)').matches) {
      formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
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
    setGalat(null)
    setKonfirmasiHapus(null)
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
    <div className="space-y-5 pb-16">
      <PageHeader
        back={{ to: '/admin', label: 'Administrasi' }}
        title="Kelola Periode Akademik"
        subtitle="Setiap periode = satu tahun ajaran + satu semester. Guru memilih periode saat login sehingga sistem hanya memakai data konteks tersebut."
      />

      {!loading && (
        <StatStrip
          items={[
            {
              label: 'Periode default',
              value: defaultPeriode ? labelPeriode(defaultPeriode) : null,
              hint: defaultPeriode
                ? `${defaultPeriode.tahunAjaran} · ${labelSemester(defaultPeriode.semester)}${
                    defaultPeriode.aktif ? '' : ' · nonaktif'
                  }`
                : 'Belum ditetapkan',
            },
            { label: 'Periode terdaftar', value: daftar.length, hint: 'Semua tahun ajaran' },
            {
              label: 'Aktif untuk login',
              value: aktifCount,
              hint: aktifCount === 0 && daftar.length > 0 ? 'Guru belum bisa memilih periode' : 'Bisa dipilih guru',
            },
          ]}
        />
      )}

      {pesan && <Notice tone="ok">{pesan}</Notice>}
      {galat && (
        <Notice tone="error">
          <p className="font-medium">{galat}</p>
          {galatDetail && <p className="mt-1 break-all font-mono text-[11px] opacity-80">{galatDetail}</p>}
        </Notice>
      )}

      <div className="grid items-start gap-5 lg:grid-cols-5">
        {/* Daftar */}
        <section className="lg:col-span-3" aria-label="Daftar periode">
          <h2 className="mb-2.5 text-[14px] font-semibold text-slate-900">Daftar periode</h2>
          {loading ? (
            <Spinner />
          ) : daftar.length === 0 ? (
            <div className="rounded-[var(--radius-card)] border border-dashed border-border bg-white p-6 text-center">
              <p className="text-[13.5px] font-medium text-slate-800">Belum ada periode</p>
              <p className="mt-1 text-[12.5px] text-muted">
                Tambahkan periode pertama (mis. 2026/2027 · Semester 1), centang <strong>Aktif</strong> dan{' '}
                <strong>Jadikan default</strong>, lalu simpan.
              </p>
            </div>
          ) : (
            <div className="space-y-5">
              {kelompok.map(([tahunKelompok, items]) => (
                <div key={tahunKelompok}>
                  <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted">
                    Tahun ajaran {tahunKelompok}
                  </h3>
                  <ul className="space-y-2.5">
                    {items.map((p) => {
                      const isDef = !!p.isDefault
                      const adaTanggal =
                        p.tglRaporKelas1sampai6Sem1 || p.tglRaporKelas1sampai5Sem2 || p.tglRaporKelas6Sem2
                      return (
                        <li key={p.id} className="card-soft relative overflow-hidden p-4">
                          {/* Penanda periode default: elemen tersendiri, karena .card-soft mengalahkan utilitas border */}
                          {isDef && <span aria-hidden className="absolute inset-y-0 left-0 w-[3px] bg-muh-600" />}
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-[14.5px] font-semibold text-slate-900">{labelPeriode(p)}</span>
                            {isDef && <Badge tone="brand">Default</Badge>}
                            <Badge tone={p.aktif ? 'ok' : 'neutral'}>{p.aktif ? 'Aktif' : 'Nonaktif'}</Badge>
                            {editId === p.id && <Badge tone="peach">Sedang diedit</Badge>}
                          </div>
                          <p className="mt-1 text-[12px] text-muted">
                            {p.tahunAjaran} · {labelSemester(p.semester)}
                            <span className="mx-1.5 text-slate-300">·</span>
                            <span className="font-mono text-[11px]">{p.id}</span>
                          </p>
                          <p className="mt-2 text-[12px] text-slate-600">
                            {adaTanggal ? (
                              <>
                                {p.semester === '1' && p.tglRaporKelas1sampai6Sem1 && (
                                  <span className="mr-3">Rapor 1–6: {p.tglRaporKelas1sampai6Sem1}</span>
                                )}
                                {p.semester === '2' && p.tglRaporKelas1sampai5Sem2 && (
                                  <span className="mr-3">Rapor 1–5: {p.tglRaporKelas1sampai5Sem2}</span>
                                )}
                                {p.semester === '2' && p.tglRaporKelas6Sem2 && (
                                  <span className="mr-3">Rapor kelas 6: {p.tglRaporKelas6Sem2}</span>
                                )}
                                {p.kotaRapor && <span>Kota: {p.kotaRapor}</span>}
                              </>
                            ) : (
                              <span className="text-peach-500">Tanggal rapor belum diisi</span>
                            )}
                          </p>

                          {konfirmasiHapus === p.id ? (
                            <div className="mt-3">
                              <Notice tone="error">
                                <p>
                                  Hapus periode <strong>{labelPeriode(p)}</strong>? Data nilai yang sudah tersimpan{' '}
                                  <strong>tidak</strong> ikut terhapus. Periode hanya hilang dari daftar pilihan login.
                                </p>
                                <div className="mt-2.5 flex gap-2">
                                  <button
                                    type="button"
                                    className={btnDanger}
                                    onClick={() => void hapus(p.id, labelPeriode(p))}
                                  >
                                    Ya, hapus periode
                                  </button>
                                  <button type="button" className={btnGhost} onClick={() => setKonfirmasiHapus(null)}>
                                    Batal
                                  </button>
                                </div>
                              </Notice>
                            </div>
                          ) : (
                            <div className="mt-3 flex flex-wrap gap-1.5 border-t border-border pt-3">
                              <button type="button" className={btnGhostSm} onClick={() => isiFormDari(p)}>
                                Edit
                              </button>
                              <button type="button" className={btnGhostSm} onClick={() => void toggle(p.id, p.aktif)}>
                                {p.aktif ? 'Nonaktifkan' : 'Aktifkan'}
                              </button>
                              {!isDef && (
                                <button type="button" className={btnGhostSm} onClick={() => void jadiDefault(p.id)}>
                                  Jadikan default
                                </button>
                              )}
                              <span className="flex-1" />
                              <button
                                type="button"
                                className={btnDangerGhostSm}
                                onClick={() => setKonfirmasiHapus(p.id)}
                              >
                                Hapus
                              </button>
                            </div>
                          )}
                        </li>
                      )
                    })}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Form: di samping daftar pada layar lebar, di bawahnya pada layar kecil */}
        <form
          ref={formRef}
          onSubmit={(e) => void simpan(e)}
          className="card-soft space-y-4 p-4 lg:sticky lg:top-20 lg:col-span-2 lg:max-h-[calc(100vh-6.5rem)] lg:overflow-y-auto"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-[14px] font-semibold text-slate-900">
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

          <Field
            label="Tahun ajaran"
            required
            hint={editId ? 'Tahun + semester menentukan ID; tidak bisa diubah.' : undefined}
          >
            <input
              className={inputCls}
              value={tahun}
              onChange={(e) => setTahun(e.target.value)}
              placeholder="2026/2027"
              required
              disabled={!!editId}
            />
          </Field>

          <div>
            <span className="mb-1.5 block text-[12px] font-medium text-slate-700">
              Semester <span className="text-peach-500">*</span>
            </span>
            <Segmented<Semester>
              disabled={!!editId}
              value={semester}
              onChange={setSemester}
              options={[
                { value: '1', label: '1 (Ganjil)' },
                { value: '2', label: '2 (Genap)' },
              ]}
            />
          </div>

          <Field label="Label tampilan (opsional)">
            <input
              className={inputCls}
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder={
                semester === '1' ? `Ganjil ${tahun || '2026/2027'}` : `Genap ${tahun || '2026/2027'}`
              }
            />
          </Field>

          {/* Tanggal rapor: berbeda per semester */}
          <fieldset className="space-y-3 rounded-lg border border-border bg-slate-50/70 p-3.5">
            <legend className="px-1 text-[12px] font-semibold text-slate-700">
              Tanggal rapor · {labelSemester(semester)}
            </legend>
            {semester === '1' ? (
              <Field
                label="Kelas 1–6 (semester 1)"
                hint="Satu tanggal untuk semua kelas di semester ganjil."
              >
                <input
                  className={inputCls}
                  value={tgl1}
                  onChange={(e) => setTgl1(e.target.value)}
                  placeholder="Contoh: 20 Desember 2026"
                />
              </Field>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                <Field label="Kelas 1–5">
                  <input
                    className={inputCls}
                    value={tgl25}
                    onChange={(e) => setTgl25(e.target.value)}
                    placeholder="Contoh: 15 Juni 2027"
                  />
                </Field>
                <Field label="Kelas 6" hint="Biasanya lebih awal (kelulusan).">
                  <input
                    className={inputCls}
                    value={tgl6}
                    onChange={(e) => setTgl6(e.target.value)}
                    placeholder="Contoh: 10 Juni 2027"
                  />
                </Field>
              </div>
            )}
            <Field label="Kota di rapor">
              <input
                className={inputCls}
                value={kota}
                onChange={(e) => setKota(e.target.value)}
                placeholder="Depok"
              />
            </Field>
          </fieldset>

          <div className="space-y-2 text-[13px]">
            <label className="flex items-start gap-2">
              <input
                type="checkbox"
                checked={aktif}
                onChange={(e) => setAktif(e.target.checked)}
                className="mt-0.5 accent-muh-600"
              />
              <span>
                <span className="font-medium text-slate-800">Aktif</span>
                <span className="text-muted"> — bisa dipilih guru saat login</span>
              </span>
            </label>
            <label className="flex items-start gap-2">
              <input
                type="checkbox"
                checked={isDefault}
                onChange={(e) => setIsDefault(e.target.checked)}
                className="mt-0.5 accent-muh-600"
              />
              <span>
                <span className="font-medium text-slate-800">Jadikan default</span>
                <span className="text-muted"> — pilihan awal otomatis</span>
              </span>
            </label>
          </div>

          <div className="flex gap-2">
            <button type="submit" disabled={busy} className={`${btnPrimary} flex-1`}>
              {busy ? 'Menyimpan…' : editId ? 'Simpan perubahan' : 'Tambah periode'}
            </button>
            {editId && (
              <button type="button" onClick={resetForm} className={btnGhost}>
                Batal
              </button>
            )}
          </div>
        </form>
      </div>

      {/* Panduan: satu tempat untuk penjelasan istilah (sebelumnya diulang di ringkasan) */}
      <details className="card-soft group px-4 py-3 text-[12.5px] leading-relaxed text-slate-600">
        <summary className="cursor-pointer select-none text-[13px] font-semibold text-slate-800">
          Cara kerja singkat
        </summary>
        <ol className="mt-2.5 list-decimal space-y-1.5 pl-5">
          <li>
            Buat periode (mis. 2026/2027 semester 1), centang <strong>Aktif</strong> +{' '}
            <strong>Jadikan default</strong>.
          </li>
          <li>
            <strong>Aktif</strong> = bisa dipilih guru saat login. <strong>Default</strong> = pilihan awal
            otomatis, dipakai bila hanya ada satu periode atau guru belum pernah memilih.
          </li>
          <li>
            Periode lama bisa di-<strong>nonaktifkan</strong> agar tidak muncul di login, tanpa menghapus
            data nilai.
          </li>
          <li>
            Ganti default kapan saja lewat <strong>Jadikan default</strong>: periode itu otomatis
            diaktifkan, dan <code className="text-[11px]">config/akademik</code> (tahun ajaran + semester)
            ikut diselaraskan untuk kompatibilitas data lama.
          </li>
        </ol>
      </details>
    </div>
  )
}
