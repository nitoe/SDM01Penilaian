import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import type { AppUser } from '../../types/user'
import type { Semester, TujuanPembelajaran } from '../../types/akademik'
import { getTPList, normalisasiPersenBobotMapel, saveBobotSemesterBatch } from '../../lib/akademik'
import { mapelTingkatanSaya } from '../../lib/penugasan'
import { isGuruAkademikRole } from '../../lib/roles'
import { HeroBanner } from '../../components/ui'
import { BackLink, Notice, Spinner, btnGhost, btnPrimary, inputCls, useToast } from './shared'

interface Baris {
  tp: TujuanPembelajaran
  semester: Semester | ''
  bobot: string
}

const TOLERANSI = 0.5

export default function BobotSemester({ profile }: { profile: AppUser }) {
  const [params] = useSearchParams()
  const mapel = params.get('mapel') || ''
  const tingkatan = params.get('tingkatan') || ''
  const pilihan = useMemo(() => mapelTingkatanSaya(profile), [profile])
  const berhak = pilihan.some((p) => p.mapel === mapel && p.tingkatan === tingkatan)

  const [baris, setBaris] = useState<Baris[] | null>(null)
  const [kotor, setKotor] = useState(false)
  const [busy, setBusy] = useState(false)
  const { show, node } = useToast()

  useEffect(() => {
    if (!mapel || !tingkatan || !berhak) return
    let batal = false
    getTPList(mapel, tingkatan)
      .then((l) => {
        if (batal) return
        setBaris(l.map((tp) => ({ tp, semester: tp.semester ?? '', bobot: tp.bobotMapel != null ? String(tp.bobotMapel) : '' })))
        setKotor(false)
      })
      .catch((e) => {
        console.error(e)
        show('Gagal memuat TP.', true)
        setBaris([])
      })
    return () => {
      batal = true
    }
  }, [mapel, tingkatan, berhak, show])

  if (!isGuruAkademikRole(profile.role)) {
    return (
      <div className="space-y-4">
        <BackLink to="/akademik">Akademik &amp; Rapor</BackLink>
        <Notice tone="warn">
          Bobot TP diatur oleh guru yang mengampu mapel itu, baik guru kelas maupun guru bidang studi.
        </Notice>
      </div>
    )
  }

  if (!mapel || !tingkatan) {
    return (
      <div className="space-y-5">
        <BackLink to="/akademik">Akademik &amp; Rapor</BackLink>
        <HeroBanner eyebrow="Akademik" title="Bobot Semester TP" subtitle="Pilih mata pelajaran dan tingkatan." />
        {pilihan.length === 0 ? (
          <Notice tone="warn">
            Belum ada mata pelajaran yang diampu. Guru kelas memilih mapel di kelasnya; guru bidang studi menambahkan
            mapel di kelas lain.
          </Notice>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {pilihan.map((p) => (
              <Link
                key={`${p.mapel}-${p.tingkatan}`}
                to={`/akademik/bobot-semester?mapel=${encodeURIComponent(p.mapel)}&tingkatan=${p.tingkatan}`}
                className="card-soft block p-4 no-underline transition hover:border-muh-300"
              >
                <p className="text-[14px] font-semibold text-slate-900">{p.mapel}</p>
                <p className="mt-0.5 text-[12px] text-muted">Tingkat {p.tingkatan}</p>
              </Link>
            ))}
          </div>
        )}
      </div>
    )
  }

  if (!berhak) {
    return (
      <div className="space-y-4">
        <BackLink to="/akademik/bobot-semester">Pilih mata pelajaran</BackLink>
        <Notice tone="error">Anda tidak memiliki penugasan untuk {mapel} tingkat {tingkatan}.</Notice>
      </div>
    )
  }

  const ubah = (id: string, patch: Partial<Pick<Baris, 'semester' | 'bobot'>>) => {
    setBaris((b) => (b ? b.map((r) => (r.tp.id === id ? { ...r, ...patch } : r)) : b))
    setKotor(true)
  }

  const nilaiBobot = (r: Baris) => (r.bobot.trim() === '' ? NaN : Number(r.bobot))
  const totalSemester = (s: Semester) =>
    (baris ?? []).filter((r) => r.semester === s).reduce((a, r) => a + (Number.isFinite(nilaiBobot(r)) ? nilaiBobot(r) : 0), 0)

  function ratakan(s: Semester) {
    if (!baris) return
    const kelompok = baris.filter((r) => r.semester === s)
    if (!kelompok.length) return
    const hasil = normalisasiPersenBobotMapel(
      kelompok.map((r) => ({ id: r.tp.id, bobotMapel: Number.isFinite(nilaiBobot(r)) ? nilaiBobot(r) : 1 })),
    )
    const peta = new Map(hasil.map((h) => [h.id, h.bobotBaru]))
    setBaris(baris.map((r) => (peta.has(r.tp.id) ? { ...r, bobot: String(peta.get(r.tp.id)) } : r)))
    setKotor(true)
  }

  async function simpan() {
    if (!baris) return
    const terkelompok = baris.filter((r) => r.semester !== '')
    if (terkelompok.some((r) => !Number.isFinite(nilaiBobot(r)) || nilaiBobot(r) < 0 || nilaiBobot(r) > 100)) {
      return show('Persentase bobot harus angka 0–100 untuk semua TP yang sudah dikelompokkan.', true)
    }
    const peringatan: string[] = []
    const belum = baris.filter((r) => r.semester === '').length
    if (belum) peringatan.push(`${belum} TP belum dikelompokkan ke semester (tidak akan disimpan).`)
    ;(['1', '2'] as Semester[]).forEach((s) => {
      const ada = baris.some((r) => r.semester === s)
      if (ada && Math.abs(totalSemester(s) - 100) > TOLERANSI) {
        peringatan.push(`Total bobot Semester ${s} = ${totalSemester(s)}%, bukan 100%.`)
      }
    })
    if (peringatan.length && !window.confirm(`${peringatan.join('\n')}\n\nTetap simpan?`)) return

    setBusy(true)
    try {
      await saveBobotSemesterBatch(
        terkelompok.map((r) => ({ id: r.tp.id, semester: r.semester as Semester, bobotMapel: nilaiBobot(r) })),
      )
      show('Semester dan bobot TP disimpan.')
      setKotor(false)
    } catch (e) {
      console.error(e)
      show('Gagal menyimpan. Periksa koneksi dan hak akses.', true)
    } finally {
      setBusy(false)
    }
  }

  const kelompok = (s: Semester | '') => (baris ?? []).filter((r) => r.semester === s)

  // Fungsi render (bukan komponen) agar input tidak di-remount & kehilangan fokus tiap ketikan.
  const renderKartu = (r: Baris) => (
    <li key={r.tp.id} className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-white p-2.5">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-muh-50 text-[12px] font-bold text-muh-700">
        {r.tp.nomorTp}
      </span>
      <span className="min-w-0 flex-1 basis-40 text-[12.5px] leading-snug text-slate-800">{r.tp.namaTp}</span>
      {r.semester !== '' && (
        <label className="flex items-center gap-1 text-[12px] text-slate-600">
          <input
            aria-label={`Bobot TP ${r.tp.nomorTp} (persen)`}
            className={`${inputCls} w-16 text-center`}
            inputMode="decimal"
            value={r.bobot}
            onChange={(e) => ubah(r.tp.id, { bobot: e.target.value })}
          />
          %
        </label>
      )}
      <span className="flex gap-1">
        {(['1', '2'] as Semester[])
          .filter((s) => s !== r.semester)
          .map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => ubah(r.tp.id, { semester: s, bobot: r.bobot === '' ? '1' : r.bobot })}
              className="rounded-lg border border-border px-2 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-50"
            >
              {r.semester === '' ? `Ke Sem ${s}` : `Pindah ke Sem ${s}`}
            </button>
          ))}
      </span>
    </li>
  )

  const renderKelompok = (s: Semester) => {
    const isi = kelompok(s)
    const total = totalSemester(s)
    const pas = Math.abs(total - 100) <= TOLERANSI
    return (
      <section key={s} className="card-soft space-y-2.5 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-[14px] font-semibold text-slate-900">Semester {s}</h2>
          {isi.length > 0 && (
            <span
              className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                pas ? 'bg-muh-50 text-muh-700' : 'bg-amber-50 text-amber-700'
              }`}
            >
              {pas ? '✓' : '⚠'} Total {total}%
            </span>
          )}
          {isi.length > 0 && (
            <button type="button" className={`${btnGhost} ml-auto !px-2.5 !py-1 !text-[12px]`} onClick={() => ratakan(s)}>
              Ratakan ke 100%
            </button>
          )}
        </div>
        {isi.length === 0 ? (
          <p className="text-[12.5px] text-muted">Belum ada TP di semester ini.</p>
        ) : (
          <ul className="space-y-1.5">
            {isi.map(renderKartu)}
          </ul>
        )}
      </section>
    )
  }

  return (
    <div className="space-y-5">
      <BackLink to="/akademik/bobot-semester">Pilih mata pelajaran</BackLink>
      <HeroBanner
        eyebrow={`Tingkat ${tingkatan}`}
        title={`Bobot Semester TP — ${mapel}`}
        subtitle="Kelompokkan TP ke Semester 1 atau 2, lalu atur persentase kontribusi tiap TP terhadap nilai akhir mapel (per semester total 100%)."
      />
      {baris === null ? (
        <Spinner />
      ) : baris.length === 0 ? (
        <Notice>Belum ada TP. Susun dulu di menu Setup TP &amp; KKTP.</Notice>
      ) : (
        <>
          <Notice>
            Nilai akhir mapel dihitung dari rata-rata tertimbang TP yang sudah bernilai. Mengubah persentase di sini tidak
            mengubah isi TP maupun nilai siswa yang sudah diinput.
          </Notice>
          {kelompok('').length > 0 && (
            <section className="card-soft space-y-2.5 border-amber-200 p-4">
              <h2 className="text-[14px] font-semibold text-slate-900">Belum dikelompokkan</h2>
              <ul className="space-y-1.5">
                {kelompok('').map(renderKartu)}
              </ul>
            </section>
          )}
          {renderKelompok('1')}
          {renderKelompok('2')}
          <div className="sticky bottom-16 z-10 flex items-center gap-2 rounded-2xl border border-border bg-white/95 p-3 shadow-lg backdrop-blur md:bottom-4">
            <button type="button" className={btnPrimary} disabled={busy || !kotor} onClick={() => void simpan()}>
              {busy ? 'Menyimpan…' : 'Simpan semua'}
            </button>
            {kotor && <span className="text-[12px] text-amber-700">Ada perubahan yang belum disimpan.</span>}
          </div>
        </>
      )}
      {node}
    </div>
  )
}
