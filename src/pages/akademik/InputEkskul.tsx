import { useCallback, useEffect, useMemo, useState } from 'react'
import { PageHeader } from '../../components/ui'
import { kelasSaya } from '../../lib/kelasSaya'
import { getSiswaList } from '../../lib/tahsinData'
import { usePeriodeAkademik } from '../../lib/usePeriodeAkademik'
import {
  getEkskulSiswaKelas,
  hapusEkskulSiswa,
  simpanEkskulSiswa,
} from '../../lib/raporData'
import {
  ajukanPengampu,
  ekskulSayaAmpu,
  getEkskulMasterLengkap,
  getPengajuanSaya,
} from '../../lib/ekskul'
import { isAdminRole } from '../../lib/roles'
import { SEMUA_KELAS, type SiswaTahsin } from '../../types/tahsin'
import type { AppUser } from '../../types/user'
import type { EkskulSiswa, Ekstrakurikuler, LevelEkskul, PredikatEkskul } from '../../types/raporData'
import {
  BATAS_EKSKUL_DESKRIPSI,
  EKS_LEVEL_LABEL,
  PREDIKAT_EKSKUL,
  predikatKeLevel,
} from '../../types/raporData'
import { Notice, Spinner, btnPrimary, inputCls, selectCls, useToast } from './shared'

/**
 * Input nilai ekstrakurikuler oleh pengampu atau wali kelas.
 * - Predikat → deskripsi terisi otomatis dari template admin.
 * - Mode manual untuk capaian unik per siswa.
 * - Aktivitas hanya konteks di master (bukan pilihan di form ini).
 */
