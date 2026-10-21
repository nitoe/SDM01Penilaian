import { useCallback, useEffect, useMemo, useState } from 'react'
import { PageHeader } from '../../components/ui'
import Tabs, { type TabItem } from '../../components/Tabs'
import {
  ajukanPengampu,
  getEkskulMasterLengkap,
  getPengajuanPending,
  hapusPengampu,
  setujuiPengajuan,
  simpanAktivitasEkskul,
  simpanDeskripsiCapaian,
  simpanEkskulMaster,
  tambahPengampu,
  tolakPengajuan,
} from '../../lib/ekskul'
import { listAkunStaf } from '../../lib/akunGuruData'
import { type ProviderAi } from '../../lib/generateAi'
import { getFunctions, httpsCallable } from 'firebase/functions'
import { app } from '../../lib/firebase'
import { isAdminRole } from '../../lib/roles'
import type { AppUser } from '../../types/user'
import type {
  DeskripsiCapaianTemplate,
  EkskulAjukan,
  Ekstrakurikuler,
  PredikatEkskul,
} from '../../types/raporData'
import { PREDIKAT_EKSKUL } from '../../types/raporData'
import { BackLink, Notice, Spinner, btnGhost, btnPrimary, inputCls, selectCls, useToast } from '../akademik/shared'

type TabId = 'pengampu' | 'aktivitas' | 'deskripsi' | 'ai'

/**
 * Admin: master ekstrakurikuler + pengampu + template deskripsi capaian (C/B/A).
 * Layout: daftar kegiatan di kiri, detail bertab di kanan (tidak menumpuk).
 * Generate AI hanya tampil untuk role admin.
 */
