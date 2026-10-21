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

/** Laporan & rapor disatukan: satu menu Laporan (tab SLM/STS/SAS), satu menu Rapor (toggle STS/SAS). */
const laporan: Item[] = [
  {
    to: '/akademik/laporan',
    title: 'Laporan Nilai',
    desc: 'Rekap SLM, STS, dan SAS per kelas — tab di dalam halaman',
    icon: 'printer',
    tone: 'green',
    ready: true,
  },
  {
    to: '/akademik/rapor',
    title: 'Rapor',
    desc: 'Pratinjau dan cetak rapor STS atau SAS',
    icon: 'printer',
    tone: 'green',
    ready: true,
  },
  {
    to: '/akademik/kelengkapan-rapor',
    title: 'Kelengkapan Rapor SAS',
    desc: 'Ketidakhadiran, catatan wali, keputusan, kokurikuler, ekstrakurikuler',
    icon: 'pencil',
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

/** Hub untuk administrator: hanya melihat. Nama menu mengikuti fungsi pemantauan, bukan pengisian. */
const adminTujuan: Item[] = [
  {
    to: '/akademik/setup-tp',
    title: 'Tujuan Pembelajaran',
    desc: 'Lihat TP dan KKTP yang disusun guru, per kelas dan mapel',
    icon: 'target',
    tone: 'green',
    ready: true,
  },
  {
    to: '/akademik/bobot-semester',
    title: 'Bobot Tujuan Pembelajaran',
    desc: 'Lihat pembagian TP ke semester dan bobotnya',
    icon: 'calendar',
    tone: 'green',
    ready: true,
  },
]

const adminNilai: Item[] = [
  {
    to: '/akademik/nilai-slm',
    title: 'Daftar Nilai Harian',
    desc: 'Lihat nilai sumatif lingkup materi yang diinput guru',
    icon: 'clipboard',
    tone: 'green',
    ready: true,
  },
  {
    to: '/akademik/nilai-sts',
    title: 'Daftar Nilai STS & SAS',
    desc: 'Lihat nilai tengah dan akhir semester per kelas',
    icon: 'clipboard',
    tone: 'green',
    ready: true,
  },
]

const adminLaporan: Item[] = [
  {
    to: '/akademik/laporan',
    title: 'Rekap Nilai',
    desc: 'Rekap SLM, STS, dan SAS per kelas — tab di dalam halaman',
    icon: 'printer',
    tone: 'green',
    ready: true,
  },
  {
    to: '/akademik/rapor',
    title: 'Cetak Rapor',
    desc: 'Pratinjau dan cetak rapor STS atau SAS, per siswa atau satu kelas',
    icon: 'printer',
    tone: 'green',
    ready: true,
  },
  {
    to: '/akademik/kelengkapan-rapor',
    title: 'Kelengkapan Rapor SAS',
    desc: 'Lihat ketidakhadiran, kokurikuler, dan ekstrakurikuler yang diisi wali kelas',
    icon: 'clipboard',
    tone: 'green',
    ready: true,
  },
]

function AdminAkademikHub() {
  return (
    <div className="space-y-5">
      <PageHeader
        title="Pantauan Akademik"
        subtitle="Mode lihat. TP, bobot, dan nilai disusun serta diinput oleh guru kelas dan guru bidang studi; administrator tidak mengubahnya."
      />
      <div className="grid gap-4 lg:grid-cols-2">
        <HubPanel title="Tujuan pembelajaran">
          <PanelItems items={adminTujuan} />
        </HubPanel>
        <HubPanel title="Daftar nilai">
          <PanelItems items={adminNilai} />
        </HubPanel>
        <HubPanel title="Rekap dan cetak">
          <PanelItems items={adminLaporan} />
        </HubPanel>
      </div>
    </div>
  )
}

export default function AkademikHub({ admin = false }: { admin?: boolean }) {
  if (admin) return <AdminAkademikHub />
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
