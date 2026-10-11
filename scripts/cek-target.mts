// Uji logika Target Hafalan (tanpa Firebase). Jalankan: npx tsx scripts/cek-target.mts
import assert from 'node:assert/strict'
import { recordSetoran } from '../src/lib/bacaTandai.ts'
import { SURAH_LIST, surahByNo } from '../src/lib/quranSurah.ts'
import {
  SURAH_JUZ_29, SURAH_JUZ_30, bangunTarget, hitungProgresSurah, iqroTercapai, jenjangKelas, persenSurah,
  posisiIqro, ringkasKualitasBacaan, surahTercapai,
} from '../src/lib/target.ts'

// jenjang per kelas & daftar juz
assert.equal(jenjangKelas('1A'), 'iqro'); assert.equal(jenjangKelas('2B'), 'iqro'); assert.equal(jenjangKelas('3A'), 'quran'); assert.equal(jenjangKelas('6B'), 'quran')
assert.equal(SURAH_JUZ_30.length, 37); assert.equal(SURAH_JUZ_30[0], 78); assert.equal(SURAH_JUZ_30.at(-1), 114)
assert.equal(SURAH_JUZ_29.length, 11); assert.equal(SURAH_JUZ_29[0], 67); assert.equal(SURAH_JUZ_29.at(-1), 77)
assert.equal(surahByNo(67)!.nama.includes('Mulk'), true)

// bentuk simpan (sama dengan v2)
assert.deepEqual(bangunTarget('5A', { labelSemester: '  Ganjil  ', surah: new Set([114, 78, 78, 999, 0]), jilid: 3, halaman: 9 }),
  { jenjang: 'quran', labelSemester: 'Ganjil', targetSurah: [78, 114] })
assert.deepEqual(bangunTarget('1A', { labelSemester: 'S1', surah: [], jilid: 3, halaman: 12 }), { jenjang: 'iqro', labelSemester: 'S1', targetJilid: 3, targetHalaman: 12 })
assert.deepEqual(bangunTarget('1A', { labelSemester: '', surah: [], jilid: 99, halaman: -4 }), { jenjang: 'iqro', labelSemester: '', targetJilid: 6, targetHalaman: 1 })

// progres: hanya ziyadah + lulus + quran + satu surah target; ambil ayat akhir tertinggi
const q = (jenis: string, status: string | null, surah: number, a: number, b: number, akhirSurah = surah) =>
  recordSetoran('r', { jenis, statusHafalan: status, materi: { tipe: 'quran', surahAwal: surah, surahAkhir: akhirSurah, ayatMulai: a, ayatAkhir: b, label: 'x' } })
const riwayat = [
  q('ziyadah', 'lulus', 67, 1, 10), q('ziyadah', 'lulus', 67, 11, 20), q('ziyadah', 'ulang', 67, 21, 30),   // ulang tidak dihitung
  q('murojaah', 'lulus', 67, 1, 30),                                                                          // murojaah tidak dihitung
  q('ziyadah', 'lulus', 1, 1, 7), q('ziyadah', 'lulus', 1, 1, 3, 2),                                          // lintas surah tidak dihitung
  recordSetoran('i', { jenis: 'tahsin', statusHafalan: null, materi: { tipe: 'iqro', buku: 2, halamanMulai: 1, halamanAkhir: 8, label: 'x' } }),
]
const pr = hitungProgresSurah([67, 1, 78], riwayat)
assert.deepEqual(pr, [{ surahNo: 67, maxAyatAkhir: 20 }, { surahNo: 1, maxAyatAkhir: 7 }, { surahNo: 78, maxAyatAkhir: 0 }])
assert.equal(persenSurah(pr[0]!), 67); assert.equal(surahTercapai(pr[0]!), false)   // 20/30
assert.equal(persenSurah(pr[1]!), 100); assert.equal(surahTercapai(pr[1]!), true)   // Al-Fatihah 7/7
assert.equal(persenSurah(pr[2]!), 0); assert.deepEqual(hitungProgresSurah(undefined, riwayat), [])

// Iqro
assert.deepEqual(posisiIqro(riwayat), { jilid: 2, halaman: 8 }); assert.deepEqual(posisiIqro([]), { jilid: 1, halaman: 0 })
assert.equal(iqroTercapai({ targetJilid: 2, targetHalaman: 8 }, { jilid: 2, halaman: 8 }), true)
assert.equal(iqroTercapai({ targetJilid: 2, targetHalaman: 9 }, { jilid: 2, halaman: 8 }), false)
assert.equal(iqroTercapai({ targetJilid: 2, targetHalaman: 30 }, { jilid: 3, halaman: 1 }), true)   // jilid lebih tinggi = tercapai
assert.equal(iqroTercapai({}, { jilid: 1, halaman: 1 }), true)

// kualitas bacaan: 5 sesi terbaru yang punya detail
assert.equal(ringkasKualitasBacaan(riwayat), null)
const sesi = (n: number, kataSalah: { index: number; jenis: string }[]) =>
  recordSetoran(`s${n}`, { jenis: 'ziyadah', detailAyat: [{ ayat: 1, status: 'lulus', kataSalah }, { ayat: 2, status: 'gagal', kataSalah: [] }] })
const banyak = [1, 2, 3, 4, 5, 6].map((n) => sesi(n, [{ index: 0, jenis: 'tajwid' }, { index: 1, jenis: 'makhroj' }]))
assert.deepEqual(ringkasKualitasBacaan(banyak), { sesi: 5, ayatDinilai: 10, tajwid: 5, makhroj: 5 })  // sesi ke-6 diabaikan
const iqroLatihan = recordSetoran('l', { jenis: 'tahsin', detailBacaanIqro: { teks: 'a b', kataSalah: [{ index: 0, jenis: 'makhroj' }] } })
assert.deepEqual(ringkasKualitasBacaan([iqroLatihan]), { sesi: 1, ayatDinilai: 1, tajwid: 0, makhroj: 1 })
console.log('SEMUA UJI LULUS')
