import { useCallback, useEffect, useState } from 'react'
import { PageHeader } from '../../components/ui'
import { getEkskulMaster, simpanEkskulMaster } from '../../lib/raporData'
import { BackLink, Notice, Spinner, btnPrimary, inputCls, useToast } from '../akademik/shared'
import type { Ekstrakurikuler } from '../../types/raporData'

/** Master daftar kegiatan ekstrakurikuler (admin). Wali kelas memilih dari daftar ini untuk rapor SAS. */
export default function KelolaEkstrakurikuler() {
  const [daftar, setDaftar] = useState<Ekstrakurikuler[] | null>(null)
  const [nama, setNama] = useState('')
  const [galat, setGalat] = useState('')
  const [sibuk, setSibuk] = useState(false)
  const toast = useToast()

  const muat = useCallback(() => {
    setGalat('')
    getEkskulMaster()
      .then(setDaftar)
      .catch(() => setGalat('Gagal memuat daftar. Pastikan rules terbaru sudah di-deploy.'))
  }, [])
  useEffect(muat, [muat])

  async function tambah() {
    if (!nama.trim()) return
    setSibuk(true)
    try {
      await simpanEkskulMaster(nama, true)
      setNama('')
      toast.show('Kegiatan ditambahkan.')
      muat()
    } catch {
      toast.show('Gagal menyimpan.', true)
    } finally {
      setSibuk(false)
    }
  }
  async function ubahAktif(e: Ekstrakurikuler) {
    try {
      await simpanEkskulMaster(e.nama, !e.aktif)
      muat()
    } catch {
      toast.show('Gagal mengubah status.', true)
    }
  }

  return (
    <div className="space-y-4">
      <BackLink to="/admin">Administrasi</BackLink>
      <PageHeader
        title="Ekstrakurikuler"
        subtitle="Daftar kegiatan yang dapat dipilih wali kelas saat mengisi rapor SAS. Kegiatan yang dinonaktifkan tidak muncul di pilihan, tetapi data lama tetap tercetak."
      />
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
        <button type="button" className={btnPrimary} disabled={sibuk || !nama.trim()} onClick={tambah}>
          Tambah
        </button>
      </div>
      {galat && <Notice tone="error">{galat}</Notice>}
      {!galat && daftar === null && <Spinner />}
      {daftar && daftar.length === 0 && <Notice>Belum ada kegiatan. Tambahkan yang pertama di atas.</Notice>}
      <ul className="space-y-2">
        {daftar?.map((e) => (
          <li key={e.id} className="card-soft flex items-center justify-between gap-3 px-4 py-2.5">
            <span className={`text-[13.5px] ${e.aktif ? 'font-medium text-slate-900' : 'text-slate-400 line-through'}`}>
              {e.nama}
            </span>
            <button type="button" className="text-[12px] font-medium text-muh-700 hover:underline" onClick={() => ubahAktif(e)}>
              {e.aktif ? 'Nonaktifkan' : 'Aktifkan'}
            </button>
          </li>
        ))}
      </ul>
      {toast.node}
    </div>
  )
}
