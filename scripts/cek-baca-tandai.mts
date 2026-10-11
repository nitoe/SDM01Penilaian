// Uji logika Baca & Tandai (tanpa Firebase). Jalankan: npx tsx scripts/cek-baca-tandai.mts
import assert from 'node:assert/strict'
import {
  tandaKosong, ketukKata, setStatusAyat, ayatKritis, selaraskanRentang, hitungStat,
  bangunDetailAyat, bangunDetailIqro, pecahKata, ringkasDetailAyat, ringkasDetailIqro, normalisasiStatus, siklusKata, recordSetoran,
} from '../src/lib/bacaTandai.ts'
import { parseResponsSurah, audioAman, qariTersedia, QARI, QARI_BAWAAN } from '../src/lib/quranText.ts'
import { muatPreferensi, simpanPreferensi, PREFERENSI_BAWAAN } from '../src/lib/preferensiBaca.ts'
import { rentangLanjutan } from '../src/lib/lanjutan.ts'

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

// ---- Data Al-Qur'an dari EQuran.id ----
const contoh = {
  data: {
    nomor: 1, nama: 'الفاتحة', namaLatin: 'Al-Fatihah', arti: 'Pembukaan', tempatTurun: 'Mekah', jumlahAyat: 2,
    audioFull: { '05': 'https://cdn.equran.id/audio-full/Misyari-Rasyid-Al-Afasi/001.mp3', '01': 'https://cdn.equran.id/audio-full/Abdullah-Al-Juhany/001.mp3' },
    ayat: [
      { nomorAyat: 1, teksArab: 'ا ب', teksLatin: 'a b', teksIndonesia: 'terjemah 1', audio: { '05': 'https://cdn.equran.id/audio-partial/Misyari-Rasyid-Al-Afasi/001001.mp3', '07': 'https://cdn.equran.id/x.mp3' } },
      { nomorAyat: 2, teksArab: 'ت', audio: { '05': 'http://cdn.equran.id/tidak-https.mp3', '03': 'https://jahat.example.com/a.mp3' } },
    ],
  },
}
const sr = parseResponsSurah(contoh)
assert.equal(sr.namaLatin, 'Al-Fatihah'); assert.equal(sr.ayat.length, 2); assert.equal(sr.ayat[0]!.teksIndonesia, 'terjemah 1'); assert.equal(sr.ayat[1]!.teksLatin, '')
// hanya https di domain equran.id yang diterima sebagai audio
assert.deepEqual(Object.keys(sr.ayat[1]!.audio), []); assert.equal(sr.ayat[0]!.audio['05']!.startsWith('https://cdn.equran.id/'), true)
assert.equal(audioAman('https://equran.id/a.mp3'), 'https://equran.id/a.mp3'); assert.equal(audioAman('https://evilequran.id/a.mp3'), null)
assert.equal(audioAman('https://equran.id.jahat.com/a.mp3'), null); assert.equal(audioAman('javascript:alert(1)'), null); assert.equal(audioAman(undefined), null)
// qari yang tersedia: urut sesuai daftar resmi, ID baru ikut ditampilkan
assert.deepEqual(qariTersedia(sr).map((q) => q.id), ['01', '05', '07']); assert.equal(qariTersedia(sr)[2]!.nama, 'Qari 07')
assert.deepEqual(QARI.map((q) => q.id), ['01', '02', '03', '04', '05', '06']); assert.equal(QARI_BAWAAN, '05')
assert.throws(() => parseResponsSurah({}), /tidak dikenali/); assert.throws(() => parseResponsSurah({ data: { ayat: [] } }), /tidak lengkap/)
assert.throws(() => parseResponsSurah({ data: { ayat: [{ nomorAyat: 'x', teksArab: 'a' }] } }), /tidak lengkap/)
assert.throws(() => parseResponsSurah({ data: { ayat: [{ nomorAyat: 1, teksArab: '' }] } }), /tidak lengkap/)

// ---- Preferensi baca ----
const gudang = () => { const m = new Map<string, string>(); return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) } }
let g = gudang(); assert.deepEqual(muatPreferensi(g), PREFERENSI_BAWAAN)
simpanPreferensi({ qari: '03', latin: true, terjemah: false, ukuran: 3 }, g); assert.deepEqual(muatPreferensi(g), { qari: '03', latin: true, terjemah: false, ukuran: 3 })
g = gudang(); g.setItem('tt_pref_baca_v1', '{"qari":"x","ukuran":9,"latin":"ya"}'); assert.deepEqual(muatPreferensi(g), PREFERENSI_BAWAAN) // nilai rusak → bawaan
g = gudang(); g.setItem('tt_pref_baca_v1', 'bukan json'); assert.deepEqual(muatPreferensi(g), PREFERENSI_BAWAAN)

// ---- Lanjutkan dari setoran terakhir ----
const rec = (o: Record<string, unknown>) => recordSetoran('r', { jenis: 'ziyadah', ...o })
const qr = (surah: number, a: number, b: number) => ({ materi: { tipe: 'quran', surahAwal: surah, surahAkhir: surah, ayatMulai: a, ayatAkhir: b, label: 'x' } })
assert.deepEqual(rentangLanjutan(rec({ ...qr(67, 1, 10), statusHafalan: 'lulus' })), { surah: 67, mulai: 11, akhir: 20 })   // panjang rentang sama
assert.deepEqual(rentangLanjutan(rec({ ...qr(67, 1, 10), statusHafalan: 'ulang' })), { surah: 67, mulai: 1, akhir: 10 })    // belum lulus → ulangi
assert.deepEqual(rentangLanjutan(rec({ ...qr(67, 21, 28), statusHafalan: 'lulus' })), { surah: 67, mulai: 29, akhir: 30 })  // dipotong di akhir surah (Al-Mulk 30 ayat)
assert.equal(rentangLanjutan(rec({ ...qr(67, 21, 30), statusHafalan: 'lulus' })), null)                                    // surah selesai
assert.equal(rentangLanjutan(rec({ materi: { tipe: 'iqro', buku: 1, halamanMulai: 1, halamanAkhir: 2, label: 'x' } })), null)
assert.equal(rentangLanjutan(rec({ materi: { tipe: 'quran', surahAwal: 1, surahAkhir: 2, ayatMulai: 1, ayatAkhir: 3, label: 'x' } })), null) // lintas surah
assert.equal(rentangLanjutan(null), null); assert.equal(rentangLanjutan(undefined), null)
assert.equal(rentangLanjutan(rec({ ...qr(78, 1, 40), statusHafalan: 'lulus' })), null) // An-Naba 40 ayat → selesai
console.log('SEMUA UJI LULUS')
