import { useCallback, useEffect, useState } from 'react'
import {
  ayatKritis,
  hitungStat,
  ketukKata,
  pecahKata,
  setStatusAyat,
  tandaKosong,
  type TandaPerAyat,
} from '../lib/bacaTandai'
import { fetchSurahText } from '../lib/quranText'
import type { JenisKata } from '../types/tahsin'

const NAMA_JENIS: Record<JenisKata, string> = { tajwid: 'tajwid', makhroj: 'makhroj' }

function Chip({ cls, n, label }: { cls: string; n: number; label: string }) {
  return (
    <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${cls}`}>
      <span aria-hidden="true">{n}</span> {label}
    </span>
  )
}

/** Satu kata Arab yang bisa diketuk: bersih → tajwid → makhroj → bersih. */
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
      <span className="inline-block h-2.5 w-2.5 rounded-full bg-[#f5c542] align-middle" /> Tajwid, dua kali ={' '}
      <span className="inline-block h-2.5 w-2.5 rounded-full bg-[#e0604f] align-middle" /> Makhroj, tiga kali =
      bersih lagi.
    </p>
  )
}

interface BacaTandaiProps {
  surah: number
  mulai: number
  akhir: number
  tanda: TandaPerAyat
  onChange: (t: TandaPerAyat) => void
}

/** Baca & Tandai untuk rentang ayat dalam satu surah: tandai kata salah dan status Lulus / Perlu diulang per ayat. */
export function BacaTandai({ surah, mulai, akhir, tanda, onChange }: BacaTandaiProps) {
  const [teks, setTeks] = useState<Record<number, string> | null>(null)
  const [muat, setMuat] = useState<'loading' | 'ok' | 'error'>('loading')

  const unduh = useCallback(() => {
    let batal = false
    setMuat('loading')
    setTeks(null)
    fetchSurahText(surah)
      .then((a) => {
        if (batal) return
        setTeks(Object.fromEntries(a.map((x) => [x.nomorAyat, x.teksArab])))
        setMuat('ok')
      })
      .catch((e) => {
        console.error(e)
        if (!batal) setMuat('error')
      })
    return () => {
      batal = true
    }
  }, [surah])

  useEffect(() => unduh(), [unduh])

  const stat = hitungStat(tanda)
  const nomor: number[] = []
  for (let n = mulai; n <= akhir; n++) nomor.push(n)

  const ubah = (n: number, fn: (t: (typeof tanda)[number]) => (typeof tanda)[number]) =>
    onChange({ ...tanda, [n]: fn(tanda[n] ?? tandaKosong()) })

  return (
    <div className="space-y-2.5">
      <div className="flex flex-wrap gap-1.5" aria-live="polite">
        <Chip cls="bg-[#fdf3d8] text-[#8a6a0c]" n={stat.tajwid} label="Tajwid" />
        <Chip cls="bg-red-50 text-red-700" n={stat.makhroj} label="Makhroj" />
        <Chip cls="bg-muh-50 text-muh-700" n={stat.lulus} label="Lulus" />
        <Chip cls="bg-amber-50 text-amber-800" n={stat.gagal} label="Perlu diulang" />
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
          Teks ayat belum bisa dimuat (periksa koneksi internet). Status Lulus / Perlu diulang per ayat tetap bisa
          ditandai di bawah.
          <button
            type="button"
            onClick={() => void unduh()}
            className="ml-2 rounded-lg border border-amber-300 bg-white px-2 py-0.5 text-[11px] font-semibold"
          >
            Coba lagi
          </button>
        </div>
      )}

      {muat !== 'loading' &&
        nomor.map((n) => {
          const t = tanda[n] ?? tandaKosong()
          const kata = pecahKata(teks?.[n] ?? '')
          const kritis = ayatKritis(t)
          return (
            <div
              key={n}
              className={`rounded-xl border p-2.5 ${
                t.status === 'lulus'
                  ? 'border-muh-300 bg-muh-50/60'
                  : t.status === 'gagal'
                    ? 'border-red-300 bg-red-50/60'
                    : 'border-border bg-white'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="flex h-7 min-w-7 items-center justify-center rounded-full bg-slate-100 px-2 text-[11px] font-semibold text-slate-600">
                  {n}
                </span>
                <div className="flex gap-1.5">
                  <button
                    type="button"
                    aria-pressed={t.status === 'lulus'}
                    aria-label={`Ayat ${n}: lulus`}
                    onClick={() => ubah(n, (x) => setStatusAyat(x, 'lulus'))}
                    className={`flex h-8 w-8 items-center justify-center rounded-full border text-[15px] font-bold transition ${
                      t.status === 'lulus'
                        ? 'border-muh-600 bg-muh-600 text-white'
                        : 'border-border bg-white text-slate-400 hover:text-muh-700'
                    }`}
                  >
                    ✓
                  </button>
                  <button
                    type="button"
                    aria-pressed={t.status === 'gagal'}
                    aria-label={`Ayat ${n}: perlu diulang`}
                    onClick={() => ubah(n, (x) => setStatusAyat(x, 'gagal'))}
                    className={`flex h-8 w-8 items-center justify-center rounded-full border text-[15px] font-bold transition ${
                      t.status === 'gagal'
                        ? 'border-red-600 bg-red-600 text-white'
                        : 'border-border bg-white text-slate-400 hover:text-red-700'
                    }`}
                  >
                    ✕
                  </button>
                </div>
              </div>

              <div dir="rtl" lang="ar" className="font-arab mt-1 text-right text-slate-900">
                {kata.length ? (
                  kata.map((w, i) => (
                    <Kata
                      key={i}
                      teks={w}
                      jenis={t.kata[i]}
                      onKetuk={() => ubah(n, (x) => ketukKata(x, i))}
                    />
                  ))
                ) : (
                  <span dir="ltr" className="text-[12px] text-muted">
                    Teks tidak tersedia
                  </span>
                )}
              </div>

              {kritis && (
                <p className="mt-1 inline-block rounded-md bg-red-100 px-2 py-0.5 text-[11px] font-semibold text-red-800">
                  ⚠ Ayat kritis — kesalahan ≥ 3
                </p>
              )}
            </div>
          )
        })}
    </div>
  )
}

