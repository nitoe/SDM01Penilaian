/**
 * Uji agregasi SLM LMS → nilai_tp (functions/agregasiSlmLms.js v2) dengan Firestore tiruan.
 * Jalankan: node scripts/cek-agregasi-slm.mjs   (butuh `npm --prefix functions install`)
 * ANTIREGRESI §SLM-Agregasi.
 */
import assert from 'node:assert/strict'
import { kumpulkanSkorSlm, tulisNilaiTpSlm, nilaiAgregat, normNama } from '../functions/agregasiSlmLms.js'

class Doc {
  constructor(id, data) { this.id = id; this._d = data; this.exists = true }
  data() { return this._d }
}
class Query {
  constructor(db, name, filters = []) { this.db = db; this.name = name; this.filters = filters }
  where(f, op, v) { return new Query(this.db, this.name, [...this.filters, [f, op, v]]) }
  async get() {
    const rows = [...(this.db.cols[this.name] || new Map()).entries()]
    const docs = rows
      .filter(([, d]) => this.filters.every(([f, op, v]) => (op === '==' ? d[f] === v : op === 'in' ? v.includes(d[f]) : false)))
      .map(([id, d]) => new Doc(id, d))
    return { docs, empty: docs.length === 0, forEach: (fn) => docs.forEach(fn) }
  }
}
function mkDb(cols) {
  const db = { cols: {} }
  for (const [n, rows] of Object.entries(cols)) db.cols[n] = new Map(Object.entries(rows))
  db.collection = (n) => {
    const q = new Query(db, n)
    q.doc = (id) => ({ _n: n, id: id || `auto${Math.random()}` })
    return q
  }
  db.doc = (path) => {
    const [n, id] = path.split('/')
    return { get: async () => (db.cols[n]?.has(id) ? new Doc(id, db.cols[n].get(id)) : { exists: false }), _n: n, id }
  }
  db.batch = () => {
    const ops = []
    return {
      set: (ref, data) => ops.push(['set', ref, data]),
      update: (ref, data) => ops.push(['update', ref, data]),
      commit: async () => {
        for (const [t, ref, data] of ops) {
          const n = ref._n || ref.path?.split('/')[0]
          const col = (db.cols[n] ||= new Map())
          col.set(ref.id, t === 'set' ? data : { ...col.get(ref.id), ...data })
        }
      },
    }
  }
  return db
}

const TP = { id: 'tp1', kelas: '5A', mapel: 'IPAS', namaTp: 'Mengenal ekosistem' }
const TP_BI = { id: 'tpbi', kelas: '5A', mapel: 'Bahasa Indonesia', namaTp: 'Menulis laporan' }
const db = mkDb({
  tp_kktp: { tp1: TP, tpbi: TP_BI },
  lms_tugas: {
    t1: { kelas: '5A', mapel: 'IPAS', judul: 'Tugas 1', jenisPenilaian: 'slm', tpList: [{ id: 'tp1', nama: 'Mengenal ekosistem' }] },
    t2: { kelas: '5A', mapel: 'IPAS', judul: 'Tugas 2 (arsip)', arsip: true, jenisPenilaian: 'slm', tpList: [{ id: 'tp1', nama: 'x' }] },
    tl: { kelas: '5A', mapel: 'IPAS', judul: 'Latihan', jenisPenilaian: 'latihan', tpList: [{ id: 'tp1' }] },
    proyek: { kelas: '5A', mapel: 'IPAS', judul: 'Proyek', jenisPenilaian: 'slm', tpList: [{ id: 'tp1', mapel: 'IPAS' }, { id: 'tpbi', mapel: 'Bahasa Indonesia' }] },
    tbi: { kelas: '5A', mapel: 'Bahasa Indonesia', judul: 'Tugas BI', jenisPenilaian: 'slm', tpList: [{ id: 'tpbi', nama: 'Menulis laporan' }] },
  },
  lms_nilai_tugas: {
    n1: { tugasId: 't1', siswaId: 's1', kelas: '5A', nilai: 80 },
    n2: { tugasId: 't2', siswaId: 's1', kelas: '5A', nilai: 60 },
    nl: { tugasId: 'tl', siswaId: 's1', kelas: '5A', nilai: 10 },
    n3: { tugasId: 't1', siswaId: 's9', kelas: '5B', nilai: 99 }, // rombel lain: harus diabaikan
    np1: { tugasId: 'proyek', siswaId: 's1', kelas: '5A', nilai: 90 },
    nbi: { tugasId: 'tbi', siswaId: 's1', kelas: '5A', nilai: 70 },
  },
  lms_kuis: {
    k1: { kelas: '5A', mapel: 'IPAS', judul: 'Kuis 1', jenisPenilaian: 'slm', tpIds: ['TP 1. Mengenal ekosistem'], tpNamaList: ['TP 1. Mengenal ekosistem'] },
    k2: { kelas: '5A', mapel: 'IPAS', judul: 'Kuis latihan', jenisPenilaian: 'latihan', tpIds: ['tp1'] },
  },
  lms_jawaban: {
    j1: { kuisId: 'k1', siswaId: 's1', kelas: '5A', skorOtomatis: 5, totalPoin: 10, percobaan: 1 },
    j2: { kuisId: 'k1', siswaId: 's1', kelas: '5A', skorOtomatis: 8, totalPoin: 10, percobaan: 2 }, // terbaru
    j3: { kuisId: 'k1', siswaId: 's2', kelas: '5A', skorOtomatis: 10, totalPoin: 10, percobaan: 1 },
  },
  nilai_tp: {},
})

