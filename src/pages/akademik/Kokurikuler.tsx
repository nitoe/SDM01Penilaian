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
  getProyekStemByKelas,
  hapusDpl,
  hapusProyekStem,
  pastikanDplBaku,
  simpanDpl,
  simpanG7kaih,
  simpanNilaiDpl,
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
} from '../../types/kokurikuler'
import {
  DAFTAR_KEBIASAAN_7KAIH,
  DPL_LEVEL_LABEL,
  KEBIASAAN_SULIT_VERIFIKASI_7KAIH,
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

  // Form state
  const [judul, setJudul] = useState('')
  const [tMulai, setTMulai] = useState('')
  const [tSelesai, setTSelesai] = useState('')
  const [jPertemuan, setJPertemuan] = useState('6')
  const [deskripsi, setDeskripsi] = useState('')
  const [scaffolding, setScaffolding] = useState<string[]>([])
  const [daftarNilai, setDaftarNilai] = useState<string[]>([])
  const [ideAi, setIdeAi] = useState('')
  const [providerAi, setProviderAi] = useState<ProviderAi>('gemini')
  const [sibukAi, setSibukAi] = useState(false)
  const [mapelPilih, setMapelPilih] = useState<Record<string, { tpId: string; jenis: 'SLM' | 'SAS' }>>(
    {},
  )
  const [dplPilih, setDplPilih] = useState<string[]>([])
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
      setGalat('Gagal memuat data. Pastikan firestore.rules sudah di-deploy (dpl, proyek_stem, kokurikuler).')
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

  function bukaFormBaru() {
    setEditId(null)
    setJudul('')
    setDeskripsi('')
    setScaffolding([])
    setDaftarNilai([])
    setIdeAi('')
    setTMulai('')
    setTSelesai('')
    setJPertemuan('6')
    setMapelPilih({})
    setDplPilih([])
    setFormBuka(true)
    setIsiNilaiId(null)
  }

  function bukaFormEdit(p: ProyekStem) {
    setEditId(p.id)
    setJudul(p.judul)
    setDeskripsi(p.deskripsi || '')
    setScaffolding([...(p.scaffolding || [])])
    setDaftarNilai([...(p.daftarNilai || [])])
    setIdeAi('')
    setTMulai(p.tanggalMulai)
    setTSelesai(p.tanggalSelesai)
    setJPertemuan(String(p.jumlahPertemuan || ''))
    const mp: Record<string, { tpId: string; jenis: 'SLM' | 'SAS' }> = {}
    for (const m of p.mapelTerlibat) {
      mp[m.mapel] = { tpId: m.tpId, jenis: m.jenisNilai }
      void loadTp(m.mapel)
    }
    setMapelPilih(mp)
    setDplPilih([...p.dplId])
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
    const dplUntukAi = (dpl || []).filter((x) => x.aktif)
    if (dplUntukAi.length < 3) {
      toast.show('Aktifkan minimal 3 DPL di panel Dimensi Profil Lulusan dulu.', true)
      return
    }
    setSibukAi(true)
    try {
      // Muat TP semua mapel kelas (katalog untuk AI)
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
          katalogTp.push({
            id: tp.id,
            mapel: nama,
            namaTp: tp.namaTp || tp.id,
          })
        }
      }
      if (katalogTp.length < 2) {
        toast.show('Belum ada cukup TP di kelas ini. Susun TP di Setup TP dulu.', true)
        return
      }
      const hasil = await generateStemAi({
        provider: providerAi,
        ide: ideAi.trim(),
        kelas,
        katalogTp,
        katalogDpl: dplUntukAi.map((d) => ({ id: d.id, nama: d.nama })),
      })
      setJudul(hasil.judul || '')
      setDeskripsi(hasil.deskripsi || '')
      setJPertemuan(String(hasil.jumlahPertemuan || 6))
      setScaffolding(hasil.scaffolding || [])
      setDaftarNilai(hasil.daftarNilai || [])
      setDplPilih((hasil.dplId || []).slice(0, 4))
      const mp: Record<string, { tpId: string; jenis: 'SLM' | 'SAS' }> = {}
      for (const m of hasil.mapelTerlibat || []) {
        mp[m.mapel] = { tpId: m.tpId, jenis: m.jenisNilai }
        void loadTp(m.mapel)
      }
      setMapelPilih(mp)
      toast.show(
        `AI mengisi proyek: ${hasil.mapelTerlibat?.length || 0} mapel, ${hasil.dplId?.length || 0} DPL. Periksa lalu simpan.`,
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
      toast.show('Judul proyek wajib diisi.', true)
      return
    }
    const mapelTerlibat: MapelTerlibatStem[] = Object.entries(mapelPilih)
      .filter(([, v]) => v.tpId)
      .map(([mapel, v]) => {
        const tp = (tpCache[mapel] || []).find((t) => t.id === v.tpId)
        return {
          mapel,
          tpId: v.tpId,
          namaTp: tp?.namaTp || undefined,
          jenisNilai: v.jenis,
        }
      })
    if (mapelTerlibat.length < 2) {
      toast.show('Pilih minimal 2 mapel dan tautkan masing-masing ke satu TP.', true)
      return
    }
    if (dplPilih.length < 2 || dplPilih.length > 4) {
      toast.show('Pilih 2–4 DPL aktif yang diamati.', true)
      return
    }
    setSibuk(true)
    try {
      await simpanProyekStem({
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
        daftarNilai,
      })
      toast.show('Proyek STEM tersimpan.')
      setFormBuka(false)
      await muat()
    } catch (e) {
      console.error(e)
      toast.show(e instanceof Error ? e.message : 'Gagal menyimpan proyek.', true)
    } finally {
      setSibuk(false)
    }
  }

  async function hapus(id: string) {
    if (!confirm('Hapus proyek STEM ini? Nilai DPL siswa yang terikat tetap ada di database.')) return
    setSibuk(true)
    try {
      await hapusProyekStem(id)
      toast.show('Proyek dihapus.')
      if (isiNilaiId === id) setIsiNilaiId(null)
      await muat()
    } catch {
      toast.show('Gagal menghapus.', true)
    } finally {
      setSibuk(false)
    }
  }

  const dplAktif = (dpl || []).filter((d) => d.aktif)

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

  return (
    <div className="space-y-4">
      <p className="text-[12px] text-muted">
        Semester {labelPeriode}. Observasi DPL terikat ke proyek STEM — bukan nilai mapel.
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
              {(dpl || []).filter((d) => d.aktif).length} aktif dari {(dpl || []).length} · dipakai
              saat merancang proyek
            </p>
          </div>
          <span className="text-[12px] font-medium text-muh-700">{panelDpl ? 'Tutup' : 'Kelola'}</span>
        </button>
        {panelDpl && (
          <div className="space-y-2 border-t border-border px-4 py-3">
            <PanelDpl
              dpl={dpl}
              bisaTulis={bisaTulis}
              onRefresh={muat}
              toast={toast}
            />
          </div>
        )}
      </section>

      {formBuka && bisaTulis && (
        <div className="card-soft space-y-3 border border-muh-200 p-4">
          <h3 className="text-[14px] font-semibold text-slate-900">
            {editId ? 'Edit Proyek STEM' : 'Rancang Proyek STEM Baru'}
          </h3>
          <label className="block text-[11px] font-medium text-slate-600">
            Judul proyek
            <textarea
              className={`${inputCls} mt-1 min-h-[48px]`}
              value={judul}
              onChange={(e) => setJudul(e.target.value)}
              placeholder="mis. Membuat Alat Penjernih Air Sederhana"
            />
          </label>

          {bolehAi && (
            <div className="rounded-xl border border-dashed border-muh-300 bg-muh-50/60 p-3 space-y-2">
              <p className="text-[12.5px] font-semibold text-muh-900">Bantuan AI — rancang dari ide singkat</p>
              <p className="text-[11px] text-muted">
                Tulis ide proyek. AI memilih TP dari database kelas, 3 DPL aktif, menyusun judul, deskripsi,
                scaffolding, dan daftar aspek penilaian. Hasil bisa disunting sebelum disimpan. Tidak menulis nilai mapel.
              </p>
              <textarea
                className={`${inputCls} min-h-[72px]`}
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
                  {sibukAi ? 'AI menyusun…' : 'Isi dengan AI'}
                </button>
              </div>
            </div>
          )}

          <label className="block text-[11px] font-medium text-slate-600">
            Deskripsi proyek
            <textarea
              className={`${inputCls} mt-1 min-h-[72px]`}
              value={deskripsi}
              onChange={(e) => setDeskripsi(e.target.value)}
              placeholder="Tujuan, konteks, dan hasil yang diharapkan…"
            />
          </label>

          <div>
            <p className="mb-1.5 text-[11px] font-medium text-slate-600">
              Mata pelajaran terlibat (minimal 2, tiap mapel tautkan ke satu TP)
            </p>
            <p className="mb-2 text-[11px] text-muted">
              Keterkaitan mapel/TP hanya dokumentasi proyek. Tidak menulis ke nilai SLM/SAS mapel.
            </p>
            <div className="space-y-2">
              {mapelNama.map((nama) => {
                const on = !!mapelPilih[nama]
                return (
                  <div key={nama} className="rounded-lg border border-border bg-white p-2.5">
                    <label className="flex items-center gap-2 text-[13px] font-medium text-slate-800">
                      <input
                        type="checkbox"
                        checked={on}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setMapelPilih((m) => ({ ...m, [nama]: { tpId: '', jenis: 'SLM' } }))
                            void loadTp(nama)
                          } else {
                            setMapelPilih((m) => {
                              const n = { ...m }
                              delete n[nama]
                              return n
                            })
                          }
                        }}
                      />
                      {nama}
                    </label>
                    {on && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        <select
                          className={`${selectCls} min-w-[12rem] flex-1`}
                          value={mapelPilih[nama]?.tpId || ''}
                          onChange={(e) =>
                            setMapelPilih((m) => ({
                              ...m,
                              [nama]: { ...m[nama], tpId: e.target.value },
                            }))
                          }
                        >
                          <option value="">— pilih TP —</option>
                          {(tpCache[nama] || []).map((t) => (
                            <option key={t.id} value={t.id}>
                              {(t.namaTp || t.id).slice(0, 80)}
                            </option>
                          ))}
                        </select>
                        <div className="flex gap-1">
                          {(['SLM', 'SAS'] as const).map((j) => (
                            <button
                              key={j}
                              type="button"
                              className={`rounded-lg px-2.5 py-1.5 text-[11px] font-bold ${
                                mapelPilih[nama]?.jenis === j
                                  ? j === 'SLM'
                                    ? 'bg-sky-600 text-white'
                                    : 'bg-amber-700 text-white'
                                  : 'border border-border bg-white text-slate-600'
                              }`}
                              onClick={() =>
                                setMapelPilih((m) => ({
                                  ...m,
                                  [nama]: { ...m[nama], jenis: j },
                                }))
                              }
                            >
                              {j}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          <div>
            <p className="mb-1.5 text-[11px] font-medium text-slate-600">
              DPL yang diamati (pilih 2–4 yang aktif)
            </p>
            {dplAktif.length < 2 && (
              <Notice tone="warn">
                Aktifkan minimal 2 DPL di panel Dimensi Profil Lulusan sebelum merancang proyek.
              </Notice>
            )}
            <div className="mt-2 flex flex-wrap gap-2">
              {dplAktif.map((d) => {
                const on = dplPilih.includes(d.id)
                return (
                  <button
                    key={d.id}
                    type="button"
                    className={`rounded-full px-3 py-1.5 text-[12px] font-semibold ${
                      on ? 'bg-amber-100 text-amber-900 ring-1 ring-amber-300' : 'bg-slate-100 text-slate-600'
                    }`}
                    onClick={() => {
                      setDplPilih((prev) => {
                        if (on) return prev.filter((x) => x !== d.id)
                        if (prev.length >= 4) return prev
                        return [...prev, d.id]
                      })
                    }}
                  >
                    {d.nama}
                  </button>
                )
              })}
            </div>
          </div>

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
                className={`${inputCls} mt-1`}
                value={jPertemuan}
                onChange={(e) => setJPertemuan(e.target.value)}
              />
            </label>
          </div>


          {(scaffolding.length > 0 || daftarNilai.length > 0) && (
            <div className="grid gap-3 sm:grid-cols-2">
              {scaffolding.length > 0 && (
                <div className="rounded-lg border border-border bg-white p-3">
                  <p className="mb-1.5 text-[11px] font-semibold text-slate-700">Scaffolding (per pertemuan)</p>
                  <ol className="list-decimal space-y-1 pl-4 text-[12px] text-slate-700">
                    {scaffolding.map((s, i) => (
                      <li key={i}>{s}</li>
                    ))}
                  </ol>
                  <button
                    type="button"
                    className="mt-2 text-[11px] font-medium text-muh-700 hover:underline"
                    onClick={() => {
                      const teks = scaffolding.join('\n')
                      const next = prompt('Edit scaffolding (satu baris per pertemuan):', teks)
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
              {daftarNilai.length > 0 && (
                <div className="rounded-lg border border-border bg-white p-3">
                  <p className="mb-1.5 text-[11px] font-semibold text-slate-700">Aspek penilaian yang dapat diisi guru</p>
                  <ul className="list-disc space-y-1 pl-4 text-[12px] text-slate-700">
                    {daftarNilai.map((s, i) => (
                      <li key={i}>{s}</li>
                    ))}
                  </ul>
                  <button
                    type="button"
                    className="mt-2 text-[11px] font-medium text-muh-700 hover:underline"
                    onClick={() => {
                      const teks = daftarNilai.join('\n')
                      const next = prompt('Edit daftar aspek (satu baris per aspek):', teks)
                      if (next != null) {
                        setDaftarNilai(
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

          <div className="flex gap-2">
            <button type="button" className={btnGhost} onClick={() => setFormBuka(false)}>
              Batal
            </button>
            <button type="button" className={btnPrimary} disabled={sibuk} onClick={() => void simpanForm()}>
              {sibuk ? 'Menyimpan…' : 'Simpan Proyek'}
            </button>
          </div>
        </div>
      )}

      {bisaTulis && !formBuka && (
        <button type="button" className={`${btnPrimary} w-full sm:w-auto`} onClick={bukaFormBaru}>
          + Rancang Proyek STEM Baru
        </button>
      )}

      <ul className="space-y-2">
        {proyek.length === 0 && (
          <li className="text-[12.5px] text-muted">Belum ada proyek STEM untuk kelas ini semester ini.</li>
        )}
        {proyek.map((p) => (
          <li key={p.id} className="card-soft space-y-2 p-4">
            <p className="text-[14px] font-semibold text-slate-900">{p.judul}</p>
            <p className="text-[11.5px] text-muted">
              {p.tanggalMulai || '—'} s/d {p.tanggalSelesai || '—'} · {p.jumlahPertemuan || 0}× pertemuan
            </p>

            {(p.deskripsi || (p.scaffolding && p.scaffolding.length) || (p.daftarNilai && p.daftarNilai.length)) && (
              <div className="space-y-1 text-[11.5px] text-slate-600">
                {p.deskripsi ? <p className="line-clamp-3">{p.deskripsi}</p> : null}
                {p.scaffolding && p.scaffolding.length > 0 ? (
                  <p className="text-muted">{p.scaffolding.length} langkah scaffolding</p>
                ) : null}
                {p.daftarNilai && p.daftarNilai.length > 0 ? (
                  <p className="text-muted">{p.daftarNilai.length} aspek penilaian</p>
                ) : null}
              </div>
            )}
            <div className="flex flex-wrap gap-1.5">
              {p.mapelTerlibat.map((m, i) => (
                <span
                  key={i}
                  className="rounded-full bg-sky-50 px-2.5 py-0.5 text-[10.5px] font-bold text-sky-800"
                >
                  {m.mapel} · {(m.namaTp || m.tpId || 'TP').slice(0, 40)} ({m.jenisNilai})
                </span>
              ))}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {p.dplId.map((id) => {
                const d = dpl.find((x) => x.id === id)
                return (
                  <span
                    key={id}
                    className="rounded-full bg-amber-50 px-2.5 py-0.5 text-[10.5px] font-bold text-amber-900"
                  >
                    {d?.nama || '(DPL tidak aktif)'}
                  </span>
                )
              })}
            </div>
            <div className="flex flex-wrap gap-2 pt-1">
              <button
                type="button"
                className={btnPrimarySm}
                onClick={() => setIsiNilaiId(p.id)}
              >
                Isi Nilai DPL
              </button>
              {bisaTulis && (
                <>
                  <button type="button" className={btnGhostSm} onClick={() => bukaFormEdit(p)}>
                    Edit
                  </button>
                  <button
                    type="button"
                    className={btnDangerGhostSm}
                    disabled={sibuk}
                    onClick={() => void hapus(p.id)}
                  >
                    Hapus
                  </button>
                </>
              )}
            </div>
          </li>
        ))}
      </ul>
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
  const [dpl, setDpl] = useState<Dpl[]>([])
  const [siswa, setSiswa] = useState<SiswaTahsin[] | null>(null)
  const [g7, setG7] = useState<Record<string, { id: string; kebiasaan: Record<string, CatatanKebiasaan> }>>(
    {},
  )
  const [galat, setGalat] = useState('')
  const [openIdx, setOpenIdx] = useState<number | null>(null)
  const [sibuk, setSibuk] = useState(false)

  const muat = useCallback(async () => {
    setGalat('')
    try {
      const [d, s, g] = await Promise.all([
        getDplByKelas(kelas, { hanyaAktif: true }),
        getSiswaList(kelas, { role: profile.role, kelasAmpu: [kelas] }),
        getG7kaihByKelas(kelas, periode),
      ])
      setDpl(d)
      setSiswa(s)
      const map: Record<string, { id: string; kebiasaan: Record<string, CatatanKebiasaan> }> = {}
      for (const [sid, dok] of Object.entries(g)) {
        map[sid] = { id: dok.id, kebiasaan: dok.kebiasaan }
      }
      setG7(map)
    } catch (e) {
      console.error(e)
      setGalat('Gagal memuat 7KAIH. Pastikan rules g7kaih sudah di-deploy.')
      setSiswa([])
    }
  }, [kelas, periode, profile.role])

  useEffect(() => {
    void muat()
  }, [muat])

  async function simpanSiswa(siswaId: string, kebiasaan: Record<string, CatatanKebiasaan>) {
    setSibuk(true)
    try {
      await simpanG7kaih({
        siswaId,
        kelas,
        semester: periode.semester,
        tahunAjaran: periode.tahunAjaran,
        kebiasaan,
      })
      toast.show('7KAIH tersimpan.')
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
  if (dpl.length === 0) {
    return (
      <Notice tone="warn">
        Kelas ini belum punya DPL aktif. Aktifkan DPL di tab Proyek STEM (panel Dimensi Profil
        Lulusan) terlebih dahulu — 7KAIH menautkan tiap kebiasaan ke satu DPL.
      </Notice>
    )
  }

  return (
    <div className="space-y-3">
      <p className="text-[12px] text-muted">
        Observasi ringkas sekali per semester ({labelPeriode}), bukan jurnal harian. Bangun Pagi, Tidur
        Cepat, dan Makan Sehat boleh dikosongkan.
      </p>
      <ul className="space-y-2">
        {siswa.map((sw, i) => {
          const dok = g7[sw.id]
          const terisi = DAFTAR_KEBIASAAN_7KAIH.filter((k) => dok?.kebiasaan?.[k.id]?.catatan).length
          return (
            <li key={sw.id} className="card-soft overflow-hidden">
              <button
                type="button"
                className="flex w-full items-center justify-between px-3.5 py-3 text-left"
                onClick={() => setOpenIdx(openIdx === i ? null : i)}
              >
                <div>
                  <p className="text-[13px] font-semibold text-slate-900">{sw.nama}</p>
                  <p className="text-[11px] text-muted">
                    {terisi}/{DAFTAR_KEBIASAAN_7KAIH.length} kebiasaan ada catatan
                  </p>
                </div>
                <span className="text-[12px] text-muh-700">{openIdx === i ? 'Tutup' : 'Isi'}</span>
              </button>
              {openIdx === i && (
                <Form7KaihSiswa
                  existing={dok?.kebiasaan}
                  dpl={dpl}
                  bisaTulis={bisaTulis}
                  sibuk={sibuk}
                  onSimpan={(keb) => void simpanSiswa(sw.id, keb)}
                />
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function Form7KaihSiswa({
  existing,
  dpl,
  bisaTulis,
  sibuk,
  onSimpan,
}: {
  existing?: Record<string, CatatanKebiasaan>
  dpl: Dpl[]
  bisaTulis: boolean
  sibuk: boolean
  onSimpan: (kebiasaan: Record<string, CatatanKebiasaan>) => void
}) {
  const [keb, setKeb] = useState<Record<string, CatatanKebiasaan>>({})

  useEffect(() => {
    const init: Record<string, CatatanKebiasaan> = {}
    for (const k of DAFTAR_KEBIASAAN_7KAIH) {
      init[k.id] = {
        catatan: existing?.[k.id]?.catatan || '',
        dplId: existing?.[k.id]?.dplId || '',
      }
    }
    setKeb(init)
  }, [existing])

  return (
    <div className="space-y-2 border-t border-border px-3.5 py-3">
      {DAFTAR_KEBIASAAN_7KAIH.map((k) => {
        const sulit = (KEBIASAAN_SULIT_VERIFIKASI_7KAIH as readonly string[]).includes(k.id)
        return (
          <div key={k.id} className="rounded-lg bg-slate-50 p-2.5">
            <p className="text-[12.5px] font-semibold text-slate-800">{k.label}</p>
            {sulit && (
              <p className="mb-1 text-[10.5px] text-muted">
                Sulit diverifikasi langsung — boleh dikosongkan jika belum teramati.
              </p>
            )}
            <textarea
              className={`${inputCls} mt-1 min-h-[44px]`}
              value={keb[k.id]?.catatan ?? ''}
              disabled={!bisaTulis}
              placeholder="Catatan singkat…"
              onChange={(e) =>
                setKeb((prev) => ({
                  ...prev,
                  [k.id]: { ...prev[k.id], catatan: e.target.value, dplId: prev[k.id]?.dplId || '' },
                }))
              }
            />
            <select
              className={`${selectCls} mt-1.5 w-full`}
              value={keb[k.id]?.dplId ?? ''}
              disabled={!bisaTulis}
              onChange={(e) =>
                setKeb((prev) => ({
                  ...prev,
                  [k.id]: { ...prev[k.id], dplId: e.target.value, catatan: prev[k.id]?.catatan || '' },
                }))
              }
            >
              <option value="">— pilih DPL —</option>
              {dpl.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.nama}
                </option>
              ))}
            </select>
          </div>
        )
      })}
      {bisaTulis && (
        <button type="button" className={btnPrimary} disabled={sibuk} onClick={() => onSimpan(keb)}>
          {sibuk ? 'Menyimpan…' : 'Simpan 7KAIH Siswa Ini'}
        </button>
      )}
    </div>
  )
}
