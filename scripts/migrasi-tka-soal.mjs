#!/usr/bin/env node
/**
 * Migrasi BANK SOAL TKA: tka2026-sdm01 (repo nitoe/tka2026)  →  sdm01kukusan-2e735 (LMS).
 *
 * Hanya `questionPool` yang dimigrasi (paket, token, hasil pengerjaan, akun TIDAK dibawa).
 * Soal dikonversi ke model bank soal LMS dan disimpan sebagai paket `lms_paket_soal` pada ruang
 * TKA tiap kelas 6:   kelas 6A/6B/6C  ×  mapel «TKA Matematika» / «TKA Bahasa Indonesia».
 * Satu paket per (kelas, mapel, tipeMateri); dipecah bila melebihi 300 soal / ±700 KB.
 * Gambar stimulus (data URL) disalin ke `lms_gambar` dan dirujuk lewat `gambarId`.
 *
 * Konversi tipe:
 *   pg       → pg   (opsi a,b,c…; kunci = opsi yang teksnya sama dengan kunciJawaban[0])
 *   pgk      → pgk  (nilaiParsial = false, sama dengan TKA lama: harus benar semua)
 *   pgk-cat  → bs   bila tepat 2 kolom (label kolom kustom disimpan di labelBenar/labelSalah);
 *                    selain itu DILEWATI dan dilaporkan (LMS belum punya tipe tabel >2 kategori)
 *   stimulus/bacaan → soal.stimulus (HTML), rumus `$..$` tetap (soal.rumus = true → KaTeX)
 *
 * AMAN secara bawaan:
 *   - Tanpa --apply        : DRY-RUN (hanya membaca & melaporkan, tidak menulis apa pun).
 *   - Paket/gambar yang sudah ada di tujuan TIDAK ditimpa (kecuali --overwrite).
 *   - Project sumber & tujuan dikunci; kunci service account yang salah ditolak.
 *   - Soal yang kuncinya tidak bisa dicocokkan TIDAK ditulis; semuanya ada di laporan.
 *
 * Pemakaian (dari folder repo SDM01Penilaian; firebase-admin dimuat dari functions/ →
 * jalankan `cd functions && npm install` sekali):
 *   node scripts/migrasi-tka-soal.mjs --source-key=./tka-key.json --target-key=./baru-key.json
 *   node scripts/migrasi-tka-soal.mjs --source-key=... --target-key=... --apply
 *
 * Opsi:
 *   --kelas=6A,6B        kelas tujuan (default: kelas 6 yang ada di koleksi `siswa` tujuan)
 *   --acak-opsi          acak urutan opsi PG/PGK saat siswa mengerjakan (default: tidak; aman bagi
 *                        opsi seperti «semua benar»)
 *   --dibuat-oleh=<uid>  UID pemilik paket (default: akun arif.azwar79@gmail.com)
 *   --nama-guru=<nama>   nama pembuat yang tampil (default: Migrasi TKA)
 *   --apply              benar-benar menulis
 *   --overwrite          timpa paket tujuan yang isinya berbeda
 *
 * JANGAN commit file kunci service account.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'

export const SOURCE_PROJECT = 'tka2026-sdm01'
export const TARGET_PROJECT = 'sdm01kukusan-2e735'
export const UID_PEMILIK_BAWAAN = 'v4fQXsqCzYUtHrqcDM0u48sxIfn1'

export const MAPEL_LMS = {
  matematika: 'TKA Matematika',
  'bahasa-indonesia': 'TKA Bahasa Indonesia',
}

export const BATAS_SOAL_PAKET = 300
export const BATAS_BYTE_PAKET = 700_000
export const BATAS_KARAKTER_GAMBAR = 300_000

/* ───────────── konversi teks ───────────── */

function escapeHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/** Teks polos → HTML paragraf; HTML (mengandung tag) dibiarkan (dibersihkan saat ditampilkan). */
export function htmlDariTeks(s) {
  const t = String(s ?? '').replace(/\r\n?/g, '\n').trim()
  if (!t) return ''
  if (/<\/?[a-z][a-z0-9]*(\s[^>]*)?>/i.test(t)) return t
  return t
    .split(/\n{2,}/)
    .map((p) => `<p>${escapeHtml(p).replace(/\n/g, '<br>')}</p>`)
    .join('')
}

export function kompleksitasLms(v) {
  const m = /^L\s*([123])/i.exec(String(v ?? ''))
  return m ? `L${m[1]}` : 'L1'
}

export function slug(s) {
  return (
    String(s ?? '')
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'umum'
  )
}

const idOpsi = (i) => (i < 26 ? String.fromCharCode(97 + i) : `o${i}`)
const samaTeks = (a, b) => String(a ?? '').trim() === String(b ?? '').trim()

/* ───────────── konversi soal ───────────── */

/**
 * @returns {{ soal: object|null, gambar: {id:string,data:string}|null, masalah: string[], peringatan: string[] }}
 */
export function konversiSoal(id, d, opsi = {}) {
  const masalah = []
  const peringatan = []
  const mapel = MAPEL_LMS[d.subjectId]
  if (!mapel) masalah.push(`subjectId tidak dikenal: ${d.subjectId}`)

  const teks = htmlDariTeks(d.pertanyaan)
  if (!teks) masalah.push('pertanyaan kosong')

  const skor = Number(d.skor)
  const dasar = {
    id,
    teks,
    poin: skor > 0 ? skor : 1,
    waktuMenit: 1,
    kompleksitas: kompleksitasLms(d.kompleksitas),
    rumus: true,
  }
  const stimulus = htmlDariTeks(d.stimulus || d.bacaan || '')
  if (stimulus) dasar.stimulus = stimulus
  const materi = String(d.tipeMateri ?? '').trim()
  if (materi) dasar.tipeMateri = materi
  if (typeof d.pembahasan === 'string' && d.pembahasan.trim()) dasar.pembahasan = htmlDariTeks(d.pembahasan)

  let gambar = null
  const img = d.stimulusImage || d.ilustrasi || d.gambar || ''
  if (typeof img === 'string' && img) {
    if (img.startsWith('data:image')) {
      gambar = { id: `tka-${id}`, data: img }
      dasar.gambarId = gambar.id
      if (img.length > BATAS_KARAKTER_GAMBAR) {
        peringatan.push(`gambar ${img.length} karakter (> ${BATAS_KARAKTER_GAMBAR}); tetap disalin`)
      }
    } else {
      peringatan.push('gambar berupa URL, tidak disalin')
    }
  }

  const kunciAsal = Array.isArray(d.kunciJawaban) ? d.kunciJawaban : []
  let soal = null

  if (d.tipe === 'pg' || d.tipe === 'pgk') {
    const daftar = Array.isArray(d.opsi) ? d.opsi.map((o) => String(o ?? '')) : []
    if (daftar.length < 2) masalah.push('opsi kurang dari 2')
    const opsiLms = daftar.map((teksOpsi, i) => ({ id: idOpsi(i), teks: teksOpsi }))
    const ids = []
    for (const k of kunciAsal) {
      const ada = opsiLms.find((o) => samaTeks(o.teks, k))
      if (ada) ids.push(ada.id)
      else masalah.push(`kunci tidak cocok dengan opsi: «${String(k).slice(0, 40)}»`)
    }
    if (ids.length === 0) masalah.push('kunci kosong')
    if (d.tipe === 'pg') {
      if (kunciAsal.length !== 1) masalah.push(`pg harus punya tepat 1 kunci (ada ${kunciAsal.length})`)
      soal = { ...dasar, tipe: 'pg', opsi: opsiLms, kunci: ids[0] ?? '', acakOpsi: !!opsi.acakOpsi, opsiGambar: false }
    } else {
      soal = {
        ...dasar, tipe: 'pgk', opsi: opsiLms, kunci: [...new Set(ids)],
        acakOpsi: !!opsi.acakOpsi, opsiGambar: false, nilaiParsial: false,
      }
    }
  } else if (d.tipe === 'pgk-cat') {
    const rows = Array.isArray(d.rows) ? d.rows.map((r) => String(r ?? '')) : []
    const cols = Array.isArray(d.cols) && d.cols.length ? d.cols.map((c) => String(c ?? '')) : ['Benar', 'Salah']
    if (cols.length !== 2) {
      masalah.push(`pgk-cat dengan ${cols.length} kolom belum didukung LMS (hanya 2 kolom)`)
    } else if (rows.length === 0) {
      masalah.push('pgk-cat tanpa baris pernyataan')
    } else {
      const pernyataan = rows.map((teksBaris, i) => {
        const k = kunciAsal[i]
        if (!samaTeks(k, cols[0]) && !samaTeks(k, cols[1])) masalah.push(`baris ${i + 1}: kunci «${k}» bukan salah satu kolom`)
        return { id: `p${i + 1}`, teks: teksBaris, benar: samaTeks(k, cols[0]) }
      })
      soal = { ...dasar, tipe: 'bs', pernyataan, nilaiParsial: false }
      const baku = samaTeks(cols[0].toLowerCase(), 'benar') && samaTeks(cols[1].toLowerCase(), 'salah')
      if (!baku) {
        soal.labelBenar = cols[0]
        soal.labelSalah = cols[1]
      }
    }
  } else {
    masalah.push(`tipe tidak dikenal: ${d.tipe}`)
  }

  return { soal: masalah.length ? null : soal, gambar, masalah, peringatan, mapel }
}

