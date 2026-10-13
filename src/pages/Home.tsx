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
import { canAkademik, canTahsin, isAdminRole, isGuruAkademikRole, isStaff } from '../lib/roles'
import { SEMUA_KELAS } from '../types/tahsin'
import type { AppUser } from '../types/user'
import { ROLE_LABEL } from '../types/user'
import { Chip, HeroBanner, ModuleCard, SectionTitle, StatCard, Badge } from '../components/ui'
import Icon from '../components/Icon'

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
        <span className="text-[11.5px] text-muted">Aktif dan nonaktif</span>
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
              <span className="text-[10.5px] font-medium text-slate-500">{d.jumlah}</span>
              <div
                title={`Kelas ${d.kelas}: ${d.jumlah} siswa`}
                className={`w-full rounded-t-lg ${milikku ? 'bg-peach-400' : 'bg-muh-500'}`}
                style={{ height: `${Math.max(4, (d.jumlah / max) * 100)}%` }}
              />
              <span
                className={`text-[10.5px] ${milikku ? 'font-semibold text-peach-500' : 'text-muted'}`}
              >
                {d.kelas}
              </span>
            </div>
          )
        })}
      </div>
      {saya.length > 0 && (
        <div className="mt-4 flex gap-4 text-[11.5px] text-muted">
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-peach-400" /> Kelas saya
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-muh-500" /> Kelas lain
          </span>
        </div>
      )}
    </div>
  )
}

/** Kartu progres interaktif — klik menuju halaman terkait. */
function ProgressCard({
  to,
  title,
  value,
  hint,
  tone = 'peach',
  alert,
}: {
  to: string
  title: string
  value: string | number | null
  hint?: string
  tone?: 'peach' | 'green' | 'ink' | 'sky'
  alert?: boolean
}) {
  const accent =
    tone === 'green'
      ? 'border-l-muh-500'
      : tone === 'sky'
        ? 'border-l-sky-500'
        : tone === 'ink'
          ? 'border-l-slate-500'
          : 'border-l-peach-400'
  const ring = alert
    ? 'ring-1 ring-peach-300 bg-peach-50/60'
    : 'hover:border-muh-300'
  return (
    <Link
      to={to}
      className={`card-soft group flex flex-col gap-1 border-l-4 p-4 transition hover:-translate-y-0.5 hover:shadow-md ${accent} ${ring}`}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-[12px] font-medium text-muted">{title}</p>
        {alert && <Badge tone="peach">Perlu aksi</Badge>}
      </div>
      <p className="text-[24px] font-semibold leading-tight tracking-tight text-slate-900">
        {value ?? '—'}
      </p>
      {hint && <p className="text-[11.5px] leading-snug text-muted">{hint}</p>}
      <span className="mt-1 inline-flex items-center gap-1 text-[11.5px] font-semibold text-muh-700 opacity-0 transition group-hover:opacity-100">
        Buka <Icon name="arrow" />
      </span>
    </Link>
  )
}

