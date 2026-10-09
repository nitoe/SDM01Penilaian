import { Link } from 'react-router-dom'

const items = [
  { to: '/akademik/setup-tp', title: 'Setup TP & KKTP', desc: 'Tujuan pembelajaran dan KKTP' },
  { to: '/akademik/nilai', title: 'Input Nilai', desc: 'Nilai mapel, STS, SAS, SLM' },
  { to: '/akademik/siswa', title: 'Kelola Siswa', desc: 'Data siswa, NISN, mutasi, impor' },
  { to: '/akademik/rapor', title: 'Rapor', desc: 'Kelengkapan dan cetak rapor' },
  { to: '/akademik/absensi', title: 'Absensi', desc: 'Rekap kehadiran siswa' },
  { to: '/akademik/ekskul', title: 'Ekstrakurikuler', desc: 'Nilai dan deskripsi ekskul' },
]

export default function AkademikHub() {
  return (
    <div className="space-y-3">
      <div>
        <h1 className="text-[15px] font-semibold text-slate-900">Akademik & Rapor</h1>
        <p className="mt-0.5 text-[11px] text-muted">Modul penilaian akademik</p>
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
