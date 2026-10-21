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
import { BackLink, Notice, Spinner, btnGhost, btnPrimary, inputCls, selectCls, useToast } from './shared'

/**
 * Input nilai ekstrakurikuler oleh pengampu ekskul atau wali kelas.
 * - Pilih kegiatan yang diampu (atau semua jika wali/admin).
 * - Pilih siswa (filter kelas).
 * - Pilih aktivitas (dari master) + predikat → deskripsi template, atau tulis manual.
 * Hanya deskripsi yang dicetak di rapor; predikat internal.
 */
export default function InputEkskul({ profile }: { profile: AppUser }) {
  const admin = isAdminRole(profile.role)
  const periodeAk = usePeriodeAkademik()
  const { wali } = kelasSaya(profile)
  const toast = useToast()

  const [master, setMaster] = useState<Ekstrakurikuler[] | null>(null)
  const [pengajuanSaya, setPengajuanSaya] = useState<string[]>([])
  const [ekskulId, setEkskulId] = useState('')
  const [kelas, setKelas] = useState('')
  const [siswa, setSiswa] = useState<SiswaTahsin[] | null>(null)
  const [ekskulSiswa, setEkskulSiswa] = useState<EkskulSiswa[]>([])
  const [memuat, setMemuat] = useState(false)
  const [galat, setGalat] = useState('')

  // Form input
  const [siswaId, setSiswaId] = useState('')
  const [aktivitas, setAktivitas] = useState('')
  const [predikat, setPredikat] = useState<PredikatEkskul | ''>('B')
  const [deskripsi, setDeskripsi] = useState('')
  const [manual, setManual] = useState(false)
  const [sibuk, setSibuk] = useState(false)

  const periode = useMemo(
    () => (periodeAk.ready ? { tahunAjaran: periodeAk.tahunAjaran, semester: periodeAk.semester } : null),
    [periodeAk.ready, periodeAk.tahunAjaran, periodeAk.semester],
  )

  const ampu = useMemo(() => (master ? ekskulSayaAmpu(master, profile.uid) : []), [master, profile.uid])
  const bisaSemua = admin || wali.length > 0
  const daftarPilih = useMemo(() => {
    if (!master) return []
    if (admin) return master.filter((m) => m.aktif)
    const ids = new Set(ampu.map((a) => a.id))
    // Wali juga boleh input ekskul untuk kelasnya (kompatibel KelengkapanRapor)
    return master.filter((m) => m.aktif && (ids.has(m.id) || wali.length > 0))
  }, [master, admin, ampu, wali])

  const ekskulAktif = daftarPilih.find((e) => e.id === ekskulId) ?? null

  const kelasBoleh = useMemo(() => {
    if (admin) return [...SEMUA_KELAS]
    if (ampu.some((a) => a.id === ekskulId) || ampu.length > 0) {
      // Pengampu boleh input semua kelas (siswa di seluruh sekolah yang ikut ekskul)
      return [...SEMUA_KELAS]
    }
    return wali
  }, [admin, ampu, ekskulId, wali])

  useEffect(() => {
    if (!kelas && kelasBoleh[0]) setKelas(kelasBoleh[0])
  }, [kelas, kelasBoleh])

  const muatMaster = useCallback(async () => {
    try {
      const [m, aj] = await Promise.all([
        getEkskulMasterLengkap(),
        getPengajuanSaya(profile.uid).catch(() => []),
      ])
      setMaster(m)
      setPengajuanSaya(aj.filter((a) => a.status === 'pending').map((a) => a.ekskulId))
    } catch {
      setGalat('Gagal memuat master ekstrakurikuler.')
    }
  }, [profile.uid])
  useEffect(() => {
    void muatMaster()
  }, [muatMaster])

  const muatKelas = useCallback(async () => {
    if (!kelas || !periode) return
    setMemuat(true)
    setGalat('')
    try {
      const [s, e] = await Promise.all([
        getSiswaList(kelas, { role: profile.role, kelasAmpu: [] }),
        getEkskulSiswaKelas(kelas, periode),
      ])
      setSiswa(s)
      setEkskulSiswa(e)
    } catch (err) {
      console.error(err)
      setGalat('Gagal memuat siswa/nilai. Periksa hak akses dan rules.')
    } finally {
      setMemuat(false)
    }
  }, [kelas, periode, profile.role])
  useEffect(() => {
    void muatKelas()
  }, [muatKelas])

  // Saat predikat berubah dan ada template, isi deskripsi otomatis (jika tidak mode manual)
  useEffect(() => {
    if (manual || !ekskulAktif || !predikat) return
    const t = (ekskulAktif.deskripsiCapaian ?? []).find((x) => x.predikat === predikat)
    if (t) setDeskripsi(t.teks)
  }, [predikat, ekskulAktif, manual])

  async function simpan() {
    if (!periode || !ekskulAktif || !siswaId) {
      toast.show('Pilih kegiatan, kelas, dan siswa.', true)
      return
    }
    const level: LevelEkskul = predikat ? predikatKeLevel(predikat) : 2
    setSibuk(true)
    try {
      await simpanEkskulSiswa(kelas, periode, {
        siswaId,
        ekskulId: ekskulAktif.id,
        nama: ekskulAktif.nama,
        level,
        deskripsi,
        // @ts-expect-error field opsional ditambahkan di patch raporData
        aktivitas: aktivitas || undefined,
        diisiOleh: profile.uid,
      })
      toast.show('Nilai ekstrakurikuler tersimpan.')
      setDeskripsi('')
      setAktivitas('')
      await muatKelas()
    } catch (e) {
      console.error(e)
      toast.show('Gagal menyimpan. Pastikan Anda pengampu atau wali kelas.', true)
    } finally {
      setSibuk(false)
    }
  }

  async function hapus(id: string) {
    setSibuk(true)
    try {
      await hapusEkskulSiswa(id)
      await muatKelas()
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
      toast.show(err instanceof Error ? err.message : 'Gagal mengajukan.', true)
    } finally {
      setSibuk(false)
    }
  }

  const perSiswaFilter = useMemo(() => {
    if (!ekskulId) return ekskulSiswa
    return ekskulSiswa.filter((e) => e.ekskulId === ekskulId)
  }, [ekskulSiswa, ekskulId])

  if (!admin && ampu.length === 0 && wali.length === 0) {
    return (
      <div className="space-y-4">
        <BackLink to="/akademik">Akademik & Rapor</BackLink>
        <PageHeader
          title="Ekstrakurikuler"
          subtitle="Ajukan diri sebagai pengampu kegiatan, atau minta admin menambahkan Anda."
        />
        {master === null && <Spinner />}
        {master && (
          <ul className="space-y-2">
            {master
              .filter((m) => m.aktif)
              .map((m) => (
                <li key={m.id} className="card-soft flex items-center justify-between gap-3 px-4 py-2.5">
                  <span className="text-[13.5px] font-medium">{m.nama}</span>
                  {pengajuanSaya.includes(m.id) ? (
                    <span className="text-[12px] text-amber-700">Menunggu persetujuan</span>
                  ) : (
                    <button type="button" className={btnGhost} disabled={sibuk} onClick={() => void ajukan(m)}>
                      Ajukan sebagai pengampu
                    </button>
                  )}
                </li>
              ))}
          </ul>
        )}
        {toast.node}
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <PageHeader
        back={{ to: '/akademik', label: admin ? 'Pantauan Akademik' : 'Akademik & Rapor' }}
        title="Input Ekstrakurikuler"
        subtitle={
          admin
            ? 'Mode pantauan. Pengampu dan wali kelas mengisi nilai; administrator dapat melihat.'
            : 'Isi predikat dan deskripsi capaian. Hanya deskripsi yang dicetak di rapor.'
        }
      />

      <div className="card-soft flex flex-wrap items-end gap-3 p-4">
        <label className="block text-[11px] font-medium text-slate-600">
          Kegiatan
          <select
            className={`${selectCls} mt-1 min-w-48`}
            value={ekskulId}
            onChange={(e) => {
              setEkskulId(e.target.value)
              setManual(false)
            }}
          >
            <option value="">— Semua / pilih —</option>
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
        <p className="text-[12px] text-muted">
          {periode ? `Periode ${periodeAk.label}` : 'Pilih periode di header terlebih dahulu.'}
        </p>
      </div>

      {galat && <Notice tone="error">{galat}</Notice>}
      {memuat && <Spinner />}

      {/* Form input */}
      {!admin && ekskulAktif && periode && siswa && (
        <div className="card-soft grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3">
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
            Aktivitas
            <select
              className={`${selectCls} mt-1`}
              value={aktivitas}
              onChange={(e) => setAktivitas(e.target.value)}
            >
              <option value="">— Opsional —</option>
              {(ekskulAktif.aktivitas ?? []).map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </label>
          {(ekskulAktif.aktivitas ?? []).length === 0 && (
            <label className="block text-[11px] font-medium text-slate-600">
              Aktivitas (tulis manual)
              <input
                className={`${inputCls} mt-1`}
                maxLength={120}
                value={aktivitas}
                onChange={(e) => setAktivitas(e.target.value)}
                placeholder="Mis. Latihan rutin Sabtu"
              />
            </label>
          )}

          <label className="block text-[11px] font-medium text-slate-600">
            Predikat (internal)
            <select
              className={`${selectCls} mt-1`}
              value={predikat}
              onChange={(e) => setPredikat(e.target.value as PredikatEkskul | '')}
              disabled={manual}
            >
              {PREDIKAT_EKSKUL.map((p) => (
                <option key={p} value={p}>
                  {p} — {p === 'A' ? 'Mahir' : p === 'B' ? 'Cakap' : 'Layak'}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-[11px] font-medium text-slate-600 sm:col-span-2 lg:col-span-3">
            <span className="flex items-center justify-between gap-2">
              Deskripsi capaian (dicetak di rapor)
              <button
                type="button"
                className="text-[11px] font-medium text-muh-700 hover:underline"
                onClick={() => setManual((v) => !v)}
              >
                {manual ? 'Pakai template predikat' : 'Tulis manual (unik per siswa)'}
              </button>
            </span>
            {!manual && (ekskulAktif.deskripsiCapaian ?? []).length > 0 && (
              <select
                className={`${selectCls} mt-1 mb-1`}
                value={deskripsi}
                onChange={(e) => setDeskripsi(e.target.value)}
              >
                <option value="">— Pilih dari template —</option>
                {(ekskulAktif.deskripsiCapaian ?? []).map((t) => (
                  <option key={t.predikat} value={t.teks}>
                    [{t.predikat}] {t.teks.slice(0, 80)}
                    {t.teks.length > 80 ? '…' : ''}
                  </option>
                ))}
              </select>
            )}
            <textarea
              rows={3}
              maxLength={BATAS_EKSKUL_DESKRIPSI}
              className={`${inputCls} mt-1 font-normal`}
              value={deskripsi}
              onChange={(e) => {
                setDeskripsi(e.target.value)
                if (!manual) setManual(true)
              }}
              placeholder="Deskripsi capaian yang akan muncul di rapor…"
            />
          </label>

          <div className="sm:col-span-2 lg:col-span-3">
            <button type="button" className={btnPrimary} disabled={sibuk || !siswaId} onClick={() => void simpan()}>
              {sibuk ? 'Menyimpan…' : 'Simpan'}
            </button>
            <span className="ml-3 text-[11px] text-muted">
              Predikat tidak dicetak. Level &quot;Tidak Ikut&quot; dapat diatur lewat Kelengkapan Rapor.
            </span>
          </div>
        </div>
      )}

      {/* Daftar nilai terisi */}
      {!memuat && siswa && periode && (
        <ul className="space-y-2">
          {siswa.map((s) => {
            const list = perSiswaFilter.filter((e) => e.siswaId === s.id)
            if (list.length === 0 && ekskulId) return null
            return (
              <li key={s.id} className="card-soft p-3">
                <p className="text-[13px] font-semibold text-slate-900">{s.nama}</p>
                {list.length === 0 ? (
                  <p className="text-[12px] text-muted">Belum ada kegiatan.</p>
                ) : (
                  <ul className="mt-1 divide-y divide-border">
                    {list.map((e) => (
                      <li key={e.id} className="flex items-start justify-between gap-3 py-1.5 text-[12.5px]">
                        <span>
                          <span className="font-medium">{e.nama}</span>
                          {' · '}
                          {EKS_LEVEL_LABEL[e.level - 1] ?? e.level}
                          {e.aktivitas ? <span className="text-muted"> · {e.aktivitas}</span> : null}
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
                )}
              </li>
            )
          })}
        </ul>
      )}

      {/* Ajukan pengampu tambahan */}
      {!admin && master && (
        <details className="card-soft p-3">
          <summary className="cursor-pointer text-[13px] font-medium text-slate-700">
            Ajukan diri sebagai pengampu kegiatan lain
          </summary>
          <ul className="mt-2 space-y-1">
            {master
              .filter((m) => m.aktif && !(m.pengampuUids ?? []).includes(profile.uid))
              .map((m) => (
                <li key={m.id} className="flex items-center justify-between text-[12.5px]">
                  <span>{m.nama}</span>
                  {pengajuanSaya.includes(m.id) ? (
                    <span className="text-amber-700">Menunggu</span>
                  ) : (
                    <button type="button" className="text-muh-700 hover:underline" disabled={sibuk} onClick={() => void ajukan(m)}>
                      Ajukan
                    </button>
                  )}
                </li>
              ))}
          </ul>
        </details>
      )}

      {toast.node}
    </div>
  )
}
