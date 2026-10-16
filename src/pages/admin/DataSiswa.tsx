import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Navigate } from 'react-router-dom'
import type { AppUser } from '../../types/user'
import type { JenjangTahsin, SiswaTahsin } from '../../types/tahsin'
import { SEMUA_KELAS } from '../../types/tahsin'
import { Badge, PageHeader } from '../../components/ui'
import {
  ChipToggle,
  Field,
  Notice,
  Spinner,
  btnGhost,
  btnPrimary,
  inputCls,
  useToast,
} from '../akademik/shared'
import {
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

export default function DataSiswa({ profile }: Props) {
  const [mode, setMode] = useState<Mode>('list')
  const [list, setList] = useState<SiswaTahsin[]>([])
  const [loading, setLoading] = useState(true)
  const [kelasFilter, setKelasFilter] = useState('')
  const [search, setSearch] = useState('')
  const { show: showToast, node: toastNode } = useToast()
  const [busy, setBusy] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<SiswaInput>({ ...emptyForm })
  const [importText, setImportText] = useState('')
  const [preview, setPreview] = useState<HasilPraLihat | null>(null)
  const [sumberImpor, setSumberImpor] = useState('')
  const [progres, setProgres] = useState<string | null>(null)
  const [selected, setSelected] = useState<SiswaTahsin | null>(null)

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
  }, [kelasFilter, showToast])

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

  /** Di layar kecil panel detail berada di bawah tabel: gulir ke sana saat siswa dipilih. */
  const asideRef = useRef<HTMLElement>(null)
  useEffect(() => {
    if (selected && window.matchMedia('(max-width: 1023px)').matches) {
      asideRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [selected])

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
    <div className="space-y-5 pb-16">
      <PageHeader
        back={{ to: '/admin', label: 'Administrasi' }}
        title="Data Siswa"
        subtitle={`Data dasar dan biodata. ID dokumen = NIPD. ${list.length} siswa${
          kelasFilter ? ` di kelas ${kelasFilter}` : ' di semua kelas'
        }.`}
        actions={
          mode === 'list' ? (
            <>
              <button type="button" onClick={handleExport} className={btnGhost}>
                Ekspor CSV
              </button>
              <button type="button" onClick={() => setMode('import')} className={btnGhost}>
                Impor
              </button>
              <button type="button" onClick={openCreate} className={btnPrimary}>
                + Tambah siswa
              </button>
            </>
          ) : (
            <button type="button" onClick={() => setMode('list')} className={btnGhost}>
              ← Kembali ke daftar
            </button>
          )
        }
      />

      {toastNode}

      {/* LIST */}
      {mode === 'list' && (
        <div className="grid items-start gap-5 lg:grid-cols-[1fr_340px]">
          <section className="card-soft p-4" aria-label="Daftar siswa">
            <div className="flex flex-wrap gap-1.5">
              <ChipToggle active={!kelasFilter} onClick={() => setKelasFilter('')}>
                Semua
              </ChipToggle>
              {SEMUA_KELAS.map((k) => (
                <ChipToggle key={k} active={kelasFilter === k} onClick={() => setKelasFilter(k)}>
                  {k}
                </ChipToggle>
              ))}
            </div>

            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari nama, NIPD, NISN, HP, nama ortu…"
              aria-label="Cari siswa"
              className={`${inputCls} mt-3`}
            />

            <div className="mt-3 max-h-[34rem] overflow-auto rounded-lg border border-border">
              {loading ? (
                <Spinner />
              ) : filtered.length === 0 ? (
                <p className="p-8 text-center text-[13px] text-muted">
                  Belum ada data. Gunakan menu Impor (Excel Dapodik) atau Tambah manual.
                </p>
              ) : (
                <table className="w-full text-left text-[13px]">
                  <thead className="sticky top-0 z-10 bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-3 py-2.5 font-semibold">Nama</th>
                      <th className="hidden px-3 py-2.5 font-semibold sm:table-cell">NIPD</th>
                      <th className="px-3 py-2.5 font-semibold">Kelas</th>
                      <th className="px-3 py-2.5 font-semibold">JK</th>
                      <th className="px-3 py-2.5 font-semibold">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((siswa) => {
                      const terpilih = selected?.id === siswa.id
                      return (
                        <tr
                          key={siswa.id}
                          tabIndex={0}
                          aria-selected={terpilih}
                          onClick={() => setSelected(siswa)}
                          onKeyDown={(e) => {
                            if (e.target !== e.currentTarget) return
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault()
                              setSelected(siswa)
                            }
                          }}
                          className={`cursor-pointer border-t border-border transition-colors hover:bg-slate-50 focus-visible:bg-slate-50 ${
                            terpilih ? 'bg-muh-50 hover:bg-muh-50' : ''
                          }`}
                        >
                          <td
                            className={`px-3 py-2.5 font-medium text-slate-900 ${
                              terpilih ? 'shadow-[inset_3px_0_0_0_var(--color-muh-600)]' : ''
                            }`}
                          >
                            {siswa.nama}
                          </td>
                          <td className="tabular hidden px-3 py-2.5 text-muted sm:table-cell">
                            {siswa.nipd || siswa.nis || siswa.id}
                          </td>
                          <td className="px-3 py-2.5">{siswa.kelas}</td>
                          <td className="px-3 py-2.5">{siswa.jk || '—'}</td>
                          <td className="px-3 py-2.5">
                            <button
                              type="button"
                              title="Klik untuk mengubah status aktif"
                              onClick={(e) => {
                                e.stopPropagation()
                                void toggleAktif(siswa)
                              }}
                              className={`rounded px-1.5 py-0.5 text-[11px] font-medium transition hover:ring-1 hover:ring-border ${
                                siswa.aktif !== false
                                  ? 'bg-emerald-50 text-emerald-700'
                                  : 'bg-slate-100 text-slate-600'
                              }`}
                            >
                              {siswa.aktif !== false ? 'Aktif' : 'Nonaktif'}
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              )}
            </div>
            <p className="tabular mt-2 text-[12px] text-muted">{filtered.length} ditampilkan</p>
          </section>

          {/* Detail panel */}
          <aside ref={asideRef} className="card-soft p-4 lg:sticky lg:top-20" aria-label="Detail siswa">
            {!selected ? (
              <p className="text-[13px] leading-relaxed text-muted">
                Pilih baris siswa untuk melihat detail lengkap.
              </p>
            ) : (
              <div className="space-y-4 text-[13px]">
                <div>
                  <div className="text-[15px] font-semibold text-slate-900">{selected.nama}</div>
                  <div className="mt-0.5 text-[12px] text-muted">
                    {selected.kelas} · {selected.jenjang} · NIPD {selected.nipd || selected.id}
                  </div>
                </div>
                <dl className="space-y-2 border-t border-border pt-3">
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
                        <dt className="text-muted">{k}</dt>
                        <dd className="break-words font-medium text-slate-800">{v}</dd>
                      </div>
                    ) : null,
                  )}
                </dl>
                <button type="button" onClick={() => openEdit(selected)} className={`${btnPrimary} w-full`}>
                  Edit data
                </button>
              </div>
            )}
          </aside>
        </div>
      )}

      {/* FORM */}
      {mode === 'form' && (
        <section className="card-soft max-w-5xl p-4 sm:p-5">
          <h2 className="text-[15px] font-semibold text-slate-900">
            {editingId ? 'Edit siswa' : 'Tambah siswa'}
          </h2>
          <form onSubmit={(e) => void handleSave(e)} className="mt-4 space-y-6">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Field label="NIPD" required>
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
              <Field label="Nama" required>
                <input
                  required
                  className={inputCls}
                  value={form.nama || ''}
                  onChange={(e) => setF('nama', e.target.value)}
                />
              </Field>
              <Field label="Kelas" required>
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

            <div className="border-t border-border pt-5">
              <h3 className="mb-3 text-[13px] font-semibold text-slate-900">Alamat</h3>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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

            <div className="border-t border-border pt-5">
              <h3 className="mb-3 text-[13px] font-semibold text-slate-900">Kontak &amp; keluarga</h3>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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

            <div className="flex gap-2 border-t border-border pt-4">
              <button type="submit" disabled={busy} className={btnPrimary}>
                {busy ? 'Menyimpan…' : 'Simpan'}
              </button>
              <button type="button" onClick={() => setMode('list')} className={btnGhost}>
                Batal
              </button>
            </div>
          </form>
        </section>
      )}

      {/* IMPORT */}
      {mode === 'import' && (
        <section className="card-soft max-w-5xl space-y-5 p-4 sm:p-5">
          <div>
            <h2 className="text-[15px] font-semibold text-slate-900">Impor data siswa</h2>
            <p className="mt-1 max-w-3xl text-[12.5px] leading-relaxed text-muted">
              Cocokkan berdasarkan NIPD. Data dasar masuk ke <code>siswa</code>; biodata (alamat, HP, orang
              tua, dll.) masuk ke <code>identitas_siswa</code> yang hanya dapat dibaca admin dan wali kelas.
              Status Aktif, Tamat Iqro, dan Jenjang siswa yang sudah ada tidak diubah oleh impor.
            </p>
          </div>

          <div className="rounded-lg border border-dashed border-muh-300 bg-muh-50/40 p-4">
            <p className="text-[13px] font-semibold text-slate-900">File Excel Dapodik (.xlsx)</p>
            <p className="mt-0.5 text-[12px] leading-relaxed text-muted">
              Ekspor &quot;Daftar Peserta Didik&quot;. File dibaca di browser ini dan tidak diunggah ke mana
              pun; yang tersimpan hanya data siswa di Firestore. Jangan simpan file ini di repo.
            </p>
            <label className={`${btnPrimary} mt-3 inline-flex cursor-pointer items-center`}>
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

          <details className="rounded-lg border border-border p-3.5">
            <summary className="cursor-pointer select-none text-[13px] font-medium text-slate-800">
              Atau tempel teks CSV / TSV
            </summary>
            <p className="mt-2 text-[12px] text-muted">
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
              className={`${inputCls} mt-2 bg-slate-50/50 font-mono text-[12px] focus:bg-white`}
            />
            <div className="mt-2.5 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={busy || !importText.trim()}
                onClick={handlePreview}
                className={btnGhost}
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
                className={btnGhost}
              >
                Unduh template
              </button>
            </div>
          </details>

          {preview && (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2 text-[13px]">
                <span className="font-semibold text-slate-900">Pratinjau dari {sumberImpor}:</span>
                <Badge tone="ok">{preview.baru} baru</Badge>
                <Badge tone="brand">{preview.update} diperbarui</Badge>
                <span
                  className={`inline-flex items-center rounded px-1.5 py-0.5 text-[11px] font-medium ${
                    preview.error ? 'bg-red-50 text-red-700' : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {preview.error} bermasalah
                </span>
              </div>

              <p className="text-[12px] text-muted">
                Per kelas:{' '}
                {Object.entries(preview.perKelas)
                  .sort(([a], [b]) => a.localeCompare(b, 'id'))
                  .map(([k, n]) => `${k} (${n})`)
                  .join(' · ')}
              </p>

              {preview.error > 0 && (
                <Notice tone="error">
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
                </Notice>
              )}

              <div className="max-h-64 overflow-auto rounded-lg border border-border">
                <table className="w-full text-left text-[12.5px]">
                  <thead className="sticky top-0 bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-3 py-2 font-semibold">NIPD</th>
                      <th className="px-3 py-2 font-semibold">Nama</th>
                      <th className="px-3 py-2 font-semibold">Kelas</th>
                      <th className="px-3 py-2 font-semibold">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.items
                      .filter((x) => x.s)
                      .slice(0, 40)
                      .map((x) => (
                        <tr key={x.baris} className="border-t border-border">
                          <td className="tabular px-3 py-1.5 text-muted">{x.s!.id}</td>
                          <td className="px-3 py-1.5">{x.s!.nama}</td>
                          <td className="px-3 py-1.5">{x.s!.kelas}</td>
                          <td className="px-3 py-1.5">
                            {x.status === 'error' ? 'Dilewati' : x.status === 'baru' ? 'Baru' : 'Diperbarui'}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
                {preview.items.length > 40 && (
                  <p className="border-t border-border p-2.5 text-[12px] text-muted">
                    … dan {preview.items.length - 40} baris lainnya
                  </p>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  type="button"
                  disabled={busy || preview.baru + preview.update === 0}
                  onClick={() => void handleImport()}
                  className={btnPrimary}
                >
                  {busy ? `Menyimpan… ${progres ?? ''}` : `Simpan ${preview.baru + preview.update} siswa`}
                </button>
                <button type="button" disabled={busy} onClick={() => setPreview(null)} className={btnGhost}>
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
