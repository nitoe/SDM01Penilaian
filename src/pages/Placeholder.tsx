import { Link, useLocation } from 'react-router-dom'
import { IconTile } from '../components/ui'

export default function Placeholder() {
  const location = useLocation()

  return (
    <div className="card-soft mx-auto mt-6 max-w-md px-6 py-10 text-center">
      <div className="flex justify-center">
        <IconTile name="clipboard" tone="peach" size="lg" />
      </div>
      <p className="mt-4 text-[15px] font-semibold text-slate-900">Halaman belum tersedia</p>
      <p className="mx-auto mt-1.5 max-w-xs text-[12.5px] text-muted">
        <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[11px]">
          {location.pathname}
        </code>{' '}
        akan dimigrasikan pada tahap berikutnya.
      </p>
      <Link
        to="/"
        className="mt-5 inline-flex rounded-full bg-muh-600 px-4 py-2 text-[13px] font-medium text-white transition hover:bg-muh-700"
      >
        Kembali ke Beranda
      </Link>
    </div>
  )
}
