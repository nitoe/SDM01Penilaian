import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { PageHeader } from '../../components/ui'
import { kelasSaya } from '../../lib/kelasSaya'
import { getSiswaList } from '../../lib/tahsinData'
import { usePeriodeAkademik } from '../../lib/usePeriodeAkademik'
import { isAdminRole } from '../../lib/roles'
import {
  getDplByKelas,
  getNilaiProyekByProyek,
  getProyekStemById,
  simpanNilaiDpl,
  simpanNilaiProyek,
} from '../../lib/kokurikuler'
import type { AppUser } from '../../types/user'
import type { SiswaTahsin } from '../../types/tahsin'
import type { Dpl, ProyekStem, RubrikAspekStem } from '../../types/kokurikuler'
import {
  DPL_LEVEL_LABEL,
  STEM_NILAI_RANGE,
  levelDplDariNilaiStem,
  predikatDariNilaiStem,
  rataNilaiProyek,
} from '../../types/kokurikuler'
import {
  Notice,
  Spinner,
  btnGhost,
  btnPrimary,
  inputSempitCls,
  useToast,
} from './shared'

/**
 * Halaman detail proyek STEM: input nilai instrumen (rubrik 0–100) per siswa.
 * Rata-rata skor → level DPL otomatis untuk DPL yang terikat proyek.
 */
