import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import Icon, { type IconName } from './Icon'

/** Tone ikon: soft surface + warna ikon (lebih formal daripada lingkaran solid). */
export type Tone = 'green' | 'peach' | 'ink' | 'sky' | 'violet'

const TONE_TILE: Record<Tone, string> = {
  green: 'bg-muh-50 text-muh-700 ring-1 ring-muh-100',
  peach: 'bg-gold-50 text-gold-500 ring-1 ring-gold-100',
  ink: 'bg-slate-100 text-slate-700 ring-1 ring-slate-200/80',
  sky: 'bg-sky-50 text-sky-700 ring-1 ring-sky-100',
  violet: 'bg-violet-50 text-violet-700 ring-1 ring-violet-100',
}

export function IconTile({
  name,
  tone = 'green',
  size = 'md',
}: {
  name: IconName
  tone?: Tone
  size?: 'md' | 'lg'
}) {
  const box = size === 'lg' ? 'h-11 w-11' : 'h-9 w-9'
  const icon = size === 'lg' ? 'h-5 w-5' : 'h-[18px] w-[18px]'
  return (
    <span
      className={`flex ${box} shrink-0 items-center justify-center rounded-lg ${TONE_TILE[tone]}`}
    >
      <Icon name={name} className={icon} />
    </span>
  )
}

export function Badge({
  children,
  tone = 'neutral',
}: {
  children: ReactNode
  tone?: 'neutral' | 'green' | 'peach'
}) {
  const cls = {
    neutral: 'bg-slate-100 text-slate-600',
    green: 'bg-muh-50 text-muh-700',
    peach: 'bg-gold-50 text-gold-500',
  }[tone]
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-md px-2 py-0.5 text-[11px] font-medium tracking-wide ${cls}`}
    >
      {children}
    </span>
  )
}

/** Banner hijau formal (pengganti banner generik dashboard). */
export function HeroBanner({
  eyebrow,
  title,
  subtitle,
  children,
}: {
  eyebrow?: string
  title: string
  subtitle?: string
  children?: ReactNode
}) {
  return (
    <section className="hero-banner relative overflow-hidden rounded-[var(--radius-card)] px-5 py-5 text-white sm:px-6 sm:py-6">
      {eyebrow && (
        <p className="text-[12px] font-medium text-muh-100/90">{eyebrow}</p>
      )}
      <h1 className="mt-1 text-[20px] font-semibold leading-snug tracking-tight sm:text-[22px]">
        {title}
      </h1>
      {subtitle && (
        <p className="mt-1.5 max-w-xl text-[13px] leading-relaxed text-muh-100/85">{subtitle}</p>
      )}
      {children && <div className="mt-3.5 flex flex-wrap gap-2">{children}</div>}
    </section>
  )
}

export function Chip({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-md bg-white/12 px-2.5 py-1 text-[12px] font-medium text-white ring-1 ring-white/20 ${className}`}
    >
      {children}
    </span>
  )
}

export function StatCard({
  label,
  value,
  hint,
  icon,
  tone = 'green',
  loading,
  className = '',
}: {
  label: string
  value: number | string | null
  hint?: string
  icon: IconName
  tone?: Tone
  loading?: boolean
  className?: string
}) {
  return (
    <div className={`card-soft p-4 ${className}`}>
      <div className="flex items-start justify-between gap-2">
        <IconTile name={icon} tone={tone} />
      </div>
      <p className="mt-3 text-[12px] font-medium text-muted">{label}</p>
      {loading ? (
        <div className="mt-1.5 h-7 w-16 animate-pulse rounded bg-slate-100" />
      ) : (
        <p className="mt-0.5 text-[24px] font-semibold leading-tight tracking-tight text-slate-900">
          {value ?? '—'}
        </p>
      )}
      {hint && <p className="mt-0.5 text-[12px] text-muted">{hint}</p>}
    </div>
  )
}

export function ModuleCard({
  to,
  title,
  desc,
  icon,
  tone = 'green',
  status,
}: {
  to: string
  title: string
  desc: string
  icon: IconName
  tone?: Tone
  /** undefined = tidak tampil badge; true = Siap; false = Segera */
  status?: boolean
}) {
  return (
    <Link
      to={to}
      className="card-soft group flex items-start gap-3.5 p-4 transition"
    >
      <IconTile name={icon} tone={tone} size="lg" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[14px] font-semibold text-slate-900 group-hover:text-muh-700">
            {title}
          </span>
          {status !== undefined && (
            <Badge tone={status ? 'green' : 'neutral'}>{status ? 'Siap' : 'Segera'}</Badge>
          )}
        </div>
        <p className="mt-0.5 text-[13px] leading-snug text-muted">{desc}</p>
      </div>
    </Link>
  )
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <h2 className="mb-2.5 text-[12px] font-semibold uppercase tracking-wider text-slate-500">
      {children}
    </h2>
  )
}
