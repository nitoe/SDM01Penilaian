// Uji logika disiplin Seni Budaya. Jalankan: node --experimental-strip-types scripts/cek-disiplin-seni.mjs
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  DISIPLIN_SENI_NAMA,
  adalahSeniBudaya,
  disiplinDariTeks,
  jumlahTanpaDisiplin,
  normalisasiDisiplinSeni,
  sarankanDisiplinSeni,
} from '../src/lib/disiplinSeniRumus.ts'

// Daftar nama harus identik dengan sumber kebenaran di seniKelas.ts (urutan juga).
const seniKelas = readFileSync(new URL('../src/lib/seniKelas.ts', import.meta.url), 'utf8')
const m = seniKelas.match(/DISIPLIN_SENI = \[([^\]]+)\] as const/)
assert.ok(m, 'DISIPLIN_SENI tidak ditemukan di seniKelas.ts')
assert.deepEqual([...m[1].matchAll(/'([^']+)'/g)].map((x) => x[1]), [...DISIPLIN_SENI_NAMA], 'daftar disiplin berbeda dengan seniKelas.ts')

// mapel
assert.equal(adalahSeniBudaya('Seni Budaya'), true)
assert.equal(adalahSeniBudaya('  seni  budaya '), true)
assert.equal(adalahSeniBudaya('Matematika'), false)
assert.equal(adalahSeniBudaya(undefined), false)

// normalisasi isian (Excel/JSON)
for (const [raw, harap] of [
  ['Seni Rupa', 'Seni Rupa'], ['seni rupa', 'Seni Rupa'], ['RUPA', 'Seni Rupa'], ['seni_rupa', 'Seni Rupa'], ['Seni-Musik', 'Seni Musik'],
  ['musik', 'Seni Musik'], ['Tari', 'Seni Tari'], ['seni  tari', 'Seni Tari'], ['Teater', 'Seni Teater'], ['drama', 'Seni Teater'], ['Seni Drama', 'Seni Teater'],
  ['', ''], [null, ''], [undefined, ''], ['Matematika', ''], ['seni lukis', ''], ['rupa dan musik', ''],
]) assert.equal(normalisasiDisiplinSeni(raw), harap, `normalisasi "${raw}"`)

// penyebutan eksplisit di teks bebas: hanya bila tepat satu disiplin
assert.equal(disiplinDariTeks('Seni Rupa - Berkarya'), 'Seni Rupa')
assert.equal(disiplinDariTeks('Mengalami', 'musik'), 'Seni Musik')
assert.equal(disiplinDariTeks('Seni Tari dan Seni Musik'), '', 'dua disiplin = tidak pasti')
assert.equal(disiplinDariTeks('Mengalami', 'Berkarya'), '', 'tanpa penyebutan disiplin')
assert.equal(disiplinDariTeks(undefined, null, ''), '')
assert.equal(disiplinDariTeks('menarik', 'sekretaris'), '', 'kata lain yang mengandung "tari" tidak dihitung')

// saran kata kunci: menang jelas → disiplin; ambigu/kosong → ''
const saran = (n, cp) => sarankanDisiplinSeni(n, cp)
assert.equal(saran('Menyanyikan lagu daerah dengan nada dan tempo yang tepat.').disiplin, 'Seni Musik')
assert.equal(saran('Menggambar objek di sekitar dengan garis dan warna.').disiplin, 'Seni Rupa')
assert.equal(saran('Membuat kolase dari bahan bekas.').disiplin, 'Seni Rupa')
assert.equal(saran('Memperagakan gerak tari daerah dengan iringan.').disiplin, 'Seni Tari')
assert.equal(saran('Memerankan tokoh dalam drama pendek dengan dialog.').disiplin, 'Seni Teater')
assert.equal(saran('Menampilkan pementasan teater sederhana di panggung kelas.').disiplin, 'Seni Teater')
assert.equal(saran('Mengekspresikan perasaan melalui gerak, nada, dan warna.').disiplin, '', 'seri antar-disiplin tidak ditebak')
assert.equal(saran('Menjelaskan manfaat kerja sama.').disiplin, '', 'tanpa kata kunci')
assert.equal(saran('').disiplin, '')
assert.equal(saran('Menggambarkan perasaan dengan kata-kata.').disiplin, '', '"menggambarkan" bukan menggambar')
assert.equal(saran('Menarik kesimpulan dari bacaan.').disiplin, '', '"menarik" bukan menari')
assert.equal(saran('Menyebutkan peran sekretaris kelas.').disiplin, '', 'kata lemah/bermakna ganda saja tidak cukup')
// CP ikut dihitung (setengah bobot) saat rumusan TP kurang jelas
assert.equal(saran('Mengolah bunyi.', 'Mengalami musik: lagu, nada, irama').disiplin, 'Seni Musik')
// alasan tampil untuk transparansi
assert.deepEqual(saran('Menyanyikan lagu dengan nada tepat.').alasan.sort(), ['lagu', 'menyanyikan', 'nada'])
assert.deepEqual(saran('Menjelaskan manfaat kerja sama.').alasan, [])

// hitung yang belum punya disiplin sah
assert.equal(jumlahTanpaDisiplin([{ disiplinSeni: 'Seni Rupa' }, {}, { disiplinSeni: '' }, { disiplinSeni: 'ngawur' }, { disiplinSeni: 'seni tari' }]), 3)
assert.equal(jumlahTanpaDisiplin(null), 0)

// Format Excel: kolom disiplin hanya boleh ditambah DI AKHIR (file lama tanpa kolom itu tetap terbaca).
const impor = readFileSync(new URL('../src/lib/tpImport.ts', import.meta.url), 'utf8')
assert.match(impor, /'level4_deskripsi',\n  'disiplinSeni',\n\] as const/, "kolom 'disiplinSeni' harus tepat setelah level4_deskripsi (paling akhir)")
assert.match(impor, /disiplin: 'disiplinSeni'/, 'alias header "Disiplin" hilang')
// Impor tidak boleh menebak disiplin dari makna rumusan TP; penebakan hanya lewat panel yang meminta konfirmasi guru.
assert.doesNotMatch(impor, /sarankanDisiplinSeni/, 'tpImport.ts tidak boleh memakai sarankanDisiplinSeni (penebakan diam-diam)')
const akademik = readFileSync(new URL('../src/lib/akademik.ts', import.meta.url), 'utf8')
assert.doesNotMatch(akademik, /sarankanDisiplinSeni/, 'akademik.ts tidak boleh menebak disiplin')

console.log('cek-disiplin-seni: lulus')
