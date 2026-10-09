import { Link } from 'react-router-dom'

const items = [
  {
    to: '/tahsin/input-setoran',
    title: 'Input Setoran',
    desc: 'Catat setoran hafalan dan bacaan siswa',
    ready: true,
    icon: '✎',
    tone: 'from-muh-500 to-muh-700',
  },
  {
    to: '/tahsin/riwayat',
    title: 'Riwayat Siswa',
    desc: 'Progres membaca, hafalan, menulis, ringkasan',
    ready: true,
    icon: '☰',
    tone: 'from-sky-500 to-sky-700',
  },
  {
    to: '/tahsin/target',
    title: 'Target Hafalan',
    desc: 'Target per kelas dan capaian siswa',
    ready: false,
    icon: '◎',
    tone: 'from-amber-500 to-amber-700',
  },
  {
    to: '/tahsin/laporan',
    title: 'Cetak Laporan',
    desc: 'Laporan kemajuan tahsin-tahfizh',
    ready: false,
    icon: '▤',
    tone: 'from-violet-500 to-violet-700',
  },
]

export default function TahsinHub() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold tracking-tight text-slate-900">
          Tahsin & Tahfizh
        </h1>
        <p className="mt-0.5 text-[12px] text-muted">
          Penilaian bacaan Al-Qur&apos;an dan hafalan
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {items.map((item) => (
          <Link
            key={item.to}
            to={item.to}
            className="card-soft group flex gap-3.5 p-4 transition hover:-translate-y-0.5 hover:shadow-md"
          >
            <div
              className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br ${item.tone} text-sm font-bold text-white shadow-sm`}
            >
              {item.icon}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[14px] font-semibold text-slate-900 group-hover:text-muh-800">
                  {item.title}
                </span>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide ${
                    item.ready
                      ? 'bg-muh-50 text-muh-700'
                      : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  {item.ready ? 'Siap' : 'Segera'}
                </span>
              </div>
              <p className="mt-0.5 text-[12px] text-muted">{item.desc}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
