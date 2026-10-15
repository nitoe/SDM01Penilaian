import { useCallback, useEffect, useMemo, useState } from 'react'
import Tabs, { type TabItem } from '../components/Tabs'
import { Badge, PageHeader } from '../components/ui'
import { useToast } from './akademik/shared'
import { kirimLaporan, muatInboxAdmin, muatLaporanSaya, ubahStatus } from '../lib/notifikasi'
import {
  hitungPerJenis,
  saringInbox,
  statusBerikut,
  validasiLaporan,
  type SaringJenis,
  type SaringStatus,
} from '../lib/notifikasiRumus'
import { SEMUA_KELAS } from '../types/tahsin'
import { isAdminRole } from '../lib/roles'
import { namaDenganGelar, type AppUser } from '../types/user'
import {
  BATAS_ISI,
  BATAS_JUDUL,
  JENIS_LABEL,
  STATUS_LABEL,
  type ArahMutasi,
  type JenisNotifikasi,
  type Notifikasi,
  type StatusNotifikasi,
} from '../types/notifikasi'

const WAKTU = new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
const TANGGAL = new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
const nadaStatus = (s: StatusNotifikasi) => (s === 'selesai' ? 'green' : s === 'baru' ? 'peach' : 'neutral')

function Rincian({ n }: { n: Notifikasi }) {
  return (
    <div className="space-y-2 text-[13px] text-slate-700">
      {n.mutasi && (
        <p>
          <span className="font-medium">Siswa {n.mutasi.arah}:</span> {n.mutasi.namaSiswa} ·{' '}
          {TANGGAL.format(new Date(`${n.mutasi.tanggal}T00:00:00`))}
          {n.mutasi.keterangan ? ` · ${n.mutasi.keterangan}` : ''}
        </p>
      )}
      <p className="whitespace-pre-wrap">{n.isi}</p>
      {n.catatanAdmin && (
        <p className="rounded-lg bg-slate-50 p-2.5 text-[12px] text-slate-600">
          <span className="font-medium">Catatan admin:</span> {n.catatanAdmin}
        </p>
      )}
    </div>
  )
}

