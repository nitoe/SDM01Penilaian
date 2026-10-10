import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import Icon, { type IconName } from './Icon'

/** Warna latar ikon (bulatan solid, seperti referensi dashboard). */
export type Tone = 'green' | 'peach' | 'ink' | 'sky' | 'violet'

const TONE: Record<Tone, string> = {
  green: 'bg-muh-600 text-white',
  peach: 'bg-peach-400 text-white',
  ink: 'bg-slate-900 text-white',
  sky: 'bg-sky-600 text-white',
  violet: 'bg-violet-600 text-white',
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
  const box = size === 'lg' ? 'h-12 w-12' : 'h-10 w-10'
  return (
    <span className={`flex ${box} shrink-0 items-center justify-center rounded-full ${TONE[tone]}`}>
      <Icon name={name} />
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
    neutral: 'bg-slate-100 text-slate-500',
    green: 'bg-muh-50 text-muh-700',
    peach: 'bg-peach-50 text-peach-500',
  }[tone]
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${cls}`}
    >
      {children}
    </span>
  )
}

/** Banner hijau berpendar peach di sudut (pengganti banner "Upcoming Course"). */
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
    <section className="hero-banner relative overflow-hidden rounded-card px-6 py-6 text-white">
      {eyebrow && <p className="text-[12px] font-medium text-muh-100/90">{eyebrow}</p>}
      <h1 className="mt-1 text-[22px] font-semibold leading-snug tracking-tight">{title}</h1>
      {subtitle && <p className="mt-1.5 max-w-xl text-[13px] text-muh-100/85">{subtitle}</p>}
      {children && <div className="mt-4 flex flex-wrap gap-2">{children}</div>}
    </section>
  )
}

export function Chip({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full bg-white/15 px-3 py-1 text-[12px] font-medium text-white ring-1 ring-white/20 ${className}`}
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
      <IconTile name={icon} tone={tone} />
      <p className="mt-3 text-[12px] text-muted">{label}</p>
      {loading ? (
        <div className="mt-1.5 h-7 w-16 animate-pulse rounded-md bg-slate-100" />
      ) : (
        <p className="mt-0.5 text-[26px] font-semibold leading-tight tracking-tight text-slate-900">
          {value ?? '—'}
        </p>
      )}
      {hint && <p className="mt-0.5 text-[11px] text-muted">{hint}</p>}
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
      className="card-soft group flex items-start gap-3.5 p-4 transition hover:-translate-y-0.5 hover:shadow-md"
    >
      <IconTile name={icon} tone={tone} size="lg" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[14.5px] font-semibold text-slate-900 group-hover:text-muh-700">
            {title}
          </span>
          {status !== undefined && (
            <Badge tone={status ? 'green' : 'neutral'}>{status ? 'Siap' : 'Segera'}</Badge>
          )}
        </div>
        <p className="mt-0.5 text-[12.5px] leading-snug text-muted">{desc}</p>
      </div>
    </Link>
  )
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <h2 className="mb-2.5 px-0.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
      {children}
    </h2>
  )
}
