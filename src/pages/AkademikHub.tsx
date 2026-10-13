import { HeroBanner, ModuleCard, type Tone } from '../components/ui'
import type { IconName } from '../components/Icon'

const items: { to: string; title: string; desc: string; icon: IconName; tone: Tone; ready: boolean }[] = [
  { to: '/akademik/setup-tp', title: 'Setup TP & KKTP', desc: 'Tujuan pembelajaran dan empat level KKTP', icon: 'target', tone: 'peach', ready: true },
  { to: '/akademik/bobot-semester', title: 'Bobot Semester TP', desc: 'Kelompokkan TP per semester dan atur persentase bobot', icon: 'calendar', tone: 'sky', ready: true },
  { to: '/akademik/nilai-slm', title: 'Input Nilai SLM', desc: 'Nilai harian — satu tabel spreadsheet, nyaman untuk guru', icon: 'pencil', tone: 'green', ready: true },
  { to: '/akademik/laporan-slm', title: 'Laporan SLM', desc: 'Rekap nilai SLM per kelas, bisa dicetak', icon: 'printer', tone: 'violet', ready: true },
  { to: '/akademik/nilai-sts', title: 'Nilai STS & SAS', desc: 'Ujian tengah & akhir — input besar, progress jelas, nyaman untuk guru', icon: 'clipboard', tone: 'ink', ready: true },
  { to: '/akademik/rapor', title: 'Rapor', desc: 'Pratinjau tanda tangan dengan gelar', icon: 'printer', tone: 'violet', ready: true },
  { to: '/akademik/absensi', title: 'Absensi & Keputusan', desc: 'Rekap kehadiran dan keputusan kenaikan kelas', icon: 'calendar', tone: 'ink', ready: false },
  { to: '/akademik/kokurikuler', title: 'Kokurikuler', desc: 'Proyek STEM, 7KAIH, dan deskripsi gabungan', icon: 'bars', tone: 'peach', ready: false },
  { to: '/akademik/ekskul', title: 'Ekstrakurikuler', desc: 'Predikat dan deskripsi ekskul', icon: 'bars', tone: 'sky', ready: false },
]

export default function AkademikHub() {
  return (
    <div className="space-y-6">
      <HeroBanner
        eyebrow="Modul"
        title="Penilaian akademik dan rapor"
        subtitle="Halaman yang bertanda aktif sudah bisa dipakai. Sisanya dimigrasikan bertahap dari versi lama."
      />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((i) => (
          <ModuleCard key={i.to} to={i.to} title={i.title} desc={i.desc} icon={i.icon} tone={i.tone} status={i.ready} />
        ))}
      </div>
    </div>
  )
}
