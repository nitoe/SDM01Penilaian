import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import type { AppUser } from '../../types/user'
import type { JenjangTahsin, SiswaTahsin } from '../../types/tahsin'
import { SEMUA_KELAS } from '../../types/tahsin'
import {
import { PageHeader } from '../../components/ui'
  CSV_HEADERS,
  bacaExcel,
  downloadText,
  jalankanImpor,
  listAllSiswa,
  listSiswaLengkap,
  parseDapodikRows,
  parseSiswaText,
  praLihatImpor,
  setSiswaAktif,
  siswaToCsv,
  upsertSiswa,
  validasiLayoutDapodik,
  type HasilPraLihat,
  type SiswaInput,
} from '../../lib/siswaAdmin'

interface Props {
  profile: AppUser
}

type Mode = 'list' | 'form' | 'import'

const emptyForm: SiswaInput = {
  nipd: '',
  nisn: '',
  nama: '',
  kelas: '1A',
  jk: '',
  tempatLahir: '',
  tanggalLahir: '',
  agama: 'Islam',
  alamat: '',
  rt: '',
  rw: '',
  kelurahan: '',
  kecamatan: '',
  kodePos: '',
  hp: '',
  email: '',
  ayahNama: '',
  ayahPekerjaan: '',
  ibuNama: '',
  ibuPekerjaan: '',
  sekolahAsal: '',
  beratBadan: undefined,
  tinggiBadan: undefined,
  jenjang: undefined,
}

function Field({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-medium text-slate-600">{label}</span>
      {children}
    </label>
  )
}

const inputCls =
  'w-full rounded-lg border border-border bg-white px-3 py-2 text-[13px] outline-none focus:border-muh-500 focus:ring-2 focus:ring-muh-500/15'

