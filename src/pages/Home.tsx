import { useEffect, useMemo, useState } from 'react'
import {
  loadAkademikConfig,
  loadDashboardStats,
  type AkademikConfig,
  type DashboardStats,
} from '../lib/dashboardStats'
import { kelasSaya } from '../lib/kelasSaya'
import { mapelKelasSaya } from '../lib/penugasan'
import { canAkademik, canTahsin, isAdminRole, isGuruAkademikRole, isStaff } from '../lib/roles'
import { SEMUA_KELAS } from '../types/tahsin'
import type { AppUser } from '../types/user'
import { ROLE_LABEL } from '../types/user'
import { Chip, HeroBanner, ModuleCard, SectionTitle, StatCard } from '../components/ui'

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

export default function Home({ profile }: HomeProps) {
  const staff = isStaff(profile.role)
  const admin = isAdminRole(profile.role)
  const adaAkademik = canAkademik(profile.role)
  const adaTahsin = canTahsin(profile.role)
  /** Info Tahsin disembunyikan di layar kecil bila pengguna juga punya modul lain. */
  const sembunyikanTahsinDiHP = adaAkademik || admin

  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [statsState, setStatsState] = useState<Muat>(staff ? 'loading' : 'ok')
  const [config, setConfig] = useState<AkademikConfig | null>(null)
  const [configState, setConfigState] = useState<Muat>(staff ? 'loading' : 'ok')

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

  const saya = useMemo(() => kelasSaya(profile), [profile])
  const guruMapel = isGuruAkademikRole(profile.role)
  /** Mapel → daftar kelas, dari `penugasan` profil (tanpa query tambahan). */
  const mapelSaya = useMemo(() => {
    const per = new Map<string, string[]>()
    for (const x of mapelKelasSaya(profile)) per.set(x.mapel, [...(per.get(x.mapel) ?? []), x.kelas])
    return [...per.entries()]
  }, [profile])
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
            ? 'Pilih modul di bawah untuk mulai mencatat dan memantau penilaian siswa.'
            : `Halo ${depan}, portal untuk orang tua akan segera tersedia.`
        }
      >
        <Chip>{ROLE_LABEL[profile.role]}</Chip>
        {saya.wali.map((k) => (
          <Chip key={`w${k}`}>Wali kelas {k}</Chip>
        ))}
        {saya.mengajar.length > 0 && <Chip>Mengajar di {saya.mengajar.length} kelas</Chip>}
        {profile.role === 'guru_tahsin_tahfizh' &&
          profile.kelasAmpu?.map((k) => (
            <span key={`t${k}`} className={sembunyikanTahsinDiHP ? 'hidden sm:inline-flex' : 'inline-flex'}>
              <Chip>Tahsin {k}</Chip>
            </span>
          ))}
      </HeroBanner>

      {staff && (
        <>
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

          {guruMapel && mapelSaya.length > 0 && (
            <div className="card-soft p-5">
              <h3 className="text-[15px] font-semibold text-slate-900">Mapel dan kelas saya</h3>
              <ul className="mt-3 divide-y divide-border">
                {mapelSaya.map(([mapel, kelas]) => (
                  <li key={mapel} className="flex items-center justify-between gap-3 py-2.5">
                    <span className="text-[13.5px] font-medium text-slate-800">{mapel}</span>
                    <span className="flex flex-wrap justify-end gap-1.5">
                      {kelas.map((k) => (
                        <span
                          key={k}
                          className="rounded-full bg-peach-50 px-2.5 py-0.5 text-[11.5px] font-semibold text-peach-500"
                        >
                          {k}
                        </span>
                      ))}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

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
              </div>
            </div>
          )}

          {stats && <KelasBars data={stats.perKelas} saya={saya.semua} />}

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
