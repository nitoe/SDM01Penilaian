import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import type { AppUser } from '../../types/user'
import type { TipeTp, TujuanPembelajaran } from '../../types/akademik'
import {
  LEVEL_LABEL,
  LEVEL_RANGE_DEFAULT,
  deleteTP,
  faseDariTingkatan,
  getMapelByNama,
  getTPList,
  mapelBerlakuDiTingkatan,
  saveTP,
  validasiLevels,
} from '../../lib/akademik'
import { mapelTingkatanSaya } from '../../lib/penugasan'
import { isGuruAkademikRole } from '../../lib/roles'
import { HeroBanner, Badge } from '../../components/ui'
import {
  BackLink,
  LEVEL_WARNA,
  Notice,
  Spinner,
  btnGhost,
  btnPrimary,
  inputCls,
  useToast,
} from './shared'

interface FormState {
  id?: string
  nomorTp: string
  namaTp: string
  cp: string
  tipe: TipeTp
  bobotSlm: string
  bobotSas: string
  levels: { min: string; maks: string; deskripsi: string }[]
}

function formBaru(nomor: number): FormState {
  return {
    nomorTp: String(nomor),
    namaTp: '',
    cp: '',
    tipe: 'pengetahuan',
    bobotSlm: '60',
    bobotSas: '40',
    levels: LEVEL_RANGE_DEFAULT.map((l) => ({ min: String(l.min), maks: String(l.maks), deskripsi: '' })),
  }
}

function formDariTp(tp: TujuanPembelajaran): FormState {
  return {
    id: tp.id,
    nomorTp: String(tp.nomorTp),
    namaTp: tp.namaTp,
    cp: tp.cp || '',
    tipe: tp.tipe,
    bobotSlm: String(tp.bobotSlm ?? 60),
    bobotSas: String(tp.bobotSas ?? 40),
    levels: (tp.levels?.length === 4 ? tp.levels : LEVEL_RANGE_DEFAULT.map((l) => ({ ...l, deskripsi: '' }))).map(
      (l) => ({ min: String(l.min), maks: String(l.maks), deskripsi: l.deskripsi || '' }),
    ),
  }
}

