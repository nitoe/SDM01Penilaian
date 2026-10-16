import { useCallback, useEffect, useMemo, useState } from 'react'
import Tabs, { type TabItem } from '../../components/Tabs'
import { PageHeader } from '../../components/ui'
import { kelasSaya } from '../../lib/kelasSaya'
import { getSiswaList } from '../../lib/tahsinData'
import { usePeriodeAkademik } from '../../lib/usePeriodeAkademik'
import {
  getAbsensiKelas,
  getEkskulMaster,
  getEkskulSiswaKelas,
  getKokurikulerKelas,
  hapusEkskulSiswa,
  simpanAbsensiBanyak,
  simpanEkskulSiswa,
  simpanKokurikulerBanyak,
} from '../../lib/raporData'
import { bersihkanAbsensi } from '../../lib/raporDataRumus'
import { isAdminRole } from '../../lib/roles'
import { SEMUA_KELAS, type SiswaTahsin } from '../../types/tahsin'
import type { AppUser } from '../../types/user'
import {
  BATAS_CATATAN,
  BATAS_EKSKUL_DESKRIPSI,
  BATAS_KOKURIKULER,
  EKS_LEVEL_LABEL,
  KEPUTUSAN_OPSI,
  type AbsensiRapor,
  type Ekstrakurikuler,
  type EkskulSiswa,
  type KeputusanKenaikan,
  type LevelEkskul,
} from '../../types/raporData'
import { BackLink, Notice, Spinner, btnGhost, btnPrimary, inputCls, selectCls, useToast } from './shared'

type TabId = 'absensi' | 'kokurikuler' | 'ekskul'

/**
 * Kelengkapan Rapor SAS: data yang diisi wali kelas untuk rapor akhir — ketidakhadiran, catatan wali,
 * keputusan kenaikan (semester 2), deskripsi kokurikuler, dan ekstrakurikuler siswa (ANTIREGRESI §23).
 * Wali kelas mengisi kelasnya; admin hanya melihat (semua isian dinonaktifkan, §17).
 */
