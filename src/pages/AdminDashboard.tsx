import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import Tabs, { type TabItem } from '../components/Tabs'
import { Badge, SectionTitle, StatCard } from '../components/ui'
import { usePeriodeAkademik } from '../lib/usePeriodeAkademik'
import { hitungSudahBelum, type BarisPasangan, type RingkasGuru } from '../lib/monitoringAdminRumus'
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
}: {
  jenis: 'tp' | 'bobot' | 'nilai'
  perGuru: RingkasGuru[]
  tautan: string
}) {
  const [saring, setSaring] = useState<Saring>('belum')
  const [cari, setCari] = useState('')
  const [buka, setBuka] = useState<string | null>(null)

  const tampil = useMemo(
    () =>
      perGuru
        .filter((r) => (saring === 'semua' ? true : BELUM[jenis](r) > 0))
        .filter((r) => r.guru.nama.toLowerCase().includes(cari.trim().toLowerCase()))
        .sort((a, b) => BELUM[jenis](b) - BELUM[jenis](a) || a.guru.nama.localeCompare(b.guru.nama, 'id')),
    [perGuru, saring, cari, jenis],
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
        {chip('belum', 'Perlu perhatian')}
        {chip('semua', 'Semua guru')}
        <input
          value={cari}
          onChange={(e) => setCari(e.target.value)}
          placeholder="Cari nama guru"
          aria-label="Cari nama guru"
          className="ml-auto w-full rounded-lg border border-border bg-white px-3 py-1.5 text-[13px] outline-none focus:border-muh-500 sm:w-56"
        />
      </div>

      {tampil.length === 0 ? (
        <p className="card-soft p-4 text-[13px] text-muted">
          {saring === 'belum' ? 'Semua guru sudah beres untuk bagian ini.' : 'Tidak ada guru yang cocok.'}
        </p>
      ) : (
        <ul className="space-y-2">
          {tampil.map((r) => {
            const n = BELUM[jenis](r)
            const terbuka = buka === r.guru.uid
            const daftar = r.pasangan.filter((b) => (saring === 'belum' ? perluPerhatian(jenis, b) : true))
            return (
              <li key={r.guru.uid} className="card-soft">
                <button
                  type="button"
                  aria-expanded={terbuka}
                  onClick={() => setBuka(terbuka ? null : r.guru.uid)}
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

export default function AdminDashboard() {
  const periodeAk = usePeriodeAkademik()
  const [tab, setTab] = useState<TabId>('ringkasan')
  const [data, setData] = useState<PantauanAdmin | null>(null)
  const [muat, setMuat] = useState<'loading' | 'ok' | 'error'>('loading')

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

      <Tabs items={tabs} aktif={tab} onUbah={(id) => setTab(id as TabId)} ariaLabel="Pantauan guru">
        {muat === 'loading' && !data && <div className="card-soft h-32 animate-pulse bg-slate-50" />}

        {data && sb && tab === 'ringkasan' && (
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
            <p className="text-[12px] text-muted">
              Hitungan per guru: satu guru dianggap beres bila semua mapel×kelas yang menjadi tanggung jawabnya
              beres. Mapel bidang studi menjadi tanggung jawab guru penugasan; mapel lain ke wali kelas.
            </p>

            {(data.tanpaPenanggung.length > 0 || data.menunggu > 0) && (
              <div className="card-soft space-y-2 p-4">
                <h3 className="text-[14px] font-semibold text-slate-900">Perlu ditindaklanjuti admin</h3>
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

        {data && tab === 'tp' && <TabelGuru jenis="tp" perGuru={data.perGuru} tautan="/akademik/setup-tp" />}
        {data && tab === 'bobot' && <TabelGuru jenis="bobot" perGuru={data.perGuru} tautan="/akademik/bobot-semester" />}
        {data && tab === 'nilai' && <TabelGuru jenis="nilai" perGuru={data.perGuru} tautan="/akademik/nilai-slm" />}

        {data && tab === 'tahsin' && (
          <div className="space-y-2">
            {data.tahsin.length === 0 ? (
              <p className="card-soft p-4 text-[13px] text-muted">Belum ada guru Tahsin-Tahfizh dengan kelas ampu.</p>
            ) : (
              <ul className="space-y-2">
                {[...data.tahsin]
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
