import { useCallback, useEffect, useRef, useState } from 'react'

export interface ItemAudio {
  /** Kunci untuk menandai item yang sedang diputar (mis. "a:3" atau "penuh") */
  kunci: string
  url: string
}

export interface PemutarAudio {
  /** Kunci item yang sedang diputar (atau sedang dimuat); null bila diam */
  aktif: string | null
  memuat: boolean
  galat: string | null
  /** Putar satu item (menghentikan yang sedang berjalan). Memutar item yang sama = berhenti. */
  putar: (item: ItemAudio) => void
  /** Putar berurutan; berhenti sendiri di akhir daftar. */
  putarBerurutan: (items: ItemAudio[]) => void
  berhenti: () => void
}

/**
 * Satu pemutar audio untuk seluruh halaman: hanya satu suara pada satu waktu. Dibersihkan saat komponen dilepas.
 * Audio dimuat dari alamat yang sudah divalidasi (lihat audioAman di quranText.ts).
 */
export function useAudio(): PemutarAudio {
  const el = useRef<HTMLAudioElement | null>(null)
  const antrean = useRef<ItemAudio[]>([])
  const [aktif, setAktif] = useState<string | null>(null)
  const [memuat, setMemuat] = useState(false)
  const [galat, setGalat] = useState<string | null>(null)

  const berhenti = useCallback(() => {
    antrean.current = []
    const a = el.current
    if (a) {
      a.pause()
      a.removeAttribute('src')
      a.load()
    }
    setAktif(null)
    setMemuat(false)
  }, [])

  const mulai = useCallback((item: ItemAudio) => {
    if (!el.current) {
      const a = new Audio()
      a.preload = 'none'
      a.addEventListener('playing', () => setMemuat(false))
      a.addEventListener('waiting', () => setMemuat(true))
      a.addEventListener('ended', () => {
        const berikut = antrean.current.shift()
        if (berikut) mulai(berikut)
        else {
          setAktif(null)
          setMemuat(false)
        }
      })
      a.addEventListener('error', () => {
        antrean.current = []
        setAktif(null)
        setMemuat(false)
        setGalat('Audio tidak dapat diputar. Periksa koneksi internet.')
      })
      el.current = a
    }
    const a = el.current
    setGalat(null)
    setAktif(item.kunci)
    setMemuat(true)
    a.src = item.url
    void a.play().catch((e: unknown) => {
      // AbortError terjadi wajar saat pindah item dengan cepat; selain itu tampilkan pesan.
      if ((e as { name?: string })?.name === 'AbortError') return
      antrean.current = []
      setAktif(null)
      setMemuat(false)
      setGalat('Audio tidak dapat diputar. Periksa koneksi internet.')
    })
  }, [])

  const putar = useCallback(
    (item: ItemAudio) => {
      if (aktif === item.kunci) {
        berhenti()
        return
      }
      antrean.current = []
      mulai(item)
    },
    [aktif, berhenti, mulai],
  )

  const putarBerurutan = useCallback(
    (items: ItemAudio[]) => {
      if (!items.length) return
      const [pertama, ...sisa] = items
      antrean.current = sisa
      mulai(pertama!)
    },
    [mulai],
  )

  useEffect(
    () => () => {
      const a = el.current
      if (a) {
        a.pause()
        a.removeAttribute('src')
      }
    },
    [],
  )

  return { aktif, memuat, galat, putar, putarBerurutan, berhenti }
}
