/**
 * Halaman admin-only: impor nilai Tahsin-Tahfizh dari Excel ekspor penilaian-v2.
 * Fitur sementara migrasi — setelah semua kelas selesai, hapus menu & rute ini.
 */
import { useCallback, useRef, useState } from 'react'
import type { AppUser } from '../../types/user'
import { isAdminRole } from '../../lib/roles'
import { usePeriodeAkademik } from '../../lib/usePeriodeAkademik'
import { PageHeader } from '../../components/ui'
import { Notice, Spinner, btnPrimary, btnGhost, useToast } from '../akademik/shared'
import {
  bacaExcelV2,
  jalankanImporV2,
  muatSiswaUntukImpor,
  praLihatImporV2,
  type HasilPraLihatImpor,
} from '../../lib/imporNilaiTahsinV2'

export default function ImporNilaiV2({ profile }: { profile: AppUser }) {
  const admin = isAdminRole(profile.role)
  const periodeAk = usePeriodeAkademik()
  const fileRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [fase, setFase] = useState<'upload' | 'pratinjau' | 'selesai'>('upload')
  const [pra, setPra] = useState<HasilPraLihatImpor | null>(null)
  const [hasilAkhir, setHasilAkhir] = useState<{
    setoranOk: number
    menulisOk: number
    gagal: number
  } | null>(null)
  const { show: showToast, node: toastNode } = useToast()

  const handleFile = useCallback(
    async (file: File | null) => {
      if (!file || !periodeAk.ready) return
      setBusy(true)
      setPra(null)
      setHasilAkhir(null)
      try {
        const buf = await file.arrayBuffer()
        const data = await bacaExcelV2(buf)
        if (!data.setoran.length && !data.menulis.length) {
          showToast('File tidak berisi sheet Detail Setoran atau Detail Menulis yang valid.', true)
          return
        }
        const siswa = await muatSiswaUntukImpor()
        const hasil = praLihatImporV2(data, siswa, {
          tahunAjaran: periodeAk.tahunAjaran,
          semester: periodeAk.semester,
        })
        setPra(hasil)
        setFase('pratinjau')
        showToast(
          `Pratinjau: ${hasil.ringkas.setoranSiap} setoran + ${hasil.ringkas.menulisSiap} menulis siap diimpor.`,
        )
      } catch (e) {
        console.error(e)
        showToast('Gagal membaca file. Pastikan format sama dengan ekspor penilaian-v2.', true)
      } finally {
        setBusy(false)
        if (fileRef.current) fileRef.current.value = ''
      }
    },
    [periodeAk, showToast],
  )

  async function handleJalankan() {
    if (!pra) return
    const totalSiap = pra.ringkas.setoranSiap + pra.ringkas.menulisSiap
    if (!totalSiap) {
      showToast('Tidak ada baris siap untuk diimpor.', true)
      return
    }
    if (
      !window.confirm(
        `Impor ${pra.ringkas.setoranSiap} setoran dan ${pra.ringkas.menulisSiap} catatan menulis ke periode ${periodeAk.label}?\n\nBaris error/ambigu akan dilewati.`,
      )
    ) {
      return
    }
    setBusy(true)
    try {
      const h = await jalankanImporV2(pra)
      setHasilAkhir(h)
      setFase('selesai')
      showToast(
        `Selesai: ${h.setoranOk} setoran, ${h.menulisOk} menulis diimpor${h.gagal ? `, ${h.gagal} gagal` : ''}.`,
      )
    } catch (e) {
      console.error(e)
      showToast('Gagal menulis ke database. Periksa koneksi dan hak akses admin.', true)
    } finally {
      setBusy(false)
    }
  }

  if (!admin) {
    return (
      <div className="space-y-4">
        <PageHeader back={{ to: '/admin', label: 'Administrasi' }} title="Impor Nilai v2" />
        <Notice tone="warn">Fitur ini hanya untuk administrator.</Notice>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <PageHeader
        back={{ to: '/admin', label: 'Administrasi' }}
        title="Impor Nilai Tahsin-Tahfizh (v2)"
        subtitle="Migrasi sementara dari file Excel ekspor penilaian-v2. Hanya admin. Setelah semua kelas selesai, fitur ini akan dihapus."
      />

      {toastNode}

      <div className="rounded-md border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-[12px] leading-snug text-amber-900">
        <span className="font-semibold">Fitur migrasi sekali pakai.</span> Matching siswa: NISN → NIS →
        nama (≥90%). Data ditulis dengan flag <code className="text-[11px]">sumber: impor-v2</code> dan
        periode akademik yang dipilih di header.
      </div>

      {!periodeAk.ready && (
        <Notice tone="warn">Pilih periode akademik di header terlebih dahulu.</Notice>
      )}

      {fase === 'upload' && (
        <div className="card-soft max-w-xl space-y-4 p-4">
          <p className="text-[13px] text-slate-700">
            Unggah file Excel hasil ekspor dari penilaian-v2 (harus ada sheet{' '}
            <strong>Detail Setoran</strong> dan/atau <strong>Detail Menulis</strong>).
          </p>
          <div className="rounded-lg border border-border bg-slate-50 px-3 py-2.5 text-[12px] text-slate-700">
            <p>
              <span className="font-medium">Periode tujuan:</span>{' '}
              {periodeAk.ready ? periodeAk.label : '— belum dipilih —'}
            </p>
          </div>
          <label className="block">
            <span className="mb-1 block text-[11px] font-medium text-slate-600">File Excel</span>
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls"
              disabled={busy || !periodeAk.ready}
              className="block w-full text-[13px] file:mr-3 file:rounded-md file:border-0 file:bg-muh-600 file:px-3 file:py-1.5 file:text-[12px] file:font-medium file:text-white"
              onChange={(e) => void handleFile(e.target.files?.[0] ?? null)}
            />
          </label>
          {busy && <Spinner />}
        </div>
      )}

      {fase === 'pratinjau' && pra && (
        <div className="space-y-4">
          <div className="card-soft grid gap-3 p-4 sm:grid-cols-3">
            <Ringkas
              label="Setoran siap"
              value={pra.ringkas.setoranSiap}
              tone="ok"
            />
            <Ringkas
              label="Setoran error/ambigu"
              value={pra.ringkas.setoranError + pra.ringkas.setoranAmbigu}
              tone={pra.ringkas.setoranError + pra.ringkas.setoranAmbigu ? 'warn' : 'muted'}
            />
            <Ringkas label="Menulis siap" value={pra.ringkas.menulisSiap} tone="ok" />
            <Ringkas
              label="Menulis error/ambigu"
              value={pra.ringkas.menulisError + pra.ringkas.menulisAmbigu}
              tone={pra.ringkas.menulisError + pra.ringkas.menulisAmbigu ? 'warn' : 'muted'}
            />
            {pra.meta.kelas && (
              <div className="sm:col-span-3 text-[12px] text-slate-600">
                Kelas di file: <strong>{pra.meta.kelas}</strong>
                {pra.meta.periode ? ` · Periode sumber: ${pra.meta.periode}` : ''}
              </div>
            )}
          </div>

          {(pra.ringkas.setoranError + pra.ringkas.setoranAmbigu > 0 ||
            pra.ringkas.menulisError + pra.ringkas.menulisAmbigu > 0) && (
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full min-w-[640px] text-left text-[12px]">
                <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-3 py-2">Sheet</th>
                    <th className="px-3 py-2">Baris</th>
                    <th className="px-3 py-2">NIS / Nama</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2">Pesan</th>
                  </tr>
                </thead>
                <tbody>
                  {pra.setoran
                    .filter((b) => b.status !== 'siap')
                    .slice(0, 40)
                    .map((b) => (
                      <tr key={`s-${b.baris}`} className="border-t border-border">
                        <td className="px-3 py-1.5">Setoran</td>
                        <td className="px-3 py-1.5">{b.baris}</td>
                        <td className="px-3 py-1.5">
                          {b.nisExcel} · {b.namaExcel}
                        </td>
                        <td className="px-3 py-1.5">{b.status}</td>
                        <td className="px-3 py-1.5 text-slate-600">{b.pesan}</td>
                      </tr>
                    ))}
                  {pra.menulis
                    .filter((b) => b.status !== 'siap')
                    .slice(0, 20)
                    .map((b) => (
                      <tr key={`m-${b.baris}`} className="border-t border-border">
                        <td className="px-3 py-1.5">Menulis</td>
                        <td className="px-3 py-1.5">{b.baris}</td>
                        <td className="px-3 py-1.5">
                          {b.nisExcel} · {b.namaExcel}
                        </td>
                        <td className="px-3 py-1.5">{b.status}</td>
                        <td className="px-3 py-1.5 text-slate-600">{b.pesan}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={btnPrimary}
              disabled={busy || pra.ringkas.setoranSiap + pra.ringkas.menulisSiap === 0}
              onClick={() => void handleJalankan()}
            >
              {busy ? 'Mengimpor…' : 'Jalankan impor'}
            </button>
            <button
              type="button"
              className={btnGhost}
              disabled={busy}
              onClick={() => {
                setFase('upload')
                setPra(null)
              }}
            >
              Batalkan / unggah ulang
            </button>
          </div>
          {busy && <Spinner />}
        </div>
      )}

      {fase === 'selesai' && hasilAkhir && (
        <div className="card-soft max-w-xl space-y-3 p-4">
          <p className="text-[14px] font-medium text-slate-800">Impor selesai</p>
          <ul className="list-inside list-disc text-[13px] text-slate-700">
            <li>{hasilAkhir.setoranOk} setoran ditulis</li>
            <li>{hasilAkhir.menulisOk} catatan menulis ditulis</li>
            {hasilAkhir.gagal > 0 && (
              <li className="text-amber-800">{hasilAkhir.gagal} baris gagal (lihat konsol)</li>
            )}
          </ul>
          <p className="text-[12px] text-muted">
            Cek Riwayat Siswa atau Ekspor Nilai untuk memverifikasi. Ulangi untuk kelas lain dengan file
            Excel yang sesuai.
          </p>
          <button
            type="button"
            className={btnGhost}
            onClick={() => {
              setFase('upload')
              setPra(null)
              setHasilAkhir(null)
            }}
          >
            Impor file berikutnya
          </button>
        </div>
      )}
    </div>
  )
}

function Ringkas({
  label,
  value,
  tone,
}: {
  label: string
  value: number
  tone: 'ok' | 'warn' | 'muted'
}) {
  const cls =
    tone === 'ok'
      ? 'text-emerald-700'
      : tone === 'warn'
        ? 'text-amber-700'
        : 'text-slate-500'
  return (
    <div>
      <p className="text-[11px] text-slate-500">{label}</p>
      <p className={`text-xl font-semibold tabular-nums ${cls}`}>{value}</p>
    </div>
  )
}
