import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  loadAkademikConfig,
  loadDashboardStats,
  loadGuruAkademikProgress,
  loadSetoranMingguIni,
  loadSiswaCountKelas,
  type AkademikConfig,
  type DashboardStats,
  type GuruAkademikProgress,
} from '../lib/dashboardStats'
import { kelasSaya } from '../lib/kelasSaya'
import { canAkademik, isAdminRole, isGuruAkademikRole, isStaff } from '../lib/roles'
import { SEMUA_KELAS } from '../types/tahsin'
import type { AppUser } from '../types/user'
import { ROLE_LABEL } from '../types/user'
import { Badge, FlowRow, HubPanel, SectionTitle, StatStrip, type FlowState } from '../components/ui'
import { usePeriodeAkademik } from '../lib/usePeriodeAkademik'
import AdminDashboard from './AdminDashboard'

interface HomeProps {
  profile: AppUser
}

type Muat = 'loading' | 'ok' | 'error'

function salam(): string {
  const h = new Date().getHours()
  if (h < 11) return 'Selamat pagi'
  if (h < 15) return 'Selamat siang'
  if (h < 18) return 'Selamat sore'
  return 'Selamat malam'
}

/** Diagram batang jumlah siswa per kelas (CSS murni). Kelas milik pengguna disorot peach. */
function KelasBars({
  data,
  saya,
}: {
  data: DashboardStats['perKelas']
  saya: string[]
}) {
  const max = Math.max(1, ...data.map((d) => d.jumlah))
  return (
    <div className="card-soft p-5">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-[15px] font-semibold text-slate-900">Siswa per kelas</h3>
        <span className="text-[12px] text-muted">Aktif dan nonaktif</span>
      </div>
      <div
        className="mt-5 flex h-44 items-end gap-1.5 sm:gap-2.5"
        role="img"
        aria-label="Diagram jumlah siswa per kelas"
      >
        {data.map((d) => {
          const milikku = saya.includes(d.kelas)
          return (
            <div
              key={d.kelas}
              className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1.5"
            >
              <span className="tabular text-[11px] font-medium text-slate-500">{d.jumlah}</span>
              <div
                title={`Kelas ${d.kelas}: ${d.jumlah} siswa`}
                className={`w-full rounded-t ${milikku ? 'bg-muh-600' : 'bg-muh-200'}`}
                style={{ height: `${Math.max(4, (d.jumlah / max) * 100)}%` }}
              />
              <span
                className={`text-[11px] ${milikku ? 'font-semibold text-muh-700' : 'text-muted'}`}
              >
                {d.kelas}
              </span>
            </div>
          )
        })}
      </div>
      {saya.length > 0 && (
        <div className="mt-4 flex gap-4 text-[12px] text-muted">
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-muh-600" /> Kelas saya
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-muh-200" /> Kelas lain
          </span>
        </div>
      )}
    </div>
  )
}

/** Keadaan tiga langkah pertama alur penilaian, dihitung dari progres TP guru (tanpa query nilai, ANTIREGRESI §8.3). */
function keadaanLangkah(progress: GuruAkademikProgress | null): {
  tp: { state: FlowState; label?: string; desc: string }
  bobot: { state: FlowState; label?: string; desc: string }
  nilai: { state: FlowState; label?: string }
} {
  if (!progress) {
    return {
      tp: { state: 'ready', desc: 'Tujuan pembelajaran dan empat level KKTP' },
      bobot: { state: 'ready', desc: 'Kelompokkan TP per semester dan atur bobot' },
      nilai: { state: 'ready' },
    }
  }
  const tp =
    progress.totalKombinasi === 0
      ? { state: 'idle' as const, label: 'Belum ada penugasan', desc: 'Belum ada penugasan mapel untuk akun ini' }
      : progress.belumAdaTp > 0
        ? {
            state: 'attention' as const,
            label: `${progress.belumAdaTp} belum`,
            desc: `${progress.belumAdaTp} mapel × tingkat belum punya TP`,
          }
        : {
            state: 'done' as const,
            label: 'Lengkap',
            desc: `${progress.totalTp} TP tersusun di ${progress.sudahAdaTp} mapel × tingkat`,
          }
  const bobot =
    progress.totalTp === 0
      ? { state: 'idle' as const, label: 'Menunggu TP', desc: 'Susun TP lebih dulu' }
      : progress.tpTanpaBobot > 0
        ? {
            state: 'attention' as const,
            label: `${progress.tpTanpaBobot} TP`,
            desc: `${progress.tpTanpaBobot} TP belum dikelompokkan ke semester`,
          }
        : { state: 'done' as const, label: 'Lengkap', desc: 'Semua TP sudah punya semester' }
  const nilai =
    progress.totalTp === 0
      ? { state: 'idle' as const, label: 'Susun TP dulu' }
      : { state: 'ready' as const, label: 'Siap' }
  return { tp, bobot, nilai }
}

