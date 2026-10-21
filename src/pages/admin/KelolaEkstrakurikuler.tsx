import { useCallback, useEffect, useMemo, useState } from 'react'
import { PageHeader } from '../../components/ui'
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
import { bolehGenerateAi, type ProviderAi } from '../../lib/generateAi'
import { auth } from '../../lib/firebase'
import { getFunctions, httpsCallable } from 'firebase/functions'
import { app } from '../../lib/firebase'
import type { AppUser } from '../../types/user'
import type {
  DeskripsiCapaianTemplate,
  EkskulAjukan,
  Ekstrakurikuler,
  PredikatEkskul,
} from '../../types/raporData'
import { PREDIKAT_EKSKUL } from '../../types/raporData'
import { BackLink, Notice, Spinner, btnGhost, btnPrimary, inputCls, selectCls, useToast } from '../akademik/shared'

/**
 * Admin: master ekstrakurikuler + pengampu + template deskripsi capaian (C/B/A).
 * Guru dapat mengajukan diri sebagai pengampu; admin menyetujui dari panel ini.
 */
export default function KelolaEkstrakurikuler({ profile }: { profile?: AppUser }) {
  const [daftar, setDaftar] = useState<Ekstrakurikuler[] | null>(null)
  const [pengajuan, setPengajuan] = useState<EkskulAjukan[]>([])
  const [guruList, setGuruList] = useState<{ uid: string; nama: string; email?: string }[]>([])
  const [nama, setNama] = useState('')
  const [galat, setGalat] = useState('')
  const [sibuk, setSibuk] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const toast = useToast()
  const uid = profile?.uid ?? auth.currentUser?.uid ?? ''
  const bolehAi = bolehGenerateAi(uid)

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
      await simpanEkskulMaster(nama, true)
      setNama('')
      toast.show('Kegiatan ditambahkan.')
      await muat()
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

  const editItem = useMemo(() => daftar?.find((d) => d.id === editId) ?? null, [daftar, editId])

  return (
    <div className="space-y-4">
      <BackLink to="/admin">Administrasi</BackLink>
      <PageHeader
        title="Ekstrakurikuler"
        subtitle="Daftar kegiatan, pengampu, dan template deskripsi capaian untuk rapor SAS. Predikat (C/B/A) hanya internal — yang dicetak adalah deskripsi capaian."
      />

      {/* Tambah kegiatan */}
      <div className="card-soft flex flex-wrap items-end gap-3 p-4">
        <label className="block flex-1 text-[11px] font-medium text-slate-600">
          Nama kegiatan
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
        <div className="card-soft space-y-2 p-4">
          <h3 className="text-[13px] font-semibold text-slate-800">Pengajuan pengampu menunggu persetujuan</h3>
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

      <ul className="space-y-2">
        {daftar?.map((e) => (
          <li key={e.id} className="card-soft px-4 py-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className={`text-[13.5px] ${e.aktif ? 'font-medium text-slate-900' : 'text-slate-400 line-through'}`}>
                {e.nama}
              </span>
              <span className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="text-[12px] font-medium text-muh-700 hover:underline"
                  onClick={() => setEditId(editId === e.id ? null : e.id)}
                >
                  {editId === e.id ? 'Tutup' : 'Kelola'}
                </button>
                <button
                  type="button"
                  className="text-[12px] font-medium text-slate-600 hover:underline"
                  onClick={() => void ubahAktif(e)}
                >
                  {e.aktif ? 'Nonaktifkan' : 'Aktifkan'}
                </button>
              </span>
            </div>
            <p className="mt-0.5 text-[11.5px] text-muted">
              Pengampu: {(e.pengampuUids ?? []).length === 0 ? '—' : `${(e.pengampuUids ?? []).length} guru`}
              {(e.deskripsiCapaian ?? []).length > 0 && ` · ${(e.deskripsiCapaian ?? []).length} template deskripsi`}
              {(e.aktivitas ?? []).length > 0 && ` · ${(e.aktivitas ?? []).length} aktivitas`}
            </p>
            {editId === e.id && editItem && (
              <PanelEditEkskul
                item={editItem}
                guruList={guruList}
                bolehAi={bolehAi}
                onSelesai={async () => {
                  await muat()
                  toast.show('Tersimpan.')
                }}
                onGalat={(m) => toast.show(m, true)}
              />
            )}
          </li>
        ))}
      </ul>

      {/* Ajukan diri (jika profile guru dibuka dari route yang sama — opsional) */}
      {profile && profile.role !== 'admin' && daftar && (
        <PanelAjukanSaya profile={profile} daftar={daftar} onSelesai={muat} toast={toast.show} />
      )}

      {toast.node}
    </div>
  )
}

