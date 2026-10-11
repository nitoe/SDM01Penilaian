import type { SiswaTahsin } from '../types/tahsin'

interface PanelSiswaProps {
  kelasOptions: string[]
  kelasFilter: string
  onKelas: (k: string) => void
  search: string
  onSearch: (s: string) => void
  memuat: boolean
  /** Daftar yang sudah disaring pencarian */
  daftar: SiswaTahsin[]
  terpilih: SiswaTahsin | null
  onPilih: (s: SiswaTahsin) => void
}

const inisial = (nama: string) =>
  nama
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase()

/** Panel pemilih siswa: chip kelas, pencarian, dan daftar yang mengisi tinggi layar. Dipakai ulang oleh halaman Tahsin lain. */
export default function PanelSiswa({
  kelasOptions,
  kelasFilter,
  onKelas,
  search,
  onSearch,
  memuat,
  daftar,
  terpilih,
  onPilih,
}: PanelSiswaProps) {
  return (
    <section className="card-soft flex flex-col p-3.5 lg:max-h-[calc(100vh-7.5rem)]" aria-label="Pilih siswa">
      <div className="flex items-baseline justify-between">
        <h2 className="text-[13px] font-semibold text-slate-800">Siswa</h2>
        {!memuat && (
          <span className="text-[11px] text-muted">
            {daftar.length} siswa · {kelasFilter}
          </span>
        )}
      </div>

      <div className="mt-2.5 flex flex-wrap gap-1" role="group" aria-label="Kelas">
        {kelasOptions.map((k) => (
          <button
            key={k}
            type="button"
            aria-pressed={kelasFilter === k}
            onClick={() => onKelas(k)}
            className={`rounded-lg px-2.5 py-1 text-[12px] font-semibold transition ${
              kelasFilter === k ? 'bg-muh-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {k}
          </button>
        ))}
      </div>

      <input
        type="search"
        value={search}
        onChange={(e) => onSearch(e.target.value)}
        placeholder="Cari nama atau NIS…"
        aria-label="Cari siswa"
        className="mt-2.5 w-full rounded-xl border border-border bg-slate-50/70 px-3 py-2 text-[13px] outline-none transition focus:border-muh-500 focus:bg-white focus:ring-2 focus:ring-muh-500/20"
      />

      <div className="mt-2.5 min-h-0 flex-1 overflow-y-auto rounded-xl border border-border max-h-72 lg:max-h-none">
        {memuat ? (
          <p className="p-4 text-center text-[12px] text-muted">Memuat siswa…</p>
        ) : daftar.length === 0 ? (
          <p className="p-4 text-center text-[12px] text-muted">
            Tidak ada siswa{search ? ' yang cocok' : ` di kelas ${kelasFilter}`}.
          </p>
        ) : (
          <ul>
            {daftar.map((s) => {
              const aktif = terpilih?.id === s.id
              return (
                <li key={s.id} className="border-b border-border last:border-0">
                  <button
                    type="button"
                    aria-current={aktif ? 'true' : undefined}
                    onClick={() => onPilih(s)}
                    className={`flex w-full items-center gap-2.5 px-3 py-2 text-left transition ${
                      aktif ? 'bg-muh-50' : 'hover:bg-slate-50'
                    }`}
                  >
                    <span
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold ${
                        aktif ? 'bg-muh-600 text-white' : 'bg-muh-50 text-muh-700'
                      }`}
                    >
                      {inisial(s.nama)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-medium text-slate-900">{s.nama}</span>
                      <span className="block text-[11px] text-muted">
                        {s.jenjang === 'iqro' && !s.tamatIqro ? 'Iqro' : "Al-Qur'an"}
                        {s.nis ? ` · ${s.nis}` : ''}
                      </span>
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </section>
  )
}
