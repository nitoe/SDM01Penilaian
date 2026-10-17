import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
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
import { Badge, PageHeader } from '../../components/ui'
import { MapelKelasPicker } from '../../components/MapelKelasPicker'
import {
  BackLink,
  Notice,
  NoticeAksesGuru,
  Spinner,
  btnGhost,
  btnGhostSm,
  btnPrimary,
  btnWarn,
  inputSempitCls,
  useToast,
} from './shared'

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
  // Bilah simpan menempel di bawah: notifikasi ditempatkan di atasnya agar tidak menutup tombol Simpan.
  const { show, node } = useToast('bottom-40 md:bottom-24')
  /** Peringatan sebelum simpan (total tidak 100% dsb.), ditampilkan inline, bukan window.confirm. */
  const [peringatanSimpan, setPeringatanSimpan] = useState<string[] | null>(null)

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
        <PageHeader
          back={{ to: '/akademik', label: admin ? 'Pantauan Akademik' : 'Akademik & Rapor' }}
          title={admin ? 'Bobot Tujuan Pembelajaran' : 'Bobot Semester TP'}
          subtitle="Pilih mapel × kelas. Satu TP boleh dipakai di semester 1, 2, atau keduanya."
        />
        <MapelKelasPicker
          pilihan={pilihan}
          loading={mapelMaster === null}
          hrefFor={(m, k) =>
            `/akademik/bobot-semester?mapel=${encodeURIComponent(m)}&kelas=${encodeURIComponent(k)}`
          }
        />
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

  /** Perubahan apa pun membuat peringatan simpan sebelumnya usang: tutup. */
  const tandaiKotor = () => {
    setKotor(true)
    setPeringatanSimpan(null)
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
    tandaiKotor()
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
    tandaiKotor()
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
    tandaiKotor()
  }

  async function simpan(paksa = false) {
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
    if (peringatan.length && !paksa) {
      setPeringatanSimpan(peringatan)
      return
    }

    setPeringatanSimpan(null)
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

  /** Badge keadaan total satu semester: warna hanya untuk arti (hijau = pas, ambar = perlu perhatian). */
  const keadaan = (r: { n: number; pas: boolean; sisa: number }) => {
    if (r.n === 0) return { tone: 'neutral' as const, label: 'Belum ada TP' }
    if (r.pas) return { tone: 'ok' as const, label: 'Total pas 100%' }
    return r.sisa > 0
      ? { tone: 'peach' as const, label: `Kurang ${r.sisa.toFixed(1)}%` }
      : { tone: 'peach' as const, label: `Lebih ${Math.abs(r.sisa).toFixed(1)}%` }
  }

  return (
    <div className="space-y-5">
      <PageHeader
        back={{ to: '/akademik/bobot-semester', label: 'Pilih mata pelajaran' }}
        eyebrow={`Kelas ${kelas}`}
        title={tulis ? `Bobot Semester — ${mapel}` : `Bobot Tujuan Pembelajaran — ${mapel}`}
        subtitle={
          tulis
            ? 'Isi angka di kolom Semester 1 dan/atau Semester 2. Total tiap semester sebaiknya 100%.'
            : 'Mode lihat. Bobot diatur oleh guru kelas dan guru bidang studi; administrator hanya membaca.'
        }
      />

      {baris === null ? (
        <Spinner />
      ) : baris.length === 0 ? (
        <Notice>Belum ada TP. Susun dulu di menu Setup TP &amp; KKTP.</Notice>
      ) : (
        <>
          {/* Ringkasan total per semester */}
          <div className="grid gap-3 sm:grid-cols-2">
            {(['1', '2'] as Semester[]).map((s) => {
              const r = s === '1' ? r1 : r2
              const k = keadaan(r)
              return (
                <div key={s} className="card-soft p-4">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[14px] font-semibold text-slate-900">Semester {s}</p>
                    <Badge tone={k.tone}>{k.label}</Badge>
                  </div>
                  <p
                    className={`tabular mt-1.5 text-[26px] font-semibold leading-tight tracking-tight ${
                      r.n === 0 ? 'text-muted' : r.pas ? 'text-emerald-700' : 'text-amber-700'
                    }`}
                  >
                    {r.n === 0 ? '—' : `${Math.round(r.total * 10) / 10}%`}
                  </p>
                  <div className="mt-2.5 h-2 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className={`h-full rounded-full transition-all ${
                        r.n === 0
                          ? 'bg-slate-200'
                          : r.pas
                            ? 'bg-emerald-500'
                            : r.total > 100
                              ? 'bg-rose-400'
                              : 'bg-amber-400'
                      }`}
                      style={{ width: `${Math.min(100, Math.max(0, r.total))}%` }}
                    />
                  </div>
                  <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2">
                    <p className="text-[12.5px] text-muted">
                      {r.n === 0 ? 'Belum ada TP di semester ini' : `${r.n} TP di semester ini`}
                    </p>
                    {tulis && r.n > 0 && !r.pas && (
                      <button type="button" className={btnGhostSm} onClick={() => ratakan(s)}>
                        Ratakan ke 100%
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          <details className="card-soft px-4 py-3 text-[13px] leading-relaxed text-slate-700">
            <summary className="cursor-pointer select-none text-[13px] font-semibold text-slate-900">
              Cara mengisi
            </summary>
            <ol className="mt-2 list-decimal space-y-1 pl-5">
              <li>
                Ketik angka di kolom <strong>Semester 1</strong> dan/atau <strong>Semester 2</strong>.
              </li>
              <li>
                TP yang sama boleh diisi di <strong>kedua kolom</strong> (dipakai di dua semester).
              </li>
              <li>Kolom kosong = TP tidak dipakai di semester itu.</li>
              <li>
                Total tiap semester sebaiknya <strong>100%</strong> (lihat ringkasan di atas).
              </li>
            </ol>
          </details>

          {/* TP yang belum punya bobot */}
          {belum.length > 0 && (
            <section className="rounded-[var(--radius-card)] border border-amber-200 bg-amber-50/50 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-[14px] font-semibold text-slate-900">Belum diisi</h2>
                <Badge tone="peach">{belum.length} TP</Badge>
              </div>
              <p className="mt-1 text-[12.5px] text-slate-600">
                Masukkan TP ke semester, lalu ubah angkanya di tabel.
              </p>
              <ul className="mt-3 space-y-2.5">
                {belum.map((r) => (
                  <li key={r.tp.id} className="rounded-lg border border-amber-200 bg-white p-3">
                    <div className="flex gap-3">
                      <span className="tabular flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-[13px] font-semibold text-amber-800">
                        {r.tp.nomorTp}
                      </span>
                      <p className="min-w-0 flex-1 text-[13.5px] leading-snug text-slate-800">{r.tp.namaTp}</p>
                    </div>
                    {tulis && (
                      <div className="mt-2.5 flex flex-wrap gap-1.5">
                        <button type="button" className={btnGhostSm} onClick={() => masukkanKe(r.tp.id, '1')}>
                          + Semester 1
                        </button>
                        <button type="button" className={btnGhostSm} onClick={() => masukkanKe(r.tp.id, '2')}>
                          + Semester 2
                        </button>
                        <button
                          type="button"
                          className={btnGhostSm}
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
                            tandaiKotor()
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

          {/* Tabel bobot */}
          {sudah.length > 0 && (
            <section className="card-soft overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-slate-50 px-4 py-3">
                <div className="flex items-center gap-2">
                  <h2 className="text-[14px] font-semibold text-slate-900">Bobot TP</h2>
                  <Badge>{sudah.length}</Badge>
                </div>
                {tulis && (
                  <div className="flex flex-wrap gap-1.5">
                    {r1.n > 0 && (
                      <button type="button" className={btnGhostSm} onClick={() => ratakan('1')}>
                        Ratakan Sem 1
                      </button>
                    )}
                    {r2.n > 0 && (
                      <button type="button" className={btnGhostSm} onClick={() => ratakan('2')}>
                        Ratakan Sem 2
                      </button>
                    )}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-[minmax(0,1fr)_5.5rem_5.5rem] gap-2 border-b border-border bg-slate-50/80 px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500 sm:grid-cols-[minmax(0,1fr)_6.5rem_6.5rem] sm:px-4">
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
                          <span className="tabular mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-muh-50 text-[12px] font-semibold text-muh-700">
                            {r.tp.nomorTp}
                          </span>
                          <div className="min-w-0">
                            <p className="text-[13.5px] leading-snug text-slate-800">{r.tp.namaTp}</p>
                            {dual && <p className="mt-0.5 text-[11.5px] text-muted">Dipakai di kedua semester</p>}
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
                                className={`${inputSempitCls} w-14 text-center text-[14px] font-semibold tabular-nums sm:w-16 ${
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
                                aria-label={`Masukkan TP ${r.tp.nomorTp} ke Semester ${s}`}
                                className="flex h-9 w-14 items-center justify-center rounded-lg border border-dashed border-slate-300 text-[18px] text-slate-500 hover:border-muh-400 hover:bg-muh-50 hover:text-muh-700 sm:w-16"
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

              <div className="grid grid-cols-[minmax(0,1fr)_5.5rem_5.5rem] gap-2 border-t border-border bg-slate-50 px-3 py-3 sm:grid-cols-[minmax(0,1fr)_6.5rem_6.5rem] sm:px-4">
                <span className="text-[13px] font-semibold text-slate-700">Total</span>
                {SEMS.map((s) => {
                  const r = s === '1' ? r1 : r2
                  return (
                    <span
                      key={s}
                      className={`tabular text-center text-[14px] font-semibold ${
                        r.n === 0 ? 'text-muted' : r.pas ? 'text-emerald-700' : 'text-amber-700'
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
            <div className="sticky bottom-16 z-10 space-y-3 rounded-lg border border-border bg-white/95 p-3.5 shadow-md backdrop-blur md:bottom-4">
              {peringatanSimpan && (
                <Notice tone="warn">
                  <p className="font-semibold">Periksa sebelum menyimpan</p>
                  <ul className="mt-1 list-disc space-y-0.5 pl-4">
                    {peringatanSimpan.map((t) => (
                      <li key={t}>{t}</li>
                    ))}
                  </ul>
                  <div className="mt-2.5 flex flex-wrap gap-2">
                    <button type="button" className={btnWarn} disabled={busy} onClick={() => void simpan(true)}>
                      Tetap simpan
                    </button>
                    <button type="button" className={btnGhost} onClick={() => setPeringatanSimpan(null)}>
                      Periksa lagi
                    </button>
                  </div>
                </Notice>
              )}
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  className={btnPrimary}
                  disabled={busy || !kotor}
                  onClick={() => void simpan()}
                >
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
            </div>
          )}
        </>
      )}
      {node}
    </div>
  )
}
