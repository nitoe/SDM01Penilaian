// Uji logika pemantauan admin. Jalankan: node --experimental-strip-types scripts/cek-monitoring-admin.mjs
import {
  akunDipantau, hitungPasangan, ringkasTp, statusNilai, ringkasPerGuru, ringkasTahsin, hitungSudahBelum, ringkasPerKelas, hasilMetrik,
} from '../src/lib/monitoringAdminRumus.ts'

let gagal = 0
const cek = (n, ok) => { if (!ok) gagal++; console.log(`${ok ? 'LULUS' : 'GAGAL'}  ${n}`) }
const g = (uid, role, extra = {}) => ({ uid, nama: uid, role, waliKelas: [], penugasan: [], kelasAmpu: [], ...extra })

cek('akun pending tidak dihitung', !akunDipantau({ role: 'guru_akademik', status: 'pending' }))
cek('akun nonaktif tidak dihitung', !akunDipantau({ role: 'guru_akademik', aktif: false }))
cek('admin dan orang tua tidak dihitung', !akunDipantau({ role: 'admin' }) && !akunDipantau({ role: 'orangtua' }))
cek('akun tanpa status dihitung (dokumen lama)', akunDipantau({ role: 'guru' }))

const mapel = [{ id: 'a', nama: 'IPAS' }, { id: 'b', nama: 'PJOK' }]
const guru = [
  g('wali5A', 'guru_akademik', { waliKelas: ['5A'] }),
  g('pjok', 'guru_akademik', { penugasan: [{ kelas: '5A', mapel: 'PJOK' }] }),
  g('tahsin', 'guru_tahsin_tahfizh', { kelasAmpu: ['5A'] }),
]
const ps = hitungPasangan(guru, mapel, undefined, ['5A', '5B'])
const p = (m, k) => ps.find((x) => x.mapel === m && x.kelas === k)
cek('mapel bidang studi → guru penugasan, bukan wali (tanpa ganda)', p('PJOK', '5A').penanggung.join() === 'pjok' && p('PJOK', '5A').sumber === 'penugasan')
cek('mapel tanpa penugasan → wali kelas', p('IPAS', '5A').penanggung.join() === 'wali5A' && p('IPAS', '5A').sumber === 'wali')
cek('kelas tanpa guru → kosong', p('IPAS', '5B').sumber === 'kosong')
cek('guru tahsin murni tidak jadi penanggung akademik', !ps.some((x) => x.penanggung.includes('tahsin')))
cek('alias mapel bisa disuntikkan', hitungPasangan([g('x', 'guru', { penugasan: [{ kelas: '5A', mapel: 'Ilmu' }] })], [{ id: 'a', nama: 'IPAS' }], (a, b) => (a === 'Ilmu' && b === 'IPAS'), ['5A'])[0].penanggung[0] === 'x')

cek('tanpa TP → belum_tp', ringkasTp([], '1').status === 'belum_tp')
cek('TP belum dialokasi → belum_bobot', ringkasTp([{}, {}], '1').status === 'belum_bobot')
cek('bobot 60+40 → ok', ringkasTp([{ bobotPerSemester: { 1: 60 } }, { bobotPerSemester: { 1: 40 } }], '1').status === 'ok')
cek('bobot 60+30 → tidak_100', ringkasTp([{ bobotPerSemester: { 1: 60 } }, { bobotPerSemester: { 1: 30 } }], '1').status === 'tidak_100')
cek('TP semester 2 saja → semester 1 belum_bobot', ringkasTp([{ bobotPerSemester: { 2: 100 } }], '1').status === 'belum_bobot')
cek('legacy semester+bobotMapel dihitung', ringkasTp([{ semester: '1', bobotMapel: 100 }], '1').status === 'ok')

cek('nilai: tanpa TP', statusNilai(0, 30, 0) === 'tanpa_tp')
cek('nilai: belum', statusNilai(3, 30, 0) === 'belum')
cek('nilai: sebagian', statusNilai(3, 30, 40) === 'sebagian')
cek('nilai: lengkap', statusNilai(3, 30, 90) === 'lengkap')

const baris = ps.map((x) => ({
  ...x,
  tp: ringkasTp(x.mapel === 'IPAS' && x.kelas === '5A' ? [{ bobotPerSemester: { 1: 100 } }] : [], '1'),
  nilai: x.mapel === 'IPAS' && x.kelas === '5A' ? statusNilai(1, 30, 30) : 'tanpa_tp',
  terisi: 0, diharapkan: 0,
}))
const { perGuru, tanpaPenanggung } = ringkasPerGuru(guru, baris)
cek('guru yang tidak punya pasangan tidak muncul', perGuru.length === 2)
cek('pasangan tanpa penanggung dilaporkan', tanpaPenanggung.length === 2)
const sb = hitungSudahBelum(perGuru)
cek('wali (TP lengkap) sudah, guru PJOK (tanpa TP) belum', sb.tp.sudah === 1 && sb.tp.belum === 1)
const t = ringkasTahsin(guru, { tahsin: 12 })
cek('tahsin: sudah bila ada setoran', t.length === 1 && t[0].status === 'sudah')
cek('tahsin: belum bila nol', ringkasTahsin(guru, {})[0].status === 'belum')

const k = ringkasPerKelas(baris, 'tp', ['5A', '5B'])
cek('per kelas TP: 5A 1 beres + 1 belum, 5B 2 belum', k.length === 2 && k[0].beres === 1 && k[0].belum === 1 && k[1].belum === 2)
cek('per kelas nilai: pasangan tanpa TP tidak dihitung', ringkasPerKelas(baris, 'nilai', ['5A', '5B']).length === 1)
cek('per kelas bobot: tidak_100 = sebagian', hasilMetrik('bobot', { tp: { status: 'tidak_100' } }) === 'sebagian')
cek('per kelas bobot: belum_tp tidak relevan', hasilMetrik('bobot', { tp: { status: 'belum_tp' } }) === null)
cek('kelas tanpa pasangan relevan disembunyikan', ringkasPerKelas(baris, 'bobot', ['5A', '5B', '6A']).every((r) => r.kelas !== '6A'))

if (gagal) { console.log(`\n${gagal} uji GAGAL`); process.exit(1) }
console.log('\nSEMUA UJI LULUS')
