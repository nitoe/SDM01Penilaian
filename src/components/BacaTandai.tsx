import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ayatKritis,
  hitungStat,
  ketukKata,
  pecahKata,
  setStatusAyat,
  tandaKosong,
  type TandaPerAyat,
} from '../lib/bacaTandai'
import { fetchSurah, qariTersedia, type SurahDetail } from '../lib/quranText'
import { muatPreferensi, simpanPreferensi, type PreferensiBaca } from '../lib/preferensiBaca'
import { useAudio } from '../lib/useAudio'
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

/** Saklar on/off yang terbaca benar oleh pembaca layar. */
function Saklar({ nyala, onUbah, label }: { nyala: boolean; onUbah: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={nyala}
      onClick={() => onUbah(!nyala)}
      className="inline-flex items-center gap-2 text-[12px] font-medium text-slate-700"
    >
      <span
        className={`relative h-5 w-9 rounded-full transition-colors ${nyala ? 'bg-muh-600' : 'bg-slate-300'}`}
        aria-hidden="true"
      >
        <span
          className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${nyala ? 'left-[18px]' : 'left-0.5'}`}
        />
      </span>
      {label}
    </button>
  )
}

function TombolPutar({
  aktif,
  memuat,
  onClick,
  label,
  disabled,
  kecil,
}: {
  aktif: boolean
  memuat: boolean
  onClick: () => void
  label: string
  disabled?: boolean
  kecil?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      aria-pressed={aktif}
      title={label}
      className={`flex shrink-0 items-center justify-center rounded-full border transition disabled:cursor-not-allowed disabled:opacity-40 ${
        kecil ? 'h-8 w-8' : 'h-9 w-9'
      } ${aktif ? 'border-muh-600 bg-muh-600 text-white' : 'border-border bg-white text-slate-600 hover:border-muh-400 hover:text-muh-700'}`}
    >
      {aktif && memuat ? (
        <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white" />
      ) : aktif ? (
        <span className="h-3 w-3 rounded-[2px] bg-current" />
      ) : (
        <span className="ml-0.5 h-0 w-0 border-y-[6px] border-l-[10px] border-y-transparent border-l-current" />
      )}
    </button>
  )
}

interface BacaTandaiProps {
  surah: number
  mulai: number
  akhir: number
  tanda: TandaPerAyat
  onChange: (t: TandaPerAyat) => void
}

/**
 * Baca & Tandai untuk rentang ayat dalam satu surah: teks Arab (font Al-Qur'an), transliterasi, terjemahan, audio
 * per ayat; guru menandai kata yang salah dan status Lulus / Perlu diulang per ayat.
 */
export function BacaTandai({ surah, mulai, akhir, tanda, onChange }: BacaTandaiProps) {
  const [data, setData] = useState<SurahDetail | null>(null)
  const [muat, setMuat] = useState<'loading' | 'ok' | 'error'>('loading')
  const [pref, setPref] = useState<PreferensiBaca>(() => muatPreferensi())
  const audio = useAudio()
  // Tombol "Putar ayat X–Y" hanya berubah jadi "Berhenti" saat rentang yang diputar, bukan saat satu ayat.
  const [modeRentang, setModeRentang] = useState(false)
  useEffect(() => {
    if (audio.aktif === null) setModeRentang(false)
  }, [audio.aktif])

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
    setData(null)
    fetchSurah(surah)
      .then((d) => {
        if (batal) return
        setData(d)
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

  // Ganti surah/rentang/qari → hentikan audio yang masih berjalan.
  const { berhenti } = audio
  useEffect(() => {
    berhenti()
  }, [surah, mulai, akhir, pref.qari, berhenti])

  const daftarQari = useMemo(() => (data ? qariTersedia(data) : []), [data])
  const qariAktif = daftarQari.some((q) => q.id === pref.qari) ? pref.qari : (daftarQari[0]?.id ?? pref.qari)

  const perAyat = useMemo(() => new Map((data?.ayat ?? []).map((a) => [a.nomorAyat, a])), [data])
  const nomor: number[] = []
  for (let n = mulai; n <= akhir; n++) nomor.push(n)

  const urlAyat = (n: number) => perAyat.get(n)?.audio[qariAktif]
  const itemRentang = nomor.flatMap((n) => {
    const url = urlAyat(n)
    return url ? [{ kunci: `a:${n}`, url }] : []
  })
  const urlPenuh = data?.audioFull[qariAktif]

  // Gulir ke ayat yang sedang diputar saat memutar rentang.
  useEffect(() => {
    if (!audio.aktif?.startsWith('a:')) return
    document.getElementById(`ayat-${audio.aktif.slice(2)}`)?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }, [audio.aktif])

  const stat = hitungStat(tanda)
  const ubah = (n: number, fn: (t: (typeof tanda)[number]) => (typeof tanda)[number]) =>
    onChange({ ...tanda, [n]: fn(tanda[n] ?? tandaKosong()) })

  return (
    <div className="space-y-3">
      {data && (
        <div className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-3.5 py-2.5">
          <div className="min-w-0">
            <p className="truncate text-[14px] font-semibold text-slate-900">
              {data.namaLatin}
              {data.arti ? <span className="font-normal text-muted"> · {data.arti}</span> : null}
            </p>
            <p className="text-[11.5px] text-muted">
              {[data.tempatTurun, `${data.jumlahAyat} ayat`].filter(Boolean).join(' · ')}
            </p>
          </div>
          <span dir="rtl" lang="ar" className="font-arab ukuran-2 shrink-0 !leading-normal text-muh-700">
            {data.nama}
          </span>
        </div>
      )}

      {/* Bilah alat: tetap terlihat saat menggulir daftar ayat */}
      <div className="sticky top-[72px] z-10 -mx-1 space-y-2 rounded-xl border border-border bg-white/95 px-3 py-2.5 shadow-sm backdrop-blur">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <label className="flex items-center gap-2 text-[12px] font-medium text-slate-600">
            Qari
            <select
              value={qariAktif}
              onChange={(e) => ubahPref({ qari: e.target.value })}
              disabled={!daftarQari.length}
              className="max-w-[11rem] rounded-md border border-border bg-white px-2 py-1 text-[12px] disabled:opacity-50"
            >
              {(daftarQari.length ? daftarQari : [{ id: qariAktif, nama: '…' }]).map((q) => (
                <option key={q.id} value={q.id}>
                  {q.nama}
                </option>
              ))}
            </select>
          </label>
          <Saklar nyala={pref.latin} onUbah={(v) => ubahPref({ latin: v })} label="Transliterasi" />
          <Saklar nyala={pref.terjemah} onUbah={(v) => ubahPref({ terjemah: v })} label="Terjemahan" />
          <div className="flex items-center gap-1" role="group" aria-label="Ukuran teks Arab">
            <button
              type="button"
              onClick={() => ubahPref({ ukuran: Math.max(1, pref.ukuran - 1) as 1 | 2 | 3 })}
              disabled={pref.ukuran === 1}
              aria-label="Perkecil teks Arab"
              className="h-7 w-7 rounded-md border border-border text-[12px] font-bold text-slate-600 disabled:opacity-40"
            >
              A−
            </button>
            <button
              type="button"
              onClick={() => ubahPref({ ukuran: Math.min(3, pref.ukuran + 1) as 1 | 2 | 3 })}
              disabled={pref.ukuran === 3}
              aria-label="Perbesar teks Arab"
              className="h-7 w-7 rounded-md border border-border text-[14px] font-bold text-slate-600 disabled:opacity-40"
            >
              A+
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={!itemRentang.length}
            onClick={() => {
              if (modeRentang) {
                audio.berhenti()
              } else {
                setModeRentang(true)
                audio.putarBerurutan(itemRentang)
              }
            }}
            className="rounded-lg border border-border bg-white px-3 py-1.5 text-[12px] font-semibold text-slate-700 hover:border-muh-400 disabled:opacity-40"
          >
            {modeRentang ? '■ Berhenti' : `▶ Putar ayat ${mulai}–${akhir}`}
          </button>
          <button
            type="button"
            disabled={!urlPenuh}
            onClick={() => {
              setModeRentang(false)
              if (urlPenuh) audio.putar({ kunci: 'penuh', url: urlPenuh })
            }}
            className="rounded-lg border border-border bg-white px-3 py-1.5 text-[12px] font-semibold text-slate-700 hover:border-muh-400 disabled:opacity-40"
          >
            {audio.aktif === 'penuh' ? '■ Berhenti' : '▶ Audio surah penuh'}
          </button>
          <div className="ml-auto flex flex-wrap gap-1.5" aria-live="polite">
            <Chip cls="bg-[#fdf3d8] text-[#8a6a0c]" n={stat.tajwid} label="Tajwid" />
            <Chip cls="bg-red-50 text-red-700" n={stat.makhroj} label="Makhroj" />
            <Chip cls="bg-emerald-50 text-emerald-700" n={stat.lulus} label="Lulus" />
            <Chip cls="bg-amber-50 text-amber-800" n={stat.gagal} label="Perlu diulang" />
          </div>
        </div>
        {audio.galat && <p className="text-[11.5px] font-medium text-red-700">{audio.galat}</p>}
        <Legenda />
      </div>

      {muat === 'loading' && (
        <div className="space-y-2" aria-busy="true">
          <div className="h-24 animate-pulse rounded-xl bg-slate-100" />
          <div className="h-24 animate-pulse rounded-xl bg-slate-100" />
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
          const ayat = perAyat.get(n)
          const kata = pecahKata(ayat?.teksArab ?? '')
          const kritis = ayatKritis(t)
          const urlIni = urlAyat(n)
          const diputar = audio.aktif === `a:${n}`
          return (
            <div
              key={n}
              id={`ayat-${n}`}
              className={`rounded-xl border p-3 transition-shadow ${
                diputar ? 'ring-2 ring-muh-400' : ''
              } ${
                t.status === 'lulus'
                  ? 'border-emerald-300 bg-emerald-50/60'
                  : t.status === 'gagal'
                    ? 'border-red-300 bg-red-50/60'
                    : 'border-border bg-white'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="flex h-8 min-w-8 items-center justify-center rounded-full bg-slate-100 px-2 text-[12px] font-semibold text-slate-600">
                    {n}
                  </span>
                  <TombolPutar
                    kecil
                    aktif={diputar}
                    memuat={audio.memuat}
                    disabled={!urlIni}
                    label={diputar ? `Hentikan audio ayat ${n}` : `Putar audio ayat ${n}`}
                    onClick={() => {
                      setModeRentang(false)
                      if (urlIni) audio.putar({ kunci: `a:${n}`, url: urlIni })
                    }}
                  />
                </div>
                <div className="flex gap-1.5">
                  <button
                    type="button"
                    aria-pressed={t.status === 'lulus'}
                    aria-label={`Ayat ${n}: lulus`}
                    onClick={() => ubah(n, (x) => setStatusAyat(x, 'lulus'))}
                    className={`flex h-9 w-9 items-center justify-center rounded-full border text-[16px] font-bold transition ${
                      t.status === 'lulus'
                        ? 'border-emerald-600 bg-emerald-600 text-white'
                        : 'border-border bg-white text-slate-400 hover:text-emerald-700'
                    }`}
                  >
                    ✓
                  </button>
                  <button
                    type="button"
                    aria-pressed={t.status === 'gagal'}
                    aria-label={`Ayat ${n}: perlu diulang`}
                    onClick={() => ubah(n, (x) => setStatusAyat(x, 'gagal'))}
                    className={`flex h-9 w-9 items-center justify-center rounded-full border text-[16px] font-bold transition ${
                      t.status === 'gagal'
                        ? 'border-red-600 bg-red-600 text-white'
                        : 'border-border bg-white text-slate-400 hover:text-red-700'
                    }`}
                  >
                    ✕
                  </button>
                </div>
              </div>

              <div dir="rtl" lang="ar" className={`font-arab ukuran-${pref.ukuran} mt-1 text-right text-slate-900`}>
                {kata.length ? (
                  kata.map((w, i) => (
                    <Kata key={i} teks={w} jenis={t.kata[i]} onKetuk={() => ubah(n, (x) => ketukKata(x, i))} />
                  ))
                ) : (
                  <span dir="ltr" className="text-[12px] text-muted">
                    Teks tidak tersedia
                  </span>
                )}
              </div>

              {pref.latin && ayat?.teksLatin && (
                <p className="mt-1 text-[13px] italic leading-relaxed text-slate-600">{ayat.teksLatin}</p>
              )}
              {pref.terjemah && ayat?.teksIndonesia && (
                <p className="mt-1.5 text-[13.5px] leading-relaxed text-slate-800">{ayat.teksIndonesia}</p>
              )}

              {kritis && (
                <p className="mt-1.5 inline-block rounded-md bg-red-100 px-2 py-0.5 text-[11px] font-semibold text-red-800">
                  ⚠ Ayat kritis — kesalahan ≥ 3
                </p>
              )}
            </div>
          )
        })}

      {data && (
        <p className="text-[10.5px] text-muted">
          Teks, transliterasi, terjemahan (Kemenag RI), dan audio: <span className="font-medium">EQuran.id</span>.
        </p>
      )}
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
        className="font-arab ukuran-2 w-full rounded-md border border-border px-2 py-1 text-right outline-none focus:border-muh-500"
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
          <div dir="rtl" lang="ar" className="font-arab ukuran-2 rounded-xl border border-border bg-white p-2.5 text-right">
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