export default function Home({ profile }: HomeProps) {
  const staff = isStaff(profile.role)
  const admin = isAdminRole(profile.role)
  const adaAkademik = canAkademik(profile.role)
  const adaTahsin = canTahsin(profile.role)
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

  return (
    <div className="space-y-6">
      <HeroBanner
        eyebrow={`${salam()},`}
        title={profile.nama}
        subtitle={
          staff
            ? 'Ringkasan tugas dan akses cepat ke modul penilaian.'
            : `Halo ${depan}, portal untuk orang tua akan segera tersedia.`
        }
      >
        <Chip>{ROLE_LABEL[profile.role]}</Chip>
        {saya.wali.map((k) => (
          <Chip key={`w${k}`}>Wali kelas {k}</Chip>
        ))}
        {saya.mengajar.length > 0 && !saya.wali.length && (
          <Chip>Mengajar di {saya.mengajar.length} kelas</Chip>
        )}
        {profile.role === 'guru_tahsin_tahfizh' &&
          profile.kelasAmpu?.map((k) => (
            <span key={`t${k}`} className={sembunyikanTahsinDiHP ? 'hidden sm:inline-flex' : 'inline-flex'}>
              <Chip>Tahsin {k}</Chip>
            </span>
          ))}
      </HeroBanner>

      {staff && (
        <>
          {/* Ringkasan umum */}
          <div>
            <SectionTitle>Ringkasan</SectionTitle>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <StatCard
                label="Tahun ajaran"
                value={config ? config.tahunAjaran : null}
                hint={
                  config
                    ? `Semester ${config.semesterAktif === '2' ? '2 (genap)' : '1 (ganjil)'}`
                    : configState === 'loading'
                      ? undefined
                      : 'Belum diatur'
                }
                icon="calendar"
                tone="peach"
                className="col-span-2 sm:col-span-1"
                loading={configState === 'loading'}
              />
              <StatCard
                label="Siswa terdaftar"
                value={stats?.total ?? null}
                hint={stats ? `${stats.nonaktif} nonaktif` : undefined}
                icon="users"
                tone="green"
                loading={statsState === 'loading'}
              />
              {admin || saya.semua.length === 0 ? (
                <StatCard
                  label="Rombongan belajar"
                  value={SEMUA_KELAS.length}
                  hint="Kelas 1–6"
                  icon="book"
                  tone="ink"
                />
              ) : (
                <StatCard
                  label="Siswa di kelas saya"
                  value={siswaKelasSaya}
                  hint={`${saya.semua.length} kelas`}
                  icon="book"
                  tone="ink"
                  loading={statsState === 'loading'}
                />
              )}
            </div>
            {statsState === 'error' && (
              <p className="mt-2 text-[12px] text-muted">
                Ringkasan siswa belum bisa dimuat. Periksa koneksi atau hak akses akun.
              </p>
            )}
          </div>

          {/* Progres akademik — data esensial untuk guru kelas & bidang studi */}
          {guruMapel && (
            <div>
              <SectionTitle>Progres penilaian saya</SectionTitle>
              {progressState === 'loading' && (
                <div className="grid gap-3 sm:grid-cols-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="card-soft h-28 animate-pulse bg-slate-50" />
                  ))}
                </div>
              )}
              {progressState === 'ok' && progress && (
                <div className="grid gap-3 sm:grid-cols-3">
                  <ProgressCard
                    to="/akademik/setup-tp"
                    title="Setup TP & KKTP"
                    value={
                      progress.totalKombinasi === 0
                        ? '—'
                        : `${progress.sudahAdaTp}/${progress.totalKombinasi}`
                    }
                    hint={
                      progress.totalKombinasi === 0
                        ? 'Belum ada penugasan mapel'
                        : progress.belumAdaTp > 0
                          ? `${progress.belumAdaTp} mapel×tingkat belum punya TP`
                          : `${progress.totalTp} TP tersusun`
                    }
                    tone="peach"
                    alert={progress.belumAdaTp > 0}
                  />
                  <ProgressCard
                    to="/akademik/bobot-semester"
                    title="Bobot semester"
                    value={progress.tpTanpaBobot}
                    hint={
                      progress.totalTp === 0
                        ? 'Belum ada TP untuk diatur'
                        : progress.tpTanpaBobot > 0
                          ? 'TP belum dikelompokkan semester'
                          : 'Semua TP sudah punya semester'
                    }
                    tone="sky"
                    alert={progress.tpTanpaBobot > 0}
                  />
                  <ProgressCard
                    to="/akademik/nilai-slm"
                    title="Input nilai SLM"
                    value={progress.totalTp}
                    hint={
                      progress.totalTp === 0
                        ? 'Susun TP dulu sebelum mengisi nilai'
                        : 'Lanjut ke input nilai per kelas'
                    }
                    tone="green"
                  />
                </div>
              )}
              {progressState === 'error' && (
                <p className="text-[12px] text-muted">Progres TP belum bisa dimuat.</p>
              )}
            </div>
          )}

          {/* Ringkasan khusus guru Tahsin */}
          {guruTahsinOnly && (profile.kelasAmpu?.length ?? 0) > 0 && (
            <div className={sembunyikanTahsinDiHP ? 'hidden sm:block' : ''}>
              <SectionTitle>Ringkasan Tahsin-Tahfizh</SectionTitle>
              <div className="grid gap-3 sm:grid-cols-3">
                <StatCard
                  label="Siswa di kelas ampu"
                  value={siswaAmpu}
                  hint={(profile.kelasAmpu ?? []).join(', ')}
                  icon="users"
                  tone="green"
                  loading={siswaAmpu === null}
                />
                <StatCard
                  label="Setoran 7 hari terakhir"
                  value={setoranMinggu}
                  hint="Semua kelas ampu"
                  icon="quran"
                  tone="peach"
                  loading={setoranMinggu === null}
                />
                <Link
                  to="/tahsin/input-setoran"
                  className="card-soft flex items-center gap-3 p-4 transition hover:-translate-y-0.5 hover:shadow-md"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muh-600 text-white">
                    <Icon name="pencil" />
                  </span>
                  <div>
                    <p className="text-[14px] font-semibold text-slate-900">Input Setoran</p>
                    <p className="text-[12px] text-muted">Catat setoran hari ini</p>
                  </div>
                </Link>
              </div>
            </div>
          )}

          {/* Akses cepat akademik */}
          {guruMapel && (
            <div>
              <SectionTitle>Akses cepat</SectionTitle>
              <div className="grid gap-3 sm:grid-cols-3">
                <ModuleCard
                  to="/akademik/setup-tp"
                  title="Setup TP & KKTP"
                  desc="Tujuan pembelajaran dan empat level KKTP"
                  icon="target"
                  tone="peach"
                />
                <ModuleCard
                  to="/akademik/bobot-semester"
                  title="Bobot Semester TP"
                  desc="Kelompokkan TP per semester dan atur bobot"
                  icon="calendar"
                  tone="sky"
                />
                <ModuleCard
                  to="/akademik/nilai-slm"
                  title="Input Nilai SLM"
                  desc="Nilai sumatif lingkup materi per TP"
                  icon="pencil"
                  tone="green"
                />
                <ModuleCard
                  to="/akademik/laporan-slm"
                  title="Laporan SLM"
                  desc="Rekap nilai SLM per kelas"
                  icon="printer"
                  tone="violet"
                />
                <ModuleCard
                  to="/akademik/nilai-sts"
                  title="Nilai STS & SAS"
                  desc="Cakupan TP, lalu nilai tengah dan akhir semester"
                  icon="clipboard"
                  tone="ink"
                />
              </div>
            </div>
          )}

          {stats && admin && <KelasBars data={stats.perKelas} saya={saya.semua} />}
          {stats && !admin && saya.semua.length > 0 && (
            <KelasBars data={stats.perKelas} saya={saya.semua} />
          )}

          <div>
            <SectionTitle>Modul</SectionTitle>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {adaAkademik && (
                <ModuleCard
                  to="/akademik"
                  title="Akademik & Rapor"
                  desc="TP, nilai mapel, absensi, ekskul, dan rapor"
                  icon="clipboard"
                  tone="peach"
                />
              )}
              {adaTahsin && (
                <div className={sembunyikanTahsinDiHP ? 'hidden sm:block' : ''}>
                  <ModuleCard
                    to="/tahsin"
                    title="Tahsin & Tahfizh"
                    desc="Setoran, riwayat, target hafalan, dan laporan kemajuan"
                    icon="quran"
                    tone="green"
                  />
                </div>
              )}
              {admin && (
                <ModuleCard
                  to="/admin"
                  title="Administrasi"
                  desc="Data siswa, akun guru, dan pengaturan"
                  icon="settings"
                  tone="ink"
                />
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
