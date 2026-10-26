import { useCallback, useEffect, useMemo, useState } from 'react'
import { PageHeader } from '../../components/ui'
import { Badge } from '../../components/ui'
import { BackLink, Notice, Spinner, btnGhost, btnPrimary, useToast } from './shared'
import { kelasSaya } from '../../lib/kelasSaya'
import { getSiswaList } from '../../lib/tahsinData'
import {
  ajukanMutasi,
  batalkanPengajuan,
  listPengajuanWali,
  validasiPengajuan,
} from '../../lib/mutasi'
import { isGuruAkademikRole } from '../../lib/roles'
import { namaDenganGelar, type AppUser } from '../../types/user'
import type { SiswaTahsin } from '../../types/tahsin'
import {
  ARAH_LABEL,
  STATUS_PENGAJUAN_LABEL,
  type ArahMutasi,
  type PengajuanMutasi,
} from '../../types/mutasi'
import { BATAS_ALASAN, BATAS_CATATAN } from '../../types/mutasi'

const inputCls =
  'mt-1 w-full rounded-lg border border-border bg-white px-3 py-2 text-[13px] outline-none focus:border-muh-500'

function nadaStatus(s: PengajuanMutasi['status']): 'green' | 'peach' | 'neutral' {
  if (s === 'disetujui') return 'green'
  if (s === 'diajukan') return 'peach'
  // ditolak / dibatalkan — Badge tidak punya tone "red"
  return 'neutral'
}

