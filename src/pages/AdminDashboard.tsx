import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import Tabs, { type TabItem } from '../components/Tabs'
import { Badge, SectionTitle, StatCard } from '../components/ui'
import { usePeriodeAkademik } from '../lib/usePeriodeAkademik'
import {
  adaAkademik,
  adaTahsin,
  hitungSudahBelum,
  ringkasPerKelas,
  type BarisPasangan,
  type MetrikKelas,
  type RingkasGuru,
} from '../lib/monitoringAdminRumus'
import { hitungBaru } from '../lib/notifikasi'
import { muatPantauanAdmin, type PantauanAdmin } from '../lib/monitoringAdmin'
import { namaDenganGelar } from '../types/user'

type TabId = 'ringkasan' | 'tp' | 'bobot' | 'nilai' | 'tahsin'
type Saring = 'belum' | 'semua'

const JAM = new Intl.DateTimeFormat('id-ID', { hour: '2-digit', minute: '2-digit' })

const url = (dasar: string, p: { mapel: string; kelas: string }) =>
  `${dasar}?mapel=${encodeURIComponent(p.mapel)}&kelas=${encodeURIComponent(p.kelas)}`

/** Aturan "perlu perhatian" per tab, dipakai untuk saring dan hitungan. */
const BELUM: Record<'tp' | 'bobot' | 'nilai', (r: RingkasGuru) => number> = {
  tp: (r) => r.tpBelum,
  bobot: (r) => r.bobotBelum + r.bobotTidak100,
  nilai: (r) => r.nilaiBelum + r.nilaiSebagian,
}

function labelStatus(jenis: 'tp' | 'bobot' | 'nilai', b: BarisPasangan): { teks: string; tone: 'green' | 'peach' | 'neutral' } {
  if (jenis === 'tp') {
    return b.tp.statusTp === 'belum_tp'
      ? { teks: 'Belum ada TP', tone: 'peach' }
      : { teks: `${b.tp.jumlahTp} TP`, tone: 'green' }
  }
  if (jenis === 'bobot') {
    if (b.tp.status === 'belum_tp') return { teks: 'Belum ada TP', tone: 'neutral' }
    if (b.tp.status === 'belum_bobot') return { teks: 'Belum diatur', tone: 'peach' }
    if (b.tp.status === 'tidak_100') return { teks: `Total ${b.tp.totalBobot}%`, tone: 'peach' }
    return { teks: 'Total 100%', tone: 'green' }
  }
  if (b.nilai === 'tanpa_tp') return { teks: 'Belum ada TP semester ini', tone: 'neutral' }
  if (b.nilai === 'belum') return { teks: 'Belum ada nilai', tone: 'peach' }
  if (b.nilai === 'sebagian') return { teks: `Sebagian (${b.terisi}/${b.diharapkan})`, tone: 'peach' }
  return { teks: 'Lengkap', tone: 'green' }
}

function perluPerhatian(jenis: 'tp' | 'bobot' | 'nilai', b: BarisPasangan): boolean {
  if (jenis === 'tp') return b.tp.statusTp === 'belum_tp'
  if (jenis === 'bobot') return b.tp.status === 'belum_bobot' || b.tp.status === 'tidak_100'
  return b.nilai === 'belum' || b.nilai === 'sebagian'
}

