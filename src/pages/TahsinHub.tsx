import { HubPanel, HubRow, PageHeader } from '../components/ui'
import type { IconName } from '../components/Icon'
import type { Tone } from '../components/ui'

type Item = {
  to: string
  title: string
  desc: string
  icon: IconName
  tone: Tone
  ready: boolean
}

const harian: Item[] = [
  {
    to: '/tahsin/input-setoran',
    title: 'Input Setoran',
    desc: 'Catat setoran hafalan dan bacaan siswa',
    icon: 'pencil',
    tone: 'green',
    ready: true,
  },
  {
    to: '/tahsin/riwayat',
    title: 'Riwayat Siswa',
    desc: 'Progres membaca, hafalan, menulis, dan ringkasan',
    icon: 'history',
    tone: 'green',
    ready: true,
  },
]

const targetLaporan: Item[] = [
  {
    to: '/tahsin/target',
    title: 'Target Hafalan',
    desc: 'Target per kelas dan capaian siswa',
    icon: 'target',
    tone: 'green',
    ready: true,
  },
  {
    to: '/tahsin/laporan',
    title: 'Cetak Laporan',
    desc: 'Laporan kemajuan tahsin-tahfizh',
    icon: 'printer',
    tone: 'ink',
    ready: true,
  },
  {
    to: '/tahsin/ekspor',
    title: 'Ekspor Nilai',
    desc: 'Unduh semua setoran & menulis (Excel) per kelas',
    icon: 'download',
    tone: 'ink',
    ready: true,
  },
]

function PanelItems({ items }: { items: Item[] }) {
  return (
    <>
      {items.map((i) => (
        <HubRow
          key={i.to}
          to={i.to}
          title={i.title}
          desc={i.desc}
          icon={i.icon}
          tone={i.tone}
          ready={i.ready}
        />
      ))}
    </>
  )
}

export default function TahsinHub({ admin = false }: { admin?: boolean }) {
  const harianTampil = admin ? harian.filter((i) => i.to !== '/tahsin/input-setoran') : harian
  const targetTampil = admin ? targetLaporan.filter((i) => i.ready) : targetLaporan
  return (
    <div className="space-y-5">
      <PageHeader
        title={admin ? 'Pantauan Tahsin & Tahfizh' : 'Tahsin & Tahfizh'}
        subtitle={
          admin
            ? 'Mode lihat. Setoran dan target hafalan dicatat oleh guru Tahsin-Tahfizh; administrator tidak mengubahnya.'
            : 'Catat setoran pertemuan dan pantau perkembangan bacaan siswa.'
        }
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <HubPanel title={admin ? 'Riwayat' : 'Kerja harian'}>
          <PanelItems items={harianTampil} />
        </HubPanel>
        <HubPanel title={admin ? 'Target' : 'Target & laporan'}>
          <PanelItems items={targetTampil} />
        </HubPanel>
      </div>
    </div>
  )
}