function PanelEditEkskul({
  item,
  guruList,
  bolehAi,
  onSelesai,
  onGalat,
}: {
  item: Ekstrakurikuler
  guruList: { uid: string; nama: string; email?: string }[]
  bolehAi: boolean
  onSelesai: () => Promise<void>
  onGalat: (m: string) => void
}) {
  const [pilihUid, setPilihUid] = useState('')
  const [aktivitasTeks, setAktivitasTeks] = useState((item.aktivitas ?? []).join('\n'))
  const [templates, setTemplates] = useState<DeskripsiCapaianTemplate[]>(item.deskripsiCapaian ?? [])
  const [provider, setProvider] = useState<ProviderAi>('gemini')
  const [sibuk, setSibuk] = useState(false)
  const [promptExtra, setPromptExtra] = useState('')

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

  async function simpanAktivitas() {
    setSibuk(true)
    try {
      const list = aktivitasTeks
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

  async function simpanTemplate() {
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

  function ubahTemplate(predikat: PredikatEkskul, teks: string) {
    setTemplates((prev) => {
      const lain = prev.filter((t) => t.predikat !== predikat)
      const bersih = teks.trim()
      if (!bersih) return lain
      return [...lain, { predikat, teks: bersih }].sort(
        (a, b) => PREDIKAT_EKSKUL.indexOf(a.predikat) - PREDIKAT_EKSKUL.indexOf(b.predikat),
      )
    })
  }

  async function generateAi(mode: 'deskripsi' | 'aktivitas' | 'keduanya') {
    if (!bolehAi) return onGalat('Fitur AI tidak tersedia untuk akun ini.')
    setSibuk(true)
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
      })
      if (res.data.aktivitas?.length) {
        setAktivitasTeks(res.data.aktivitas.join('\n'))
      }
      if (res.data.deskripsi?.length) {
        setTemplates(res.data.deskripsi)
      }
    } catch (e) {
      console.error(e)
      onGalat(
        e instanceof Error && e.message
          ? e.message
          : 'Gagal generate AI. Pastikan Cloud Function generateEkskulAi sudah di-deploy.',
      )
    } finally {
      setSibuk(false)
    }
  }

  const namaPengampu = (uid: string) => guruList.find((g) => g.uid === uid)?.nama ?? uid.slice(0, 8)

  return (
    <div className="mt-3 space-y-4 border-t border-border pt-3">
      {/* Pengampu */}
      <div>
        <h4 className="mb-1 text-[12px] font-semibold text-slate-700">Pengampu</h4>
        <ul className="mb-2 space-y-1">
          {(item.pengampuUids ?? []).map((uid) => (
            <li key={uid} className="flex items-center justify-between text-[12.5px]">
              <span>{namaPengampu(uid)}</span>
              <button type="button" className="text-red-700 hover:underline" disabled={sibuk} onClick={() => void lepasGuru(uid)}>
                Lepas
              </button>
            </li>
          ))}
          {(item.pengampuUids ?? []).length === 0 && <li className="text-[12px] text-muted">Belum ada pengampu.</li>}
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
          <button type="button" className={btnGhost} disabled={!pilihUid || sibuk} onClick={() => void tambahGuru()}>
            Tambah pengampu
          </button>
        </div>
      </div>

      {/* Aktivitas */}
      <div>
        <h4 className="mb-1 text-[12px] font-semibold text-slate-700">Daftar aktivitas (satu baris per aktivitas)</h4>
        <textarea
          rows={4}
          className={`${inputCls} font-normal`}
          value={aktivitasTeks}
          onChange={(e) => setAktivitasTeks(e.target.value)}
          placeholder="Contoh:&#10;Latihan baris-berbaris&#10;Upacara bendera&#10;Perkemahan Sabtu-Minggu"
        />
        <button type="button" className={`${btnGhost} mt-1`} disabled={sibuk} onClick={() => void simpanAktivitas()}>
          Simpan aktivitas
        </button>
      </div>

      {/* Template deskripsi C/B/A */}
      <div>
        <h4 className="mb-1 text-[12px] font-semibold text-slate-700">
          Template deskripsi capaian (predikat C / B / A — tidak dicetak di rapor)
        </h4>
        <div className="space-y-2">
          {PREDIKAT_EKSKUL.map((p) => (
            <label key={p} className="block text-[11px] font-medium text-slate-600">
              Predikat {p} ({p === 'A' ? 'Mahir' : p === 'B' ? 'Cakap' : 'Layak'})
              <textarea
                rows={2}
                maxLength={500}
                className={`${inputCls} mt-0.5 font-normal`}
                value={templates.find((t) => t.predikat === p)?.teks ?? ''}
                onChange={(e) => ubahTemplate(p, e.target.value)}
                placeholder={`Deskripsi capaian untuk predikat ${p}…`}
              />
            </label>
          ))}
        </div>
        <button type="button" className={`${btnGhost} mt-1`} disabled={sibuk} onClick={() => void simpanTemplate()}>
          Simpan template deskripsi
        </button>
      </div>

      {/* AI generate */}
      {bolehAi && (
        <div className="rounded-lg border border-dashed border-muh-200 bg-muh-50/40 p-3">
          <h4 className="mb-1 text-[12px] font-semibold text-slate-700">Generate dengan AI</h4>
          <p className="mb-2 text-[11px] text-muted">
            Menghasilkan usulan aktivitas dan/atau deskripsi capaian C/B/A. Hasil bisa diedit sebelum disimpan.
          </p>
          <div className="mb-2 flex flex-wrap gap-2">
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
            <button type="button" className={btnGhost} disabled={sibuk} onClick={() => void generateAi('deskripsi')}>
              Generate deskripsi C/B/A
            </button>
            <button type="button" className={btnGhost} disabled={sibuk} onClick={() => void generateAi('aktivitas')}>
              Generate aktivitas
            </button>
            <button type="button" className={btnGhost} disabled={sibuk} onClick={() => void generateAi('keduanya')}>
              Generate keduanya
            </button>
          </div>
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
