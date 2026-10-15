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
  {
    key: 'guruKelas',
    label: 'Guru Kelas',
    desk: 'Wali kelas. Mengakses semua mapel di kelas itu, tanpa menu Tahsin.',
  },
  {
    key: 'bidangStudi',
    label: 'Guru Bidang Studi',
    desk: 'Hanya mapel yang ditugaskan, termasuk di kelas lain.',
  },
]

export default function Register() {
  const [nama, setNama] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [gelar, setGelar] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [tugas, setTugas] = useState<TugasGuru>({
    tahsin: false,
    guruKelas: true,
    bidangStudi: false,
  })
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
      const cred = await createUserWithEmailAndPassword(
        auth,
        email.trim().toLowerCase(),
        password,
      )
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

  function ChipKelas({
    value,
    onChange,
  }: {
    value: string[]
    onChange: (next: string[]) => void
  }) {
    return (
      <div className="flex flex-wrap gap-1.5">
        {SEMUA_KELAS.map((k) => {
          const aktif = value.includes(k)
          return (
            <button
              key={k}
              type="button"
              onClick={() => onChange(toggleItem(value, k))}
              className={`auth-chip ${aktif ? 'auth-chip--on' : ''}`}
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
      <div className="auth-shell auth-shell--center">
        <div className="auth-success-card">
          <div className="auth-success-icon" aria-hidden>
            <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="auth-display auth-display--sm text-[#0d253d]">Pendaftaran berhasil</h2>
          <p className="mt-3 text-[14.5px] font-light leading-relaxed text-[#64748d]">
            Data peran dan kelas Anda sudah tercatat. Admin akan meninjau dan menyetujui akun ini.
            Setelah disetujui, Anda dapat masuk.
          </p>
          <Link to="/login" className="auth-btn-primary mt-7 inline-flex w-auto px-7">
            Ke halaman masuk
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="auth-shell auth-shell--center auth-shell--scroll">
      <div className="auth-register-card">
        <div className="stripe-mesh-thin h-1.5 w-full" />

        <div className="p-6 sm:p-8">
          <div className="mb-6 flex items-center gap-3">
            <span className="auth-logo-tile auth-logo-tile--light">
              <img src="/favicon-32.png" alt="" className="h-6 w-6" />
            </span>
            <div>
              <p className="text-[14px] font-medium text-[#0d253d]">SDM 01 Kukusan</p>
              <p className="text-[12px] font-light text-[#64748d]">Daftar akun guru</p>
            </div>
          </div>

          <header className="mb-7">
            <h2 className="auth-display auth-display--sm text-[#0d253d]">Daftar Akun Guru</h2>
            <p className="mt-2 text-[14px] font-light leading-relaxed text-[#64748d]">
              Pilih nama resmi, peran, dan kelas yang Anda ampu. Admin akan menyetujui sebelum akun
              aktif.
            </p>
          </header>

          <form onSubmit={(e) => void handleSubmit(e)} className="space-y-6" noValidate>
            <section className="grid gap-4 sm:grid-cols-2">
              <div className="auth-field sm:col-span-2">
                <label htmlFor="nama">Nama guru *</label>
                <select
                  id="nama"
                  required
                  value={nama}
                  onChange={(e) => setNama(e.target.value)}
                >
                  <option value="">— Pilih nama —</option>
                  {GURU_RESMI.map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </div>
              <div className="auth-field">
                <label htmlFor="reg-email">Email *</label>
                <input
                  id="reg-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="nama@sekolah.sch.id"
                />
              </div>
              <div className="auth-field">
                <label htmlFor="reg-password">Password *</label>
                <div className="auth-input-wrap">
                  <input
                    id="reg-password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Minimal 8 karakter"
                  />
                  <button
                    type="button"
                    className="auth-ghost-btn"
                    onClick={() => setShowPassword((v) => !v)}
                    tabIndex={-1}
                  >
                    {showPassword ? 'Sembunyikan' : 'Tampilkan'}
                  </button>
                </div>
              </div>
              <div className="auth-field sm:col-span-2">
                <label htmlFor="gelar">
                  Gelar pendidikan terakhir{' '}
                  <span className="font-light text-[#64748d]">(opsional)</span>
                </label>
                <input
                  id="gelar"
                  type="text"
                  value={gelar}
                  onChange={(e) => setGelar(e.target.value)}
                  placeholder="contoh: S.Pd"
                />
                <p className="auth-hint">
                  Muncul di penandatanganan rapor, mis. “Arif Azwar Anas, S.Pd”.
                </p>
              </div>
            </section>

            <section>
              <span className="mb-1.5 block text-[13px] font-medium text-[#273951]">Tugas *</span>
              <p className="mb-3 text-[12.5px] font-light text-[#64748d]">
                Bisa dipilih bersamaan — misalnya guru Tahsin yang juga menjadi wali kelas.
              </p>
              <div className="grid gap-2.5 sm:grid-cols-3">
                {TUGAS_OPSI.map((o) => {
                  const aktif = tugas[o.key]
                  return (
                    <button
                      key={o.key}
                      type="button"
                      onClick={() => setTugas((prev) => ({ ...prev, [o.key]: !prev[o.key] }))}
                      className={`auth-task-card ${aktif ? 'auth-task-card--on' : ''}`}
                    >
                      <div className="flex items-center gap-2">
                        <span className={`auth-check ${aktif ? 'auth-check--on' : ''}`}>
                          {aktif ? '✓' : ''}
                        </span>
                        <span className="text-[13px] font-medium text-[#0d253d]">{o.label}</span>
                      </div>
                      <p className="mt-2 text-[11.5px] font-light leading-snug text-[#64748d]">
                        {o.desk}
                      </p>
                    </button>
                  )
                })}
              </div>
            </section>

            {butuhTahsin && (
              <section>
                <span className="mb-1.5 block text-[13px] font-medium text-[#273951]">
                  Kelas Tahsin-Tahfizh *
                </span>
                <p className="mb-2.5 text-[12.5px] font-light text-[#64748d]">
                  Pilih kelas tempat Anda mencatat setoran.
                </p>
                <ChipKelas value={kelasAmpu} onChange={setKelasAmpu} />
              </section>
            )}

            {butuhKelas && (
              <section>
                <span className="mb-1.5 block text-[13px] font-medium text-[#273951]">
                  Guru kelas *
                </span>
                <p className="mb-2.5 text-[12.5px] font-light text-[#64748d]">
                  Kelas yang Anda walikan. Semua mata pelajaran di tingkat itu ikut terbuka.
                </p>
                <ChipKelas value={waliKelas} onChange={setWaliKelas} />
              </section>
            )}

            {butuhMapel && (
              <section>
                <div className="mb-1.5 flex items-center justify-between gap-2">
                  <span className="text-[13px] font-medium text-[#273951]">Penugasan mapel *</span>
                  <button
                    type="button"
                    onClick={() =>
                      setPenugasan((prev) => [
                        ...prev,
                        { kelas: '1A', mapel: mapelList[0]?.nama ?? '' },
                      ])
                    }
                    className="auth-chip"
                  >
                    + Tambah
                  </button>
                </div>
                <p className="mb-2.5 text-[12.5px] font-light text-[#64748d]">
                  Setiap baris: satu kelas dan satu mapel.
                </p>
                {penugasan.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-[#e3e8ee] px-3.5 py-4 text-[13px] font-light text-[#64748d]">
                    Belum ada penugasan mapel.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {penugasan.map((row, i) => (
                      <div key={i} className="grid grid-cols-[88px_1fr_auto] gap-2">
                        <div className="auth-field">
                          <select
                            value={row.kelas}
                            onChange={(e) =>
                              setPenugasan((prev) =>
                                prev.map((r, idx) =>
                                  idx === i ? { ...r, kelas: e.target.value } : r,
                                ),
                              )
                            }
                            aria-label="Kelas"
                          >
                            {SEMUA_KELAS.map((k) => (
                              <option key={k} value={k}>
                                {k}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="auth-field">
                          <select
                            value={row.mapel}
                            onChange={(e) =>
                              setPenugasan((prev) =>
                                prev.map((r, idx) =>
                                  idx === i ? { ...r, mapel: e.target.value } : r,
                                ),
                              )
                            }
                            aria-label="Mapel"
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
                        </div>
                        <button
                          type="button"
                          onClick={() => setPenugasan((prev) => prev.filter((_, idx) => idx !== i))}
                          className="rounded-md border border-[#e3e8ee] px-2.5 text-[12px] font-medium text-[#64748d] transition hover:bg-[#f6f9fc]"
                        >
                          Hapus
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            )}

            {error && (
              <div role="alert" className="auth-alert auth-alert--error">
                {error}
              </div>
            )}

            <button type="submit" className="auth-btn-primary" disabled={loading}>
              {loading ? (
                <span className="inline-flex items-center gap-2">
                  <span className="auth-spinner" aria-hidden />
                  Memproses…
                </span>
              ) : (
                'Daftar'
              )}
            </button>
          </form>

          <div className="auth-divider" />

          <p className="text-center text-[13.5px] font-light text-[#64748d]">
            Sudah punya akun?{' '}
            <Link to="/login" className="auth-link">
              Masuk
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