export default function KelengkapanRapor({ profile }: { profile: AppUser }) {
  const admin = isAdminRole(profile.role)
  const periodeAk = usePeriodeAkademik()
  const { wali } = kelasSaya(profile)
  const kelasBoleh = useMemo<string[]>(() => (admin ? [...SEMUA_KELAS] : wali), [admin, wali])
  const [kelas, setKelas] = useState(kelasBoleh[0] || '')
  const [tab, setTab] = useState<TabId>('absensi')
  const [siswa, setSiswa] = useState<SiswaTahsin[] | null>(null)
  const [absensi, setAbsensi] = useState<Record<string, AbsensiRapor>>({})
  const [kokur, setKokur] = useState<Record<string, string>>({})
  const [ekskul, setEkskul] = useState<EkskulSiswa[]>([])
  const [master, setMaster] = useState<Ekstrakurikuler[]>([])
  const [memuat, setMemuat] = useState(false)
  const [galat, setGalat] = useState('')
  const [menyimpan, setMenyimpan] = useState(false)
  const [umum, setUmum] = useState('')
  const toast = useToast()

  const periode = useMemo(
    () => (periodeAk.ready ? { tahunAjaran: periodeAk.tahunAjaran, semester: periodeAk.semester } : null),
    [periodeAk.ready, periodeAk.tahunAjaran, periodeAk.semester],
  )

  const muat = useCallback(async () => {
    if (!kelas || !periode) return
    setMemuat(true)
    setGalat('')
    try {
      const [s, a, k, e, m] = await Promise.all([
        getSiswaList(kelas, { role: profile.role, kelasAmpu: [] }),
        getAbsensiKelas(kelas, periode),
        getKokurikulerKelas(kelas, periode),
        getEkskulSiswaKelas(kelas, periode),
        getEkskulMaster(),
      ])
      setSiswa(s)
      setAbsensi(a)
      setKokur(k)
      setEkskul(e)
      setMaster(m.filter((x) => x.aktif))
    } catch (err) {
      console.error(err)
      setGalat('Gagal memuat data. Periksa koneksi, hak akses, dan apakah rules terbaru sudah di-deploy.')
    } finally {
      setMemuat(false)
    }
  }, [kelas, periode, profile.role])
  useEffect(() => {
    void muat()
  }, [muat])

  const draft = (id: string): AbsensiRapor =>
    absensi[id] ??
    bersihkanAbsensi({ siswaId: id, kelas, semester: periode?.semester ?? '1', tahunAjaran: periode?.tahunAjaran ?? '' })
  const ubahAbsensi = (id: string, p: Partial<AbsensiRapor>) =>
    setAbsensi((m) => ({ ...m, [id]: { ...draft(id), ...p } as AbsensiRapor }))

  async function simpanAbsensi() {
    if (!periode || !siswa) return
    setMenyimpan(true)
    try {
      await simpanAbsensiBanyak(
        siswa.map((s) => ({ ...draft(s.id), kelas, semester: periode.semester, tahunAjaran: periode.tahunAjaran })),
      )
      toast.show('Ketidakhadiran dan catatan wali tersimpan.')
    } catch (e) {
      console.error(e)
      toast.show('Gagal menyimpan. Coba lagi.', true)
    } finally {
      setMenyimpan(false)
    }
  }

  async function simpanKokurikuler() {
    if (!periode || !siswa) return
    setMenyimpan(true)
    try {
      await simpanKokurikulerBanyak(
        kelas,
        periode,
        Object.fromEntries(siswa.map((s) => [s.id, kokur[s.id] ?? ''])),
      )
      toast.show('Deskripsi kokurikuler tersimpan.')
    } catch (e) {
      console.error(e)
      toast.show('Gagal menyimpan. Coba lagi.', true)
    } finally {
      setMenyimpan(false)
    }
  }

  if (kelasBoleh.length === 0) {
    return (
      <div className="space-y-4">
        <BackLink to="/akademik">Akademik & Rapor</BackLink>
        <Notice>Halaman ini untuk wali kelas. Akun Anda belum ditetapkan sebagai wali kelas; hubungi admin.</Notice>
      </div>
    )
  }

  const tabs: TabItem[] = [
    { id: 'absensi', label: 'Ketidakhadiran & Keputusan' },
    { id: 'kokurikuler', label: 'Kokurikuler' },
    { id: 'ekskul', label: 'Ekstrakurikuler' },
  ]
  const semester2 = periode?.semester === '2'

  return (
    <div className="space-y-5">
      <PageHeader
        back={{ to: '/akademik', label: admin ? 'Pantauan Akademik' : 'Akademik & Rapor' }}
        title="Kelengkapan Rapor SAS"
        subtitle={
          admin
            ? 'Mode lihat. Wali kelas mengisi ketidakhadiran, kokurikuler, dan ekstrakurikuler; administrator hanya membaca.'
            : 'Isi data pelengkap rapor akhir semester untuk siswa kelas Anda.'
        }
      />

      <div className="card-soft flex flex-wrap items-end gap-3 p-4">
        <label className="block">
          <span className="mb-1 block text-[11px] font-medium text-slate-600">Kelas</span>
          <select className={`${selectCls} min-w-32`} value={kelas} onChange={(e) => setKelas(e.target.value)}>
            {kelasBoleh.map((k) => (
              <option key={k} value={k}>
                Kelas {k}
              </option>
            ))}
          </select>
        </label>
        <p className="text-[12px] text-muted">
          {periode ? `Periode ${periodeAk.label}` : 'Pilih periode akademik di header terlebih dahulu.'}
        </p>
      </div>

      {galat && <Notice tone="error">{galat}</Notice>}
      {memuat && <Spinner />}

      {!memuat && siswa && periode && (
        <Tabs items={tabs} aktif={tab} onUbah={(id) => setTab(id as TabId)} ariaLabel="Kelengkapan rapor">
          {tab === 'absensi' && (
            <fieldset disabled={admin} className="min-w-0 space-y-3">
              <div className="card-soft overflow-x-auto">
                <table className="w-full min-w-[760px] text-left text-[12.5px]">
                  <thead>
                    <tr className="border-b border-border bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
                      <th className="px-3 py-2">Nama</th>
                      <th className="px-2 py-2">Sakit</th>
                      <th className="px-2 py-2">Izin</th>
                      <th className="px-2 py-2">Tanpa ket.</th>
                      {semester2 && <th className="px-2 py-2">Keputusan</th>}
                      <th className="px-2 py-2">Catatan wali</th>
                    </tr>
                  </thead>
                  <tbody>
                    {siswa.map((s) => {
                      const a = draft(s.id)
                      const num = (v: number, k: 'sakit' | 'izin' | 'tanpaKeterangan') => (
                        <input
                          type="number"
                          min={0}
                          max={366}
                          inputMode="numeric"
                          aria-label={`${k} ${s.nama}`}
                          className={`${inputCls} w-16`}
                          value={v}
                          onChange={(e) => ubahAbsensi(s.id, { [k]: Number(e.target.value) } as Partial<AbsensiRapor>)}
                        />
                      )
                      return (
                        <tr key={s.id} className="border-b border-border align-top">
                          <td className="px-3 py-2 font-medium text-slate-900">{s.nama}</td>
                          <td className="px-2 py-2">{num(a.sakit, 'sakit')}</td>
                          <td className="px-2 py-2">{num(a.izin, 'izin')}</td>
                          <td className="px-2 py-2">{num(a.tanpaKeterangan, 'tanpaKeterangan')}</td>
                          {semester2 && (
                            <td className="px-2 py-2">
                              <select
                                aria-label={`Keputusan ${s.nama}`}
                                className={selectCls}
                                value={a.keputusan}
                                onChange={(e) => ubahAbsensi(s.id, { keputusan: e.target.value as KeputusanKenaikan })}
                              >
                                {KEPUTUSAN_OPSI.map((k) => (
                                  <option key={k}>{k}</option>
                                ))}
                              </select>
                            </td>
                          )}
                          <td className="px-2 py-2">
                            <textarea
                              aria-label={`Catatan wali ${s.nama}`}
                              rows={2}
                              maxLength={BATAS_CATATAN}
                              className={`${inputCls} min-w-56`}
                              value={a.catatanWali}
                              onChange={(e) => ubahAbsensi(s.id, { catatanWali: e.target.value })}
                            />
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              {!semester2 && (
                <p className="text-[12px] text-muted">Keputusan kenaikan kelas hanya diisi pada semester 2.</p>
              )}
              {!admin && (
                <button type="button" className={btnPrimary} disabled={menyimpan} onClick={simpanAbsensi}>
                  {menyimpan ? 'Menyimpan…' : 'Simpan semua'}
                </button>
              )}
            </fieldset>
          )}

          {tab === 'kokurikuler' && (
            <fieldset disabled={admin} className="min-w-0 space-y-3">
              {!admin && (
                <div className="card-soft space-y-2 p-4">
                  <label className="block text-[12px] font-medium text-slate-600">
                    Deskripsi umum kelas (opsional)
                    <textarea
                      rows={3}
                      maxLength={BATAS_KOKURIKULER}
                      className={`${inputCls} mt-1`}
                      value={umum}
                      onChange={(e) => setUmum(e.target.value)}
                      placeholder="Tulis deskripsi yang sama untuk banyak siswa, lalu terapkan ke yang masih kosong."
                    />
                  </label>
                  <button
                    type="button"
                    className={btnGhost}
                    disabled={!umum.trim()}
                    onClick={() =>
                      setKokur((m) => {
                        const baru = { ...m }
                        for (const s of siswa) if (!(baru[s.id] ?? '').trim()) baru[s.id] = umum.trim()
                        return baru
                      })
                    }
                  >
                    Terapkan ke siswa yang masih kosong
                  </button>
                </div>
              )}
              <ul className="space-y-2">
                {siswa.map((s) => (
                  <li key={s.id} className="card-soft space-y-1 p-3">
                    <label className="block text-[12px] font-semibold text-slate-800">
                      {s.nama}
                      <textarea
                        rows={3}
                        maxLength={BATAS_KOKURIKULER}
                        className={`${inputCls} mt-1 font-normal`}
                        value={kokur[s.id] ?? ''}
                        onChange={(e) => setKokur((m) => ({ ...m, [s.id]: e.target.value }))}
                      />
                    </label>
                  </li>
                ))}
              </ul>
              {!admin && (
                <button type="button" className={btnPrimary} disabled={menyimpan} onClick={simpanKokurikuler}>
                  {menyimpan ? 'Menyimpan…' : 'Simpan semua'}
                </button>
              )}
            </fieldset>
          )}

          {tab === 'ekskul' && (
            <EkskulTab
              admin={admin}
              kelas={kelas}
              periode={periode}
              siswa={siswa}
              ekskul={ekskul}
              master={master}
              onUbah={async () => setEkskul(await getEkskulSiswaKelas(kelas, periode))}
              toast={toast.show}
            />
          )}
        </Tabs>
      )}
      {toast.node}
    </div>
  )
}

function EkskulTab({
  admin,
  kelas,
  periode,
  siswa,
  ekskul,
  master,
  onUbah,
  toast,
}: {
  admin: boolean
  kelas: string
  periode: { tahunAjaran: string; semester: '1' | '2' }
  siswa: SiswaTahsin[]
  ekskul: EkskulSiswa[]
  master: Ekstrakurikuler[]
  onUbah: () => Promise<void>
  toast: (t: string, galat?: boolean) => void
}) {
  const [siswaId, setSiswaId] = useState('')
  const [ekskulId, setEkskulId] = useState('')
  const [level, setLevel] = useState<LevelEkskul>(2)
  const [deskripsi, setDeskripsi] = useState('')
  const [sibuk, setSibuk] = useState(false)

  async function tambah() {
    const m = master.find((x) => x.id === ekskulId)
    if (!siswaId || !m) return toast('Pilih siswa dan kegiatan.', true)
    setSibuk(true)
    try {
      await simpanEkskulSiswa(kelas, periode, { siswaId, ekskulId: m.id, nama: m.nama, level, deskripsi })
      setDeskripsi('')
      await onUbah()
      toast('Ekstrakurikuler tersimpan.')
    } catch (e) {
      console.error(e)
      toast('Gagal menyimpan.', true)
    } finally {
      setSibuk(false)
    }
  }
  async function hapus(id: string) {
    setSibuk(true)
    try {
      await hapusEkskulSiswa(id)
      await onUbah()
    } catch (e) {
      console.error(e)
      toast('Gagal menghapus.', true)
    } finally {
      setSibuk(false)
    }
  }

  const perSiswa = (id: string) => ekskul.filter((e) => e.siswaId === id)

  return (
    <div className="space-y-3">
      {!admin &&
        (master.length === 0 ? (
          <Notice tone="warn">
            Belum ada daftar kegiatan ekstrakurikuler. Minta admin menambahkannya di Admin → Ekstrakurikuler.
          </Notice>
        ) : (
          <div className="card-soft grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
            <label className="block text-[11px] font-medium text-slate-600">
              Siswa
              <select className={`${selectCls} mt-1`} value={siswaId} onChange={(e) => setSiswaId(e.target.value)}>
                <option value="">— Pilih —</option>
                {siswa.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.nama}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-[11px] font-medium text-slate-600">
              Kegiatan
              <select className={`${selectCls} mt-1`} value={ekskulId} onChange={(e) => setEkskulId(e.target.value)}>
                <option value="">— Pilih —</option>
                {master.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.nama}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-[11px] font-medium text-slate-600">
              Predikat
              <select
                className={`${selectCls} mt-1`}
                value={level}
                onChange={(e) => setLevel(Number(e.target.value) as LevelEkskul)}
              >
                {EKS_LEVEL_LABEL.map((l, i) => (
                  <option key={l} value={i + 1}>
                    {l}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-[11px] font-medium text-slate-600 sm:col-span-2 lg:col-span-4">
              Keterangan di rapor
              <textarea
                rows={2}
                maxLength={BATAS_EKSKUL_DESKRIPSI}
                className={`${inputCls} mt-1 font-normal`}
                value={deskripsi}
                onChange={(e) => setDeskripsi(e.target.value)}
              />
            </label>
            <div className="sm:col-span-2 lg:col-span-4">
              <button type="button" className={btnPrimary} disabled={sibuk} onClick={tambah}>
                {sibuk ? 'Menyimpan…' : 'Tambah / perbarui'}
              </button>
              <span className="ml-3 text-[11px] text-muted">Predikat "Tidak Ikut" tidak dicetak di rapor.</span>
            </div>
          </div>
        ))}
      <ul className="space-y-2">
        {siswa.map((s) => (
          <li key={s.id} className="card-soft p-3">
            <p className="text-[13px] font-semibold text-slate-900">{s.nama}</p>
            {perSiswa(s.id).length === 0 ? (
              <p className="text-[12px] text-muted">Belum ada kegiatan.</p>
            ) : (
              <ul className="mt-1 divide-y divide-border">
                {perSiswa(s.id).map((e) => (
                  <li key={e.id} className="flex items-start justify-between gap-3 py-1.5 text-[12.5px]">
                    <span>
                      <span className="font-medium">{e.nama}</span> · {EKS_LEVEL_LABEL[e.level - 1]}
                      {e.deskripsi ? <span className="block text-muted">{e.deskripsi}</span> : null}
                    </span>
                    {!admin && (
                      <button type="button" className="text-[12px] font-medium text-red-700 hover:underline" onClick={() => hapus(e.id)}>
                        Hapus
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}
