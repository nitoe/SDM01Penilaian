/**
 * Panel pembentukan kelompok di detail tugas siswa.
 * ANTIREGRESI §Tugas.Kelompok — tanpa konfirmasi anggota (hasil diskusi di kelas).
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { muatSiswaKelas, type SiswaDasar } from '../../lib/siswaAuth'
import {
  buatKelompok,
  keluarKelompok,
  kelompokSaya,
  perbaruiAnggotaKelompok,
  type TugasKelompokDok,
  isKetua,
} from '../../lib/tugasKelompok'
import type { TugasLms } from '../../types/tugas'
import SiswaIcon from './SiswaIcon'

type Props = {
  tugas: TugasLms
  siswaId: string
  siswaNama: string
  kelas: string
  /** Dipanggil setelah kelompok berubah (buat/update/keluar). */
  onKelompokChange: (k: TugasKelompokDok | null) => void
  /** Kelompok saat ini (null = belum punya). */
  kelompok: TugasKelompokDok | null
  /** Jika true, form pengumpulan sudah dikunci (sudah dinilai). */
  terkunci: boolean
}

export default function KelompokSiswaPanel({
  tugas,
  siswaId,
  siswaNama,
  kelas,
  onKelompokChange,
  kelompok,
  terkunci,
}: Props) {
  const maxAnggota = Math.max(2, Math.min(12, tugas.kelompokMaxAnggota ?? 4))
  const [roster, setRoster] = useState<SiswaDasar[]>([])
  const [loadingRoster, setLoadingRoster] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [modeEdit, setModeEdit] = useState(false)
  /** ID teman yang dicentang (belum termasuk diri sendiri). */
  const [pilihIds, setPilihIds] = useState<string[]>([])

  const muatRoster = useCallback(async () => {
    setLoadingRoster(true)
    try {
      const list = await muatSiswaKelas(kelas)
      setRoster(list.filter((s) => s.id !== siswaId))
    } catch (e) {
      console.warn('roster kelompok', e)
      setRoster([])
    } finally {
      setLoadingRoster(false)
    }
  }, [kelas, siswaId])

  useEffect(() => {
    void muatRoster()
  }, [muatRoster])

  // Saat buka mode edit / buat, isi centang dari anggota yang sudah ada
  useEffect(() => {
    if (kelompok && isKetua(kelompok, siswaId)) {
      setPilihIds(kelompok.anggotaIds.filter((id) => id !== siswaId))
    } else if (!kelompok) {
      setPilihIds([])
    }
  }, [kelompok, siswaId])

  const temanTersedia = useMemo(() => {
    // Sembunyikan siswa yang sudah masuk kelompok lain? Untuk V1 biarkan bebas;
    // rules + UI nanti bisa diperkuat. Sementara tampilkan semua sekelas.
    return roster
  }, [roster])

  const ketua = isKetua(kelompok, siswaId)

  async function handleBuat() {
    setBusy(true)
    setError('')
    try {
      const anggotaLain = temanTersedia.filter((s) => pilihIds.includes(s.id))
      const k = await buatKelompok({
        tugasId: tugas.id,
        kelas,
        ketua: { id: siswaId, nama: siswaNama, kelas },
        anggotaLain,
        maxAnggota,
      })
      onKelompokChange(k)
      setModeEdit(false)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Gagal membuat kelompok')
    } finally {
      setBusy(false)
    }
  }

  async function handleSimpanAnggota() {
    if (!kelompok) return
    setBusy(true)
    setError('')
    try {
      const anggotaLain = temanTersedia.filter((s) => pilihIds.includes(s.id))
      const k = await perbaruiAnggotaKelompok({
        kelompokId: kelompok.id,
        ketua: { id: siswaId, nama: siswaNama, kelas },
        anggotaLain,
        maxAnggota,
      })
      onKelompokChange(k)
      setModeEdit(false)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Gagal menyimpan anggota')
    } finally {
      setBusy(false)
    }
  }

  async function handleKeluar() {
    if (!kelompok) return
    const msg =
      kelompok.ketuaId === siswaId
        ? 'Anda ketua. Keluar akan menghapus kelompok ini. Lanjutkan?'
        : 'Keluar dari kelompok?'
    if (!window.confirm(msg)) return
    setBusy(true)
    setError('')
    try {
      await keluarKelompok(kelompok, siswaId)
      onKelompokChange(null)
      setModeEdit(false)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Gagal keluar kelompok')
    } finally {
      setBusy(false)
    }
  }

  function togglePilih(id: string) {
    setPilihIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id)
      // +1 untuk diri sendiri
      if (prev.length + 1 >= maxAnggota) return prev
      return [...prev, id]
    })
  }

  return (
    <section className="sw-kat-panel sw-kelompok">
      <h3 className="sw-kat-panel-judul">
        <SiswaIcon name="sparkles" size={18} />
        Kelompok
      </h3>

      {error && <p className="sw-error" role="alert">{error}</p>}

      {/* Sudah punya kelompok */}
      {kelompok && !modeEdit && (
        <div className="sw-kelompok-info">
          <p className="sw-kelompok-ketua">
            Ketua: <strong>{kelompok.ketuaNama}</strong>
            {ketua ? ' (Anda)' : ''}
          </p>
          <ul className="sw-kelompok-anggota">
            {kelompok.anggotaList.map((a) => (
              <li key={a.id}>
                {a.nama}
                {a.id === kelompok.ketuaId ? ' · ketua' : ''}
                {a.id === siswaId ? ' · Anda' : ''}
              </li>
            ))}
          </ul>
          <p className="sw-hint">
            {ketua
              ? 'Hanya Anda (ketua) yang dapat mengunggah pengumpulan. Anggota otomatis tercatat terkumpul setelah Anda mengirim.'
              : 'Hanya ketua yang dapat mengunggah. Setelah ketua mengirim, status Anda otomatis menjadi terkumpul.'}
          </p>
          {!terkunci && (
            <div className="sw-kelompok-aksi">
              {ketua && (
                <button
                  type="button"
                  className="sw-btn sw-btn--secondary"
                  disabled={busy}
                  onClick={() => setModeEdit(true)}
                >
                  Ubah anggota
                </button>
              )}
              <button
                type="button"
                className="sw-btn sw-btn--ghost"
                disabled={busy}
                onClick={() => void handleKeluar()}
              >
                {ketua ? 'Hapus kelompok' : 'Keluar kelompok'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Form buat / edit anggota */}
      {(!kelompok || modeEdit) && !terkunci && (
        <div className="sw-kelompok-form">
          {!kelompok && (
            <p className="sw-hint">
              Diskusikan dulu dengan teman sekelas, lalu ketua memasukkan anggota di sini.
              Tidak perlu konfirmasi di HP masing-masing.
            </p>
          )}
          <p className="sw-kelompok-max">
            Pilih teman (maks. {maxAnggota - 1} + Anda = {maxAnggota} orang)
          </p>
          {loadingRoster ? (
            <p className="sw-hint">Memuat daftar siswa…</p>
          ) : temanTersedia.length === 0 ? (
            <p className="sw-hint">Belum ada data siswa sekelas.</p>
          ) : (
            <ul className="sw-kelompok-pilih">
              {temanTersedia.map((s) => (
                <li key={s.id}>
                  <label className="sw-kelompok-check">
                    <input
                      type="checkbox"
                      checked={pilihIds.includes(s.id)}
                      disabled={busy || (!pilihIds.includes(s.id) && pilihIds.length + 1 >= maxAnggota)}
                      onChange={() => togglePilih(s.id)}
                    />
                    <span>{s.nama}</span>
                  </label>
                </li>
              ))}
            </ul>
          )}
          <div className="sw-kelompok-aksi">
            {kelompok ? (
              <>
                <button
                  type="button"
                  className="sw-btn sw-btn--primary"
                  disabled={busy}
                  onClick={() => void handleSimpanAnggota()}
                >
                  {busy ? 'Menyimpan…' : 'Simpan anggota'}
                </button>
                <button
                  type="button"
                  className="sw-btn sw-btn--ghost"
                  disabled={busy}
                  onClick={() => setModeEdit(false)}
                >
                  Batal
                </button>
              </>
            ) : (
              <button
                type="button"
                className="sw-btn sw-btn--primary"
                disabled={busy}
                onClick={() => void handleBuat()}
              >
                {busy ? 'Membuat…' : 'Buat kelompok (Anda ketua)'}
              </button>
            )}
          </div>
        </div>
      )}
    </section>
  )
}