assert.equal(normNama('TP 3. Mengenal  Ekosistem'), 'mengenal ekosistem')

// Sinkron tugas proyek (mapel utama IPAS) untuk TP IPAS + BI
const hasil = await kumpulkanSkorSlm(db, { kelas: '5A', tpTargets: [{ id: 'tp1' }, { id: 'tpbi' }] })
// IPAS s1: t1 80, t2 60 (arsip tetap), proyek 90, kuis terbaru 80 => (80+60+90+80)/4 = 77.5
assert.equal(nilaiAgregat(hasil.skor, 's1', 'tp1'), 77.5)
assert.equal(hasil.meta.nKuis, 1) // kuis dibaca lewat tpIds/tpNamaList
// BI s1: proyek 90 + tugas BI 70 => 80 (tidak saling menimpa lintas mapel)
assert.equal(nilaiAgregat(hasil.skor, 's1', 'tpbi'), 80)
// s2 hanya kuis 100
assert.equal(nilaiAgregat(hasil.skor, 's2', 'tp1'), 100)
// siswa rombel lain & latihan tidak ikut
assert.equal(hasil.skor.has('s9'), false)
assert.equal(hasil.komponen.get('s1').get('tp1').length, 4)

// Tulis + sinkron ulang tidak menggandakan dokumen dan menyimpan rincian
const args = { tpList: [{ id: 'tp1', nama: 'Mengenal ekosistem', mapel: 'IPAS' }], mapelUtama: 'IPAS', hasil, kelas: '5A', semester: '1', tahunAjaran: '2026/2027', uid: 'u', overwrite: true, sumber: { sumberKuisId: 'k1' }, namaBySiswa: new Map() }
await tulisNilaiTpSlm(db, args)
const awal = [...db.cols.nilai_tp.values()]
assert.equal(awal.length, 2)
assert.equal(awal.find((d) => d.siswaId === 's1').slm, 77.5)
assert.equal(awal.find((d) => d.siswaId === 's1').slmKomponen.length, 4)
// nilai_tp tiruan tidak punya id stabil di mock; cek overwrite=false melewati yang ada
db.cols.nilai_tp = new Map([...db.cols.nilai_tp.entries()].map(([k, v], i) => [`d${i}`, v]))
const r2 = await tulisNilaiTpSlm(db, { ...args, overwrite: false })
assert.equal(r2.ditulis, 0)
assert.equal(r2.dilewati, 2)
console.log('cek-agregasi-slm: semua uji lulus')