export default function ProyekStemDetail({ profile }: { profile: AppUser }) {
  const { proyekId = '' } = useParams<{ proyekId: string }>()
  const admin = isAdminRole(profile.role)
  const periodeAk = usePeriodeAkademik()
  const { wali } = kelasSaya(profile)
  const toast = useToast()

  const [proyek, setProyek] = useState<ProyekStem | null | undefined>(undefined)
  const [dplList, setDplList] = useState<Dpl[]>([])
  const [siswa, setSiswa] = useState<SiswaTahsin[] | null>(null)
  /** siswaId → aspekId → skor */
  const [skor, setSkor] = useState<Record<string, Record<string, number | null>>>({})
  const [ubah, setUbah] = useState<Set<string>>(new Set())
  const [galat, setGalat] = useState('')
  const [sibuk, setSibuk] = useState(false)

  const periode = useMemo(
    () =>
      periodeAk.ready
        ? { tahunAjaran: periodeAk.tahunAjaran, semester: periodeAk.semester }
        : null,
    [periodeAk.ready, periodeAk.tahunAjaran, periodeAk.semester],
  )

  const rubrik: RubrikAspekStem[] = useMemo(() => {
    if (!proyek) return []
    if (proyek.rubrik && proyek.rubrik.length) return proyek.rubrik
    return (proyek.daftarNilai || []).map((nama, i) => ({
      id: `legacy_${i + 1}`,
      nama,
      deskripsiRentang: ['', '', '', ''] as [string, string, string, string],
    }))
  }, [proyek])

  const dplProyek = useMemo(
    () => (proyek?.dplId || []).map((id) => dplList.find((d) => d.id === id)).filter(Boolean) as Dpl[],
    [proyek?.dplId, dplList],
  )

  const bisaTulis = Boolean(proyek && !admin && wali.includes(proyek.kelas))
  const bisaBaca = Boolean(proyek && (admin || wali.includes(proyek.kelas)))

  const muat = useCallback(async () => {
    if (!proyekId) return
    setGalat('')
    try {
      const p = await getProyekStemById(proyekId)
      setProyek(p)
      if (!p) return
      const [dpl, s, np] = await Promise.all([
        getDplByKelas(p.kelas),
        getSiswaList(p.kelas, { role: profile.role, kelasAmpu: [p.kelas] }),
        getNilaiProyekByProyek(p.id),
      ])
      setDplList(dpl)
      setSiswa(s)
      const map: Record<string, Record<string, number | null>> = {}
      for (const sw of s) map[sw.id] = {}
      for (const row of np) {
        map[row.siswaId] = { ...(map[row.siswaId] || {}), ...row.nilai }
      }
      setSkor(map)
      setUbah(new Set())
    } catch (e) {
      console.error(e)
      setGalat('Gagal memuat proyek. Pastikan rules proyek_stem / nilai_proyek_stem sudah di-deploy.')
      setProyek(null)
    }
  }, [proyekId, profile.role])

  useEffect(() => {
    void muat()
  }, [muat])

  function setNilaiAspek(siswaId: string, aspekId: string, raw: string) {
    let v: number | null = null
    if (raw.trim() !== '') {
      const n = Math.round(Number(raw))
      if (Number.isFinite(n)) v = Math.max(0, Math.min(100, n))
    }
    setSkor((prev) => ({
      ...prev,
      [siswaId]: { ...(prev[siswaId] || {}), [aspekId]: v },
    }))
    setUbah((prev) => new Set(prev).add(siswaId))
  }

  async function simpanSemua() {
    if (!proyek || !periode || ubah.size === 0) return
    setSibuk(true)
    try {
      const ids = [...ubah]
      for (const siswaId of ids) {
        const nilai = skor[siswaId] || {}
        // Pastikan semua aspek ada di objek (null jika kosong)
        const lengkap: Record<string, number | null> = {}
        for (const r of rubrik) lengkap[r.id] = nilai[r.id] ?? null

        await simpanNilaiProyek({
          proyekStemId: proyek.id,
          siswaId,
          kelas: proyek.kelas,
          semester: periode.semester,
          tahunAjaran: periode.tahunAjaran,
          nilai: lengkap,
        })

        // DPL otomatis dari rata-rata skor instrumen
        const rata = rataNilaiProyek(lengkap)
        const level = levelDplDariNilaiStem(rata)
        if (level != null) {
          for (const d of dplProyek) {
            const deskripsi = d.levelDeskripsi[level - 1] || ''
            await simpanNilaiDpl({
              siswaId,
              dplId: d.id,
              kelas: proyek.kelas,
              semester: periode.semester,
              tahunAjaran: periode.tahunAjaran,
              proyekStemId: proyek.id,
              level,
              deskripsi,
            })
          }
        }
      }
      toast.show(
        `Nilai proyek tersimpan (${ids.length} siswa). Level DPL diisi otomatis dari rata-rata skor.`,
      )
      setUbah(new Set())
      await muat()
    } catch (e) {
      console.error(e)
      toast.show('Gagal menyimpan nilai proyek.', true)
    } finally {
      setSibuk(false)
    }
  }

  if (proyek === undefined) {
    return (
      <div className="space-y-5">
        <PageHeader
          back={{ to: '/akademik/kokurikuler', label: 'Kokurikuler' }}
          title="Proyek STEM"
          subtitle="Memuat…"
        />
        <Spinner />
      </div>
    )
  }

  if (proyek === null) {
    return (
      <div className="space-y-5">
        <PageHeader
          back={{ to: '/akademik/kokurikuler', label: 'Kokurikuler' }}
          title="Proyek tidak ditemukan"
        />
        <Notice tone="error">Proyek STEM tidak ada atau sudah dihapus.</Notice>
        <Link to="/akademik/kokurikuler" className="text-[13px] font-medium text-muh-700 hover:underline">
          ← Kembali ke daftar proyek
        </Link>
      </div>
    )
  }

  if (!bisaBaca) {
    return (
      <div className="space-y-5">
        <PageHeader
          back={{ to: '/akademik/kokurikuler', label: 'Kokurikuler' }}
          title={proyek.judul}
        />
        <Notice tone="error">Anda tidak berhak melihat proyek kelas {proyek.kelas}.</Notice>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <PageHeader
        back={{ to: '/akademik/kokurikuler', label: 'Kokurikuler' }}
        title={proyek.judul}
        subtitle={
          admin
            ? `Mode pantauan · Kelas ${proyek.kelas} · ${periodeAk.label}`
            : `Input nilai instrumen proyek · Kelas ${proyek.kelas} · ${periodeAk.label}`
        }
      />

      {galat && <Notice tone="error">{galat}</Notice>}

      {/* Ringkasan proyek */}
      <section className="card-soft space-y-2 p-4">
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-muted">
          <span>{proyek.jumlahPertemuan || '—'} pertemuan</span>
          {proyek.tanggalMulai && (
            <span>
              {proyek.tanggalMulai}
              {proyek.tanggalSelesai ? ` – ${proyek.tanggalSelesai}` : ''}
            </span>
          )}
          <span>{rubrik.length} aspek instrumen</span>
          <span>{dplProyek.length} DPL terkait</span>
        </div>
        {proyek.deskripsi && (
          <p className="text-[13px] leading-relaxed text-slate-700">{proyek.deskripsi}</p>
        )}
        <div className="flex flex-wrap gap-1.5 pt-1">
          {proyek.mapelTerlibat.map((m, i) => (
            <span
              key={`${m.mapel}-${m.tpId}-${i}`}
              className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-medium text-slate-700"
            >
              {m.mapel}
              {m.jenisNilai ? ` · ${m.jenisNilai}` : ''}
            </span>
          ))}
        </div>
        {dplProyek.length > 0 && (
          <p className="text-[11.5px] text-muted">
            DPL diamati (otomatis dari rata-rata skor):{' '}
            <span className="font-medium text-slate-700">{dplProyek.map((d) => d.nama).join(' · ')}</span>
          </p>
        )}
        <p className="text-[11px] text-slate-500">
          Skala instrumen:{' '}
          {STEM_NILAI_RANGE.map((r) => `${r.min}–${r.maks} ${r.label}`).join(' · ')}. Rata-rata
          mengisi level DPL:{' '}
          {DPL_LEVEL_LABEL.map((lab, i) => `${i + 1}=${lab}`).join(' · ')}.
        </p>
      </section>

      {!rubrik.length && (
        <Notice tone="warn">
          Proyek ini belum punya aspek rubrik penilaian. Edit proyek di daftar Kokurikuler → tab
          Instrumen, lalu kembali ke sini.
        </Notice>
      )}

      {siswa === null && <Spinner />}
      {siswa && siswa.length === 0 && <Notice tone="info">Belum ada data siswa di kelas ini.</Notice>}

      {siswa && siswa.length > 0 && rubrik.length > 0 && (
        <>
          <div className="overflow-x-auto rounded-xl border border-border bg-white shadow-sm">
            <table className="w-full min-w-[40rem] border-separate border-spacing-0 text-left text-[12.5px]">
              <thead className="bg-slate-50 text-[11px] font-semibold text-slate-600">
                <tr>
                  <th className="sticky left-0 z-10 min-w-[10rem] border-b border-border bg-slate-50 px-3 py-2.5 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.06)]">
                    Siswa
                  </th>
                  {rubrik.map((r) => (
                    <th
                      key={r.id}
                      className="min-w-[5.5rem] border-b border-border px-2 py-2.5 text-center"
                      title={r.mapel ? `Mapel: ${r.mapel}` : undefined}
                    >
                      <span className="mx-auto block max-w-[7rem] leading-snug">{r.nama}</span>
                      {r.mapel && (
                        <span className="mt-0.5 block text-[10px] font-normal text-muted">{r.mapel}</span>
                      )}
                    </th>
                  ))}
                  <th className="min-w-[4rem] border-b border-border px-2 py-2.5 text-center">Rata</th>
                  <th className="min-w-[7rem] border-b border-border px-2 py-2.5 text-center">
                    DPL otomatis
                  </th>
                </tr>
              </thead>
              <tbody>
                {siswa.map((sw) => {
                  const row = skor[sw.id] || {}
                  const rata = rataNilaiProyek(
                    Object.fromEntries(rubrik.map((r) => [r.id, row[r.id] ?? null])),
                  )
                  const level = levelDplDariNilaiStem(rata)
                  const predikat = predikatDariNilaiStem(rata)
                  return (
                    <tr
                      key={sw.id}
                      className="group border-t border-border transition-colors hover:bg-slate-50/80"
                    >
                      <td className="sticky left-0 z-10 max-w-[12rem] truncate border-b border-border/60 bg-white px-3 py-1.5 font-medium text-slate-800 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.06)] group-hover:bg-slate-50/80">
                        {sw.nama}
                        {ubah.has(sw.id) && (
                          <span className="ml-1.5 text-[10px] text-amber-700">●</span>
                        )}
                      </td>
                      {rubrik.map((r) => (
                        <td key={r.id} className="border-b border-border/60 px-2 py-1.5 text-center">
                          <input
                            type="number"
                            min={0}
                            max={100}
                            inputMode="numeric"
                            className={`${inputSempitCls} mx-auto w-[4.25rem] text-center tabular-nums`}
                            value={row[r.id] ?? ''}
                            disabled={!bisaTulis}
                            placeholder="—"
                            onChange={(e) => setNilaiAspek(sw.id, r.id, e.target.value)}
                          />
                        </td>
                      ))}
                      <td className="border-b border-border/60 px-2 py-1.5 text-center tabular-nums text-slate-700">
                        {rata != null ? rata : '—'}
                        {predikat && (
                          <span className="mt-0.5 block text-[10px] font-normal text-muted">
                            {predikat}
                          </span>
                        )}
                      </td>
                      <td className="border-b border-border/60 px-2 py-1.5 text-center text-[11.5px] text-slate-600">
                        {level != null ? (
                          <span className="font-medium text-slate-800">
                            {level}. {DPL_LEVEL_LABEL[level - 1]}
                          </span>
                        ) : (
                          <span className="text-muted">Belum diisi</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {bisaTulis && (
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                className={btnPrimary}
                disabled={sibuk || ubah.size === 0}
                onClick={() => void simpanSemua()}
              >
                {sibuk
                  ? 'Menyimpan…'
                  : `Simpan nilai proyek${ubah.size ? ` (${ubah.size} siswa berubah)` : ''}`}
              </button>
              {ubah.size > 0 && (
                <button
                  type="button"
                  className={btnGhost}
                  disabled={sibuk}
                  onClick={() => void muat()}
                >
                  Batalkan perubahan
                </button>
              )}
              <p className="text-[11.5px] text-muted">
                Menyimpan juga mengisi level DPL terkait proyek dari rata-rata skor instrumen.
              </p>
            </div>
          )}
          {admin && (
            <Notice tone="info">Mode pantauan — hanya wali kelas yang mengisi nilai proyek.</Notice>
          )}
        </>
      )}

      {toast.node}
    </div>
  )
}
