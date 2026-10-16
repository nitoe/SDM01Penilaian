import { useCallback, useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'

/**
 * Notifikasi singkat mengambang. `posisi` (kelas Tailwind bottom-*) dipakai halaman yang punya bilah simpan
 * menempel di bawah, agar notifikasi tidak menutup tombol Simpan.
 */
export function useToast(posisi = 'bottom-20 md:bottom-6') {
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
      className={`fixed ${posisi} left-1/2 z-50 max-w-[90vw] -translate-x-1/2 rounded-lg px-4 py-2 text-[12px] font-medium text-white shadow-lg ${
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
    <Link
      to={to}
      className="inline-flex items-center gap-1 text-[12px] font-medium text-muh-700 hover:underline"
    >
      ← {children}
    </Link>
  )
}

export function NoticeAksesGuru({ aksi, role }: { aksi: string; role: string }) {
  const siapa = role === 'admin' ? 'administrator' : 'ini'
  return (
    <Notice tone="warn">
      {aksi} oleh guru kelas maupun guru bidang studi yang mengampu mapel itu. Akun {siapa} tidak
      menulis halaman ini.
    </Notice>
  )
}

export function Notice({
  children,
  tone = 'info',
}: {
  children: ReactNode
  tone?: 'info' | 'ok' | 'warn' | 'error'
}) {
  const cls = {
    info: 'border-muh-200 bg-muh-50 text-muh-900',
    ok: 'border-emerald-200 bg-emerald-50 text-emerald-900',
    warn: 'border-amber-200 bg-amber-50 text-amber-900',
    error: 'border-red-200 bg-red-50 text-red-900',
  }[tone]
  return (
    <div
      role={tone === 'error' ? 'alert' : undefined}
      className={`rounded-lg border px-3.5 py-2.5 text-[12px] leading-relaxed ${cls}`}
    >
      {children}
    </div>
  )
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
  'bg-emerald-50 text-emerald-700',
]

/** Token form/tombol — selaras radius formal di seluruh app (ANTIREGRESI §19, §20). */
export const inputCls =
  'w-full rounded-lg border border-border bg-white px-3 py-2 text-[13px] outline-none focus:border-muh-500 focus:ring-2 focus:ring-muh-500/15 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500'
export const btnPrimary =
  'rounded-lg bg-muh-600 px-4 py-2 text-[13px] font-semibold text-white transition hover:bg-muh-700 disabled:opacity-50'
export const btnGhost =
  'rounded-lg border border-border bg-white px-3.5 py-2 text-[13px] font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50'
export const selectCls =
  'rounded-lg border border-border bg-white px-2.5 py-1.5 text-[13px] outline-none focus:border-muh-500'

/** Varian kecil untuk aksi di baris/daftar. */
export const btnPrimarySm =
  'rounded-lg bg-muh-600 px-3 py-1.5 text-[12px] font-semibold text-white transition hover:bg-muh-700 disabled:opacity-50'
export const btnGhostSm =
  'rounded-lg border border-border bg-white px-3 py-1.5 text-[12px] font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50'
/** Aksi merusak: merah hanya untuk hapus permanen (ANTIREGRESI §19.2). */
export const btnDanger =
  'rounded-lg bg-red-700 px-3.5 py-2 text-[13px] font-semibold text-white transition hover:bg-red-800 disabled:opacity-50'
export const btnDangerGhost =
  'rounded-lg border border-red-200 bg-white px-3.5 py-2 text-[13px] font-medium text-red-700 transition hover:bg-red-50 disabled:opacity-50'
export const btnDangerGhostSm =
  'rounded-lg border border-red-200 bg-white px-3 py-1.5 text-[12px] font-medium text-red-700 transition hover:bg-red-50 disabled:opacity-50'
/** Konfirmasi tindakan yang bisa dibalik (mis. menonaktifkan akun). */
export const btnWarn =
  'rounded-lg bg-amber-700 px-3.5 py-2 text-[13px] font-semibold text-white transition hover:bg-amber-800 disabled:opacity-50'

/** Label di atas isian, dengan petunjuk dan tanda wajib. */
export function Field({
  label,
  hint,
  required,
  children,
}: {
  label: string
  hint?: ReactNode
  required?: boolean
  children: ReactNode
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[12px] font-medium text-slate-700">
        {label}
        {required && <span className="text-peach-500"> *</span>}
      </span>
      {children}
      {hint && <span className="mt-1 block text-[11.5px] leading-snug text-muted">{hint}</span>}
    </label>
  )
}

/**
 * Chip pilihan (saringan atau pilih kelas). `perhatian` memberi sorotan ambar pada chip yang
 * jumlahnya perlu ditindaklanjuti (mis. akun menunggu persetujuan).
 */
export function ChipToggle({
  active,
  onClick,
  children,
  count,
  perhatian,
  disabled,
}: {
  active: boolean
  onClick: () => void
  children: ReactNode
  count?: number
  perhatian?: boolean
  disabled?: boolean
}) {
  const tone = active
    ? 'bg-muh-600 text-white'
    : perhatian && (count ?? 0) > 0
      ? 'bg-peach-50 text-peach-500 hover:bg-peach-100'
      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
  return (
    <button
      type="button"
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[12px] font-medium transition disabled:opacity-60 ${tone}`}
    >
      {children}
      {count !== undefined && (
        <span className={`tabular text-[11px] ${active ? 'text-white/80' : 'opacity-70'}`}>{count}</span>
      )}
    </button>
  )
}

/** Pilihan satu dari beberapa (mis. semester): kontrol bersegmen, bukan tombol terpisah. */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  disabled,
}: {
  options: { value: T; label: string }[]
  value: T
  onChange: (v: T) => void
  disabled?: boolean
}) {
  return (
    <div role="group" className="flex rounded-lg border border-border bg-slate-50 p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={value === o.value}
          disabled={disabled}
          onClick={() => onChange(o.value)}
          className={`flex-1 rounded-md px-3 py-1.5 text-[13px] font-medium transition disabled:opacity-60 ${
            value === o.value ? 'bg-white text-muh-700 shadow-sm ring-1 ring-border' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}
