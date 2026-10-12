import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { createUserWithEmailAndPassword } from 'firebase/auth'
import { doc, setDoc } from 'firebase/firestore'
import { auth, db } from '../lib/firebase'
import { GURU_RESMI, adalahNamaResmi } from '../lib/dataGuruResmi'
import { getMapelList } from '../lib/akademik'
import { MAPEL_BAWAAN } from '../lib/mapelBawaan'
import { roleDariTugas, type TugasGuru } from '../lib/akunGuru'
import { turunkanFieldRules } from '../lib/penugasan'
import { SEMUA_KELAS } from '../types/tahsin'
import type { Mapel } from '../types/akademik'

function toggleItem(list: string[], item: string): string[] {
  return list.includes(item) ? list.filter((x) => x !== item) : [...list, item]
}

const TUGAS_OPSI: { key: keyof TugasGuru; label: string; desk: string }[] = [
  { key: 'tahsin', label: 'Guru Tahsin-Tahfizh', desk: 'Mencatat setoran di kelas yang dipilih.' },
  { key: 'guruKelas', label: 'Guru Kelas', desk: 'Wali kelas. Mengakses semua mapel di kelas itu, tanpa menu Tahsin.' },
  { key: 'bidangStudi', label: 'Guru Bidang Studi', desk: 'Hanya mapel yang ditugaskan, termasuk di kelas lain.' },
]

