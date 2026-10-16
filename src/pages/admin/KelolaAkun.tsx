import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import { Badge, PageHeader } from '../../components/ui'
import {
  ChipToggle,
  Field,
  Notice,
  Spinner,
  btnDanger,
  btnDangerGhost,
  btnGhost,
  btnGhostSm,
  btnPrimary,
  btnPrimarySm,
  btnWarn,
  inputCls,
  useToast,
} from '../akademik/shared'
import {
  ringkasTugas,
  roleDariTugas,
  tugasDariAkun,
  validasiAkun,
  type InputAkunGuru,
  type TugasGuru,
} from '../../lib/akunGuru'
import {
  buatAkunGuru,
  hapusAkunStaf,
  kirimResetPassword,
  listAkunStaf,
  pesanGalatAuth,
  setAkunAktif,
  setStatusAkun,
  simpanAkunGuru,
  type AkunStaf,
} from '../../lib/akunGuruData'
import { getMapelList } from '../../lib/akademik'
import { firebaseConfig } from '../../lib/firebase'
import { MAPEL_BAWAAN } from '../../lib/mapelBawaan'
import { SEMUA_KELAS } from '../../types/tahsin'
import type { Mapel } from '../../types/akademik'
import { ROLE_LABEL, type AppUser } from '../../types/user'

interface Props {
  profile: AppUser
}

type Mode = 'list' | 'form'
type Saringan = 'semua' | 'guru_tahsin_tahfizh' | 'guru_akademik' | 'admin' | 'nonaktif' | 'pending'

const TUGAS_OPSI: { key: keyof TugasGuru; label: string; desk: string }[] = [
  { key: 'tahsin', label: 'Guru Tahsin-Tahfizh', desk: 'Mencatat setoran di kelas yang dipilih.' },
  { key: 'guruKelas', label: 'Guru Kelas', desk: 'Wali kelas. Semua mapel di kelas itu, tanpa menu Tahsin.' },
  { key: 'bidangStudi', label: 'Guru Bidang Studi', desk: 'Hanya mapel yang ditugaskan.' },
]

const SARINGAN: { id: Saringan; label: string }[] = [
  { id: 'semua', label: 'Semua' },
  { id: 'pending', label: 'Menunggu' },
  { id: 'guru_tahsin_tahfizh', label: 'Tahsin' },
  { id: 'guru_akademik', label: 'Akademik' },
  { id: 'admin', label: 'Admin' },
  { id: 'nonaktif', label: 'Nonaktif' },
]

const formKosong = (): InputAkunGuru & { password: string } => ({
  email: '',
  nama: '',
  gelar: '',
  role: 'guru_tahsin_tahfizh',
  kelasAmpu: [],
  penugasan: [],
  waliKelas: [],
  aktif: true,
  password: '',
})

function PilihKelas({
  label,
  hint,
  value,
  onChange,
}: {
  label: string
  hint?: string
  value: string[]
  onChange: (next: string[]) => void
}) {
  function toggle(k: string) {
    onChange(value.includes(k) ? value.filter((x) => x !== k) : [...value, k])
  }
  return (
    <div>
      <span className="mb-1 block text-[12px] font-medium text-slate-700">{label}</span>
      {hint && <p className="mb-2 text-[11.5px] leading-snug text-muted">{hint}</p>}
      <div className="flex flex-wrap gap-1.5">
        {SEMUA_KELAS.map((k) => (
          <ChipToggle key={k} active={value.includes(k)} onClick={() => toggle(k)}>
            {k}
          </ChipToggle>
        ))}
      </div>
    </div>
  )
}

