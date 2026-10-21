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

const dataMaster: Item[] = [
  {
    to: '/admin/siswa',
    title: 'Data Siswa',
    desc: 'Tambah, impor CSV/Dapodik, nonaktifkan, dan ekspor',
    icon: 'users',
    tone: 'green',
    ready: true,
  },
  {
    to: '/admin/users',
    title: 'Kelola Akun',
    desc: 'Tambah guru, atur kelas dan mapel, nonaktifkan akun',
    icon: 'key',
    tone: 'green',
    ready: true,
  },
  {
    to: '/admin/mapel',
    title: 'Mata Pelajaran',
    desc: 'Daftar mapel untuk tugas guru dan setup TP',
    icon: 'clipboard',
    tone: 'green',
    ready: true,
  },
]

const pengaturan: Item[] = [
  {
    to: '/admin/periode',
    title: 'Periode Akademik',
    desc: 'Tahun ajaran & semester, aktifkan, tanggal rapor',
    icon: 'calendar',
    tone: 'green',
    ready: true,
  },
  {
    to: '/admin/ekstrakurikuler',
    title: 'Ekstrakurikuler',
    desc: 'Master kegiatan, pengampu, template deskripsi capaian',
    icon: 'users',
    tone: 'green',
    ready: true,
  },
  {
    to: '/admin/tahun-ajaran',
    title: 'Data Sekolah',
    desc: 'Identitas, NPSN, dan kepala sekolah',
    icon: 'book',
    tone: 'green',
    ready: true,
  },
  {
    to: '/admin/ortu',
    title: 'Akun Orang Tua',
    desc: 'Persetujuan dan pengelolaan akun orang tua',
    icon: 'check',
    tone: 'ink',
    ready: false,
  },
]

/** Menu sementara migrasi nilai dari penilaian-v2. Hapus setelah migrasi selesai. */
const migrasi: Item[] = [
  {
    to: '/admin/impor-nilai-v2',
    title: 'Impor Nilai Tahsin (v2)',
    desc: 'Migrasi setoran & menulis dari Excel ekspor penilaian-v2',
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

export default function AdminHub() {
  return (
    <div className="space-y-5">
      <PageHeader
        title="Administrasi"
        subtitle="Master data sekolah, akun pengguna, dan periode akademik."
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <HubPanel title="Data & akun">
          <PanelItems items={dataMaster} />
        </HubPanel>
        <HubPanel title="Pengaturan">
          <PanelItems items={pengaturan} />
        </HubPanel>
        <HubPanel title="Migrasi (sementara)">
          <PanelItems items={migrasi} />
        </HubPanel>
      </div>
    </div>
  )
}
