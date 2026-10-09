import { Link } from 'react-router-dom'

const items = [
  {
    to: '/admin/users',
    title: 'Kelola Akun',
    desc: 'Tambah / edit akun guru dan admin.',
    badge: 'Segera',
  },
  {
    to: '/admin/siswa',
    title: 'Data Siswa',
    desc: 'Master data siswa seluruh kelas.',
    badge: 'Segera',
  },
  {
    to: '/admin/ortu',
    title: 'Akun Orang Tua',
    desc: 'Persetujuan dan kelola akun ortu.',
    badge: 'Segera',
  },
]

export default function AdminHub() {
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-extrabold text-slate-900">Administrasi</h1>
        <p className="mt-1 text-sm text-muted">
          Pengaturan sistem dan master data. Hanya role admin.
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