function InboxAdmin() {
  const [daftar, setDaftar] = useState<Notifikasi[] | null>(null)
  const [galat, setGalat] = useState(false)
  const [jenis, setJenis] = useState<SaringJenis>('semua')
  const [status, setStatus] = useState<SaringStatus>('aktif')
  const [buka, setBuka] = useState<string | null>(null)
  const [catatan, setCatatan] = useState('')
  const [menyimpan, setMenyimpan] = useState(false)
  const toast = useToast()

  const muat = useCallback(() => {
    setGalat(false)
    muatInboxAdmin()
      .then(setDaftar)
      .catch(() => setGalat(true))
  }, [])
  useEffect(muat, [muat])

  const hitung = useMemo(() => hitungPerJenis(daftar ?? []), [daftar])
  const tampil = useMemo(() => saringInbox(daftar ?? [], jenis, status), [daftar, jenis, status])

  const tabs: TabItem[] = [
    { id: 'semua', label: 'Semua', hitung: hitung.semua },
    { id: 'laporan_tugas', label: 'Laporan tugas', hitung: hitung.laporan_tugas },
    { id: 'laporan_kendala', label: 'Kendala', hitung: hitung.laporan_kendala },
    { id: 'mutasi_siswa', label: 'Mutasi siswa', hitung: hitung.mutasi_siswa },
  ]

  async function ganti(n: Notifikasi, baru: StatusNotifikasi) {
    setMenyimpan(true)
    try {
      await ubahStatus(n.id, baru, catatan !== (n.catatanAdmin ?? '') ? catatan : undefined)
      toast.show(`Status diubah: ${STATUS_LABEL[baru]}`)
      muat()
    } catch {
      toast.show('Gagal mengubah status.', true)
    } finally {
      setMenyimpan(false)
    }
  }

  const chip = (id: SaringStatus, teks: string) => (
    <button
      type="button"
      aria-pressed={status === id}
      onClick={() => setStatus(id)}
      className={`rounded-full px-3 py-1 text-[12px] font-medium ${
        status === id ? 'bg-muh-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
      }`}
    >
      {teks}
    </button>
  )

  return (
    <>
      <Tabs items={tabs} aktif={jenis} onUbah={(id) => setJenis(id as SaringJenis)} ariaLabel="Jenis laporan">
        <div className="mb-3 flex flex-wrap gap-2">
          {chip('aktif', 'Belum selesai')}
          {chip('selesai', 'Selesai')}
          {chip('semua', 'Semua')}
        </div>

        {galat && (
          <p className="card-soft p-4 text-[13px] text-red-700">
            Kotak masuk belum bisa dimuat. Pastikan rules terbaru sudah di-deploy.
          </p>
        )}
        {!galat && daftar === null && <div className="card-soft h-24 animate-pulse bg-slate-50" />}
        {daftar && tampil.length === 0 && (
          <p className="card-soft p-4 text-[13px] text-muted">Tidak ada laporan pada tampilan ini.</p>
        )}
        <ul className="space-y-2">
          {tampil.map((n) => {
            const terbuka = buka === n.id
            return (
              <li key={n.id} className="card-soft">
                <button
                  type="button"
                  aria-expanded={terbuka}
                  onClick={() => {
                    setBuka(terbuka ? null : n.id)
                    setCatatan(n.catatanAdmin ?? '')
                  }}
                  className="flex w-full items-start justify-between gap-3 px-4 py-3 text-left"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-[14px] font-semibold text-slate-900">{n.judul}</span>
                    <span className="block text-[12px] text-muted">
                      {JENIS_LABEL[n.jenis]} · {n.dariNama}
                      {n.kelas ? ` · ${n.kelas}` : ''}
                      {n.createdAt ? ` · ${WAKTU.format(n.createdAt)}` : ''}
                    </span>
                  </span>
                  <Badge tone={nadaStatus(n.status)}>{STATUS_LABEL[n.status]}</Badge>
                </button>
                {terbuka && (
                  <div className="space-y-3 border-t border-border px-4 py-3">
                    <Rincian n={{ ...n, catatanAdmin: undefined }} />
                    <label className="block text-[12px] font-medium text-slate-600">
                      Catatan untuk guru (opsional)
                      <textarea
                        value={catatan}
                        onChange={(e) => setCatatan(e.target.value)}
                        rows={2}
                        maxLength={500}
                        className="mt-1 w-full rounded-lg border border-border bg-white px-3 py-2 text-[13px] font-normal outline-none focus:border-muh-500"
                      />
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {statusBerikut(n.status).map((s) => (
                        <button
                          key={s}
                          type="button"
                          disabled={menyimpan}
                          onClick={() => ganti(n, s)}
                          className="rounded-lg border border-border bg-white px-3 py-1.5 text-[12px] font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                        >
                          Tandai {STATUS_LABEL[s].toLowerCase()}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      </Tabs>
      {toast.node}
    </>
  )
}

const JENIS_FORM: JenisNotifikasi[] = ['laporan_tugas', 'laporan_kendala', 'mutasi_siswa']

function LaporanGuru({ profile }: { profile: AppUser }) {
  const [jenis, setJenis] = useState<JenisNotifikasi>('laporan_kendala')
  const [judul, setJudul] = useState('')
  const [isi, setIsi] = useState('')
  const [kelas, setKelas] = useState('')
  const [arah, setArah] = useState<ArahMutasi>('masuk')
  const [namaSiswa, setNamaSiswa] = useState('')
  const [tanggal, setTanggal] = useState(() => new Date().toISOString().slice(0, 10))
  const [keterangan, setKeterangan] = useState('')
  const [kirim, setKirim] = useState(false)
  const [riwayat, setRiwayat] = useState<Notifikasi[] | null>(null)
  const [galat, setGalat] = useState(false)
  const toast = useToast()

  const kelasOpsi = useMemo(() => {
    const k = new Set<string>([
      ...(profile.waliKelas ?? []),
      ...(profile.kelasAmpu ?? []),
      ...(profile.penugasan ?? []).map((p) => p.kelas),
    ])
    return k.size ? [...k].sort() : [...SEMUA_KELAS]
  }, [profile])

  const muat = useCallback(() => {
    setGalat(false)
    muatLaporanSaya(profile.uid)
      .then(setRiwayat)
      .catch(() => setGalat(true))
  }, [profile.uid])
  useEffect(muat, [muat])

  async function onKirim() {
    const masukan = {
      jenis,
      judul,
      isi,
      kelas: kelas || undefined,
      mutasi: jenis === 'mutasi_siswa' ? { arah, namaSiswa, tanggal, keterangan } : undefined,
    }
    const salah = validasiLaporan(masukan)
    if (salah.length) return toast.show(salah[0], true)
    setKirim(true)
    try {
      await kirimLaporan(masukan, { uid: profile.uid, nama: namaDenganGelar(profile) })
      toast.show('Laporan terkirim ke admin.')
      setJudul('')
      setIsi('')
      setNamaSiswa('')
      setKeterangan('')
      muat()
    } catch {
      toast.show('Laporan gagal dikirim. Coba lagi.', true)
    } finally {
      setKirim(false)
    }
  }

  const input = 'mt-1 w-full rounded-lg border border-border bg-white px-3 py-2 text-[13px] font-normal outline-none focus:border-muh-500'

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <section className="card-soft space-y-3 p-4">
        <h3 className="text-[14px] font-semibold text-slate-900">Buat laporan</h3>
        <div role="radiogroup" aria-label="Jenis laporan" className="flex flex-wrap gap-2">
          {JENIS_FORM.map((j) => (
            <button
              key={j}
              type="button"
              role="radio"
              aria-checked={jenis === j}
              onClick={() => setJenis(j)}
              className={`rounded-full px-3 py-1 text-[12px] font-medium ${
                jenis === j ? 'bg-muh-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {JENIS_LABEL[j]}
            </button>
          ))}
        </div>

        {jenis === 'mutasi_siswa' && (
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-[12px] font-medium text-slate-600">
              Arah mutasi
              <select value={arah} onChange={(e) => setArah(e.target.value as ArahMutasi)} className={input}>
                <option value="masuk">Siswa masuk</option>
                <option value="keluar">Siswa keluar</option>
              </select>
            </label>
            <label className="text-[12px] font-medium text-slate-600">
              Tanggal
              <input type="date" value={tanggal} onChange={(e) => setTanggal(e.target.value)} className={input} />
            </label>
            <label className="text-[12px] font-medium text-slate-600 sm:col-span-2">
              Nama siswa
              <input value={namaSiswa} onChange={(e) => setNamaSiswa(e.target.value)} className={input} />
            </label>
            <label className="text-[12px] font-medium text-slate-600 sm:col-span-2">
              {arah === 'masuk' ? 'Sekolah asal' : 'Sekolah tujuan'} (opsional)
              <input value={keterangan} onChange={(e) => setKeterangan(e.target.value)} className={input} />
            </label>
          </div>
        )}

        <label className="block text-[12px] font-medium text-slate-600">
          Kelas terkait (opsional)
          <select value={kelas} onChange={(e) => setKelas(e.target.value)} className={input}>
            <option value="">Tidak ada</option>
            {kelasOpsi.map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-[12px] font-medium text-slate-600">
          Judul
          <input value={judul} maxLength={BATAS_JUDUL} onChange={(e) => setJudul(e.target.value)} className={input} />
        </label>
        <label className="block text-[12px] font-medium text-slate-600">
          Isi laporan
          <textarea value={isi} maxLength={BATAS_ISI} rows={5} onChange={(e) => setIsi(e.target.value)} className={input} />
        </label>
        <button
          type="button"
          onClick={onKirim}
          disabled={kirim}
          className="rounded-lg bg-muh-600 px-4 py-2 text-[13px] font-semibold text-white hover:bg-muh-700 disabled:opacity-50"
        >
          {kirim ? 'Mengirim…' : 'Kirim ke admin'}
        </button>
      </section>

      <section className="space-y-2">
        <h3 className="text-[14px] font-semibold text-slate-900">Laporan saya</h3>
        {galat && <p className="card-soft p-4 text-[13px] text-red-700">Riwayat belum bisa dimuat.</p>}
        {!galat && riwayat === null && <div className="card-soft h-24 animate-pulse bg-slate-50" />}
        {riwayat && riwayat.length === 0 && (
          <p className="card-soft p-4 text-[13px] text-muted">Belum ada laporan yang Anda kirim.</p>
        )}
        <ul className="space-y-2">
          {riwayat?.map((n) => (
            <li key={n.id} className="card-soft space-y-2 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-[14px] font-semibold text-slate-900">{n.judul}</p>
                  <p className="text-[12px] text-muted">
                    {JENIS_LABEL[n.jenis]}
                    {n.createdAt ? ` · ${WAKTU.format(n.createdAt)}` : ''}
                  </p>
                </div>
                <Badge tone={nadaStatus(n.status)}>{STATUS_LABEL[n.status]}</Badge>
              </div>
              <Rincian n={n} />
            </li>
          ))}
        </ul>
      </section>
      {toast.node}
    </div>
  )
}

export default function Notifikasi({ profile }: { profile: AppUser }) {
  const admin = isAdminRole(profile.role)
  return (
    <div className="space-y-4">
      <PageHeader
        title={admin ? 'Notifikasi' : 'Laporan ke Admin'}
        subtitle={
          admin
            ? 'Laporan tugas, kendala, dan mutasi siswa dari guru. Ubah status setelah ditindaklanjuti.'
            : 'Sampaikan laporan tugas, kendala, atau mutasi siswa masuk/keluar kepada admin.'
        }
      />
      {admin ? <InboxAdmin /> : <LaporanGuru profile={profile} />}
    </div>
  )
}
