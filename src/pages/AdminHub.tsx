import { Link } from 'react-router-dom'

const items = [
  { to: '/admin/users', title: 'Kelola Akun', desc: 'Tambah / edit akun guru dan admin' },
  { to: '/admin/siswa', title: 'Data Siswa', desc: 'Master data siswa seluruh kelas' },
  { to: '/admin/ortu', title: 'Akun Orang Tua', desc: 'Persetujuan dan kelola akun ortu' },
]

export default function AdminHub() {
  return (
    <div className="space-y-3">
      <div>
        <h1 className="text-[15px] font-semibold text-slate-900">Administrasi</h1>
        <p className="mt-0.5 text-[11px] text-muted">Pengaturan sistem dan master data</p>
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
            <span className="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-slate-500">
              Segera
            </span>
          </Link>
        ))}
      </div>
    </div>
  )
}
