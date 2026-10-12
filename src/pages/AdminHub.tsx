import { HeroBanner, ModuleCard, type Tone } from '../components/ui'
import type { IconName } from '../components/Icon'

const items: { to: string; title: string; desc: string; ready: boolean; icon: IconName; tone: Tone }[] = [
  {
    to: '/admin/siswa',
    title: 'Data Siswa',
    desc: 'Tambah, impor CSV/Dapodik, nonaktifkan, dan ekspor',
    ready: true,
    icon: 'users',
    tone: 'green',
  },
  {
    to: '/admin/users',
    title: 'Kelola Akun',
    desc: 'Tambah guru, atur kelas dan mapel, nonaktifkan akun',
    ready: true,
    icon: 'key',
    tone: 'ink',
  },
  {
    to: '/admin/mapel',
    title: 'Mata Pelajaran',
    desc: 'Daftar mapel untuk tugas guru dan setup TP',
    ready: true,
    icon: 'clipboard',
    tone: 'violet',
  },
  {
    to: '/admin/tahun-ajaran',
    title: 'Tahun Ajaran',
    desc: 'Semester dan tahun ajaran untuk penyimpanan nilai',
    ready: true,
    icon: 'calendar',
    tone: 'sky',
  },
  {
    to: '/admin/ortu',
    title: 'Akun Orang Tua',
    desc: 'Persetujuan dan pengelolaan akun orang tua',
    ready: false,
    icon: 'check',
    tone: 'peach',
  },
]

export default function AdminHub() {
  return (
    <div className="space-y-6">
      <HeroBanner
        eyebrow="Modul"
        title="Pengaturan sistem dan master data"
        subtitle="Kelola data siswa dan akun pengguna."
      />
      <div className="grid gap-3 sm:grid-cols-2">
        {items.map((i) => (
          <ModuleCard key={i.to} to={i.to} title={i.title} desc={i.desc} icon={i.icon} tone={i.tone} status={i.ready} />
        ))}
      </div>
    </div>
  )
}
