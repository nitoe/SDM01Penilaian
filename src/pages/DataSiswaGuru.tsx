import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { doc, getDoc } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { kelasSaya } from '../lib/kelasSaya'
import { listAllSiswa } from '../lib/siswaAdmin'
import { gabungSiswa } from '../lib/siswaImport'
import { isAdminRole } from '../lib/roles'
import { SEMUA_KELAS } from '../types/tahsin'
import type { SiswaTahsin } from '../types/tahsin'
import type { AppUser } from '../types/user'
import { PageHeader } from '../components/ui'
import { ChipToggle, Notice, Spinner, inputCls } from './akademik/shared'

interface Props {
  profile: AppUser
}

/** Kelas yang boleh dilihat guru: wali + penugasan akademik + kelasAmpu Tahsin, urut 1A→6B. */
function kelasYangDiampu(p: AppUser): string[] {
  const akademik = kelasSaya(p).semua
  const tahsin = p.kelasAmpu ?? []
  const set = new Set([...akademik, ...tahsin])
  return SEMUA_KELAS.filter((k) => set.has(k))
}

function isWaliKelas(p: AppUser, kelas: string): boolean {
  return (p.waliKelas ?? []).includes(kelas)
}

export default function DataSiswaGuru({ profile }: Props) {
  const kelasSayaList = useMemo(() => kelasYangDiampu(profile), [profile])
  const [kelasFilter, setKelasFilter] = useState(kelasSayaList[0] || '')
  const [list, setList] = useState<SiswaTahsin[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<SiswaTahsin | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!kelasFilter) {
      setList([])
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const dasar = await listAllSiswa(kelasFilter)
      const aktif = dasar.filter((s) => s.aktif !== false)

      // Wali kelas boleh membaca biodata sensitif; guru lain hanya data dasar.
      if (isWaliKelas(profile, kelasFilter)) {
        const snaps = await Promise.all(
          aktif.map((s) => getDoc(doc(db, 'identitas_siswa', s.id))),
        )
        const gabung = aktif.map((s, i) =>
          gabungSiswa(s, snaps[i]!.exists() ? snaps[i]!.data() : null),
        )
        setList(gabung)
      } else {
        setList(aktif)
      }
    } catch (e) {
      console.error(e)
      setError('Gagal memuat data siswa. Periksa koneksi atau hak akses.')
      setList([])
    } finally {
      setLoading(false)
    }
  }, [kelasFilter, profile])

  useEffect(() => {
    void load()
  }, [load])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return list
    return list.filter((s) => {
      const blob = [s.nama, s.nis, s.nipd, s.nisn, s.kelas, s.hp, s.ayahNama, s.ibuNama]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return blob.includes(q)
    })
  }, [list, search])

  const asideRef = useRef<HTMLElement>(null)
  useEffect(() => {
    if (selected && window.matchMedia('(max-width: 1023px)').matches) {
      asideRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [selected])

  // Admin punya halaman sendiri di /admin/siswa
  if (isAdminRole(profile.role)) {
    return <Navigate to="/admin/siswa" replace />
  }

  if (kelasSayaList.length === 0) {
    return (
      <div className="space-y-5">
        <PageHeader
          title="Data Siswa"
          subtitle="Daftar siswa di kelas yang Anda ampu."
        />
        <Notice tone="warn">
          Akun Anda belum memiliki kelas yang diampu (wali kelas, penugasan mapel, atau kelas Tahsin).
          Hubungi administrator untuk mengatur penugasan.
        </Notice>
      </div>
    )
  }

  const waliIni = isWaliKelas(profile, kelasFilter)
  const backTo = profile.role === 'guru_tahsin_tahfizh' ? '/tahsin' : '/akademik'

  return (
    <div className="space-y-5 pb-16">
      <PageHeader
        back={{ to: backTo, label: backTo === '/tahsin' ? 'Tahsin-Tahfizh' : 'Akademik & Rapor' }}
        title="Data Siswa"
        subtitle={
          waliIni
            ? `Kelas ${kelasFilter} · Anda wali kelas — biodata lengkap tersedia. ${list.length} siswa aktif.`
            : `Kelas ${kelasFilter} · data dasar (nama, NIPD, kelas, JK, TTL). ${list.length} siswa aktif.`
        }
      />

      {error && <Notice tone="error">{error}</Notice>}

      <div className="grid items-start gap-5 lg:grid-cols-[1fr_340px]">
        <section className="card-soft p-4" aria-label="Daftar siswa">
          <div className="flex flex-wrap gap-1.5">
            {kelasSayaList.map((k) => (
              <ChipToggle
                key={k}
                active={kelasFilter === k}
                onClick={() => {
                  setKelasFilter(k)
                  setSelected(null)
                  setSearch('')
                }}
              >
                {k}
                {isWaliKelas(profile, k) ? ' · Wali' : ''}
              </ChipToggle>
            ))}
          </div>

          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari nama, NIPD, NISN…"
            aria-label="Cari siswa"
            className={`${inputCls} mt-3`}
          />

          <div className="mt-3 max-h-[34rem] overflow-auto rounded-lg border border-border">
            {loading ? (
              <Spinner />
            ) : filtered.length === 0 ? (
              <p className="p-8 text-center text-[13px] text-muted">
                Tidak ada siswa aktif di kelas {kelasFilter}.
              </p>
            ) : (
              <table className="w-full text-left text-[13px]">
                <thead className="sticky top-0 z-10 bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-3 py-2.5 font-semibold">Nama</th>
                    <th className="hidden px-3 py-2.5 font-semibold sm:table-cell">NIPD</th>
                    <th className="px-3 py-2.5 font-semibold">Kelas</th>
                    <th className="px-3 py-2.5 font-semibold">JK</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((siswa) => {
                    const terpilih = selected?.id === siswa.id
                    return (
                      <tr
                        key={siswa.id}
                        tabIndex={0}
                        aria-selected={terpilih}
                        onClick={() => setSelected(siswa)}
                        onKeyDown={(e) => {
                          if (e.target !== e.currentTarget) return
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault()
                            setSelected(siswa)
                          }
                        }}
                        className={`cursor-pointer border-t border-border transition-colors hover:bg-slate-50 focus-visible:bg-slate-50 ${
                          terpilih ? 'bg-muh-50 hover:bg-muh-50' : ''
                        }`}
                      >
                        <td
                          className={`px-3 py-2.5 font-medium text-slate-900 ${
                            terpilih ? 'shadow-[inset_3px_0_0_0_var(--color-muh-600)]' : ''
                          }`}
                        >
                          {siswa.nama}
                        </td>
                        <td className="tabular hidden px-3 py-2.5 text-muted sm:table-cell">
                          {siswa.nipd || siswa.nis || siswa.id}
                        </td>
                        <td className="px-3 py-2.5">{siswa.kelas}</td>
                        <td className="px-3 py-2.5">{siswa.jk || '—'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
          <p className="tabular mt-2 text-[12px] text-muted">{filtered.length} ditampilkan</p>
        </section>

        <aside ref={asideRef} className="card-soft p-4 lg:sticky lg:top-20" aria-label="Detail siswa">
          {!selected ? (
            <p className="text-[13px] leading-relaxed text-muted">
              Pilih baris siswa untuk melihat detail.
              {waliIni
                ? ' Sebagai wali kelas Anda dapat melihat biodata lengkap.'
                : ' Hanya data dasar yang ditampilkan untuk kelas ini.'}
            </p>
          ) : (
            <div className="space-y-4 text-[13px]">
              <div>
                <div className="text-[15px] font-semibold text-slate-900">{selected.nama}</div>
                <div className="mt-0.5 text-[12px] text-muted">
                  {selected.kelas} · {selected.jenjang === 'iqro' ? 'Iqro' : "Al-Qur'an"} · NIPD{' '}
                  {selected.nipd || selected.id}
                </div>
              </div>

              <dl className="space-y-2 border-t border-border pt-3">
                {(
                  [
                    ['NISN', selected.nisn],
                    ['JK', selected.jk],
                    [
                      'TTL',
                      [selected.tempatLahir, selected.tanggalLahir].filter(Boolean).join(', '),
                    ],
                    ['Jenjang', selected.jenjang === 'iqro' ? 'Iqro' : "Al-Qur'an"],
                    ...(waliIni
                      ? ([
                          ['Agama', selected.agama],
                          ['Alamat', selected.alamat],
                          ['RT/RW', [selected.rt, selected.rw].filter(Boolean).join('/')],
                          ['Kelurahan', selected.kelurahan],
                          ['Kecamatan', selected.kecamatan],
                          ['Kode Pos', selected.kodePos],
                          ['HP', selected.hp],
                          ['Email', selected.email],
                          [
                            'Ayah',
                            [selected.ayahNama, selected.ayahPekerjaan].filter(Boolean).join(' · '),
                          ],
                          [
                            'Ibu',
                            [selected.ibuNama, selected.ibuPekerjaan].filter(Boolean).join(' · '),
                          ],
                          ['Sekolah asal', selected.sekolahAsal],
                          [
                            'BB/TB',
                            [
                              selected.beratBadan != null ? `${selected.beratBadan} kg` : null,
                              selected.tinggiBadan != null ? `${selected.tinggiBadan} cm` : null,
                            ]
                              .filter(Boolean)
                              .join(' / '),
                          ],
                        ] as [string, string | undefined][])
                      : []),
                  ] as [string, string | undefined][]
                ).map(([k, v]) =>
                  v ? (
                    <div key={k} className="grid grid-cols-[88px_1fr] gap-2">
                      <dt className="text-muted">{k}</dt>
                      <dd className="break-words font-medium text-slate-800">{v}</dd>
                    </div>
                  ) : null,
                )}
              </dl>

              {!waliIni && (
                <p className="text-[12px] leading-snug text-muted">
                  Biodata sensitif (alamat, HP, data orang tua) hanya dapat dilihat wali kelas.
                </p>
              )}
            </div>
          )}
        </aside>
      </div>
    </div>
  )
}
