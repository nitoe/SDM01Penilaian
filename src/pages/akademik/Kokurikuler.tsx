import { useCallback, useEffect, useMemo, useState } from 'react'
import { PageHeader } from '../../components/ui'
import Tabs from '../../components/Tabs'
import { kelasSaya } from '../../lib/kelasSaya'
import { getSiswaList } from '../../lib/tahsinData'
import { usePeriodeAkademik } from '../../lib/usePeriodeAkademik'
import { getMapelList, getTPList } from '../../lib/akademik'
import { tingkatanDariKelas } from '../../lib/akademikRumus'
import { isAdminRole } from '../../lib/roles'
import {
  bolehGenerateAi,
  generateStemAi,
  type ProviderAi,
} from '../../lib/generateAi'
import {
  getDplByKelas,
  getG7kaihByKelas,
  getNilaiDplByProyek,
  getNilaiProyekByProyek,
  getProyekStemByKelas,
  hapusDpl,
  hapusProyekStem,
  pastikanDplBaku,
  simpanDpl,
  simpanG7kaihBanyak,
  simpanNilaiDpl,
  simpanNilaiProyek,
  simpanProyekStem,
} from '../../lib/kokurikuler'
import type { TujuanPembelajaran } from '../../types/akademik'
import type { AppUser } from '../../types/user'
import type { SiswaTahsin } from '../../types/tahsin'
import type {
  CatatanKebiasaan,
  Dpl,
  LevelDpl,
  MapelTerlibatStem,
  ProyekStem,
  RubrikAspekStem,
} from '../../types/kokurikuler'
import {
  DAFTAR_KEBIASAAN_7KAIH,
  DPL_LEVEL_LABEL,
  KEBIASAAN_SULIT_VERIFIKASI_7KAIH,
  STEM_NILAI_RANGE,
  predikatDariNilaiStem,
} from '../../types/kokurikuler'
import {
  Notice,
  Spinner,
  btnGhost,
  btnGhostSm,
  btnPrimary,
  btnPrimarySm,
  btnDangerGhostSm,
  inputCls,
  selectCls,
  useToast,
} from './shared'

type TabId = 'stem' | '7kaih'

/**
 * Kokurikuler — dua tab: Proyek STEM (+ panel DPL) dan 7KAIH.
 * Hanya wali kelas yang menulis; admin mode pantauan (baca saja).
 * Keterkaitan mapel/TP di STEM TIDAK menulis ke nilai_tp/SLM.
 */
