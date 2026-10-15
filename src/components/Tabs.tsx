import type { ReactNode } from 'react'

export interface TabItem {
  id: string
  label: string
  /** Angka kecil di samping label (mis. jumlah yang belum selesai). */
  hitung?: number | null
}

/** Tab ringan (tanpa dependensi). Panel dirender pemanggil sesuai `aktif`. */
export default function Tabs({
  items,
  aktif,
  onUbah,
  ariaLabel,
  children,
}: {
  items: TabItem[]
  aktif: string
  onUbah: (id: string) => void
  ariaLabel: string
  children?: ReactNode
}) {
  return (
    <div>
      <div
        role="tablist"
        aria-label={ariaLabel}
        className="flex gap-1 overflow-x-auto border-b border-border"
      >
        {items.map((t) => {
          const on = t.id === aktif
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              id={`tab-${t.id}`}
              aria-selected={on}
              aria-controls={`panel-${t.id}`}
              onClick={() => onUbah(t.id)}
              className={`relative flex shrink-0 items-center gap-1.5 px-3.5 py-2.5 text-[13px] font-medium transition-colors ${
                on
                  ? 'text-muh-800 after:absolute after:inset-x-2 after:bottom-[-1px] after:h-[2px] after:rounded-full after:bg-muh-600'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              {t.label}
              {t.hitung != null && t.hitung > 0 && (
                <span className="rounded-full bg-gold-50 px-1.5 text-[11px] font-semibold text-gold-500">
                  {t.hitung}
                </span>
              )}
            </button>
          )
        })}
      </div>
      <div role="tabpanel" id={`panel-${aktif}`} aria-labelledby={`tab-${aktif}`} className="pt-4">
        {children}
      </div>
    </div>
  )
}
