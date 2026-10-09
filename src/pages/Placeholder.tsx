import { Link, useLocation } from 'react-router-dom'

export default function Placeholder() {
  const location = useLocation()

  return (
    <div className="rounded-lg border border-dashed border-border bg-white px-4 py-8 text-center">
      <p className="text-[13px] font-medium text-slate-800">Halaman belum tersedia</p>
      <p className="mx-auto mt-1 max-w-sm text-[11px] text-muted">
        <code className="rounded bg-slate-100 px-1 py-0.5 font-mono text-[10px]">
          {location.pathname}
        </code>{' '}
        akan dimigrasikan pada tahap berikutnya.
      </p>
      <Link
        to="/"
        className="mt-4 inline-flex rounded-md bg-muh-600 px-3 py-1.5 text-[12px] font-medium text-white hover:bg-muh-700"
      >
        Kembali ke Beranda
      </Link>
    </div>
  )
}