export default function MutasiSiswa({ profile }: { profile: AppUser }) {
  const toast = useToast()
  const wali = useMemo(() => kelasSaya(profile).wali, [profile])
  const boleh = isGuruAkademikRole(profile.role) && wali.length > 0

  const [kelas, setKelas] = useState(wali[0] ?? '')
  const [arah, setArah] = useState<ArahMutasi>('keluar')
  const [siswaId, setSiswaId] = useState('')
  const [siswaList, setSiswaList] = useState<SiswaTahsin[] | null>(null)
  const [namaMasuk, setNamaMasuk] = useState('')
  const [nisMasuk, setNisMasuk] = useState('')
  const [jkMasuk, setJkMasuk] = useState('')
  const [tanggal, setTanggal] = useState(() => new Date().toISOString().slice(0, 10))
  const [alasan, setAlasan] = useState('')
  const [sekolah, setSekolah] = useState('')
  const [catatan, setCatatan] = useState('')
  const [busy, setBusy] = useState(false)
  const [daftar, setDaftar] = useState<PengajuanMutasi[] | null>(null)

  const muatDaftar = useCallback(() => {
    if (!boleh) return
    listPengajuanWali({ uid: profile.uid, kelasWali: wali })
      .then(setDaftar)
      .catch((e: unknown) => {
        console.error(e)
        setDaftar([])
        const code = e && typeof e === 'object' && 'code' in e ? String((e as { code: string }).code) : ''
        const msg =
          code === 'permission-denied'
            ? 'Tidak diizinkan membaca pengajuan. Cek rules pengajuan_mutasi & field waliKelas di akun Anda.'
            : code === 'failed-precondition'
              ? 'Indeks Firestore belum siap. Coba lagi beberapa menit atau buat indeks dari tautan di konsol browser.'
              : 'Gagal memuat pengajuan. Periksa koneksi dan rules mutasi.'
        toast.show(msg, true)
      })
  }, [boleh, profile.uid, wali, toast])

  useEffect(() => {
    muatDaftar()
  }, [muatDaftar])

  useEffect(() => {
    if (!kelas || arah !== 'keluar') {
      setSiswaList(null)
      return
    }
    let batal = false
    getSiswaList(kelas, { role: profile.role, kelasAmpu: [] })
      .then((list) => {
        if (!batal) setSiswaList(list.filter((s) => s.aktif !== false))
      })
      .catch(() => {
        if (!batal) setSiswaList([])
      })
    return () => {
      batal = true
    }
  }, [kelas, arah, profile.role])

  if (!isGuruAkademikRole(profile.role)) {
    return (
      <div className="space-y-4">
        <BackLink to="/akademik">Akademik & Rapor</BackLink>
        <Notice tone="error">Mutasi siswa hanya diajukan oleh guru kelas (wali kelas).</Notice>
      </div>
    )
  }

  if (!wali.length) {
    return (
      <div className="space-y-4">
        <BackLink to="/akademik">Akademik & Rapor</BackLink>
        <Notice tone="error">
          Anda belum ditetapkan sebagai wali kelas. Hubungi admin untuk mengatur penugasan wali kelas.
        </Notice>
      </div>
    )
  }

  async function onAjukan() {
    const salah = validasiPengajuan(
      arah === 'keluar'
        ? {
            arah: 'keluar',
            siswa: (siswaList ?? []).find((s) => s.id === siswaId)!,
            tanggal,
            alasan,
            sekolahTerkait: sekolah,
            catatan,
          }
        : {
            arah: 'masuk',
            kelas,
            siswaNama: namaMasuk,
            tanggal,
            alasan,
            sekolahTerkait: sekolah,
            catatan,
            calon: { nis: nisMasuk, jk: jkMasuk || undefined },
          },
    )
    if (arah === 'keluar' && !siswaId) {
      toast.show('Pilih siswa yang keluar.', true)
      return
    }
    if (salah.length) {
      toast.show(salah[0], true)
      return
    }
    setBusy(true)
    try {
      if (arah === 'keluar') {
        const s = (siswaList ?? []).find((x) => x.id === siswaId)
        if (!s) throw new Error('Siswa tidak ditemukan.')
        await ajukanMutasi(
          {
            arah: 'keluar',
            siswa: s,
            tanggal,
            alasan,
            sekolahTerkait: sekolah || undefined,
            catatan: catatan || undefined,
          },
          { uid: profile.uid, nama: namaDenganGelar(profile) },
        )
      } else {
        await ajukanMutasi(
          {
            arah: 'masuk',
            kelas,
            siswaNama: namaMasuk,
            tanggal,
            alasan,
            sekolahTerkait: sekolah || undefined,
            catatan: catatan || undefined,
            calon: {
              nis: nisMasuk || undefined,
              jk: jkMasuk || undefined,
            },
          },
          { uid: profile.uid, nama: namaDenganGelar(profile) },
        )
      }
      toast.show('Pengajuan mutasi dikirim. Menunggu persetujuan admin.')
      setSiswaId('')
      setNamaMasuk('')
      setNisMasuk('')
      setJkMasuk('')
      setAlasan('')
      setSekolah('')
      setCatatan('')
      muatDaftar()
    } catch (e) {
      console.error(e)
      toast.show(e instanceof Error ? e.message : 'Gagal mengajukan mutasi.', true)
    } finally {
      setBusy(false)
    }
  }

  async function onBatal(id: string) {
    if (!confirm('Batalkan pengajuan ini?')) return
    try {
      await batalkanPengajuan(id)
      toast.show('Pengajuan dibatalkan.')
      muatDaftar()
    } catch (e) {
      toast.show(e instanceof Error ? e.message : 'Gagal membatalkan.', true)
    }
  }

  return (
    <div className="space-y-5">
      <PageHeader
        back={{ to: '/akademik', label: 'Akademik & Rapor' }}
        title="Mutasi Siswa"
        subtitle="Ajukan siswa masuk atau keluar. Hanya wali kelas yang boleh mengajukan; admin yang menyetujui."
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="card-soft space-y-3 p-4">
          <h3 className="text-[14px] font-semibold text-slate-900">Form pengajuan</h3>

          <label className="block text-[12px] font-medium text-slate-600">
            Kelas (yang Anda walikan)
            <select value={kelas} onChange={(e) => setKelas(e.target.value)} className={inputCls}>
              {wali.map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </select>
          </label>

          <div role="radiogroup" aria-label="Arah mutasi" className="flex flex-wrap gap-2">
            {(['keluar', 'masuk'] as ArahMutasi[]).map((a) => (
              <button
                key={a}
                type="button"
                role="radio"
                aria-checked={arah === a}
                onClick={() => setArah(a)}
                className={`rounded-full px-3 py-1 text-[12px] font-medium ${
                  arah === a ? 'bg-muh-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {ARAH_LABEL[a]}
              </button>
            ))}
          </div>

          {arah === 'keluar' ? (
            <label className="block text-[12px] font-medium text-slate-600">
              Siswa
              <select
                value={siswaId}
                onChange={(e) => setSiswaId(e.target.value)}
                className={inputCls}
                disabled={!siswaList}
              >
                <option value="">{siswaList ? '— Pilih siswa —' : 'Memuat…'}</option>
                {(siswaList ?? []).map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.nama}
                    {s.nis || s.nipd ? ` (${s.nis || s.nipd})` : ''}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <>
              <label className="block text-[12px] font-medium text-slate-600">
                Nama siswa masuk
                <input value={namaMasuk} onChange={(e) => setNamaMasuk(e.target.value)} className={inputCls} />
              </label>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block text-[12px] font-medium text-slate-600">
                  NIS / NIPD (opsional)
                  <input value={nisMasuk} onChange={(e) => setNisMasuk(e.target.value)} className={inputCls} />
                </label>
                <label className="block text-[12px] font-medium text-slate-600">
                  Jenis kelamin
                  <select value={jkMasuk} onChange={(e) => setJkMasuk(e.target.value)} className={inputCls}>
                    <option value="">—</option>
                    <option value="L">Laki-laki</option>
                    <option value="P">Perempuan</option>
                  </select>
                </label>
              </div>
            </>
          )}

          <label className="block text-[12px] font-medium text-slate-600">
            Tanggal mutasi
            <input type="date" value={tanggal} onChange={(e) => setTanggal(e.target.value)} className={inputCls} />
          </label>
          <label className="block text-[12px] font-medium text-slate-600">
            Alasan
            <textarea
              value={alasan}
              maxLength={BATAS_ALASAN}
              rows={3}
              onChange={(e) => setAlasan(e.target.value)}
              className={inputCls}
              placeholder="Contoh: pindah domisili, mengikuti orang tua, …"
            />
          </label>
          <label className="block text-[12px] font-medium text-slate-600">
            {arah === 'masuk' ? 'Sekolah asal' : 'Sekolah tujuan'} (opsional)
            <input value={sekolah} onChange={(e) => setSekolah(e.target.value)} className={inputCls} />
          </label>
          <label className="block text-[12px] font-medium text-slate-600">
            Catatan tambahan (opsional)
            <textarea
              value={catatan}
              maxLength={BATAS_CATATAN}
              rows={2}
              onChange={(e) => setCatatan(e.target.value)}
              className={inputCls}
            />
          </label>

          <button type="button" disabled={busy} onClick={onAjukan} className={btnPrimary}>
            {busy ? 'Mengirim…' : 'Ajukan ke admin'}
          </button>
        </section>

        <section className="space-y-2">
          <h3 className="text-[14px] font-semibold text-slate-900">Pengajuan saya / kelas wali</h3>
          {daftar === null && <Spinner />}
          {daftar && daftar.length === 0 && (
            <p className="card-soft p-4 text-[13px] text-muted">Belum ada pengajuan mutasi.</p>
          )}
          <ul className="space-y-2">
            {daftar?.map((p) => (
              <li key={p.id} className="card-soft space-y-2 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[14px] font-semibold text-slate-900">
                      {ARAH_LABEL[p.arah]} · {p.siswaNama}
                    </p>
                    <p className="text-[12px] text-muted">
                      Kelas {p.kelas} · {p.tanggal}
                      {p.sekolahTerkait ? ` · ${p.sekolahTerkait}` : ''}
                    </p>
                  </div>
                  <Badge tone={nadaStatus(p.status)}>{STATUS_PENGAJUAN_LABEL[p.status]}</Badge>
                </div>
                <p className="text-[13px] text-slate-700 whitespace-pre-wrap">{p.alasan}</p>
                {p.catatanAdmin && (
                  <p className="rounded-lg bg-slate-50 p-2 text-[12px] text-slate-600">
                    <span className="font-medium">Catatan admin:</span> {p.catatanAdmin}
                  </p>
                )}
                {p.status === 'diajukan' && p.diajukanOleh === profile.uid && (
                  <button type="button" className={btnGhost} onClick={() => onBatal(p.id)}>
                    Batalkan
                  </button>
                )}
              </li>
            ))}
          </ul>
        </section>
      </div>
      {toast.node}
    </div>
  )
}