export default function DataSiswa({ profile }: Props) {
  const [mode, setMode] = useState<Mode>('list')
  const [list, setList] = useState<SiswaTahsin[]>([])
  const [loading, setLoading] = useState(true)
  const [kelasFilter, setKelasFilter] = useState('')
  const [search, setSearch] = useState('')
  const [toast, setToast] = useState<{ msg: string; error?: boolean } | null>(null)
  const [busy, setBusy] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<SiswaInput>({ ...emptyForm })
  const [importText, setImportText] = useState('')
  const [preview, setPreview] = useState<HasilPraLihat | null>(null)
  const [sumberImpor, setSumberImpor] = useState('')
  const [progres, setProgres] = useState<string | null>(null)
  const [selected, setSelected] = useState<SiswaTahsin | null>(null)

  const showToast = (msg: string, error = false) => {
    setToast({ msg, error })
    setTimeout(() => setToast(null), 4000)
  }

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setList(await listSiswaLengkap(kelasFilter || null))
    } catch (e) {
      console.error(e)
      showToast('Gagal memuat data siswa. Periksa rules Firestore.', true)
      setList([])
    } finally {
      setLoading(false)
    }
  }, [kelasFilter])

  useEffect(() => {
    void load()
  }, [load])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return list
    return list.filter((s) => {
      const blob = [
        s.nama,
        s.nis,
        s.nipd,
        s.nisn,
        s.kelas,
        s.hp,
        s.ayahNama,
        s.ibuNama,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return blob.includes(q)
    })
  }, [list, search])

  function openCreate() {
    setEditingId(null)
    setForm({ ...emptyForm })
    setMode('form')
  }

  function openEdit(s: SiswaTahsin) {
    setEditingId(s.id)
    setForm({
      ...emptyForm,
      ...s,
      nipd: s.nipd || s.nis || s.id,
      nisn: s.nisn || '',
      kelas: s.kelas,
      jenjang: s.jenjang,
    })
    setMode('form')
  }

  function setF<K extends keyof SiswaInput>(key: K, value: SiswaInput[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    try {
      await upsertSiswa(form, { hapusKosong: Boolean(editingId) })
      showToast(editingId ? 'Data siswa diperbarui.' : 'Siswa baru disimpan.')
      setMode('list')
      setSelected(null)
      await load()
    } catch (err) {
      console.error(err)
      showToast(err instanceof Error ? err.message : 'Gagal menyimpan.', true)
    } finally {
      setBusy(false)
    }
  }

  /** Peta siswa yang sudah ada (semua kelas, data dasar) untuk menentukan baru/update dan mencegah duplikat. */
  async function petaSiswaAda() {
    return new Map((await listAllSiswa(null)).map((x) => [x.id, x]))
  }

  async function buatPratinjau(rows: SiswaInput[], sumber: string) {
    if (!rows.length) {
      setPreview(null)
      showToast('Tidak ada baris data yang terbaca.', true)
      return
    }
    setBusy(true)
    try {
      setPreview(praLihatImpor(rows, await petaSiswaAda()))
      setSumberImpor(sumber)
    } catch (err) {
      console.error(err)
      showToast('Gagal membandingkan dengan data yang ada. Periksa koneksi dan hak akses.', true)
    } finally {
      setBusy(false)
    }
  }

  function handlePreview() {
    void buatPratinjau(parseSiswaText(importText), 'teks yang ditempel')
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setBusy(true)
    try {
      const rows = await bacaExcel(await file.arrayBuffer())
      validasiLayoutDapodik(rows)
      setBusy(false)
      await buatPratinjau(parseDapodikRows(rows), file.name)
    } catch (err) {
      console.error(err)
      setPreview(null)
      showToast(err instanceof Error ? err.message : 'File tidak dapat dibaca.', true)
    } finally {
      setBusy(false)
    }
  }

  async function handleImport() {
    if (!preview) return
    const n = preview.baru + preview.update
    if (!n) {
      showToast('Tidak ada baris valid untuk disimpan.', true)
      return
    }
    setBusy(true)
    try {
      const selesai = await jalankanImpor(preview.items, (x, total) => setProgres(`${x} dari ${total}`))
      showToast(`${selesai} siswa tersimpan (${preview.baru} baru, ${preview.update} diperbarui).`)
      setPreview(null)
      setImportText('')
      setMode('list')
      await load()
    } catch (err) {
      console.error(err)
      showToast('Impor gagal di tengah jalan. Ulangi: aman, siswa yang sudah tersimpan hanya diperbarui.', true)
    } finally {
      setProgres(null)
      setBusy(false)
    }
  }

  function handleExport() {
    const csv = siswaToCsv(filtered)
    downloadText(`siswa-${kelasFilter || 'semua'}-${new Date().toISOString().slice(0, 10)}.csv`, csv)
    showToast(`Mengekspor ${filtered.length} siswa.`)
  }

  async function toggleAktif(s: SiswaTahsin) {
    try {
      await setSiswaAktif(s.id, !(s.aktif !== false))
      await load()
    } catch {
      showToast('Gagal ubah status.', true)
    }
  }

  if (profile.role !== 'admin') {
    return <Navigate to="/" replace />
  }

  return (
    <div className="space-y-4">
      <PageHeader
        back={{ to: '/admin', label: 'Administrasi' }}
        title="Data Siswa"
        subtitle={`Data dasar + biodata · ID dokumen = NIPD · ${list.length} siswa di filter saat ini`}
        actions={
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => setMode('list')}
            className={`rounded-lg px-3 py-1.5 text-[12px] font-medium ${
              mode === 'list' ? 'bg-muh-600 text-white' : 'border border-border bg-white text-slate-600'
            }`}
          >
            Daftar
          </button>
          <button
            type="button"
            onClick={openCreate}
            className={`rounded-lg px-3 py-1.5 text-[12px] font-medium ${
              mode === 'form' && !editingId
                ? 'bg-muh-600 text-white'
                : 'border border-border bg-white text-slate-600'
            }`}
          >
            Tambah
          </button>
          <button
            type="button"
            onClick={() => setMode('import')}
            className={`rounded-lg px-3 py-1.5 text-[12px] font-medium ${
              mode === 'import'
                ? 'bg-muh-600 text-white'
                : 'border border-border bg-white text-slate-600'
            }`}
          >
            Impor
          </button>
          <button
            type="button"
            onClick={handleExport}
            className="rounded-lg border border-border bg-white px-3 py-1.5 text-[12px] font-medium text-slate-600 hover:bg-slate-50"
          >
            Ekspor CSV
          </button>
        </div>
        }
      />

      {toast && (
        <div
          className={`rounded-lg px-3 py-2 text-[12px] font-medium ${
            toast.error
              ? 'border border-red-200 bg-red-50 text-red-700'
              : 'border border-muh-200 bg-muh-50 text-muh-800'
          }`}
        >
          {toast.msg}
        </div>
      )}

      {/* LIST */}
      {mode === 'list' && (
        <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
          <section className="card-soft p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex max-w-full flex-wrap gap-1">
                <button
                  type="button"
                  onClick={() => setKelasFilter('')}
                  className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                    !kelasFilter ? 'bg-muh-600 text-white' : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  Semua
                </button>
                {SEMUA_KELAS.map((k) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setKelasFilter(k)}
                    className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                      kelasFilter === k ? 'bg-muh-600 text-white' : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {k}
                  </button>
                ))}
              </div>
            </div>

            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari nama, NIPD, NISN, HP, nama ortu…"
              className="mt-3 w-full rounded-lg border border-border bg-slate-50/80 px-3 py-2 text-[13px] outline-none focus:border-muh-500 focus:bg-white focus:ring-2 focus:ring-muh-500/15"
            />

            <div className="mt-3 max-h-[28rem] overflow-auto rounded-lg border border-border">
              {loading ? (
                <p className="p-6 text-center text-[12px] text-muted">Memuat…</p>
              ) : filtered.length === 0 ? (
                <div className="p-6 text-center text-[12px] text-muted">
                  Belum ada data. Gunakan menu Impor (Excel Dapodik) atau Tambah manual.
                </div>
              ) : (
                <table className="w-full text-left text-[12px]">
                  <thead className="sticky top-0 bg-slate-50 text-[10px] uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-3 py-2 font-semibold">Nama</th>
                      <th className="px-3 py-2 font-semibold">NIPD</th>
                      <th className="px-3 py-2 font-semibold">Kelas</th>
                      <th className="px-3 py-2 font-semibold">JK</th>
                      <th className="px-3 py-2 font-semibold">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((s) => (
                      <tr
                        key={s.id}
                        onClick={() => setSelected(s)}
                        className={`cursor-pointer border-t border-border hover:bg-muh-50/40 ${
                          selected?.id === s.id ? 'bg-muh-50/60' : ''
                        }`}
                      >
                        <td className="px-3 py-2 font-medium text-slate-900">{s.nama}</td>
                        <td className="px-3 py-2 font-mono text-[11px] text-muted">
                          {s.nipd || s.nis || s.id}
                        </td>
                        <td className="px-3 py-2">{s.kelas}</td>
                        <td className="px-3 py-2">{s.jk || '—'}</td>
                        <td className="px-3 py-2">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              void toggleAktif(s)
                            }}
                            className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                              s.aktif !== false
                                ? 'bg-muh-50 text-muh-700'
                                : 'bg-slate-100 text-slate-500'
                            }`}
                          >
                            {s.aktif !== false ? 'Aktif' : 'Nonaktif'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
            <p className="mt-2 text-[11px] text-muted">{filtered.length} ditampilkan</p>
          </section>

          {/* Detail panel */}
          <aside className="card-soft h-fit p-4">
            {!selected ? (
              <p className="text-[12px] text-muted">
                Pilih baris siswa untuk melihat detail lengkap.
              </p>
            ) : (
              <div className="space-y-3 text-[12px]">
                <div>
                  <div className="text-[15px] font-semibold text-slate-900">{selected.nama}</div>
                  <div className="text-[11px] text-muted">
                    {selected.kelas} · {selected.jenjang} · NIPD {selected.nipd || selected.id}
                  </div>
                </div>
                <dl className="space-y-1.5 border-t border-border pt-3">
                  {(
                    [
                      ['NISN', selected.nisn],
                      ['JK', selected.jk],
                      ['TTL', [selected.tempatLahir, selected.tanggalLahir].filter(Boolean).join(', ')],
                      ['Agama', selected.agama],
                      ['Alamat', selected.alamat],
                      ['RT/RW', [selected.rt, selected.rw].filter(Boolean).join('/')],
                      ['Kelurahan', selected.kelurahan],
                      ['Kecamatan', selected.kecamatan],
                      ['Kode Pos', selected.kodePos],
                      ['HP', selected.hp],
                      ['Email', selected.email],
                      ['Ayah', [selected.ayahNama, selected.ayahPekerjaan].filter(Boolean).join(' · ')],
                      ['Ibu', [selected.ibuNama, selected.ibuPekerjaan].filter(Boolean).join(' · ')],
                      ['Sekolah asal', selected.sekolahAsal],
                      [
                        'BB/TB',
                        [
                          selected.beratBadan != null ? `${selected.beratBadan} kg` : null,
                          selected.tinggiBadan != null ? `${selected.tinggiBadan} cm` : null,
                        ]
                          .filter(Boolean)
                          .join(' / '),
                      ],
                    ] as [string, string | undefined][]
                  ).map(([k, v]) =>
                    v ? (
                      <div key={k} className="grid grid-cols-[88px_1fr] gap-2">
                        <dt className="text-slate-400">{k}</dt>
                        <dd className="font-medium text-slate-800">{v}</dd>
                      </div>
                    ) : null,
                  )}
                </dl>
                <button
                  type="button"
                  onClick={() => openEdit(selected)}
                  className="w-full rounded-lg bg-muh-600 py-2 text-[12px] font-semibold text-white hover:bg-muh-700"
                >
                  Edit data
                </button>
              </div>
            )}
          </aside>
        </div>
      )}

      {/* FORM */}
      {mode === 'form' && (
        <section className="card-soft p-4">
          <h2 className="text-[14px] font-semibold text-slate-800">
            {editingId ? 'Edit siswa' : 'Tambah siswa'}
          </h2>
          <form onSubmit={(e) => void handleSave(e)} className="mt-3 space-y-4">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <Field label="NIPD *">
                <input
                  required
                  className={inputCls}
                  value={form.nipd || ''}
                  onChange={(e) => setF('nipd', e.target.value)}
                  disabled={Boolean(editingId)}
                />
              </Field>
              <Field label="NISN">
                <input
                  className={inputCls}
                  value={form.nisn || ''}
                  onChange={(e) => setF('nisn', e.target.value)}
                />
              </Field>
              <Field label="Nama *">
                <input
                  required
                  className={inputCls}
                  value={form.nama || ''}
                  onChange={(e) => setF('nama', e.target.value)}
                />
              </Field>
              <Field label="Kelas *">
                <select
                  className={inputCls}
                  value={form.kelas || '1A'}
                  onChange={(e) => setF('kelas', e.target.value)}
                >
                  {SEMUA_KELAS.map((k) => (
                    <option key={k} value={k}>
                      {k}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Jenjang">
                <select
                  className={inputCls}
                  value={form.jenjang || ''}
                  onChange={(e) =>
                    setF('jenjang', (e.target.value || undefined) as JenjangTahsin | undefined)
                  }
                >
                  <option value="">Otomatis dari kelas</option>
                  <option value="iqro">Iqro</option>
                  <option value="quran">Al-Qur&apos;an</option>
                </select>
              </Field>
              <Field label="Jenis kelamin">
                <select
                  className={inputCls}
                  value={form.jk || ''}
                  onChange={(e) => setF('jk', e.target.value)}
                >
                  <option value="">—</option>
                  <option value="L">Laki-laki</option>
                  <option value="P">Perempuan</option>
                </select>
              </Field>
              <Field label="Tempat lahir">
                <input
                  className={inputCls}
                  value={form.tempatLahir || ''}
                  onChange={(e) => setF('tempatLahir', e.target.value)}
                />
              </Field>
              <Field label="Tanggal lahir">
                <input
                  type="date"
                  className={inputCls}
                  value={form.tanggalLahir || ''}
                  onChange={(e) => setF('tanggalLahir', e.target.value)}
                />
              </Field>
              <Field label="Agama">
                <input
                  className={inputCls}
                  value={form.agama || ''}
                  onChange={(e) => setF('agama', e.target.value)}
                />
              </Field>
            </div>

            <div>
              <h3 className="mb-2 text-[12px] font-semibold text-slate-700">Alamat</h3>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <div className="sm:col-span-2 lg:col-span-3">
                  <Field label="Alamat">
                    <input
                      className={inputCls}
                      value={form.alamat || ''}
                      onChange={(e) => setF('alamat', e.target.value)}
                    />
                  </Field>
                </div>
                <Field label="RT">
                  <input className={inputCls} value={form.rt || ''} onChange={(e) => setF('rt', e.target.value)} />
                </Field>
                <Field label="RW">
                  <input className={inputCls} value={form.rw || ''} onChange={(e) => setF('rw', e.target.value)} />
                </Field>
                <Field label="Kelurahan">
                  <input
                    className={inputCls}
                    value={form.kelurahan || ''}
                    onChange={(e) => setF('kelurahan', e.target.value)}
                  />
                </Field>
                <Field label="Kecamatan">
                  <input
                    className={inputCls}
                    value={form.kecamatan || ''}
                    onChange={(e) => setF('kecamatan', e.target.value)}
                  />
                </Field>
                <Field label="Kode pos">
                  <input
                    className={inputCls}
                    value={form.kodePos || ''}
                    onChange={(e) => setF('kodePos', e.target.value)}
                  />
                </Field>
              </div>
            </div>

            <div>
              <h3 className="mb-2 text-[12px] font-semibold text-slate-700">Kontak & keluarga</h3>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <Field label="HP">
                  <input className={inputCls} value={form.hp || ''} onChange={(e) => setF('hp', e.target.value)} />
                </Field>
                <Field label="Email">
                  <input
                    className={inputCls}
                    value={form.email || ''}
                    onChange={(e) => setF('email', e.target.value)}
                  />
                </Field>
                <Field label="Sekolah asal">
                  <input
                    className={inputCls}
                    value={form.sekolahAsal || ''}
                    onChange={(e) => setF('sekolahAsal', e.target.value)}
                  />
                </Field>
                <Field label="Nama ayah">
                  <input
                    className={inputCls}
                    value={form.ayahNama || ''}
                    onChange={(e) => setF('ayahNama', e.target.value)}
                  />
                </Field>
                <Field label="Pekerjaan ayah">
                  <input
                    className={inputCls}
                    value={form.ayahPekerjaan || ''}
                    onChange={(e) => setF('ayahPekerjaan', e.target.value)}
                  />
                </Field>
                <Field label="Nama ibu">
                  <input
                    className={inputCls}
                    value={form.ibuNama || ''}
                    onChange={(e) => setF('ibuNama', e.target.value)}
                  />
                </Field>
                <Field label="Pekerjaan ibu">
                  <input
                    className={inputCls}
                    value={form.ibuPekerjaan || ''}
                    onChange={(e) => setF('ibuPekerjaan', e.target.value)}
                  />
                </Field>
                <Field label="Berat badan (kg)">
                  <input
                    type="number"
                    step="0.1"
                    className={inputCls}
                    value={form.beratBadan ?? ''}
                    onChange={(e) =>
                      setF('beratBadan', e.target.value === '' ? undefined : Number(e.target.value))
                    }
                  />
                </Field>
                <Field label="Tinggi badan (cm)">
                  <input
                    type="number"
                    step="0.1"
                    className={inputCls}
                    value={form.tinggiBadan ?? ''}
                    onChange={(e) =>
                      setF('tinggiBadan', e.target.value === '' ? undefined : Number(e.target.value))
                    }
                  />
                </Field>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                type="submit"
                disabled={busy}
                className="rounded-lg bg-muh-600 px-4 py-2.5 text-[13px] font-semibold text-white hover:bg-muh-700 disabled:opacity-60"
              >
                {busy ? 'Menyimpan…' : 'Simpan'}
              </button>
              <button
                type="button"
                onClick={() => setMode('list')}
                className="rounded-lg border border-border px-4 py-2.5 text-[13px] font-medium text-slate-600"
              >
                Batal
              </button>
            </div>
          </form>
        </section>
      )}

      {/* IMPORT */}
      {mode === 'import' && (
        <section className="card-soft space-y-4 p-4">
          <div>
            <h2 className="text-[14px] font-semibold text-slate-800">Impor data siswa</h2>
            <p className="mt-1 text-[12px] text-muted">
              Cocokkan berdasarkan NIPD. Data dasar masuk ke <code>siswa</code>; biodata (alamat, HP, orang
              tua, dll.) masuk ke <code>identitas_siswa</code> yang hanya dapat dibaca admin dan wali kelas. Status
              Aktif, Tamat Iqro, dan Jenjang siswa yang sudah ada tidak diubah oleh impor.
            </p>
          </div>

          <div className="rounded-2xl border border-dashed border-muh-300 bg-muh-50/40 p-4">
            <p className="text-[12.5px] font-semibold text-slate-800">File Excel Dapodik (.xlsx)</p>
            <p className="mt-0.5 text-[11.5px] text-muted">
              Ekspor "Daftar Peserta Didik". File dibaca di browser ini dan tidak diunggah ke mana pun; yang
              tersimpan hanya data siswa di Firestore. Jangan simpan file ini di repo.
            </p>
            <label className="mt-3 inline-flex cursor-pointer items-center rounded-lg bg-muh-600 px-3.5 py-2 text-[12px] font-semibold text-white hover:bg-muh-700">
              Pilih file…
              <input
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                disabled={busy}
                onChange={(e) => void handleFile(e)}
              />
            </label>
          </div>

          <details className="rounded-2xl border border-border p-3">
            <summary className="cursor-pointer text-[12px] font-medium text-slate-700">
              Atau tempel teks CSV / TSV
            </summary>
            <p className="mt-2 text-[11.5px] text-muted">
              Header didukung: {CSV_HEADERS.slice(0, 8).join(', ')}, … atau kolom Dapodik.
            </p>
            <textarea
              value={importText}
              onChange={(e) => {
                setImportText(e.target.value)
                setPreview(null)
              }}
              rows={8}
              placeholder={`nipd,nisn,nama,kelas,jk,...`}
              className="mt-2 w-full rounded-lg border border-border bg-slate-50/50 px-3 py-2 font-mono text-[11px] outline-none focus:border-muh-500 focus:bg-white"
            />
            <div className="mt-2 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={busy || !importText.trim()}
                onClick={handlePreview}
                className="rounded-lg border border-border bg-white px-3 py-1.5 text-[12px] font-medium disabled:opacity-50"
              >
                Pratinjau
              </button>
              <button
                type="button"
                onClick={() =>
                  downloadText(
                    'template-siswa.csv',
                    CSV_HEADERS.join(',') +
                      '\n000000001,0000000001,Contoh Siswa,1A,L,Depok,2019-01-01,Islam,,,,,,,,,,,,,,',
                  )
                }
                className="rounded-lg border border-border px-3 py-1.5 text-[12px] font-medium text-slate-600"
              >
                Unduh template
              </button>
            </div>
          </details>

          {preview && (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2 text-[12px]">
                <span className="font-semibold text-slate-800">Pratinjau dari {sumberImpor}:</span>
                <span className="rounded-full bg-muh-50 px-2.5 py-0.5 font-semibold text-muh-700">
                  {preview.baru} baru
                </span>
                <span className="rounded-full bg-sky-50 px-2.5 py-0.5 font-semibold text-sky-700">
                  {preview.update} diperbarui
                </span>
                <span
                  className={`rounded-full px-2.5 py-0.5 font-semibold ${
                    preview.error ? 'bg-red-50 text-red-700' : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  {preview.error} bermasalah
                </span>
              </div>

              <p className="text-[11.5px] text-muted">
                Per kelas:{' '}
                {Object.entries(preview.perKelas)
                  .sort(([a], [b]) => a.localeCompare(b, 'id'))
                  .map(([k, n]) => `${k} (${n})`)
                  .join(' · ')}
              </p>

              {preview.error > 0 && (
                <div className="rounded-2xl border border-red-200 bg-red-50 p-3 text-[11.5px] text-red-800">
                  <p className="font-semibold">Baris ini akan dilewati:</p>
                  <ul className="mt-1 list-disc space-y-0.5 pl-4">
                    {preview.items
                      .filter((x) => x.status === 'error')
                      .slice(0, 20)
                      .map((x) => (
                        <li key={x.baris}>
                          Baris {x.baris}: {x.pesan}
                        </li>
                      ))}
                  </ul>
                </div>
              )}

              <div className="max-h-56 overflow-auto rounded-lg border border-border">
                <table className="w-full text-left text-[11px]">
                  <thead className="sticky top-0 bg-slate-50 text-slate-500">
                    <tr>
                      <th className="px-2 py-1.5">NIPD</th>
                      <th className="px-2 py-1.5">Nama</th>
                      <th className="px-2 py-1.5">Kelas</th>
                      <th className="px-2 py-1.5">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.items
                      .filter((x) => x.s)
                      .slice(0, 40)
                      .map((x) => (
                        <tr key={x.baris} className="border-t border-border">
                          <td className="px-2 py-1 font-mono">{x.s!.id}</td>
                          <td className="px-2 py-1">{x.s!.nama}</td>
                          <td className="px-2 py-1">{x.s!.kelas}</td>
                          <td className="px-2 py-1">
                            {x.status === 'error' ? 'Dilewati' : x.status === 'baru' ? 'Baru' : 'Diperbarui'}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
                {preview.items.length > 40 && (
                  <p className="border-t border-border p-2 text-[11px] text-muted">
                    … dan {preview.items.length - 40} baris lainnya
                  </p>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  disabled={busy || preview.baru + preview.update === 0}
                  onClick={() => void handleImport()}
                  className="rounded-lg bg-muh-600 px-4 py-2 text-[12.5px] font-semibold text-white hover:bg-muh-700 disabled:opacity-60"
                >
                  {busy
                    ? `Menyimpan… ${progres ?? ''}`
                    : `Simpan ${preview.baru + preview.update} siswa`}
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setPreview(null)}
                  className="rounded-lg border border-border px-3 py-2 text-[12px] font-medium text-slate-600"
                >
                  Batal
                </button>
              </div>
            </div>
          )}
        </section>
      )}
    </div>
  )
}