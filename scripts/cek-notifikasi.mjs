// Uji logika notifikasi. Jalankan: node --experimental-strip-types scripts/cek-notifikasi.mjs
import { readFileSync } from 'node:fs'
import { validasiLaporan, susunDokumen, saringInbox, hitungPerJenis, statusBerikut } from '../src/lib/notifikasiRumus.ts'

let gagal = 0
const cek = (n, ok) => { if (!ok) gagal++; console.log(`${ok ? 'LULUS' : 'GAGAL'}  ${n}`) }

cek('judul kosong ditolak', validasiLaporan({ jenis: 'laporan_tugas', judul: ' ', isi: 'x' }).length === 1)
cek('isi kosong ditolak', validasiLaporan({ jenis: 'laporan_kendala', judul: 'a', isi: '' }).length === 1)
cek('laporan biasa valid', validasiLaporan({ jenis: 'laporan_kendala', judul: 'Proyektor rusak', isi: 'Kelas 5A' }).length === 0)
cek('judul >120 ditolak', validasiLaporan({ jenis: 'laporan_tugas', judul: 'a'.repeat(121), isi: 'x' }).length === 1)
cek('mutasi tanpa data ditolak', validasiLaporan({ jenis: 'mutasi_siswa', judul: 'a', isi: 'b' }).length === 3)
cek('mutasi lengkap valid', validasiLaporan({ jenis: 'mutasi_siswa', judul: 'a', isi: 'b', mutasi: { arah: 'masuk', namaSiswa: 'Ani', tanggal: '2026-10-15' } }).length === 0)
cek('tanggal format salah ditolak', validasiLaporan({ jenis: 'mutasi_siswa', judul: 'a', isi: 'b', mutasi: { arah: 'keluar', namaSiswa: 'Ani', tanggal: '15/10/2026' } }).length === 1)
cek('data mutasi pada laporan lain ditolak', validasiLaporan({ jenis: 'laporan_tugas', judul: 'a', isi: 'b', mutasi: { arah: 'masuk' } }).length === 1)

const dok = susunDokumen({ jenis: 'laporan_tugas', judul: ' J ', isi: ' I ' }, { uid: 'u1', nama: 'Guru' })
cek('dokumen: status baru, teks dipangkas, tanpa field kosong', dok.status === 'baru' && dok.judul === 'J' && dok.isi === 'I' && !('kelas' in dok) && !('mutasi' in dok))
const dm = susunDokumen({ jenis: 'mutasi_siswa', judul: 'a', isi: 'b', kelas: '5A', mutasi: { arah: 'masuk', namaSiswa: ' Ani ', tanggal: '2026-10-15' } }, { uid: 'u1', nama: 'G' })
cek('dokumen mutasi: nama dipangkas, tanpa keterangan kosong', dm.mutasi.namaSiswa === 'Ani' && !('keterangan' in dm.mutasi) && dm.kelas === '5A')

const d = [
  { id: '1', jenis: 'laporan_tugas', status: 'baru' },
  { id: '2', jenis: 'laporan_kendala', status: 'diproses' },
  { id: '3', jenis: 'mutasi_siswa', status: 'selesai' },
  { id: '4', jenis: 'mutasi_siswa', status: 'baru' },
]
cek('saring aktif = baru + diproses', saringInbox(d, 'semua', 'aktif').length === 3)
cek('saring jenis', saringInbox(d, 'mutasi_siswa', 'semua').length === 2)
cek('saring jenis + status', saringInbox(d, 'mutasi_siswa', 'selesai').length === 1)
const h = hitungPerJenis(d)
cek('hitung belum dibaca per jenis', h.semua === 2 && h.laporan_tugas === 1 && h.mutasi_siswa === 1 && h.laporan_kendala === 0)
cek('status berikut', statusBerikut('baru').join() === 'diproses,selesai' && statusBerikut('selesai').join() === 'diproses')

// Rules: koleksi notifikasi tidak boleh bisa diubah/hapus sembarangan.
const rules = readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8')
const i = rules.indexOf('match /notifikasi/')
const b = i === -1 ? '' : rules.slice(i, rules.indexOf('\n    match /', i + 10))
cek('rules: koleksi notifikasi terdaftar', i !== -1)
cek('rules: delete ditolak', /allow delete: if false/.test(b))
cek('rules: update hanya admin dan field terbatas', /allow update: if isAdmin\(\)/.test(b) && /affectedKeys\(\)\.hasOnly\(\['status', 'catatanAdmin', 'updatedAt'\]\)/.test(b))
cek('rules: create wajib dariUid sendiri dan status baru', /dariUid == request\.auth\.uid/.test(b) && /status == 'baru'/.test(b))
cek('rules: baca hanya admin atau pengirim', /allow read: if isAdmin\(\)\s*\|\|/.test(b))

if (gagal) { console.log(`\n${gagal} uji GAGAL`); process.exit(1) }
console.log('\nSEMUA UJI LULUS')
