import { useEffect, useState } from 'react'
import { loadDashboardStats, type DashboardStats } from '../lib/dashboardStats'
import { canAkademik, canTahsin, isAdminRole, isStaff } from '../lib/roles'
import type { AppUser } from '../types/user'
import { ROLE_LABEL } from '../types/user'
import { Chip, HeroBanner, ModuleCard, SectionTitle, StatCard } from '../components/ui'

interface HomeProps {
  profile: AppUser
}

function salam(): string {
  const h = new Date().getHours()
  if (h < 11) return 'Selamat pagi'
  if (h < 15) return 'Selamat siang'
  if (h < 18) return 'Selamat sore'
  return 'Selamat malam'
}

/** Diagram batang jumlah siswa per kelas (CSS murni, tanpa library grafik). */
function KelasBars({ data }: { data: DashboardStats['perKelas'] }) {
  const max = Math.max(1, ...data.map((d) => d.jumlah))
  return (
    <div className="card-soft p-5">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-[15px] font-semibold text-slate-900">Siswa per kelas</h3>
        <span className="text-[11.5px] text-muted">Aktif dan nonaktif</span>
      </div>
      <div className="mt-5 flex h-44 items-end gap-1.5 sm:gap-2.5" role="img" aria-label="Diagram jumlah siswa per kelas">
        {data.map((d) => {
          const iqro = parseInt(d.kelas, 10) <= 2
          return (
            <div key={d.kelas} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1.5">
              <span className="text-[10.5px] font-medium text-slate-500">{d.jumlah}</span>
              <div
                title={`Kelas ${d.kelas}: ${d.jumlah} siswa`}
                className={`w-full rounded-t-lg ${iqro ? 'bg-peach-300' : 'bg-muh-500'}`}
                style={{ height: `${Math.max(4, (d.jumlah / max) * 100)}%` }}
              />
              <span className="text-[10.5px] text-muted">{d.kelas}</span>
            </div>
          )
        })}
      </div>
      <div className="mt-4 flex gap-4 text-[11.5px] text-muted">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-peach-300" /> Kelas 1–2 (Iqro)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-muh-500" /> Kelas 3–6 (Al-Qur&apos;an)
        </span>
      </div>
    </div>
  )
}

export default function Home({ profile }: HomeProps) {
  const staff = isStaff(profile.role)
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [state, setState] = useState<'loading' | 'ok' | 'error'>(staff ? 'loading' : 'ok')

  useEffect(() => {
    if (!staff) return
    let batal = false
    loadDashboardStats()
      .then((s) => {
        if (batal) return
        setStats(s)
        setState('ok')
      })
      .catch(() => {
        if (!batal) setState('error')
      })
    return () => {
      batal = true
    }
  }, [staff])

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
        {profile.kelasAmpu?.map((k) => <Chip key={k}>Kelas {k}</Chip>)}
      </HeroBanner>

      {staff && (
        <>
          <div>
            <SectionTitle>Ringkasan siswa</SectionTitle>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <StatCard
                label="Siswa terdaftar"
                value={stats?.total ?? null}
                hint={stats ? `${stats.nonaktif} nonaktif` : undefined}
                icon="users"
                tone="green"
                className="col-span-2 sm:col-span-1"
                loading={state === 'loading'}
              />
              <StatCard
                label="Kelas 1–2 · Iqro"
                value={stats?.iqro ?? null}
                icon="book"
                tone="peach"
                loading={state === 'loading'}
              />
              <StatCard
                label="Kelas 3–6 · Al-Qur'an"
                value={stats?.quran ?? null}
                icon="quran"
                tone="ink"
                loading={state === 'loading'}
              />
            </div>
            {state === 'error' && (
              <p className="mt-2 text-[12px] text-muted">
                Ringkasan siswa belum bisa dimuat. Periksa koneksi atau hak akses akun.
              </p>
            )}
          </div>

          {stats && <KelasBars data={stats.perKelas} />}

          <div>
            <SectionTitle>Modul</SectionTitle>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {canTahsin(profile.role) && (
                <ModuleCard
                  to="/tahsin"
                  title="Tahsin & Tahfizh"
                  desc="Setoran, riwayat, target hafalan, dan laporan kemajuan"
                  icon="quran"
                  tone="green"
                />
              )}
              {canAkademik(profile.role) && (
                <ModuleCard
                  to="/akademik"
                  title="Akademik & Rapor"
                  desc="TP, nilai mapel, absensi, ekskul, dan rapor"
                  icon="clipboard"
                  tone="peach"
                />
              )}
              {isAdminRole(profile.role) && (
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