export default function InputEkskul({ profile }: { profile: AppUser }) {
  const admin = isAdminRole(profile.role)
  const periodeAk = usePeriodeAkademik()
  const { wali } = kelasSaya(profile)
  const toast = useToast()

  const [master, setMaster] = useState<Ekstrakurikuler[] | null>(null)
  const [pengajuanSaya, setPengajuanSaya] = useState<string[]>([])
  const [pengajuanStatus, setPengajuanStatus] = useState<Record<string, string>>({})
  const [ekskulId, setEkskulId] = useState('')
  const [kelas, setKelas] = useState('')
  const [siswa, setSiswa] = useState<SiswaTahsin[] | null>(null)
  const [ekskulSiswa, setEkskulSiswa] = useState<EkskulSiswa[]>([])
  const [memuat, setMemuat] = useState(false)
  const [galat, setGalat] = useState('')
  const [galatNilai, setGalatNilai] = useState('')

  const [siswaId, setSiswaId] = useState('')
  const [predikat, setPredikat] = useState<PredikatEkskul>('B')
  const [deskripsi, setDeskripsi] = useState('')
  const [manual, setManual] = useState(false)
  const [sibuk, setSibuk] = useState(false)

  const periode = useMemo(
    () => (periodeAk.ready ? { tahunAjaran: periodeAk.tahunAjaran, semester: periodeAk.semester } : null),
    [periodeAk.ready, periodeAk.tahunAjaran, periodeAk.semester],
  )

  const ampu = useMemo(() => (master ? ekskulSayaAmpu(master, profile.uid) : []), [master, profile.uid])
  const isPengampu = ampu.length > 0
  const isWali = wali.length > 0

  const daftarPilih = useMemo(() => {
    if (!master) return []
    if (admin || isWali) return master.filter((m) => m.aktif)
    return ampu.filter((m) => m.aktif)
  }, [master, admin, isWali, ampu])

  const ekskulAktif = daftarPilih.find((e) => e.id === ekskulId) ?? null

  const kelasBoleh = useMemo(() => {
    if (admin || isPengampu) return [...SEMUA_KELAS]
    return wali
  }, [admin, isPengampu, wali])

  useEffect(() => {
    if (kelasBoleh.length && !kelasBoleh.includes(kelas)) {
      setKelas(kelasBoleh[0] || '')
    } else if (!kelas && kelasBoleh[0]) {
      setKelas(kelasBoleh[0])
    }
  }, [kelas, kelasBoleh])

  useEffect(() => {
    if (!ekskulId && daftarPilih.length === 1) setEkskulId(daftarPilih[0].id)
  }, [ekskulId, daftarPilih])

  const muatMaster = useCallback(async () => {
    try {
      const [m, aj] = await Promise.all([
        getEkskulMasterLengkap(),
        getPengajuanSaya(profile.uid).catch(() => []),
      ])
      setMaster(m)
      setPengajuanSaya(aj.filter((a) => a.status === 'pending').map((a) => a.ekskulId))
      const status: Record<string, string> = {}
      for (const a of aj) status[a.ekskulId] = a.status
      setPengajuanStatus(status)
    } catch (e) {
      console.error(e)
      setGalat('Gagal memuat daftar ekstrakurikuler. Periksa koneksi dan rules.')
    }
  }, [profile.uid])
  useEffect(() => {
    void muatMaster()
  }, [muatMaster])

  const muatSiswa = useCallback(async () => {
    if (!kelas) return
    try {
      const s = await getSiswaList(kelas, { role: profile.role, kelasAmpu: [...SEMUA_KELAS] })
      setSiswa(s)
    } catch (err) {
      console.error(err)
      setSiswa([])
      setGalat('Gagal memuat daftar siswa. Pastikan akun guru aktif.')
    }
  }, [kelas, profile.role])

  const muatNilai = useCallback(async () => {
    if (!kelas || !periode) return
    if (!ekskulId && !admin && !isWali) {
      setEkskulSiswa([])
      setGalatNilai('')
      return
    }
    setMemuat(true)
    setGalatNilai('')
    try {
      const mustFilter = isPengampu && !admin && !isWali
      if (mustFilter && !ekskulId) {
        setEkskulSiswa([])
        return
      }
      const e = await getEkskulSiswaKelas(kelas, periode, ekskulId || undefined)
      setEkskulSiswa(e)
    } catch (err) {
      console.error(err)
      setEkskulSiswa([])
      setGalatNilai(
        'Gagal memuat nilai ekstrakurikuler. Pastikan Anda pengampu kegiatan ini atau wali kelas, dan rules sudah di-deploy.',
      )
    } finally {
      setMemuat(false)
    }
  }, [kelas, periode, ekskulId, admin, isWali, isPengampu])

  useEffect(() => {
    void muatSiswa()
  }, [muatSiswa])
  useEffect(() => {
    void muatNilai()
  }, [muatNilai])

  /** Predikat → deskripsi otomatis (kecuali mode manual). */
  useEffect(() => {
    if (manual || !ekskulAktif) return
    const t = (ekskulAktif.deskripsiCapaian ?? []).find((x) => x.predikat === predikat)
    setDeskripsi(t?.teks ?? '')
  }, [predikat, ekskulAktif, manual])

  useEffect(() => {
    setManual(false)
  }, [ekskulId])

  async function simpan() {
    if (!periode || !ekskulAktif || !siswaId) {
      toast.show('Pilih kegiatan, kelas, dan siswa.', true)
      return
    }
    if (!deskripsi.trim()) {
      toast.show('Deskripsi capaian masih kosong. Pilih predikat atau tulis manual.', true)
      return
    }
    const level: LevelEkskul = predikatKeLevel(predikat)
    setSibuk(true)
    try {
      await simpanEkskulSiswa(kelas, periode, {
        siswaId,
        ekskulId: ekskulAktif.id,
        nama: ekskulAktif.nama,
        level,
        deskripsi: deskripsi.trim(),
        diisiOleh: profile.uid,
      })
      toast.show('Nilai ekstrakurikuler tersimpan.')
      await muatNilai()
    } catch (e) {
      console.error(e)
      toast.show('Gagal menyimpan. Pastikan Anda pengampu kegiatan ini atau wali kelas.', true)
    } finally {
      setSibuk(false)
    }
  }

  async function hapus(id: string) {
    setSibuk(true)
    try {
      await hapusEkskulSiswa(id)
      await muatNilai()
    } catch {
      toast.show('Gagal menghapus.', true)
    } finally {
      setSibuk(false)
    }
  }

  async function ajukan(e: Ekstrakurikuler) {
    setSibuk(true)
    try {
      await ajukanPengampu({
        ekskulId: e.id,
        ekskulNama: e.nama,
        uid: profile.uid,
        namaGuru: profile.nama || profile.email || profile.uid,
      })
      toast.show('Pengajuan terkirim. Menunggu persetujuan admin.')
      await muatMaster()
    } catch (err) {
      console.error(err)
      toast.show(err instanceof Error ? err.message : 'Gagal mengajukan. Periksa rules (deploy rules terbaru).', true)
    } finally {
      setSibuk(false)
    }
  }

  const bisaInput = admin || isPengampu || isWali
  const perSiswaFilter = useMemo(() => {
    if (!ekskulId) return ekskulSiswa
    return ekskulSiswa.filter((e) => e.ekskulId === ekskulId)
  }, [ekskulSiswa, ekskulId])

  const bisaDiajukan = useMemo(() => {
    if (!master) return []
    return master.filter((m) => m.aktif && !(m.pengampuUids ?? []).includes(profile.uid))
  }, [master, profile.uid])

  return (
    <div className="space-y-5">
      <PageHeader
        back={{ to: '/akademik', label: admin ? 'Pantauan Akademik' : 'Akademik & Rapor' }}
        title="Ekstrakurikuler"
        subtitle={
          admin
            ? 'Mode pantauan. Pengampu dan wali kelas mengisi nilai.'
            : isPengampu || isWali
              ? 'Pilih predikat — deskripsi capaian terisi otomatis. Hanya deskripsi yang dicetak di rapor.'
              : 'Ajukan diri sebagai pengampu. Setelah disetujui admin, Anda dapat menginput nilai.'
        }
      />

      {galat && <Notice tone="error">{galat}</Notice>}
      {master === null && <Spinner />}

      {!admin && master && bisaDiajukan.length > 0 && (
        <section className="card-soft space-y-3 p-4">
          <div>
            <h3 className="text-[14px] font-semibold text-slate-900">Ajukan sebagai pengampu</h3>
            <p className="mt-0.5 text-[12px] text-muted">
              Pilih kegiatan yang Anda ampu. Admin menyetujui sebelum Anda dapat menginput nilai.
            </p>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {bisaDiajukan.map((m) => {
              const st = pengajuanStatus[m.id]
              const pending = st === 'pending' || pengajuanSaya.includes(m.id)
              const ditolak = st === 'ditolak'
              return (
                <div
                  key={m.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-border bg-white px-3.5 py-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-[13.5px] font-medium text-slate-900">{m.nama}</p>
                    {pending && <p className="text-[11px] font-medium text-amber-700">Menunggu persetujuan</p>}
                    {ditolak && !pending && <p className="text-[11px] text-red-600">Ditolak — ajukan ulang</p>}
                  </div>
                  {pending ? (
                    <span className="shrink-0 rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-800">
                      Pending
                    </span>
                  ) : (
                    <button
                      type="button"
                      className={`${btnPrimary} shrink-0 !px-3 !py-1.5 text-[12px]`}
                      disabled={sibuk}
                      onClick={() => void ajukan(m)}
                    >
                      Ajukan
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        </section>
      )}

      {!bisaInput && master && (
        <Notice>
          Anda belum terdaftar sebagai pengampu atau wali kelas. Ajukan kegiatan di atas, atau minta admin
          menambahkan Anda di Administrasi → Ekstrakurikuler.
        </Notice>
      )}

      {bisaInput && (
        <>
          <div className="card-soft flex flex-wrap items-end gap-3 p-4">
            <label className="block text-[11px] font-medium text-slate-600">
              Kegiatan
              <select
                className={`${selectCls} mt-1 min-w-48`}
                value={ekskulId}
                onChange={(e) => {
                  setEkskulId(e.target.value)
                  setSiswaId('')
                }}
              >
                <option value="">— Pilih kegiatan —</option>
                {daftarPilih.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.nama}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-[11px] font-medium text-slate-600">
              Kelas
              <select className={`${selectCls} mt-1 min-w-28`} value={kelas} onChange={(e) => setKelas(e.target.value)}>
                {kelasBoleh.map((k) => (
                  <option key={k} value={k}>
                    Kelas {k}
                  </option>
                ))}
              </select>
            </label>
            <p className="pb-1 text-[12px] text-muted">
              {periode ? `Periode ${periodeAk.label}` : 'Pilih periode di header terlebih dahulu.'}
            </p>
          </div>

          {!ekskulId && <Notice tone="warn">Pilih kegiatan terlebih dahulu untuk memuat dan mengisi nilai.</Notice>}
          {galatNilai && <Notice tone="error">{galatNilai}</Notice>}
          {memuat && <Spinner />}

          {ekskulAktif && (ekskulAktif.aktivitas ?? []).length > 0 && (
            <p className="text-[12px] text-muted">
              <span className="font-medium text-slate-600">Konteks aktivitas:</span>{' '}
              {(ekskulAktif.aktivitas ?? []).join(' · ')}
            </p>
          )}

          {!admin && ekskulAktif && periode && siswa && (
            <div className="card-soft grid gap-3 p-4 sm:grid-cols-2">
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
                Predikat
                <select
                  className={`${selectCls} mt-1`}
                  value={predikat}
                  onChange={(e) => {
                    setPredikat(e.target.value as PredikatEkskul)
                    if (manual) setManual(false)
                  }}
                  disabled={manual}
                >
                  {PREDIKAT_EKSKUL.map((p) => (
                    <option key={p} value={p}>
                      {p} — {p === 'A' ? 'Mahir' : p === 'B' ? 'Cakap' : 'Layak'}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block text-[11px] font-medium text-slate-600 sm:col-span-2">
                <span className="flex flex-wrap items-center justify-between gap-2">
                  Deskripsi capaian (dicetak di rapor)
                  <button
                    type="button"
                    className="text-[11px] font-medium text-muh-700 hover:underline"
                    onClick={() => setManual((v) => !v)}
                  >
                    {manual ? 'Kembali ke template predikat' : 'Tulis manual (unik per siswa)'}
                  </button>
                </span>
                <textarea
                  rows={3}
                  maxLength={BATAS_EKSKUL_DESKRIPSI}
                  className={`${inputCls} mt-1 font-normal`}
                  value={deskripsi}
                  readOnly={!manual}
                  onChange={(e) => setDeskripsi(e.target.value)}
                  placeholder={
                    manual
                      ? 'Tulis deskripsi capaian unik untuk siswa ini…'
                      : (ekskulAktif.deskripsiCapaian ?? []).length === 0
                        ? 'Belum ada template. Minta admin mengisi Deskripsi C/B/A di Administrasi → Ekstrakurikuler.'
                        : 'Otomatis dari predikat'
                  }
                />
                {!manual && (ekskulAktif.deskripsiCapaian ?? []).length === 0 && (
                  <span className="mt-1 block text-[11px] text-amber-700">
                    Template deskripsi belum diisi admin untuk kegiatan ini.
                  </span>
                )}
              </label>

              <div className="sm:col-span-2">
                <button
                  type="button"
                  className={btnPrimary}
                  disabled={sibuk || !siswaId || !deskripsi.trim()}
                  onClick={() => void simpan()}
                >
                  {sibuk ? 'Menyimpan…' : 'Simpan'}
                </button>
                <span className="ml-3 text-[11px] text-muted">Hanya deskripsi yang dicetak di rapor.</span>
              </div>
            </div>
          )}

          {!memuat && siswa && periode && ekskulId && (
            <ul className="space-y-2">
              {siswa.map((s) => {
                const list = perSiswaFilter.filter((e) => e.siswaId === s.id)
                if (list.length === 0) return null
                return (
                  <li key={s.id} className="card-soft p-3">
                    <p className="text-[13px] font-semibold text-slate-900">{s.nama}</p>
                    <ul className="mt-1 divide-y divide-border">
                      {list.map((e) => (
                        <li key={e.id} className="flex items-start justify-between gap-3 py-1.5 text-[12.5px]">
                          <span>
                            <span className="font-medium">{e.nama}</span>
                            {' · '}
                            {EKS_LEVEL_LABEL[e.level - 1] ?? e.level}
                            {e.deskripsi ? <span className="block text-muted">{e.deskripsi}</span> : null}
                          </span>
                          {!admin && (
                            <button
                              type="button"
                              className="text-[12px] font-medium text-red-700 hover:underline"
                              onClick={() => void hapus(e.id)}
                            >
                              Hapus
                            </button>
                          )}
                        </li>
                      ))}
                    </ul>
                  </li>
                )
              })}
              {siswa.every((s) => perSiswaFilter.filter((e) => e.siswaId === s.id).length === 0) && (
                <li className="text-[12.5px] text-muted">Belum ada nilai untuk kegiatan ini di kelas {kelas}.</li>
              )}
            </ul>
          )}
        </>
      )}

      {toast.node}
    </div>
  )
}
