#!/usr/bin/env node
/**
 * Migrasi data TKA: tka2026-sdm01 (repo nitoe/tka2026)  →  sdm01kukusan-2e735 (project LMS/tunggal).
 *
 * Pemetaan koleksi:
 *   questionPool  → tka_soal        (ID dipertahankan; sekolahId dibuang)
 *   packages      → tka_paket       (token DIPISAH ke tka_token/{id}; paket hanya menyimpan butuhToken)
 *   attempts      → tka_percobaan   (studentId lama → siswaId LMS, dicocokkan lewat NISN lalu nama+kelas)
 *
 * TIDAK disalin (sengaja): students/staff/loginRoster/sekolah (digantikan data siswa & guru LMS),
 *   soalPublik (digantikan Cloud Function), liveSessions (data sementara), subjects,
 *   pengajuanPaket & notifikasi (alur pengajuan dibawa di Tahap 3).
 *
 * AMAN secara bawaan (pola sama dengan migrate-firestore.mjs):
 *   - Tanpa --apply        : DRY-RUN (hanya membaca & melaporkan, tidak menulis apa pun).
 *   - Dokumen yang sudah ada di tujuan TIDAK ditimpa (kecuali --overwrite).
 *   - Project sumber & tujuan dikunci; kunci service account yang salah ditolak.
 *   - Percobaan yang siswanya tidak bisa dicocokkan TIDAK ditulis; semuanya tercantum di laporan.
 *
 * Pemakaian (dari folder repo SDM01Penilaian; firebase-admin dimuat dari functions/ → jalankan `cd functions && npm install` sekali):
 *   node scripts/migrasi-tka.mjs --source-key=./tka-key.json --target-key=./baru-key.json
 *   node scripts/migrasi-tka.mjs --source-key=... --target-key=... --apply
 *
 * Opsi:
 *   --hanya=soal,paket,percobaan   hanya bagian tertentu (default: ketiganya, urutan soal → paket → percobaan)
 *   --apply                        benar-benar menulis ke project tujuan
 *   --overwrite                    timpa dokumen tujuan yang isinya berbeda
 *
 * JANGAN commit file kunci service account. (.gitignore sudah menolaknya.)
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { isDeepStrictEqual } from 'node:util'
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'

export const SOURCE_PROJECT = 'tka2026-sdm01'
export const TARGET_PROJECT = 'sdm01kukusan-2e735'

export const MAPEL_VALID = ['matematika', 'bahasa-indonesia']
export const TIPE_VALID = ['pg', 'pgk', 'pgk-cat']
export const JENIS_VALID = ['latihan', 'tryout']

const PAGE = 400
const MARKER = 'tka2026'

/* ───────────── Normalisasi & pencocokan siswa ───────────── */

