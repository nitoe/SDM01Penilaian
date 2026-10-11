import { HeroBanner, ModuleCard, type Tone } from '../components/ui'
import type { IconName } from '../components/Icon'

const items: { to: string; title: string; desc: string; ready: boolean; icon: IconName; tone: Tone }[] = [
  {
    to: '/tahsin/input-setoran',
    title: 'Input Setoran',
    desc: 'Catat setoran hafalan dan bacaan siswa',
    ready: true,
    icon: 'pencil',
    tone: 'green',
  },
  {
    to: '/tahsin/riwayat',
    title: 'Riwayat Siswa',
    desc: 'Progres membaca, hafalan, menulis, dan ringkasan',
    ready: true,
    icon: 'history',
    tone: 'sky',
  },
  {
    to: '/tahsin/target',
    title: 'Target Hafalan',
    desc: 'Target per kelas dan capaian siswa',
    ready: true,
    icon: 'target',
    tone: 'peach',
  },
  {
    to: '/tahsin/laporan',
    title: 'Cetak Laporan',
    desc: 'Laporan kemajuan tahsin-tahfizh',
    ready: false,
    icon: 'printer',
    tone: 'violet',
  },
]

export default function TahsinHub() {
  return (
    <div className="space-y-6">
      <HeroBanner
        eyebrow="Modul"
        title="Pantau bacaan dan hafalan Al-Qur'an siswa"
        subtitle="Catat setoran setiap pertemuan dan lihat perkembangannya dari waktu ke waktu."
      />
      <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-[12.5px] leading-snug text-amber-900">
        <span className="font-semibold">Belum dibuka untuk guru.</span> Jangan menginput setoran di sini
        sebelum ada pengumuman pemindahan, agar data tidak terpisah di dua sistem.
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {items.map((i) => (
          <ModuleCard key={i.to} to={i.to} title={i.title} desc={i.desc} icon={i.icon} tone={i.tone} status={i.ready} />
        ))}
      </div>
    </div>
  )
}
