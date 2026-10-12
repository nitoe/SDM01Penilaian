import { namaDenganGelar } from '../types/user'

interface Props {
  nama: string
  gelar?: string
  jabatan?: string
  nbm?: string
  kota?: string
  tanggal?: string
  className?: string
}

/** Blok tanda tangan untuk rapor / dokumen resmi.
 * Menampilkan "Nama, Gelar" sesuai permintaan. */
export default function TandaTanganGuru({
  nama,
  gelar,
  jabatan = 'Guru Kelas',
  nbm,
  kota = 'Depok',
  tanggal,
  className = '',
}: Props) {
  const namaLengkap = namaDenganGelar({ nama, gelar })
  const tgl = tanggal || new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })

  return (
    <div className={`text-center text-[11px] leading-snug ${className}`}>
      <p>
        {kota}, {tgl}
      </p>
      <p className="mt-1 font-medium">{jabatan}</p>
      <div className="mt-10 min-h-[3.5rem]" />
      <p className="font-semibold underline decoration-1 underline-offset-2">{namaLengkap}</p>
      {nbm && <p className="text-[10px] text-muted">NBM. {nbm}</p>}
    </div>
  )
}
