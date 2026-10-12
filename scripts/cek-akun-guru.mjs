// Uji penyusunan dokumen akun guru. Jalankan: node --experimental-strip-types scripts/cek-akun-guru.mjs
import assert from 'node:assert/strict'
import { gabungPenugasanGuru, mapelDiampuDiKelasWali, penugasanDiLuarKelasWali, rapikanPenugasan, susunDokumenAkun, tugasDariAkun, validasiAkun } from '../src/lib/akunGuru.ts'

const dasar = {
  email: ' Siti@Sekolah.sch.id ',
  nama: '  Siti Aminah ',
  role: 'guru_akademik',
  kelasAmpu: ['5A'],
  penugasan: [
    { kelas: '4B', mapel: ' Matematika ' },
    { kelas: '4A', mapel: 'Matematika' },
    { kelas: '4A', mapel: 'Matematika' },
    { kelas: '9Z', mapel: 'IPA' },
  ],
  waliKelas: ['4B', '4A', '4A'],
  aktif: true,
}

const dok = susunDokumenAkun(dasar, '2026-10-11T00:00:00.000Z', '2026-10-01T00:00:00.000Z')
assert.equal(dok.email, 'siti@sekolah.sch.id')
assert.equal(dok.nama, 'Siti Aminah')
assert.deepEqual(dok.kelasAmpu, [], 'guru akademik tidak boleh menyimpan kelasAmpu')
assert.deepEqual(dok.waliKelas, ['4A', '4B'])
assert.deepEqual(dok.penugasan, [
  { kelas: '4A', mapel: 'Matematika' },
  { kelas: '4B', mapel: 'Matematika' },
])
assert.deepEqual(dok.penugasanKelas, ['4A', '4B'])
assert.deepEqual(dok.penugasanKelasMapel, ['4A::Matematika', '4B::Matematika'])
assert.equal(dok.createdAt, '2026-10-01T00:00:00.000Z')

const tahsin = susunDokumenAkun(
  { ...dasar, role: 'guru_tahsin_tahfizh', kelasAmpu: ['2B', '1A', '2B'], waliKelas: ['1A'] },
  '2026-10-11T00:00:00.000Z',
)
assert.deepEqual(tahsin.kelasAmpu, ['1A', '2B'])
assert.deepEqual(tahsin.penugasan, [])
assert.deepEqual(tahsin.penugasanKelas, [])
assert.deepEqual(tahsin.penugasanKelasMapel, [])
assert.deepEqual(tahsin.waliKelas, [], 'ganti peran wajib mengosongkan tugas yang tidak dipakai')
assert.equal(tahsin.createdAt, undefined)

const admin = susunDokumenAkun({ ...dasar, role: 'admin' }, '2026-10-11T00:00:00.000Z')
assert.deepEqual(admin.kelasAmpu, [])
assert.deepEqual(admin.penugasan, [])
assert.equal(admin.aktif, true)

assert.equal(
  validasiAkun({ ...dasar, role: 'guru_tahsin_tahfizh', kelasAmpu: [] }, { baru: false, password: '', diriSendiri: false }),
  'Guru Tahsin-Tahfizh wajib memiliki minimal satu kelas.',
)
assert.equal(
  validasiAkun(dasar, { baru: true, password: 'pendek', diriSendiri: false }),
  'Password awal minimal 8 karakter.',
)
assert.equal(
  validasiAkun({ ...dasar, aktif: false }, { baru: false, password: '', diriSendiri: true, roleLama: 'guru_akademik' }),
  'Anda tidak dapat menonaktifkan akun sendiri.',
)
assert.equal(
  validasiAkun(dasar, { baru: false, password: '', diriSendiri: true, roleLama: 'admin' }),
  'Anda tidak dapat mengubah peran akun sendiri.',
)
assert.equal(validasiAkun(
  { ...dasar, penugasan: [{ kelas: '4A', mapel: 'Matematika' }] },
  { baru: false, password: '', diriSendiri: false },
), null)

assert.deepEqual(rapikanPenugasan([{ kelas: '1A', mapel: '' }, { kelas: '1A', mapel: 'PAI' }]), [
  { kelas: '1A', mapel: 'PAI' },
])

assert.deepEqual(
  gabungPenugasanGuru(['1A'], ['Matematika', 'Bahasa Indonesia'], [{ kelas: '2B', mapel: 'PJOK' }]),
  [
    { kelas: '1A', mapel: 'Bahasa Indonesia' },
    { kelas: '1A', mapel: 'Matematika' },
    { kelas: '2B', mapel: 'PJOK' },
  ],
)
assert.deepEqual(mapelDiampuDiKelasWali(dok.penugasan, ['4A']), ['Matematika'])
assert.deepEqual(penugasanDiLuarKelasWali(
  [{ kelas: '4A', mapel: 'Matematika' }, { kelas: '5A', mapel: 'PJOK' }],
  ['4A'],
), [{ kelas: '5A', mapel: 'PJOK' }])
assert.deepEqual(
  tugasDariAkun({ role: 'guru_akademik', waliKelas: ['4A'], penugasan: [{ kelas: '4A', mapel: 'Matematika' }] }),
  { tahsin: false, guruKelas: true, bidangStudi: false },
)
assert.equal(
  validasiAkun({ ...dasar, penugasan: [{ kelas: '5A', mapel: 'PJOK' }] }, { baru: false, password: '', diriSendiri: false }),
  'Guru kelas perlu memilih mapel yang diampu di kelasnya, agar bisa menyusun TP dan mengisi nilai.',
)

console.log('Semua pemeriksaan akun guru lolos.')