export default function Home({ profile }: HomeProps) {
  const periodeAk = usePeriodeAkademik()
  const staff = isStaff(profile.role)
  const admin = isAdminRole(profile.role)
  const adaAkademik = canAkademik(profile.role)
  const guruMapel = isGuruAkademikRole(profile.role)
  const guruTahsinOnly =
    profile.role === 'guru_tahsin_tahfizh' ||
    (profile.role === 'guru' && (profile.kelasAmpu?.length ?? 0) > 0)
  /** Info Tahsin disembunyikan di layar kecil bila pengguna juga punya modul lain. */
  const sembunyikanTahsinDiHP = adaAkademik || admin

  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [statsState, setStatsState] = useState<Muat>(staff ? 'loading' : 'ok')
  const [config, setConfig] = useState<AkademikConfig | null>(null)
  const [configState, setConfigState] = useState<Muat>(staff ? 'loading' : 'ok')
  const [progress, setProgress] = useState<GuruAkademikProgress | null>(null)
  const [progressState, setProgressState] = useState<Muat>('ok')
  const [siswaAmpu, setSiswaAmpu] = useState<number | null>(null)
  const [setoranMinggu, setSetoranMinggu] = useState<number | null>(null)

  useEffect(() => {
    if (!staff) return
    let batal = false
    loadDashboardStats()
      .then((s) => {
        if (batal) return
        setStats(s)
        setStatsState('ok')
      })
      .catch(() => {
        if (!batal) setStatsState('error')
      })
    loadAkademikConfig()
      .then((c) => {
        if (batal) return
        setConfig(c)
        setConfigState('ok')
      })
      .catch(() => {
        if (!batal) setConfigState('error')
      })
    return () => {
      batal = true
    }
  }, [staff])

  useEffect(() => {
    if (!guruMapel) return
    let batal = false
    setProgressState('loading')
    loadGuruAkademikProgress(profile)
      .then((p) => {
        if (!batal) {
          setProgress(p)
          setProgressState('ok')
        }
      })
      .catch(() => {
        if (!batal) setProgressState('error')
      })
    return () => {
      batal = true
    }
  }, [guruMapel, profile])

  useEffect(() => {
    const kelasAmpu = profile.kelasAmpu ?? []
    if (!guruTahsinOnly || kelasAmpu.length === 0) return
    let batal = false
    Promise.all([loadSiswaCountKelas(kelasAmpu), loadSetoranMingguIni(kelasAmpu)]).then(
      ([nSiswa, nSetoran]) => {
        if (batal) return
        setSiswaAmpu(nSiswa)
        setSetoranMinggu(nSetoran)
      },
    )
    return () => {
      batal = true
    }
  }, [guruTahsinOnly, profile.kelasAmpu])

  const saya = useMemo(() => kelasSaya(profile), [profile])
  const siswaKelasSaya = stats
    ? stats.perKelas.filter((k) => saya.semua.includes(k.kelas)).reduce((n, k) => n + k.jumlah, 0)
    : null

  const depan = profile.nama.split(' ')[0] || profile.nama

  const langkah = keadaanLangkah(progressState === 'ok' ? progress : null)
  const tampilBatang = !!stats && (admin || saya.semua.length > 0)

  return (
    <div className="space-y-6">
      <header>
        <p className="text-[13px] text-muted">{salam()},</p>
        <h1 className="mt-0.5 text-[24px] font-semibold leading-tight tracking-tight text-slate-900">
          {profile.nama}
        </h1>
        <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
          <Badge tone="brand">{ROLE_LABEL[profile.role]}</Badge>
          {saya.wali.map((k) => (
            <Badge key={`w${k}`}>Wali kelas {k}</Badge>
          ))}
          {saya.mengajar.length > 0 && !saya.wali.length && (
            <Badge>Mengajar di {saya.mengajar.length} kelas</Badge>
          )}
          {profile.role === 'guru_tahsin_tahfizh' &&
            profile.kelasAmpu?.map((k) => (
              <span key={`t${k}`} className={sembunyikanTahsinDiHP ? 'hidden sm:inline-flex' : 'inline-flex'}>
                <Badge>Tahsin {k}</Badge>
              </span>
            ))}
        </div>
        {!staff && (
          <p className="mt-3 text-[13px] text-muted">
            Halo {depan}, portal untuk orang tua akan segera tersedia.
          </p>
        )}
      </header>

      {staff && (
        <>
          <section aria-label="Ringkasan">
            <StatStrip
              items={[
                {
                  label: 'Periode aktif',
                  value: periodeAk.ready
                    ? periodeAk.tahunAjaran
                    : config
                      ? config.tahunAjaran
                      : null,
                  hint: periodeAk.ready
                    ? periodeAk.label
                    : config
                      ? `Semester ${config.semesterAktif === '2' ? '2 (genap)' : '1 (ganjil)'}`
                      : periodeAk.loading || configState === 'loading'
                        ? undefined
                        : 'Belum dipilih — buat di Periode Akademik',
                  loading: periodeAk.loading || configState === 'loading',
                },
                {
                  label: 'Siswa terdaftar',
                  value: stats?.total ?? null,
                  hint: stats ? `${stats.nonaktif} nonaktif` : undefined,
                  loading: statsState === 'loading',
                },
                admin || saya.semua.length === 0
                  ? { label: 'Rombongan belajar', value: SEMUA_KELAS.length, hint: 'Kelas 1–6' }
                  : {
                      label: 'Siswa di kelas saya',
                      value: siswaKelasSaya,
                      hint: `${saya.semua.length} kelas`,
                      loading: statsState === 'loading',
                    },
              ]}
            />
            {statsState === 'error' && (
              <p className="mt-2 text-[12px] text-muted">
                Ringkasan siswa belum bisa dimuat. Periksa koneksi atau hak akses akun.
              </p>
            )}
          </section>

          {admin && <AdminDashboard />}

          {(guruMapel || tampilBatang) && (
            <div className="grid gap-6 lg:grid-cols-5">
              {/* Alur penilaian guru: urutan kerja, bukan daftar modul */}
              {guruMapel && (
                <section className={tampilBatang ? 'lg:col-span-3' : 'lg:col-span-5'}>
                  <HubPanel title="Alur penilaian">
                    <FlowRow
                      step={1}
                      to="/akademik/setup-tp"
                      title="Setup TP & KKTP"
                      desc={langkah.tp.desc}
                      state={langkah.tp.state}
                      stateLabel={langkah.tp.label}
                    />
                    <FlowRow
                      step={2}
                      to="/akademik/bobot-semester"
                      title="Bobot semester TP"
                      desc={langkah.bobot.desc}
                      state={langkah.bobot.state}
                      stateLabel={langkah.bobot.label}
                    />
                    <FlowRow
                      step={3}
                      to="/akademik/nilai-slm"
                      title="Input nilai SLM"
                      desc="Nilai sumatif lingkup materi per TP, per kelas"
                      state={langkah.nilai.state}
                      stateLabel={langkah.nilai.label}
                    />
                    <FlowRow
                      step={4}
                      to="/akademik/nilai-sts"
                      title="Nilai STS & SAS"
                      desc="Cakupan TP, lalu nilai tengah dan akhir semester"
                      state={progress && progress.totalTp === 0 ? 'idle' : 'ready'}
                    />
                    <FlowRow
                      step={5}
                      to="/akademik/laporan-slm"
                      title="Laporan SLM"
                      desc="Rekap nilai SLM per kelas"
                      state={progress && progress.totalTp === 0 ? 'idle' : 'ready'}
                    />
                  </HubPanel>
                  {progressState === 'error' && (
                    <p className="mt-2 text-[12px] text-muted">Status langkah belum bisa dimuat.</p>
                  )}
                </section>
              )}

              {tampilBatang && stats && (
                <section className={guruMapel ? 'lg:col-span-2' : 'lg:col-span-5'}>
                  <KelasBars data={stats.perKelas} saya={saya.semua} />
                </section>
              )}
            </div>
          )}

          {/* Tahsin-Tahfizh: hanya guru Tahsin; disembunyikan di layar kecil bila ada modul lain (§8.2) */}
          {guruTahsinOnly && (profile.kelasAmpu?.length ?? 0) > 0 && (
            <section className={sembunyikanTahsinDiHP ? 'hidden sm:block' : ''} aria-label="Tahsin-Tahfizh">
              <SectionTitle>Tahsin-Tahfizh</SectionTitle>
              <StatStrip
                items={[
                  {
                    label: 'Siswa di kelas ampu',
                    value: siswaAmpu,
                    hint: (profile.kelasAmpu ?? []).join(', '),
                    loading: siswaAmpu === null,
                  },
                  {
                    label: 'Setoran 7 hari terakhir',
                    value: setoranMinggu,
                    hint: 'Semua kelas ampu',
                    loading: setoranMinggu === null,
                  },
                ]}
              />
              <Link
                to="/tahsin/input-setoran"
                className="mt-3 inline-flex items-center rounded-lg bg-muh-600 px-4 py-2.5 text-[13.5px] font-semibold text-white transition hover:bg-muh-700"
              >
                Input setoran hari ini
              </Link>
            </section>
          )}
        </>
      )}
    </div>
  )
}
