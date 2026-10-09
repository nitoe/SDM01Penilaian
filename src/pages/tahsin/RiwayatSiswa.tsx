import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import type { AppUser } from '../../types/user'
import type {
  MenulisRecord,
  SetoranRecord,
  SiswaTahsin,
} from '../../types/tahsin'
import {
  JENIS_LABEL,
  SEMUA_KELAS,
  STATUS_LABEL,
  type JenisSetoran,
  type StatusHafalan,
} from '../../types/tahsin'
import {
  formatTanggal,
  getMenulisLog,
  getRiwayatSetoran,
  getSiswaList,
  toMillis,
} from '../../lib/tahsinData'

interface Props {
  profile: AppUser
}

type TabKey = 'membaca' | 'hafalan' | 'tulis' | 'ringkasan'

const TABS: { key: TabKey; label: string }[] = [
  { key: 'membaca', label: 'Membaca' },
  { key: 'hafalan', label: 'Hafalan' },
  { key: 'tulis', label: 'Menulis' },
  { key: 'ringkasan', label: 'Ringkasan' },
]

function initials(nama: string) {
  return nama
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase()
}

function jenisBadge(jenis: JenisSetoran) {
  const map: Record<JenisSetoran, string> = {
    ziyadah: 'bg-emerald-50 text-emerald-700',
    murojaah: 'bg-sky-50 text-sky-700',
    tahsin: 'bg-violet-50 text-violet-700',
  }
  return map[jenis] || 'bg-slate-100 text-slate-600'
}

