/**
 * Baca & Tandai untuk materi Iqro: muat teks dari dataset (CDN),
 * tampilkan per halaman/baris, ketuk kata = tajwid → makhroj → bersih.
 * Fallback: mode teks bebas bila dataset gagal / guru ingin mengetik sendiri.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { ketukKata, tandaKosong } from '../lib/bacaTandai'
import {
  fetchRentangIqro,
  gabungTeksHalaman,
  maxHalamanIqro,
  type IqroHalaman,
} from '../lib/iqroText'
import { muatPreferensi, simpanPreferensi, type PreferensiBaca } from '../lib/preferensiBaca'
import type { JenisKata } from '../types/tahsin'
import { KartuKataIqro } from './BacaTandai'

const NAMA_JENIS: Record<JenisKata, string> = { tajwid: 'tajwid', makhroj: 'makhroj' }

function Chip({ cls, n, label }: { cls: string; n: number; label: string }) {
  return (
    <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${cls}`}>
      <span aria-hidden="true">{n}</span> {label}
    </span>
  )
}

function Kata({
  teks,
  jenis,
  onKetuk,
}: {
  teks: string
  jenis: JenisKata | undefined
  onKetuk: () => void
}) {
  return (
    <button
      type="button"
      onClick={onKetuk}
      className={`kata-arab ${jenis ? `kata-${jenis}` : ''}`}
      aria-label={`${teks}${jenis ? `, ditandai ${NAMA_JENIS[jenis]}` : ''}`}
    >
      {teks}
    </button>
  )
}

function Legenda() {
  return (
    <p className="text-[11px] leading-snug text-muted">
      Ketuk kata yang salah: sekali ={' '}
      <span className="inline-block h-2.5 w-2.5 rounded-full bg-[#f5c542] align-middle" /> Tajwid, dua
      kali = <span className="inline-block h-2.5 w-2.5 rounded-full bg-[#e0604f] align-middle" />{' '}
      Makhroj, tiga kali = bersih lagi.
    </p>
  )
}

export interface BacaTandaiIqroProps {
  buku: number
  halamanMulai: number
  halamanAkhir: number
  /** Index kata global → jenis kesalahan (skema detailBacaanIqro) */
  kata: Record<number, JenisKata>
  /** Dipanggil saat teks (gabungan) atau tanda berubah */
  onChange: (teks: string, kata: Record<number, JenisKata>) => void
}

