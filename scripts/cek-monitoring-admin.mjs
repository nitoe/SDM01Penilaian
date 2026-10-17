// Uji logika pemantauan admin. Jalankan: node --experimental-strip-types scripts/cek-monitoring-admin.mjs
import {
  akunDipantau, hitungPasangan, ringkasTp, statusNilai, ringkasPerGuru, ringkasTahsin, hitungSudahBelum, ringkasPerKelas, hasilMetrik, ringkasRaporPerKelas,
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

// ── kelengkapan rapor ──
const aktif = { '5A': 2, '5B': 2, '6A': 0 }
const gW = [g('wali5A', 'guru_akademik', { waliKelas: ['5A'], nama: 'Bu A' })]
const ab = [{ siswaId: 'a', kelas: '5A', catatanWali: 'baik', keputusan: 'Naik Kelas' }, { siswaId: 'b', kelas: '5A', catatanWali: '', keputusan: 'Belum diputuskan' }, { siswaId: 'c', kelas: '5B', keputusan: 'Belum diputuskan' }]
const ko = [{ siswaId: 'a', kelas: '5A', deskripsi: 'ok' }, { siswaId: 'b', kelas: '5A', deskripsi: '  ' }]
const ek = [{ siswaId: 'a', kelas: '5A', level: 3 }, { siswaId: 'a', kelas: '5A', level: 1 }, { siswaId: 'b', kelas: '5A', level: 4 }]
const rr = ringkasRaporPerKelas(aktif, gW, ab, ko, ek, '2', ['5A', '5B', '6A'])
cek('rapor: kelas tanpa siswa aktif tidak muncul', rr.length === 2 && !rr.some((x) => x.kelas === '6A'))
const r5a = rr.find((x) => x.kelas === '5A')
cek('rapor 5A: absensi 2, catatan 1, keputusan 1, kokurikuler 1 (spasi tidak dihitung)', r5a.absensi === 2 && r5a.catatanWali === 1 && r5a.keputusan === 1 && r5a.kokurikuler === 1)
cek('rapor 5A: ekskul dihitung per siswa unik, level 4 tidak', r5a.ekskul === 1)
cek('rapor 5A: sebagian, wali tercatat', r5a.status === 'sebagian' && r5a.wali[0] === 'Bu A')
cek('rapor 5B: absensi tersimpan tapi belum diputuskan → sebagian', rr.find((x) => x.kelas === '5B').status === 'sebagian')
cek('rapor: belum bila tidak ada isian wajib', ringkasRaporPerKelas({ '5C': 3 }, [], [], [], [], '1', ['5C'])[0].status === 'belum')
cek('rapor semester 1: keputusan tidak diwajibkan', ringkasRaporPerKelas({ '5A': 1 }, [], [{ siswaId: 'a', kelas: '5A' }], [{ siswaId: 'a', kelas: '5A', deskripsi: 'x' }], [], '1', ['5A'])[0].status === 'lengkap')
cek('rapor semester 2: keputusan diwajibkan', ringkasRaporPerKelas({ '5A': 1 }, [], [{ siswaId: 'a', kelas: '5A' }], [{ siswaId: 'a', kelas: '5A', deskripsi: 'x' }], [], '2', ['5A'])[0].status === 'sebagian')
cek('rapor: dokumen ganda satu siswa dihitung sekali', ringkasRaporPerKelas({ '5A': 5 }, [], [{ siswaId: 'a', kelas: '5A' }, { siswaId: 'a', kelas: '5A' }], [], [], '1', ['5A'])[0].absensi === 1)

if (gagal) { console.log(`\n${gagal} uji GAGAL`); process.exit(1) }
console.log('\nSEMUA UJI LULUS')
