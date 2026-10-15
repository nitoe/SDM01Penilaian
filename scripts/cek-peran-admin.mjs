// Uji peran admin sebagai pemantau (ANTIREGRESI §17).
// Jalankan: node --experimental-strip-types scripts/cek-peran-admin.mjs
import { readFileSync } from 'node:fs'
import { isGuruAkademikRole, isGuruTahsinRole, teksPeran } from '../src/lib/roles.ts'

let gagal = 0
const cek = (nama, ok) => {
  if (!ok) gagal++
  console.log(`${ok ? 'LULUS' : 'GAGAL'}  ${nama}`)
}

cek('admin bukan guru akademik (tidak menulis TP/bobot/nilai)', !isGuruAkademikRole('admin'))
cek('admin bukan guru tahsin (tidak menulis setoran/target)', !isGuruTahsinRole('admin'))
cek('guru kombinasi boleh menulis akademik dan tahsin', isGuruAkademikRole('guru') && isGuruTahsinRole('guru'))
cek('guru_akademik tidak menulis tahsin', !isGuruTahsinRole('guru_akademik'))
cek('guru_tahsin_tahfizh tidak menulis akademik', !isGuruAkademikRole('guru_tahsin_tahfizh'))
cek('teksPeran memilih teks admin', teksPeran(true, 'Setup TP', 'Tujuan Pembelajaran') === 'Tujuan Pembelajaran')
cek('teksPeran memilih teks guru', teksPeran(false, 'Setup TP', 'Tujuan Pembelajaran') === 'Setup TP')

// Rules: admin tidak boleh ada di jalur tulis.
const rules = readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8')
const blok = (nama) => {
  const i = rules.indexOf(`match /${nama}/`)
  const j = rules.indexOf('\n    match /', i + 10)
  return rules.slice(i, j === -1 ? undefined : j)
}
for (const kol of ['setoran', 'menulis_log', 'target_hafalan']) {
  const b = blok(kol)
  const tulis = b.split('\n').filter((l) => /allow (create|update|delete)/.test(l) || /^\s+&&/.test(l))
  cek(`${kol}: jalur tulis tidak memuat isAdmin()`, !tulis.some((l) => l.includes('isAdmin()')))
}
for (const kol of ['nilai_tp', 'asesmen_cakupan', 'nilai_sts', 'nilai_sas']) {
  const b = blok(kol)
  cek(`${kol}: delete ditolak untuk semua`, /allow delete: if false/.test(b))
}
cek('seni_kelas: tulis lewat waliKelasSendiri (tanpa admin)', /allow write: if waliKelasSendiri\(kelas\)/.test(blok('seni_kelas')))
cek('bolehKelas tidak memuat role admin', !/function bolehKelas[\s\S]*?\n    }/.exec(rules)[0].includes("'admin'"))

if (gagal) {
  console.log(`\n${gagal} uji GAGAL`)
  process.exit(1)
}
console.log('\nSEMUA UJI LULUS')
