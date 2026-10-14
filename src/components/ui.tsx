import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import Icon, { type IconName } from './Icon'

/** Tone ikon: soft surface + warna ikon. */
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
  const box = size === 'lg' ? 'h-10 w-10' : 'h-8 w-8'
  const icon = size === 'lg' ? 'h-[18px] w-[18px]' : 'h-4 w-4'
  return (
    <span
      className={`flex ${box} shrink-0 items-center justify-center rounded-md ${TONE_TILE[tone]}`}
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
      className={`inline-flex shrink-0 items-center rounded px-1.5 py-0.5 text-[11px] font-medium ${cls}`}
    >
      {children}
    </span>
  )
}

/** Banner hanya untuk beranda / login — jangan dipakai di hub modul. */
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

/** Judul halaman kerja/hub — ringkas, formal, tanpa banner hijau. */
export function PageHeader({
  title,
  subtitle,
  actions,
  back,
  eyebrow,
}: {
  title: string
  subtitle?: ReactNode
  actions?: ReactNode
  /** Tautan kembali (mis. ke hub modul). */
  back?: { to: string; label: string }
  /** Label kecil di atas judul (opsional). */
  eyebrow?: string
}) {
  return (
    <div className="border-b border-border pb-4">
      {back && (
        <Link
          to={back.to}
          className="mb-2 inline-flex items-center gap-1 text-[12px] font-medium text-muh-700 hover:underline"
        >
          ← {back.label}
        </Link>
      )}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          {eyebrow && (
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              {eyebrow}
            </p>
          )}
          <h1
            className={`text-[18px] font-semibold tracking-tight text-slate-900 sm:text-[20px] ${
              eyebrow ? 'mt-0.5' : ''
            }`}
          >
            {title}
          </h1>
          {subtitle && (
            <p className="mt-0.5 max-w-2xl text-[13px] leading-snug text-muted">{subtitle}</p>
          )}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </div>
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
      <IconTile name={icon} tone={tone} />
      <p className="mt-3 text-[12px] font-medium text-muted">{label}</p>
      {loading ? (
        <div className="mt-1.5 h-7 w-16 animate-pulse rounded bg-slate-100" />
      ) : (
        <p className="mt-0.5 text-[22px] font-semibold leading-tight tracking-tight text-slate-900">
          {value ?? '—'}
        </p>
      )}
      {hint && <p className="mt-0.5 text-[12px] text-muted">{hint}</p>}
    </div>
  )
}

/** Kartu modul lama — masih dipakai di beberapa tempat; prefer HubRow untuk indeks. */
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
  status?: boolean
}) {
  return (
    <Link to={to} className="card-soft group flex items-start gap-3 p-3.5 transition">
      <IconTile name={icon} tone={tone} size="lg" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[14px] font-semibold text-slate-900 group-hover:text-muh-700">
            {title}
          </span>
          {status === false && <Badge tone="neutral">Segera</Badge>}
        </div>
        <p className="mt-0.5 text-[12px] leading-snug text-muted">{desc}</p>
      </div>
    </Link>
  )
}

/**
 * Baris indeks hub — padat, formal, cocok untuk daftar alur kerja.
 * Status false = nonaktif/segera (tidak bisa diklik atau ditandai Segera).
 */
export function HubRow({
  to,
  title,
  desc,
  icon,
  tone = 'green',
  ready = true,
}: {
  to: string
  title: string
  desc: string
  icon: IconName
  tone?: Tone
  ready?: boolean
}) {
  const inner = (
    <>
      <IconTile name={icon} tone={ready ? tone : 'ink'} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span
            className={`text-[13.5px] font-semibold ${
              ready ? 'text-slate-900 group-hover:text-muh-700' : 'text-slate-500'
            }`}
          >
            {title}
          </span>
          {!ready && <Badge tone="neutral">Segera</Badge>}
        </div>
        <p className="mt-0.5 text-[12px] leading-snug text-muted">{desc}</p>
      </div>
      {ready && (
        <Icon
          name="arrow"
          className="h-4 w-4 shrink-0 text-slate-300 transition group-hover:text-muh-600"
        />
      )}
    </>
  )

  if (!ready) {
    return (
      <div className="flex items-center gap-3 border-b border-border px-3 py-3 last:border-b-0 opacity-70">
        {inner}
      </div>
    )
  }

  return (
    <Link
      to={to}
      className="group flex items-center gap-3 border-b border-border px-3 py-3 last:border-b-0 transition hover:bg-muh-50/40"
    >
      {inner}
    </Link>
  )
}

/** Kelompok baris dalam satu kartu panel. */
export function HubPanel({
  title,
  children,
}: {
  title: string
  children: ReactNode
}) {
  return (
    <section className="card-soft overflow-hidden">
      <div className="border-b border-border bg-slate-50/80 px-3.5 py-2.5">
        <h2 className="text-[12px] font-semibold uppercase tracking-wider text-slate-500">
          {title}
        </h2>
      </div>
      <div>{children}</div>
    </section>
  )
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <h2 className="mb-2 text-[12px] font-semibold uppercase tracking-wider text-slate-500">
      {children}
    </h2>
  )
}
