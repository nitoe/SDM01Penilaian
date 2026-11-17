import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { collection, getDocs, query, where } from 'firebase/firestore'
import { httpsCallable } from 'firebase/functions'
import { db, functions } from '../../lib/firebase'
import { useSiswa } from '../../context/SiswaContext'
import { getLomba } from '../../lib/lomba'
import { labelStatusLomba, lombaSedangBerlangsung } from '../../lib/lombaAkses'
import { daftarKuisLombaAktif } from '../../lib/kuis'
import type { Lomba } from '../../types/lomba'
import { TINGKAT_LOMBA } from '../../types/lomba'
import type { KuisLms, SoalKuis } from '../../types/kuis'
import { NAMA_JENIS_PENILAIAN_SISWA } from '../../types/kuis'
import type { JawabanSoal } from '../../types/soal'
import SoalTampil from '../../components/soal/SoalTampil'
import StimulusSoal, { punyaStimulus } from '../../components/soal/StimulusSoal'
import '../../styles/lomba.css'
import '../../styles/soal.css'
import '../../styles/tka.css'

/**
 * Detail lomba + pengerjaan kuis untuk siswa peserta.
 * Rute: /siswa/lomba/:lombaId.
 * Mesin kuis mengikuti pola TKA (progress lokal, ragu, tinjau, timer, nilaiKuisLms).
 * ANTIREGRESI §Lomba.6, §Lomba.22, §Lomba.23 — jangan halaman generik; jangan navigate saat render.
 */

const PROGRESS_PREFIX = 'lomba_progress_v1_'
const ZOOM_KEY = 'lomba_zoom_v1'

type Progress = {
  jawaban: Record<string, JawabanSoal>
  ragu: string[]
  idx: number
  mulaiMs: number
  updatedAt: number
}

type Riwayat = {
  id: string
  skor: number
  totalPoin: number
  percobaan: number
  createdAtMs: number
}

type Hasil = {
  kuis: KuisLms
  skor: number
  totalPoin: number
  percobaan: number
  status: string
  detail: { soalId: string; benar: boolean }[]
}

function progressKey(siswaId: string, kuisId: string) {
  return `${PROGRESS_PREFIX}${siswaId}_${kuisId}`
}

function muatProgress(siswaId: string, kuisId: string): Progress | null {
  try {
    const raw = localStorage.getItem(progressKey(siswaId, kuisId))
    if (!raw) return null
    const p = JSON.parse(raw) as Progress
    if (!p || typeof p !== 'object' || typeof p.mulaiMs !== 'number') return null
    if (typeof p.jawaban !== 'object' || p.jawaban == null) p.jawaban = {}
    if (!Array.isArray(p.ragu)) p.ragu = []
    return p
  } catch {
    return null
  }
}

function simpanProgress(siswaId: string, kuisId: string, p: Progress) {
  try {
    localStorage.setItem(progressKey(siswaId, kuisId), JSON.stringify({ ...p, updatedAt: Date.now() }))
  } catch {
    /* kuota */
  }
}

function hapusProgress(siswaId: string, kuisId: string) {
  try {
    localStorage.removeItem(progressKey(siswaId, kuisId))
  } catch {
    /* ignore */
  }
}

function waktuMs(v: unknown): number {
  if (!v) return 0
  if (typeof v === 'number') return v
  if (typeof v === 'string') {
    const t = Date.parse(v)
    return Number.isNaN(t) ? 0 : t
  }
  if (typeof v === 'object' && v !== null && 'seconds' in v) {
    return Number((v as { seconds: number }).seconds) * 1000
  }
  return 0
}

