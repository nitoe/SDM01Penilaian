import { useEffect, useRef, useState, useCallback } from 'react'

const PESAN =
  'Ada nilai yang belum disimpan. Jika keluar sekarang, perubahan bisa hilang. Tetap tinggal di halaman ini?'

/**
 * Lindungi halaman input nilai:
 * - beforeunload saat tab ditutup / refresh
 * - klik tautan internal (sidebar, back, menu) → dialog konfirmasi
 * - history.back / tombol back browser → konfirmasi
 *
 * Catatan: BrowserRouter tidak mendukung useBlocker; pendekatan ini cukup untuk kasus guru senior.
 */
export function useUnsavedGuard(dirty: boolean) {
  const dirtyRef = useRef(dirty)
  dirtyRef.current = dirty

  const [dialog, setDialog] = useState<{ href: string } | null>(null)
  const pendingHref = useRef<string | null>(null)

  // Tutup tab / refresh
  useEffect(() => {
    function onBeforeUnload(e: BeforeUnloadEvent) {
      if (!dirtyRef.current) return
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [])

  // Klik tautan internal (sidebar Layout, BackLink, dll.)
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (!dirtyRef.current) return
      if (e.defaultPrevented) return
      if (e.button !== 0) return
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return

      const el = (e.target as Element | null)?.closest?.('a[href]') as HTMLAnchorElement | null
      if (!el) return
      const href = el.getAttribute('href')
      if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) return
      // tautan luar
      if (/^https?:\/\//i.test(href) && !href.startsWith(window.location.origin)) return
      const url = new URL(href, window.location.origin)
      const same =
        url.pathname === window.location.pathname &&
        url.search === window.location.search &&
        url.hash === window.location.hash
      if (same) return

      e.preventDefault()
      e.stopPropagation()
      pendingHref.current = url.pathname + url.search + url.hash
      setDialog({ href: pendingHref.current })
    }
    document.addEventListener('click', onClick, true)
    return () => document.removeEventListener('click', onClick, true)
  }, [])

  // Tombol back browser
  useEffect(() => {
    if (!dirty) return
    const sentinel = window.location.href
    window.history.pushState({ unsavedGuard: true }, '', sentinel)

    function onPopState() {
      if (!dirtyRef.current) return
      window.history.pushState({ unsavedGuard: true }, '', sentinel)
      pendingHref.current = '__BACK__'
      setDialog({ href: '__BACK__' })
    }
    window.addEventListener('popstate', onPopState)
    return () => {
      window.removeEventListener('popstate', onPopState)
    }
  }, [dirty])

  const stay = useCallback(() => {
    pendingHref.current = null
    setDialog(null)
  }, [])

  const leave = useCallback(() => {
    const href = pendingHref.current
    pendingHref.current = null
    setDialog(null)
    dirtyRef.current = false
    if (!href || href === '__BACK__') {
      window.history.go(-2)
      return
    }
    window.location.assign(href)
  }, [])

  const dialogNode = dialog ? (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="unsaved-title"
    >
      <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
        <h2 id="unsaved-title" className="text-[16px] font-bold text-slate-900">
          Nilai belum disimpan
        </h2>
        <p className="mt-2 text-[13.5px] leading-relaxed text-slate-600">{PESAN}</p>
        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            className="h-11 rounded-xl border border-border bg-white px-4 text-[14px] font-semibold text-slate-700 hover:bg-slate-50"
            onClick={stay}
          >
            Tetap di sini
          </button>
          <button
            type="button"
            className="h-11 rounded-xl bg-red-600 px-4 text-[14px] font-semibold text-white hover:bg-red-700"
            onClick={leave}
          >
            Keluar tanpa menyimpan
          </button>
        </div>
      </div>
    </div>
  ) : null

  return { dialogNode }
}
