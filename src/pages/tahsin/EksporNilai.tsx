import { useEffect, useMemo, useState } from 'react'
import type { AppUser } from '../../types/user'
import { isAdminRole } from '../../lib/roles'
import { SEMUA_KELAS } from '../../types/tahsin'
import { usePeriodeAkademik } from '../../lib/usePeriodeAkademik'
import { eksporNilaiTahsinKelas } from '../../lib/eksporNilaiTahsin'
import { PageHeader } from '../../components/ui'
import { Notice, Spinner, btnPrimary, selectCls, useToast } from '../akademik/shared'

/**
 * Ekspor semua nilai Tahsin-Tahfizh (setoran + menulis) ke Excel.
 * Guru: kelas ampu saja. Admin: pilih kelas mana yang diekspor.
 * Hanya membaca — tidak mengubah data.
 */
export default function EksporNilai({ profile }: { profile: AppUser }) {
  const admin = isAdminRole(profile.role)
  const kelasBoleh = useMemo<string[]>(
    () => (admin ? [...SEMUA_KELAS] : (profile.kelasAmpu ?? [])),
    [admin, profile.kelasAmpu],
  )
  const periodeAk = usePeriodeAkademik()
  const [kelas, setKelas] = useState('')
  const [busy, setBusy] = useState(false)
  const { show: showToast, node: toastNode } = useToast()

  // Default kelas: satu-satunya kelas ampu, atau kosong agar admin memilih.
  useEffect(() => {
    if (!kelas && kelasBoleh.length === 1) setKelas(kelasBoleh[0]!)
  }, [kelas, kelasBoleh])

  async function handleEkspor() {
    if (!kelas || !periodeAk.ready) return
    setBusy(true)
    try {
      const hasil = await eksporNilaiTahsinKelas({
        kelas,
        periode: { tahunAjaran: periodeAk.tahunAjaran, semester: periodeAk.semester },
        labelPeriode: periodeAk.label,
      })
      showToast(
        `Diekspor ${hasil.jumlahSetoran} setoran dan ${hasil.jumlahMenulis} catatan menulis (${hasil.namaFile}).`,
      )
    } catch (e) {
      console.error(e)
      showToast('Gagal mengekspor. Periksa koneksi dan hak akses kelas.', true)
    } finally {
      setBusy(false)
    }
  }

  if (kelasBoleh.length === 0) {
    return (
      <div className="space-y-4">
        <PageHeader
          back={{ to: '/tahsin', label: admin ? 'Pantauan Tahsin & Tahfizh' : 'Tahsin & Tahfizh' }}
          title="Ekspor Nilai Tahsin-Tahfizh"
        />
        <Notice>
          Belum ada kelas ampu pada akun Anda. Hubungi admin untuk mengatur kelas ampu.
        </Notice>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <PageHeader
        back={{ to: '/tahsin', label: admin ? 'Pantauan Tahsin & Tahfizh' : 'Tahsin & Tahfizh' }}
        title="Ekspor Nilai Tahsin-Tahfizh"
        subtitle={
          admin
            ? 'Unduh semua setoran dan catatan menulis satu kelas (Excel). Pilih kelas yang akan diekspor.'
            : 'Unduh semua setoran dan catatan menulis kelas yang Anda ampu (Excel).'
        }
      />

      {toastNode}

      <div className="card-soft grid max-w-xl gap-4 p-4 sm:grid-cols-2">
        <label className="block sm:col-span-2">
          <span className="mb-1 block text-[11px] font-medium text-slate-600">Kelas</span>
          <select
            className={selectCls}
            value={kelas}
            onChange={(e) => setKelas(e.target.value)}
            disabled={busy}
          >
            <option value="">— Pilih kelas —</option>
            {kelasBoleh.map((k) => (
              <option key={k} value={k}>
                Kelas {k}
              </option>
            ))}
          </select>
        </label>

        <div className="sm:col-span-2 rounded-lg border border-border bg-slate-50 px-3 py-2.5 text-[12px] text-slate-700">
          <p>
            <span className="font-medium">Periode:</span>{' '}
            {periodeAk.ready ? periodeAk.label : 'Belum dipilih di header'}
          </p>
          <p className="mt-1 text-muted">
            File berisi dua lembar: <strong>Setoran</strong> (ziyadah, muroja&apos;ah, tahsin pada
            periode ini) dan <strong>Menulis</strong> (semua catatan menulis di kelas tersebut).
          </p>
        </div>

        {!periodeAk.ready && (
          <div className="sm:col-span-2">
            <Notice tone="warn">Pilih periode akademik di header terlebih dahulu.</Notice>
          </div>
        )}

        <div className="sm:col-span-2">
          <button
            type="button"
            className={btnPrimary}
            disabled={!kelas || !periodeAk.ready || busy}
            onClick={() => void handleEkspor()}
          >
            {busy ? 'Menyiapkan file…' : 'Unduh Excel'}
          </button>
        </div>
      </div>

      {busy && <Spinner />}
    </div>
  )
}
