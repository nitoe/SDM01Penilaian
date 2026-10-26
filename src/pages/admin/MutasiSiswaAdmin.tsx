import { useCallback, useEffect, useMemo, useState } from 'react'
import Tabs, { type TabItem } from '../../components/Tabs'
import { Badge, PageHeader } from '../../components/ui'
import { Spinner, btnGhost, btnPrimary, useToast } from '../akademik/shared'
import {
  listArsipMutasi,
  listPengajuanAdmin,
  setujuiPengajuan,
  tolakPengajuan,
} from '../../lib/mutasi'
import { isAdminRole } from '../../lib/roles'
import { namaDenganGelar, type AppUser } from '../../types/user'
import {
  ARAH_LABEL,
  STATUS_PENGAJUAN_LABEL,
  type ArsipSiswaMutasi,
  type PengajuanMutasi,
  type StatusPengajuanMutasi,
} from '../../types/mutasi'
import { usePeriodeAkademik } from '../../lib/usePeriodeAkademik'

type TabId = 'antrian' | 'semua' | 'arsip'

function nadaStatus(s: StatusPengajuanMutasi): 'green' | 'peach' | 'neutral' {
  if (s === 'disetujui') return 'green'
  if (s === 'diajukan') return 'peach'
  // ditolak / dibatalkan — Badge tidak punya tone "red"
  return 'neutral'
}

const WAKTU = new Intl.DateTimeFormat('id-ID', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})

