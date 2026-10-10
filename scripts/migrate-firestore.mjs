#!/usr/bin/env node
/**
 * Migrasi data Firestore: sdm01-penilaianv2 (v2)  →  sdm01kukusan-2e735 (project tunggal).
 *
 * AMAN secara bawaan:
 *   - Tanpa --apply        : DRY-RUN (hanya membaca & melaporkan, tidak menulis apa pun).
 *   - Dokumen yang sudah ada di tujuan TIDAK ditimpa (kecuali --overwrite).
 *   - ID dokumen dipertahankan persis (NIS, UID, dst.) — penting karena banyak
 *     koleksi merujuk siswaId/UID.
 *   - Project sumber & tujuan dikunci; kunci service account yang salah ditolak.
 *
 * Pemakaian (lihat docs/MIGRASI_DATA.md):
 *   npm i -D firebase-admin
 *   node scripts/migrate-firestore.mjs --source-key=./v2-key.json --target-key=./baru-key.json
 *   node scripts/migrate-firestore.mjs --source-key=... --target-key=... --apply
 *
 * Opsi:
 *   --collections=a,b   hanya koleksi tertentu (default: semua koleksi yang dikenal)
 *   --apply             benar-benar menulis ke project tujuan
 *   --overwrite         timpa dokumen tujuan yang isinya berbeda (pakai HANYA saat sinkron akhir)
 *
 * JANGAN commit file kunci service account. (.gitignore sudah menolaknya.)
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { isDeepStrictEqual } from 'node:util'
import { pathToFileURL } from 'node:url'

export const SOURCE_PROJECT = 'sdm01-penilaianv2'
export const TARGET_PROJECT = 'sdm01kukusan-2e735'

/** 23 koleksi tingkat-atas yang tercantum di firestore.rules v2. */
export const KOLEKSI = [
  'users', 'siswa', 'kktp_tahsin_tahfizh', 'setoran', 'menulis_log', 'target_hafalan',
  'mapel', 'tp_kktp', 'config', 'nilai_tp', 'asesmen_cakupan', 'nilai_sts', 'nilai_sas',
  'absensi_rapor', 'dpl', 'kokurikuler', 'proyek_stem', 'g7kaih', 'kokurikuler_rapor',
  'ekstrakurikuler', 'ekstrakurikuler_siswa', 'mutasi_siswa', 'identitas_siswa',
]

const PAGE = 400

/** Salin satu koleksi. `docId` = FieldPath.documentId() dari SDK (atau penggantinya di uji). */
export async function migrateCollection({ src, dst, name, docId, apply, overwrite }) {
  const stat = { name, sumber: 0, baru: 0, sama: 0, beda: 0, ditulis: 0, bentrok: [] }
  let last = null
  for (;;) {
    let q = src.collection(name).orderBy(docId).limit(PAGE)
    if (last) q = q.startAfter(last)
    const snap = await q.get()
    if (snap.empty) break
    const docs = snap.docs
    last = docs[docs.length - 1]
    stat.sumber += docs.length

    const refs = docs.map((d) => dst.collection(name).doc(d.id))
    const existing = await dst.getAll(...refs)
    const batch = apply ? dst.batch() : null
    let pending = 0

    docs.forEach((d, i) => {
      const ex = existing[i]
      if (!ex.exists) {
        stat.baru++
        if (batch) { batch.set(refs[i], d.data()); pending++ }
      } else if (isDeepStrictEqual(ex.data(), d.data())) {
        stat.sama++
      } else {
        stat.beda++
        stat.bentrok.push(d.id)
        if (overwrite && batch) { batch.set(refs[i], d.data()); pending++ }
      }
    })

    if (batch && pending) {
      await batch.commit()
      stat.ditulis += pending
    }
  }
  return stat
}

function parseArgs(argv) {
  const out = {}
  for (const a of argv.slice(2)) {
    const m = a.match(/^--([^=]+)(?:=(.*))?$/)
    if (m) out[m[1]] = m[2] ?? true
  }
  return out
}

function loadKey(path, expectedProject, label) {
  if (!path || path === true) throw new Error(`--${label}-key=<file.json> wajib diisi`)
  const key = JSON.parse(readFileSync(path, 'utf8'))
  if (key.project_id !== expectedProject) {
    throw new Error(
      `Kunci ${label} milik project "${key.project_id}", seharusnya "${expectedProject}". Dibatalkan.`,
    )
  }
  return key
}

async function main() {
  const args = parseArgs(process.argv)
  const apply = args.apply === true
  const overwrite = args.overwrite === true

  const { initializeApp, cert } = await import('firebase-admin/app')
  const { getFirestore, FieldPath } = await import('firebase-admin/firestore')

  const srcKey = loadKey(args['source-key'], SOURCE_PROJECT, 'source')
  const dstKey = loadKey(args['target-key'], TARGET_PROJECT, 'target')
  const src = getFirestore(initializeApp({ credential: cert(srcKey) }, 'sumber'))
  const dst = getFirestore(initializeApp({ credential: cert(dstKey) }, 'tujuan'))

  console.log(`Mode: ${apply ? 'APPLY (menulis)' : 'DRY-RUN (tidak menulis)'}${overwrite ? ' + OVERWRITE' : ''}`)
  console.log(`${SOURCE_PROJECT}  →  ${TARGET_PROJECT}\n`)

  // Koleksi yang ada di sumber tapi tidak dikenal skrip ini → jangan sampai terlewat diam-diam.
  const ada = (await src.listCollections()).map((c) => c.id)
  const tidakDikenal = ada.filter((n) => !KOLEKSI.includes(n))
  if (tidakDikenal.length) {
    console.log(`PERHATIAN: koleksi di sumber yang TIDAK dikenal skrip (tidak disalin): ${tidakDikenal.join(', ')}`)
    console.log('Tambahkan lewat --collections=nama jika memang perlu.\n')
  }

  const daftar = typeof args.collections === 'string' ? args.collections.split(',') : KOLEKSI
  const hasil = []
  for (const name of daftar) {
    const s = await migrateCollection({ src, dst, name, docId: FieldPath.documentId(), apply, overwrite })
    if (apply) s.tujuanSetelah = (await dst.collection(name).count().get()).data().count
    hasil.push(s)
    console.log(
      `${name.padEnd(24)} sumber=${s.sumber} baru=${s.baru} sama=${s.sama} beda=${s.beda}` +
        (apply ? ` ditulis=${s.ditulis} tujuan_kini=${s.tujuanSetelah}` : ''),
    )
  }

  const laporan = `migrasi-laporan-${new Date().toISOString().replace(/[:.]/g, '-')}.json`
  writeFileSync(laporan, JSON.stringify({ apply, overwrite, tidakDikenal, hasil }, null, 2))
  const totalBeda = hasil.reduce((n, s) => n + s.beda, 0)
  console.log(`\nLaporan lengkap (termasuk ID dokumen yang bentrok): ${laporan}`)
  if (totalBeda && !overwrite) {
    console.log(`${totalBeda} dokumen sudah ada di tujuan dengan isi BERBEDA — tidak ditimpa. Periksa laporan.`)
  }
  if (!apply) console.log('Ini dry-run. Jalankan ulang dengan --apply untuk menulis.')
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => { console.error('GAGAL:', e.message); process.exit(1) })
}