interface KartuKataIqroProps {
  teks: string
  kata: Record<number, JenisKata>
  onBuat: (teks: string) => void
  onKetuk: (index: number) => void
}

/** Latihan membaca Iqro (opsional): tulis kata yang dibaca anak, lalu ketuk kata yang salah. */
export function KartuKataIqro({ teks, kata, onBuat, onKetuk }: KartuKataIqroProps) {
  const [input, setInput] = useState(teks)
  // Saat induk mengosongkan teks (setelah simpan), kosongkan juga kotak isian.
  useEffect(() => {
    if (!teks) setInput('')
  }, [teks])

  const kataKata = pecahKata(teks)
  const tajwid = Object.values(kata).filter((j) => j === 'tajwid').length
  const makhroj = Object.values(kata).filter((j) => j === 'makhroj').length

  return (
    <div className="space-y-2">
      <label className="block text-[10.5px] font-medium text-slate-500">
        Tulis kata/baris yang dibaca anak (pisah spasi)
      </label>
      <textarea
        dir="rtl"
        lang="ar"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder="با تا ثا جا"
        rows={2}
        className="font-arab w-full rounded-md border border-border px-2 py-1 text-right outline-none focus:border-muh-500"
      />
      <button
        type="button"
        disabled={!input.trim()}
        onClick={() => onBuat(input.trim())}
        className="rounded-lg border border-border bg-white px-3 py-1.5 text-[12px] font-semibold text-slate-700 disabled:opacity-50"
      >
        Buat kartu kata
      </button>

      {kataKata.length > 0 && (
        <>
          <Legenda />
          <div dir="rtl" lang="ar" className="font-arab rounded-xl border border-border bg-white p-2.5 text-right">
            {kataKata.map((w, i) => (
              <Kata key={i} teks={w} jenis={kata[i]} onKetuk={() => onKetuk(i)} />
            ))}
          </div>
          <div className="flex gap-1.5">
            <Chip cls="bg-[#fdf3d8] text-[#8a6a0c]" n={tajwid} label="Tajwid" />
            <Chip cls="bg-red-50 text-red-700" n={makhroj} label="Makhroj" />
          </div>
        </>
      )}
    </div>
  )
}