export function BacaTandaiIqro({
  buku,
  halamanMulai,
  halamanAkhir,
  kata,
  onChange,
}: BacaTandaiIqroProps) {
  const [halaman, setHalaman] = useState<IqroHalaman[]>([])
  const [gagal, setGagal] = useState<number[]>([])
  const [muat, setMuat] = useState<'loading' | 'ok' | 'error'>('loading')
  const [modeBebas, setModeBebas] = useState(false)
  const [teksBebas, setTeksBebas] = useState('')
  const [pref, setPref] = useState<PreferensiBaca>(() => muatPreferensi())

  const ubahPref = (p: Partial<PreferensiBaca>) => {
    setPref((lama) => {
      const baru = { ...lama, ...p }
      simpanPreferensi(baru)
      return baru
    })
  }

  const unduh = useCallback(() => {
    let batal = false
    setMuat('loading')
    setHalaman([])
    setGagal([])
    const max = maxHalamanIqro(buku)
    const mulai = Math.min(Math.max(1, halamanMulai), max)
    const akhir = Math.min(Math.max(mulai, halamanAkhir), max)
    fetchRentangIqro(buku, mulai, akhir)
      .then(({ ok, gagal: g }) => {
        if (batal) return
        setHalaman(ok)
        setGagal(g)
        setMuat(ok.length ? 'ok' : 'error')
        if (ok.length) onChange(gabungTeksHalaman(ok), {})
      })
      .catch((e) => {
        console.error(e)
        if (!batal) setMuat('error')
      })
    return () => {
      batal = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buku, halamanMulai, halamanAkhir])

  useEffect(() => unduh(), [unduh])

  /** Baris datar + index global awal tiap baris. */
  const barisDatar = useMemo(() => {
    const out: {
      key: string
      halaman: number
      topikLatin: string
      topikArab: string
      instruksi: string
      barisNo: number
      teksLatin: string
      kata: string[]
      startIndex: number
      isFirstOfPage: boolean
    }[] = []
    let idx = 0
    for (const p of halaman) {
      p.baris.forEach((b, bi) => {
        out.push({
          key: `${p.halaman}-${b.no}`,
          halaman: p.halaman,
          topikLatin: p.topikLatin,
          topikArab: p.topikArab,
          instruksi: p.instruksi,
          barisNo: b.no,
          teksLatin: b.teksLatin,
          kata: b.kata,
          startIndex: idx,
          isFirstOfPage: bi === 0,
        })
        idx += b.kata.length
      })
    }
    return out
  }, [halaman])

  const teksGabung = useMemo(() => gabungTeksHalaman(halaman), [halaman])

  const tajwid = Object.values(kata).filter((j) => j === 'tajwid').length
  const makhroj = Object.values(kata).filter((j) => j === 'makhroj').length

  function ketukGlobal(index: number) {
    const hasil = ketukKata({ ...tandaKosong(), kata }, index)
    onChange(teksGabung, hasil.kata)
  }

  if (modeBebas) {
    return (
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-[12px] text-muted">Mode teks bebas — ketik baris yang dibaca anak.</p>
          <button
            type="button"
            onClick={() => {
              setModeBebas(false)
              void unduh()
            }}
            className="rounded-lg border border-border bg-white px-2.5 py-1 text-[11px] font-semibold text-muh-700"
          >
            Kembali ke dataset Iqro
          </button>
        </div>
        <KartuKataIqro
          teks={teksBebas}
          kata={kata}
          onBuat={(t) => {
            setTeksBebas(t)
            onChange(t, {})
          }}
          onKetuk={(i) => {
            const hasil = ketukKata({ ...tandaKosong(), kata }, i)
            onChange(teksBebas, hasil.kata)
          }}
        />
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[12.5px] text-slate-700">
          Iqro jilid <strong>{buku}</strong> · Hal.{' '}
          <strong>
            {halamanMulai}
            {halamanAkhir !== halamanMulai ? `–${halamanAkhir}` : ''}
          </strong>
          <span className="text-muted"> · maks. {maxHalamanIqro(buku)} hlm</span>
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            role="switch"
            aria-checked={pref.latin}
            onClick={() => ubahPref({ latin: !pref.latin })}
            className="text-[12px] font-medium text-slate-600"
          >
            {pref.latin ? '✓ Latin' : 'Latin'}
          </button>
          <div className="flex items-center gap-1" role="group" aria-label="Ukuran teks Arab">
            <button
              type="button"
              onClick={() => ubahPref({ ukuran: Math.max(1, pref.ukuran - 1) as 1 | 2 | 3 })}
              disabled={pref.ukuran === 1}
              className="h-7 w-7 rounded-md border border-border text-[12px] font-bold text-slate-600 disabled:opacity-40"
            >
              A−
            </button>
            <button
              type="button"
              onClick={() => ubahPref({ ukuran: Math.min(3, pref.ukuran + 1) as 1 | 2 | 3 })}
              disabled={pref.ukuran === 3}
              className="h-7 w-7 rounded-md border border-border text-[14px] font-bold text-slate-600 disabled:opacity-40"
            >
              A+
            </button>
          </div>
          <button
            type="button"
            onClick={() => {
              setTeksBebas('')
              setModeBebas(true)
              onChange('', {})
            }}
            className="rounded-lg border border-border bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-600"
          >
            Teks bebas
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5" aria-live="polite">
        <Chip cls="bg-[#fdf3d8] text-[#8a6a0c]" n={tajwid} label="Tajwid" />
        <Chip cls="bg-red-50 text-red-700" n={makhroj} label="Makhroj" />
      </div>
      <Legenda />

      {muat === 'loading' && (
        <div className="space-y-2" aria-busy="true">
          <div className="h-20 animate-pulse rounded-xl bg-slate-100" />
          <div className="h-20 animate-pulse rounded-xl bg-slate-100" />
        </div>
      )}

      {muat === 'error' && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-[12px] text-amber-900">
          Teks halaman belum bisa dimuat (periksa koneksi atau coba teks bebas).
          <button
            type="button"
            onClick={() => void unduh()}
            className="ml-2 rounded-lg border border-amber-300 bg-white px-2 py-0.5 text-[11px] font-semibold"
          >
            Coba lagi
          </button>
          <button
            type="button"
            onClick={() => setModeBebas(true)}
            className="ml-1 rounded-lg border border-amber-300 bg-white px-2 py-0.5 text-[11px] font-semibold"
          >
            Teks bebas
          </button>
        </div>
      )}

      {gagal.length > 0 && muat === 'ok' && (
        <p className="text-[11.5px] text-amber-800">
          Halaman tidak tersedia di dataset: {gagal.join(', ')}. Sisanya tetap bisa ditandai.
        </p>
      )}

      {muat === 'ok' && (
        <div className="space-y-3">
          {barisDatar.map((b) => (
            <div key={b.key}>
              {b.isFirstOfPage && (
                <div className="mb-1.5 flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-semibold text-slate-600">
                    Hal. {b.halaman}
                  </span>
                  {(b.topikLatin || b.topikArab) && (
                    <span className="text-[12px] text-slate-600">
                      {b.topikLatin}
                      {b.topikArab ? (
                        <span dir="rtl" lang="ar" className="font-arab mr-1 ml-2">
                          {b.topikArab}
                        </span>
                      ) : null}
                    </span>
                  )}
                </div>
              )}
              {b.isFirstOfPage && b.instruksi && (
                <p className="mb-1.5 text-[11px] leading-snug text-muted">{b.instruksi}</p>
              )}
              <div className="rounded-lg border border-border bg-white px-2.5 py-2">
                <div
                  dir="rtl"
                  lang="ar"
                  className={`font-arab ukuran-${pref.ukuran} text-right text-slate-900`}
                >
                  {b.kata.map((w, i) => (
                    <Kata
                      key={i}
                      teks={w}
                      jenis={kata[b.startIndex + i]}
                      onKetuk={() => ketukGlobal(b.startIndex + i)}
                    />
                  ))}
                </div>
                {pref.latin && b.teksLatin && (
                  <p className="mt-1 text-[12px] italic text-slate-600">{b.teksLatin}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {muat === 'ok' && (
        <p className="text-[10.5px] text-muted">
          Teks latihan dari dataset komunitas Iqro (OCR). Bukan penerbit resmi — gunakan teks bebas
          jika baris tidak sesuai buku fisik.
        </p>
      )}
    </div>
  )
}