/* ───────────── pengelompokan paket ───────────── */

export function hitungRingkasan(soal) {
  const jumlahPerTipe = {}
  const jumlahPerKompleksitas = {}
  for (const s of soal) {
    jumlahPerTipe[s.tipe] = (jumlahPerTipe[s.tipe] ?? 0) + 1
    jumlahPerKompleksitas[s.kompleksitas] = (jumlahPerKompleksitas[s.kompleksitas] ?? 0) + 1
  }
  return {
    jumlahSoal: soal.length,
    totalPoin: Math.round(soal.reduce((t, s) => t + (Number(s.poin) || 0), 0) * 100) / 100,
    jumlahPerTipe,
    jumlahPerKompleksitas,
  }
}

const ukuran = (x) => Buffer.byteLength(JSON.stringify(x), 'utf8')

/**
 * Kelompokkan soal (sudah dikonversi) → daftar paket per kelas.
 * @param {{soal:object, mapel:string, urut:number}[]} items
 * @param {string[]} kelasList
 */
export function susunPaket(items, kelasList, { dibuatOleh, namaGuru } = {}) {
  const grup = new Map()
  for (const it of items) {
    const materi = it.soal.tipeMateri || 'Umum'
    const key = `${it.mapel}|${materi}`
    if (!grup.has(key)) grup.set(key, { mapel: it.mapel, materi, soal: [] })
    grup.get(key).soal.push(it)
  }

  const paketList = []
  const kunciUrut = [...grup.keys()].sort((a, b) => a.localeCompare(b, 'id'))
  for (const kelas of kelasList) {
    for (const key of kunciUrut) {
      const g = grup.get(key)
      const urut = [...g.soal].sort((a, b) => a.urut - b.urut || String(a.soal.id).localeCompare(String(b.soal.id)))
      const bagian = []
      let cur = []
      let byte = 0
      for (const it of urut) {
        const u = ukuran(it.soal)
        if (cur.length > 0 && (cur.length >= BATAS_SOAL_PAKET || byte + u > BATAS_BYTE_PAKET)) {
          bagian.push(cur)
          cur = []
          byte = 0
        }
        cur.push(it.soal)
        byte += u
      }
      if (cur.length) bagian.push(cur)

      bagian.forEach((soal, i) => {
        const nomor = i + 1
        paketList.push({
          id: `tka-${kelas}-${slug(g.mapel)}-${slug(g.materi)}-${nomor}`,
          data: {
            kelas,
            mapel: g.mapel,
            judul: `Bank TKA — ${g.materi}${bagian.length > 1 ? ` (bagian ${nomor})` : ''}`.slice(0, 200),
            deskripsi: 'Dimigrasi dari bank soal tka2026. Soal bertanda rumus (KaTeX) dan dapat memuat bacaan.',
            status: 'siap',
            acakSoal: false,
            soal,
            ...hitungRingkasan(soal),
            dibuatOleh: dibuatOleh ?? UID_PEMILIK_BAWAAN,
            dibuatOlehNama: namaGuru ?? 'Migrasi TKA',
          },
        })
      })
    }
  }
  return paketList
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
    throw new Error(`Kunci ${label} milik project "${key.project_id}", seharusnya "${expectedProject}". Dibatalkan.`)
  }
  return key
}

