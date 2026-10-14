import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import type { AppUser } from '../../types/user'
import type { Mapel, Semester, TujuanPembelajaran } from '../../types/akademik'
import {
  getMapelList,
  getTPList,
  normalisasiAlokasiTp,
  normalisasiPersenBobotMapel,
  saveBobotSemesterBatch,
} from '../../lib/akademik'
import { aksesMapelKelas } from '../../lib/aksesAkademik'
import { isAdminRole, isGuruAkademikRole } from '../../lib/roles'
import { PageHeader } from '../../components/ui'
import { BackLink, Notice, NoticeAksesGuru, Spinner, btnGhost, btnPrimary, inputCls, useToast } from './shared'

/** State UI per TP: alokasi bisa 0, 1, atau 2 semester sekaligus. */
interface Baris {
  tp: TujuanPembelajaran
  /** Bobot string per semester; key ada = dialokasikan. */
  bobot: Partial<Record<Semester, string>>
}

const TOLERANSI = 0.5
const SEMS: Semester[] = ['1', '2']

function parseBobot(s: string | undefined): number {
  if (s == null || s.trim() === '') return NaN
  return Number(s)
}

export default function BobotSemester({ profile }: { profile: AppUser }) {
  const [params] = useSearchParams()
  const mapel = params.get('mapel') || ''
  const kelas = (params.get('kelas') || '').toUpperCase()
  const tulis = isGuruAkademikRole(profile.role)
  const admin = isAdminRole(profile.role)
  const [mapelMaster, setMapelMaster] = useState<Mapel[] | null>(null)
  const pilihan = useMemo(
    () => (mapelMaster ? aksesMapelKelas(profile, mapelMaster) : []),
    [profile, mapelMaster],
  )
  const berhak = pilihan.some((p) => p.mapel === mapel && p.kelas === kelas)

  const [baris, setBaris] = useState<Baris[] | null>(null)
  const [kotor, setKotor] = useState(false)
  const [busy, setBusy] = useState(false)
  const { show, node } = useToast()

  useEffect(() => {
    let batal = false
    getMapelList()
      .then((daftar) => {
        if (!batal) setMapelMaster(daftar)
      })
      .catch(() => {
        if (!batal) setMapelMaster([])
      })
    return () => {
      batal = true
    }
  }, [])

  useEffect(() => {
    if (!mapel || !kelas || !berhak) return
    let batal = false
    getTPList(mapel, kelas)
      .then((l) => {
        if (batal) return
        setBaris(
          l.map((tp) => {
            const alokasi = normalisasiAlokasiTp(tp)
            const bobot: Partial<Record<Semester, string>> = {}
            if (alokasi['1'] != null) bobot['1'] = String(alokasi['1'])
            if (alokasi['2'] != null) bobot['2'] = String(alokasi['2'])
            return { tp, bobot }
          }),
        )
        setKotor(false)
      })
      .catch((e) => {
        console.error(e)
        show('Gagal memuat TP.', true)
        setBaris([])
      })
    return () => {
      batal = true
    }
  }, [mapel, kelas, berhak, show])

  if (!tulis && !admin) {
    return (
      <div className="space-y-4">
        <BackLink to="/akademik">Akademik &amp; Rapor</BackLink>
        <NoticeAksesGuru aksi="Bobot semester diatur" role={profile.role} />
      </div>
    )
  }

  if (!mapel || !kelas) {
    return (
      <div className="space-y-5">
        <BackLink to="/akademik">Akademik &amp; Rapor</BackLink>
        <PageHeader
          back={{ to: '/akademik', label: 'Akademik & Rapor' }}
          eyebrow="Akademik"
          title="Bobot Semester TP"
          subtitle="Pilih mata pelajaran dan kelas. Satu TP boleh dipakai di semester 1, semester 2, atau keduanya."
        />
        {mapelMaster === null ? (
          <Spinner />
        ) : pilihan.length === 0 ? (
          <Notice tone="warn">
            Akun ini belum menjadi guru kelas dan belum memiliki mapel bidang studi. Hubungi admin.
          </Notice>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {pilihan.map((p) => (
              <Link
                key={`${p.mapel}-${p.kelas}`}
                to={`/akademik/bobot-semester?mapel=${encodeURIComponent(p.mapel)}&kelas=${encodeURIComponent(p.kelas)}`}
                className="card-soft block p-4 no-underline transition hover:border-muh-300"
              >
                <p className="text-[15px] font-semibold text-slate-900">{p.mapel}</p>
                <p className="mt-1 text-[13px] text-muted">Kelas {p.kelas}</p>
              </Link>
            ))}
          </div>
        )}
      </div>
    )
  }

  if (!berhak) {
    return (
      <div className="space-y-4">
        <BackLink to="/akademik/bobot-semester">Pilih mata pelajaran</BackLink>
        <Notice tone="error">
          Anda tidak memiliki penugasan untuk {mapel} kelas {kelas}.
        </Notice>
      </div>
    )
  }

  /** Isi angka = aktifkan semester itu; kosongkan = cabut dari semester. */
  const setBobotKolom = (id: string, semester: Semester, value: string) => {
    setBaris((prev) => {
      if (!prev) return prev
      return prev.map((r) => {
        if (r.tp.id !== id) return r
        const next = { ...r.bobot }
        if (value.trim() === '') {
          delete next[semester]
        } else {
          next[semester] = value
        }
        return { ...r, bobot: next }
      })
    })
    setKotor(true)
  }

  /** Tombol cepat: masukkan ke semester dengan bobot awal 1. */
  const masukkanKe = (id: string, semester: Semester) => {
    setBaris((prev) => {
      if (!prev) return prev
      return prev.map((r) => {
        if (r.tp.id !== id) return r
        if (r.bobot[semester] != null) return r
        return { ...r, bobot: { ...r.bobot, [semester]: '1' } }
      })
    })
    setKotor(true)
  }

  const totalSemester = (s: Semester) =>
    (baris ?? []).reduce((a, r) => {
      if (r.bobot[s] == null) return a
      const n = parseBobot(r.bobot[s])
      return a + (Number.isFinite(n) ? n : 0)
    }, 0)

  const jumlahTpSemester = (s: Semester) => (baris ?? []).filter((r) => r.bobot[s] != null).length

  function ratakan(s: Semester) {
    if (!baris) return
    const kelompok = baris.filter((r) => r.bobot[s] != null)
    if (!kelompok.length) return
    const hasil = normalisasiPersenBobotMapel(
      kelompok.map((r) => ({
        id: r.tp.id,
        bobotMapel: Number.isFinite(parseBobot(r.bobot[s])) ? parseBobot(r.bobot[s]) : 1,
      })),
    )
    const peta = new Map(hasil.map((h) => [h.id, h.bobotBaru]))
    setBaris(
      baris.map((r) =>
        peta.has(r.tp.id) ? { ...r, bobot: { ...r.bobot, [s]: String(peta.get(r.tp.id)) } } : r,
      ),
    )
    setKotor(true)
  }

  async function simpan() {
    if (!baris) return
    const teralokasi = baris.filter((r) => Object.keys(r.bobot).length > 0)
    for (const r of teralokasi) {
      for (const s of SEMS) {
        if (r.bobot[s] == null) continue
        const n = parseBobot(r.bobot[s])
        if (!Number.isFinite(n) || n < 0 || n > 100) {
          return show(`Persentase harus angka 0–100 (TP ${r.tp.nomorTp}, Semester ${s}).`, true)
        }
      }
    }
    const peringatan: string[] = []
    const belum = baris.filter((r) => Object.keys(r.bobot).length === 0).length
    if (belum) peringatan.push(`${belum} TP belum punya bobot di semester mana pun.`)
    SEMS.forEach((s) => {
      if (jumlahTpSemester(s) > 0 && Math.abs(totalSemester(s) - 100) > TOLERANSI) {
        peringatan.push(`Total Semester ${s} = ${totalSemester(s).toFixed(1)}% (seharusnya 100%).`)
      }
    })
    if (peringatan.length && !window.confirm(`${peringatan.join('\n')}\n\nTetap simpan?`)) return

    setBusy(true)
    try {
      await saveBobotSemesterBatch(
        baris.map((r) => {
          const bps: Partial<Record<Semester, number>> = {}
          SEMS.forEach((s) => {
            if (r.bobot[s] != null) {
              const n = parseBobot(r.bobot[s])
              bps[s] = Number.isFinite(n) ? n : 0
            }
          })
          return { id: r.tp.id, bobotPerSemester: bps }
        }),
      )
      show('Bobot semester berhasil disimpan.')
      setKotor(false)
    } catch (e) {
      console.error(e)
      show('Gagal menyimpan. Periksa koneksi dan hak akses.', true)
    } finally {
      setBusy(false)
    }
  }

  const ringkasan = (s: Semester) => {
    const total = totalSemester(s)
    const n = jumlahTpSemester(s)
    const pas = n === 0 || Math.abs(total - 100) <= TOLERANSI
    const sisa = 100 - total
    return { total, n, pas, sisa }
  }

  const r1 = ringkasan('1')
  const r2 = ringkasan('2')
  const belum = (baris ?? []).filter((r) => Object.keys(r.bobot).length === 0)
  const sudah = (baris ?? []).filter((r) => Object.keys(r.bobot).length > 0)

  return (
    <div className="space-y-5">
      <BackLink to="/akademik/bobot-semester">Pilih mata pelajaran</BackLink>
      <PageHeader
        eyebrow={`Kelas ${kelas}`}
        title={`Bobot Semester — ${mapel}`}
        subtitle={
          tulis
            ? 'Isi angka di kolom Semester 1 dan/atau Semester 2. Total tiap semester sebaiknya 100%.'
            : 'Mode lihat saja. Hanya guru mapel yang dapat mengubah bobot.'
        }
      />

      {baris === null ? (
        <Spinner />
      ) : baris.length === 0 ? (
        <Notice>Belum ada TP. Susun dulu di menu Setup TP &amp; KKTP.</Notice>
      ) : (
        <>
          {/* ===== RINGKASAN BESAR ===== */}
          <div className="grid gap-3 sm:grid-cols-2">
            {(['1', '2'] as Semester[]).map((s) => {
              const r = s === '1' ? r1 : r2
              return (
                <div
                  key={s}
                  className={`rounded-2xl border-2 p-4 ${
                    r.n === 0
                      ? 'border-slate-200 bg-slate-50'
                      : r.pas
                        ? 'border-muh-300 bg-muh-50/40'
                        : 'border-amber-300 bg-amber-50/50'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[16px] font-bold text-slate-900">Semester {s}</p>
                    <p
                      className={`text-[22px] font-bold tabular-nums ${
                        r.n === 0 ? 'text-slate-400' : r.pas ? 'text-muh-700' : 'text-amber-700'
                      }`}
                    >
                      {r.n === 0 ? '—' : `${Math.round(r.total * 10) / 10}%`}
                    </p>
                  </div>
                  <div className="mt-2 h-3 overflow-hidden rounded-full bg-white/80">
                    <div
                      className={`h-full rounded-full transition-all ${
                        r.n === 0 ? 'bg-slate-200' : r.pas ? 'bg-muh-500' : r.total > 100 ? 'bg-rose-400' : 'bg-amber-400'
                      }`}
                      style={{ width: `${Math.min(100, Math.max(0, r.total))}%` }}
                    />
                  </div>
                  <p className="mt-2 text-[13px] leading-snug text-slate-600">
                    {r.n === 0
                      ? 'Belum ada TP di semester ini'
                      : r.pas
                        ? `✓ ${r.n} TP · total sudah 100%`
                        : r.sisa > 0
                          ? `${r.n} TP · masih kurang ${r.sisa.toFixed(1)}% lagi`
                          : `${r.n} TP · kelebihan ${Math.abs(r.sisa).toFixed(1)}%`}
                  </p>
                  {tulis && r.n > 0 && !r.pas && (
                    <button
                      type="button"
                      className={`${btnGhost} mt-2 !px-3 !py-1.5 !text-[13px]`}
                      onClick={() => ratakan(s)}
                    >
                      Ratakan otomatis ke 100%
                    </button>
                  )}
                </div>
              )
            })}
          </div>

          {/* ===== PETUNJUK SINGKAT ===== */}
          <div className="rounded-xl border border-border bg-white px-4 py-3 text-[13.5px] leading-relaxed text-slate-700">
            <p className="font-semibold text-slate-900">Cara mengisi</p>
            <ol className="mt-1.5 list-decimal space-y-1 pl-5">
              <li>
                Ketik angka di kolom <strong>Semester 1</strong> dan/atau <strong>Semester 2</strong>.
              </li>
              <li>
                TP yang sama boleh diisi di <strong>kedua kolom</strong> (dipakai di dua semester).
              </li>
              <li>
                Kolom kosong = TP tidak dipakai di semester itu.
              </li>
              <li>
                Total tiap semester sebaiknya <strong>100%</strong> (lihat kotak hijau di atas).
              </li>
            </ol>
          </div>

          {/* ===== TP BELUM DIISI ===== */}
          {belum.length > 0 && (
            <section className="rounded-2xl border-2 border-amber-200 bg-amber-50/40 p-4">
              <h2 className="text-[16px] font-bold text-slate-900">
                Belum diisi <span className="ml-1 text-[14px] font-semibold text-amber-700">({belum.length} TP)</span>
              </h2>
              <p className="mt-1 text-[13px] text-slate-600">
                Klik tombol di bawah untuk memasukkan TP ke semester, lalu ubah angkanya.
              </p>
              <ul className="mt-3 space-y-3">
                {belum.map((r) => (
                  <li key={r.tp.id} className="rounded-xl border border-amber-200 bg-white p-3.5">
                    <div className="flex gap-3">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-[14px] font-bold text-amber-800">
                        {r.tp.nomorTp}
                      </span>
                      <p className="min-w-0 flex-1 text-[14px] leading-snug text-slate-800">{r.tp.namaTp}</p>
                    </div>
                    {tulis && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button
                          type="button"
                          className="rounded-xl border border-muh-300 bg-muh-50 px-3.5 py-2 text-[13px] font-semibold text-muh-800 hover:bg-muh-100"
                          onClick={() => masukkanKe(r.tp.id, '1')}
                        >
                          + Semester 1
                        </button>
                        <button
                          type="button"
                          className="rounded-xl border border-muh-300 bg-muh-50 px-3.5 py-2 text-[13px] font-semibold text-muh-800 hover:bg-muh-100"
                          onClick={() => masukkanKe(r.tp.id, '2')}
                        >
                          + Semester 2
                        </button>
                        <button
                          type="button"
                          className="rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-[13px] font-semibold text-slate-700 hover:bg-slate-50"
                          onClick={() => {
                            masukkanKe(r.tp.id, '1')
                            // kedua: butuh setTimeout state sequential — lakukan langsung
                            setBaris((prev) => {
                              if (!prev) return prev
                              return prev.map((x) => {
                                if (x.tp.id !== r.tp.id) return x
                                return { ...x, bobot: { '1': x.bobot['1'] ?? '1', '2': '1' } }
                              })
                            })
                            setKotor(true)
                          }}
                        >
                          + Kedua semester
                        </button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* ===== TABEL BOBOT ===== */}
          {sudah.length > 0 && (
            <section className="overflow-hidden rounded-2xl border border-border bg-white">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-slate-50 px-4 py-3">
                <h2 className="text-[16px] font-bold text-slate-900">
                  Bobot TP <span className="ml-1 text-[14px] font-semibold text-slate-500">({sudah.length})</span>
                </h2>
                {tulis && (
                  <div className="flex flex-wrap gap-2">
                    {r1.n > 0 && (
                      <button type="button" className={`${btnGhost} !px-3 !py-1.5 !text-[13px]`} onClick={() => ratakan('1')}>
                        Ratakan Sem 1
                      </button>
                    )}
                    {r2.n > 0 && (
                      <button type="button" className={`${btnGhost} !px-3 !py-1.5 !text-[13px]`} onClick={() => ratakan('2')}>
                        Ratakan Sem 2
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Header kolom — sticky-ish on mobile via sticky top of section */}
              <div className="grid grid-cols-[minmax(0,1fr)_5.5rem_5.5rem] gap-2 border-b border-border bg-slate-50/80 px-3 py-2.5 text-[12px] font-bold uppercase tracking-wide text-slate-500 sm:grid-cols-[minmax(0,1fr)_6.5rem_6.5rem] sm:px-4">
                <span>Tujuan Pembelajaran</span>
                <span className="text-center">Sem 1 (%)</span>
                <span className="text-center">Sem 2 (%)</span>
              </div>

              <ul className="divide-y divide-border">
                {sudah.map((r) => {
                  const dual = r.bobot['1'] != null && r.bobot['2'] != null
                  return (
                    <li
                      key={r.tp.id}
                      className="grid grid-cols-[minmax(0,1fr)_5.5rem_5.5rem] items-center gap-2 px-3 py-3 sm:grid-cols-[minmax(0,1fr)_6.5rem_6.5rem] sm:px-4"
                    >
                      <div className="min-w-0">
                        <div className="flex items-start gap-2">
                          <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-muh-50 text-[12px] font-bold text-muh-700">
                            {r.tp.nomorTp}
                          </span>
                          <div className="min-w-0">
                            <p className="text-[13.5px] leading-snug text-slate-800">{r.tp.namaTp}</p>
                            {dual && (
                              <p className="mt-0.5 text-[11.5px] font-medium text-peach-700">Dipakai di kedua semester</p>
                            )}
                          </div>
                        </div>
                      </div>

                      {SEMS.map((s) => {
                        const aktif = r.bobot[s] != null
                        return (
                          <div key={s} className="flex justify-center">
                            {aktif ? (
                              <input
                                aria-label={`Bobot TP ${r.tp.nomorTp} Semester ${s}`}
                                className={`${inputCls} w-14 text-center text-[15px] font-semibold tabular-nums sm:w-16 ${
                                  !tulis ? 'bg-slate-50' : ''
                                }`}
                                inputMode="decimal"
                                value={r.bobot[s] ?? ''}
                                readOnly={!tulis}
                                onChange={(e) => setBobotKolom(r.tp.id, s, e.target.value)}
                                onBlur={(e) => {
                                  // Jika dikosongkan total, cabut dari semester
                                  if (e.target.value.trim() === '') setBobotKolom(r.tp.id, s, '')
                                }}
                              />
                            ) : tulis ? (
                              <button
                                type="button"
                                title={`Masukkan ke Semester ${s}`}
                                className="flex h-10 w-14 items-center justify-center rounded-lg border border-dashed border-slate-300 text-[18px] text-slate-400 hover:border-muh-400 hover:bg-muh-50 hover:text-muh-700 sm:w-16"
                                onClick={() => masukkanKe(r.tp.id, s)}
                              >
                                +
                              </button>
                            ) : (
                              <span className="text-[13px] text-slate-300">—</span>
                            )}
                          </div>
                        )
                      })}
                    </li>
                  )
                })}
              </ul>

              {/* Footer total */}
              <div className="grid grid-cols-[minmax(0,1fr)_5.5rem_5.5rem] gap-2 border-t-2 border-border bg-slate-50 px-3 py-3 sm:grid-cols-[minmax(0,1fr)_6.5rem_6.5rem] sm:px-4">
                <span className="text-[13px] font-semibold text-slate-700">Total</span>
                {SEMS.map((s) => {
                  const r = s === '1' ? r1 : r2
                  return (
                    <span
                      key={s}
                      className={`text-center text-[15px] font-bold tabular-nums ${
                        r.n === 0 ? 'text-slate-400' : r.pas ? 'text-muh-700' : 'text-amber-700'
                      }`}
                    >
                      {r.n === 0 ? '—' : `${Math.round(r.total * 10) / 10}%`}
                    </span>
                  )
                })}
              </div>
            </section>
          )}

          {tulis && (
            <div className="sticky bottom-16 z-10 flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-white/95 p-3.5 shadow-lg backdrop-blur md:bottom-4">
              <button type="button" className={`${btnPrimary} !px-5 !py-2.5 !text-[15px]`} disabled={busy || !kotor} onClick={() => void simpan()}>
                {busy ? 'Menyimpan…' : 'Simpan bobot'}
              </button>
              {kotor ? (
                <span className="text-[13px] font-medium text-amber-700">Ada perubahan yang belum disimpan</span>
              ) : (
                <span className="text-[13px] text-muted">
                  Sem 1: {r1.n ? `${Math.round(r1.total * 10) / 10}%` : '—'} · Sem 2:{' '}
                  {r2.n ? `${Math.round(r2.total * 10) / 10}%` : '—'}
                </span>
              )}
            </div>
          )}
        </>
      )}
      {node}
    </div>
  )
}
