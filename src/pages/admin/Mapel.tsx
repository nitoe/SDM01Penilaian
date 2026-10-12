import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { adaMapelTersimpan, getMapelList, hapusMapel, simpanMapel, unggahMapelBawaan } from '../../lib/akademik'
import type { Mapel } from '../../types/akademik'
import type { AppUser } from '../../types/user'

const TINGKATAN = ['1', '2', '3', '4', '5', '6']

interface Props {
  profile: AppUser
}

export default function SetupMapel({ profile }: Props) {
  const [list, setList] = useState<Mapel[]>([])
  const [tersimpan, setTersimpan] = useState(true)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [pesan, setPesan] = useState<string | null>(null)
  const [namaBaru, setNamaBaru] = useState('')
  const [tingkatBaru, setTingkatBaru] = useState<string[]>([...TINGKATAN])

  const muat = useCallback(async () => {
    setLoading(true)
    try {
      const [ada, daftar] = await Promise.all([adaMapelTersimpan(), getMapelList()])
      setTersimpan(ada)
      setList(daftar)
    } catch (e) {
      console.error(e)
      setPesan('Gagal memuat mata pelajaran.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void muat()
  }, [muat])

  if (profile.role !== 'admin') return <Navigate to="/" replace />

  async function pakaiBawaan() {
    setBusy(true)
    setPesan(null)
    try {
      const n = await unggahMapelBawaan()
      setPesan(n ? `${n} mata pelajaran disimpan.` : 'Semua mapel bawaan sudah ada.')
      await muat()
    } catch (e) {
      console.error(e)
      setPesan('Gagal menyimpan daftar mapel.')
    } finally {
      setBusy(false)
    }
  }

  async function ubahTingkat(m: Mapel, t: string) {
    const sekarang = m.tingkatanBerlaku?.length ? [...m.tingkatanBerlaku] : [...TINGKATAN]
    const next = sekarang.includes(t) ? sekarang.filter((x) => x !== t) : [...sekarang, t].sort()
    setBusy(true)
    try {
      await simpanMapel({ ...m, tingkatanBerlaku: next })
      await muat()
    } catch (e) {
      console.error(e)
      setPesan('Gagal mengubah tingkatan.')
    } finally {
      setBusy(false)
    }
  }

  async function tambah(e: FormEvent) {
    e.preventDefault()
    const nama = namaBaru.trim()
    if (nama.length < 2) return
    setBusy(true)
    setPesan(null)
    try {
      if (!tersimpan) await unggahMapelBawaan()
      await simpanMapel({
        id: nama,
        nama,
        urutan: (list.reduce((m, x) => Math.max(m, x.urutan ?? 0), 0) || 0) + 1,
        tingkatanBerlaku: tingkatBaru,
      })
      setNamaBaru('')
      setPesan(`${nama} ditambahkan.`)
      await muat()
    } catch (err) {
      console.error(err)
      setPesan('Gagal menambah mapel.')
    } finally {
      setBusy(false)
    }
  }

  async function hapus(nama: string) {
    if (!window.confirm(`Hapus mata pelajaran “${nama}”? TP yang sudah memakai nama ini tidak ikut terhapus.`)) return
    setBusy(true)
    try {
      await hapusMapel(nama)
      await muat()
    } catch (e) {
      console.error(e)
      setPesan('Gagal menghapus mapel.')
    } finally {
      setBusy(false)
    }
  }

  const field =
    'w-full rounded-xl border border-border bg-white px-3 py-2 text-[13px] outline-none focus:border-muh-500 focus:ring-2 focus:ring-muh-500/15'

  return (
    <div className="space-y-4">
      <div>
        <Link to="/admin" className="text-[11px] font-medium text-muh-700 hover:underline">
          ← Administrasi
        </Link>
        <h1 className="mt-0.5 text-lg font-semibold tracking-tight text-slate-900">Mata Pelajaran</h1>
        <p className="text-[12px] text-muted">
          Dipakai saat mengisi tugas guru bidang studi, dan nanti di Setup TP. Nama mapel menjadi identitasnya.
        </p>
      </div>

      {!tersimpan && !loading && (
        <div className="rounded-xl border border-peach-200 bg-peach-50 px-3 py-3 text-[12px] text-peach-900">
          <p>Belum ada mapel tersimpan. Daftar di bawah adalah bawaan sekolah dan sudah bisa dipilih di form guru.</p>
          <button
            type="button"
            disabled={busy}
            onClick={() => void pakaiBawaan()}
            className="mt-2 rounded-xl bg-muh-600 px-3 py-1.5 text-[12px] font-semibold text-white hover:bg-muh-700 disabled:opacity-60"
          >
            Simpan daftar ini ke sistem
          </button>
        </div>
      )}

      {pesan && <p className="rounded-xl border border-border bg-white px-3 py-2 text-[12px] text-slate-700">{pesan}</p>}

      <section className="card-soft overflow-hidden">
        {loading ? (
          <p className="p-6 text-center text-[12px] text-muted">Memuat…</p>
        ) : (
          <table className="w-full text-left text-[12px]">
            <thead className="bg-slate-50 text-[10px] uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-2 font-semibold">Mapel</th>
                <th className="px-3 py-2 font-semibold">Tingkatan</th>
                <th className="px-3 py-2 font-semibold" />
              </tr>
            </thead>
            <tbody>
              {list.map((m) => (
                <tr key={m.id} className="border-t border-border">
                  <td className="px-3 py-2 font-medium text-slate-900">{m.nama}</td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-1">
                      {TINGKATAN.map((t) => {
                        const aktif = !m.tingkatanBerlaku?.length || m.tingkatanBerlaku.includes(t)
                        return (
                          <button
                            key={t}
                            type="button"
                            disabled={busy || !tersimpan}
                            onClick={() => void ubahTingkat(m, t)}
                            className={`rounded-full px-2 py-0.5 text-[11px] font-semibold disabled:opacity-60 ${
                              aktif ? 'bg-muh-600 text-white' : 'bg-slate-100 text-slate-500'
                            }`}
                          >
                            {t}
                          </button>
                        )
                      })}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-right">
                    {tersimpan && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void hapus(m.nama)}
                        className="text-[11px] font-medium text-red-700 hover:underline disabled:opacity-60"
                      >
                        Hapus
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <form onSubmit={(e) => void tambah(e)} className="card-soft space-y-3 p-4">
        <h2 className="text-[13px] font-semibold text-slate-800">Tambah mata pelajaran</h2>
        <input
          className={field}
          value={namaBaru}
          placeholder="Nama mapel"
          onChange={(e) => setNamaBaru(e.target.value)}
        />
        <div className="flex flex-wrap gap-1">
          {TINGKATAN.map((t) => {
            const aktif = tingkatBaru.includes(t)
            return (
              <button
                key={t}
                type="button"
                onClick={() =>
                  setTingkatBaru((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t].sort()))
                }
                className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                  aktif ? 'bg-muh-600 text-white' : 'bg-slate-100 text-slate-600'
                }`}
              >
                Kelas {t}
              </button>
            )
          })}
        </div>
        <button
          type="submit"
          disabled={busy || namaBaru.trim().length < 2}
          className="rounded-xl bg-muh-600 px-4 py-2 text-[12px] font-semibold text-white hover:bg-muh-700 disabled:opacity-60"
        >
          Tambah
        </button>
      </form>
    </div>
  )
}