function TabelGuru({
  jenis,
  perGuru,
  tautan,
  uid,
}: {
  jenis: 'tp' | 'bobot' | 'nilai'
  perGuru: RingkasGuru[]
  tautan: string
  /** Guru terpilih di dropdown; kosong = semua guru */
  uid: string
}) {
  const [saring, setSaring] = useState<Saring>('belum')
  const [buka, setBuka] = useState<string | null>(null)

  const tampil = useMemo(
    () =>
      perGuru
        .filter((r) => (uid ? r.guru.uid === uid : saring === 'semua' || BELUM[jenis](r) > 0))
        .sort((a, b) => BELUM[jenis](b) - BELUM[jenis](a) || a.guru.nama.localeCompare(b.guru.nama, 'id')),
    [perGuru, saring, uid, jenis],
  )

  const chip = (id: Saring, teks: string) => (
    <button
      type="button"
      aria-pressed={saring === id}
      onClick={() => setSaring(id)}
      className={`rounded-full px-3 py-1 text-[12px] font-medium ${
        saring === id ? 'bg-muh-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
      }`}
    >
      {teks}
    </button>
  )

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {chip('belum', uid ? 'Yang perlu perhatian' : 'Perlu perhatian')}
        {chip('semua', uid ? 'Semua mapel×kelas' : 'Semua guru')}
      </div>

      {tampil.length === 0 ? (
        <p className="card-soft p-4 text-[13px] text-muted">
          {uid
            ? 'Guru ini tidak punya mapel×kelas yang menjadi tanggung jawab akademik.'
            : saring === 'belum'
              ? 'Semua guru sudah beres untuk bagian ini.'
              : 'Belum ada guru dengan tanggung jawab akademik.'}
        </p>
      ) : (
        <ul className="space-y-2">
          {tampil.map((r) => {
            const n = BELUM[jenis](r)
            const terbuka = uid ? true : buka === r.guru.uid
            const daftar = r.pasangan.filter((b) => (saring === 'belum' ? perluPerhatian(jenis, b) : true))
            if (uid && daftar.length === 0 && saring === 'belum') {
              return (
                <li key={r.guru.uid} className="card-soft p-4 text-[13px] text-muted">
                  Semua mapel×kelas {namaDenganGelar(r.guru)} sudah beres untuk bagian ini.
                </li>
              )
            }
            return (
              <li key={r.guru.uid} className="card-soft">
                <button
                  type="button"
                  aria-expanded={terbuka}
                  onClick={() => !uid && setBuka(terbuka ? null : r.guru.uid)}
                  className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-[14px] font-semibold text-slate-900">
                      {namaDenganGelar(r.guru)}
                    </span>
                    <span className="block text-[12px] text-muted">
                      {r.guru.waliKelas.length ? `Wali kelas ${r.guru.waliKelas.join(', ')} · ` : ''}
                      {r.jumlah} mapel×kelas
                    </span>
                  </span>
                  {n > 0 ? <Badge tone="peach">{n} belum</Badge> : <Badge tone="green">Beres</Badge>}
                </button>
                {terbuka && (
                  <ul className="divide-y divide-border border-t border-border">
                    {daftar.map((b) => {
                      const st = labelStatus(jenis, b)
                      return (
                        <li key={`${b.mapel}|${b.kelas}`} className="flex items-center justify-between gap-3 px-4 py-2">
                          <span className="min-w-0 text-[13px] text-slate-800">
                            {b.mapel} · {b.kelas}
                            {b.sumber === 'wali' && <span className="text-[11px] text-muted"> (wali kelas)</span>}
                          </span>
                          <span className="flex shrink-0 items-center gap-2">
                            <Badge tone={st.tone}>{st.teks}</Badge>
                            <Link to={url(tautan, b)} className="text-[12px] font-medium text-muh-700 hover:underline">
                              Lihat
                            </Link>
                          </span>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

const METRIK: { id: MetrikKelas; label: string }[] = [
  { id: 'nilai', label: 'Nilai' },
  { id: 'bobot', label: 'Bobot' },
  { id: 'tp', label: 'TP' },
]

/** Kelengkapan per kelas: batang bertumpuk beres / sebagian / belum. Menggantikan grafik jumlah siswa. */
function GrafikKelas({ baris }: { baris: BarisPasangan[] }) {
  const [metrik, setMetrik] = useState<MetrikKelas>('nilai')
  const data = useMemo(() => ringkasPerKelas(baris, metrik), [baris, metrik])
  const ket: Record<MetrikKelas, string> = {
    tp: 'mapel yang sudah punya TP',
    bobot: 'mapel dengan bobot TP total 100%',
    nilai: 'mapel dengan nilai harian lengkap',
  }
  return (
    <section className="card-soft p-4" aria-label="Kelengkapan per kelas">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-[14px] font-semibold text-slate-900">Kelengkapan per kelas</h3>
        <div role="group" aria-label="Pilih ukuran" className="flex gap-1">
          {METRIK.map((m) => (
            <button
              key={m.id}
              type="button"
              aria-pressed={metrik === m.id}
              onClick={() => setMetrik(m.id)}
              className={`rounded-full px-3 py-1 text-[12px] font-medium ${
                metrik === m.id ? 'bg-muh-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>
      {data.length === 0 ? (
        <p className="text-[13px] text-muted">Belum ada data untuk ukuran ini pada semester terpilih.</p>
      ) : (
        <ul className="space-y-1.5">
          {data.map((r) => (
            <li key={r.kelas} className="flex items-center gap-3">
              <span className="w-8 shrink-0 text-[12px] font-medium text-slate-700">{r.kelas}</span>
              <div
                className="flex h-3 flex-1 overflow-hidden rounded-full bg-slate-100"
                role="img"
                aria-label={`${r.kelas}: ${r.beres} beres, ${r.sebagian} sebagian, ${r.belum} belum dari ${r.total}`}
              >
                <div className="bg-muh-600" style={{ width: `${(r.beres / r.total) * 100}%` }} />
                <div className="bg-gold-500" style={{ width: `${(r.sebagian / r.total) * 100}%` }} />
                <div className="bg-slate-300" style={{ width: `${(r.belum / r.total) * 100}%` }} />
              </div>
              <span className="w-14 shrink-0 text-right text-[12px] tabular-nums text-slate-600">
                {r.beres}/{r.total}
              </span>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted">
        <span>Angka: {ket[metrik]}.</span>
        <span className="inline-flex items-center gap-1">
          <i className="h-2 w-2 rounded-full bg-muh-600" /> Beres
        </span>
        <span className="inline-flex items-center gap-1">
          <i className="h-2 w-2 rounded-full bg-gold-500" /> Sebagian / total tidak 100%
        </span>
        <span className="inline-flex items-center gap-1">
          <i className="h-2 w-2 rounded-full bg-slate-300" /> Belum
        </span>
      </p>
    </section>
  )
}

export default function AdminDashboard() {
  const periodeAk = usePeriodeAkademik()
  const [tab, setTab] = useState<TabId>('ringkasan')
  const [data, setData] = useState<PantauanAdmin | null>(null)
  const [muat, setMuat] = useState<'loading' | 'ok' | 'error'>('loading')
  const [uid, setUid] = useState('')
  const [laporanBaru, setLaporanBaru] = useState<number | null>(null)

  const periode = useMemo(
    () => (periodeAk.ready ? { tahunAjaran: periodeAk.tahunAjaran, semester: periodeAk.semester } : null),
    [periodeAk.ready, periodeAk.tahunAjaran, periodeAk.semester],
  )

  const segarkan = useCallback(() => {
    if (!periode) return
    setMuat('loading')
    muatPantauanAdmin(periode)
      .then((d) => {
        setData(d)
        setMuat('ok')
      })
      .catch(() => setMuat('error'))
  }, [periode])

  useEffect(() => {
    segarkan()
  }, [segarkan])

  useEffect(() => {
    hitungBaru()
      .then(setLaporanBaru)
      .catch(() => setLaporanBaru(null))
  }, [])

  // Dropdown guru: semua guru yang punya tanggung jawab akademik atau Tahsin-Tahfizh.
  const opsiGuru = useMemo(() => {
    if (!data) return []
    const adaPasangan = new Set(data.perGuru.map((r) => r.guru.uid))
    return data.guru
      .filter((g) => adaPasangan.has(g.uid) || adaTahsin(g))
      .sort((a, b) => a.nama.localeCompare(b.nama, 'id'))
  }, [data])
  useEffect(() => {
    if (uid && data && !opsiGuru.some((g) => g.uid === uid)) setUid('')
  }, [uid, data, opsiGuru])
  const guruPilihan = data?.guru.find((g) => g.uid === uid) ?? null
  const ringkasGuru = data?.perGuru.find((r) => r.guru.uid === uid) ?? null
  const tahsinGuru = data?.tahsin.find((t) => t.guru.uid === uid) ?? null

  const sb = data ? hitungSudahBelum(data.perGuru) : null
  const tahsinBelum = data ? data.tahsin.filter((t) => t.status === 'belum').length : 0

  const tabs: TabItem[] = [
    { id: 'ringkasan', label: 'Ringkasan' },
    { id: 'tp', label: 'Tujuan Pembelajaran', hitung: sb?.tp.belum },
    { id: 'bobot', label: 'Bobot', hitung: sb?.bobot.belum },
    { id: 'nilai', label: 'Nilai', hitung: sb?.nilai.belum },
    { id: 'tahsin', label: 'Tahsin-Tahfizh', hitung: tahsinBelum },
  ]

  if (!periode) {
    return (
      <div>
        <SectionTitle>Pantauan guru</SectionTitle>
        <p className="card-soft p-4 text-[13px] text-muted">
          Pilih periode akademik dulu (di header) atau buat di Administrasi → Periode Akademik.
        </p>
      </div>
    )
  }

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-2">
        <SectionTitle>Pantauan guru · {periodeAk.label}</SectionTitle>
        <div className="mb-2 flex items-center gap-3 text-[12px] text-muted">
          {data && <span>Dimuat {JAM.format(data.dimuatPada)}</span>}
          <button
            type="button"
            onClick={segarkan}
            disabled={muat === 'loading'}
            className="rounded-lg border border-border bg-white px-3 py-1 font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            {muat === 'loading' ? 'Memuat…' : 'Muat ulang'}
          </button>
        </div>
      </div>

      {muat === 'error' && (
        <p className="card-soft mb-3 p-4 text-[13px] text-red-700">
          Data pantauan belum bisa dimuat. Periksa koneksi, hak akses, dan apakah rules terbaru sudah di-deploy.
        </p>
      )}

      {data && opsiGuru.length > 0 && (
        <label className="mb-3 flex flex-wrap items-center gap-2 text-[12px] font-medium text-slate-600">
          Guru
          <select
            value={uid}
            onChange={(e) => setUid(e.target.value)}
            className="min-w-56 rounded-lg border border-border bg-white px-3 py-1.5 text-[13px] font-normal text-slate-800 outline-none focus:border-muh-500"
          >
            <option value="">Semua guru</option>
            {opsiGuru.map((g) => (
              <option key={g.uid} value={g.uid}>
                {namaDenganGelar(g)}
              </option>
            ))}
          </select>
        </label>
      )}

      <Tabs items={tabs} aktif={tab} onUbah={(id) => setTab(id as TabId)} ariaLabel="Pantauan guru">
        {muat === 'loading' && !data && <div className="card-soft h-32 animate-pulse bg-slate-50" />}

        {data && sb && tab === 'ringkasan' && guruPilihan && (
          <div className="space-y-3">
            {ringkasGuru && (
<div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <StatCard
                label="Mapel×kelas diampu"
                value={String(ringkasGuru?.jumlah ?? 0)}
                hint={guruPilihan.waliKelas.length ? `Wali kelas ${guruPilihan.waliKelas.join(', ')}` : 'Bukan wali kelas'}
                icon="users"
                tone="green"
              />
              <StatCard
                label="Belum ada TP"
                value={String(ringkasGuru?.tpBelum ?? 0)}
                hint="mapel×kelas"
                icon="target"
                tone={ringkasGuru?.tpBelum ? 'peach' : 'green'}
              />
              <StatCard
                label="Bobot belum beres"
                value={String((ringkasGuru?.bobotBelum ?? 0) + (ringkasGuru?.bobotTidak100 ?? 0))}
                hint="belum diatur atau total tidak 100%"
                icon="calendar"
                tone={(ringkasGuru?.bobotBelum ?? 0) + (ringkasGuru?.bobotTidak100 ?? 0) ? 'peach' : 'green'}
              />
              <StatCard
                label="Nilai belum lengkap"
                value={String((ringkasGuru?.nilaiBelum ?? 0) + (ringkasGuru?.nilaiSebagian ?? 0))}
                hint={`${ringkasGuru?.nilaiLengkap ?? 0} sudah lengkap`}
                icon="clipboard"
                tone={(ringkasGuru?.nilaiBelum ?? 0) + (ringkasGuru?.nilaiSebagian ?? 0) ? 'peach' : 'green'}
              />
            </div>
            )}
            {adaAkademik(guruPilihan) && !ringkasGuru && (
              <p className="text-[12px] text-muted">Guru ini belum punya wali kelas atau penugasan mapel.</p>
            )}
            {tahsinGuru && (
              <p className="card-soft p-4 text-[13px] text-slate-700">
                Tahsin-Tahfizh (kelas {tahsinGuru.guru.kelasAmpu.join(', ')}):{' '}
                {tahsinGuru.status === 'sudah'
                  ? `${tahsinGuru.setoran} setoran tercatat pada periode ini.`
                  : 'belum ada setoran tercatat pada periode ini.'}
              </p>
            )}
            <p className="text-[12px] text-muted">
              Buka tab Tujuan Pembelajaran, Bobot, atau Nilai untuk rincian per mapel×kelas guru ini.
            </p>
          </div>
        )}

        {data && sb && tab === 'ringkasan' && !guruPilihan && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <StatCard
                label="TP sudah disusun"
                value={`${sb.tp.sudah}/${sb.total}`}
                hint={`${sb.tp.belum} guru belum lengkap`}
                icon="target"
                tone={sb.tp.belum ? 'peach' : 'green'}
              />
              <StatCard
                label="Bobot sudah diatur"
                value={`${sb.bobot.sudah}/${sb.total}`}
                hint={`${sb.bobot.belum} guru belum beres`}
                icon="calendar"
                tone={sb.bobot.belum ? 'peach' : 'green'}
              />
              <StatCard
                label="Nilai sudah masuk"
                value={`${sb.nilai.sudah}/${sb.total}`}
                hint={`${sb.nilai.belum} guru belum lengkap`}
                icon="clipboard"
                tone={sb.nilai.belum ? 'peach' : 'green'}
              />
              <StatCard
                label="Tahsin-Tahfizh"
                value={`${data.tahsin.length - tahsinBelum}/${data.tahsin.length}`}
                hint={`${tahsinBelum} guru belum ada setoran`}
                icon="quran"
                tone={tahsinBelum ? 'peach' : 'green'}
              />
            </div>
            <GrafikKelas baris={data.semuaPasangan} />
            <p className="text-[12px] text-muted">
              Hitungan per guru: satu guru dianggap beres bila semua mapel×kelas yang menjadi tanggung jawabnya
              beres. Mapel bidang studi menjadi tanggung jawab guru penugasan; mapel lain ke wali kelas.
            </p>

            {(data.tanpaPenanggung.length > 0 || data.menunggu > 0 || (laporanBaru ?? 0) > 0) && (
              <div className="card-soft space-y-2 p-4">
                <h3 className="text-[14px] font-semibold text-slate-900">Perlu ditindaklanjuti admin</h3>
                {(laporanBaru ?? 0) > 0 && (
                  <p className="text-[13px] text-slate-700">
                    {laporanBaru} laporan guru belum ditangani.{' '}
                    <Link to="/notifikasi" className="font-medium text-muh-700 hover:underline">
                      Buka Notifikasi
                    </Link>
                  </p>
                )}
                {data.menunggu > 0 && (
                  <p className="text-[13px] text-slate-700">
                    {data.menunggu} akun guru menunggu persetujuan.{' '}
                    <Link to="/admin/users" className="font-medium text-muh-700 hover:underline">
                      Buka Kelola Akun
                    </Link>
                  </p>
                )}
                {data.tanpaPenanggung.length > 0 && (
                  <p className="text-[13px] text-slate-700">
                    {data.tanpaPenanggung.length} mapel×kelas belum punya guru penanggung jawab (belum ada wali kelas
                    atau penugasan).{' '}
                    <Link to="/admin/users" className="font-medium text-muh-700 hover:underline">
                      Atur di Kelola Akun
                    </Link>
                  </p>
                )}
              </div>
            )}
            {data.peringatan.map((p) => (
              <p key={p} className="text-[12px] text-amber-800">
                {p}
              </p>
            ))}
          </div>
        )}

        {data && tab === 'tp' && <TabelGuru jenis="tp" perGuru={data.perGuru} tautan="/akademik/setup-tp" uid={uid} />}
        {data && tab === 'bobot' && <TabelGuru jenis="bobot" perGuru={data.perGuru} tautan="/akademik/bobot-semester" uid={uid} />}
        {data && tab === 'nilai' && <TabelGuru jenis="nilai" perGuru={data.perGuru} tautan="/akademik/nilai-slm" uid={uid} />}

        {data && tab === 'tahsin' && (
          <div className="space-y-2">
            {(uid ? data.tahsin.filter((t) => t.guru.uid === uid) : data.tahsin).length === 0 ? (
              <p className="card-soft p-4 text-[13px] text-muted">
                {uid ? 'Guru ini tidak memiliki kelas ampu Tahsin-Tahfizh.' : 'Belum ada guru Tahsin-Tahfizh dengan kelas ampu.'}
              </p>
            ) : (
              <ul className="space-y-2">
                {[...data.tahsin]
                  .filter((t) => !uid || t.guru.uid === uid)
                  .sort((a, b) => Number(a.status === 'sudah') - Number(b.status === 'sudah'))
                  .map((t) => (
                    <li key={t.guru.uid} className="card-soft flex items-center justify-between gap-3 px-4 py-3">
                      <span className="min-w-0">
                        <span className="block truncate text-[14px] font-semibold text-slate-900">
                          {namaDenganGelar(t.guru)}
                        </span>
                        <span className="block text-[12px] text-muted">Kelas ampu {t.guru.kelasAmpu.join(', ')}</span>
                      </span>
                      {t.status === 'sudah' ? (
                        <Badge tone="green">{t.setoran} setoran</Badge>
                      ) : (
                        <Badge tone="peach">Belum ada setoran</Badge>
                      )}
                    </li>
                  ))}
              </ul>
            )}
            <p className="text-[12px] text-muted">
              Dihitung dari setoran yang dicatat guru itu pada periode ini.{' '}
              <Link to="/tahsin/riwayat" className="font-medium text-muh-700 hover:underline">
                Lihat riwayat siswa
              </Link>
            </p>
          </div>
        )}
      </Tabs>
    </div>
  )
}
