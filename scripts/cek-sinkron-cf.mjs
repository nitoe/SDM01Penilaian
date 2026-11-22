/**
 * Uji tingkat HANDLER: menjalankan sinkronNilaiTugasLms & sinkronNilaiKuisLms dengan Firestore tiruan.
 * Menangkap kesalahan yang tidak terlihat oleh `node --check` / uji agregator saja
 * (mis. nama fungsi tidak di-import → ReferenceError → HTTP 500). ANTIREGRESI §SLM.Agregasi butir 9.
 * Jalankan: node scripts/cek-sinkron-cf.mjs   (butuh `npm --prefix functions install`)
 */
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const aqui = path.dirname(fileURLToPath(import.meta.url))
const fnDir = path.resolve(aqui, '../functions')
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cf-'))
for (const f of ['agregasiSlmLms.js', 'sinkronNilaiTugasLms.js', 'sinkronNilaiKuisLms.js']) {
  let s = fs.readFileSync(path.join(fnDir, f), 'utf8')
  s = s.replace("from 'firebase-admin/firestore'", "from './stubFirestore.mjs'")
  fs.writeFileSync(path.join(tmp, f), s)
}
fs.writeFileSync(
  path.join(tmp, 'stubFirestore.mjs'),
  "export const getFirestore = () => globalThis.__DB\nexport const FieldValue = { serverTimestamp: () => '__TS__' }\n",
)
fs.writeFileSync(path.join(tmp, 'package.json'), '{"type":"module"}')
fs.symlinkSync(path.join(fnDir, 'node_modules'), path.join(tmp, 'node_modules'), 'dir')

class Snap {
  constructor(db, col, id, data) {
    this.id = id
    this._d = data
    this.exists = data !== undefined
    this.ref = { id, _col: col, update: async (u) => db.cols[col].set(id, { ...db.cols[col].get(id), ...u }), path: `${col}/${id}` }
  }
  data() { return this._d }
}
function mkDb(cols) {
  const db = { cols: {} }
  for (const [n, rows] of Object.entries(cols)) db.cols[n] = new Map(Object.entries(rows))
  const q = (name, filters = []) => ({
    where: (f, op, v) => q(name, [...filters, [f, op, v]]),
    async get() {
      const docs = [...(db.cols[name] || new Map()).entries()]
        .filter(([, d]) => filters.every(([f, op, v]) => (op === '==' ? d[f] === v : op === 'in' ? v.includes(d[f]) : op === 'array-contains' ? Array.isArray(d[f]) && d[f].includes(v) : false)))
        .map(([id, d]) => new Snap(db, name, id, d))
      return { docs, empty: docs.length === 0 }
    },
    doc: (id) => ({ _col: name, id: id || `auto${Math.random().toString(36).slice(2)}`, path: `${name}/x` }),
  })
  db.collection = (n) => q(n)
  db.doc = (p) => {
    const [n, id] = p.split('/')
    return { _col: n, id, path: p, get: async () => new Snap(db, n, id, db.cols[n]?.get(id)), update: async (u) => db.cols[n].set(id, { ...db.cols[n].get(id), ...u }) }
  }
  db.batch = () => {
    const ops = []
    return {
      set: (r, d) => ops.push(['set', r, d]),
      update: (r, d) => ops.push(['update', r, d]),
      commit: async () => {
        for (const [t, r, d] of ops) {
          const col = (db.cols[r._col] ||= new Map())
          for (const v of Object.values(d)) assert.notEqual(v, undefined, 'Firestore menolak nilai undefined')
          col.set(r.id, t === 'set' ? d : { ...col.get(r.id), ...d })
        }
      },
    }
  }
  return db
}

globalThis.__DB = mkDb({
  users: { guru: { role: 'guru', aktif: true, penugasanKelasMapel: ['5A::IPAS', '5B::IPAS'], waliKelas: [] } },
  config: { akademik: { semesterAktif: '2', tahunAjaran: '2026/2027' } },
  tp_kktp: {
    a1: { kelas: '5A', mapel: 'IPAS', namaTp: 'Mengenal ekosistem' },
    b1: { kelas: '5B', mapel: 'IPAS', namaTp: 'Mengenal ekosistem' },
  },
  lms_tugas: {
    t1: { kelas: '5A', kelasList: ['5A', '5B'], mapel: 'IPAS', judul: 'Tugas dibagikan', jenisPenilaian: 'slm', tpList: [{ id: 'a1', nama: 'Mengenal ekosistem' }] },
  },
  lms_nilai_tugas: {
    n1: { tugasId: 't1', siswaId: 'sa', siswaNama: 'Ani', kelas: '5A', nilai: 80 },
    n2: { tugasId: 't1', siswaId: 'sb', siswaNama: 'Budi', kelas: '5B', nilai: 90 },
  },
  lms_kuis: {
    k1: { kelas: '5A', kelasList: ['5A'], mapel: 'IPAS', judul: 'Kuis 1', jenisPenilaian: 'slm', tpIds: ['a1'], tpNamaList: ['Mengenal ekosistem'] },
  },
  lms_jawaban: {
    j1: { kuisId: 'k1', siswaId: 'sa', siswaNama: 'Ani', kelas: '5A', skorOtomatis: 6, totalPoin: 10, percobaan: 1 },
  },
  nilai_tp: {},
})

const jalan = async (modul, nama, data) => {
  const mod = await import(pathToFileURL(path.join(tmp, modul)).href)
  return mod[nama].run({ auth: { uid: 'guru' }, data })
}

// 1) Sinkron TUGAS (dibagikan 5A+5B): tidak boleh melempar error apa pun (ReferenceError → 500)
const r1 = await jalan('sinkronNilaiTugasLms.js', 'sinkronNilaiTugasLms', { tugasId: 't1' })
assert.equal(r1.ok, true)
assert.deepEqual(r1.rombel.map((x) => x.kelas), ['5A', '5B'])
const nilaiTp = [...globalThis.__DB.cols.nilai_tp.values()]
const a = nilaiTp.find((d) => d.siswaId === 'sa')
const b = nilaiTp.find((d) => d.siswaId === 'sb')
assert.equal(a.kelas, '5A'); assert.equal(a.tpId, 'a1')
assert.equal(b.kelas, '5B'); assert.equal(b.tpId, 'b1') // dipetakan ke TP rombel 5B
// Ani: tugas 80 + kuis 60 = 70
assert.equal(a.slm, 70)
assert.equal(globalThis.__DB.cols.lms_tugas.get('t1').periodeSlm.semester, '2') // cap periode

// 2) Sinkron KUIS
const r2 = await jalan('sinkronNilaiKuisLms.js', 'sinkronNilaiKuisLms', { kuisId: 'k1' })
assert.equal(r2.ok, true)
assert.equal([...globalThis.__DB.cols.nilai_tp.values()].find((d) => d.siswaId === 'sa').slm, 70)

// 3) Sinkron ulang (overwrite) idempoten & tanpa duplikat dokumen
const jumlah = globalThis.__DB.cols.nilai_tp.size
await jalan('sinkronNilaiTugasLms.js', 'sinkronNilaiTugasLms', { tugasId: 't1' })
assert.equal(globalThis.__DB.cols.nilai_tp.size, jumlah) // tidak menggandakan dokumen
console.log('cek-sinkron-cf: semua uji lulus (dokumen nilai_tp:', globalThis.__DB.cols.nilai_tp.size, ')')