export default function Kokurikuler({ profile }: { profile: AppUser }) {
  const admin = isAdminRole(profile.role)
  const periodeAk = usePeriodeAkademik()
  const { wali } = kelasSaya(profile)
  const toast = useToast()

  const kelasBoleh = useMemo(() => (admin ? [] : wali), [admin, wali])
  // Admin: bisa pilih kelas lewat input teks/list — untuk pantauan, pakai wali kosong → minta pilih
  const [kelas, setKelas] = useState('')
  const [tab, setTab] = useState<TabId>('stem')

  useEffect(() => {
    if (kelasBoleh.length && !kelasBoleh.includes(kelas)) {
      setKelas(kelasBoleh[0] || '')
    } else if (!kelas && kelasBoleh[0]) {
      setKelas(kelasBoleh[0])
    }
  }, [kelas, kelasBoleh])

  const periode = useMemo(
    () =>
      periodeAk.ready
        ? { tahunAjaran: periodeAk.tahunAjaran, semester: periodeAk.semester }
        : null,
    [periodeAk.ready, periodeAk.tahunAjaran, periodeAk.semester],
  )

  const bisaTulis = !admin && wali.includes(kelas)
  const bisaBaca = admin || wali.includes(kelas)

  if (!admin && wali.length === 0) {
    return (
      <div className="space-y-5">
        <PageHeader
          back={{ to: '/akademik', label: 'Akademik & Rapor' }}
          title="Kokurikuler"
          subtitle="Proyek STEM dan 7KAIH — khusus wali kelas."
        />
        <Notice tone="warn">
          Anda bukan wali kelas. Fitur ini hanya diisi wali kelas (admin dapat memantau setelah data
          diisi).
        </Notice>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <PageHeader
        back={{ to: '/akademik', label: admin ? 'Pantauan Akademik' : 'Akademik & Rapor' }}
        title="Kokurikuler"
        subtitle={
          admin
            ? 'Mode pantauan. Wali kelas mengisi Proyek STEM, nilai DPL, dan 7KAIH.'
            : 'Proyek STEM (observasi DPL) dan 7KAIH. Keterkaitan mapel/TP hanya dokumentasi — tidak mengubah nilai SLM.'
        }
      />

      <div className="card-soft flex flex-wrap items-end gap-3 p-4">
        <label className="block text-[11px] font-medium text-slate-600">
          Kelas
          {admin ? (
            <input
              className={`${inputCls} mt-1 min-w-28`}
              value={kelas}
              onChange={(e) => setKelas(e.target.value.trim())}
              placeholder="mis. 4A"
            />
          ) : (
            <select
              className={`${selectCls} mt-1 min-w-28`}
              value={kelas}
              onChange={(e) => setKelas(e.target.value)}
            >
              {kelasBoleh.map((k) => (
                <option key={k} value={k}>
                  Kelas {k}
                </option>
              ))}
            </select>
          )}
        </label>
        <p className="pb-1 text-[12px] text-muted">
          {periode ? `Periode ${periodeAk.label}` : 'Pilih periode di header terlebih dahulu.'}
        </p>
      </div>

      {!kelas && <Notice tone="warn">Pilih kelas terlebih dahulu.</Notice>}
      {kelas && !bisaBaca && (
        <Notice tone="error">Anda tidak berhak melihat data kelas {kelas}.</Notice>
      )}
      {kelas && bisaBaca && periode && (
        <Tabs
          items={[
            { id: 'stem', label: 'Proyek STEM' },
            { id: '7kaih', label: '7KAIH' },
          ]}
          aktif={tab}
          onUbah={(id) => setTab(id as TabId)}
          ariaLabel="Bagian kokurikuler"
        >
          {tab === 'stem' && (
            <TabStem
              kelas={kelas}
              periode={periode}
              labelPeriode={periodeAk.label}
              bisaTulis={bisaTulis}
              profile={profile}
              toast={toast}
            />
          )}
          {tab === '7kaih' && (
            <Tab7Kaih
              kelas={kelas}
              periode={periode}
              labelPeriode={periodeAk.label}
              bisaTulis={bisaTulis}
              profile={profile}
              toast={toast}
            />
          )}
        </Tabs>
      )}
      {toast.node}
    </div>
  )
}

// ── Tab Proyek STEM (+ panel DPL) ────────────────────────────────────────────

// ── Tab Proyek STEM (+ panel DPL) ────────────────────────────────────────────

type StemSubTab = 'identitas' | 'tujuan' | 'instrumen' | 'ai'

function TabStem({
  kelas,
  periode,
  labelPeriode,
  bisaTulis,
  profile,
  toast,
}: {
  kelas: string
  periode: { tahunAjaran: string; semester: '1' | '2' }
  labelPeriode: string
  bisaTulis: boolean
  profile: AppUser
  toast: { show: (m: string, err?: boolean) => void }
}) {
  const bolehAi = bolehGenerateAi(profile.uid)

  const [dpl, setDpl] = useState<Dpl[] | null>(null)
  const [proyek, setProyek] = useState<ProyekStem[] | null>(null)
  const [mapelNama, setMapelNama] = useState<string[]>([])
  const [galat, setGalat] = useState('')
  const [panelDpl, setPanelDpl] = useState(false)
  const [formBuka, setFormBuka] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [isiNilaiId, setIsiNilaiId] = useState<string | null>(null)
  const [sibuk, setSibuk] = useState(false)
  const [subTab, setSubTab] = useState<StemSubTab>('identitas')

  // Form state
  const [judul, setJudul] = useState('')
  const [tMulai, setTMulai] = useState('')
  const [tSelesai, setTSelesai] = useState('')
  const [jPertemuan, setJPertemuan] = useState('6')
  const [deskripsi, setDeskripsi] = useState('')
  const [scaffolding, setScaffolding] = useState<string[]>([])
  const [barisMapel, setBarisMapel] = useState<MapelTerlibatStem[]>([])
  const [dplPilih, setDplPilih] = useState<string[]>([])
  const [rubrik, setRubrik] = useState<RubrikAspekStem[]>([])
  const [ideAi, setIdeAi] = useState('')
  // Usulan deskripsi level DPL dari AI (hanya untuk DPL yang bank-nya kosong); disimpan bersama proyek.
  const [dplLevelAi, setDplLevelAi] = useState<Record<string, [string, string, string, string]>>({})
  const [providerAi, setProviderAi] = useState<ProviderAi>('gemini')
  const [sibukAi, setSibukAi] = useState(false)
  const [tpCache, setTpCache] = useState<Record<string, TujuanPembelajaran[]>>({})

  const muat = useCallback(async () => {
    setGalat('')
    try {
      const [d, p, mapel] = await Promise.all([
        pastikanDplBaku(kelas).catch(() => getDplByKelas(kelas)),
        getProyekStemByKelas(kelas, periode),
        getMapelList(),
      ])
      setDpl(d)
      setProyek(p)
      const ting = tingkatanDariKelas(kelas)
      setMapelNama(
        mapel
          .filter((m) => {
            const b = m.tingkatanBerlaku
            return !b?.length || b.includes(ting)
          })
          .map((m) => m.nama)
          .sort((a, b) => a.localeCompare(b, 'id')),
      )
    } catch (e) {
      console.error(e)
      setGalat(
        'Gagal memuat data. Pastikan firestore.rules sudah di-deploy (dpl, proyek_stem, kokurikuler, nilai_proyek_stem).',
      )
      setDpl([])
      setProyek([])
    }
  }, [kelas, periode])

  useEffect(() => {
    void muat()
  }, [muat])

  async function loadTp(mapel: string) {
    if (tpCache[mapel]) return
    try {
      const list = await getTPList(mapel, kelas)
      setTpCache((c) => ({ ...c, [mapel]: list }))
    } catch {
      setTpCache((c) => ({ ...c, [mapel]: [] }))
    }
  }

  function resetForm() {
    setEditId(null)
    setJudul('')
    setDeskripsi('')
    setScaffolding([])
    setBarisMapel([])
    setDplPilih([])
    setRubrik([])
    setIdeAi('')
    setDplLevelAi({})
    setTMulai('')
    setTSelesai('')
    setJPertemuan('6')
    setSubTab('identitas')
  }

  function bukaFormBaru() {
    resetForm()
    // Proyek baru dimulai dari tab AI: cukup tulis keterangan aktivitas.
    if (bolehAi) setSubTab('ai')
    setFormBuka(true)
    setIsiNilaiId(null)
  }

  function bukaFormEdit(p: ProyekStem) {
    setEditId(p.id)
    setJudul(p.judul)
    setDeskripsi(p.deskripsi || '')
    setScaffolding([...(p.scaffolding || [])])
    setTMulai(p.tanggalMulai)
    setTSelesai(p.tanggalSelesai)
    setJPertemuan(String(p.jumlahPertemuan || ''))
    const baris = p.mapelTerlibat.map((m) => ({ ...m }))
    setBarisMapel(baris)
    for (const m of baris) void loadTp(m.mapel)
    setDplPilih([...p.dplId])
    setRubrik([...(p.rubrik || [])])
    setIdeAi('')
    setDplLevelAi({})
    setSubTab('identitas')
    setFormBuka(true)
    setIsiNilaiId(null)
  }

  async function jalankanAi() {
    if (!bolehAi) {
      toast.show('Fitur AI tidak tersedia untuk akun Anda.', true)
      return
    }
    if (ideAi.trim().length < 10) {
      toast.show('Tulis ringkasan ide proyek (minimal ~10 karakter).', true)
      return
    }
    // AI memilih dari SEMUA DPL kelas (aktif atau belum); yang terpilih diaktifkan saat proyek disimpan.
    const dplUntukAi = dpl || []
    if (dplUntukAi.length < 3) {
      toast.show('Kelas ini punya kurang dari 3 DPL. Tambahkan di panel Dimensi Profil Lulusan.', true)
      return
    }
    setSibukAi(true)
    try {
      const katalogTp: { id: string; mapel: string; namaTp: string }[] = []
      for (const nama of mapelNama) {
        let list = tpCache[nama]
        if (!list) {
          try {
            list = await getTPList(nama, kelas)
            setTpCache((c) => ({ ...c, [nama]: list! }))
          } catch {
            list = []
          }
        }
        for (const tp of list || []) {
          katalogTp.push({ id: tp.id, mapel: nama, namaTp: tp.namaTp || tp.id })
        }
      }
      const mapelBerTp = new Set(katalogTp.map((t) => t.mapel))
      if (katalogTp.length < 2 || mapelBerTp.size < 2) {
        const tanpaTp = mapelNama.filter((n) => !mapelBerTp.has(n))
        toast.show(
          'TP kelas ini baru ada di ' +
            mapelBerTp.size +
            ' mapel; dibutuhkan minimal 2 mapel. Susun TP di Setup TP' +
            (tanpaTp.length ? ` — mapel belum punya TP: ${tanpaTp.slice(0, 6).join(', ')}${tanpaTp.length > 6 ? ', …' : ''}.` : '.'),
          true,
        )
        return
      }
      const hasil = await generateStemAi({
        provider: providerAi,
        ide: ideAi.trim(),
        kelas,
        katalogTp,
        katalogDpl: dplUntukAi.map((d) => ({ id: d.id, nama: d.nama, levelDeskripsi: d.levelDeskripsi })),
      })
      setJudul(hasil.judul || '')
      setDeskripsi(hasil.deskripsi || '')
      setJPertemuan(String(hasil.jumlahPertemuan || 6))
      setScaffolding(hasil.scaffolding || [])
      setDplPilih((hasil.dplId || []).slice(0, 4))
      const baris: MapelTerlibatStem[] = (hasil.mapelTerlibat || []).map((m) => ({
        mapel: m.mapel,
        tpId: m.tpId,
        namaTp: m.namaTp,
        jenisNilai: m.jenisNilai,
      }))
      setBarisMapel(baris)
      for (const m of baris) void loadTp(m.mapel)
      const stamp = Date.now()
      const empat = (a: string[] | undefined): [string, string, string, string] => [
        a?.[0] || '',
        a?.[1] || '',
        a?.[2] || '',
        a?.[3] || '',
      ]
      if (hasil.rubrik?.length) {
        setRubrik(
          hasil.rubrik.map((a, i) => ({
            id: `ai_${stamp}_${i}`,
            nama: a.nama,
            mapel: a.mapel || undefined,
            deskripsiRentang: empat(a.deskripsiRentang),
          })),
        )
      } else if (hasil.daftarNilai?.length) {
        setRubrik(
          hasil.daftarNilai.map((nama, i) => ({
            id: `ai_${stamp}_${i}`,
            nama,
            deskripsiRentang: ['', '', '', ''] as [string, string, string, string],
          })),
        )
      }
      const levelBaru: Record<string, [string, string, string, string]> = {}
      for (const l of hasil.dplLevel || []) levelBaru[l.dplId] = empat(l.levelDeskripsi)
      setDplLevelAi(levelBaru)
      setSubTab('identitas')
      toast.show(
        `AI mengisi proyek: ${baris.length} mapel/TP, ${hasil.dplId?.length || 0} DPL, ${hasil.rubrik?.length || 0} aspek rubrik. Isi tanggal, periksa tiap tab, lalu simpan.`,
      )
    } catch (e) {
      console.error(e)
      toast.show(e instanceof Error ? e.message : 'Gagal memanggil AI.', true)
    } finally {
      setSibukAi(false)
    }
  }

  async function simpanForm() {
    if (!judul.trim()) {
      toast.show('Judul proyek wajib diisi (tab Identitas).', true)
      setSubTab('identitas')
      return
    }
    const mapelTerlibat: MapelTerlibatStem[] = barisMapel
      .filter((b) => b.mapel && b.tpId)
      .map((b) => {
        const tp = (tpCache[b.mapel] || []).find((t) => t.id === b.tpId)
        return {
          mapel: b.mapel,
          tpId: b.tpId,
          namaTp: tp?.namaTp || b.namaTp || undefined,
          jenisNilai: b.jenisNilai || 'SLM',
        }
      })
    const mapelUnik = new Set(mapelTerlibat.map((m) => m.mapel))
    if (mapelUnik.size < 2) {
      toast.show('Pilih minimal 2 mapel berbeda dan tautkan TP (tab Tujuan).', true)
      setSubTab('tujuan')
      return
    }
    if (dplPilih.length < 2 || dplPilih.length > 4) {
      toast.show('Pilih 2–4 DPL aktif yang diamati (tab Tujuan).', true)
      setSubTab('tujuan')
      return
    }
    setSibuk(true)
    try {
      // DPL terpilih otomatis diaktifkan. Deskripsi level dari AI hanya mengisi level yang masih kosong.
      for (const dplTerpilih of dplPilih) {
        const d = (dpl || []).find((x) => x.id === dplTerpilih)
        if (!d) continue
        const dariAi = dplLevelAi[d.id]
        const level = d.levelDeskripsi.map((t, i) => t || dariAi?.[i] || '') as [
          string,
          string,
          string,
          string,
        ]
        const levelBerubah = level.some((t, i) => t !== d.levelDeskripsi[i])
        if (!d.aktif || levelBerubah) {
          await simpanDpl({
            id: d.id,
            kelas: d.kelas,
            nama: d.nama,
            urutan: d.urutan,
            aktif: true,
            levelDeskripsi: level,
          })
        }
      }
      const id = await simpanProyekStem({
        id: editId || undefined,
        kelas,
        semester: periode.semester,
        tahunAjaran: periode.tahunAjaran,
        judul: judul.trim(),
        deskripsi: deskripsi.trim() || undefined,
        mapelTerlibat,
        dplId: dplPilih,
        tanggalMulai: tMulai,
        tanggalSelesai: tSelesai,
        jumlahPertemuan: Number(jPertemuan) || 0,
        scaffolding,
        daftarNilai: rubrik.map((r) => r.nama),
        rubrik,
      })
      setEditId(id)
      toast.show('Proyek STEM tersimpan.')
      await muat()
    } catch (e) {
      console.error(e)
      toast.show(e instanceof Error ? e.message : 'Gagal menyimpan proyek.', true)
    } finally {
      setSibuk(false)
    }
  }

  async function hapus(id: string) {
    if (!confirm('Hapus proyek STEM ini? Nilai DPL / skor proyek yang terikat tetap di database.')) return
    setSibuk(true)
    try {
      await hapusProyekStem(id)
      toast.show('Proyek dihapus.')
      if (isiNilaiId === id) setIsiNilaiId(null)
      if (editId === id) {
        setFormBuka(false)
        resetForm()
      }
      await muat()
    } catch {
      toast.show('Gagal menghapus.', true)
    } finally {
      setSibuk(false)
    }
  }

  // Pilihan DPL: yang aktif, ditambah DPL nonaktif yang sudah terpilih (mis. oleh AI) — diaktifkan saat simpan.
  const dplTampil = (dpl || []).filter((d) => d.aktif || dplPilih.includes(d.id))

  if (dpl === null || proyek === null) return <Spinner />
  if (galat) return <Notice tone="error">{galat}</Notice>

  if (isiNilaiId) {
    const p = proyek.find((x) => x.id === isiNilaiId)
    if (!p) {
      setIsiNilaiId(null)
      return null
    }
    return (
      <IsiNilaiDpl
        proyek={p}
        dplList={dpl}
        kelas={kelas}
        periode={periode}
        bisaTulis={bisaTulis}
        onKembali={() => setIsiNilaiId(null)}
        toast={toast}
      />
    )
  }

  const subItems = [
    { id: 'identitas', label: 'Identitas' },
    { id: 'tujuan', label: 'Tujuan' },
    { id: 'instrumen', label: 'Instrumen' },
    ...(bolehAi ? [{ id: 'ai', label: 'AI' }] : []),
  ]

  return (
    <div className="space-y-4">
      <p className="text-[12px] text-muted">
        Semester {labelPeriode}. Observasi DPL & skor proyek terikat ke STEM — bukan nilai mapel/SLM.
      </p>

      {/* Panel DPL */}
      <section className="card-soft overflow-hidden">
        <button
          type="button"
          className="flex w-full items-center justify-between px-4 py-3 text-left"
          onClick={() => setPanelDpl((v) => !v)}
        >
          <div>
            <h3 className="text-[13.5px] font-semibold text-slate-900">Dimensi Profil Lulusan (DPL)</h3>
            <p className="text-[11.5px] text-muted">
              {(dpl || []).filter((d) => d.aktif).length} aktif dari {(dpl || []).length} · dipakai saat
              merancang proyek
            </p>
          </div>
          <span className="text-[12px] font-medium text-muh-700">{panelDpl ? 'Tutup' : 'Kelola'}</span>
        </button>
        {panelDpl && (
          <div className="space-y-2 border-t border-border px-4 py-3">
            <PanelDpl dpl={dpl} bisaTulis={bisaTulis} onRefresh={muat} toast={toast} />
          </div>
        )}
      </section>

      {/* Daftar proyek */}
      {!formBuka && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-[13.5px] font-semibold text-slate-900">Daftar Proyek STEM</h3>
            {bisaTulis && (
              <button type="button" className={btnPrimarySm} onClick={bukaFormBaru}>
                + Rancang proyek
              </button>
            )}
          </div>
          {(proyek || []).length === 0 && (
            <Notice tone="info">Belum ada proyek STEM untuk periode ini.</Notice>
          )}
          <ul className="space-y-3">
            {(proyek || []).map((p) => (
              <li key={p.id} className="card-soft space-y-2 p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h4 className="text-[14px] font-semibold text-slate-900">{p.judul}</h4>
                    <p className="text-[11.5px] text-muted">
                      {p.jumlahPertemuan || '—'} pertemuan
                      {p.tanggalMulai ? ` · ${p.tanggalMulai}` : ''}
                      {p.tanggalSelesai ? ` – ${p.tanggalSelesai}` : ''}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {bisaTulis && (
                      <button type="button" className={btnGhostSm} onClick={() => bukaFormEdit(p)}>
                        Edit
                      </button>
                    )}
                    <button
                      type="button"
                      className={btnPrimarySm}
                      onClick={() => setIsiNilaiId(p.id)}
                    >
                      Nilai DPL
                    </button>
                    {bisaTulis && (
                      <button type="button" className={btnDangerGhostSm} onClick={() => void hapus(p.id)}>
                        Hapus
                      </button>
                    )}
                  </div>
                </div>
                {(p.deskripsi || (p.scaffolding && p.scaffolding.length) || (p.rubrik && p.rubrik.length)) && (
                  <div className="space-y-1 text-[11.5px] text-slate-600">
                    {p.deskripsi ? <p className="line-clamp-2">{p.deskripsi}</p> : null}
                    {p.scaffolding && p.scaffolding.length > 0 ? (
                      <p className="text-muted">{p.scaffolding.length} langkah scaffolding</p>
                    ) : null}
                    {p.rubrik && p.rubrik.length > 0 ? (
                      <p className="text-muted">{p.rubrik.length} aspek rubrik penilaian</p>
                    ) : null}
                  </div>
                )}
                <div className="flex flex-wrap gap-1.5">
                  {p.mapelTerlibat.map((m, i) => (
                    <span
                      key={`${m.mapel}-${m.tpId}-${i}`}
                      className="rounded-full bg-slate-100 px-2 py-0.5 text-[10.5px] font-medium text-slate-700"
                    >
                      {m.mapel}
                      {m.jenisNilai ? ` · ${m.jenisNilai}` : ''}
                    </span>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        </>
      )}

      {/* Form editor dengan sub-tab */}
      {formBuka && bisaTulis && (
        <div className="card-soft space-y-3 border border-muh-200 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-[14px] font-semibold text-slate-900">
              {editId ? 'Edit Proyek STEM' : 'Rancang Proyek STEM Baru'}
            </h3>
            <button
              type="button"
              className={btnGhostSm}
              onClick={() => {
                setFormBuka(false)
                resetForm()
              }}
            >
              Tutup
            </button>
          </div>

          <Tabs
            items={subItems}
            aktif={subTab}
            onUbah={(id) => setSubTab(id as StemSubTab)}
            ariaLabel="Bagian rancang proyek STEM"
          >
            {subTab === 'identitas' && (
              <div className="space-y-3">
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-lg border border-border bg-slate-50 px-3 py-2">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Kelas</p>
                    <p className="text-[13px] font-medium text-slate-900">{kelas}</p>
                  </div>
                  <div className="rounded-lg border border-border bg-slate-50 px-3 py-2">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                      Tahun pelajaran
                    </p>
                    <p className="text-[13px] font-medium text-slate-900">{periode.tahunAjaran}</p>
                  </div>
                  <div className="rounded-lg border border-border bg-slate-50 px-3 py-2">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                      Semester
                    </p>
                    <p className="text-[13px] font-medium text-slate-900">{periode.semester}</p>
                  </div>
                </div>

                <label className="block text-[11px] font-medium text-slate-600">
                  Judul proyek
                  <textarea
                    className={`${inputCls} mt-1 min-h-[48px]`}
                    value={judul}
                    onChange={(e) => setJudul(e.target.value)}
                    placeholder="mis. Membuat Alat Penjernih Air Sederhana"
                  />
                </label>

                <label className="block text-[11px] font-medium text-slate-600">
                  Deskripsi proyek
                  <textarea
                    className={`${inputCls} mt-1 min-h-[88px]`}
                    value={deskripsi}
                    onChange={(e) => setDeskripsi(e.target.value)}
                    placeholder="Tujuan, konteks, dan hasil yang diharapkan…"
                  />
                </label>

                <div className="grid gap-3 sm:grid-cols-3">
                  <label className="block text-[11px] font-medium text-slate-600">
                    Tanggal mulai
                    <input
                      type="date"
                      className={`${inputCls} mt-1`}
                      value={tMulai}
                      onChange={(e) => setTMulai(e.target.value)}
                    />
                  </label>
                  <label className="block text-[11px] font-medium text-slate-600">
                    Tanggal selesai
                    <input
                      type="date"
                      className={`${inputCls} mt-1`}
                      value={tSelesai}
                      onChange={(e) => setTSelesai(e.target.value)}
                    />
                  </label>
                  <label className="block text-[11px] font-medium text-slate-600">
                    Jumlah pertemuan
                    <input
                      type="number"
                      min={1}
                      max={24}
                      className={`${inputCls} mt-1`}
                      value={jPertemuan}
                      onChange={(e) => setJPertemuan(e.target.value)}
                    />
                  </label>
                </div>

                {scaffolding.length > 0 && (
                  <div className="rounded-lg border border-border bg-white p-3">
                    <p className="mb-1.5 text-[11px] font-semibold text-slate-700">
                      Scaffolding (per pertemuan)
                    </p>
                    <ol className="list-decimal space-y-1 pl-4 text-[12px] text-slate-700">
                      {scaffolding.map((s, i) => (
                        <li key={i}>{s}</li>
                      ))}
                    </ol>
                    <button
                      type="button"
                      className="mt-2 text-[11px] font-medium text-muh-700 hover:underline"
                      onClick={() => {
                        const next = prompt(
                          'Edit scaffolding (satu baris per pertemuan):',
                          scaffolding.join('\n'),
                        )
                        if (next != null) {
                          setScaffolding(
                            next
                              .split('\n')
                              .map((x) => x.trim())
                              .filter(Boolean),
                          )
                        }
                      }}
                    >
                      Sunting
                    </button>
                  </div>
                )}
              </div>
            )}

            {subTab === 'tujuan' && (
              <div className="space-y-4">
                <div>
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <p className="text-[12.5px] font-semibold text-slate-800">
                      Mata pelajaran & Tujuan Pembelajaran
                    </p>
                    <button
                      type="button"
                      className={btnGhostSm}
                      onClick={() =>
                        setBarisMapel((b) => [
                          ...b,
                          { mapel: mapelNama[0] || '', tpId: '', jenisNilai: 'SLM' },
                        ])
                      }
                    >
                      + Tambah mapel/TP
                    </button>
                  </div>
                  <p className="mb-2 text-[11px] text-muted">
                    Minimal 2 mapel berbeda. Satu mapel boleh punya lebih dari satu TP. Keterkaitan hanya
                    dokumentasi — tidak menulis nilai SLM.
                  </p>
                  <ul className="space-y-2">
                    {barisMapel.map((b, idx) => (
                      <li
                        key={idx}
                        className="grid gap-2 rounded-lg border border-border bg-white p-2.5 sm:grid-cols-[1fr_1.4fr_auto_auto]"
                      >
                        <select
                          className={selectCls}
                          value={b.mapel}
                          onChange={(e) => {
                            const mapel = e.target.value
                            void loadTp(mapel)
                            setBarisMapel((list) =>
                              list.map((x, i) =>
                                i === idx ? { ...x, mapel, tpId: '', namaTp: undefined } : x,
                              ),
                            )
                          }}
                        >
                          <option value="">Pilih mapel</option>
                          {mapelNama.map((n) => (
                            <option key={n} value={n}>
                              {n}
                            </option>
                          ))}
                        </select>
                        <select
                          className={selectCls}
                          value={b.tpId}
                          onFocus={() => b.mapel && void loadTp(b.mapel)}
                          onChange={(e) => {
                            const tpId = e.target.value
                            const tp = (tpCache[b.mapel] || []).find((t) => t.id === tpId)
                            setBarisMapel((list) =>
                              list.map((x, i) =>
                                i === idx
                                  ? { ...x, tpId, namaTp: tp?.namaTp || undefined }
                                  : x,
                              ),
                            )
                          }}
                        >
                          <option value="">Pilih TP</option>
                          {(tpCache[b.mapel] || []).map((tp) => (
                            <option key={tp.id} value={tp.id}>
                              {tp.namaTp || tp.id}
                            </option>
                          ))}
                        </select>
                        <select
                          className={selectCls}
                          value={b.jenisNilai}
                          onChange={(e) => {
                            const jenisNilai = e.target.value as 'SLM' | 'SAS'
                            setBarisMapel((list) =>
                              list.map((x, i) => (i === idx ? { ...x, jenisNilai } : x)),
                            )
                          }}
                        >
                          <option value="SLM">SLM</option>
                          <option value="SAS">SAS</option>
                        </select>
                        <button
                          type="button"
                          className={btnDangerGhostSm}
                          onClick={() => setBarisMapel((list) => list.filter((_, i) => i !== idx))}
                        >
                          Hapus
                        </button>
                      </li>
                    ))}
                    {barisMapel.length === 0 && (
                      <li className="text-[12px] text-muted">Belum ada tautan mapel–TP.</li>
                    )}
                  </ul>
                </div>

                <div>
                  <p className="mb-1.5 text-[12.5px] font-semibold text-slate-800">
                    DPL yang diamati (2–4)
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {dplTampil.map((d) => {
                      const on = dplPilih.includes(d.id)
                      return (
                        <button
                          key={d.id}
                          type="button"
                          className={`rounded-full border px-2.5 py-1 text-[11.5px] font-medium transition-colors ${
                            on
                              ? 'border-muh-600 bg-muh-50 text-muh-900'
                              : 'border-border bg-white text-slate-600 hover:border-slate-300'
                          }`}
                          onClick={() => {
                            setDplPilih((prev) => {
                              if (prev.includes(d.id)) return prev.filter((x) => x !== d.id)
                              if (prev.length >= 4) return prev
                              return [...prev, d.id]
                            })
                          }}
                        >
                          {d.nama}
                          {d.aktif ? '' : ' · diaktifkan saat disimpan'}
                        </button>
                      )
                    })}
                    {dplTampil.length === 0 && (
                      <p className="text-[12px] text-muted">
                        Belum ada DPL aktif. Isi lewat tab AI, atau aktifkan DPL di panel atas.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {subTab === 'instrumen' && (
              <InstrumenPenilaianPanel
                rubrik={rubrik}
                setRubrik={setRubrik}
                mapelNama={mapelNama}
                editId={editId}
                judul={judul}
                kelas={kelas}
                periode={periode}
                bisaTulis={bisaTulis}
                toast={toast}
              />
            )}

            {subTab === 'ai' && bolehAi && (
              <div className="space-y-3">
                <p className="text-[12.5px] font-semibold text-muh-900">Generate Proyek STEM dengan AI</p>
                <p className="text-[11.5px] text-muted">
                  Cukup tulis keterangan aktivitas proyek. AI memilih mata pelajaran dan TP dari database
                  kelas, 3 DPL yang paling sesuai (aktif atau belum), lalu menyusun judul, deskripsi,
                  scaffolding, dan rubrik penilaian lengkap dengan deskripsi tiap rentang nilai. Tanggal
                  pelaksanaan diisi sendiri. Hasil mengisi tab Identitas, Tujuan, dan Instrumen — tidak
                  menulis nilai mapel. Periksa sebelum menyimpan.
                </p>
                <textarea
                  className={`${inputCls} min-h-[100px]`}
                  value={ideAi}
                  onChange={(e) => setIdeAi(e.target.value)}
                  placeholder="Contoh: siswa meneliti kualitas air sumur di sekitar sekolah, merancang filter sederhana, lalu mempresentasikan hasilnya…"
                  disabled={sibukAi}
                />
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    className={selectCls}
                    value={providerAi}
                    disabled={sibukAi}
                    onChange={(e) => setProviderAi(e.target.value as ProviderAi)}
                  >
                    <option value="gemini">Gemini</option>
                    <option value="openai">OpenAI</option>
                  </select>
                  <button
                    type="button"
                    className={btnPrimarySm}
                    disabled={sibukAi || !ideAi.trim()}
                    onClick={() => void jalankanAi()}
                  >
                    {sibukAi ? 'AI menyusun…' : 'Isi formulir dengan AI'}
                  </button>
                </div>
              </div>
            )}
          </Tabs>

          <div className="flex flex-wrap gap-2 border-t border-border pt-3">
            <button type="button" className={btnPrimary} disabled={sibuk} onClick={() => void simpanForm()}>
              {sibuk ? 'Menyimpan…' : 'Simpan proyek'}
            </button>
            <button
              type="button"
              className={btnGhost}
              disabled={sibuk}
              onClick={() => {
                setFormBuka(false)
                resetForm()
              }}
            >
              Batal
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

/** Panel rubrik + tabel input nilai 0–100 dengan rubrik samping (toggle). */
function InstrumenPenilaianPanel({
  rubrik,
  setRubrik,
  mapelNama,
  editId,
  judul,
  kelas,
  periode,
  bisaTulis,
  toast,
}: {
  rubrik: RubrikAspekStem[]
  setRubrik: (v: RubrikAspekStem[] | ((prev: RubrikAspekStem[]) => RubrikAspekStem[])) => void
  mapelNama: string[]
  editId: string | null
  judul: string
  kelas: string
  periode: { tahunAjaran: string; semester: '1' | '2' }
  bisaTulis: boolean
  toast: { show: (m: string, err?: boolean) => void }
}) {
  const [siswa, setSiswa] = useState<SiswaTahsin[] | null>(null)
  const [nilaiMap, setNilaiMap] = useState<Record<string, Record<string, number | null>>>({})
  const [tampilRubrik, setTampilRubrik] = useState(true)
  const [sibukNilai, setSibukNilai] = useState(false)
  const [editAspekId, setEditAspekId] = useState<string | null>(null)

  useEffect(() => {
    let batal = false
    ;(async () => {
      try {
        const list = await getSiswaList(kelas, { role: 'guru_akademik', kelasAmpu: [kelas] })
        if (!batal) setSiswa(list)
      } catch {
        if (!batal) setSiswa([])
      }
    })()
    return () => {
      batal = true
    }
  }, [kelas])

  useEffect(() => {
    if (!editId) {
      setNilaiMap({})
      return
    }
    let batal = false
    ;(async () => {
      try {
        const list = await getNilaiProyekByProyek(editId)
        if (batal) return
        const m: Record<string, Record<string, number | null>> = {}
        for (const n of list) m[n.siswaId] = { ...n.nilai }
        setNilaiMap(m)
      } catch {
        if (!batal) setNilaiMap({})
      }
    })()
    return () => {
      batal = true
    }
  }, [editId])

  function tambahAspek() {
    const id = `r_${Date.now()}`
    setRubrik((r) => [
      ...r,
      {
        id,
        nama: `Aspek ${r.length + 1}`,
        deskripsiRentang: ['', '', '', ''],
      },
    ])
    setEditAspekId(id)
  }

  async function simpanSemuaNilai() {
    if (!editId) {
      toast.show('Simpan proyek dulu (tab Identitas/Tujuan) sebelum mengisi skor.', true)
      return
    }
    if (!rubrik.length) {
      toast.show('Tambah minimal satu aspek rubrik.', true)
      return
    }
    setSibukNilai(true)
    try {
      const list = siswa || []
      for (const s of list) {
        const nilai = nilaiMap[s.id] || {}
        await simpanNilaiProyek({
          proyekStemId: editId,
          siswaId: s.id,
          kelas,
          semester: periode.semester,
          tahunAjaran: periode.tahunAjaran,
          nilai,
        })
      }
      toast.show('Skor proyek tersimpan.')
    } catch (e) {
      console.error(e)
      toast.show(e instanceof Error ? e.message : 'Gagal menyimpan skor.', true)
    } finally {
      setSibukNilai(false)
    }
  }

  function setNilaiSiswa(siswaId: string, aspekId: string, raw: string) {
    const trimmed = raw.trim()
    let v: number | null = null
    if (trimmed !== '') {
      const n = Math.round(Number(trimmed))
      if (Number.isFinite(n)) v = Math.max(0, Math.min(100, n))
    }
    setNilaiMap((m) => ({
      ...m,
      [siswaId]: { ...(m[siswaId] || {}), [aspekId]: v },
    }))
  }

  return (
    <div className="space-y-4">
      <div>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <p className="text-[12.5px] font-semibold text-slate-800">Rubrik penilaian proyek</p>
          {bisaTulis && (
            <button type="button" className={btnGhostSm} onClick={tambahAspek}>
              + Aspek
            </button>
          )}
        </div>
        <p className="mb-2 text-[11px] text-muted">
          Skala 0–100 mengikuti rentang akademik:{' '}
          {STEM_NILAI_RANGE.map((r) => `${r.min}–${r.maks} ${r.label}`).join(' · ')}.
        </p>
        <ul className="space-y-2">
          {rubrik.map((a) => (
            <li key={a.id} className="rounded-lg border border-border bg-white p-2.5">
              <div className="flex flex-wrap items-center gap-2">
                <input
                  className={`${inputCls} min-w-[140px] flex-1`}
                  value={a.nama}
                  disabled={!bisaTulis}
                  onChange={(e) =>
                    setRubrik((list) =>
                      list.map((x) => (x.id === a.id ? { ...x, nama: e.target.value } : x)),
                    )
                  }
                />
                <select
                  className={selectCls}
                  value={a.mapel || ''}
                  disabled={!bisaTulis}
                  onChange={(e) =>
                    setRubrik((list) =>
                      list.map((x) =>
                        x.id === a.id ? { ...x, mapel: e.target.value || undefined } : x,
                      ),
                    )
                  }
                >
                  <option value="">— Mapel (opsional)</option>
                  {mapelNama.map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className={btnGhostSm}
                  onClick={() => setEditAspekId(editAspekId === a.id ? null : a.id)}
                >
                  {editAspekId === a.id ? 'Tutup deskripsi' : 'Deskripsi rentang'}
                </button>
                {bisaTulis && (
                  <button
                    type="button"
                    className={btnDangerGhostSm}
                    onClick={() => setRubrik((list) => list.filter((x) => x.id !== a.id))}
                  >
                    Hapus
                  </button>
                )}
              </div>
              {editAspekId === a.id && (
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  {STEM_NILAI_RANGE.map((r, i) => (
                    <label key={r.label} className="block text-[10.5px] font-medium text-slate-600">
                      {r.min}–{r.maks} · {r.label}
                      <textarea
                        className={`${inputCls} mt-0.5 min-h-[52px] text-[12px]`}
                        value={a.deskripsiRentang[i] || ''}
                        disabled={!bisaTulis}
                        onChange={(e) => {
                          const val = e.target.value
                          setRubrik((list) =>
                            list.map((x) => {
                              if (x.id !== a.id) return x
                              const dr: [string, string, string, string] = [...x.deskripsiRentang]
                              dr[i] = val
                              return { ...x, deskripsiRentang: dr }
                            }),
                          )
                        }}
                        placeholder={`Deskripsi capaian level ${r.label}…`}
                      />
                    </label>
                  ))}
                </div>
              )}
            </li>
          ))}
          {rubrik.length === 0 && (
            <li className="text-[12px] text-muted">Belum ada aspek. Tambah atau isi lewat tab AI.</li>
          )}
        </ul>
      </div>

      {/* Tabel nilai + rubrik samping */}
      <div>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <p className="text-[12.5px] font-semibold text-slate-800">
            Input skor proyek {judul ? `· ${judul}` : ''}
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={btnGhostSm}
              onClick={() => setTampilRubrik((v) => !v)}
            >
              {tampilRubrik ? 'Sembunyikan rubrik' : 'Tampilkan rubrik'}
            </button>
            {bisaTulis && editId && (
              <button
                type="button"
                className={btnPrimarySm}
                disabled={sibukNilai || !rubrik.length}
                onClick={() => void simpanSemuaNilai()}
              >
                {sibukNilai ? 'Menyimpan…' : 'Simpan skor'}
              </button>
            )}
          </div>
        </div>

        {!editId && (
          <Notice tone="warn">
            Simpan proyek terlebih dahulu agar skor per siswa dapat disimpan.
          </Notice>
        )}

        {editId && rubrik.length > 0 && (
          <div className={`grid gap-3 ${tampilRubrik ? 'lg:grid-cols-[1fr_280px]' : ''}`}>
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="min-w-full text-left text-[12px]">
                <thead className="bg-slate-50 text-[11px] font-semibold text-slate-600">
                  <tr>
                    <th className="sticky left-0 bg-slate-50 px-2 py-2">Siswa</th>
                    {rubrik.map((a) => (
                      <th key={a.id} className="whitespace-nowrap px-2 py-2">
                        {a.nama}
                        {a.mapel ? (
                          <span className="block text-[10px] font-normal text-muted">{a.mapel}</span>
                        ) : null}
                      </th>
                    ))}
                    <th className="px-2 py-2">Rata-rata</th>
                  </tr>
                </thead>
                <tbody>
                  {(siswa || []).map((s) => {
                    const row = nilaiMap[s.id] || {}
                    const nums = rubrik
                      .map((a) => row[a.id])
                      .filter((v): v is number => typeof v === 'number')
                    const avg =
                      nums.length > 0
                        ? Math.round(nums.reduce((a, b) => a + b, 0) / nums.length)
                        : null
                    return (
                      <tr key={s.id} className="border-t border-border">
                        <td className="sticky left-0 bg-white px-2 py-1.5 font-medium text-slate-800">
                          {s.nama}
                        </td>
                        {rubrik.map((a) => (
                          <td key={a.id} className="px-1 py-1">
                            <input
                              type="number"
                              min={0}
                              max={100}
                              className={`${inputCls} w-16 px-1.5 py-1 text-center`}
                              value={row[a.id] ?? ''}
                              disabled={!bisaTulis}
                              onChange={(e) => setNilaiSiswa(s.id, a.id, e.target.value)}
                              title={predikatDariNilaiStem(row[a.id]) || ''}
                            />
                          </td>
                        ))}
                        <td className="px-2 py-1.5 text-slate-600">
                          {avg != null ? (
                            <span>
                              {avg}
                              <span className="ml-1 text-[10px] text-muted">
                                {predikatDariNilaiStem(avg)}
                              </span>
                            </span>
                          ) : (
                            '—'
                          )}
                        </td>
                      </tr>
                    )
                  })}
                  {siswa && siswa.length === 0 && (
                    <tr>
                      <td colSpan={rubrik.length + 2} className="px-2 py-3 text-muted">
                        Belum ada data siswa di kelas ini.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {tampilRubrik && (
              <aside className="max-h-[480px] space-y-2 overflow-y-auto rounded-lg border border-muh-200 bg-muh-50/40 p-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muh-800">
                  Rubrik cepat
                </p>
                {rubrik.map((a) => (
                  <div key={a.id} className="rounded-md border border-border bg-white p-2">
                    <p className="text-[12px] font-semibold text-slate-800">{a.nama}</p>
                    <ul className="mt-1 space-y-1 text-[10.5px] text-slate-600">
                      {STEM_NILAI_RANGE.map((r, i) => (
                        <li key={r.label}>
                          <span className="font-semibold text-slate-700">
                            {r.min}–{r.maks} {r.label}:
                          </span>{' '}
                          {a.deskripsiRentang[i] || '—'}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </aside>
            )}
          </div>
        )}
      </div>
    </div>
  )
}


function PanelDpl({
  dpl,
  bisaTulis,
  onRefresh,
  toast,
}: {
  dpl: Dpl[]
  bisaTulis: boolean
  onRefresh: () => Promise<void>
  toast: { show: (m: string, err?: boolean) => void }
}) {
  const [openId, setOpenId] = useState<string | null>(null)
  const [sibuk, setSibuk] = useState(false)

  async function simpanSatu(d: Dpl, nama: string, aktif: boolean, levelDeskripsi: [string, string, string, string]) {
    if (!nama.trim()) {
      toast.show('Nama dimensi wajib diisi.', true)
      return
    }
    setSibuk(true)
    try {
      await simpanDpl({ id: d.id, kelas: d.kelas, nama, urutan: d.urutan, aktif, levelDeskripsi })
      toast.show('DPL tersimpan.')
      await onRefresh()
    } catch {
      toast.show('Gagal menyimpan DPL.', true)
    } finally {
      setSibuk(false)
    }
  }

  async function hapusSatu(id: string) {
    if (!confirm('Hapus DPL ini? Referensi di proyek yang sudah memakai akan tampil sebagai tidak ditemukan.'))
      return
    setSibuk(true)
    try {
      await hapusDpl(id)
      toast.show('DPL dihapus.')
      await onRefresh()
    } catch {
      toast.show('Gagal menghapus.', true)
    } finally {
      setSibuk(false)
    }
  }

  return (
    <ul className="space-y-2">
      {dpl.map((d) => (
        <li key={d.id} className="rounded-xl border border-border bg-white">
          <button
            type="button"
            className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left"
            onClick={() => setOpenId(openId === d.id ? null : d.id)}
          >
            <span className="text-[13px] font-medium text-slate-900">{d.nama}</span>
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                d.aktif ? 'bg-emerald-50 text-emerald-800' : 'bg-slate-100 text-slate-500'
              }`}
            >
              {d.aktif ? 'Aktif' : 'Nonaktif'}
            </span>
          </button>
          {openId === d.id && (
            <DplEditor
              d={d}
              bisaTulis={bisaTulis}
              sibuk={sibuk}
              onSimpan={simpanSatu}
              onHapus={hapusSatu}
            />
          )}
        </li>
      ))}
      {!bisaTulis && (
        <li className="text-[11.5px] text-muted">Mode pantauan — hanya wali kelas yang mengubah DPL.</li>
      )}
    </ul>
  )
}

function DplEditor({
  d,
  bisaTulis,
  sibuk,
  onSimpan,
  onHapus,
}: {
  d: Dpl
  bisaTulis: boolean
  sibuk: boolean
  onSimpan: (
    d: Dpl,
    nama: string,
    aktif: boolean,
    levelDeskripsi: [string, string, string, string],
  ) => Promise<void>
  onHapus: (id: string) => Promise<void>
}) {
  const [nama, setNama] = useState(d.nama)
  const [aktif, setAktif] = useState(d.aktif)
  const [levels, setLevels] = useState<[string, string, string, string]>([...d.levelDeskripsi])

  useEffect(() => {
    setNama(d.nama)
    setAktif(d.aktif)
    setLevels([...d.levelDeskripsi])
  }, [d])

  return (
    <div className="space-y-2 border-t border-border px-3 py-3">
      <label className="block text-[11px] font-medium text-slate-600">
        Nama dimensi
        <input
          className={`${inputCls} mt-1`}
          value={nama}
          disabled={!bisaTulis}
          onChange={(e) => setNama(e.target.value)}
        />
      </label>
      <label className="flex items-center gap-2 text-[12px] font-medium text-slate-700">
        <input
          type="checkbox"
          checked={aktif}
          disabled={!bisaTulis}
          onChange={(e) => setAktif(e.target.checked)}
        />
        Aktif — muncul sebagai pilihan di Proyek STEM
      </label>
      {DPL_LEVEL_LABEL.map((label, i) => (
        <label key={label} className="block text-[11px] font-medium text-slate-600">
          {label}
          <textarea
            className={`${inputCls} mt-1 min-h-[44px]`}
            value={levels[i]}
            disabled={!bisaTulis}
            onChange={(e) => {
              const next = [...levels] as [string, string, string, string]
              next[i] = e.target.value
              setLevels(next)
            }}
            placeholder="Kalimat deskripsi capaian untuk level ini…"
          />
        </label>
      ))}
      {bisaTulis && (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className={btnPrimarySm}
            disabled={sibuk}
            onClick={() => void onSimpan(d, nama, aktif, levels)}
          >
            Simpan
          </button>
          <button
            type="button"
            className={btnDangerGhostSm}
            disabled={sibuk}
            onClick={() => void onHapus(d.id)}
          >
            Hapus
          </button>
        </div>
      )}
    </div>
  )
}

function IsiNilaiDpl({
  proyek,
  dplList,
  kelas,
  periode,
  bisaTulis,
  onKembali,
  toast,
}: {
  proyek: ProyekStem
  dplList: Dpl[]
  kelas: string
  periode: { tahunAjaran: string; semester: '1' | '2' }
  bisaTulis: boolean
  onKembali: () => void
  toast: { show: (m: string, err?: boolean) => void }
}) {
  const [siswa, setSiswa] = useState<SiswaTahsin[] | null>(null)
  const [nilai, setNilai] = useState<
    Record<string, Record<string, { id: string; level: LevelDpl; deskripsi: string }>>
  >({})
  const [openIdx, setOpenIdx] = useState<number | null>(null)
  const [sibuk, setSibuk] = useState(false)

  const dplProyek = useMemo(
    () => proyek.dplId.map((id) => dplList.find((d) => d.id === id)).filter(Boolean) as Dpl[],
    [proyek.dplId, dplList],
  )

  const muat = useCallback(async () => {
    try {
      const [s, n] = await Promise.all([
        getSiswaList(kelas, { role: 'guru_akademik', kelasAmpu: [kelas] }),
        getNilaiDplByProyek(proyek.id, kelas),
      ])
      setSiswa(s)
      setNilai(n)
    } catch (e) {
      console.error(e)
      toast.show('Gagal memuat siswa / nilai DPL.', true)
      setSiswa([])
    }
  }, [kelas, proyek.id, toast])

  useEffect(() => {
    void muat()
  }, [muat])

  async function simpanSiswa(
    siswaId: string,
    rows: Record<string, { level: LevelDpl; deskripsi: string }>,
  ) {
    setSibuk(true)
    try {
      for (const [dplId, v] of Object.entries(rows)) {
        await simpanNilaiDpl({
          siswaId,
          dplId,
          kelas,
          semester: periode.semester,
          tahunAjaran: periode.tahunAjaran,
          proyekStemId: proyek.id,
          level: v.level,
          deskripsi: v.deskripsi,
        })
      }
      toast.show('Nilai DPL tersimpan.')
      await muat()
    } catch (e) {
      console.error(e)
      toast.show('Gagal menyimpan nilai DPL.', true)
    } finally {
      setSibuk(false)
    }
  }

  if (!siswa) return <Spinner />

  return (
    <div className="space-y-3">
      <button type="button" className="text-[12px] font-medium text-muh-700 hover:underline" onClick={onKembali}>
        ← Kembali ke daftar proyek
      </button>
      <div>
        <h3 className="text-[14px] font-semibold text-slate-900">{proyek.judul}</h3>
        <p className="text-[12px] text-muted">Isi level DPL per siswa. Deskripsi terisi dari bank DPL dan bisa disunting.</p>
      </div>
      <ul className="space-y-2">
        {siswa.map((sw, i) => (
          <SiswaNilaiDplCard
            key={sw.id}
            siswa={sw}
            open={openIdx === i}
            onToggle={() => setOpenIdx(openIdx === i ? null : i)}
            dplProyek={dplProyek}
            existing={nilai[sw.id] || {}}
            bisaTulis={bisaTulis}
            sibuk={sibuk}
            onSimpan={(rows) => void simpanSiswa(sw.id, rows)}
          />
        ))}
      </ul>
    </div>
  )
}

function SiswaNilaiDplCard({
  siswa,
  open,
  onToggle,
  dplProyek,
  existing,
  bisaTulis,
  sibuk,
  onSimpan,
}: {
  siswa: SiswaTahsin
  open: boolean
  onToggle: () => void
  dplProyek: Dpl[]
  existing: Record<string, { id: string; level: LevelDpl; deskripsi: string }>
  bisaTulis: boolean
  sibuk: boolean
  onSimpan: (rows: Record<string, { level: LevelDpl; deskripsi: string }>) => void
}) {
  const [rows, setRows] = useState<Record<string, { level: LevelDpl; deskripsi: string }>>({})

  useEffect(() => {
    const init: Record<string, { level: LevelDpl; deskripsi: string }> = {}
    for (const d of dplProyek) {
      const ex = existing[d.id]
      const level: LevelDpl = ex?.level ?? 2
      const deskripsi =
        ex?.deskripsi ||
        d.levelDeskripsi[level - 1] ||
        ''
      init[d.id] = { level, deskripsi }
    }
    setRows(init)
  }, [dplProyek, existing, open])

  const terisi = dplProyek.filter((d) => existing[d.id]?.level).length

  return (
    <li className="card-soft overflow-hidden">
      <button type="button" className="flex w-full items-center justify-between px-3.5 py-3 text-left" onClick={onToggle}>
        <div>
          <p className="text-[13px] font-semibold text-slate-900">{siswa.nama}</p>
          <p className="text-[11px] text-muted">
            {terisi}/{dplProyek.length} DPL terisi
          </p>
        </div>
        <span className="text-[12px] text-muh-700">{open ? 'Tutup' : 'Isi'}</span>
      </button>
      {open && (
        <div className="space-y-3 border-t border-border px-3.5 py-3">
          {dplProyek.map((d) => (
            <div key={d.id} className="rounded-lg bg-slate-50 p-2.5">
              <p className="mb-1.5 text-[12.5px] font-semibold text-slate-800">{d.nama}</p>
              <select
                className={`${selectCls} w-full`}
                value={rows[d.id]?.level ?? 2}
                disabled={!bisaTulis}
                onChange={(e) => {
                  const level = Number(e.target.value) as LevelDpl
                  setRows((r) => ({
                    ...r,
                    [d.id]: {
                      level,
                      deskripsi: d.levelDeskripsi[level - 1] || r[d.id]?.deskripsi || '',
                    },
                  }))
                }}
              >
                {DPL_LEVEL_LABEL.map((lab, i) => (
                  <option key={lab} value={i + 1}>
                    {lab}
                  </option>
                ))}
              </select>
              <textarea
                className={`${inputCls} mt-1.5 min-h-[48px]`}
                value={rows[d.id]?.deskripsi ?? ''}
                disabled={!bisaTulis}
                onChange={(e) =>
                  setRows((r) => ({
                    ...r,
                    [d.id]: { ...r[d.id], deskripsi: e.target.value, level: r[d.id]?.level ?? 2 },
                  }))
                }
              />
            </div>
          ))}
          {bisaTulis && (
            <button
              type="button"
              className={btnPrimary}
              disabled={sibuk}
              onClick={() => onSimpan(rows)}
            >
              {sibuk ? 'Menyimpan…' : 'Simpan Nilai DPL Siswa Ini'}
            </button>
          )}
        </div>
      )}
    </li>
  )
}

// ── Tab 7KAIH ────────────────────────────────────────────────────────────────

/** Warna latar sel agar level mudah dipindai; hanya penanda, bukan satu-satunya penanda (ada angka). */
const WARNA_LEVEL_7KAIH: Record<number, string> = {
  1: 'bg-rose-50',
  2: 'bg-amber-50',
  3: 'bg-emerald-50',
  4: 'bg-sky-50',
}

type LevelSiswa = Record<string, Record<string, LevelDpl | null>>

/**
 * 7KAIH — daftar nilai: baris = siswa, kolom = 7 kebiasaan, isi = level 1–4 (skala DPL).
 * Tidak ditautkan ke DPL. Observasi ringkas sekali per semester, bukan jurnal harian.
 */
function Tab7Kaih({
  kelas,
  periode,
  labelPeriode,
  bisaTulis,
  profile,
  toast,
}: {
  kelas: string
  periode: { tahunAjaran: string; semester: '1' | '2' }
  labelPeriode: string
  bisaTulis: boolean
  profile: AppUser
  toast: { show: (m: string, err?: boolean) => void }
}) {
  const [siswa, setSiswa] = useState<SiswaTahsin[] | null>(null)
  // Data dari database (termasuk catatan/dplId lama, dipertahankan saat menyimpan).
  const [tersimpan, setTersimpan] = useState<Record<string, Record<string, CatatanKebiasaan>>>({})
  const [level, setLevel] = useState<LevelSiswa>({})
  const [ubah, setUbah] = useState<Set<string>>(new Set())
  const [galat, setGalat] = useState('')
  const [sibuk, setSibuk] = useState(false)

  const muat = useCallback(async () => {
    setGalat('')
    try {
      const [s, g] = await Promise.all([
        getSiswaList(kelas, { role: profile.role, kelasAmpu: [kelas] }),
        getG7kaihByKelas(kelas, periode),
      ])
      const simpanan: Record<string, Record<string, CatatanKebiasaan>> = {}
      const lv: LevelSiswa = {}
      for (const [sid, dok] of Object.entries(g)) {
        simpanan[sid] = dok.kebiasaan
        lv[sid] = {}
        for (const k of DAFTAR_KEBIASAAN_7KAIH) lv[sid][k.id] = dok.kebiasaan[k.id]?.level ?? null
      }
      setSiswa(s)
      setTersimpan(simpanan)
      setLevel(lv)
      setUbah(new Set())
    } catch (e) {
      console.error(e)
      setGalat('Gagal memuat 7KAIH. Pastikan rules g7kaih sudah di-deploy.')
      setSiswa([])
    }
  }, [kelas, periode, profile.role])

  useEffect(() => {
    void muat()
  }, [muat])

  function ambil(siswaId: string, kebiasaanId: string): LevelDpl | null {
    return level[siswaId]?.[kebiasaanId] ?? null
  }

  function setNilai(siswaId: string, kebiasaanId: string, v: LevelDpl | null) {
    setLevel((prev) => ({ ...prev, [siswaId]: { ...(prev[siswaId] || {}), [kebiasaanId]: v } }))
    setUbah((prev) => new Set(prev).add(siswaId))
  }

  /**
   * Atur seluruh kolom satu kebiasaan: v = level (menimpa isian yang ada) atau null (kosongkan).
   * Hanya siswa yang nilainya benar-benar berubah yang ditandai berubah.
   */
  function aturKolom(kebiasaanId: string, v: LevelDpl | null) {
    const target = (siswa || []).filter((s) => ambil(s.id, kebiasaanId) !== v)
    if (!target.length) return
    setLevel((prev) => {
      const next = { ...prev }
      for (const s of target) next[s.id] = { ...(next[s.id] || {}), [kebiasaanId]: v }
      return next
    })
    setUbah((prev) => {
      const next = new Set(prev)
      for (const s of target) next.add(s.id)
      return next
    })
  }

  async function simpan() {
    const daftar = (siswa || []).filter((s) => ubah.has(s.id))
    if (!daftar.length) {
      toast.show('Belum ada perubahan untuk disimpan.')
      return
    }
    setSibuk(true)
    try {
      await simpanG7kaihBanyak({
        kelas,
        semester: periode.semester,
        tahunAjaran: periode.tahunAjaran,
        items: daftar.map((s) => {
          const kebiasaan: Record<string, CatatanKebiasaan> = {}
          for (const k of DAFTAR_KEBIASAAN_7KAIH) {
            kebiasaan[k.id] = { ...(tersimpan[s.id]?.[k.id] || {}), level: ambil(s.id, k.id) }
          }
          return { siswaId: s.id, kebiasaan }
        }),
      })
      toast.show(`7KAIH tersimpan untuk ${daftar.length} siswa.`)
      await muat()
    } catch (e) {
      console.error(e)
      toast.show('Gagal menyimpan 7KAIH.', true)
    } finally {
      setSibuk(false)
    }
  }

  if (siswa === null) return <Spinner />
  if (galat) return <Notice tone="error">{galat}</Notice>

  const totalKebiasaan = DAFTAR_KEBIASAAN_7KAIH.length
  const jumlahTerisi = (siswaId: string) =>
    DAFTAR_KEBIASAAN_7KAIH.filter((k) => ambil(siswaId, k.id) !== null).length

  return (
    <div className="space-y-3">
      <p className="text-[12px] text-muted">
        Observasi ringkas sekali per semester ({labelPeriode}), bukan jurnal harian. Pembiasaan dinilai
        dengan 4 level, tidak dikaitkan dengan DPL. Bangun Pagi, Makan Sehat, dan Tidur Cepat sulit
        diverifikasi sehingga boleh dikosongkan. Menu "Atur semua" di atas tiap kolom menimpa seluruh
        isian kolom itu (atau mengosongkannya); perubahan baru tersimpan setelah tombol Simpan.
      </p>
      <p className="text-[11.5px] text-slate-600">
        {DPL_LEVEL_LABEL.map((lab, i) => `${i + 1} = ${lab}`).join(' · ')}
      </p>

      {siswa.length === 0 ? (
        <Notice tone="info">Belum ada data siswa di kelas ini.</Notice>
      ) : (
                <div className="overflow-x-auto rounded-xl border border-border bg-white shadow-sm">
          <table className="w-full min-w-[56rem] border-separate border-spacing-0 text-left text-[12.5px]">
            <thead className="bg-slate-50 text-[11px] font-semibold text-slate-600">
              <tr>
                <th className="sticky left-0 z-20 min-w-[11rem] max-w-[14rem] border-b border-border bg-slate-50 px-3 py-3 align-bottom shadow-[2px_0_4px_-2px_rgba(0,0,0,0.06)]">
                  Siswa
                </th>
                {DAFTAR_KEBIASAAN_7KAIH.map((k) => {
                  const sulit = (KEBIASAAN_SULIT_VERIFIKASI_7KAIH as readonly string[]).includes(k.id)
                  return (
                    <th
                      key={k.id}
                      className="min-w-[7rem] border-b border-border px-2.5 py-2.5 align-top text-center"
                    >
                      <span className="mx-auto flex min-h-[2.5rem] max-w-[6.5rem] items-end justify-center text-center text-[11px] font-semibold leading-snug text-slate-700">
                        {k.label}
                      </span>
                      <span className="mt-0.5 block h-4 text-[10px] font-normal leading-4 text-muted">
                        {sulit ? 'boleh kosong' : '\u00A0'}
                      </span>
                      {bisaTulis && (
                        <div className="mx-auto mt-1.5 w-full max-w-[6.25rem]">
                          <select
                            className={`${selectCls} w-full px-1.5 py-1 text-center text-[11px] font-normal`}
                            value=""
                            aria-label={`Atur seluruh kolom ${k.label}`}
                            title="Atur seluruh kolom (menimpa isian yang ada)"
                            onChange={(e) => {
                              const val = e.target.value
                              if (val === 'kosong') aturKolom(k.id, null)
                              else if (['1', '2', '3', '4'].includes(val)) aturKolom(k.id, Number(val) as LevelDpl)
                            }}
                          >
                            <option value="">Atur semua…</option>
                            {DPL_LEVEL_LABEL.map((lab, i) => (
                              <option key={lab} value={i + 1}>
                                Semua {i + 1}
                              </option>
                            ))}
                            <option value="kosong">Kosongkan</option>
                          </select>
                        </div>
                      )}
                    </th>
                  )
                })}
                <th className="min-w-[3.5rem] border-b border-border px-3 py-3 text-center align-bottom">
                  Terisi
                </th>
              </tr>
            </thead>
            <tbody>
              {siswa.map((sw) => {
                const terisi = jumlahTerisi(sw.id)
                return (
                  <tr key={sw.id} className="group border-t border-border transition-colors hover:bg-slate-50/80">
                    <td className="sticky left-0 z-10 max-w-[14rem] truncate border-b border-border/60 bg-white px-3 py-2 font-medium text-slate-800 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.06)] group-hover:bg-slate-50/80">
                      {sw.nama}
                      {ubah.has(sw.id) && <span className="ml-1.5 text-[10px] text-amber-700">●</span>}
                    </td>
                    {DAFTAR_KEBIASAAN_7KAIH.map((k) => {
                      const v = ambil(sw.id, k.id)
                      return (
                        <td key={k.id} className="border-b border-border/60 px-2.5 py-1.5 text-center">
                          <div className="mx-auto w-full max-w-[6.25rem]">
                            <select
                              className={`${selectCls} w-full px-1.5 py-1.5 text-center ${v ? WARNA_LEVEL_7KAIH[v] : ''}`}
                              value={v ?? ''}
                              disabled={!bisaTulis}
                              aria-label={`${k.label} — ${sw.nama}`}
                              title={v ? DPL_LEVEL_LABEL[v - 1] : 'Belum diisi'}
                              onChange={(e) => {
                                const n = Number(e.target.value)
                                setNilai(sw.id, k.id, n >= 1 && n <= 4 ? (n as LevelDpl) : null)
                              }}
                            >
                              <option value="">—</option>
                              {DPL_LEVEL_LABEL.map((lab, i) => (
                                <option key={lab} value={i + 1}>
                                  {i + 1}
                                </option>
                              ))}
                            </select>
                          </div>
                        </td>
                      )
                    })}
                    <td className="whitespace-nowrap border-b border-border/60 px-3 py-2 text-center tabular-nums text-slate-600">
                      {terisi}/{totalKebiasaan}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {bisaTulis && siswa.length > 0 && (
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            className={btnPrimary}
            disabled={sibuk || ubah.size === 0}
            onClick={() => void simpan()}
          >
            {sibuk ? 'Menyimpan…' : `Simpan 7KAIH${ubah.size ? ` (${ubah.size} siswa berubah)` : ''}`}
          </button>
          {ubah.size > 0 && (
            <button type="button" className={btnGhost} disabled={sibuk} onClick={() => void muat()}>
              Batalkan perubahan
            </button>
          )}
        </div>
      )}
    </div>
  )
}
