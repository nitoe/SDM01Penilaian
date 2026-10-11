// Uji logika Baca & Tandai (tanpa Firebase). Jalankan: npx tsx scripts/cek-baca-tandai.mts
import assert from 'node:assert/strict'
import {
  tandaKosong, ketukKata, setStatusAyat, ayatKritis, selaraskanRentang, hitungStat,
  bangunDetailAyat, bangunDetailIqro, pecahKata, ringkasDetailAyat, ringkasDetailIqro, normalisasiStatus, siklusKata,
} from '../src/lib/bacaTandai.ts'
import { parseResponsSurah } from '../src/lib/quranText.ts'

// siklus ketuk kata: tajwid → makhroj → bersih
let t = tandaKosong()
t = ketukKata(t, 2); assert.deepEqual(t.kata, { 2: 'tajwid' })
t = ketukKata(t, 2); assert.deepEqual(t.kata, { 2: 'makhroj' })
t = ketukKata(t, 2); assert.deepEqual(t.kata, {})
assert.equal(siklusKata(undefined), 'tajwid')

// status ayat: ketuk dua kali = batal; pindah status langsung
let s = setStatusAyat(tandaKosong(), 'lulus'); assert.equal(s.status, 'lulus')
assert.equal(setStatusAyat(s, 'lulus').status, null)
assert.equal(setStatusAyat(s, 'gagal').status, 'gagal')

// ayat kritis: >= 3 kata salah
let k = tandaKosong(); for (const i of [0, 1]) k = ketukKata(k, i)
assert.equal(ayatKritis(k), false); k = ketukKata(k, 5); assert.equal(ayatKritis(k), true)

// rentang: tanda dalam rentang dipertahankan, di luar dibuang
let per = selaraskanRentang({}, 1, 3)
per[2] = setStatusAyat(per[2]!, 'gagal'); per[3] = ketukKata(per[3]!, 0)
const geser = selaraskanRentang(per, 2, 5)
assert.deepEqual(Object.keys(geser).map(Number), [2, 3, 4, 5])
assert.equal(geser[2]!.status, 'gagal'); assert.deepEqual(geser[3]!.kata, { 0: 'tajwid' }); assert.equal(geser[4]!.status, null)
assert.equal(geser[1], undefined)

// statistik
per = selaraskanRentang({}, 1, 4)
per[1] = setStatusAyat(ketukKata(ketukKata(per[1]!, 0), 0), 'lulus')   // makhroj + lulus
per[2] = setStatusAyat(ketukKata(per[2]!, 3), 'gagal')                 // tajwid + gagal
per[3] = ketukKata(per[3]!, 1)                                         // tajwid saja
assert.deepEqual(hitungStat(per), { tajwid: 2, makhroj: 1, lulus: 1, gagal: 1 })

// bentuk simpan = bentuk v2: {ayat, status, kataSalah:[{index,jenis}]}, hanya ayat bertanda, urut
assert.deepEqual(bangunDetailAyat(per), [
  { ayat: 1, status: 'lulus', kataSalah: [{ index: 0, jenis: 'makhroj' }] },
  { ayat: 2, status: 'gagal', kataSalah: [{ index: 3, jenis: 'tajwid' }] },
  { ayat: 3, status: null, kataSalah: [{ index: 1, jenis: 'tajwid' }] },
])
assert.deepEqual(bangunDetailAyat(selaraskanRentang({}, 1, 5)), [])

// Iqro
assert.equal(bangunDetailIqro('   ', {}), null)
assert.deepEqual(bangunDetailIqro(' با تا ثا ', { 1: 'tajwid' }), { teks: 'با تا ثا', kataSalah: [{ index: 1, jenis: 'tajwid' }] })
assert.deepEqual(pecahKata('  با   تا\nثا '), ['با', 'تا', 'ثا'])

// ringkasan = kata-kata v2
assert.equal(ringkasDetailAyat(bangunDetailAyat(per)), '1 ayat lulus • 1 ayat diulang • 2 tajwid • 1 makhroj')
assert.equal(ringkasDetailAyat([]), ''); assert.equal(ringkasDetailAyat(undefined), '')
assert.equal(ringkasDetailIqro(null), 'Bersih (tanpa catatan)'); assert.equal(ringkasDetailIqro({ teks: 'x', kataSalah: [] }), 'Bersih (tanpa catatan)')
assert.equal(ringkasDetailIqro({ teks: 'x', kataSalah: [{ index: 0, jenis: 'tajwid' }, { index: 1, jenis: 'makhroj' }] }), '1 tajwid • 1 makhroj')

// istilah status: v2 + data awal situs baru
assert.equal(normalisasiStatus('lulus'), 'lulus'); assert.equal(normalisasiStatus('ulang'), 'ulang')
assert.equal(normalisasiStatus('mengulang'), 'ulang'); assert.equal(normalisasiStatus('belum'), 'ulang')
assert.equal(normalisasiStatus(null), null); assert.equal(normalisasiStatus(undefined), null); assert.equal(normalisasiStatus('apa'), null)

// respons API
assert.deepEqual(parseResponsSurah({ data: { ayat: [{ nomorAyat: 1, teksArab: 'ا ب' }, { nomorAyat: 2, teksArab: 'ت' }] } }),
  [{ nomorAyat: 1, teksArab: 'ا ب' }, { nomorAyat: 2, teksArab: 'ت' }])
assert.throws(() => parseResponsSurah({}), /tidak dikenali/); assert.throws(() => parseResponsSurah({ data: { ayat: [] } }), /tidak lengkap/)
assert.throws(() => parseResponsSurah({ data: { ayat: [{ nomorAyat: 'x', teksArab: 'a' }] } }), /tidak lengkap/)
console.log('SEMUA UJI LULUS')
