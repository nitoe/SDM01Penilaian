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

const persiapan: Item[] = [
  {
    to: '/akademik/setup-tp',
    title: 'Setup TP & KKTP',
    desc: 'Susun tujuan pembelajaran dan level KKTP per mapel',
    icon: 'target',
    tone: 'green',
    ready: true,
  },
  {
    to: '/akademik/bobot-semester',
    title: 'Bobot Semester TP',
    desc: 'Kelompokkan TP per semester dan atur bobot',
    icon: 'calendar',
    tone: 'green',
    ready: true,
  },
]

const inputNilai: Item[] = [
  {
    to: '/akademik/nilai-slm',
    title: 'Input Nilai SLM',
    desc: 'Nilai sumatif lingkup materi — tabel spreadsheet',
    icon: 'pencil',
    tone: 'green',
    ready: true,
  },
  {
    to: '/akademik/nilai-sts',
    title: 'Nilai STS & SAS',
    desc: 'Cakupan TP, nilai tengah dan akhir semester',
    icon: 'clipboard',
    tone: 'green',
    ready: true,
  },
]

const laporan: Item[] = [
  {
    to: '/akademik/laporan-slm',
    title: 'Laporan SLM',
    desc: 'Rekap nilai SLM per kelas, siap dicetak',
    icon: 'printer',
    tone: 'green',
    ready: true,
  },
  {
    to: '/akademik/rapor',
    title: 'Rapor STS',
    desc: 'Pratinjau dan cetak rapor sumatif tengah semester',
    icon: 'printer',
    tone: 'green',
    ready: true,
  },
]

const segera: Item[] = [
  {
    to: '/akademik/absensi',
    title: 'Absensi & Keputusan',
    desc: 'Rekap kehadiran dan keputusan kenaikan kelas',
    icon: 'calendar',
    tone: 'ink',
    ready: false,
  },
  {
    to: '/akademik/kokurikuler',
    title: 'Kokurikuler',
    desc: 'Proyek STEM, 7KAIH, dan deskripsi gabungan',
    icon: 'bars',
    tone: 'ink',
    ready: false,
  },
  {
    to: '/akademik/ekskul',
    title: 'Ekstrakurikuler',
    desc: 'Predikat dan deskripsi ekskul',
    icon: 'bars',
    tone: 'ink',
    ready: false,
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

export default function AkademikHub() {
  return (
    <div className="space-y-5">
      <PageHeader
        title="Akademik & Rapor"
        subtitle="Alur kerja penilaian: siapkan TP, input nilai, lalu cetak laporan."
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <HubPanel title="1 · Persiapan">
          <PanelItems items={persiapan} />
        </HubPanel>
        <HubPanel title="2 · Input nilai">
          <PanelItems items={inputNilai} />
        </HubPanel>
        <HubPanel title="3 · Laporan & rapor">
          <PanelItems items={laporan} />
        </HubPanel>
        <HubPanel title="Segera hadir">
          <PanelItems items={segera} />
        </HubPanel>
      </div>
    </div>
  )
}