function statusBadge(status: StatusHafalan | null | undefined) {
  if (!status) return null
  const map: Record<StatusHafalan, string> = {
    lulus: 'bg-muh-50 text-muh-700',
    mengulang: 'bg-amber-50 text-amber-700',
    belum: 'bg-slate-100 text-slate-600',
  }
  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${map[status]}`}>
      {STATUS_LABEL[status]}
    </span>
  )
}

export default function RiwayatSiswa({ profile }: Props) {
  const scope = useMemo(
    () => ({ role: profile.role, kelasAmpu: profile.kelasAmpu }),
    [profile],
  )
  const kelasOptions = useMemo(() => {
    if (profile.role === 'admin') return [...SEMUA_KELAS]
    return profile.kelasAmpu?.length ? profile.kelasAmpu : [...SEMUA_KELAS]
  }, [profile])

  const [kelasFilter, setKelasFilter] = useState(kelasOptions[0] || '1A')
  const [siswaList, setSiswaList] = useState<SiswaTahsin[]>([])
  const [loadingSiswa, setLoadingSiswa] = useState(false)
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<SiswaTahsin | null>(null)
  const [picking, setPicking] = useState(true)

  const [setoran, setSetoran] = useState<SetoranRecord[]>([])
  const [menulis, setMenulis] = useState<MenulisRecord[]>([])
  const [loadingHist, setLoadingHist] = useState(false)
  const [tab, setTab] = useState<TabKey>('membaca')
  const [error, setError] = useState<string | null>(null)

  const loadSiswa = useCallback(async () => {
    setLoadingSiswa(true)
    try {
      setSiswaList(await getSiswaList(kelasFilter, scope))
    } catch (e) {
      console.error(e)
      setSiswaList([])
    } finally {
      setLoadingSiswa(false)
    }
  }, [kelasFilter, scope])

  useEffect(() => {
    void loadSiswa()
  }, [loadSiswa])

  const loadHist = useCallback(async (s: SiswaTahsin) => {
    setLoadingHist(true)
    setError(null)
    try {
      const [r, m] = await Promise.all([
        getRiwayatSetoran(s.id, s.kelas),
        getMenulisLog(s.id, s.kelas),
      ])
      setSetoran(r)
      setMenulis(m)
    } catch (e) {
      console.error(e)
      setError('Gagal memuat riwayat. Periksa koneksi & index Firestore.')
      setSetoran([])
      setMenulis([])
    } finally {
      setLoadingHist(false)
    }
  }, [])

  function selectSiswa(s: SiswaTahsin) {
    setSelected(s)
    setPicking(false)
    setTab('membaca')
    void loadHist(s)
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return siswaList
    return siswaList.filter(
      (s) => s.nama.toLowerCase().includes(q) || (s.nis && s.nis.includes(q)),
    )
  }, [siswaList, search])

  // Tab filters
  const listMembaca = useMemo(
    () =>
      setoran.filter(
        (r) =>
          (r.detailAyat && r.detailAyat.length > 0) ||
          r.detailBacaanIqro ||
          r.jenis === 'tahsin',
      ),
    [setoran],
  )
  const listHafalan = useMemo(
    () => setoran.filter((r) => r.jenis === 'ziyadah' || r.jenis === 'murojaah'),
    [setoran],
  )

  const stats = useMemo(() => {
    const total = setoran.length
    const now = Date.now()
    const d30 = setoran.filter((r) => now - toMillis(r.createdAt) <= 30 * 864e5).length
    const ziyadahLulus = setoran.filter(
      (r) => r.jenis === 'ziyadah' && r.statusHafalan === 'lulus',
    ).length
    const last = setoran[0]?.materi?.label || '—'
    return { total, d30, ziyadahLulus, last }
  }, [setoran])

  function renderSetoranCard(r: SetoranRecord) {
    return (
      <div key={r.id} className="card-soft p-3.5 sm:p-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${jenisBadge(r.jenis)}`}
              >
                {JENIS_LABEL[r.jenis]}
              </span>
              {statusBadge(r.statusHafalan)}
            </div>
            <p className="mt-1.5 text-[13px] font-semibold text-slate-900">
              {r.materi?.label || '—'}
            </p>
            {r.catatan ? (
              <p className="mt-1 text-[12px] text-muted">{r.catatan}</p>
            ) : null}
          </div>
          <div className="text-right text-[11px] text-muted">
            <div>{formatTanggal(r.createdAt)}</div>
            {r.createdByNama ? (
              <div className="mt-0.5 text-[10px]">{r.createdByNama}</div>
            ) : null}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <Link to="/tahsin" className="text-[11px] font-medium text-muh-700 hover:underline">
            ← Tahsin-Tahfizh
          </Link>
          <h1 className="mt-0.5 text-lg font-semibold tracking-tight text-slate-900">
            Riwayat Siswa
          </h1>
          <p className="text-[12px] text-muted">
            Progres membaca, hafalan, dan menulis per siswa
          </p>
        </div>
        {selected && !picking && (
          <button
            type="button"
            onClick={() => setPicking(true)}
            className="rounded-xl border border-border bg-white px-3 py-1.5 text-[12px] font-medium text-slate-600 shadow-sm transition hover:bg-slate-50"
          >
            Ganti siswa
          </button>
        )}
      </div>

      {/* Picker */}
      {(picking || !selected) && (
        <section className="card-soft p-4">
          <h2 className="text-[13px] font-semibold text-slate-800">Pilih siswa</h2>
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {kelasOptions.map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setKelasFilter(k)}
                className={`rounded-full px-2.5 py-1 text-[11px] font-semibold transition ${
                  kelasFilter === k
                    ? 'bg-muh-600 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {k}
              </button>
            ))}
          </div>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari nama atau NIS…"
            className="mt-2.5 w-full rounded-xl border border-border bg-slate-50/80 px-3 py-2 text-[13px] outline-none transition focus:border-muh-500 focus:bg-white focus:ring-2 focus:ring-muh-500/15"
          />
          <div className="mt-2 max-h-56 overflow-y-auto rounded-xl border border-border">
            {loadingSiswa ? (
              <p className="p-4 text-center text-[12px] text-muted">Memuat…</p>
            ) : filtered.length === 0 ? (
              <p className="p-4 text-center text-[12px] text-muted">
                Tidak ada siswa di kelas {kelasFilter}.
              </p>
            ) : (
              filtered.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => selectSiswa(s)}
                  className="flex w-full items-center gap-3 border-b border-border px-3 py-2.5 text-left transition last:border-0 hover:bg-slate-50"
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-muh-100 to-muh-200 text-[11px] font-bold text-muh-800">
                    {initials(s.nama)}
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-[13px] font-semibold text-slate-900">
                      {s.nama}
                    </div>
                    <div className="text-[11px] text-muted">
                      {s.kelas} · {s.jenjang === 'iqro' ? 'Iqro' : "Al-Qur'an"}
                      {s.nis ? ` · ${s.nis}` : ''}
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </section>
      )}

      {/* Selected + history */}
      {selected && !picking && (
        <>
          {/* Student card */}
          <div className="card-soft flex items-center gap-3.5 p-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-muh-600 to-muh-800 text-sm font-bold text-white shadow-sm">
              {initials(selected.nama)}
            </div>
            <div className="min-w-0">
              <div className="truncate text-[15px] font-semibold text-slate-900">
                {selected.nama}
              </div>
              <div className="text-[12px] text-muted">
                Kelas {selected.kelas} ·{' '}
                {selected.jenjang === 'iqro' ? 'Jenjang Iqro' : "Jenjang Al-Qur'an"}
                {selected.nis ? ` · NIS ${selected.nis}` : ''}
              </div>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            {[
              { label: 'Total sesi', value: String(stats.total), tone: 'text-slate-900' },
              { label: '30 hari terakhir', value: String(stats.d30), tone: 'text-sky-700' },
              {
                label: 'Ziyadah lulus',
                value: String(stats.ziyadahLulus),
                tone: 'text-muh-700',
              },
              {
                label: 'Materi terakhir',
                value: stats.last,
                tone: 'text-slate-700',
                small: true,
              },
            ].map((s) => (
              <div key={s.label} className="card-soft px-3.5 py-3">
                <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                  {s.label}
                </div>
                <div
                  className={`mt-1 font-semibold ${s.tone} ${
                    s.small ? 'text-[12px] leading-snug' : 'text-lg'
                  }`}
                >
                  {s.value}
                </div>
              </div>
            ))}
          </div>

          {/* Tabs */}
          <div className="card-soft overflow-hidden">
            <div className="flex gap-1 overflow-x-auto border-b border-border bg-slate-50/80 px-2 pt-2">
              {TABS.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setTab(t.key)}
                  className={`shrink-0 rounded-t-lg px-3.5 py-2 text-[12px] font-semibold transition ${
                    tab === t.key
                      ? 'bg-white text-muh-800 shadow-sm'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <div className="space-y-2.5 p-3 sm:p-4">
              {error && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-[12px] font-medium text-red-700">
                  {error}
                </div>
              )}

              {loadingHist ? (
                <p className="py-8 text-center text-[12px] text-muted">Memuat riwayat…</p>
              ) : tab === 'membaca' ? (
                listMembaca.length === 0 ? (
                  <Empty note="Belum ada sesi membaca / tahsin." />
                ) : (
                  listMembaca.map(renderSetoranCard)
                )
              ) : tab === 'hafalan' ? (
                listHafalan.length === 0 ? (
                  <Empty note="Belum ada sesi ziyadah / muroja'ah." />
                ) : (
                  listHafalan.map(renderSetoranCard)
                )
              ) : tab === 'tulis' ? (
                menulis.length === 0 ? (
                  <Empty note="Belum ada catatan menulis." />
                ) : (
                  menulis.map((m) => (
                    <div key={m.id} className="card-soft border border-border/80 p-3.5">
                      <div className="flex justify-between gap-2">
                        <p className="text-[13px] font-semibold text-slate-900">
                          {(m.materi as { label?: string })?.label ||
                            m.tanggalPeriksa ||
                            'Catatan menulis'}
                        </p>
                        <span className="shrink-0 text-[11px] text-muted">
                          {formatTanggal(m.createdAt)}
                        </span>
                      </div>
                      {m.catatan ? (
                        <p className="mt-1 text-[12px] text-muted">{String(m.catatan)}</p>
                      ) : null}
                    </div>
                  ))
                )
              ) : (
                <Ringkasan
                  selected={selected}
                  setoran={setoran}
                  menulis={menulis}
                  stats={stats}
                />
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function Empty({ note }: { note: string }) {
  return (
    <div className="rounded-xl border border-dashed border-border bg-slate-50/50 py-10 text-center text-[12px] text-muted">
      {note}
    </div>
  )
}

function Ringkasan({
  selected,
  setoran,
  menulis,
  stats,
}: {
  selected: SiswaTahsin
  setoran: SetoranRecord[]
  menulis: MenulisRecord[]
  stats: { total: number; d30: number; ziyadahLulus: number; last: string }
}) {
  const byJenis = {
    ziyadah: setoran.filter((r) => r.jenis === 'ziyadah').length,
    murojaah: setoran.filter((r) => r.jenis === 'murojaah').length,
    tahsin: setoran.filter((r) => r.jenis === 'tahsin').length,
  }

  return (
    <div className="space-y-3">
      <div className="grid gap-2 sm:grid-cols-3">
        {(
          [
            ['Ziyadah', byJenis.ziyadah, 'bg-emerald-50 text-emerald-800'],
            ["Muroja'ah", byJenis.murojaah, 'bg-sky-50 text-sky-800'],
            ['Tahsin', byJenis.tahsin, 'bg-violet-50 text-violet-800'],
          ] as const
        ).map(([label, n, cls]) => (
          <div key={label} className={`rounded-xl px-3.5 py-3 ${cls}`}>
            <div className="text-[10px] font-semibold uppercase tracking-wide opacity-70">
              {label}
            </div>
            <div className="mt-0.5 text-xl font-semibold">{n}</div>
            <div className="text-[10px] opacity-70">sesi</div>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-border bg-slate-50/60 px-3.5 py-3 text-[12px] leading-relaxed text-slate-700">
        <p>
          <strong>{selected.nama}</strong> memiliki{' '}
          <strong>{stats.total}</strong> sesi setoran
          {stats.d30 > 0 ? (
            <>
              , <strong>{stats.d30}</strong> di antaranya dalam 30 hari terakhir
            </>
          ) : null}
          . Ziyadah lulus: <strong>{stats.ziyadahLulus}</strong>. Catatan menulis:{' '}
          <strong>{menulis.length}</strong>.
        </p>
        <p className="mt-1.5 text-muted">
          Materi terakhir: <span className="text-slate-800">{stats.last}</span>
        </p>
      </div>
    </div>
  )
}