export default function SetupTp({ profile }: { profile: AppUser }) {
  const [params] = useSearchParams()
  const mapel = params.get('mapel') || ''
  const tingkatan = params.get('tingkatan') || ''
  const pilihan = useMemo(() => mapelTingkatanSaya(profile), [profile])
  const berhak = pilihan.some((p) => p.mapel === mapel && p.tingkatan === tingkatan)

  const [list, setList] = useState<TujuanPembelajaran[] | null>(null)
  const [form, setForm] = useState<FormState | null>(null)
  const [busy, setBusy] = useState(false)
  const [terbuka, setTerbuka] = useState<string | null>(null)
  const [jumlahTp, setJumlahTp] = useState<Record<string, number | 'gagal'> | null>(null)
  const [cakupan, setCakupan] = useState<{ kunci: string; status: 'boleh' | 'di luar' } | null>(null)
  const { show, node } = useToast()

  const kunciCakupan = `${mapel}|${tingkatan}`
  const statusCakupan: 'memeriksa' | 'boleh' | 'di luar' =
    !mapel || !tingkatan ? 'boleh' : cakupan?.kunci === kunciCakupan ? cakupan.status : 'memeriksa'

  const muat = useCallback(async () => {
    setList(null)
    try {
      setList(await getTPList(mapel, tingkatan))
    } catch (e) {
      console.error(e)
      show('Gagal memuat TP. Periksa koneksi dan hak akses.', true)
      setList([])
    }
  }, [mapel, tingkatan, show])

  useEffect(() => {
    if (mapel || tingkatan || !isGuruAkademikRole(profile.role) || pilihan.length === 0) return
    let batal = false
    setJumlahTp(null)
    void Promise.all(
      pilihan.map(async (p) => {
        const kunci = `${p.mapel}|${p.tingkatan}`
        try {
          const daftar = await getTPList(p.mapel, p.tingkatan)
          return [kunci, daftar.length] as const
        } catch (e) {
          console.error(e)
          return [kunci, 'gagal'] as const
        }
      }),
    ).then((baris) => {
      if (!batal) setJumlahTp(Object.fromEntries(baris))
    })
    return () => {
      batal = true
    }
  }, [mapel, tingkatan, pilihan, profile.role])

  useEffect(() => {
    if (!mapel || !tingkatan || !berhak || !isGuruAkademikRole(profile.role)) return
    const kunci = `${mapel}|${tingkatan}`
    let batal = false
    void getMapelByNama(mapel)
      .then((m) => {
        if (batal) return
        setCakupan({ kunci, status: mapelBerlakuDiTingkatan(m, tingkatan) ? 'boleh' : 'di luar' })
      })
      .catch((e) => {
        console.error(e)
        // Gagal memuat data mapel (jaringan) tidak boleh mengunci guru yang memang berhak.
        if (!batal) setCakupan({ kunci, status: 'boleh' })
      })
    return () => {
      batal = true
    }
  }, [mapel, tingkatan, berhak, profile.role])

  useEffect(() => {
    if (mapel && tingkatan && berhak && statusCakupan === 'boleh') void muat()
  }, [mapel, tingkatan, berhak, statusCakupan, muat])

  if (!isGuruAkademikRole(profile.role)) {
    return (
      <div className="space-y-4">
        <BackLink to="/akademik">Akademik &amp; Rapor</BackLink>
        <Notice tone="warn">
          TP dan KKTP disusun oleh guru yang mengampu mapel itu, baik guru kelas maupun guru bidang studi. Akun{' '}
          {profile.role === 'admin' ? 'administrator' : 'ini'} tidak menulis halaman ini.
        </Notice>
      </div>
    )
  }

  // ---- Pemilih mapel × tingkatan --------------------------------------
  if (!mapel || !tingkatan) {
    return (
      <div className="space-y-5">
        <BackLink to="/akademik">Akademik &amp; Rapor</BackLink>
        <HeroBanner
          eyebrow="Akademik"
          title="Setup TP & KKTP"
          subtitle="Pilih mata pelajaran dan tingkatan. TP berlaku untuk semua kelas paralel di tingkatan yang sama."
        />
        {pilihan.length === 0 ? (
          <Notice tone="warn">
            Belum ada mata pelajaran yang diampu. Guru kelas memilih mapel di kelasnya; guru bidang studi menambahkan
            mapel di kelas lain. Hubungi admin bila tugasnya belum diisi.
          </Notice>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {pilihan.map((p) => {
              const kunci = `${p.mapel}|${p.tingkatan}`
              const n = jumlahTp?.[kunci]
              return (
                <Link
                  key={kunci}
                  to={`/akademik/setup-tp?mapel=${encodeURIComponent(p.mapel)}&tingkatan=${p.tingkatan}`}
                  className="card-soft block p-4 no-underline transition hover:border-muh-300"
                >
                  <p className="text-[14px] font-semibold text-slate-900">{p.mapel}</p>
                  <p className="mt-0.5 text-[12px] text-muted">
                    Tingkat {p.tingkatan} · Fase {faseDariTingkatan(p.tingkatan)}
                    {jumlahTp === null ? ' · Memuat status…' : n === 'gagal' ? ' · Gagal memuat status' : ''}
                  </p>
                  {typeof n === 'number' && (
                    <p className="mt-2">
                      {n > 0 ? <Badge tone="green">{n} TP</Badge> : <Badge tone="peach">Belum ada TP</Badge>}
                    </p>
                  )}
                </Link>
              )
            })}
          </div>
        )}
      </div>
    )
  }

  if (!berhak) {
    return (
      <div className="space-y-4">
        <BackLink to="/akademik/setup-tp">Pilih mata pelajaran</BackLink>
        <Notice tone="error">Anda tidak memiliki penugasan untuk {mapel} tingkat {tingkatan}.</Notice>
      </div>
    )
  }

  if (statusCakupan === 'di luar') {
    return (
      <div className="space-y-4">
        <BackLink to="/akademik/setup-tp">Pilih mata pelajaran</BackLink>
        <Notice tone="warn">
          {mapel} tidak diajarkan di kelas tingkat {tingkatan}. Cek kembali data mapel di Administrasi → Mata
          Pelajaran kalau ini seharusnya diajarkan.
        </Notice>
      </div>
    )
  }

  async function simpan() {
    if (!form) return
    const namaTp = form.namaTp.trim()
    const nomor = parseInt(form.nomorTp, 10)
    if (!namaTp) return show('Nama TP wajib diisi.', true)
    if (!Number.isInteger(nomor) || nomor < 1) return show('Nomor TP harus bilangan bulat ≥ 1.', true)
    if ((list ?? []).some((t) => t.nomorTp === nomor && t.id !== form.id)) {
      return show(`Nomor TP ${nomor} sudah dipakai TP lain.`, true)
    }
    const bSlm = Number(form.bobotSlm)
    const bSas = Number(form.bobotSas)
    if (![bSlm, bSas].every((v) => Number.isFinite(v) && v >= 0) || bSlm + bSas !== 100) {
      return show('Bobot SLM + SAS harus berjumlah tepat 100.', true)
    }
    const levels = form.levels.map((l) => ({
      min: Number(l.min),
      maks: Number(l.maks),
      deskripsi: l.deskripsi.trim(),
    }))
    const galat = validasiLevels(levels)
    if (galat) return show(galat, true)
    if (levels.some((l) => !l.deskripsi)) return show('Deskripsi keempat level KKTP wajib diisi.', true)

    setBusy(true)
    try {
      await saveTP({
        id: form.id,
        mapel,
        tingkatan,
        nomorTp: nomor,
        namaTp,
        cp: form.cp.trim(),
        tipe: form.tipe,
        bobotSlm: bSlm,
        bobotSas: bSas,
        levels,
      })
      show(form.id ? 'TP diperbarui.' : 'TP ditambahkan.')
      setForm(null)
      await muat()
    } catch (e) {
      console.error(e)
      show('Gagal menyimpan TP.', true)
    } finally {
      setBusy(false)
    }
  }

  async function hapus(tp: TujuanPembelajaran) {
    if (
      !window.confirm(
        `Hapus TP ${tp.nomorTp} "${tp.namaTp}"?\n\nNilai siswa yang sudah diinput untuk TP ini tidak ikut terhapus tetapi menjadi yatim dan tidak lagi tampil. Tindakan ini tidak dapat dibatalkan.`,
      )
    )
      return
    try {
      await deleteTP(tp.id)
      show('TP dihapus.')
      await muat()
    } catch (e) {
      console.error(e)
      show('Gagal menghapus TP.', true)
    }
  }

  const setLevel = (i: number, k: 'min' | 'maks' | 'deskripsi', v: string) =>
    setForm((f) => (f ? { ...f, levels: f.levels.map((l, j) => (j === i ? { ...l, [k]: v } : l)) } : f))

  return (
    <div className="space-y-5">
      <BackLink to="/akademik/setup-tp">Pilih mata pelajaran</BackLink>
      <HeroBanner
        eyebrow={`Tingkat ${tingkatan} · Fase ${faseDariTingkatan(tingkatan)}`}
        title={`TP & KKTP — ${mapel}`}
        subtitle="Tujuan pembelajaran beserta empat level KKTP. Semester dan persentase bobot TP diatur di menu Bobot Semester."
      />

      {statusCakupan !== 'boleh' ? (
        <Spinner />
      ) : (
        <>
      {!form && (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className={btnPrimary}
            onClick={() => setForm(formBaru(Math.max(0, ...(list ?? []).map((t) => t.nomorTp || 0)) + 1))}
          >
            + Tambah TP
          </button>
          <Link
            to={`/akademik/bobot-semester?mapel=${encodeURIComponent(mapel)}&tingkatan=${tingkatan}`}
            className={`${btnGhost} no-underline`}
          >
            Atur semester &amp; bobot
          </Link>
        </div>
      )}

      {form && (
        <section className="card-soft space-y-4 p-4">
          <h2 className="text-[14px] font-semibold text-slate-900">{form.id ? 'Edit TP' : 'TP baru'}</h2>
          <div className="grid gap-3 sm:grid-cols-[110px_1fr]">
            <label className="block text-[12px] font-medium text-slate-600">
              Nomor TP
              <input
                className={`${inputCls} mt-1`}
                inputMode="numeric"
                value={form.nomorTp}
                onChange={(e) => setForm({ ...form, nomorTp: e.target.value })}
              />
            </label>
            <label className="block text-[12px] font-medium text-slate-600">
              Nama TP
              <input
                className={`${inputCls} mt-1`}
                value={form.namaTp}
                onChange={(e) => setForm({ ...form, namaTp: e.target.value })}
                placeholder="Rumusan tujuan pembelajaran"
              />
            </label>
          </div>
          <label className="block text-[12px] font-medium text-slate-600">
            Capaian Pembelajaran (opsional)
            <textarea
              className={`${inputCls} mt-1`}
              rows={2}
              value={form.cp}
              onChange={(e) => setForm({ ...form, cp: e.target.value })}
              placeholder="Kalimat CP dari mapel ini untuk fase terkait"
            />
          </label>

          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <p className="text-[12px] font-medium text-slate-600">Jenis penilaian</p>
              <div className="mt-1 flex gap-1.5">
                {(['pengetahuan', 'kinerja'] as TipeTp[]).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setForm({ ...form, tipe: t })}
                    className={`flex-1 rounded-xl border px-3 py-2 text-[12.5px] font-medium capitalize ${
                      form.tipe === t
                        ? 'border-muh-600 bg-muh-50 text-muh-800'
                        : 'border-border bg-white text-slate-600'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
            <label className="block text-[12px] font-medium text-slate-600">
              Bobot SLM (%)
              <input
                className={`${inputCls} mt-1`}
                inputMode="numeric"
                value={form.bobotSlm}
                onChange={(e) => {
                  const v = e.target.value
                  const n = Number(v)
                  setForm({
                    ...form,
                    bobotSlm: v,
                    bobotSas: Number.isFinite(n) && n >= 0 && n <= 100 && v !== '' ? String(100 - n) : form.bobotSas,
                  })
                }}
              />
            </label>
            <label className="block text-[12px] font-medium text-slate-600">
              Bobot SAS (%)
              <input
                className={`${inputCls} mt-1`}
                inputMode="numeric"
                value={form.bobotSas}
                onChange={(e) => setForm({ ...form, bobotSas: e.target.value })}
              />
            </label>
          </div>
          <p className="text-[11.5px] leading-relaxed text-muted">
            Dipakai kalau SAS TP ini diisi. Kalau SAS kosong, nilai akhir TP = SLM saja.
          </p>

          <div className="space-y-2.5">
            <p className="text-[12px] font-medium text-slate-600">
              Empat level KKTP — rentang nilai dan deskripsi capaian
            </p>
            {form.levels.map((l, i) => (
              <div key={i} className="rounded-xl border border-border p-3">
                <div className="flex items-center gap-2">
                  <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${LEVEL_WARNA[i]}`}>
                    {LEVEL_LABEL[form.tipe][i]}
                  </span>
                  <input
                    aria-label={`Nilai minimum level ${i + 1}`}
                    className={`${inputCls} w-16 text-center`}
                    inputMode="numeric"
                    value={l.min}
                    onChange={(e) => setLevel(i, 'min', e.target.value)}
                  />
                  <span className="text-muted">–</span>
                  <input
                    aria-label={`Nilai maksimum level ${i + 1}`}
                    className={`${inputCls} w-16 text-center`}
                    inputMode="numeric"
                    value={l.maks}
                    onChange={(e) => setLevel(i, 'maks', e.target.value)}
                  />
                </div>
                <textarea
                  aria-label={`Deskripsi level ${i + 1}`}
                  className={`${inputCls} mt-2`}
                  rows={2}
                  value={l.deskripsi}
                  onChange={(e) => setLevel(i, 'deskripsi', e.target.value)}
                  placeholder="Kalimat capaian yang akan muncul di rapor"
                />
              </div>
            ))}
          </div>

          <div className="flex gap-2">
            <button type="button" className={btnPrimary} disabled={busy} onClick={() => void simpan()}>
              {busy ? 'Menyimpan…' : 'Simpan TP'}
            </button>
            <button type="button" className={btnGhost} disabled={busy} onClick={() => setForm(null)}>
              Batal
            </button>
          </div>
        </section>
      )}

      {list === null ? (
        <Spinner />
      ) : list.length === 0 ? (
        <Notice>Belum ada TP untuk {mapel} tingkat {tingkatan}. Tambahkan TP pertama.</Notice>
      ) : (
        <div className="space-y-2.5">
          {list.map((tp) => {
            const buka = terbuka === tp.id
            return (
              <article key={tp.id} className="card-soft overflow-hidden">
                <button
                  type="button"
                  onClick={() => setTerbuka(buka ? null : tp.id)}
                  className="flex w-full items-center gap-3 p-3.5 text-left"
                  aria-expanded={buka}
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muh-50 text-[13px] font-bold text-muh-700">
                    {tp.nomorTp}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13.5px] font-semibold leading-snug text-slate-900">{tp.namaTp}</span>
                    <span className="mt-1 flex flex-wrap items-center gap-1.5">
                      <Badge tone="green">{tp.tipe}</Badge>
                      <Badge>
                        SLM {tp.bobotSlm ?? 60}% · SAS {tp.bobotSas ?? 40}%
                      </Badge>
                      {tp.semester ? (
                        <Badge>
                          Sem {tp.semester} · {tp.bobotMapel ?? '–'}%
                        </Badge>
                      ) : (
                        <Badge tone="peach">Semester &amp; bobot belum diatur</Badge>
                      )}
                    </span>
                  </span>
                </button>
                {buka && (
                  <div className="space-y-3 border-t border-border p-3.5">
                    {tp.cp && <p className="text-[12.5px] text-slate-600">{tp.cp}</p>}
                    <ul className="space-y-1.5">
                      {(tp.levels || []).map((l, i) => (
                        <li key={i} className="flex gap-2 text-[12.5px]">
                          <span className={`h-fit shrink-0 rounded-full px-2 py-0.5 text-[10.5px] font-semibold ${LEVEL_WARNA[i]}`}>
                            {LEVEL_LABEL[tp.tipe][i]} {l.min}–{l.maks}
                          </span>
                          <span className="text-slate-600">{l.deskripsi || 'Belum diisi'}</span>
                        </li>
                      ))}
                    </ul>
                    <div className="flex gap-2">
                      <button type="button" className={btnGhost} onClick={() => { setForm(formDariTp(tp)); window.scrollTo({ top: 0, behavior: 'smooth' }) }}>
                        Edit
                      </button>
                      <button
                        type="button"
                        className="rounded-xl border border-red-200 bg-white px-3.5 py-2 text-[13px] font-medium text-red-700 hover:bg-red-50"
                        onClick={() => void hapus(tp)}
                      >
                        Hapus
                      </button>
                    </div>
                  </div>
                )}
              </article>
            )
          })}
        </div>
      )}
        </>
      )}
      {node}
    </div>
  )
}
