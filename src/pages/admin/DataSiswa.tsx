import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import type { AppUser } from '../../types/user'
import type { JenjangTahsin, SiswaTahsin } from '../../types/tahsin'
import { SEMUA_KELAS } from '../../types/tahsin'
import {
  DEMO_SISWA,
  listAllSiswa,
  parseSiswaText,
  setSiswaAktif,
  upsertSiswa,
  upsertSiswaBatch,
} from '../../lib/siswaAdmin'

interface Props {
  profile: AppUser
}

type Mode = 'list' | 'add' | 'import'

export default function DataSiswa({ profile }: Props) {
  const [mode, setMode] = useState<Mode>('list')
  const [list, setList] = useState<SiswaTahsin[]>([])
  const [loading, setLoading] = useState(true)
  const [kelasFilter, setKelasFilter] = useState<string>('')
  const [search, setSearch] = useState('')
  const [toast, setToast] = useState<{ msg: string; error?: boolean } | null>(null)
  const [busy, setBusy] = useState(false)

  const [nis, setNis] = useState('')
  const [nama, setNama] = useState('')
  const [kelas, setKelas] = useState('1A')
  const [jenjang, setJenjang] = useState<JenjangTahsin | ''>('')

  const [importText, setImportText] = useState(
    'nis,nama,kelas,jenjang\n24257001,Ahmad Fauzi,3B,quran\n24257002,Siti Aisyah,1A,iqro',
  )
  const [importPreview, setImportPreview] = useState<ReturnType<typeof parseSiswaText>>([])

  const showToast = (msg: string, error = false) => {
    setToast({ msg, error })
    setTimeout(() => setToast(null), 3500)
  }

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await listAllSiswa(kelasFilter || null)
      setList(data)
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
    return list.filter(
      (s) =>
        s.nama.toLowerCase().includes(q) ||
        (s.nis && s.nis.includes(q)) ||
        s.kelas.toLowerCase().includes(q),
    )
  }, [list, search])

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    try {
      await upsertSiswa({
        nis,
        nama,
        kelas,
        jenjang: jenjang || undefined,
      })
      showToast(`Siswa ${nama} disimpan.`)
      setNis('')
      setNama('')
      setJenjang('')
      setMode('list')
      await load()
    } catch (err) {
      console.error(err)
      showToast(err instanceof Error ? err.message : 'Gagal menyimpan.', true)
    } finally {
      setBusy(false)
    }
  }

  function handlePreviewImport() {
    try {
      const rows = parseSiswaText(importText)
      setImportPreview(rows)
      if (!rows.length) {
        showToast('Tidak ada baris valid. Format: nis,nama,kelas[,jenjang]', true)
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Parse gagal.', true)
    }
  }

  async function handleImport() {
    const rows = importPreview.length ? importPreview : parseSiswaText(importText)
    if (!rows.length) {
      showToast('Tidak ada data untuk diimpor.', true)
      return
    }
    setBusy(true)
    try {
      const n = await upsertSiswaBatch(rows)
      showToast(`${n} siswa berhasil diimpor/diperbarui.`)
      setMode('list')
      await load()
    } catch (err) {
      console.error(err)
      showToast(err instanceof Error ? err.message : 'Impor gagal.', true)
    } finally {
      setBusy(false)
    }
  }

  async function handleSeedDemo() {
    if (
      !window.confirm('Menulis 6 siswa demo ke Firestore (merge by NIS). Lanjutkan?')
    ) {
      return
    }
    setBusy(true)
    try {
      const n = await upsertSiswaBatch(DEMO_SISWA)
      showToast(`${n} siswa demo tersimpan.`)
      await load()
    } catch (err) {
      console.error(err)
      showToast('Gagal seed demo.', true)
    } finally {
      setBusy(false)
    }
  }

  async function toggleAktif(s: SiswaTahsin) {
    try {
      await setSiswaAktif(s.id, !(s.aktif !== false))
      await load()
    } catch (err) {
      console.error(err)
      showToast('Gagal mengubah status aktif.', true)
    }
  }

  if (profile.role !== 'admin') {
    return <Navigate to="/" replace />
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <Link to="/admin" className="text-[11px] font-medium text-muh-700 hover:underline">
            ← Administrasi
          </Link>
          <h1 className="mt-0.5 text-lg font-semibold tracking-tight text-slate-900">
            Data Siswa
          </h1>
          <p className="text-[12px] text-muted">
            Master data untuk Tahsin & Akademik · Document ID = NIS
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => setMode('list')}
            className={`rounded-xl px-3 py-1.5 text-[12px] font-medium ${
              mode === 'list'
                ? 'bg-muh-600 text-white'
                : 'border border-border bg-white text-slate-600'
            }`}
          >
            Daftar
          </button>
          <button
            type="button"
            onClick={() => setMode('add')}
            className={`rounded-xl px-3 py-1.5 text-[12px] font-medium ${
              mode === 'add'
                ? 'bg-muh-600 text-white'
                : 'border border-border bg-white text-slate-600'
            }`}
          >
            Tambah
          </button>
          <button
            type="button"
            onClick={() => setMode('import')}
            className={`rounded-xl px-3 py-1.5 text-[12px] font-medium ${
              mode === 'import'
                ? 'bg-muh-600 text-white'
                : 'border border-border bg-white text-slate-600'
            }`}
          >
            Impor
          </button>
        </div>
      </div>

      {toast && (
        <div
          className={`rounded-xl px-3 py-2 text-[12px] font-medium ${
            toast.error
              ? 'border border-red-200 bg-red-50 text-red-700'
              : 'border border-muh-200 bg-muh-50 text-muh-800'
          }`}
        >
          {toast.msg}
        </div>
      )}

      {mode === 'list' && (
        <section className="card-soft p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap gap-1">
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
            <button
              type="button"
              disabled={busy}
              onClick={() => void handleSeedDemo()}
              className="rounded-xl border border-dashed border-muh-300 bg-muh-50 px-3 py-1.5 text-[11px] font-semibold text-muh-800 hover:bg-muh-100 disabled:opacity-50"
            >
              Seed 6 siswa demo
            </button>
          </div>

          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari nama / NIS / kelas…"
            className="mt-3 w-full rounded-xl border border-border bg-slate-50/80 px-3 py-2 text-[13px] outline-none focus:border-muh-500 focus:bg-white focus:ring-2 focus:ring-muh-500/15"
          />

          <div className="mt-3 overflow-hidden rounded-xl border border-border">
            {loading ? (
              <p className="p-6 text-center text-[12px] text-muted">Memuat…</p>
            ) : filtered.length === 0 ? (
              <div className="p-6 text-center text-[12px] text-muted">
                Belum ada data siswa.
                <br />
                Gunakan <strong>Tambah</strong>, <strong>Impor</strong>, atau{' '}
                <strong>Seed demo</strong>.
              </div>
            ) : (
              <table className="w-full text-left text-[12px]">
                <thead className="bg-slate-50 text-[10px] uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-3 py-2 font-semibold">Nama</th>
                    <th className="px-3 py-2 font-semibold">NIS</th>
                    <th className="px-3 py-2 font-semibold">Kelas</th>
                    <th className="px-3 py-2 font-semibold">Jenjang</th>
                    <th className="px-3 py-2 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((s) => (
                    <tr key={s.id} className="border-t border-border hover:bg-slate-50/80">
                      <td className="px-3 py-2 font-medium text-slate-900">{s.nama}</td>
                      <td className="px-3 py-2 font-mono text-[11px] text-muted">
                        {s.nis || s.id}
                      </td>
                      <td className="px-3 py-2">{s.kelas}</td>
                      <td className="px-3 py-2 capitalize">{s.jenjang}</td>
                      <td className="px-3 py-2">
                        <button
                          type="button"
                          onClick={() => void toggleAktif(s)}
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
          <p className="mt-2 text-[11px] text-muted">{filtered.length} siswa ditampilkan</p>
        </section>
      )}

      {mode === 'add' && (
        <section className="card-soft max-w-md p-4">
          <h2 className="text-[13px] font-semibold text-slate-800">Tambah siswa</h2>
          <form onSubmit={(e) => void handleAdd(e)} className="mt-3 space-y-2.5">
            <div>
              <label className="mb-1 block text-[11px] font-medium text-slate-600">NIS *</label>
              <input
                required
                value={nis}
                onChange={(e) => setNis(e.target.value)}
                className="w-full rounded-xl border border-border px-3 py-2 text-[13px] outline-none focus:border-muh-500 focus:ring-2 focus:ring-muh-500/15"
                placeholder="24257001"
              />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-medium text-slate-600">Nama *</label>
              <input
                required
                value={nama}
                onChange={(e) => setNama(e.target.value)}
                className="w-full rounded-xl border border-border px-3 py-2 text-[13px] outline-none focus:border-muh-500 focus:ring-2 focus:ring-muh-500/15"
              />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-medium text-slate-600">Kelas *</label>
              <select
                value={kelas}
                onChange={(e) => setKelas(e.target.value)}
                className="w-full rounded-xl border border-border px-3 py-2 text-[13px]"
              >
                {SEMUA_KELAS.map((k) => (
                  <option key={k} value={k}>
                    {k}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-medium text-slate-600">
                Jenjang (opsional)
              </label>
              <select
                value={jenjang}
                onChange={(e) => setJenjang(e.target.value as JenjangTahsin | '')}
                className="w-full rounded-xl border border-border px-3 py-2 text-[13px]"
              >
                <option value="">Otomatis dari kelas (1–2 iqro, 3–6 quran)</option>
                <option value="iqro">Iqro</option>
                <option value="quran">Al-Qur&apos;an</option>
              </select>
            </div>
            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-xl bg-muh-600 py-2.5 text-[13px] font-semibold text-white hover:bg-muh-700 disabled:opacity-60"
            >
              {busy ? 'Menyimpan…' : 'Simpan'}
            </button>
          </form>
        </section>
      )}

      {mode === 'import' && (
        <section className="card-soft p-4">
          <h2 className="text-[13px] font-semibold text-slate-800">Impor massal</h2>
          <p className="mt-1 text-[12px] text-muted">
            Format CSV/TSV:{' '}
            <code className="rounded bg-slate-100 px-1 font-mono text-[11px]">
              nis,nama,kelas[,jenjang]
            </code>
            . Header opsional. NIS = ID dokumen (upsert).
          </p>
          <textarea
            value={importText}
            onChange={(e) => {
              setImportText(e.target.value)
              setImportPreview([])
            }}
            rows={10}
            className="mt-3 w-full rounded-xl border border-border bg-slate-50/50 px-3 py-2 font-mono text-[12px] outline-none focus:border-muh-500 focus:bg-white focus:ring-2 focus:ring-muh-500/15"
          />
          <div className="mt-2.5 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handlePreviewImport}
              className="rounded-xl border border-border bg-white px-3 py-1.5 text-[12px] font-medium text-slate-700 hover:bg-slate-50"
            >
              Pratinjau
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void handleImport()}
              className="rounded-xl bg-muh-600 px-3 py-1.5 text-[12px] font-semibold text-white hover:bg-muh-700 disabled:opacity-60"
            >
              {busy
                ? 'Mengimpor…'
                : `Impor${importPreview.length ? ` (${importPreview.length})` : ''}`}
            </button>
          </div>
          {importPreview.length > 0 && (
            <div className="mt-3 max-h-48 overflow-auto rounded-xl border border-border">
              <table className="w-full text-left text-[11px]">
                <thead className="bg-slate-50 text-slate-500">
                  <tr>
                    <th className="px-2 py-1.5">NIS</th>
                    <th className="px-2 py-1.5">Nama</th>
                    <th className="px-2 py-1.5">Kelas</th>
                    <th className="px-2 py-1.5">Jenjang</th>
                  </tr>
                </thead>
                <tbody>
                  {importPreview.map((r) => (
                    <tr key={r.nis} className="border-t border-border">
                      <td className="px-2 py-1 font-mono">{r.nis}</td>
                      <td className="px-2 py-1">{r.nama}</td>
                      <td className="px-2 py-1">{r.kelas}</td>
                      <td className="px-2 py-1">{r.jenjang || 'auto'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </div>
  )
}