function formatWaktu(ms: number): string {
  if (!ms) return '—'
  try {
    return new Date(ms).toLocaleString('id-ID', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return '—'
  }
}

function formatTanggal(d: Date | null): string {
  if (!d) return '—'
  return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
}

function skor100(skor: number, total: number): number {
  if (!total || total <= 0) return 0
  return Math.round((Number(skor) / Number(total)) * 1000) / 10
}

function teksSkor(skor: number, total: number): string {
  const n = skor100(skor, total)
  return Number.isInteger(n) ? String(n) : n.toLocaleString('id-ID', { maximumFractionDigits: 1 })
}

type Jadwal = 'buka' | 'belum' | 'tutup'

function statusJadwal(k: KuisLms, sekarang: number): Jadwal {
  const mulai = waktuMs(k.waktuMulai)
  const selesai = waktuMs(k.waktuSelesai)
  if (mulai && sekarang < mulai) return 'belum'
  if (selesai && sekarang > selesai) return 'tutup'
  return 'buka'
}

function hitungBerakhir(k: KuisLms, mulaiMs: number): number | null {
  const kandidat: number[] = []
  if (k.durasiMenit && k.durasiMenit > 0) kandidat.push(mulaiMs + k.durasiMenit * 60_000)
  const selesai = waktuMs(k.waktuSelesai)
  if (selesai) kandidat.push(selesai)
  return kandidat.length ? Math.min(...kandidat) : null
}

type StatusJawab = 'kosong' | 'sebagian' | 'lengkap'

function statusJawab(soal: SoalKuis, v: JawabanSoal | undefined): StatusJawab {
  if (v == null || v === '') return 'kosong'
  if (Array.isArray(v)) return v.length === 0 ? 'kosong' : 'lengkap'
  if (typeof v === 'object') {
    const n = Object.keys(v).length
    if (n === 0) return 'kosong'
    if (soal.tipe === 'bs') return n < soal.pernyataan.length ? 'sebagian' : 'lengkap'
    if (soal.tipe === 'jodoh') {
      const terisi = Object.values(v as Record<string, string>).filter(Boolean).length
      return terisi < soal.pasangan.length ? 'sebagian' : 'lengkap'
    }
    return 'lengkap'
  }
  return 'lengkap'
}

async function muatRiwayat(siswaId: string, kuisId: string): Promise<Riwayat[]> {
  const snap = await getDocs(
    query(collection(db, 'lms_jawaban'), where('siswaId', '==', siswaId), where('kuisId', '==', kuisId)),
  )
  const list = snap.docs.map((d) => {
    const x = d.data()
    return {
      id: d.id,
      skor: Number(x.skorOtomatis) || 0,
      totalPoin: Number(x.totalPoin) || 0,
      percobaan: Number(x.percobaan) || 1,
      createdAtMs: waktuMs(x.createdAt),
    }
  })
  list.sort((a, b) => b.createdAtMs - a.createdAtMs || b.percobaan - a.percobaan)
  return list
}

/* ───────────── halaman ───────────── */

export default function SiswaLombaDetail() {
  const { lombaId } = useParams<{ lombaId: string }>()
  const { sesi } = useSiswa()
  const [lomba, setLomba] = useState<Lomba | null>(null)
  const [kuisList, setKuisList] = useState<KuisLms[] | null>(null)
  const [riwayatMap, setRiwayatMap] = useState<Record<string, Riwayat[]>>({})
  const [memuat, setMemuat] = useState(true)
  const [galat, setGalat] = useState('')
  const [kerja, setKerja] = useState<{ kuis: KuisLms; dariAwal: boolean } | null>(null)
  const [hasil, setHasil] = useState<Hasil | null>(null)
  const [tokenUntuk, setTokenUntuk] = useState<KuisLms | null>(null)
  const [sekarang, setSekarang] = useState(Date.now())

  useEffect(() => {
    const t = setInterval(() => setSekarang(Date.now()), 15_000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    if (!lombaId || !sesi?.id) return
    let batal = false
    setMemuat(true)
    setGalat('')
    ;(async () => {
      try {
        const l = await getLomba(lombaId)
        if (batal) return
        setLomba(l)
        if (!l || !l.siswaIds.includes(sesi.id)) {
          setKuisList([])
          return
        }
        const list = await daftarKuisLombaAktif(lombaId)
        if (batal) return
        setKuisList(list)
        const map: Record<string, Riwayat[]> = {}
        await Promise.all(
          list.map(async (k) => {
            try {
              map[k.id] = await muatRiwayat(sesi.id, k.id)
            } catch {
              map[k.id] = []
            }
          }),
        )
        if (!batal) setRiwayatMap(map)
      } catch (e) {
        console.warn('SiswaLombaDetail muat gagal:', e)
        if (!batal) {
          setLomba(null)
          setKuisList([])
          setGalat('Lomba tidak dapat dibuka. Kamu mungkin belum terdaftar sebagai peserta.')
        }
      } finally {
        if (!batal) setMemuat(false)
      }
    })()
    return () => {
      batal = true
    }
  }, [lombaId, sesi?.id])

  const mulai = useCallback((k: KuisLms, dariAwal: boolean) => {
    setHasil(null)
    setKerja({ kuis: k, dariAwal })
  }, [])

  const onSukses = useCallback(
    (h: Hasil) => {
      setHasil(h)
      setKerja(null)
      setRiwayatMap((prev) => ({
        ...prev,
        [h.kuis.id]: [
          {
            id: 'baru',
            skor: h.skor,
            totalPoin: h.totalPoin,
            percobaan: h.percobaan,
            createdAtMs: Date.now(),
          },
          ...(prev[h.kuis.id] || []),
        ],
      }))
    },
    [],
  )

  if (memuat) return <div className="p-6 text-sm text-muted">Memuat lomba…</div>

  const peserta = !!lomba && !!sesi?.id && lomba.siswaIds.includes(sesi.id)

  if (!lomba || !peserta) {
    return (
      <div className="lomba-dash space-y-3 p-4 sm:p-6">
        <Link to="/siswa/lomba" className="lomba-back">
          ← Daftar lomba
        </Link>
        <div className="lomba-kosong">
          <h3>Lomba tidak ditemukan</h3>
          <p>{galat || 'Lomba ini tidak ada atau kamu tidak terdaftar sebagai peserta.'}</p>
        </div>
      </div>
    )
  }

  if (kerja && sesi) {
    return (
      <KerjakanLomba
        kuis={kerja.kuis}
        siswaId={sesi.id}
        dariAwal={kerja.dariAwal}
        onKeluar={() => setKerja(null)}
        onSukses={onSukses}
      />
    )
  }

  if (hasil) {
    return (
      <HasilLomba
        hasil={hasil}
        onKembali={() => setHasil(null)}
      />
    )
  }

  const berlangsung = lombaSedangBerlangsung(lomba)
  const tingkat = TINGKAT_LOMBA.find((x) => x.value === lomba.tingkat)?.label ?? lomba.tingkat
  const list = kuisList ?? []

  return (
    <div className="lomba-dash space-y-4 p-4 sm:p-6">
      <Link to="/siswa/lomba" className="lomba-back">
        ← Daftar lomba
      </Link>

      <section className="lomba-hero">
        <div className="lomba-hero-inner">
          <p className="lomba-eyebrow">{tingkat}</p>
          <h1 className="lomba-judul">{lomba.nama}</h1>
          {lomba.identitas ? <p className="lomba-lead">{lomba.identitas}</p> : null}
          <span
            className={
              berlangsung
                ? 'lomba-badge lomba-badge--aktif'
                : lomba.status === 'draf'
                  ? 'lomba-badge lomba-badge--draf'
                  : 'lomba-badge lomba-badge--selesai'
            }
          >
            {berlangsung ? 'Berlangsung' : labelStatusLomba(lomba.status)}
          </span>
        </div>
      </section>

      <section className="lomba-kartu">
        <dl className="lomba-kartu-meta">
          <div>
            <dd>
              <span className="label">Masa</span>
              <span className="nilai">
                {formatTanggal(lomba.mulai)} – {formatTanggal(lomba.selesai)}
              </span>
            </dd>
          </div>
          <div>
            <dd>
              <span className="label">Pengampu</span>
              <span className="nilai">{lomba.guruPengampuNama || '—'}</span>
            </dd>
          </div>
          <div>
            <dd>
              <span className="label">Peserta</span>
              <span className="nilai">{lomba.siswaIds.length} siswa</span>
            </dd>
          </div>
        </dl>
        {lomba.mapelTerkait.length > 0 && (
          <div className="px-[1.1rem] pb-3">
            <div className="lomba-pill-row">
              {lomba.mapelTerkait.map((m) => (
                <span key={m} className="lomba-pill">
                  {m}
                </span>
              ))}
            </div>
          </div>
        )}
        {lomba.deskripsi ? (
          <p className="px-[1.1rem] pb-4 text-sm leading-relaxed text-slate-700">{lomba.deskripsi}</p>
        ) : null}
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-slate-800">Kuis lomba</h2>
        {list.length === 0 ? (
          <div className="lomba-kosong">
            <h3>Belum ada kuis aktif</h3>
            <p>
              Gurumu belum membuka kuis untuk lomba ini, atau semua kuis masih draf. Coba lagi nanti.
            </p>
          </div>
        ) : (
          <ul className="tka-grid">
            {list.map((k) => {
              const jadwal = statusJadwal(k, sekarang)
              const riwayat = riwayatMap[k.id] || []
              const sudah = riwayat.length > 0
              const terakhir = riwayat[0]
              const draf = !sudah ? muatProgress(sesi!.id, k.id) : null
              const adaDraf = !!draf && Object.keys(draf.jawaban || {}).length > 0
              const nJawab = draf ? Object.keys(draf.jawaban || {}).length : 0
              const mulaiMs = waktuMs(k.waktuMulai)
              const selesaiMs = waktuMs(k.waktuSelesai)

              return (
                <li key={k.id} className="tka-kartu">
                  <div className="tka-kartu-head">
                    <h3 className="tka-kartu-judul">{k.judul}</h3>
                    {jadwal === 'belum' && <span className="tka-pil tka-pil--belum">Belum dibuka</span>}
                    {jadwal === 'tutup' && <span className="tka-pil tka-pil--tutup">Sudah ditutup</span>}
                    {jadwal === 'buka' && <span className="tka-pil tka-pil--buka">Dibuka</span>}
                  </div>
                  <p className="tka-kartu-meta">
                    {NAMA_JENIS_PENILAIAN_SISWA[k.jenisPenilaian ?? 'latihan']} · {k.jumlahSoal} soal
                    {k.durasiMenit ? ` · ${k.durasiMenit} menit` : ''}
                    {k.mapel ? ` · ${k.mapel}` : ''}
                  </p>
                  {(mulaiMs > 0 || selesaiMs > 0) && (
                    <p className="tka-kartu-meta">
                      {mulaiMs > 0 && <>Buka {formatWaktu(mulaiMs)}</>}
                      {mulaiMs > 0 && selesaiMs > 0 && ' · '}
                      {selesaiMs > 0 && <>Tutup {formatWaktu(selesaiMs)}</>}
                    </p>
                  )}

                  {sudah && terakhir && (
                    <div className="tka-riwayat">
                      <strong>
                        Sudah dikerjakan
                        {terakhir.totalPoin > 0
                          ? ` · skor ${teksSkor(terakhir.skor, terakhir.totalPoin)}`
                          : ''}
                      </strong>
                      <span>{formatWaktu(terakhir.createdAtMs)}</span>
                    </div>
                  )}
                  {adaDraf && <div className="tka-draf">Draf tersimpan · {nJawab} soal terjawab</div>}

                  <div className="tka-kartu-aksi">
                    {jadwal === 'buka' && !sudah && (
                      <button
                        type="button"
                        className="lms-btn-primary text-sm"
                        onClick={() => {
                          if (adaDraf) void mulai(k, false)
                          else if (k.token?.trim()) setTokenUntuk(k)
                          else void mulai(k, true)
                        }}
                      >
                        {adaDraf ? 'Lanjutkan' : 'Mulai Kerjakan'}
                      </button>
                    )}
                    {sudah && (
                      <span className="text-xs text-slate-500">
                        Jawaban sudah terkirim.
                      </span>
                    )}
                    {jadwal === 'belum' && (
                      <span className="text-xs text-slate-500">Belum waktunya mengerjakan.</span>
                    )}
                    {jadwal === 'tutup' && !sudah && (
                      <span className="text-xs text-slate-500">Waktu pengerjaan sudah berakhir.</span>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      {tokenUntuk && (
        <DialogToken
          kuis={tokenUntuk}
          onBatal={() => setTokenUntuk(null)}
          onBenar={() => {
            const k = tokenUntuk
            setTokenUntuk(null)
            void mulai(k, true)
          }}
        />
      )}
    </div>
  )
}

function DialogToken({
  kuis,
  onBatal,
  onBenar,
}: {
  kuis: KuisLms
  onBatal: () => void
  onBenar: () => void
}) {
  const [nilai, setNilai] = useState('')
  const [salah, setSalah] = useState(false)
  function cek() {
    if (nilai.trim().toLowerCase() === (kuis.token ?? '').trim().toLowerCase()) onBenar()
    else setSalah(true)
  }
  return (
    <div className="tka-overlay" role="dialog" aria-modal="true" aria-label="Masukkan token">
      <div className="tka-dialog">
        <h2 className="tka-dialog-judul">Masukkan token</h2>
        <p className="tka-dialog-isi">Minta token kepada gurumu untuk memulai «{kuis.judul}».</p>
        <input
          className="soal-input"
          autoFocus
          value={nilai}
          maxLength={40}
          onChange={(e) => {
            setNilai(e.target.value)
            setSalah(false)
          }}
          onKeyDown={(e) => e.key === 'Enter' && cek()}
          placeholder="Token"
        />
        {salah && <p className="text-xs text-red-600">Token tidak cocok. Periksa lagi.</p>}
        <div className="tka-dialog-aksi">
          <button type="button" className="lms-btn-secondary text-sm" onClick={onBatal}>
            Batal
          </button>
          <button type="button" className="lms-btn-primary text-sm" onClick={cek}>
            Mulai
          </button>
        </div>
      </div>
    </div>
  )
}

function HasilLomba({ hasil, onKembali }: { hasil: Hasil; onKembali: () => void }) {
  return (
    <div className="lomba-dash space-y-4 p-4 sm:p-6">
      <section className="tka-hasil">
        <p className="tka-eyebrow">Selesai</p>
        <h1 className="tka-hasil-judul">{hasil.kuis.judul}</h1>
        <p className="tka-hasil-skor">
          Skor <strong>{teksSkor(hasil.skor, hasil.totalPoin)}</strong>
          <span className="text-slate-500"> / 100</span>
        </p>
        <p className="text-sm text-slate-600">
          {hasil.skor} poin dari {hasil.totalPoin} · percobaan ke-{hasil.percobaan}
        </p>
        <button type="button" className="lms-btn-primary text-sm mt-4" onClick={onKembali}>
          Kembali ke daftar kuis
        </button>
      </section>
    </div>
  )
}

/* ───────────── pengerjaan (pola TKA) ───────────── */

function KerjakanLomba({
  kuis,
  siswaId,
  dariAwal,
  onKeluar,
  onSukses,
}: {
  kuis: KuisLms
  siswaId: string
  dariAwal: boolean
  onKeluar: () => void
  onSukses: (h: Hasil) => void
}) {
  const soalList: SoalKuis[] = useMemo(() => kuis.soal ?? [], [kuis.soal])
  const awalRef = useRef<Progress | null | undefined>(undefined)
  if (awalRef.current === undefined) {
    awalRef.current = dariAwal ? null : muatProgress(siswaId, kuis.id)
  }
  const saved = awalRef.current

  const mulaiMs = useRef(saved?.mulaiMs ?? Date.now())
  const [idx, setIdx] = useState(saved?.idx ?? 0)
  const [jawaban, setJawaban] = useState<Record<string, JawabanSoal>>(saved?.jawaban ?? {})
  const [ragu, setRagu] = useState<string[]>(saved?.ragu ?? [])
  const [zoom, setZoom] = useState(() => {
    try {
      return Number(localStorage.getItem(ZOOM_KEY)) || 1
    } catch {
      return 1
    }
  })
  const [tinjau, setTinjau] = useState(false)
  const [konfirmKeluar, setKonfirmKeluar] = useState(false)
  const [busy, setBusy] = useState(false)
  const [galat, setGalat] = useState('')
  const [sekarang, setSekarang] = useState(Date.now())
  const stateRef = useRef({ jawaban, ragu, idx })
  stateRef.current = { jawaban, ragu, idx }
  const kirimRef = useRef(false)

  const berakhir = useMemo(() => hitungBerakhir(kuis, mulaiMs.current), [kuis])
  const sisaMs = berakhir ? Math.max(0, berakhir - sekarang) : null
  const waktuHabis = sisaMs !== null && sisaMs <= 0

  const flush = useCallback(() => {
    const s = stateRef.current
    simpanProgress(siswaId, kuis.id, {
      jawaban: s.jawaban,
      ragu: s.ragu,
      idx: s.idx,
      mulaiMs: mulaiMs.current,
      updatedAt: Date.now(),
    })
  }, [siswaId, kuis.id])

  useEffect(() => {
    const t = setInterval(() => {
      flush()
      setSekarang(Date.now())
    }, 2000)
    return () => clearInterval(t)
  }, [flush])

  useEffect(() => {
    const h = (e: BeforeUnloadEvent) => {
      flush()
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', h)
    return () => window.removeEventListener('beforeunload', h)
  }, [flush])

  useEffect(() => {
    const nav = document.querySelector('.sw-nav') as HTMLElement | null
    const main = document.querySelector('.sw-main') as HTMLElement | null
    if (nav) nav.style.display = 'none'
    if (main) main.classList.add('sw-main--kuis')
    return () => {
      if (nav) nav.style.display = ''
      if (main) main.classList.remove('sw-main--kuis')
    }
  }, [])

  useEffect(() => {
    window.scrollTo({ top: 0 })
  }, [idx])

  useEffect(() => {
    try {
      localStorage.setItem(ZOOM_KEY, String(zoom))
    } catch {
      /* ignore */
    }
  }, [zoom])

  const kirim = useCallback(async () => {
    if (kirimRef.current) return
    kirimRef.current = true
    setBusy(true)
    setGalat('')
    try {
      const fn = httpsCallable(functions, 'nilaiKuisLms')
      const res = await fn({ kuisId: kuis.id, jawaban: stateRef.current.jawaban })
      const d = res.data as {
        skor?: number
        totalPoin?: number
        percobaan?: number
        status?: string
        detail?: { soalId: string; benar: boolean }[]
      }
      hapusProgress(siswaId, kuis.id)
      onSukses({
        kuis,
        skor: d?.skor ?? 0,
        totalPoin: d?.totalPoin ?? kuis.totalPoin ?? 0,
        percobaan: d?.percobaan ?? 1,
        status: d?.status ?? 'selesai',
        detail: Array.isArray(d?.detail) ? d.detail : [],
      })
    } catch (e: unknown) {
      kirimRef.current = false
      setBusy(false)
      setGalat(e instanceof Error ? e.message : 'Gagal mengirim jawaban. Periksa koneksi lalu coba lagi.')
    }
  }, [kuis, siswaId, onSukses])

  useEffect(() => {
    if (waktuHabis && !kirimRef.current) {
      void kirim()
    }
  }, [waktuHabis, kirim])

  const soal = soalList[idx]
  const status = useMemo(
    () => soalList.map((s) => statusJawab(s, jawaban[s.id])),
    [soalList, jawaban],
  )
  const nLengkap = status.filter((s) => s === 'lengkap').length
  const nSebagian = status.filter((s) => s === 'sebagian').length
  const nKosong = status.filter((s) => s === 'kosong').length
  const pisah = soal ? punyaStimulus(soal) : false

  function toggleRagu() {
    if (!soal) return
    setRagu((prev) => (prev.includes(soal.id) ? prev.filter((x) => x !== soal.id) : [...prev, soal.id]))
  }

  if (!soal) {
    return (
      <div className="p-6">
        <p className="text-sm text-muted">Kuis tidak memiliki soal.</p>
        <button type="button" className="lms-btn-secondary text-sm mt-2" onClick={onKeluar}>
          Kembali
        </button>
      </div>
    )
  }

  const menit = sisaMs != null ? Math.floor(sisaMs / 60_000) : null
  const detik = sisaMs != null ? Math.floor((sisaMs % 60_000) / 1000) : null
  const timerClass =
    sisaMs == null
      ? ''
      : sisaMs < 60_000
        ? 'tka-timer tka-timer--kritis'
        : sisaMs < 5 * 60_000
          ? 'tka-timer tka-timer--waspada'
          : 'tka-timer'

  return (
    <div className="tka-kerja" style={{ fontSize: `${zoom}em` }}>
      <header className="tka-kerja-head">
        <div className="min-w-0">
          <p className="tka-eyebrow truncate">{kuis.judul}</p>
          <p className="text-xs text-slate-500">
            Soal {idx + 1} / {soalList.length}
            {kuis.mapel ? ` · ${kuis.mapel}` : ''}
          </p>
        </div>
        <div className="tka-kerja-aksi">
          {sisaMs != null && (
            <span className={timerClass} aria-live="polite">
              {String(menit).padStart(2, '0')}:{String(detik).padStart(2, '0')}
            </span>
          )}
          <button
            type="button"
            className="tka-zoom"
            onClick={() => setZoom((z) => Math.min(1.4, Math.round((z + 0.1) * 10) / 10))}
            aria-label="Perbesar huruf"
          >
            A+
          </button>
          <button
            type="button"
            className="tka-zoom"
            onClick={() => setZoom((z) => Math.max(0.85, Math.round((z - 0.1) * 10) / 10))}
            aria-label="Perkecil huruf"
          >
            A−
          </button>
          <button type="button" className="lms-btn-secondary text-xs" onClick={() => setKonfirmKeluar(true)}>
            Keluar
          </button>
        </div>
      </header>

      <nav className="tka-nav-soal" aria-label="Navigasi soal">
        {soalList.map((s, i) => (
          <button
            key={s.id}
            type="button"
            className={`sw-kuis-nav-btn ${i === idx ? 'sw-kuis-nav-btn--aktif' : ''} ${
              status[i] === 'lengkap' ? 'sw-kuis-nav-btn--jawab' : status[i] === 'sebagian' ? 'tka-nav--sebagian' : ''
            } ${ragu.includes(s.id) ? 'tka-nav--ragu' : ''}`}
            onClick={() => setIdx(i)}
          >
            {i + 1}
          </button>
        ))}
      </nav>

      <div className={`tka-isi ${pisah ? 'tka-isi--dua' : ''}`}>
        {pisah && <StimulusSoal soal={soal} className="tka-stimulus" />}
        <div className="tka-soal min-w-0">
          <SoalTampil
            soal={soal}
            nomor={idx + 1}
            jawaban={jawaban[soal.id]}
            onJawab={(j) => setJawaban((prev) => ({ ...prev, [soal.id]: j }))}
            seed={`${siswaId}:${kuis.id}`}
            tanpaStimulus={pisah}
          />
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              className={`text-xs px-2 py-1 rounded border ${
                ragu.includes(soal.id) ? 'border-amber-400 bg-amber-50 text-amber-800' : 'border-slate-200 text-slate-600'
              }`}
              onClick={toggleRagu}
            >
              {ragu.includes(soal.id) ? '★ Ragu-ragu' : '☆ Tandai ragu'}
            </button>
          </div>
        </div>
      </div>

      {galat && (
        <div className="tka-galat" role="alert">
          {galat}
        </div>
      )}

      <footer className="sw-kuis-kerja-foot tka-kaki">
        <button type="button" disabled={idx === 0} onClick={() => setIdx((i) => Math.max(0, i - 1))}>
          ← Sebelumnya
        </button>
        <button
          type="button"
          className="lms-btn-primary text-sm"
          onClick={() => setTinjau(true)}
        >
          Tinjau &amp; kirim
        </button>
        <button
          type="button"
          disabled={idx >= soalList.length - 1}
          onClick={() => setIdx((i) => Math.min(soalList.length - 1, i + 1))}
        >
          Selanjutnya →
        </button>
      </footer>

      {konfirmKeluar && (
        <div className="tka-overlay" role="dialog" aria-modal="true">
          <div className="tka-dialog">
            <h2 className="tka-dialog-judul">Keluar dari kuis?</h2>
            <p className="tka-dialog-isi">Jawaban sementara tersimpan sebagai draf. Kamu bisa melanjutkan nanti.</p>
            <div className="tka-dialog-aksi">
              <button type="button" className="lms-btn-secondary text-sm" onClick={() => setKonfirmKeluar(false)}>
                Lanjut mengerjakan
              </button>
              <button
                type="button"
                className="lms-btn-primary text-sm"
                onClick={() => {
                  flush()
                  onKeluar()
                }}
              >
                Keluar
              </button>
            </div>
          </div>
        </div>
      )}

      {tinjau && (
        <div className="tka-overlay" role="dialog" aria-modal="true" aria-label="Tinjau jawaban">
          <div className="tka-dialog tka-dialog--lebar">
            <h2 className="tka-dialog-judul">Tinjau sebelum kirim</h2>
            <div className="tka-ringkas">
              <div>
                <b>{nLengkap}</b>
                <span>terjawab</span>
              </div>
              <div>
                <b>{nSebagian}</b>
                <span>sebagian</span>
              </div>
              <div>
                <b>{nKosong}</b>
                <span>kosong</span>
              </div>
              <div>
                <b>{ragu.length}</b>
                <span>ragu-ragu</span>
              </div>
            </div>
            {nKosong > 0 || nSebagian > 0 || ragu.length > 0 ? (
              <div className="tka-perhatian">
                <p className="text-xs text-slate-600">Ketuk nomor untuk kembali ke soal yang perlu diperiksa:</p>
                <div className="tka-perhatian-grid">
                  {soalList.map((s, i) =>
                    status[i] !== 'lengkap' || ragu.includes(s.id) ? (
                      <button
                        key={s.id}
                        type="button"
                        className={`sw-kuis-nav-btn ${
                          status[i] === 'kosong'
                            ? ''
                            : status[i] === 'sebagian'
                              ? 'tka-nav--sebagian'
                              : 'sw-kuis-nav-btn--jawab'
                        } ${ragu.includes(s.id) ? 'tka-nav--ragu' : ''}`}
                        onClick={() => {
                          setIdx(i)
                          setTinjau(false)
                        }}
                      >
                        {i + 1}
                      </button>
                    ) : null,
                  )}
                </div>
              </div>
            ) : (
              <p className="text-sm text-emerald-700">Semua soal sudah terjawab.</p>
            )}
            {waktuHabis && (
              <p className="text-sm font-semibold text-red-600">Waktu habis — jawaban dikirim otomatis.</p>
            )}
            {galat && <p className="text-sm text-red-600">{galat}</p>}
            <div className="tka-dialog-aksi">
              <button
                type="button"
                className="lms-btn-secondary text-sm"
                onClick={() => setTinjau(false)}
                disabled={busy}
              >
                Kembali mengerjakan
              </button>
              <button
                type="button"
                className="lms-btn-primary text-sm"
                onClick={() => void kirim()}
                disabled={busy}
              >
                {busy ? 'Mengirim…' : 'Kirim jawaban'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
