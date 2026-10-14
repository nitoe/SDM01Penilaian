import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { Badge, PageHeader } from '../../components/ui'
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

const inputCls =
  'w-full rounded-lg border border-border bg-white px-3 py-2 text-[13px] outline-none focus:border-muh-500 focus:ring-2 focus:ring-muh-500/15'

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

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-medium text-slate-600">{label}</span>
      {children}
    </label>
  )
}

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
      <span className="mb-1 block text-[11px] font-medium text-slate-600">{label}</span>
      {hint && <p className="mb-1.5 text-[11px] text-muted">{hint}</p>}
      <div className="flex flex-wrap gap-1">
        {SEMUA_KELAS.map((k) => {
          const aktif = value.includes(k)
          return (
            <button
              key={k}
              type="button"
              onClick={() => toggle(k)}
              className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                aktif ? 'bg-muh-600 text-white' : 'bg-slate-100 text-slate-600'
              }`}
            >
              {k}
            </button>
          )
        })}
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
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <span className="text-[11px] font-medium text-slate-600">Penugasan mapel</span>
        <button
          type="button"
          onClick={() => onChange([...rows, { kelas: '1A', mapel: mapel[0]?.nama ?? '' }])}
          className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-200"
        >
          + Tambah
        </button>
      </div>
      <p className="mb-2 text-[11px] text-muted">
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
                className="rounded-lg border border-border px-2.5 text-[11px] font-medium text-slate-500 hover:bg-slate-50"
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
  const [toast, setToast] = useState<{ msg: string; error?: boolean } | null>(null)
  const [busy, setBusy] = useState(false)
  const [editing, setEditing] = useState<AkunStaf | null>(null)
  const [form, setForm] = useState(formKosong)
  const [dipilih, setDipilih] = useState<AkunStaf | null>(null)
  const [kataSandiBaru, setKataSandiBaru] = useState<{ nama: string; email: string; password: string } | null>(null)
  const [konfirmasi, setKonfirmasi] = useState<string | null>(null)
  /** UID yang diminta konfirmasi hapus permanen. */
  const [konfirmasiHapus, setKonfirmasiHapus] = useState<string | null>(null)
  const [ketikHapus, setKetikHapus] = useState('')
  const [sebagaiAdmin, setSebagaiAdmin] = useState(false)
  const [tugas, setTugas] = useState<TugasGuru>({ tahsin: true, guruKelas: false, bidangStudi: false })

  const showToast = (msg: string, error = false) => {
    setToast({ msg, error })
    setTimeout(() => setToast(null), 4500)
  }

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
  }, [])

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
      await hapusAkunStaf(akun.uid)
      setList((prev) => prev.filter((u) => u.uid !== akun.uid))
      setDipilih(null)
      setKonfirmasiHapus(null)
      setKetikHapus('')
      showToast(`${akun.nama} dihapus permanen (Auth + profil). Email ini bisa didaftarkan lagi.`)
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
    <div className="space-y-4">
      <PageHeader
        back={{ to: '/admin', label: 'Administrasi' }}
        title="Kelola Akun Guru"
        subtitle={`Buat login guru, atur kelas dan mapel. Akun orang tua ada di menu terpisah. ${list.length} akun staf.`}
        actions={
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => setMode('list')}
            className={`rounded-lg px-3 py-1.5 text-[12px] font-medium ${
              mode === 'list' ? 'bg-muh-600 text-white' : 'border border-border bg-white text-slate-600'
            }`}
          >
            Daftar
          </button>
          <button
            type="button"
            onClick={openCreate}
            className={`rounded-lg px-3 py-1.5 text-[12px] font-medium ${
              mode === 'form' && !editing ? 'bg-muh-600 text-white' : 'border border-border bg-white text-slate-600'
            }`}
          >
            Tambah guru
          </button>
          <button
            type="button"
            onClick={() => {
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
            }}
            className="rounded-lg border border-border bg-white px-3 py-1.5 text-[12px] font-medium text-slate-600 hover:bg-slate-50"
          >
            Ekspor JSON
          </button>
        </div>
        }
      />

      {toast && (
        <div
          className={`rounded-lg px-3 py-2 text-[12px] font-medium ${
            toast.error ? 'border border-red-200 bg-red-50 text-red-700' : 'border border-muh-200 bg-muh-50 text-muh-800'
          }`}
        >
          {toast.msg}
        </div>
      )}

      {kataSandiBaru && mode === 'list' && (
        <div className="card-soft border-peach-200 bg-peach-50/60 p-4">
          <p className="text-[13px] font-semibold text-slate-900">Password awal untuk {kataSandiBaru.nama}</p>
          <p className="mt-1 text-[12px] text-muted">
            {kataSandiBaru.email} — password ini tidak disimpan di aplikasi dan tidak ditampilkan lagi.
          </p>
          <p className="mt-2 font-mono text-[15px] font-semibold tracking-wide text-slate-900">{kataSandiBaru.password}</p>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={() => void navigator.clipboard.writeText(kataSandiBaru.password).then(
                () => showToast('Password disalin.'),
                () => showToast('Salin manual: clipboard ditolak browser.', true),
              )}
              className="rounded-lg bg-muh-600 px-3 py-1.5 text-[12px] font-semibold text-white hover:bg-muh-700"
            >
              Salin password
            </button>
            <button
              type="button"
              onClick={() => setKataSandiBaru(null)}
              className="rounded-lg border border-border bg-white px-3 py-1.5 text-[12px] font-medium text-slate-600"
            >
              Sudah saya catat
            </button>
          </div>
        </div>
      )}

      {mode === 'list' && (
        <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
          <section className="card-soft p-4">
            <div className="flex flex-wrap gap-1">
              {SARINGAN.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setSaringan(s.id)}
                  className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                    saringan === s.id ? 'bg-muh-600 text-white' : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
            <input
              type="search"
              value={cari}
              onChange={(e) => setCari(e.target.value)}
              placeholder="Cari nama atau email…"
              className="mt-3 w-full rounded-lg border border-border bg-slate-50/80 px-3 py-2 text-[13px] outline-none focus:border-muh-500 focus:bg-white focus:ring-2 focus:ring-muh-500/15"
            />
            <div className="mt-3 max-h-[32rem] overflow-auto rounded-lg border border-border">
              {loading ? (
                <p className="p-6 text-center text-[12px] text-muted">Memuat…</p>
              ) : tampil.length === 0 ? (
                <p className="p-6 text-center text-[12px] text-muted">Belum ada akun pada saringan ini.</p>
              ) : (
                <table className="w-full text-left text-[12px]">
                  <thead className="sticky top-0 bg-slate-50 text-[10px] uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-3 py-2 font-semibold">Nama</th>
                      <th className="px-3 py-2 font-semibold">Peran</th>
                      <th className="hidden px-3 py-2 font-semibold sm:table-cell">Tugas</th>
                      <th className="px-3 py-2 font-semibold">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tampil.map((u) => (
                      <tr
                        key={u.uid}
                        onClick={() => {
                          setDipilih(u)
                          setKonfirmasi(null)
                        }}
                        className={`cursor-pointer border-t border-border hover:bg-muh-50/40 ${
                          dipilih?.uid === u.uid ? 'bg-muh-50/60' : ''
                        }`}
                      >
                        <td className="px-3 py-2">
                          <div className="font-medium text-slate-900">{u.nama}</div>
                          <div className="text-[11px] text-muted">{u.email || '—'}</div>
                        </td>
                        <td className="px-3 py-2">{labelPeran(u)}</td>
                        <td className="hidden px-3 py-2 text-muted sm:table-cell">{ringkasTugas(u)}</td>
                        <td className="px-3 py-2">
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
                    ))}
                  </tbody>
                </table>
              )}
            </div>
            <p className="mt-2 text-[11px] text-muted">{tampil.length} ditampilkan</p>
          </section>

          <aside className="card-soft h-fit p-4">
            {!dipilih ? (
              <p className="text-[12px] text-muted">Pilih akun untuk mengubah tugas, reset password, menonaktifkan, atau menghapus permanen.</p>
            ) : (
              <div className="space-y-3 text-[12px]">
                <div>
                  <div className="text-[15px] font-semibold text-slate-900">
                    {dipilih.nama}{dipilih.gelar ? `, ${dipilih.gelar}` : ''}
                  </div>
                  <div className="text-[11px] text-muted">{dipilih.email}</div>
                  <div className="mt-1 flex flex-wrap gap-1">
                    <Badge tone={dipilih.roleRusak ? 'peach' : 'neutral'}>{labelPeran(dipilih)}</Badge>
                    {dipilih.status === 'pending' && <Badge tone="peach">Menunggu</Badge>}
                    {dipilih.status === 'rejected' && <Badge tone="neutral">Ditolak</Badge>}
                  </div>
                </div>
                <p className="border-t border-border pt-3 text-slate-700">{ringkasTugas(dipilih)}</p>
                {dipilih.penugasan && dipilih.penugasan.length > 0 && (
                  <ul className="space-y-1 text-[11px] text-muted">
                    {dipilih.penugasan.map((p) => (
                      <li key={`${p.kelas}-${p.mapel}`}>
                        {p.kelas} · {p.mapel}
                      </li>
                    ))}
                  </ul>
                )}
                {dipilih.status === 'pending' && (
                  <div className="rounded-lg border border-peach-200 bg-peach-50 p-2.5">
                    <p className="text-[11px] font-medium text-peach-800">Menunggu persetujuan</p>
                    <div className="mt-2 flex flex-col gap-1.5">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => openEdit(dipilih)}
                        className="w-full rounded-lg bg-muh-600 py-1.5 text-[11px] font-semibold text-white hover:bg-muh-700 disabled:opacity-60"
                      >
                        Setujui & atur tugas
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void terapkanStatus(dipilih, 'rejected')}
                        className="w-full rounded-lg border border-red-200 bg-white py-1.5 text-[11px] font-medium text-red-700 hover:bg-red-50 disabled:opacity-60"
                      >
                        Tolak pendaftaran
                      </button>
                    </div>
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => openEdit(dipilih)}
                  className="w-full rounded-lg bg-muh-600 py-2 text-[12px] font-semibold text-white hover:bg-muh-700"
                >
                  Ubah akun
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void handleReset(dipilih)}
                  className="w-full rounded-lg border border-border bg-white py-2 text-[12px] font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                >
                  Kirim tautan password
                </button>
                {dipilih.uid === profile.uid ? (
                  <p className="text-[11px] text-muted">Ini akun Anda. Peran dan status tidak dapat diubah dari sini.</p>
                ) : (
                  <>
                    {dipilih.aktif !== false ? (
                      konfirmasi === dipilih.uid ? (
                        <div className="rounded-lg border border-amber-200 bg-amber-50 p-2.5">
                          <p className="text-[11px] text-amber-900">
                            {dipilih.nama} tidak bisa masuk. Profil dan penugasan tetap ada; bisa diaktifkan lagi.
                          </p>
                          <div className="mt-2 flex gap-2">
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => void terapkanAktif(dipilih, false)}
                              className="rounded-lg bg-amber-700 px-2.5 py-1 text-[11px] font-semibold text-white disabled:opacity-60"
                            >
                              Ya, nonaktifkan
                            </button>
                            <button
                              type="button"
                              onClick={() => setKonfirmasi(null)}
                              className="rounded-lg px-2.5 py-1 text-[11px] font-medium text-slate-600"
                            >
                              Batal
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setKonfirmasi(dipilih.uid)
                            setKonfirmasiHapus(null)
                            setKetikHapus('')
                          }}
                          className="w-full rounded-lg border border-amber-200 py-2 text-[12px] font-medium text-amber-800 hover:bg-amber-50"
                        >
                          Nonaktifkan
                        </button>
                      )
                    ) : (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void terapkanAktif(dipilih, true)}
                        className="w-full rounded-lg border border-border bg-white py-2 text-[12px] font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                      >
                        Aktifkan kembali
                      </button>
                    )}

                    {konfirmasiHapus === dipilih.uid ? (
                      <div className="rounded-lg border border-red-200 bg-red-50 p-2.5">
                        <p className="text-[11px] leading-relaxed text-red-900">
                          Hapus permanen profil <strong>{dipilih.nama}</strong> dari sistem. Data nilai siswa
                          tidak dihapus, tetapi akun hilang dari daftar staf dan tidak bisa login.
                        </p>
                        <label className="mt-2 block text-[11px] font-medium text-red-800">
                          Ketik email akun untuk konfirmasi
                          <input
                            type="text"
                            value={ketikHapus}
                            onChange={(e) => setKetikHapus(e.target.value)}
                            placeholder={dipilih.email}
                            className="mt-1 w-full rounded-lg border border-red-200 bg-white px-2.5 py-1.5 text-[12px] text-slate-800 outline-none focus:border-red-400"
                            autoComplete="off"
                          />
                        </label>
                        <div className="mt-2 flex flex-wrap gap-2">
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => void hapusPermanen(dipilih)}
                            className="rounded-lg bg-red-700 px-2.5 py-1 text-[11px] font-semibold text-white disabled:opacity-60"
                          >
                            Ya, hapus permanen
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setKonfirmasiHapus(null)
                              setKetikHapus('')
                            }}
                            className="rounded-lg px-2.5 py-1 text-[11px] font-medium text-slate-600"
                          >
                            Batal
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setKonfirmasiHapus(dipilih.uid)
                          setKonfirmasi(null)
                          setKetikHapus('')
                        }}
                        className="w-full rounded-lg border border-red-300 py-2 text-[12px] font-medium text-red-700 hover:bg-red-50"
                      >
                        Hapus permanen
                      </button>
                    )}
                  </>
                )}
              </div>
            )}
          </aside>
        </div>
      )}

      {mode === 'form' && (
        <section className="card-soft p-4 sm:p-5">
          <h2 className="text-[14px] font-semibold text-slate-800">
            {editing ? (editing.status === 'pending' ? 'Setujui akun guru' : 'Ubah akun') : 'Tambah akun guru'}
          </h2>
          {editing?.status === 'pending' && (
            <p className="mt-2 rounded-lg border border-peach-200 bg-peach-50 px-3 py-2 text-[12px] text-peach-800">
              Menyimpan akan menyetujui akun ini. Atur peran, kelas, dan penugasan mapel sebelum menyimpan.
            </p>
          )}
          {editing?.roleRusak && (
            <p className="mt-2 rounded-lg border border-peach-200 bg-peach-50 px-3 py-2 text-[12px] text-slate-800">
              Role tersimpan ({editing.roleRusak}) tidak dikenal. Pilih peran yang benar sebelum menyimpan.
            </p>
          )}
          <form onSubmit={(e) => void handleSave(e)} className="mt-3 space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Nama *">
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
                  placeholder="contoh: S.Pd"
                  onChange={(e) => setF('gelar', e.target.value)}
                />
              </Field>
              <Field label="Email *">
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
              <div className="sm:col-span-2">
                <span className="mb-1.5 block text-[11px] font-medium text-slate-600">Tugas *</span>
                <p className="mb-2 text-[11px] text-muted">
                  Boleh lebih dari satu. Contoh: Tahsin-Tahfizh sekaligus guru kelas, atau Tahsin sekaligus bidang studi.
                </p>
                <button
                  type="button"
                  disabled={terkunci}
                  onClick={() => setSebagaiAdmin((v) => !v)}
                  className={`mb-2 w-full rounded-lg border px-3 py-2 text-left text-[12px] disabled:opacity-60 ${
                    sebagaiAdmin ? 'border-muh-500 bg-muh-50' : 'border-border bg-white'
                  }`}
                >
                  <div className="font-semibold text-slate-800">Administrator</div>
                  <div className="mt-0.5 text-[11px] text-muted">Semua modul. Kelas dan mapel tidak perlu diisi.</div>
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
                          onClick={() => setTugas((prev) => ({ ...prev, [o.key]: !prev[o.key] }))}
                          className={`rounded-lg border px-3 py-2 text-left text-[12px] disabled:opacity-60 ${
                            aktif ? 'border-muh-500 bg-muh-50 text-muh-900' : 'border-border bg-white text-slate-700'
                          }`}
                        >
                          <div className="font-semibold">{aktif ? '✓ ' : ''}{o.label}</div>
                          <div className="mt-0.5 text-[11px] text-muted">{o.desk}</div>
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
              {!editing && (
                <Field label="Password awal *">
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
                      className="shrink-0 rounded-lg border border-border px-3 text-[11px] font-medium text-slate-600 hover:bg-slate-50"
                    >
                      Acak
                    </button>
                  </div>
                </Field>
              )}
            </div>
            {editing && (
              <p className="text-[11px] text-muted">
                Email login tidak diubah di sini. Untuk password, kirim tautan ke email guru dari panel daftar.
              </p>
            )}
            {sebagaiAdmin && (
              <p className="rounded-lg bg-slate-50 px-3 py-2 text-[12px] text-muted">
                Administrator membuka semua modul. Kelas dan mapel tidak perlu diisi.
              </p>
            )}
            {butuhTahsin && butuhKelas && (
              <p className="rounded-lg bg-muh-50 px-3 py-2 text-[12px] text-muh-900">
                Kombinasi: guru Tahsin-Tahfizh yang juga menjadi guru kelas. Isi kedua bagian di bawah.
              </p>
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
              <label className="flex items-center gap-2 text-[12px] text-slate-700">
                <input
                  type="checkbox"
                  checked={form.aktif}
                  onChange={(e) => setF('aktif', e.target.checked)}
                />
                Akun aktif (boleh masuk)
              </label>
            )}
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={busy}
                className="rounded-lg bg-muh-600 px-4 py-2 text-[12px] font-semibold text-white hover:bg-muh-700 disabled:opacity-60"
              >
                {busy ? 'Menyimpan…' : 'Simpan'}
              </button>
              <button
                type="button"
                onClick={() => setMode('list')}
                className="rounded-lg border border-border bg-white px-4 py-2 text-[12px] font-medium text-slate-600"
              >
                Batal
              </button>
            </div>
          </form>
        </section>
      )}
    </div>
  )
}