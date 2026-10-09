import { Link, useLocation } from 'react-router-dom'

/** Halaman sementara untuk route yang belum dimigrasikan */
export default function Placeholder() {
  const location = useLocation()

  return (
    <div className="rounded-3xl border border-dashed border-border bg-white p-8 text-center">
      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-muh-50 text-2xl text-muh-700">
        ⏳
      </div>
      <h1 className="text-lg font-extrabold text-slate-900">Halaman belum tersedia</h1>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted">
        Route <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs">{location.pathname}</code>{' '}
        akan dimigrasikan dari versi HTML pada tahap berikutnya.
      </p>
      <Link
        to="/"
        className="mt-6 inline-flex rounded-xl bg-muh-700 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-muh-800"
      >
        Kembali ke Beranda
      </Link>
    </div>
  )
}
