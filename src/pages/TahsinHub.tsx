import { Link } from 'react-router-dom'

const items = [
  {
    to: '/tahsin/input-setoran',
    title: 'Input Setoran',
    desc: 'Catat setoran hafalan / bacaan siswa.',
    badge: 'Segera',
  },
  {
    to: '/tahsin/riwayat',
    title: 'Riwayat Siswa',
    desc: 'Lihat riwayat setoran per siswa.',
    badge: 'Segera',
  },
  {
    to: '/tahsin/target',
    title: 'Target Hafalan',
    desc: 'Atur target hafalan per kelas / siswa.',
    badge: 'Segera',
  },
  {
    to: '/tahsin/laporan',
    title: 'Cetak Laporan',
    desc: 'Generate laporan kemajuan tahsin-tahfizh.',
    badge: 'Segera',
  },
]

export default function TahsinHub() {
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-extrabold text-slate-900">Tahsin & Tahfizh</h1>
        <p className="mt-1 text-sm text-muted">
          Modul penilaian bacaan Al-Qur&apos;an dan hafalan. Halaman detail akan
          dimigrasikan dari versi HTML.
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