export default function Register() {
  const [nama, setNama] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [gelar, setGelar] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [tugas, setTugas] = useState<TugasGuru>({ tahsin: false, guruKelas: true, bidangStudi: false })
  const [kelasAmpu, setKelasAmpu] = useState<string[]>([])
  const [waliKelas, setWaliKelas] = useState<string[]>([])
  const [penugasan, setPenugasan] = useState<{ kelas: string; mapel: string }[]>([])
  const [mapelList, setMapelList] = useState<Mapel[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [sukses, setSukses] = useState(false)

  useEffect(() => {
    getMapelList()
      .then(setMapelList)
      .catch(() => setMapelList(MAPEL_BAWAAN.map((m) => ({ ...m }))))
  }, [])

  const butuhTahsin = tugas.tahsin
  const butuhKelas = tugas.guruKelas
  const butuhMapel = tugas.bidangStudi

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (!adalahNamaResmi(nama)) {
      setError('Pilih nama guru dari daftar yang tersedia.')
      return
    }
    if (password.length < 8) {
      setError('Password minimal 8 karakter.')
      return
    }
    if (!tugas.tahsin && !tugas.guruKelas && !tugas.bidangStudi) {
      setError('Pilih minimal satu tugas.')
      return
    }
    if (butuhTahsin && kelasAmpu.length === 0) {
      setError('Pilih minimal satu kelas untuk Tahsin-Tahfizh.')
      return
    }
    if (butuhKelas && waliKelas.length === 0) {
      setError('Pilih kelas yang Anda ampu sebagai guru kelas.')
      return
    }
    const penugasanBersih = butuhMapel ? penugasan.filter((p) => p.kelas && p.mapel.trim()) : []
    if (butuhMapel && penugasanBersih.length === 0) {
      setError('Tambahkan minimal satu penugasan mapel.')
      return
    }

    const turunan = turunkanFieldRules(penugasanBersih)
    const role = roleDariTugas(tugas)

    setLoading(true)
    try {
      const cred = await createUserWithEmailAndPassword(auth, email.trim().toLowerCase(), password)
      await setDoc(doc(db, 'users', cred.user.uid), {
        email: email.trim().toLowerCase(),
        nama: nama.trim(),
        gelar: gelar.trim() || undefined,
        role,
        status: 'pending',
        aktif: true,
        kelasAmpu: butuhTahsin ? kelasAmpu : [],
        waliKelas: butuhKelas ? waliKelas : [],
        penugasan: penugasanBersih,
        penugasanKelas: turunan.penugasanKelas,
        penugasanKelasMapel: turunan.penugasanKelasMapel,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
      setSukses(true)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal mendaftar'
      if (msg.includes('email-already-in-use')) {
        setError('Email ini sudah terdaftar.')
      } else if (msg.includes('weak-password')) {
        setError('Password terlalu lemah.')
      } else {
        setError(msg)
      }
    } finally {
      setLoading(false)
    }
  }

  const field =
    'w-full rounded-xl border border-border bg-white px-3 py-2 text-[13px] outline-none transition focus:border-muh-500 focus:bg-white focus:ring-2 focus:ring-muh-500/15'

  function ChipKelas({
    value,
    onChange,
  }: {
    value: string[]
    onChange: (next: string[]) => void
  }) {
    return (
      <div className="flex flex-wrap gap-1">
        {SEMUA_KELAS.map((k) => {
          const aktif = value.includes(k)
          return (
            <button
              key={k}
              type="button"
              onClick={() => onChange(toggleItem(value, k))}
              className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                aktif ? 'bg-muh-600 text-white' : 'bg-slate-100 text-slate-600'
              }`}
            >
              {k}
            </button>
          )
        })}
      </div>
    )
  }

  if (sukses) {
    return (
      <div className="flex min-h-full items-center justify-center bg-surface-2 p-4">
        <div className="w-full max-w-md rounded-2xl border border-border bg-white p-6 text-center">
          <h2 className="text-lg font-semibold text-slate-900">Pendaftaran berhasil</h2>
          <p className="mt-2 text-[13px] text-muted">
            Data peran dan kelas Anda sudah tercatat. Admin akan meninjau dan menyetujui akun ini.
            Setelah disetujui, Anda dapat masuk.
          </p>
          <Link
            to="/login"
            className="mt-4 inline-block rounded-xl bg-muh-600 px-4 py-2 text-sm font-semibold text-white"
          >
            Ke halaman masuk
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-full items-start justify-center bg-surface-2 px-3 py-6 sm:px-4">
      <div className="w-full max-w-2xl rounded-2xl border border-border bg-white p-5 sm:p-6">
        <h2 className="text-lg font-semibold text-slate-900">Daftar Akun Guru</h2>
        <p className="mt-1 text-[12px] text-muted">
          Pilih nama resmi, peran, dan kelas yang Anda ampu. Admin akan menyetujui sebelum akun aktif.
        </p>

        <form onSubmit={handleSubmit} className="mt-5 space-y-5">
          {/* Identitas */}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="mb-1 block text-[12px] font-medium text-slate-600">Nama guru *</label>
              <select required value={nama} onChange={(e) => setNama(e.target.value)} className={field}>
                <option value="">— Pilih nama —</option>
                {GURU_RESMI.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-[12px] font-medium text-slate-600">Email *</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={field}
                placeholder="nama@sekolah.sch.id"
              />
            </div>
            <div>
              <label className="mb-1 block text-[12px] font-medium text-slate-600">Password *</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={field + ' pr-24'}
                  placeholder="Minimal 8 karakter"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[12px] font-medium text-muh-700"
                >
                  {showPassword ? 'Sembunyikan' : 'Tampilkan'}
                </button>
              </div>
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-[12px] font-medium text-slate-600">
                Gelar pendidikan terakhir <span className="text-muted">(opsional)</span>
              </label>
              <input
                type="text"
                value={gelar}
                onChange={(e) => setGelar(e.target.value)}
                className={field}
                placeholder="contoh: S.Pd"
              />
              <p className="mt-1 text-[11px] text-muted">
                Muncul di penandatanganan rapor, mis. “Arif Azwar Anas, S.Pd”.
              </p>
            </div>
          </div>

          <div>
            <span className="mb-2 block text-[12px] font-medium text-slate-600">Tugas *</span>
            <p className="mb-2 text-[11px] text-muted">
              Bisa dipilih bersamaan. Misalnya guru Tahsin-Tahfizh yang juga menjadi guru kelas, atau yang juga mengajar bidang studi.
            </p>
            <div className="grid gap-2 sm:grid-cols-3">
              {TUGAS_OPSI.map((o) => {
                const aktif = tugas[o.key]
                return (
                  <button
                    key={o.key}
                    type="button"
                    onClick={() => setTugas((prev) => ({ ...prev, [o.key]: !prev[o.key] }))}
                    className={`rounded-xl border px-3 py-2.5 text-left text-[12px] ${
                      aktif
                        ? 'border-muh-500 bg-muh-50 text-muh-900'
                        : 'border-border bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <div className="font-semibold">{aktif ? '✓ ' : ''}{o.label}</div>
                    <div className="mt-0.5 text-[11px] text-muted">{o.desk}</div>
                  </button>
                )
              })}
            </div>
          </div>

          {butuhTahsin && (
            <div>
              <span className="mb-1 block text-[12px] font-medium text-slate-600">Kelas Tahsin-Tahfizh *</span>
              <p className="mb-2 text-[11px] text-muted">Pilih kelas tempat Anda mencatat setoran.</p>
              <ChipKelas value={kelasAmpu} onChange={setKelasAmpu} />
            </div>
          )}

          {butuhKelas && (
            <div>
              <span className="mb-1 block text-[12px] font-medium text-slate-600">Guru kelas *</span>
              <p className="mb-2 text-[11px] text-muted">
                Kelas yang Anda walikan. Semua mata pelajaran di tingkat itu ikut terbuka, termasuk yang diampu guru bidang studi.
              </p>
              <ChipKelas value={waliKelas} onChange={setWaliKelas} />
            </div>
          )}

          {butuhMapel && (
            <div>
              <div className="mb-1.5 flex items-center justify-between gap-2">
                <span className="text-[12px] font-medium text-slate-600">Penugasan mapel *</span>
                <button
                  type="button"
                  onClick={() =>
                    setPenugasan((prev) => [...prev, { kelas: '1A', mapel: mapelList[0]?.nama ?? '' }])
                  }
                  className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-200"
                >
                  + Tambah
                </button>
              </div>
              <p className="mb-2 text-[11px] text-muted">
                Hanya mapel yang Anda ampu. Setiap baris: satu kelas dan satu mapel.
              </p>
              {penugasan.length === 0 ? (
                <p className="rounded-xl border border-dashed border-border px-3 py-3 text-[12px] text-muted">
                  Belum ada penugasan mapel.
                </p>
              ) : (
                <div className="space-y-2">
                  {penugasan.map((row, i) => (
                    <div key={i} className="grid grid-cols-[88px_1fr_auto] gap-2">
                      <select
                        className={field}
                        value={row.kelas}
                        onChange={(e) =>
                          setPenugasan((prev) =>
                            prev.map((r, idx) => (idx === i ? { ...r, kelas: e.target.value } : r)),
                          )
                        }
                      >
                        {SEMUA_KELAS.map((k) => (
                          <option key={k} value={k}>
                            {k}
                          </option>
                        ))}
                      </select>
                      <select
                        className={field}
                        value={row.mapel}
                        onChange={(e) =>
                          setPenugasan((prev) =>
                            prev.map((r, idx) => (idx === i ? { ...r, mapel: e.target.value } : r)),
                          )
                        }
                      >
                        <option value="">— Mapel —</option>
                        {row.mapel && !mapelList.some((m) => m.nama === row.mapel) && (
                          <option value={row.mapel}>{row.mapel}</option>
                        )}
                        {mapelList.map((m) => (
                          <option key={m.id} value={m.nama}>
                            {m.nama}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => setPenugasan((prev) => prev.filter((_, idx) => idx !== i))}
                        className="rounded-xl border border-border px-2.5 text-[11px] font-medium text-slate-500 hover:bg-slate-50"
                      >
                        Hapus
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {error && (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-[12px] font-medium text-red-700">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center rounded-2xl bg-muh-600 px-3 py-3 text-[14px] font-semibold text-white hover:bg-muh-700 disabled:opacity-60"
          >
            {loading ? 'Mendaftar…' : 'Daftar'}
          </button>
        </form>

        <p className="mt-4 text-center text-[12px] text-muted">
          Sudah punya akun?{' '}
          <Link to="/login" className="font-medium text-muh-700">
            Masuk
          </Link>
        </p>
      </div>
    </div>
  )
}
