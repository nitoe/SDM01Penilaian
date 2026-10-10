import { HeroBanner, ModuleCard, type Tone } from '../components/ui'
import type { IconName } from '../components/Icon'

const items: { to: string; title: string; desc: string; icon: IconName; tone: Tone }[] = [
  { to: '/akademik/setup-tp', title: 'Setup TP & KKTP', desc: 'Tujuan pembelajaran dan KKTP', icon: 'target', tone: 'peach' },
  { to: '/akademik/nilai', title: 'Input Nilai', desc: 'Nilai mapel, STS, SAS, SLM', icon: 'pencil', tone: 'green' },
  { to: '/akademik/siswa', title: 'Kelola Siswa', desc: 'Data siswa, NISN, mutasi, impor', icon: 'users', tone: 'sky' },
  { to: '/akademik/rapor', title: 'Rapor', desc: 'Kelengkapan dan cetak rapor', icon: 'printer', tone: 'violet' },
  { to: '/akademik/absensi', title: 'Absensi', desc: 'Rekap kehadiran siswa', icon: 'calendar', tone: 'ink' },
  { to: '/akademik/ekskul', title: 'Ekstrakurikuler', desc: 'Nilai dan deskripsi ekskul', icon: 'bars', tone: 'peach' },
]

export default function AkademikHub() {
  return (
    <div className="space-y-6">
      <HeroBanner
        eyebrow="Modul"
        title="Penilaian akademik dan rapor"
        subtitle="Modul ini sedang dimigrasikan dari versi lama. Halaman akan aktif satu per satu."
      />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((i) => (
          <ModuleCard key={i.to} to={i.to} title={i.title} desc={i.desc} icon={i.icon} tone={i.tone} status={false} />
        ))}
      </div>
    </div>
  )
}
