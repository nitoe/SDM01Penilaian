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
import { HeroBanner } from '../../components/ui'
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
        <HeroBanner
          eyebrow="Akademik"
          title="Bobot Semester TP"
          subtitle="Pilih mata pelajaran dan kelas. Satu TP boleh dialokasikan ke semester 1, 2, atau keduanya."
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
                <p className="text-[14px] font-semibold text-slate-900">{p.mapel}</p>
                <p className="mt-0.5 text-[12px] text-muted">Kelas {p.kelas}</p>
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

  const setAlokasi = (id: string, semester: Semester, aktif: boolean) => {
    setBaris((prev) => {
      if (!prev) return prev
      return prev.map((r) => {
        if (r.tp.id !== id) return r
        const next = { ...r.bobot }
        if (aktif) {
          if (next[semester] == null) next[semester] = '1'
        } else {
          delete next[semester]
        }
        return { ...r, bobot: next }
      })
    })
    setKotor(true)
  }

  const setBobot = (id: string, semester: Semester, value: string) => {
    setBaris((prev) => {
      if (!prev) return prev
      return prev.map((r) => {
        if (r.tp.id !== id) return r
        if (r.bobot[semester] == null) return r
        return { ...r, bobot: { ...r.bobot, [semester]: value } }
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
          return show(`Persentase bobot harus angka 0–100 (TP ${r.tp.nomorTp}, Semester ${s}).`, true)
        }
      }
    }
    const peringatan: string[] = []
    const belum = baris.filter((r) => Object.keys(r.bobot).length === 0).length
    if (belum) peringatan.push(`${belum} TP belum dialokasikan ke semester mana pun (tidak akan disimpan).`)
    SEMS.forEach((s) => {
      if (jumlahTpSemester(s) > 0 && Math.abs(totalSemester(s) - 100) > TOLERANSI) {
        peringatan.push(`Total bobot Semester ${s} = ${totalSemester(s).toFixed(1)}%, bukan 100%.`)
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
      show('Alokasi semester dan bobot TP disimpan.')
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

  const renderProgress = (s: Semester) => {
    const { total, n, pas, sisa } = ringkasan(s)
    const pct = Math.min(100, Math.max(0, total))
    return (
      <div className="flex flex-1 flex-col gap-1.5 rounded-xl border border-border bg-white p-3">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[13px] font-semibold text-slate-800">Semester {s}</span>
          <span
            className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
              n === 0
                ? 'bg-slate-100 text-slate-500'
                : pas
                  ? 'bg-muh-50 text-muh-700'
                  : 'bg-amber-50 text-amber-700'
            }`}
          >
            {n === 0 ? 'kosong' : pas ? `✓ ${total}%` : `⚠ ${total}%`}
          </span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-slate-100">
          <div
            className={`h-full rounded-full transition-all ${
              n === 0 ? 'bg-slate-200' : pas ? 'bg-muh-500' : total > 100 ? 'bg-rose-400' : 'bg-amber-400'
            }`}
            style={{ width: `${pct}%` }}
          />
        </div>
        <p className="text-[11.5px] text-muted">
          {n === 0
            ? 'Belum ada TP'
            : pas
              ? `${n} TP · total tepat 100%`
              : sisa > 0
                ? `${n} TP · sisa ${sisa.toFixed(1)}% lagi ke 100%`
                : `${n} TP · kelebihan ${Math.abs(sisa).toFixed(1)}%`}
        </p>
      </div>
    )
  }

  const renderKartu = (r: Baris) => {
    const dual = r.bobot['1'] != null && r.bobot['2'] != null
    return (
      <li key={r.tp.id} className="rounded-xl border border-border bg-white p-3">
        <div className="flex flex-wrap items-start gap-2">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-muh-50 text-[12px] font-bold text-muh-700">
            {r.tp.nomorTp}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[12.5px] leading-snug text-slate-800">{r.tp.namaTp}</p>
            {dual && (
              <span className="mt-1 inline-block rounded-full bg-peach-50 px-2 py-0.5 text-[10.5px] font-medium text-peach-800">
                Dipakai di kedua semester
              </span>
            )}
          </div>
        </div>
        <div className="mt-2.5 flex flex-wrap gap-2">
          {SEMS.map((s) => {
            const aktif = r.bobot[s] != null
            return (
              <div
                key={s}
                className={`flex items-center gap-1.5 rounded-lg border px-2 py-1.5 ${
                  aktif ? 'border-muh-200 bg-muh-50/60' : 'border-border bg-slate-50'
                }`}
              >
                <label className="flex cursor-pointer items-center gap-1.5 text-[12px] font-medium text-slate-700">
                  <input
                    type="checkbox"
                    className="h-3.5 w-3.5 rounded border-slate-300 text-muh-600 focus:ring-muh-500"
                    checked={aktif}
                    disabled={!tulis}
                    onChange={(e) => setAlokasi(r.tp.id, s, e.target.checked)}
                  />
                  Sem {s}
                </label>
                {aktif && (
                  <label className="flex items-center gap-0.5 text-[12px] text-slate-600">
                    <input
                      aria-label={`Bobot TP ${r.tp.nomorTp} Semester ${s}`}
                      className={`${inputCls} w-14 text-center !py-0.5`}
                      inputMode="decimal"
                      value={r.bobot[s] ?? ''}
                      readOnly={!tulis}
                      onChange={(e) => setBobot(r.tp.id, s, e.target.value)}
                    />
                    %
                  </label>
                )}
              </div>
            )
          })}
        </div>
      </li>
    )
  }

  const belum = (baris ?? []).filter((r) => Object.keys(r.bobot).length === 0)
  const sudah = (baris ?? []).filter((r) => Object.keys(r.bobot).length > 0)

  return (
    <div className="space-y-5">
      <BackLink to="/akademik/bobot-semester">Pilih mata pelajaran</BackLink>
      <HeroBanner
        eyebrow={`Kelas ${kelas}`}
        title={`Bobot Semester TP — ${mapel}`}
        subtitle={
          tulis
            ? 'Centang semester yang memakai TP, lalu atur persentase kontribusi. Satu TP boleh masuk semester 1 dan 2 sekaligus. Total ideal tiap semester = 100%.'
            : 'Mode lihat. Administrator tidak mengubah alokasi atau bobot.'
        }
      />
      {baris === null ? (
        <Spinner />
      ) : baris.length === 0 ? (
        <Notice>Belum ada TP. Susun dulu di menu Setup TP &amp; KKTP.</Notice>
      ) : (
        <>
          {/* Ringkasan live per semester */}
          <div className="flex flex-col gap-2 sm:flex-row">
            {renderProgress('1')}
            {renderProgress('2')}
          </div>

          <Notice>
            Nilai akhir mapel dihitung dari rata-rata tertimbang TP yang sudah bernilai di semester berjalan.
            Mengubah persentase di sini tidak mengubah isi TP maupun nilai siswa yang sudah diinput.
          </Notice>

          {belum.length > 0 && (
            <section className="card-soft space-y-2.5 border-amber-200 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-[14px] font-semibold text-slate-900">Belum dialokasikan</h2>
                <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
                  {belum.length} TP
                </span>
              </div>
              <p className="text-[12px] text-muted">
                Centang semester di bawah tiap TP. TP yang belum dialokasikan tidak ikut dihitung di nilai mapel.
              </p>
              <ul className="space-y-1.5">{belum.map(renderKartu)}</ul>
            </section>
          )}

          {sudah.length > 0 && (
            <section className="card-soft space-y-2.5 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-[14px] font-semibold text-slate-900">Sudah dialokasikan</h2>
                <span className="rounded-full bg-muh-50 px-2 py-0.5 text-[11px] font-semibold text-muh-700">
                  {sudah.length} TP
                </span>
                {tulis && (
                  <div className="ml-auto flex flex-wrap gap-1.5">
                    {SEMS.map((s) =>
                      jumlahTpSemester(s) > 0 ? (
                        <button
                          key={s}
                          type="button"
                          className={`${btnGhost} !px-2.5 !py-1 !text-[12px]`}
                          onClick={() => ratakan(s)}
                        >
                          Ratakan Sem {s} → 100%
                        </button>
                      ) : null,
                    )}
                  </div>
                )}
              </div>
              <ul className="space-y-1.5">{sudah.map(renderKartu)}</ul>
            </section>
          )}

          {tulis && (
            <div className="sticky bottom-16 z-10 flex items-center gap-2 rounded-2xl border border-border bg-white/95 p-3 shadow-lg backdrop-blur md:bottom-4">
              <button type="button" className={btnPrimary} disabled={busy || !kotor} onClick={() => void simpan()}>
                {busy ? 'Menyimpan…' : 'Simpan semua'}
              </button>
              {kotor && <span className="text-[12px] text-amber-700">Ada perubahan yang belum disimpan.</span>}
              {!kotor && baris.length > 0 && (
                <span className="text-[12px] text-muted">
                  Sem 1: {ringkasan('1').total}% · Sem 2: {ringkasan('2').total}%
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