const DIKENAL_SUMBER = {
  questionPool: 'dimigrasi → lms_paket_soal (+ lms_gambar)',
  packages: 'dilewati (paket tidak dimigrasi)',
  attempts: 'dilewati (hasil lama tidak dimigrasi)',
  students: 'dilewati', staff: 'dilewati', loginRoster: 'dilewati', sekolah: 'dilewati',
  subjects: 'dilewati', soalPublik: 'dilewati', liveSessions: 'dilewati',
  pengajuanPaket: 'dilewati', notifikasi: 'dilewati', bacaanPool: 'dilewati (stimulus sudah ada di soal)',
}

async function main() {
  const args = parseArgs(process.argv)
  const apply = args.apply === true
  const overwrite = args.overwrite === true

  const require = createRequire(new URL('../functions/package.json', import.meta.url))
  const { initializeApp, cert } = require('firebase-admin/app')
  const { getFirestore, FieldValue } = require('firebase-admin/firestore')

  const src = getFirestore(initializeApp({ credential: cert(loadKey(args['source-key'], SOURCE_PROJECT, 'source')) }, 'sumber'))
  const dst = getFirestore(initializeApp({ credential: cert(loadKey(args['target-key'], TARGET_PROJECT, 'target')) }, 'tujuan'))

  console.log(`Mode: ${apply ? 'APPLY (menulis)' : 'DRY-RUN (tidak menulis)'}${overwrite ? ' + OVERWRITE' : ''}`)
  console.log(`${SOURCE_PROJECT}  →  ${TARGET_PROJECT}\n`)
  for (const c of await src.listCollections()) {
    console.log(`  sumber/${c.id.padEnd(16)} ${DIKENAL_SUMBER[c.id] ?? 'TIDAK DIKENAL — tidak disalin, periksa manual'}`)
  }

  // Kelas tujuan
  let kelasList
  if (typeof args.kelas === 'string') {
    kelasList = args.kelas.split(',').map((k) => k.trim().toUpperCase()).filter(Boolean)
  } else {
    const siswa = await dst.collection('siswa').get()
    const set = new Set()
    siswa.forEach((d) => {
      const k = String(d.data().kelas ?? '').trim().toUpperCase()
      if (/^6[A-Z]$/.test(k) && d.data().aktif !== false) set.add(k)
    })
    kelasList = [...set].sort()
  }
  if (!kelasList.length) throw new Error('Tidak ada kelas 6 di koleksi siswa tujuan. Gunakan --kelas=6A,6B')
  console.log(`\nKelas tujuan: ${kelasList.join(', ')}`)

  // Konversi
  const snap = await src.collection('questionPool').get()
  const items = []
  const gambarMap = new Map()
  const laporan = { apply, overwrite, kelas: kelasList, dilewati: [], peringatan: [], paket: [], gambar: 0 }
  let nomor = 0
  for (const d of snap.docs) {
    nomor++
    const data = d.data()
    const hasil = konversiSoal(d.id, data, { acakOpsi: args['acak-opsi'] === true })
    if (hasil.peringatan.length) laporan.peringatan.push({ id: d.id, peringatan: hasil.peringatan })
    if (!hasil.soal) {
      laporan.dilewati.push({ id: d.id, tipe: data.tipe, masalah: hasil.masalah })
      continue
    }
    if (hasil.gambar) gambarMap.set(hasil.gambar.id, hasil.gambar.data)
    const t = data.createdAt
    const urut = t && typeof t.seconds === 'number' ? t.seconds : nomor
    items.push({ soal: hasil.soal, mapel: hasil.mapel, urut })
  }
  console.log(`\nSoal sumber=${snap.size} siap dimigrasi=${items.length} dilewati=${laporan.dilewati.length} gambar=${gambarMap.size}`)

  const paketList = susunPaket(items, kelasList, { dibuatOleh: args['dibuat-oleh'] || UID_PEMILIK_BAWAAN, namaGuru: args['nama-guru'] || 'Migrasi TKA' })

  // Gambar (dibagi antar kelas: satu salinan)
  const stat = { gambarBaru: 0, gambarAda: 0, paketBaru: 0, paketSama: 0, paketBeda: 0 }
  for (const [id, data] of gambarMap) {
    const ref = dst.collection('lms_gambar').doc(id)
    if ((await ref.get()).exists) { stat.gambarAda++; continue }
    stat.gambarBaru++
    if (apply) await ref.set({ data, dibuatOleh: args['dibuat-oleh'] || UID_PEMILIK_BAWAAN, createdAt: FieldValue.serverTimestamp() })
  }

  for (const p of paketList) {
    const ref = dst.collection('lms_paket_soal').doc(p.id)
    const ada = await ref.get()
    let aksi = 'baru'
    if (ada.exists) {
      const lama = ada.data()
      const sama = JSON.stringify(lama.soal) === JSON.stringify(p.data.soal) && lama.judul === p.data.judul
      aksi = sama ? 'sama' : 'beda'
    }
    if (aksi === 'baru') stat.paketBaru++
    if (aksi === 'sama') stat.paketSama++
    if (aksi === 'beda') stat.paketBeda++
    laporan.paket.push({ id: p.id, kelas: p.data.kelas, mapel: p.data.mapel, judul: p.data.judul, jumlahSoal: p.data.jumlahSoal, aksi })
    if (apply && (aksi === 'baru' || (aksi === 'beda' && overwrite))) {
      const payload = { ...p.data, updatedAt: FieldValue.serverTimestamp() }
      if (aksi === 'baru') payload.createdAt = FieldValue.serverTimestamp()
      await ref.set(payload, { merge: false })
    }
  }
  laporan.gambar = stat.gambarBaru + stat.gambarAda
  laporan.ringkasan = stat

  console.log(`Paket  baru=${stat.paketBaru} sama=${stat.paketSama} beda=${stat.paketBeda}   Gambar baru=${stat.gambarBaru} sudah-ada=${stat.gambarAda}`)
  const berkas = `migrasi-tka-soal-laporan-${new Date().toISOString().replace(/[:.]/g, '-')}.json`
  writeFileSync(berkas, JSON.stringify(laporan, null, 2))
  console.log(`Laporan lengkap: ${berkas}`)
  if (laporan.dilewati.length) console.log(`${laporan.dilewati.length} soal DILEWATI (kunci/tipe bermasalah) — lihat laporan.`)
  if (stat.paketBeda && !overwrite) console.log(`${stat.paketBeda} paket sudah ada dengan isi BERBEDA — tidak ditimpa (pakai --overwrite bila perlu).`)
  if (!apply) console.log('Ini dry-run. Jalankan ulang dengan --apply untuk menulis.')
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => { console.error('GAGAL:', e.message); process.exit(1) })
}
