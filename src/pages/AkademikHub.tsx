import { Link } from 'react-router-dom'

const items = [
  {
    to: '/akademik/setup-tp',
    title: 'Setup TP & KKTP',
    desc: 'Tujuan pembelajaran dan kriteria ketercapaian.',
    badge: 'Segera',
  },
  {
    to: '/akademik/nilai',
    title: 'Input Nilai',
    desc: 'Nilai mapel, STS, SAS, dan SLM.',
    badge: 'Segera',
  },
  {
    to: '/akademik/siswa',
    title: 'Kelola Siswa',
    desc: 'Data siswa, NISN, mutasi, dan impor.',
    badge: 'Segera',
  },
  {
    to: '/akademik/rapor',
    title: 'Rapor',
    desc: 'Kelengkapan rapor, cetak STS & SAS.',
    badge: 'Segera',
  },
  {
    to: '/akademik/absensi',
    title: 'Absensi',
    desc: 'Rekap kehadiran siswa.',
    badge: 'Segera',
  },
  {
    to: '/akademik/ekskul',
    title: 'Ekstrakurikuler',
    desc: 'Nilai dan deskripsi ekstrakurikuler.',
    badge: 'Segera',
  },
]

export default function AkademikHub() {
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-extrabold text-slate-900">Akademik & Rapor</h1>
        <p className="mt-1 text-sm text-muted">
          Modul penilaian akademik. Halaman detail akan dimigrasikan bertahap dari
          versi HTML.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {items.map((item) => (
          <Link
            key={item.to}
            to={item.to}
            className="flex items-start justify-between gap-3 rounded-2xl border border-border bg-white p-5 shadow-sm transition hover:border-muh-300 hover:shadow-md"
          >
            <div>
              <div className="font-bold text-slate-900">{item.title}</div>
              <p className="mt-0.5 text-sm text-muted">{item.desc}</p>
            </div>
            <span className="shrink-0 rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-amber-700 ring-1 ring-amber-100">
              {item.badge}
            </span>
          </Link>
        ))}
      </div>
    </div>
  )
}
