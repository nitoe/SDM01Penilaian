// Uji rumus nilai Akademik. Jalankan: node --experimental-strip-types scripts/cek-rumus-akademik.mjs
import assert from 'node:assert/strict'
import {
  hitungNilaiAkhirTP, hitungNilaiAkhirMapel, normalisasiPersenBobotMapel, tentukanLevel, tpMasukSemester, validasiLevels,
} from '../src/lib/akademikRumus.ts'

const tp = { bobotSlm: 60, bobotSas: 40, tipe: 'pengetahuan', levels: [
  { min: 0, maks: 60, deskripsi: 'a' }, { min: 61, maks: 75, deskripsi: 'b' },
  { min: 76, maks: 85, deskripsi: 'c' }, { min: 86, maks: 100, deskripsi: 'd' } ] }

// SAS kosong → SLM saja
assert.equal(hitungNilaiAkhirTP(80, null, tp), 80)
assert.equal(hitungNilaiAkhirTP(80, '', tp), 80)
// SLM 80, SAS 90 → 80*.6 + 90*.4 = 84
assert.equal(hitungNilaiAkhirTP(80, 90, tp), 84)
// STS lebih tinggi menggantikan SLM; STS lebih rendah diabaikan
assert.equal(hitungNilaiAkhirTP(70, null, tp, 85), 85)
assert.equal(hitungNilaiAkhirTP(90, null, tp, 60), 90)
// SLM kosong → null
assert.equal(hitungNilaiAkhirTP(null, 90, tp), null)
// nilai 0 sah (bukan kosong)
assert.equal(hitungNilaiAkhirTP(0, null, tp), 0)

// Level
assert.equal(tentukanLevel(61, tp).index, 1)
assert.equal(tentukanLevel(86, tp).label, 'Sangat Baik')
assert.equal(tentukanLevel(null, tp), null)

// Nilai mapel: TP tanpa nilai tidak menimbang; kasus "15 dianggap persen" v2 §19.1
assert.equal(hitungNilaiAkhirMapel([{ nilai: 80, bobot: 50 }, { nilai: 90, bobot: 50 }]), 85)
assert.equal(hitungNilaiAkhirMapel([{ nilai: 80, bobot: 50 }, { nilai: null, bobot: 50 }]), 80)
assert.equal(hitungNilaiAkhirMapel([]), null)
assert.equal(hitungNilaiAkhirMapel([{ nilai: 100, bobot: 15 }, { nilai: 0, bobot: 1 }]), Math.round(1500 / 16))

assert.equal(tpMasukSemester({ semester: '1' }, '1'), true)
assert.equal(tpMasukSemester({ semester: '2' }, '1'), false)
assert.equal(tpMasukSemester({}, '2'), true)

// Normalisasi persen: total selalu 100 dan rasio terjaga
for (const n of [1, 2, 3, 7, 11]) {
  const list = Array.from({ length: n }, (_, i) => ({ id: 't' + i, bobotMapel: undefined }))
  const hasil = normalisasiPersenBobotMapel(list)
  assert.equal(hasil.reduce((a, b) => a + b.bobotBaru, 0), 100, `total 100 untuk ${n} TP`)
}
const r = normalisasiPersenBobotMapel([{ id: 'a', bobotMapel: 3 }, { id: 'b', bobotMapel: 1 }])
assert.deepEqual(r.map((x) => x.bobotBaru), [75, 25])

// Validasi KKTP
assert.equal(validasiLevels([
  { min: 0, maks: 60 }, { min: 61, maks: 75 }, { min: 76, maks: 85 }, { min: 86, maks: 100 }]), null)
assert.match(validasiLevels([
  { min: 0, maks: 60 }, { min: 60, maks: 75 }, { min: 76, maks: 85 }, { min: 86, maks: 100 }]), /tumpang tindih/)
assert.match(validasiLevels([
  { min: 0, maks: 60 }, { min: 61, maks: 75 }, { min: 76, maks: 85 }, { min: 86, maks: 101 }]), /0–100/)

console.log('Semua pemeriksaan rumus Akademik lolos.')
