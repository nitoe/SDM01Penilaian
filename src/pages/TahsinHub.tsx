import { Link } from 'react-router-dom'

const items = [
  {
    to: '/tahsin/input-setoran',
    title: 'Input Setoran',
    desc: 'Catat setoran hafalan / bacaan siswa',
    ready: true,
  },
  {
    to: '/tahsin/riwayat',
    title: 'Riwayat Siswa',
    desc: 'Riwayat setoran per siswa',
    ready: false,
  },
  {
    to: '/tahsin/target',
    title: 'Target Hafalan',
    desc: 'Target per kelas / siswa',
    ready: false,
  },
  {
    to: '/tahsin/laporan',
    title: 'Cetak Laporan',
    desc: 'Laporan kemajuan tahsin-tahfizh',
    ready: false,
  },
]

export default function TahsinHub() {
  return (
    <div className="space-y-3">
      <div>
        <h1 className="text-[15px] font-semibold text-slate-900">Tahsin & Tahfizh</h1>
        <p className="mt-0.5 text-[11px] text-muted">
          Penilaian bacaan Al-Qur&apos;an dan hafalan
        </p>
      </div>

      <div className="overflow-hidden rounded-lg border border-border bg-white">
        {items.map((item, i) => (
          <Link
            key={item.to}
            to={item.to}
            className={`flex items-center justify-between gap-3 px-3 py-2.5 transition hover:bg-slate-50 ${
              i > 0 ? 'border-t border-border' : ''
            }`}
          >
            <div className="min-w-0">
              <div className="text-[13px] font-medium text-slate-900">{item.title}</div>
              <p className="text-[11px] text-muted">{item.desc}</p>
            </div>
            <span
              className={`shrink-0 rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide ${
                item.ready
                  ? 'bg-muh-50 text-muh-700'
                  : 'bg-slate-100 text-slate-500'
              }`}
            >
              {item.ready ? 'Siap' : 'Segera'}
            </span>
          </Link>
        ))}
      </div>
    </div>
  )
}