export default function KelolaEkstrakurikuler({ profile }: { profile?: AppUser }) {
  const [daftar, setDaftar] = useState<Ekstrakurikuler[] | null>(null)
  const [pengajuan, setPengajuan] = useState<EkskulAjukan[]>([])
  const [guruList, setGuruList] = useState<{ uid: string; nama: string; email?: string }[]>([])
  const [nama, setNama] = useState('')
  const [galat, setGalat] = useState('')
  const [sibuk, setSibuk] = useState(false)
  const [pilihId, setPilihId] = useState<string | null>(null)
  const [tab, setTab] = useState<TabId>('pengampu')
  const toast = useToast()

  /** Tombol & panel Generate AI hanya untuk akun admin. */
  const bolehAi = Boolean(profile && isAdminRole(profile.role))

  const muat = useCallback(async () => {
    setGalat('')
    try {
      const [d, p, users] = await Promise.all([
        getEkskulMasterLengkap(),
        getPengajuanPending().catch(() => [] as EkskulAjukan[]),
        listAkunStaf().catch(() => []),
      ])
      setDaftar(d)
      setPengajuan(p)
      setGuruList(
        users
          .filter((u) => u.aktif !== false)
          .map((u) => ({ uid: u.uid, nama: u.nama || u.email || u.uid, email: u.email })),
      )
      setPilihId((prev) => {
        if (prev && d.some((x) => x.id === prev)) return prev
        return d[0]?.id ?? null
      })
    } catch {
      setGalat('Gagal memuat daftar. Pastikan rules terbaru sudah di-deploy.')
    }
  }, [])
  useEffect(() => {
    void muat()
  }, [muat])

  async function tambah() {
    if (!nama.trim()) return
    setSibuk(true)
    try {
      const id = await simpanEkskulMaster(nama, true)
      setNama('')
      toast.show('Kegiatan ditambahkan.')
      await muat()
      if (typeof id === 'string') setPilihId(id)
    } catch {
      toast.show('Gagal menyimpan.', true)
    } finally {
      setSibuk(false)
    }
  }

  async function ubahAktif(e: Ekstrakurikuler) {
    try {
      await simpanEkskulMaster(e.nama, !e.aktif)
      await muat()
    } catch {
      toast.show('Gagal mengubah status.', true)
    }
  }

  async function setujui(a: EkskulAjukan) {
    setSibuk(true)
    try {
      await setujuiPengajuan(a)
      toast.show(`${a.namaGuru} disetujui sebagai pengampu ${a.ekskulNama}.`)
      await muat()
    } catch {
      toast.show('Gagal menyetujui.', true)
    } finally {
      setSibuk(false)
    }
  }

  async function tolak(id: string) {
    setSibuk(true)
    try {
      await tolakPengajuan(id)
      toast.show('Pengajuan ditolak.')
      await muat()
    } catch {
      toast.show('Gagal menolak.', true)
    } finally {
      setSibuk(false)
    }
  }

  const item = useMemo(() => daftar?.find((d) => d.id === pilihId) ?? null, [daftar, pilihId])

  const tabItems: TabItem[] = useMemo(() => {
    const base: TabItem[] = [
      { id: 'pengampu', label: 'Pengampu', hitung: item?.pengampuUids?.length ?? null },
      { id: 'aktivitas', label: 'Aktivitas', hitung: item?.aktivitas?.length ?? null },
      { id: 'deskripsi', label: 'Deskripsi C/B/A', hitung: item?.deskripsiCapaian?.length ?? null },
    ]
    if (bolehAi) base.push({ id: 'ai', label: 'Generate AI' })
    return base
  }, [item, bolehAi])

  useEffect(() => {
    if (!bolehAi && tab === 'ai') setTab('pengampu')
  }, [bolehAi, tab])

  return (
    <div className="space-y-4">
      <BackLink to="/admin">Administrasi</BackLink>
      <PageHeader
        title="Ekstrakurikuler"
        subtitle="Daftar kegiatan, pengampu, dan template deskripsi capaian. Predikat C/B/A hanya internal — yang dicetak di rapor adalah deskripsi."
      />

      {/* Tambah kegiatan */}
      <div className="card-soft flex flex-wrap items-end gap-3 p-4">
        <label className="block min-w-[12rem] flex-1 text-[11px] font-medium text-slate-600">
          Nama kegiatan baru
          <input
            className={`${inputCls} mt-1 font-normal`}
            value={nama}
            maxLength={80}
            placeholder="Contoh: Pramuka (Hizbul Wathan)"
            onChange={(e) => setNama(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && void tambah()}
          />
        </label>
        <button type="button" className={btnPrimary} disabled={sibuk || !nama.trim()} onClick={() => void tambah()}>
          Tambah
        </button>
      </div>

      {/* Pengajuan pending */}
      {pengajuan.length > 0 && (
        <div className="card-soft space-y-2 border border-amber-200 bg-amber-50/40 p-4">
          <h3 className="text-[13px] font-semibold text-slate-800">
            Pengajuan pengampu ({pengajuan.length})
          </h3>
          <ul className="divide-y divide-border">
            {pengajuan.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-[13px]">
                <span>
                  <span className="font-medium">{a.namaGuru}</span>
                  <span className="text-muted"> → {a.ekskulNama}</span>
                </span>
                <span className="flex gap-2">
                  <button type="button" className={btnPrimary} disabled={sibuk} onClick={() => void setujui(a)}>
                    Setujui
                  </button>
                  <button type="button" className={btnGhost} disabled={sibuk} onClick={() => void tolak(a.id)}>
                    Tolak
                  </button>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {galat && <Notice tone="error">{galat}</Notice>}
      {!galat && daftar === null && <Spinner />}
      {daftar && daftar.length === 0 && <Notice>Belum ada kegiatan. Tambahkan yang pertama di atas.</Notice>}

      {/* Layout dua kolom: daftar | detail bertab */}
      {daftar && daftar.length > 0 && (
        <div className="grid gap-4 lg:grid-cols-[minmax(14rem,20rem)_1fr]">
          {/* Daftar kegiatan */}
          <div className="card-soft overflow-hidden">
            <p className="border-b border-border bg-slate-50 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              Daftar kegiatan
            </p>
            <ul className="max-h-[28rem] divide-y divide-border overflow-y-auto">
              {daftar.map((e) => {
                const aktif = e.id === pilihId
                return (
                  <li key={e.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setPilihId(e.id)
                        setTab('pengampu')
                      }}
                      className={`flex w-full flex-col items-start gap-0.5 px-3 py-2.5 text-left transition-colors ${
                        aktif ? 'bg-muh-50/80' : 'hover:bg-slate-50'
                      }`}
                    >
                      <span
                        className={`text-[13.5px] ${
                          e.aktif
                            ? aktif
                              ? 'font-semibold text-muh-900'
                              : 'font-medium text-slate-900'
                            : 'text-slate-400 line-through'
                        }`}
                      >
                        {e.nama}
                      </span>
                      <span className="text-[11px] text-muted">
                        {(e.pengampuUids ?? []).length} pengampu
                        {(e.aktivitas ?? []).length > 0 ? ` · ${(e.aktivitas ?? []).length} aktivitas` : ''}
                        {(e.deskripsiCapaian ?? []).length > 0
                          ? ` · ${(e.deskripsiCapaian ?? []).length} template`
                          : ''}
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          </div>

          {/* Detail bertab */}
          <div className="card-soft min-w-0 p-4">
            {!item ? (
              <Notice>Pilih kegiatan di daftar kiri.</Notice>
            ) : (
              <div className="space-y-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h2 className="text-[16px] font-semibold text-slate-900">{item.nama}</h2>
                    <p className="text-[12px] text-muted">
                      {item.aktif ? 'Aktif — muncul di pilihan guru' : 'Nonaktif — disembunyikan dari pilihan'}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="text-[12px] font-medium text-muh-700 hover:underline"
                    onClick={() => void ubahAktif(item)}
                  >
                    {item.aktif ? 'Nonaktifkan' : 'Aktifkan'}
                  </button>
                </div>

                <Tabs
                  items={tabItems}
                  aktif={tab}
                  onUbah={(id) => setTab(id as TabId)}
                  ariaLabel="Kelola kegiatan ekstrakurikuler"
                >
                  {tab === 'pengampu' && (
                    <PanelPengampu
                      item={item}
                      guruList={guruList}
                      sibuk={sibuk}
                      setSibuk={setSibuk}
                      onSelesai={async () => {
                        await muat()
                        toast.show('Tersimpan.')
                      }}
                      onGalat={(m) => toast.show(m, true)}
                    />
                  )}
                  {tab === 'aktivitas' && (
                    <PanelAktivitas
                      item={item}
                      sibuk={sibuk}
                      setSibuk={setSibuk}
                      onSelesai={async () => {
                        await muat()
                        toast.show('Aktivitas tersimpan.')
                      }}
                      onGalat={(m) => toast.show(m, true)}
                    />
                  )}
                  {tab === 'deskripsi' && (
                    <PanelDeskripsi
                      item={item}
                      sibuk={sibuk}
                      setSibuk={setSibuk}
                      onSelesai={async () => {
                        await muat()
                        toast.show('Template deskripsi tersimpan.')
                      }}
                      onGalat={(m) => toast.show(m, true)}
                    />
                  )}
                  {tab === 'ai' && bolehAi && (
                    <PanelAi
                      item={item}
                      sibuk={sibuk}
                      setSibuk={setSibuk}
                      onHasil={async (hasil) => {
                        try {
                          if (hasil.aktivitas?.length) {
                            await simpanAktivitasEkskul(item.id, hasil.aktivitas)
                          }
                          if (hasil.deskripsi?.length) {
                            await simpanDeskripsiCapaian(item.id, hasil.deskripsi)
                          }
                          await muat()
                          toast.show('Hasil AI diterapkan. Periksa tab Aktivitas dan Deskripsi.')
                          if (hasil.deskripsi?.length) setTab('deskripsi')
                          else if (hasil.aktivitas?.length) setTab('aktivitas')
                        } catch {
                          toast.show('Gagal menyimpan hasil AI.', true)
                        }
                      }}
                      onGalat={(m) => toast.show(m, true)}
                    />
                  )}
                </Tabs>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Ajukan diri (jika profile bukan admin — jarang di halaman ini) */}
      {profile && !isAdminRole(profile.role) && daftar && (
        <PanelAjukanSaya profile={profile} daftar={daftar} onSelesai={muat} toast={toast.show} />
      )}

      {toast.node}
    </div>
  )
}

function PanelPengampu({
  item,
  guruList,
  sibuk,
  setSibuk,
  onSelesai,
  onGalat,
}: {
  item: Ekstrakurikuler
  guruList: { uid: string; nama: string; email?: string }[]
  sibuk: boolean
  setSibuk: (v: boolean) => void
  onSelesai: () => Promise<void>
  onGalat: (m: string) => void
}) {
  const [pilihUid, setPilihUid] = useState('')
  const namaPengampu = (uid: string) => guruList.find((g) => g.uid === uid)?.nama ?? uid.slice(0, 8)

  async function tambahGuru() {
    if (!pilihUid) return
    setSibuk(true)
    try {
      await tambahPengampu(item.id, pilihUid)
      setPilihUid('')
      await onSelesai()
    } catch {
      onGalat('Gagal menambah pengampu.')
    } finally {
      setSibuk(false)
    }
  }

  async function lepasGuru(uid: string) {
    setSibuk(true)
    try {
      await hapusPengampu(item.id, uid)
      await onSelesai()
    } catch {
      onGalat('Gagal melepas pengampu.')
    } finally {
      setSibuk(false)
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-[12px] text-muted">
        Guru yang terdaftar di sini dapat menginput nilai ekstrakurikuler kegiatan ini untuk semua kelas.
      </p>
      <ul className="space-y-1">
        {(item.pengampuUids ?? []).map((uid) => (
          <li key={uid} className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-[13px]">
            <span className="font-medium text-slate-800">{namaPengampu(uid)}</span>
            <button type="button" className="text-[12px] font-medium text-red-700 hover:underline" disabled={sibuk} onClick={() => void lepasGuru(uid)}>
              Lepas
            </button>
          </li>
        ))}
        {(item.pengampuUids ?? []).length === 0 && (
          <li className="text-[12.5px] text-muted">Belum ada pengampu. Tambahkan dari daftar di bawah atau setujui pengajuan guru.</li>
        )}
      </ul>
      <div className="flex flex-wrap gap-2">
        <select className={`${selectCls} min-w-48`} value={pilihUid} onChange={(e) => setPilihUid(e.target.value)}>
          <option value="">— Pilih guru —</option>
          {guruList
            .filter((g) => !(item.pengampuUids ?? []).includes(g.uid))
            .map((g) => (
              <option key={g.uid} value={g.uid}>
                {g.nama}
              </option>
            ))}
        </select>
        <button type="button" className={btnPrimary} disabled={!pilihUid || sibuk} onClick={() => void tambahGuru()}>
          Tambah pengampu
        </button>
      </div>
    </div>
  )
}

function PanelAktivitas({
  item,
  sibuk,
  setSibuk,
  onSelesai,
  onGalat,
}: {
  item: Ekstrakurikuler
  sibuk: boolean
  setSibuk: (v: boolean) => void
  onSelesai: () => Promise<void>
  onGalat: (m: string) => void
}) {
  const [teks, setTeks] = useState((item.aktivitas ?? []).join('\n'))
  useEffect(() => {
    setTeks((item.aktivitas ?? []).join('\n'))
  }, [item.id, item.aktivitas])

  async function simpan() {
    setSibuk(true)
    try {
      const list = teks
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean)
      await simpanAktivitasEkskul(item.id, list)
      await onSelesai()
    } catch {
      onGalat('Gagal menyimpan aktivitas.')
    } finally {
      setSibuk(false)
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-[12px] text-muted">Satu baris per aktivitas. Ini hanya KONTEKS untuk menyusun deskripsi capaian (bukan pilihan nilai oleh guru).</p>
      <textarea
        rows={8}
        className={`${inputCls} font-normal`}
        value={teks}
        onChange={(e) => setTeks(e.target.value)}
        placeholder={'Contoh:\nLatihan baris-berbaris\nUpacara bendera\nPerkemahan Sabtu-Minggu'}
      />
      <button type="button" className={btnPrimary} disabled={sibuk} onClick={() => void simpan()}>
        Simpan aktivitas
      </button>
    </div>
  )
}

function PanelDeskripsi({
  item,
  sibuk,
  setSibuk,
  onSelesai,
  onGalat,
}: {
  item: Ekstrakurikuler
  sibuk: boolean
  setSibuk: (v: boolean) => void
  onSelesai: () => Promise<void>
  onGalat: (m: string) => void
}) {
  const [templates, setTemplates] = useState<DeskripsiCapaianTemplate[]>(item.deskripsiCapaian ?? [])
  useEffect(() => {
    setTemplates(item.deskripsiCapaian ?? [])
  }, [item.id, item.deskripsiCapaian])

  function ubah(predikat: PredikatEkskul, teks: string) {
    setTemplates((prev) => {
      const lain = prev.filter((t) => t.predikat !== predikat)
      const bersih = teks.trim()
      if (!bersih) return lain
      return [...lain, { predikat, teks: bersih }].sort(
        (a, b) => PREDIKAT_EKSKUL.indexOf(a.predikat) - PREDIKAT_EKSKUL.indexOf(b.predikat),
      )
    })
  }

  async function simpan() {
    setSibuk(true)
    try {
      await simpanDeskripsiCapaian(item.id, templates)
      await onSelesai()
    } catch {
      onGalat('Gagal menyimpan template deskripsi.')
    } finally {
      setSibuk(false)
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-[12px] text-muted">
        Predikat C/B/A tidak dicetak di rapor. Deskripsi harus selaras dengan daftar aktivitas di atas. Guru hanya memilih predikat; deskripsi terisi otomatis.
      </p>
      {PREDIKAT_EKSKUL.map((p) => (
        <label key={p} className="block text-[11px] font-medium text-slate-600">
          Predikat {p} ({p === 'A' ? 'Mahir' : p === 'B' ? 'Cakap' : 'Layak'})
          <textarea
            rows={3}
            maxLength={500}
            className={`${inputCls} mt-1 font-normal`}
            value={templates.find((t) => t.predikat === p)?.teks ?? ''}
            onChange={(e) => ubah(p, e.target.value)}
            placeholder={`Deskripsi capaian untuk predikat ${p}…`}
          />
        </label>
      ))}
      <button type="button" className={btnPrimary} disabled={sibuk} onClick={() => void simpan()}>
        Simpan template deskripsi
      </button>
    </div>
  )
}

function PanelAi({
  item,
  sibuk,
  setSibuk,
  onHasil,
  onGalat,
}: {
  item: Ekstrakurikuler
  sibuk: boolean
  setSibuk: (v: boolean) => void
  onHasil: (h: { aktivitas?: string[]; deskripsi?: DeskripsiCapaianTemplate[] }) => Promise<void>
  onGalat: (m: string) => void
}) {
  const [provider, setProvider] = useState<ProviderAi>('gemini')
  const [promptExtra, setPromptExtra] = useState('')
  const [pratinjau, setPratinjau] = useState<{
    aktivitas?: string[]
    deskripsi?: DeskripsiCapaianTemplate[]
  } | null>(null)

  async function generate(mode: 'deskripsi' | 'aktivitas' | 'keduanya') {
    setSibuk(true)
    setPratinjau(null)
    try {
      const panggil = httpsCallable<
        { provider: ProviderAi; namaEkskul: string; mode: string; catatan?: string },
        { aktivitas?: string[]; deskripsi?: DeskripsiCapaianTemplate[] }
      >(getFunctions(app, 'asia-southeast2'), 'generateEkskulAi')
      const res = await panggil({
        provider,
        namaEkskul: item.nama,
        mode,
        catatan: promptExtra.trim() || undefined,
        aktivitasAda: item.aktivitas ?? [],
      })
      setPratinjau(res.data)
    } catch (e) {
      console.error(e)
      onGalat(
        e instanceof Error && e.message
          ? e.message
          : 'Gagal generate AI. Pastikan Cloud Function generateEkskulAi sudah di-deploy dan akun Anda berhak.',
      )
    } finally {
      setSibuk(false)
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-[12px] text-muted">
        Hanya akun <strong>admin</strong>. AI mengusulkan aktivitas dan/atau deskripsi C/B/A. Periksa pratinjau sebelum menerapkan.
      </p>
      <div className="flex flex-wrap gap-2">
        <select className={selectCls} value={provider} onChange={(e) => setProvider(e.target.value as ProviderAi)}>
          <option value="gemini">Gemini</option>
          <option value="openai">OpenAI</option>
        </select>
        <input
          className={`${inputCls} min-w-48 flex-1`}
          placeholder="Catatan tambahan untuk AI (opsional)"
          value={promptExtra}
          onChange={(e) => setPromptExtra(e.target.value)}
        />
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="button" className={btnGhost} disabled={sibuk} onClick={() => void generate('deskripsi')}>
          Generate deskripsi C/B/A
        </button>
        <button type="button" className={btnGhost} disabled={sibuk} onClick={() => void generate('aktivitas')}>
          Generate aktivitas
        </button>
        <button type="button" className={btnPrimary} disabled={sibuk} onClick={() => void generate('keduanya')}>
          {sibuk ? 'Memproses…' : 'Generate keduanya'}
        </button>
      </div>

      {pratinjau && (
        <div className="space-y-2 rounded-lg border border-muh-200 bg-muh-50/30 p-3">
          <p className="text-[12px] font-semibold text-slate-800">Pratinjau hasil AI</p>
          {pratinjau.aktivitas && pratinjau.aktivitas.length > 0 && (
            <div>
              <p className="text-[11px] font-medium text-slate-600">Aktivitas</p>
              <ul className="list-inside list-disc text-[12.5px] text-slate-800">
                {pratinjau.aktivitas.map((a) => (
                  <li key={a}>{a}</li>
                ))}
              </ul>
            </div>
          )}
          {pratinjau.deskripsi && pratinjau.deskripsi.length > 0 && (
            <div className="space-y-1">
              <p className="text-[11px] font-medium text-slate-600">Deskripsi capaian</p>
              {pratinjau.deskripsi.map((d) => (
                <p key={d.predikat} className="text-[12.5px] text-slate-800">
                  <span className="font-semibold">[{d.predikat}]</span> {d.teks}
                </p>
              ))}
            </div>
          )}
          <button
            type="button"
            className={btnPrimary}
            disabled={sibuk}
            onClick={() => void onHasil(pratinjau)}
          >
            Terapkan ke kegiatan ini
          </button>
        </div>
      )}
    </div>
  )
}

function PanelAjukanSaya({
  profile,
  daftar,
  onSelesai,
  toast,
}: {
  profile: AppUser
  daftar: Ekstrakurikuler[]
  onSelesai: () => Promise<void>
  toast: (t: string, galat?: boolean) => void
}) {
  const [ekskulId, setEkskulId] = useState('')
  const [sibuk, setSibuk] = useState(false)
  const aktif = daftar.filter((d) => d.aktif)

  async function ajukan() {
    const e = aktif.find((x) => x.id === ekskulId)
    if (!e) return
    if ((e.pengampuUids ?? []).includes(profile.uid)) {
      toast('Anda sudah terdaftar sebagai pengampu.', true)
      return
    }
    setSibuk(true)
    try {
      await ajukanPengampu({
        ekskulId: e.id,
        ekskulNama: e.nama,
        uid: profile.uid,
        namaGuru: profile.nama || profile.email || profile.uid,
      })
      toast('Pengajuan terkirim. Menunggu persetujuan admin.')
      setEkskulId('')
      await onSelesai()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Gagal mengajukan.', true)
    } finally {
      setSibuk(false)
    }
  }

  return (
    <div className="card-soft space-y-2 p-4">
      <h3 className="text-[13px] font-semibold text-slate-800">Ajukan diri sebagai pengampu</h3>
      <div className="flex flex-wrap gap-2">
        <select className={`${selectCls} min-w-48`} value={ekskulId} onChange={(ev) => setEkskulId(ev.target.value)}>
          <option value="">— Pilih kegiatan —</option>
          {aktif.map((d) => (
            <option key={d.id} value={d.id}>
              {d.nama}
            </option>
          ))}
        </select>
        <button type="button" className={btnPrimary} disabled={!ekskulId || sibuk} onClick={() => void ajukan()}>
          Ajukan
        </button>
      </div>
    </div>
  )
}
