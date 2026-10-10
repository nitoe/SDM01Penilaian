import { useCallback, useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'

export function useToast() {
  const [t, setT] = useState<{ msg: string; err: boolean } | null>(null)
  const timer = useRef<number>(0)
  const show = useCallback((msg: string, err = false) => {
    setT({ msg, err })
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setT(null), 4000)
  }, [])
  const node = t ? (
    <div
      role={t.err ? 'alert' : 'status'}
      className={`fixed bottom-20 left-1/2 z-50 max-w-[90vw] -translate-x-1/2 rounded-full px-4 py-2 text-[12.5px] font-medium text-white shadow-lg md:bottom-6 ${
        t.err ? 'bg-red-600' : 'bg-slate-900'
      }`}
    >
      {t.msg}
    </div>
  ) : null
  return { show, node }
}

export function BackLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link to={to} className="inline-flex items-center gap-1 text-[12.5px] font-medium text-muh-700 hover:underline">
      ← {children}
    </Link>
  )
}

export function Notice({ children, tone = 'info' }: { children: ReactNode; tone?: 'info' | 'warn' | 'error' }) {
  const cls = {
    info: 'border-sky-200 bg-sky-50 text-sky-900',
    warn: 'border-amber-200 bg-amber-50 text-amber-900',
    error: 'border-red-200 bg-red-50 text-red-900',
  }[tone]
  return <div className={`rounded-xl border px-3.5 py-2.5 text-[12.5px] leading-relaxed ${cls}`}>{children}</div>
}

export function Spinner() {
  return (
    <div className="flex justify-center py-10">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-muh-200 border-t-muh-600" />
    </div>
  )
}

export const LEVEL_WARNA = [
  'bg-red-50 text-red-700',
  'bg-amber-50 text-amber-700',
  'bg-sky-50 text-sky-700',
  'bg-muh-50 text-muh-700',
]

export const inputCls =
  'w-full rounded-xl border border-border bg-white px-3 py-2 text-[13px] outline-none focus:border-muh-500 focus:ring-2 focus:ring-muh-500/15'
export const btnPrimary =
  'rounded-xl bg-muh-600 px-4 py-2 text-[13px] font-semibold text-white transition hover:bg-muh-700 disabled:opacity-50'
export const btnGhost =
  'rounded-xl border border-border bg-white px-3.5 py-2 text-[13px] font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50'