export function normNama(s) {
  return String(s ?? '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function normNisn(s) {
  return String(s ?? '').replace(/\D/g, '')
}

export function normKelas(s) {
  return String(s ?? '').trim().toUpperCase().replace(/\s+/g, '')
}

/**
 * Cocokkan siswa TKA (students/{uid}) ke siswa LMS (siswa/{NIS}).
 * Urutan: NISN unik → nama+kelas unik. Lebih dari satu kandidat = ambigu (tidak ditebak).
 * @param {{id:string,nama:string,kelas:string,nisn?:string}[]} siswaLms
 * @param {{uid:string,nama:string,kelas:string,nisn?:string}[]} studentsTka
 */
export function petakanSiswa(siswaLms, studentsTka) {
  const byNisn = new Map()
  const byNamaKelas = new Map()
  for (const s of siswaLms) {
    const n = normNisn(s.nisn)
    if (n) byNisn.set(n, [...(byNisn.get(n) ?? []), s])
    const k = `${normNama(s.nama)}|${normKelas(s.kelas)}`
    byNamaKelas.set(k, [...(byNamaKelas.get(k) ?? []), s])
  }

  const peta = new Map()
  const tidakCocok = []
  const ambigu = []
  const namaBeda = []

  for (const t of studentsTka) {
    let cara = null
    let kandidat = []
    const n = normNisn(t.nisn)
    if (n && byNisn.has(n)) {
      kandidat = byNisn.get(n)
      cara = 'nisn'
    }
    if (!kandidat.length) {
      kandidat = byNamaKelas.get(`${normNama(t.nama)}|${normKelas(t.kelas)}`) ?? []
      cara = 'nama-kelas'
    }
    if (kandidat.length === 0) {
      tidakCocok.push({ uid: t.uid, nama: t.nama, kelas: t.kelas })
    } else if (kandidat.length > 1) {
      ambigu.push({ uid: t.uid, nama: t.nama, kelas: t.kelas, kandidat: kandidat.map((k) => k.id) })
    } else {
      const s = kandidat[0]
      peta.set(t.uid, { siswaId: s.id, nama: s.nama, kelas: s.kelas, cara })
      if (cara === 'nisn' && normNama(s.nama) !== normNama(t.nama)) {
        namaBeda.push({ uid: t.uid, namaTka: t.nama, namaLms: s.nama, siswaId: s.id })
      }
    }
  }
  return { peta, tidakCocok, ambigu, namaBeda }
}

/* ───────────── Transformasi dokumen ───────────── */

/** Masalah isian yang akan membuat soal ditolak rules saat diedit nanti (tetap disalin, hanya dilaporkan). */
export function periksaSoal(d) {
  const m = []
  if (!MAPEL_VALID.includes(d.subjectId)) m.push(`subjectId tidak valid: ${d.subjectId}`)
  if (!TIPE_VALID.includes(d.tipe)) m.push(`tipe tidak valid: ${d.tipe}`)
  if (typeof d.pertanyaan !== 'string') m.push('pertanyaan bukan teks')
  if (typeof d.skor !== 'number') m.push('skor bukan angka')
  return m
}

export function ubahSoal(d) {
  // eslint-disable-next-line no-unused-vars
  const { sekolahId, kunciHash, ...sisa } = d
  return { ...sisa, migrasiDari: MARKER }
}

/** Token dipisah dari paket supaya tidak terbaca siswa (rules tka_paket melarang field `token`). */
export function ubahPaket(d) {
  // eslint-disable-next-line no-unused-vars
  const { token, sekolahId, ...sisa } = d
  const jenis = JENIS_VALID.includes(d.jenis) ? d.jenis : 'latihan'
  const tokenBersih = typeof token === 'string' ? token.trim() : ''
  const butuhToken = jenis === 'tryout' && tokenBersih !== ''
  return {
    paket: {
      ...sisa,
      jenis,
      questionIds: Array.isArray(d.questionIds) ? d.questionIds : [],
      // TKA lama: paket tanpa field aktif dianggap nonaktif (susun-paket.html).
      aktif: d.aktif === true,
      butuhToken,
      migrasiDari: MARKER,
    },
    token: butuhToken ? { token: tokenBersih } : null,
  }
}

export function ubahPercobaan(d, peta) {
  const m = peta.get(d.studentId)
  if (!m) return null
  // eslint-disable-next-line no-unused-vars
  const { studentId, namaSiswa, kelasSiswa, packageId, packageNama, sekolahId, jenisPaket, ...sisa } = d
  return {
    ...sisa,
    siswaId: m.siswaId,
    namaSiswa: m.nama,
    kelas: m.kelas,
    paketId: packageId,
    paketNama: packageNama ?? '',
    jenisPaket: JENIS_VALID.includes(jenisPaket) ? jenisPaket : 'latihan',
    sumber: 'migrasi-tka2026',
    studentIdLama: studentId,
  }
}

/* ───────────── Penulisan ───────────── */

/** Tulis daftar {id,data} ke koleksi tujuan. Tidak menimpa dokumen berbeda tanpa overwrite. */
export async function tulisDaftar({ dst, nama, items, apply, overwrite }) {
  const stat = { nama, sumber: items.length, baru: 0, sama: 0, beda: 0, ditulis: 0, bentrok: [] }
  for (let i = 0; i < items.length; i += PAGE) {
    const potong = items.slice(i, i + PAGE)
    const refs = potong.map((x) => dst.collection(nama).doc(x.id))
    const ada = await dst.getAll(...refs)
    const batch = apply ? dst.batch() : null
    let pending = 0
    potong.forEach((x, j) => {
      const ex = ada[j]
      if (!ex.exists) {
        stat.baru++
        if (batch) { batch.set(refs[j], x.data); pending++ }
      } else if (isDeepStrictEqual(ex.data(), x.data)) {
        stat.sama++
      } else {
        stat.beda++
        stat.bentrok.push(x.id)
        if (overwrite && batch) { batch.set(refs[j], x.data); pending++ }
      }
    })
    if (batch && pending) {
      await batch.commit()
      stat.ditulis += pending
    }
  }
  return stat
}

async function bacaSemua(db, nama) {
  const out = []
  const snap = await db.collection(nama).get()
  snap.forEach((d) => out.push({ id: d.id, data: d.data() }))
  return out
}

/* ───────────── CLI ───────────── */

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

const DIKENAL_SUMBER = {
  questionPool: 'disalin → tka_soal',
  packages: 'disalin → tka_paket (+ tka_token)',
  attempts: 'disalin → tka_percobaan',
  students: 'dipakai untuk pemetaan siswa (tidak disalin)',
  soalPublik: 'dilewati (diganti Cloud Function)',
  liveSessions: 'dilewati (data sementara)',
  staff: 'dilewati (guru sudah ada di users LMS)',
  loginRoster: 'dilewati (login siswa lewat LMS)',
  sekolah: 'dilewati (LMS satu sekolah)',
  subjects: 'dilewati (mapel tetap: matematika, bahasa-indonesia)',
  pengajuanPaket: 'dilewati (dibawa di Tahap 3)',
  notifikasi: 'dilewati (dibawa di Tahap 3)',
}

async function main() {
  const args = parseArgs(process.argv)
  const apply = args.apply === true
  const overwrite = args.overwrite === true
  const bagian = typeof args.hanya === 'string' ? args.hanya.split(',') : ['soal', 'paket', 'percobaan']

  // firebase-admin ada di functions/ (bukan di root repo): muat dari sana.
  const require = createRequire(new URL('../functions/package.json', import.meta.url))
  const { initializeApp, cert } = require('firebase-admin/app')
  const { getFirestore } = require('firebase-admin/firestore')

  const srcKey = loadKey(args['source-key'], SOURCE_PROJECT, 'source')
  const dstKey = loadKey(args['target-key'], TARGET_PROJECT, 'target')
  const src = getFirestore(initializeApp({ credential: cert(srcKey) }, 'sumber'))
  const dst = getFirestore(initializeApp({ credential: cert(dstKey) }, 'tujuan'))

  console.log(`Mode: ${apply ? 'APPLY (menulis)' : 'DRY-RUN (tidak menulis)'}${overwrite ? ' + OVERWRITE' : ''}`)
  console.log(`${SOURCE_PROJECT}  →  ${TARGET_PROJECT}\n`)

  const ada = (await src.listCollections()).map((c) => c.id)
  for (const n of ada) {
    console.log(`  sumber/${n.padEnd(16)} ${DIKENAL_SUMBER[n] ?? 'TIDAK DIKENAL — tidak disalin, periksa manual'}`)
  }
  console.log('')

  const laporan = { apply, overwrite, bagian, peringatan: [], hasil: [] }
  const catat = (s) => {
    laporan.hasil.push(s)
    console.log(
      `${s.nama.padEnd(16)} sumber=${s.sumber} baru=${s.baru} sama=${s.sama} beda=${s.beda}` +
        (apply ? ` ditulis=${s.ditulis}` : ''),
    )
  }

  if (bagian.includes('soal')) {
    const soal = await bacaSemua(src, 'questionPool')
    for (const s of soal) {
      const m = periksaSoal(s.data)
      if (m.length) laporan.peringatan.push({ koleksi: 'tka_soal', id: s.id, masalah: m })
    }
    catat(await tulisDaftar({
      dst, nama: 'tka_soal', apply, overwrite,
      items: soal.map((s) => ({ id: s.id, data: ubahSoal(s.data) })),
    }))
  }

  if (bagian.includes('paket')) {
    const paket = await bacaSemua(src, 'packages')
    const hasil = paket.map((p) => ({ id: p.id, ...ubahPaket(p.data) }))
    catat(await tulisDaftar({
      dst, nama: 'tka_paket', apply, overwrite,
      items: hasil.map((h) => ({ id: h.id, data: h.paket })),
    }))
    catat(await tulisDaftar({
      dst, nama: 'tka_token', apply, overwrite,
      items: hasil.filter((h) => h.token).map((h) => ({ id: h.id, data: h.token })),
    }))
  }

  if (bagian.includes('percobaan')) {
    const [students, siswa, attempts] = await Promise.all([
      bacaSemua(src, 'students'),
      bacaSemua(dst, 'siswa'),
      bacaSemua(src, 'attempts'),
    ])
    const { peta, tidakCocok, ambigu, namaBeda } = petakanSiswa(
      siswa.map((s) => ({ id: s.id, nama: s.data.nama, kelas: s.data.kelas, nisn: s.data.nisn })),
      students.map((s) => ({ uid: s.id, nama: s.data.nama, kelas: s.data.kelas, nisn: s.data.nisn })),
    )
    console.log(`\nPemetaan siswa: cocok=${peta.size} tidakCocok=${tidakCocok.length} ambigu=${ambigu.length} namaBeda=${namaBeda.length}`)
    laporan.pemetaanSiswa = {
      cocok: peta.size,
      tidakCocok,
      ambigu,
      namaBeda,
    }

    const items = []
    const dilewati = []
    for (const a of attempts) {
      const data = ubahPercobaan(a.data, peta)
      if (data) items.push({ id: a.id, data })
      else dilewati.push({ id: a.id, studentId: a.data.studentId, nama: a.data.namaSiswa })
    }
    laporan.percobaanDilewati = dilewati
    if (dilewati.length) {
      console.log(`${dilewati.length} percobaan DILEWATI karena siswa tak terpetakan (lihat laporan).`)
    }
    catat(await tulisDaftar({ dst, nama: 'tka_percobaan', apply, overwrite, items }))
  }

  const berkas = `migrasi-tka-laporan-${new Date().toISOString().replace(/[:.]/g, '-')}.json`
  writeFileSync(berkas, JSON.stringify(laporan, null, 2))
  console.log(`\nLaporan lengkap: ${berkas}`)
  if (laporan.peringatan.length) console.log(`${laporan.peringatan.length} soal punya isian tidak standar (tetap disalin) — lihat laporan.`)
  const beda = laporan.hasil.reduce((n, s) => n + s.beda, 0)
  if (beda && !overwrite) console.log(`${beda} dokumen sudah ada di tujuan dengan isi BERBEDA — tidak ditimpa.`)
  if (!apply) console.log('Ini dry-run. Jalankan ulang dengan --apply untuk menulis.')
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => { console.error('GAGAL:', e.message); process.exit(1) })
}