export default function MutasiSiswaAdmin({ profile }: { profile: AppUser }) {
  const toast = useToast()
  const periode = usePeriodeAkademik()
  const [tab, setTab] = useState<TabId>('antrian')
  const [pengajuan, setPengajuan] = useState<PengajuanMutasi[] | null>(null)
  const [arsip, setArsip] = useState<ArsipSiswaMutasi[] | null>(null)
  const [buka, setBuka] = useState<string | null>(null)
  const [catatan, setCatatan] = useState('')
  const [busy, setBusy] = useState(false)

  const muat = useCallback(() => {
    listPengajuanAdmin()
      .then(setPengajuan)
      .catch(() => {
        setPengajuan([])
        toast.show('Gagal memuat pengajuan. Deploy rules mutasi terlebih dahulu.', true)
      })
    listArsipMutasi()
      .then(setArsip)
      .catch(() => setArsip([]))
  }, [toast])

  useEffect(() => {
    if (!isAdminRole(profile.role)) return
    muat()
  }, [profile.role, muat])

  const antrian = useMemo(
    () => (pengajuan ?? []).filter((p) => p.status === 'diajukan'),
    [pengajuan],
  )

  const tabs: TabItem[] = [
    { id: 'antrian', label: 'Menunggu', hitung: antrian.length },
    { id: 'semua', label: 'Semua pengajuan', hitung: pengajuan?.length ?? 0 },
    { id: 'arsip', label: 'Arsip mutasi', hitung: arsip?.length ?? 0 },
  ]

  async function setujui(p: PengajuanMutasi) {
    if (
      !confirm(
        p.arah === 'keluar'
          ? `Setujui mutasi keluar untuk ${p.siswaNama}? Siswa akan dinonaktifkan dari roster aktif.`
          : `Setujui mutasi masuk untuk ${p.siswaNama}? Siswa akan ditambahkan ke roster kelas ${p.kelas}.`,
      )
    ) {
      return
    }
    setBusy(true)
    try {
      await setujuiPengajuan(
        p.id,
        { uid: profile.uid, nama: namaDenganGelar(profile) },
        {
          catatanAdmin: catatan || undefined,
          tahunAjaran: periode.ready ? periode.tahunAjaran : undefined,
          semester: periode.ready ? periode.semester : undefined,
        },
      )
      toast.show('Mutasi disetujui dan dicatat di arsip.')
      setCatatan('')
      setBuka(null)
      muat()
    } catch (e) {
      console.error(e)
      toast.show(e instanceof Error ? e.message : 'Gagal menyetujui.', true)
    } finally {
      setBusy(false)
    }
  }

  async function tolak(p: PengajuanMutasi) {
    if (!confirm(`Tolak pengajuan mutasi ${p.siswaNama}?`)) return
    setBusy(true)
    try {
      await tolakPengajuan(p.id, { uid: profile.uid, nama: namaDenganGelar(profile) }, catatan || undefined)
      toast.show('Pengajuan ditolak.')
      setCatatan('')
      setBuka(null)
      muat()
    } catch (e) {
      toast.show(e instanceof Error ? e.message : 'Gagal menolak.', true)
    } finally {
      setBusy(false)
    }
  }

  if (!isAdminRole(profile.role)) {
    return (
      <div className="space-y-4">
        <PageHeader title="Mutasi Siswa" subtitle="Hanya administrator." />
        <p className="card-soft p-4 text-[13px] text-red-700">Akses ditolak.</p>
      </div>
    )
  }

  const daftarTampil = tab === 'antrian' ? antrian : tab === 'semua' ? pengajuan ?? [] : []

  return (
    <div className="space-y-5">
      <PageHeader
        back={{ to: '/admin', label: 'Administrasi' }}
        title="Mutasi Siswa"
        subtitle="Setujui atau tolak pengajuan wali kelas. Arsip mutasi hanya terlihat di sini."
      />

      <Tabs items={tabs} aktif={tab} onUbah={(id) => setTab(id as TabId)} ariaLabel="Tampilan mutasi">
        {tab !== 'arsip' && (
          <>
            {pengajuan === null && <Spinner />}
            {pengajuan && daftarTampil.length === 0 && (
              <p className="card-soft p-4 text-[13px] text-muted">Tidak ada data pada tampilan ini.</p>
            )}
            <ul className="space-y-2">
              {daftarTampil.map((p) => {
                const terbuka = buka === p.id
                return (
                  <li key={p.id} className="card-soft">
                    <button
                      type="button"
                      aria-expanded={terbuka}
                      onClick={() => {
                        setBuka(terbuka ? null : p.id)
                        setCatatan(p.catatanAdmin ?? '')
                      }}
                      className="flex w-full items-start justify-between gap-3 px-4 py-3 text-left"
                    >
                      <span className="min-w-0">
                        <span className="block text-[14px] font-semibold text-slate-900">
                          {ARAH_LABEL[p.arah]} · {p.siswaNama}
                        </span>
                        <span className="block text-[12px] text-muted">
                          Kelas {p.kelas} · {p.tanggal} · oleh {p.diajukanNama}
                          {p.diajukanAt ? ` · ${WAKTU.format(p.diajukanAt)}` : ''}
                        </span>
                      </span>
                      <Badge tone={nadaStatus(p.status)}>{STATUS_PENGAJUAN_LABEL[p.status]}</Badge>
                    </button>
                    {terbuka && (
                      <div className="space-y-3 border-t border-border px-4 py-3 text-[13px] text-slate-700">
                        <p>
                          <span className="font-medium">Alasan:</span> {p.alasan}
                        </p>
                        {p.sekolahTerkait && (
                          <p>
                            <span className="font-medium">
                              {p.arah === 'masuk' ? 'Sekolah asal' : 'Sekolah tujuan'}:
                            </span>{' '}
                            {p.sekolahTerkait}
                          </p>
                        )}
                        {p.catatan && (
                          <p>
                            <span className="font-medium">Catatan wali:</span> {p.catatan}
                          </p>
                        )}
                        {p.snapshot && (
                          <p className="text-[12px] text-muted">
                            NIS: {p.snapshot.nis || '—'} · NISN: {p.snapshot.nisn || '—'}
                          </p>
                        )}
                        {p.calonMasuk && (
                          <p className="text-[12px] text-muted">
                            Calon NIS: {p.calonMasuk.nis || '—'} · JK: {p.calonMasuk.jk || '—'}
                          </p>
                        )}
                        {p.status === 'diajukan' && (
                          <>
                            <label className="block text-[12px] font-medium text-slate-600">
                              Catatan admin (opsional)
                              <textarea
                                value={catatan}
                                onChange={(e) => setCatatan(e.target.value)}
                                rows={2}
                                maxLength={500}
                                className="mt-1 w-full rounded-lg border border-border bg-white px-3 py-2 text-[13px] font-normal outline-none focus:border-muh-500"
                              />
                            </label>
                            <div className="flex flex-wrap gap-2">
                              <button
                                type="button"
                                disabled={busy}
                                className={btnPrimary}
                                onClick={() => setujui(p)}
                              >
                                Setujui
                              </button>
                              <button
                                type="button"
                                disabled={busy}
                                className={btnGhost}
                                onClick={() => tolak(p)}
                              >
                                Tolak
                              </button>
                            </div>
                          </>
                        )}
                        {p.catatanAdmin && p.status !== 'diajukan' && (
                          <p className="rounded-lg bg-slate-50 p-2 text-[12px]">
                            <span className="font-medium">Catatan admin:</span> {p.catatanAdmin}
                          </p>
                        )}
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
          </>
        )}

        {tab === 'arsip' && (
          <>
            {arsip === null && <Spinner />}
            {arsip && arsip.length === 0 && (
              <p className="card-soft p-4 text-[13px] text-muted">
                Belum ada arsip. Arsip terisi setelah pengajuan disetujui.
              </p>
            )}
            <ul className="space-y-2">
              {arsip?.map((a) => (
                <li key={a.id} className="card-soft space-y-1 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[14px] font-semibold text-slate-900">
                        {ARAH_LABEL[a.arah]} · {a.siswaNama}
                      </p>
                      <p className="text-[12px] text-muted">
                        Kelas {a.kelas} · {a.tanggal}
                        {a.sekolahTerkait ? ` · ${a.sekolahTerkait}` : ''}
                      </p>
                    </div>
                    <Badge tone="green">Arsip</Badge>
                  </div>
                  <p className="text-[13px] text-slate-700">{a.alasan}</p>
                  <p className="text-[11px] text-muted">
                    Diajukan {a.diajukanNama}
                    {a.disetujuiAt ? ` · disetujui ${WAKTU.format(a.disetujuiAt)} oleh ${a.disetujuiNama}` : ''}
                    {a.siswaId ? ` · ID ${a.siswaId}` : ''}
                  </p>
                </li>
              ))}
            </ul>
          </>
        )}
      </Tabs>
      {toast.node}
    </div>
  )
}