function EditorPenugasan({
  rows,
  mapel,
  onChange,
}: {
  rows: { kelas: string; mapel: string }[]
  mapel: Mapel[]
  onChange: (next: { kelas: string; mapel: string }[]) => void
}) {
  function ubah(i: number, patch: Partial<{ kelas: string; mapel: string }>) {
    onChange(rows.map((row, idx) => (idx === i ? { ...row, ...patch } : row)))
  }
  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="text-[12px] font-medium text-slate-700">Penugasan mapel</span>
        <button
          type="button"
          onClick={() => onChange([...rows, { kelas: '1A', mapel: mapel[0]?.nama ?? '' }])}
          className={btnGhostSm}
        >
          + Tambah baris
        </button>
      </div>
      <p className="mb-2 text-[11.5px] leading-snug text-muted">
        Hanya mapel yang diampu guru ini. Setiap baris adalah satu kelas dan satu mapel.
      </p>
      {rows.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border px-3 py-3 text-[12px] text-muted">
          Belum ada penugasan. Guru tetap bisa masuk, tetapi belum bisa mengisi nilai.
        </p>
      ) : (
        <div className="space-y-2">
          {rows.map((row, i) => (
            <div key={i} className="grid grid-cols-[88px_1fr_auto] gap-2">
              <select className={inputCls} value={row.kelas} onChange={(e) => ubah(i, { kelas: e.target.value })}>
                {SEMUA_KELAS.map((k) => (
                  <option key={k} value={k}>
                    {k}
                  </option>
                ))}
              </select>
              {mapel.length > 0 ? (
                <select className={inputCls} value={row.mapel} onChange={(e) => ubah(i, { mapel: e.target.value })}>
                  {row.mapel && !mapel.some((m) => m.nama === row.mapel) && <option value={row.mapel}>{row.mapel}</option>}
                  {mapel.map((m) => (
                    <option key={m.id} value={m.nama}>
                      {m.nama}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  className={inputCls}
                  value={row.mapel}
                  placeholder="Nama mapel"
                  onChange={(e) => ubah(i, { mapel: e.target.value })}
                />
              )}
              <button
                type="button"
                onClick={() => onChange(rows.filter((_, idx) => idx !== i))}
                className={btnGhostSm}
                aria-label={`Hapus baris ${row.kelas} ${row.mapel}`}
              >
                Hapus
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function labelPeran(akun: AkunStaf): string {
  if (akun.roleRusak) return `Role tidak dikenal (${akun.roleRusak})`
  return ROLE_LABEL[akun.role]
}

function buatPasswordAcak(): string {
  const alfabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789'
  const angka = new Uint32Array(12)
  crypto.getRandomValues(angka)
  return Array.from(angka, (n) => alfabet[n % alfabet.length]).join('')
}

export default function KelolaAkun({ profile }: Props) {
  const [mode, setMode] = useState<Mode>('list')
  const [list, setList] = useState<AkunStaf[]>([])
  const [mapel, setMapel] = useState<Mapel[]>([])
  const [loading, setLoading] = useState(true)
  const [saringan, setSaringan] = useState<Saringan>('semua')
  const [cari, setCari] = useState('')
  const { show: showToast, node: toastNode } = useToast()
  const [busy, setBusy] = useState(false)
  const [editing, setEditing] = useState<AkunStaf | null>(null)
  const [form, setForm] = useState(formKosong)
  const [dipilih, setDipilih] = useState<AkunStaf | null>(null)
  const [kataSandiBaru, setKataSandiBaru] = useState<{ nama: string; email: string; password: string } | null>(null)
  const [konfirmasi, setKonfirmasi] = useState<string | null>(null)
  /** UID yang diminta konfirmasi hapus permanen. */
  const [konfirmasiHapus, setKonfirmasiHapus] = useState<string | null>(null)
  const [ketikHapus, setKetikHapus] = useState('')
  /** Profil sudah dihapus, tetapi user Firebase Auth-nya masih ada (SDK web tidak bisa menghapusnya). */
  const [sisaAuth, setSisaAuth] = useState<{ nama: string; email: string } | null>(null)
  const [sebagaiAdmin, setSebagaiAdmin] = useState(false)
  const [tugas, setTugas] = useState<TugasGuru>({ tahsin: true, guruKelas: false, bidangStudi: false })

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [akun, daftarMapel] = await Promise.all([
        listAkunStaf(),
        getMapelList().catch(() => MAPEL_BAWAAN.map((m) => ({ ...m }))),
      ])
      setList(akun)
      setMapel(daftarMapel)
    } catch (e) {
      console.error(e)
      showToast('Gagal memuat akun. Periksa hak admin dan rules Firestore.', true)
      setList([])
    } finally {
      setLoading(false)
    }
  }, [showToast])

  useEffect(() => {
    void load()
  }, [load])

  const tampil = useMemo(() => {
    const q = cari.trim().toLowerCase()
    return list.filter((u) => {
      if (saringan === 'nonaktif' && u.aktif !== false) return false
      if (saringan === 'pending' && u.status !== 'pending') return false
      if (saringan !== 'semua' && saringan !== 'nonaktif' && saringan !== 'pending' && u.role !== saringan) return false
      if (!q) return true
      return `${u.nama} ${u.email} ${labelPeran(u)}`.toLowerCase().includes(q)
    })
  }, [list, saringan, cari])

  const hitung = useMemo<Record<Saringan, number>>(
    () => ({
      semua: list.length,
      pending: list.filter((u) => u.status === 'pending').length,
      guru_tahsin_tahfizh: list.filter((u) => u.role === 'guru_tahsin_tahfizh').length,
      guru_akademik: list.filter((u) => u.role === 'guru_akademik').length,
      admin: list.filter((u) => u.role === 'admin').length,
      nonaktif: list.filter((u) => u.aktif === false).length,
    }),
    [list],
  )

  /** Di layar kecil panel detail berada di bawah tabel: gulir ke sana saat akun dipilih. */
  const asideRef = useRef<HTMLElement>(null)
  useEffect(() => {
    if (dipilih && window.matchMedia('(max-width: 1023px)').matches) {
      asideRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [dipilih])

  function ekspor() {
    const data = list.map((u) => ({
      email: u.email,
      nama: u.nama,
      gelar: u.gelar ?? '',
      role: u.role,
      status: u.status ?? 'approved',
      aktif: u.aktif !== false,
      kelasAmpu: u.kelasAmpu ?? [],
      penugasan: u.penugasan ?? [],
      waliKelas: u.waliKelas ?? [],
    }))
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `akun-guru-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
    showToast('Data akun diekspor.')
  }

  function openCreate() {
    setEditing(null)
    setForm(formKosong())
    setSebagaiAdmin(false)
    setTugas({ tahsin: true, guruKelas: false, bidangStudi: false })
    setMode('form')
  }

  function openEdit(akun: AkunStaf) {
    setEditing(akun)
    setForm({
      email: akun.email,
      nama: akun.nama === '(tanpa nama)' ? '' : akun.nama,
      gelar: akun.gelar ?? '',
      role: akun.roleRusak ? 'guru_tahsin_tahfizh' : akun.role === 'guru' ? 'guru' : akun.role,
      kelasAmpu: [...(akun.kelasAmpu ?? [])],
      penugasan: (akun.penugasan ?? []).map((p) => ({ ...p })),
      waliKelas: [...(akun.waliKelas ?? [])],
      aktif: akun.aktif !== false,
      status: akun.status,
      password: '',
    })
    setSebagaiAdmin(akun.role === 'admin')
    setTugas(tugasDariAkun(akun))
    setMode('form')
  }

  function setF<K extends keyof ReturnType<typeof formKosong>>(key: K, value: ReturnType<typeof formKosong>[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  async function handleSave(e: FormEvent) {
    e.preventDefault()
    const diriSendiri = editing?.uid === profile.uid
    if (!sebagaiAdmin && !tugas.tahsin && !tugas.guruKelas && !tugas.bidangStudi) {
      showToast('Pilih minimal satu tugas guru.', true)
      return
    }
    const inputSiap: InputAkunGuru & { password: string } = {
      ...form,
      role: sebagaiAdmin ? 'admin' : roleDariTugas(tugas),
      kelasAmpu: !sebagaiAdmin && tugas.tahsin ? form.kelasAmpu : [],
      waliKelas: !sebagaiAdmin && tugas.guruKelas ? form.waliKelas : [],
      penugasan: !sebagaiAdmin && tugas.bidangStudi ? form.penugasan : [],
    }
    const galat = validasiAkun(inputSiap, {
      baru: !editing,
      password: inputSiap.password,
      diriSendiri,
      roleLama: editing?.roleRusak ? undefined : editing?.role,
    })
    if (galat) {
      showToast(galat, true)
      return
    }
    setBusy(true)
    try {
      if (!editing) {
        await buatAkunGuru(inputSiap, inputSiap.password)
        setKataSandiBaru({ nama: inputSiap.nama.trim(), email: inputSiap.email.trim().toLowerCase(), password: inputSiap.password })
        showToast('Akun guru dibuat. Salin password awal sebelum menutup kotak di bawah.')
      } else {
        const input = { ...inputSiap }
        if (editing.status === 'pending') input.status = 'approved'
        await simpanAkunGuru(editing.uid, input, editing.createdAt)
        showToast(editing.status === 'pending' ? 'Akun disetujui dan data disimpan.' : 'Perubahan akun disimpan.')
        setKataSandiBaru(null)
      }
      setMode('list')
      setDipilih(null)
      await load()
    } catch (err) {
      console.error(err)
      showToast(pesanGalatAuth(err), true)
    } finally {
      setBusy(false)
    }
  }

  async function handleReset(akun: AkunStaf) {
    if (!akun.email) {
      showToast('Akun ini tidak punya email.', true)
      return
    }
    setBusy(true)
    try {
      await kirimResetPassword(akun.email)
      showToast(`Tautan atur ulang password dikirim ke ${akun.email}.`)
    } catch (err) {
      console.error(err)
      showToast(pesanGalatAuth(err), true)
    } finally {
      setBusy(false)
    }
  }

  async function terapkanAktif(akun: AkunStaf, aktif: boolean) {
    if (akun.uid === profile.uid) {
      showToast('Anda tidak dapat menonaktifkan akun sendiri.', true)
      return
    }
    setBusy(true)
    try {
      await setAkunAktif(akun.uid, aktif)
      showToast(aktif ? `${akun.nama} diaktifkan kembali.` : `${akun.nama} dinonaktifkan.`)
      setKonfirmasi(null)
      await load()
      setDipilih((prev) => (prev?.uid === akun.uid ? { ...prev, aktif } : prev))
    } catch (err) {
      console.error(err)
      showToast(pesanGalatAuth(err), true)
    } finally {
      setBusy(false)
    }
  }

  async function hapusPermanen(akun: AkunStaf) {
    if (akun.uid === profile.uid) {
      showToast('Anda tidak dapat menghapus akun sendiri.', true)
      return
    }
    const kunci = (akun.email || akun.nama || '').trim().toLowerCase()
    if (ketikHapus.trim().toLowerCase() !== kunci) {
      showToast('Ketik email akun (persis) untuk konfirmasi penghapusan.', true)
      return
    }
    setBusy(true)
    try {
      const hasil = await hapusAkunStaf(akun.uid)
      setList((prev) => prev.filter((u) => u.uid !== akun.uid))
      setDipilih(null)
      setKonfirmasiHapus(null)
      setKetikHapus('')
      if (hasil.authDihapus) {
        setSisaAuth(null)
        showToast(`${akun.nama} dihapus permanen (login dan profil). Email ini bebas dipakai lagi.`)
      } else {
        // Cloud Function belum di-deploy: hanya profil yang terhapus.
        setSisaAuth({ nama: akun.nama, email: akun.email })
        showToast(`Profil ${akun.nama} dihapus, tetapi user login masih ada (Cloud Function belum di-deploy). Lihat petunjuk di bawah.`, true)
      }
    } catch (e) {
      console.error(e)
      showToast(pesanGalatAuth(e), true)
    } finally {
      setBusy(false)
    }
  }


  async function terapkanStatus(akun: AkunStaf, status: 'approved' | 'rejected') {
    if (akun.uid === profile.uid) return
    setBusy(true)
    try {
      await setStatusAkun(akun.uid, status)
      showToast(status === 'approved' ? `${akun.nama} disetujui.` : `${akun.nama} ditolak.`)
      await load()
      setDipilih((prev) => (prev?.uid === akun.uid ? { ...prev, status } : prev))
    } catch (err) {
      console.error(err)
      showToast(pesanGalatAuth(err), true)
    } finally {
      setBusy(false)
    }
  }

  if (profile.role !== 'admin') return <Navigate to="/" replace />

  const terkunci = editing?.uid === profile.uid
  const butuhTahsin = !sebagaiAdmin && tugas.tahsin
  const butuhKelas = !sebagaiAdmin && tugas.guruKelas
  const butuhMapel = !sebagaiAdmin && tugas.bidangStudi

  return (
    <div className="space-y-5 pb-16">
      <PageHeader
        back={{ to: '/admin', label: 'Administrasi' }}
        title="Kelola Akun Guru"
        subtitle={`Buat login guru, atur kelas dan mapel. Akun orang tua ada di menu terpisah. ${list.length} akun staf.`}
        actions={
          mode === 'list' ? (
            <>
              <button type="button" onClick={ekspor} className={btnGhost}>
                Ekspor JSON
              </button>
              <button type="button" onClick={openCreate} className={btnPrimary}>
                + Tambah guru
              </button>
            </>
          ) : (
            <button type="button" onClick={() => setMode('list')} className={btnGhost}>
              ← Kembali ke daftar
            </button>
          )
        }
      />

      {toastNode}

      {sisaAuth && mode === 'list' && (
        <Notice tone="warn">
          <p className="text-[13px] font-semibold">Profil {sisaAuth.nama} dihapus, login-nya belum</p>
          <p className="mt-1">
            Cloud Function hapus akun belum aktif, jadi hanya profil staf yang terhapus. User login{' '}
            <strong>{sisaAuth.email || '(tanpa email)'}</strong> masih ada di Firebase Authentication, jadi
            email itu belum bebas dipakai. Ada dua cara:
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>Hapus user itu di Firebase Console → Authentication → Users (email bebas sepenuhnya).</li>
            <li>
              Atau biarkan: orangnya tetap bisa mendaftar ulang di halaman Daftar. Bila lupa password
              lamanya, halaman Daftar menyediakan tombol atur ulang password.
            </li>
          </ul>
          <div className="mt-3 flex flex-wrap gap-2">
            <a
              href={`https://console.firebase.google.com/project/${firebaseConfig.projectId}/authentication/users`}
              target="_blank"
              rel="noopener noreferrer"
              className={`${btnPrimarySm} inline-block`}
            >
              Buka Firebase Authentication
            </a>
            {sisaAuth.email && (
              <button
                type="button"
                onClick={() =>
                  void navigator.clipboard.writeText(sisaAuth.email).then(
                    () => showToast('Email disalin.'),
                    () => showToast('Salin manual: clipboard ditolak browser.', true),
                  )
                }
                className={btnGhostSm}
              >
                Salin email
              </button>
            )}
            <button type="button" onClick={() => setSisaAuth(null)} className={btnGhostSm}>
              Tutup
            </button>
          </div>
        </Notice>
      )}

      {kataSandiBaru && mode === 'list' && (
        <Notice tone="warn">
          <p className="text-[13px] font-semibold">Password awal untuk {kataSandiBaru.nama}</p>
          <p className="mt-1">
            {kataSandiBaru.email}. Password ini tidak disimpan di aplikasi dan tidak ditampilkan lagi.
          </p>
          <p className="mt-2 inline-block rounded-lg border border-amber-200 bg-white px-3 py-1.5 font-mono text-[15px] font-semibold tracking-wide text-slate-900">
            {kataSandiBaru.password}
          </p>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={() =>
                void navigator.clipboard.writeText(kataSandiBaru.password).then(
                  () => showToast('Password disalin.'),
                  () => showToast('Salin manual: clipboard ditolak browser.', true),
                )
              }
              className={btnPrimarySm}
            >
              Salin password
            </button>
            <button type="button" onClick={() => setKataSandiBaru(null)} className={btnGhostSm}>
              Sudah saya catat
            </button>
          </div>
        </Notice>
      )}

      {mode === 'list' && (
        <div className="grid items-start gap-5 lg:grid-cols-[1fr_320px]">
          <section className="card-soft p-4" aria-label="Daftar akun">
            <div className="flex flex-wrap gap-1.5">
              {SARINGAN.map((f) => (
                <ChipToggle
                  key={f.id}
                  active={saringan === f.id}
                  onClick={() => setSaringan(f.id)}
                  count={hitung[f.id]}
                  perhatian={f.id === 'pending'}
                >
                  {f.label}
                </ChipToggle>
              ))}
            </div>
            <input
              type="search"
              value={cari}
              onChange={(e) => setCari(e.target.value)}
              placeholder="Cari nama atau email…"
              aria-label="Cari akun"
              className={`${inputCls} mt-3`}
            />
            <div className="mt-3 max-h-[34rem] overflow-auto rounded-lg border border-border">
              {loading ? (
                <Spinner />
              ) : tampil.length === 0 ? (
                <p className="p-8 text-center text-[13px] text-muted">Belum ada akun pada saringan ini.</p>
              ) : (
                <table className="w-full text-left text-[13px]">
                  <thead className="sticky top-0 z-10 bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-3 py-2.5 font-semibold">Nama</th>
                      <th className="px-3 py-2.5 font-semibold">Peran</th>
                      <th className="hidden px-3 py-2.5 font-semibold sm:table-cell">Tugas</th>
                      <th className="px-3 py-2.5 font-semibold">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tampil.map((u) => {
                      const terpilih = dipilih?.uid === u.uid
                      const pilih = () => {
                        setDipilih(u)
                        setKonfirmasi(null)
                      }
                      return (
                        <tr
                          key={u.uid}
                          tabIndex={0}
                          aria-selected={terpilih}
                          onClick={pilih}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault()
                              pilih()
                            }
                          }}
                          className={`cursor-pointer border-t border-border transition-colors hover:bg-slate-50 focus-visible:bg-slate-50 ${
                            terpilih ? 'bg-muh-50 hover:bg-muh-50' : ''
                          }`}
                        >
                          <td
                            className={`px-3 py-2.5 ${
                              terpilih ? 'shadow-[inset_3px_0_0_0_var(--color-muh-600)]' : ''
                            }`}
                          >
                            <div className="font-medium text-slate-900">{u.nama}</div>
                            <div className="text-[12px] text-muted">{u.email || '—'}</div>
                          </td>
                          <td className="px-3 py-2.5 text-slate-700">{labelPeran(u)}</td>
                          <td className="hidden px-3 py-2.5 text-muted sm:table-cell">{ringkasTugas(u)}</td>
                          <td className="px-3 py-2.5">
                            {u.status === 'pending' ? (
                              <Badge tone="peach">Menunggu</Badge>
                            ) : u.status === 'rejected' ? (
                              <Badge tone="neutral">Ditolak</Badge>
                            ) : (
                              <Badge tone={u.aktif === false ? 'neutral' : 'green'}>
                                {u.aktif === false ? 'Nonaktif' : 'Aktif'}
                              </Badge>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              )}
            </div>
            <p className="mt-2 text-[12px] text-muted">{tampil.length} ditampilkan</p>
          </section>

          <aside ref={asideRef} className="card-soft p-4 lg:sticky lg:top-20" aria-label="Detail akun">
            {!dipilih ? (
              <p className="text-[13px] leading-relaxed text-muted">
                Pilih akun di daftar untuk mengubah tugas, mengirim tautan password, menonaktifkan, atau
                menghapus permanen.
              </p>
            ) : (
              <div className="space-y-4 text-[13px]">
                <div>
                  <div className="text-[15px] font-semibold text-slate-900">
                    {dipilih.nama}
                    {dipilih.gelar ? `, ${dipilih.gelar}` : ''}
                  </div>
                  <div className="text-[12px] text-muted">{dipilih.email}</div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <Badge tone={dipilih.roleRusak ? 'peach' : 'neutral'}>{labelPeran(dipilih)}</Badge>
                    {dipilih.status === 'pending' && <Badge tone="peach">Menunggu</Badge>}
                    {dipilih.status === 'rejected' && <Badge tone="neutral">Ditolak</Badge>}
                  </div>
                </div>

                <div className="border-t border-border pt-3">
                  <p className="text-slate-700">{ringkasTugas(dipilih)}</p>
                  {dipilih.penugasan && dipilih.penugasan.length > 0 && (
                    <ul className="mt-2 space-y-1 text-[12px] text-muted">
                      {dipilih.penugasan.map((pt) => (
                        <li key={`${pt.kelas}-${pt.mapel}`}>
                          {pt.kelas} · {pt.mapel}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                {dipilih.status === 'pending' && (
                  <Notice tone="warn">
                    <p className="font-medium">Menunggu persetujuan</p>
                    <div className="mt-2 flex flex-col gap-1.5">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => openEdit(dipilih)}
                        className={`${btnPrimarySm} w-full`}
                      >
                        Setujui &amp; atur tugas
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void terapkanStatus(dipilih, 'rejected')}
                        className={`${btnDangerGhost} w-full`}
                      >
                        Tolak pendaftaran
                      </button>
                    </div>
                  </Notice>
                )}

                <div className="space-y-2">
                  {dipilih.status !== 'pending' && (
                    <button type="button" onClick={() => openEdit(dipilih)} className={`${btnPrimary} w-full`}>
                      Ubah akun
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void handleReset(dipilih)}
                    className={`${btnGhost} w-full`}
                  >
                    Kirim tautan password
                  </button>
                </div>

                {dipilih.uid === profile.uid ? (
                  <p className="text-[12px] text-muted">
                    Ini akun Anda. Peran dan status tidak dapat diubah dari sini.
                  </p>
                ) : (
                  <div className="space-y-2 border-t border-border pt-3">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">
                      Tindakan lain
                    </p>

                    {dipilih.aktif !== false ? (
                      konfirmasi === dipilih.uid ? (
                        <Notice tone="warn">
                          <p>
                            {dipilih.nama} tidak bisa masuk. Profil dan penugasan tetap ada; bisa diaktifkan
                            lagi.
                          </p>
                          <div className="mt-2.5 flex gap-2">
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => void terapkanAktif(dipilih, false)}
                              className={btnWarn}
                            >
                              Ya, nonaktifkan
                            </button>
                            <button type="button" onClick={() => setKonfirmasi(null)} className={btnGhost}>
                              Batal
                            </button>
                          </div>
                        </Notice>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setKonfirmasi(dipilih.uid)
                            setKonfirmasiHapus(null)
                            setKetikHapus('')
                          }}
                          className={`${btnGhost} w-full`}
                        >
                          Nonaktifkan
                        </button>
                      )
                    ) : (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void terapkanAktif(dipilih, true)}
                        className={`${btnGhost} w-full`}
                      >
                        Aktifkan kembali
                      </button>
                    )}

                    {konfirmasiHapus === dipilih.uid ? (
                      <Notice tone="error">
                        <p className="leading-relaxed">
                          Hapus permanen akun <strong>{dipilih.nama}</strong>: login (Firebase Authentication)
                          dan profil staf dihapus, dan tidak bisa dibatalkan. Data nilai siswa yang pernah
                          diinput tidak dihapus. Emailnya bebas dipakai mendaftar lagi.
                        </p>
                        <label className="mt-2.5 block text-[12px] font-medium">
                          Ketik email akun untuk konfirmasi
                          <input
                            type="text"
                            value={ketikHapus}
                            onChange={(e) => setKetikHapus(e.target.value)}
                            placeholder={dipilih.email}
                            className={`${inputCls} mt-1 border-red-200 focus:border-red-400 focus:ring-red-200`}
                            autoComplete="off"
                          />
                        </label>
                        <div className="mt-2.5 flex flex-wrap gap-2">
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => void hapusPermanen(dipilih)}
                            className={btnDanger}
                          >
                            Ya, hapus permanen
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setKonfirmasiHapus(null)
                              setKetikHapus('')
                            }}
                            className={btnGhost}
                          >
                            Batal
                          </button>
                        </div>
                      </Notice>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setKonfirmasiHapus(dipilih.uid)
                          setKonfirmasi(null)
                          setKetikHapus('')
                        }}
                        className={`${btnDangerGhost} w-full`}
                      >
                        Hapus permanen
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </aside>
        </div>
      )}

      {mode === 'form' && (
        <section className="card-soft max-w-3xl p-4 sm:p-5">
          <h2 className="text-[15px] font-semibold text-slate-900">
            {editing ? (editing.status === 'pending' ? 'Setujui akun guru' : 'Ubah akun') : 'Tambah akun guru'}
          </h2>
          <div className="mt-3 space-y-2">
            {editing?.status === 'pending' && (
              <Notice tone="warn">
                Menyimpan akan menyetujui akun ini. Atur peran, kelas, dan penugasan mapel sebelum menyimpan.
              </Notice>
            )}
            {editing?.roleRusak && (
              <Notice tone="warn">
                Role tersimpan ({editing.roleRusak}) tidak dikenal. Pilih peran yang benar sebelum menyimpan.
              </Notice>
            )}
          </div>
          <form onSubmit={(e) => void handleSave(e)} className="mt-4 space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Nama" required>
                <input
                  required
                  className={inputCls}
                  value={form.nama}
                  onChange={(e) => setF('nama', e.target.value)}
                />
              </Field>
              <Field label="Gelar pendidikan">
                <input
                  className={inputCls}
                  value={form.gelar ?? ''}
                  placeholder="S.Pd / M.Pd / …"
                  onChange={(e) => setF('gelar', e.target.value)}
                />
              </Field>
              <Field label="Email" required>
                <input
                  required
                  type="email"
                  autoComplete="off"
                  className={inputCls}
                  value={form.email}
                  disabled={Boolean(editing)}
                  onChange={(e) => setF('email', e.target.value)}
                />
              </Field>
              {!editing && (
                <Field label="Password awal" required hint="Minimal 8 karakter.">
                  <div className="flex gap-2">
                    <input
                      required
                      minLength={8}
                      autoComplete="new-password"
                      className={inputCls}
                      value={form.password}
                      onChange={(e) => setF('password', e.target.value)}
                    />
                    <button
                      type="button"
                      onClick={() => setF('password', buatPasswordAcak())}
                      className={`${btnGhost} shrink-0`}
                    >
                      Acak
                    </button>
                  </div>
                </Field>
              )}
            </div>
            {editing && (
              <p className="text-[12px] text-muted">
                Email login tidak diubah di sini. Untuk password, kirim tautan ke email guru dari panel
                daftar.
              </p>
            )}

            <div>
              <span className="mb-1 block text-[12px] font-medium text-slate-700">
                Tugas <span className="text-peach-500">*</span>
              </span>
              <p className="mb-2.5 text-[11.5px] leading-snug text-muted">
                Boleh lebih dari satu. Contoh: Tahsin-Tahfizh sekaligus guru kelas, atau Tahsin sekaligus
                bidang studi.
              </p>
              <button
                type="button"
                disabled={terkunci}
                aria-pressed={sebagaiAdmin}
                onClick={() => setSebagaiAdmin((v) => !v)}
                className={`mb-2 w-full rounded-lg border px-3.5 py-2.5 text-left transition disabled:opacity-60 ${
                  sebagaiAdmin
                    ? 'border-muh-600 bg-muh-50 ring-1 ring-muh-600/20'
                    : 'border-border bg-white hover:bg-slate-50'
                }`}
              >
                <div className="text-[13px] font-semibold text-slate-900">Administrator</div>
                <div className="mt-0.5 text-[12px] text-muted">
                  Semua modul. Kelas dan mapel tidak perlu diisi.
                </div>
              </button>
              {!sebagaiAdmin && (
                <div className="grid gap-2 sm:grid-cols-3">
                  {TUGAS_OPSI.map((o) => {
                    const aktif = tugas[o.key]
                    return (
                      <button
                        key={o.key}
                        type="button"
                        disabled={terkunci}
                        aria-pressed={aktif}
                        onClick={() => setTugas((prev) => ({ ...prev, [o.key]: !prev[o.key] }))}
                        className={`rounded-lg border px-3.5 py-2.5 text-left transition disabled:opacity-60 ${
                          aktif
                            ? 'border-muh-600 bg-muh-50 ring-1 ring-muh-600/20'
                            : 'border-border bg-white hover:bg-slate-50'
                        }`}
                      >
                        <div className="text-[13px] font-semibold text-slate-900">
                          {aktif ? '✓ ' : ''}
                          {o.label}
                        </div>
                        <div className="mt-0.5 text-[12px] leading-snug text-muted">{o.desk}</div>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>

            {sebagaiAdmin && (
              <Notice tone="info">
                Administrator membuka semua modul. Kelas dan mapel tidak perlu diisi.
              </Notice>
            )}
            {butuhTahsin && butuhKelas && (
              <Notice tone="info">
                Kombinasi: guru Tahsin-Tahfizh yang juga menjadi guru kelas. Isi kedua bagian di bawah.
              </Notice>
            )}
            {butuhTahsin && (
              <PilihKelas
                label="Kelas Tahsin-Tahfizh"
                hint="Pilih kelas tempat guru mencatat setoran."
                value={form.kelasAmpu}
                onChange={(kelasAmpu) => setF('kelasAmpu', kelasAmpu)}
              />
            )}
            {butuhKelas && (
              <PilihKelas
                label="Guru kelas"
                hint="Semua mata pelajaran di tingkat kelas ini terbuka, termasuk mapel guru bidang studi."
                value={form.waliKelas}
                onChange={(waliKelas) => setF('waliKelas', waliKelas)}
              />
            )}
            {butuhMapel && (
              <EditorPenugasan
                rows={form.penugasan}
                mapel={mapel}
                onChange={(penugasan) => setF('penugasan', penugasan)}
              />
            )}
            {editing && editing.uid !== profile.uid && (
              <label className="flex items-center gap-2 text-[13px] text-slate-700">
                <input
                  type="checkbox"
                  checked={form.aktif}
                  onChange={(e) => setF('aktif', e.target.checked)}
                  className="accent-muh-600"
                />
                Akun aktif (boleh masuk)
              </label>
            )}
            <div className="flex gap-2 border-t border-border pt-4">
              <button type="submit" disabled={busy} className={btnPrimary}>
                {busy ? 'Menyimpan…' : 'Simpan'}
              </button>
              <button type="button" onClick={() => setMode('list')} className={btnGhost}>
                Batal
              </button>
            </div>
          </form>
        </section>
      )}
    </div>
  )
}
