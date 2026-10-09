import { Link } from 'react-router-dom'

const items = [
  {
    to: '/admin/siswa',
    title: 'Data Siswa',
    desc: 'Tambah, impor CSV, seed demo, nonaktifkan',
    ready: true,
  },
  {
    to: '/admin/users',
    title: 'Kelola Akun',
    desc: 'Tambah / edit akun guru dan admin',
    ready: false,
  },
  {
    to: '/admin/ortu',
    title: 'Akun Orang Tua',
    desc: 'Persetujuan dan kelola akun ortu',
    ready: false,
  },
]

export default function AdminHub() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold tracking-tight text-slate-900">Administrasi</h1>
        <p className="mt-0.5 text-[12px] text-muted">Pengaturan sistem dan master data</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {items.map((item) => (
          <Link
            key={item.to}
            to={item.to}
            className="card-soft group flex items-start justify-between gap-3 p-4 transition hover:-translate-y-0.5 hover:shadow-md"
          >
            <div>
              <div className="text-[14px] font-semibold text-slate-900 group-hover:text-muh-800">
                {item.title}
              </div>
              <p className="mt-0.5 text-[12px] text-muted">{item.desc}</p>
            </div>
            <span
              className={`shrink-0 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide ${
                item.ready ? 'bg-muh-50 text-muh-700' : 'bg-slate-100 text-slate-500'
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
