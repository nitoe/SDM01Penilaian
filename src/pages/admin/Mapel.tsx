import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import { adaMapelTersimpan, getMapelList, hapusMapel, simpanMapel, unggahMapelBawaan } from '../../lib/akademik'
import type { Mapel } from '../../types/akademik'
import type { AppUser } from '../../types/user'
import { PageHeader } from '../../components/ui'
import {
  ChipToggle,
  Field,
  Notice,
  Spinner,
  btnDangerGhostSm,
  btnGhostSm,
  btnPrimary,
  btnPrimarySm,
  inputCls,
} from '../akademik/shared'

const TINGKATAN = ['1', '2', '3', '4', '5', '6']

/** Nama yang dipakai daftar lama, bukan seed penilaian-v2. Tidak dihapus otomatis. */
const NAMA_LAMA = new Set([
  'Ilmu Pengetahuan Alam dan Sosial',
  'Pendidikan Jasmani, Olahraga, dan Kesehatan',
  'Tahsin',
  'Tahfizh',
])

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
  const [cari, setCari] = useState('')
  /** Nama mapel yang diminta konfirmasi hapus (inline, bukan window.confirm). */
  const [konfirmasiHapus, setKonfirmasiHapus] = useState<string | null>(null)

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
    setBusy(true)
    setKonfirmasiHapus(null)
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

  const tampil = list.filter((m) => !cari.trim() || m.nama.toLowerCase().includes(cari.trim().toLowerCase()))

  return (
    <div className="space-y-5 pb-16">
      <PageHeader
        back={{ to: '/admin', label: 'Administrasi' }}
        title="Mata Pelajaran"
        subtitle="Dipakai untuk tugas guru bidang studi dan Setup TP. Tahsin dan Tahfizh tidak masuk daftar ini."
      />

      {!tersimpan && !loading && (
        <Notice tone="warn">
          <p>
            Belum ada mapel tersimpan. Daftar di bawah adalah bawaan sekolah dan sudah bisa dipilih di form
            guru.
          </p>
          <button
            type="button"
            disabled={busy}
            onClick={() => void pakaiBawaan()}
            className={`${btnPrimarySm} mt-2.5`}
          >
            Simpan daftar ini ke sistem
          </button>
        </Notice>
      )}

      {tersimpan && !loading && list.some((m) => NAMA_LAMA.has(m.nama)) && (
        <Notice tone="warn">
          Masih ada nama lama (IPAS ditulis panjang, PJOK ditulis panjang, atau Tahsin/Tahfizh). Setup TP
          memakai nama resmi: <strong>IPAS</strong> dan <strong>PJOK</strong>. Tahsin dan Tahfizh bukan mapel
          TP. Tambahkan nama yang belum ada, lalu hapus nama lama hanya jika belum ada TP yang memakai nama
          itu.
        </Notice>
      )}

      {/* Pesan hasil aksi: "Gagal…" = galat, selain itu = sukses */}
      {pesan && <Notice tone={pesan.startsWith('Gagal') ? 'error' : 'ok'}>{pesan}</Notice>}

      <div className="grid items-start gap-5 lg:grid-cols-[1fr_320px]">
        <section aria-label="Daftar mata pelajaran">
          <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <input
              type="search"
              value={cari}
              onChange={(e) => setCari(e.target.value)}
              placeholder="Cari mata pelajaran…"
              aria-label="Cari mata pelajaran"
              className={`${inputCls} sm:max-w-xs`}
            />
            <p className="tabular text-[12px] text-muted">
              {cari.trim() ? `${tampil.length} dari ${list.length} mapel` : `${list.length} mapel`}
            </p>
          </div>

          <div className="card-soft overflow-hidden">
            {loading ? (
              <Spinner />
            ) : tampil.length === 0 ? (
              <p className="p-8 text-center text-[13px] text-muted">
                {cari.trim() ? 'Tidak ada mapel yang cocok.' : 'Belum ada mata pelajaran.'}
              </p>
            ) : (
              <table className="w-full text-left text-[13px]">
                <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-2.5 font-semibold">Mapel</th>
                    <th className="px-4 py-2.5 font-semibold">Berlaku di kelas</th>
                    <th className="w-[1%] px-4 py-2.5" />
                  </tr>
                </thead>
                <tbody>
                  {tampil.map((m) => {
                    const minta = konfirmasiHapus === m.nama
                    return (
                      <tr key={m.id} className="border-t border-border align-top">
                        <td className="px-4 py-3">
                          <div className="font-medium leading-7 text-slate-900">{m.nama}</div>
                          {minta && (
                            <p className="mt-1 max-w-[16rem] text-[12px] leading-snug text-muted">
                              TP yang sudah memakai nama ini tidak ikut terhapus.
                            </p>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-1">
                            {TINGKATAN.map((t) => {
                              const aktif = !m.tingkatanBerlaku?.length || m.tingkatanBerlaku.includes(t)
                              return (
                                <button
                                  key={t}
                                  type="button"
                                  aria-pressed={aktif}
                                  aria-label={`Kelas ${t}${aktif ? ' berlaku' : ' tidak berlaku'}`}
                                  disabled={busy || !tersimpan}
                                  onClick={() => void ubahTingkat(m, t)}
                                  className={`tabular h-7 w-7 rounded-md text-[12px] font-semibold transition disabled:opacity-60 ${
                                    aktif
                                      ? 'bg-muh-600 text-white'
                                      : 'bg-white text-slate-400 ring-1 ring-inset ring-border hover:text-slate-600'
                                  }`}
                                >
                                  {t}
                                </button>
                              )
                            })}
                          </div>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-right">
                          {tersimpan &&
                            (minta ? (
                              <div className="flex justify-end gap-1.5">
                                <button
                                  type="button"
                                  disabled={busy}
                                  onClick={() => void hapus(m.nama)}
                                  className={btnDangerGhostSm}
                                >
                                  Ya, hapus
                                </button>
                                <button type="button" onClick={() => setKonfirmasiHapus(null)} className={btnGhostSm}>
                                  Batal
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() => setKonfirmasiHapus(m.nama)}
                                className="rounded-md px-2 py-1 text-[12px] font-medium leading-5 text-slate-500 transition hover:bg-red-50 hover:text-red-700 disabled:opacity-60"
                              >
                                Hapus
                              </button>
                            ))}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
        </section>

        <form onSubmit={(e) => void tambah(e)} className="card-soft space-y-4 p-4 lg:sticky lg:top-20">
          <h2 className="text-[14px] font-semibold text-slate-900">Tambah mata pelajaran</h2>
          <Field
            label="Nama mapel"
            hint="Nama ini persis yang tersimpan di TP: tulis IPAS dan PJOK, bukan nama panjang."
          >
            <input
              className={inputCls}
              value={namaBaru}
              placeholder="Contoh: Matematika"
              onChange={(e) => setNamaBaru(e.target.value)}
            />
          </Field>
          <div>
            <span className="mb-1.5 block text-[12px] font-medium text-slate-700">Berlaku di kelas</span>
            <div className="flex flex-wrap gap-1.5">
              {TINGKATAN.map((t) => (
                <ChipToggle
                  key={t}
                  active={tingkatBaru.includes(t)}
                  onClick={() =>
                    setTingkatBaru((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t].sort()))
                  }
                >
                  Kelas {t}
                </ChipToggle>
              ))}
            </div>
          </div>
          <button type="submit" disabled={busy || namaBaru.trim().length < 2} className={`${btnPrimary} w-full`}>
            Tambah
          </button>
        </form>
      </div>
    </div>
  )
}
