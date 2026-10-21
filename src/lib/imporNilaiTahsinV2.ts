/**
 * Impor nilai Tahsin-Tahfizh dari file Excel ekspor penilaian-v2.
 * Hanya untuk admin, fitur sementara migrasi — nanti dinonaktifkan.
 *
 * Matching siswa: NISN → NIS/NIPD → nama (kemiripan ≥ 90%).
 * Periode akademik (tahunAjaran + semester) wajib dipilih admin.
 */
import {
  addDoc,
  collection,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore'
import { auth, db } from './firebase'
import { SURAH_LIST, hitungTotalAyat, type SurahInfo } from './quranSurah'
import type {
  JenisSetoran,
  MateriSetoran,
  MenulisRecord,
  SetoranPayload,
  StatusHafalan,
  SiswaTahsin,
} from '../types/tahsin'

/* -------------------------------------------------------------------------- */
/*  Fuzzy name                                                                */
/* -------------------------------------------------------------------------- */

function normalisasiNama(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0
  if (!a.length) return b.length
  if (!b.length) return a.length
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    const cur = [i]
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      cur[j] = Math.min(cur[j - 1]! + 1, prev[j]! + 1, prev[j - 1]! + cost)
    }
    for (let j = 0; j <= b.length; j++) prev[j] = cur[j]!
  }
  return prev[b.length]!
}

/** Rasio kemiripan 0–1 (1 = identik). */
export function kemiripanNama(a: string, b: string): number {
  const na = normalisasiNama(a)
  const nb = normalisasiNama(b)
  if (!na || !nb) return 0
  if (na === nb) return 1
  const dist = levenshtein(na, nb)
  const maxLen = Math.max(na.length, nb.length)
  return maxLen === 0 ? 0 : 1 - dist / maxLen
}

const AMBANG_NAMA = 0.9

/* -------------------------------------------------------------------------- */
/*  Matching siswa                                                            */
/* -------------------------------------------------------------------------- */

export type CaraMatch = 'nisn' | 'nis' | 'nama' | 'gagal'

export interface HasilMatch {
  siswa: SiswaTahsin | null
  cara: CaraMatch
  skorNama?: number
  kandidat?: SiswaTahsin[]
}

/**
 * Cocokkan baris Excel ke siswa master.
 * Urutan: NISN → NIS/NIPD/id → nama ≥ 90% (dalam kelas yang sama bila ada).
 */
export function cocokkanSiswa(
  nisExcel: string,
  namaExcel: string,
  kelasExcel: string,
  index: {
    byNisn: Map<string, SiswaTahsin>
    byNis: Map<string, SiswaTahsin>
    byKelas: Map<string, SiswaTahsin[]>
  },
): HasilMatch {
  const nis = String(nisExcel || '').trim()
  const nama = String(namaExcel || '').trim()
  const kelas = String(kelasExcel || '').trim().toUpperCase()

  if (nis) {
    const byNisn = index.byNisn.get(nis)
    if (byNisn) return { siswa: byNisn, cara: 'nisn' }
    const byNis = index.byNis.get(nis)
    if (byNis) return { siswa: byNis, cara: 'nis' }
  }

  // Fuzzy nama — prioritaskan siswa di kelas yang sama
  const kandidatKelas = index.byKelas.get(kelas) || []
  const semua = kandidatKelas.length
    ? kandidatKelas
    : Array.from(new Set([...index.byNisn.values(), ...index.byNis.values()]))

  let terbaik: SiswaTahsin | null = null
  let skorTerbaik = 0
  const kandidat: SiswaTahsin[] = []

  for (const s of semua) {
    const skor = kemiripanNama(nama, s.nama)
    if (skor >= AMBANG_NAMA) {
      kandidat.push(s)
      if (skor > skorTerbaik) {
        skorTerbaik = skor
        terbaik = s
      }
    }
  }

  if (kandidat.length === 1 && terbaik) {
    return { siswa: terbaik, cara: 'nama', skorNama: skorTerbaik }
  }
  if (kandidat.length > 1) {
    return { siswa: null, cara: 'gagal', skorNama: skorTerbaik, kandidat }
  }
  return { siswa: null, cara: 'gagal' }
}

export function bangunIndexSiswa(list: SiswaTahsin[]) {
  const byNisn = new Map<string, SiswaTahsin>()
  const byNis = new Map<string, SiswaTahsin>()
  const byKelas = new Map<string, SiswaTahsin[]>()
  for (const s of list) {
    if (s.nisn) byNisn.set(String(s.nisn).trim(), s)
    const id = String(s.nipd || s.nis || s.id || '').trim()
    if (id) byNis.set(id, s)
    if (s.nis && s.nis !== id) byNis.set(String(s.nis).trim(), s)
    const k = (s.kelas || '').toUpperCase()
    if (!byKelas.has(k)) byKelas.set(k, [])
    byKelas.get(k)!.push(s)
  }
  return { byNisn, byNis, byKelas }
}

/* -------------------------------------------------------------------------- */
/*  Parse materi label dari Excel v2                                          */
/* -------------------------------------------------------------------------- */

function normSurahKey(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '')
}

const SURAH_LOOKUP: Map<string, SurahInfo> = (() => {
  const m = new Map<string, SurahInfo>()
  for (const s of SURAH_LIST) {
    m.set(normSurahKey(s.nama), s)
    // alias umum
    if (s.nama.includes("'")) m.set(normSurahKey(s.nama.replace(/'/g, '')), s)
  }
  // alias tambahan yang sering muncul di label v2
  const alias: [string, number][] = [
    ['ala', 87],
    ['alaq', 96],
    ['ala', 87],
    ['buruj', 85],
    ['tariq', 86],
    ['mutaffifin', 83],
    ['insyiqaq', 84],
    ['insyiqaq', 84],
  ]
  for (const [k, no] of alias) {
    const s = SURAH_LIST.find((x) => x.no === no)
    if (s && !m.has(k)) m.set(k, s)
  }
  return m
})()

function cariSurah(nama: string): SurahInfo | null {
  const key = normSurahKey(nama)
  if (SURAH_LOOKUP.has(key)) return SURAH_LOOKUP.get(key)!
  // partial: coba mulai sama
  for (const [k, s] of SURAH_LOOKUP) {
    if (k.startsWith(key) || key.startsWith(k)) return s
  }
  return null
}

/**
 * Parse label materi v2 → MateriSetoran.
 * Contoh: "Al-Buruj ayat 1-5", "Al-A'la:1 — Al-'Alaq:19", "Iqro 3 halaman 5-8"
 */
export function parseMateriLabel(raw: string): MateriSetoran {
  const label = String(raw || '').trim()
  if (!label) {
    return { tipe: 'quran', surahAwal: 1, ayatMulai: 1, surahAkhir: 1, ayatAkhir: 1, totalAyat: 1, label: '' }
  }

  // Iqro: "Iqro 2 halaman 3-7" / "Iqro' 3 hlm 1-5"
  const iqro = label.match(/iqro['’]?\s*(\d+)\s*(?:halaman|hlm\.?|hal\.?)?\s*(\d+)\s*[-–—]\s*(\d+)/i)
  if (iqro) {
    const buku = Number(iqro[1])
    const halamanMulai = Number(iqro[2])
    const halamanAkhir = Number(iqro[3])
    return {
      tipe: 'iqro',
      buku,
      halamanMulai,
      halamanAkhir,
      label: `Iqro ${buku} halaman ${halamanMulai}-${halamanAkhir}`,
    }
  }

  // Lintas surah: "Al-A'la:1 — Al-'Alaq:19" atau "Al-A'la 1 — Al-'Alaq 19"
  const lintas = label.match(
    /^(.+?)\s*[:\s]\s*(\d+)\s*[-–—]\s*(.+?)\s*[:\s]\s*(\d+)\s*$/,
  )
  if (lintas) {
    const sAwal = cariSurah(lintas[1]!.trim())
    const sAkhir = cariSurah(lintas[3]!.trim())
    if (sAwal && sAkhir) {
      const ayatMulai = Number(lintas[2])
      const ayatAkhir = Number(lintas[4])
      return {
        tipe: 'quran',
        surahAwal: sAwal.no,
        ayatMulai,
        surahAkhir: sAkhir.no,
        ayatAkhir,
        totalAyat: hitungTotalAyat(sAwal.no, ayatMulai, sAkhir.no, ayatAkhir),
        label,
      }
    }
  }

  // Satu surah: "Al-Buruj ayat 1-5" / "Al-Buruj 1-5"
  const satu = label.match(/^(.+?)\s+(?:ayat\s+)?(\d+)\s*[-–—]\s*(\d+)\s*$/i)
  if (satu) {
    const s = cariSurah(satu[1]!.trim())
    if (s) {
      const ayatMulai = Number(satu[2])
      const ayatAkhir = Number(satu[3])
      return {
        tipe: 'quran',
        surahAwal: s.no,
        ayatMulai,
        surahAkhir: s.no,
        ayatAkhir,
        totalAyat: Math.max(0, ayatAkhir - ayatMulai + 1),
        label,
      }
    }
  }

  // Fallback: simpan label mentah, default Al-Fatihah 1-1 agar tidak crash
  return {
    tipe: 'quran',
    surahAwal: 1,
    ayatMulai: 1,
    surahAkhir: 1,
    ayatAkhir: 1,
    totalAyat: 1,
    label,
  }
}

/* -------------------------------------------------------------------------- */
/*  Normalisasi jenis & status                                                */
/* -------------------------------------------------------------------------- */

export function normalisasiJenis(raw: string): JenisSetoran {
  const t = String(raw || '')
    .toLowerCase()
    .replace(/['’]/g, '')
    .trim()
  if (t.includes('ziyadah') || t.includes('ziyada')) return 'ziyadah'
  if (t.includes('muroja') || t.includes('muraja')) return 'murojaah'
  return 'tahsin'
}

export function normalisasiStatusHafalan(raw: unknown): StatusHafalan | null {
  if (raw == null || raw === '') return null
  const t = String(raw).toLowerCase().trim()
  if (t === 'lulus' || t === 'lulus.') return 'lulus'
  if (t.includes('ulang') || t.includes('perlu')) return 'ulang'
  return null
}

function parseTanggalJam(tgl: unknown, jam: unknown): Date | null {
  const d = String(tgl || '').trim()
  if (!d) return null
  // YYYY-MM-DD
  const m = d.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (!m) return null
  let h = 8,
    mi = 0
  const j = String(jam || '').trim()
  const mj = j.match(/^(\d{1,2}):(\d{2})/)
  if (mj) {
    h = Number(mj[1])
    mi = Number(mj[2])
  }
  const dt = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), h, mi, 0)
  return Number.isNaN(dt.getTime()) ? null : dt
}

/* -------------------------------------------------------------------------- */
/*  Baca Excel v2                                                             */
/* -------------------------------------------------------------------------- */

export interface BarisSetoranV2 {
  baris: number
  kelas: string
  nis: string
  nama: string
  tanggal: string
  jam: string
  jenis: string
  materi: string
  statusHafalan: string
  ayatDinilai: number | null
  catatanTajwid: number | null
  catatanMakhraj: number | null
  catatanGuru: string
  dicatatOleh: string
}

export interface BarisMenulisV2 {
  baris: number
  kelas: string
  nis: string
  nama: string
  tanggalPeriksa: string
  materi: string
  hurufSambungan: number | null
  harakat: number | null
  keutuhanTeks: number | null
  kerapian: number | null
  rataRata: number | null
  catatan: string
  dicatatOleh: string
}

function cellStr(v: unknown): string {
  if (v == null) return ''
  if (v instanceof Date) {
    const p = (n: number) => String(n).padStart(2, '0')
    return `${v.getFullYear()}-${p(v.getMonth() + 1)}-${p(v.getDate())}`
  }
  return String(v).trim()
}

function cellNum(v: unknown): number | null {
  if (v == null || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

/** Baca ArrayBuffer Excel v2 → baris Detail Setoran & Detail Menulis. */
export async function bacaExcelV2(buf: ArrayBuffer | Uint8Array): Promise<{
  setoran: BarisSetoranV2[]
  menulis: BarisMenulisV2[]
  meta: { kelas?: string; periode?: string }
}> {
  const XLSX = await import('xlsx')
  const wb = XLSX.read(buf, { type: 'array', cellDates: true })

  const setoran: BarisSetoranV2[] = []
  const menulis: BarisMenulisV2[] = []
  const meta: { kelas?: string; periode?: string } = {}

  const sheetSetoran = wb.Sheets['Detail Setoran']
  if (sheetSetoran) {
    const rows = XLSX.utils.sheet_to_json<unknown[]>(sheetSetoran, {
      header: 1,
      defval: null,
      raw: true,
    })
    // header: Kelas, NIS, Nama Siswa, Tanggal, Jam, Jenis Setoran, Materi, Status Hafalan,
    //         Ayat/Bacaan Dinilai, Catatan Tajwid, Catatan Makhraj, Catatan Guru, Dicatat Oleh
    for (let i = 1; i < rows.length; i++) {
      const r = rows[i]
      if (!r || r.length < 4) continue
      const nis = cellStr(r[1])
      const nama = cellStr(r[2])
      if (!nis && !nama) continue
      setoran.push({
        baris: i + 1,
        kelas: cellStr(r[0]).toUpperCase(),
        nis,
        nama,
        tanggal: cellStr(r[3]),
        jam: cellStr(r[4]),
        jenis: cellStr(r[5]),
        materi: cellStr(r[6]),
        statusHafalan: cellStr(r[7]),
        ayatDinilai: cellNum(r[8]),
        catatanTajwid: cellNum(r[9]),
        catatanMakhraj: cellNum(r[10]),
        catatanGuru: cellStr(r[11]),
        dicatatOleh: cellStr(r[12]),
      })
    }
  }

  const sheetMenulis = wb.Sheets['Detail Menulis']
  if (sheetMenulis) {
    const rows = XLSX.utils.sheet_to_json<unknown[]>(sheetMenulis, {
      header: 1,
      defval: null,
      raw: true,
    })
    // Kelas, NIS, Nama Siswa, Tanggal Periksa, Materi,
    // Huruf & Sambungan, Harakat, Keutuhan Teks, Kerapian, Rata-rata, Catatan, Dicatat Oleh
    for (let i = 1; i < rows.length; i++) {
      const r = rows[i]
      if (!r || r.length < 4) continue
      const nis = cellStr(r[1])
      const nama = cellStr(r[2])
      if (!nis && !nama) continue
      menulis.push({
        baris: i + 1,
        kelas: cellStr(r[0]).toUpperCase(),
        nis,
        nama,
        tanggalPeriksa: cellStr(r[3]),
        materi: cellStr(r[4]),
        hurufSambungan: cellNum(r[5]),
        harakat: cellNum(r[6]),
        keutuhanTeks: cellNum(r[7]),
        kerapian: cellNum(r[8]),
        rataRata: cellNum(r[9]),
        catatan: cellStr(r[10]),
        dicatatOleh: cellStr(r[11]),
      })
    }
  }

  const sheetKet = wb.Sheets['Keterangan']
  if (sheetKet) {
    const rows = XLSX.utils.sheet_to_json<unknown[]>(sheetKet, {
      header: 1,
      defval: null,
      raw: true,
    })
    for (const r of rows) {
      if (!r || r.length < 2) continue
      const k = cellStr(r[0]).toLowerCase()
      if (k.includes('cakupan') || k === 'kelas') meta.kelas = cellStr(r[1]).replace(/^kelas\s+/i, '').toUpperCase()
      if (k.includes('periode')) meta.periode = cellStr(r[1])
    }
  }

  return { setoran, menulis, meta }
}

/* -------------------------------------------------------------------------- */
/*  Pratinjau                                                                 */
/* -------------------------------------------------------------------------- */

export type StatusBarisImpor = 'siap' | 'error' | 'ambigu'

export interface BarisPraLihatSetoran {
  baris: number
  status: StatusBarisImpor
  pesan?: string
  caraMatch?: CaraMatch
  nisExcel: string
  namaExcel: string
  siswaId?: string
  siswaNama?: string
  jenis: JenisSetoran
  materiLabel: string
  statusHafalan: StatusHafalan | null
  tanggal: string
  payload?: SetoranPayload & { createdAt?: Timestamp | Date; sumber?: string }
}

export interface BarisPraLihatMenulis {
  baris: number
  status: StatusBarisImpor
  pesan?: string
  caraMatch?: CaraMatch
  nisExcel: string
  namaExcel: string
  siswaId?: string
  siswaNama?: string
  materiLabel: string
  tanggalPeriksa: string
  payload?: Record<string, unknown>
}

export interface HasilPraLihatImpor {
  setoran: BarisPraLihatSetoran[]
  menulis: BarisPraLihatMenulis[]
  ringkas: {
    setoranSiap: number
    setoranError: number
    setoranAmbigu: number
    menulisSiap: number
    menulisError: number
    menulisAmbigu: number
  }
  meta: { kelas?: string; periode?: string }
}

export function praLihatImporV2(
  data: { setoran: BarisSetoranV2[]; menulis: BarisMenulisV2[]; meta: { kelas?: string; periode?: string } },
  siswaList: SiswaTahsin[],
  periode: { tahunAjaran: string; semester: '1' | '2' },
): HasilPraLihatImpor {
  const index = bangunIndexSiswa(siswaList)
  const setoranOut: BarisPraLihatSetoran[] = []
  const menulisOut: BarisPraLihatMenulis[] = []

  for (const row of data.setoran) {
    const match = cocokkanSiswa(row.nis, row.nama, row.kelas, index)
    if (!match.siswa) {
      setoranOut.push({
        baris: row.baris,
        status: match.kandidat && match.kandidat.length > 1 ? 'ambigu' : 'error',
        pesan:
          match.kandidat && match.kandidat.length > 1
            ? `Beberapa siswa mirip: ${match.kandidat.map((s) => s.nama).join(', ')}`
            : `Siswa tidak ditemukan (NIS ${row.nis || '—'}, nama "${row.nama}")`,
        caraMatch: match.cara,
        nisExcel: row.nis,
        namaExcel: row.nama,
        jenis: normalisasiJenis(row.jenis),
        materiLabel: row.materi,
        statusHafalan: normalisasiStatusHafalan(row.statusHafalan),
        tanggal: row.tanggal,
      })
      continue
    }

    const materi = parseMateriLabel(row.materi)
    const jenis = normalisasiJenis(row.jenis)
    const statusHafalan = normalisasiStatusHafalan(row.statusHafalan)
    const dt = parseTanggalJam(row.tanggal, row.jam)

    // Catatan: gabungkan catatan guru + ringkas Baca & Tandai jika ada
    let catatan = row.catatanGuru || ''
    const extras: string[] = []
    if (row.ayatDinilai != null) extras.push(`${row.ayatDinilai} ayat/bacaan dinilai`)
    if (row.catatanTajwid) extras.push(`${row.catatanTajwid} tajwid`)
    if (row.catatanMakhraj) extras.push(`${row.catatanMakhraj} makhraj`)
    if (extras.length) {
      const ringkas = extras.join(' • ')
      catatan = catatan ? `${catatan} [${ringkas}]` : ringkas
    }

    const jenjang = match.siswa.jenjang || (parseInt(match.siswa.kelas, 10) <= 2 ? 'iqro' : 'quran')

    const payload: SetoranPayload & { createdAt?: Timestamp | Date; sumber?: string } = {
      siswaId: match.siswa.id,
      siswaNama: match.siswa.nama,
      kelas: match.siswa.kelas,
      jenjang,
      jenis,
      materi,
      statusHafalan,
      catatan,
      createdByNama: row.dicatatOleh || 'Impor v2',
      tahunAjaran: periode.tahunAjaran,
      semester: periode.semester,
      sumber: 'impor-v2',
    }
    if (dt) payload.createdAt = Timestamp.fromDate(dt)

    setoranOut.push({
      baris: row.baris,
      status: 'siap',
      caraMatch: match.cara,
      nisExcel: row.nis,
      namaExcel: row.nama,
      siswaId: match.siswa.id,
      siswaNama: match.siswa.nama,
      jenis,
      materiLabel: materi.label || row.materi,
      statusHafalan,
      tanggal: row.tanggal,
      payload,
    })
  }

  for (const row of data.menulis) {
    const match = cocokkanSiswa(row.nis, row.nama, row.kelas, index)
    if (!match.siswa) {
      menulisOut.push({
        baris: row.baris,
        status: match.kandidat && match.kandidat.length > 1 ? 'ambigu' : 'error',
        pesan:
          match.kandidat && match.kandidat.length > 1
            ? `Beberapa siswa mirip: ${match.kandidat.map((s) => s.nama).join(', ')}`
            : `Siswa tidak ditemukan (NIS ${row.nis || '—'}, nama "${row.nama}")`,
        caraMatch: match.cara,
        nisExcel: row.nis,
        namaExcel: row.nama,
        materiLabel: row.materi,
        tanggalPeriksa: row.tanggalPeriksa,
      })
      continue
    }

    const materi = parseMateriLabel(row.materi)
    const dt = parseTanggalJam(row.tanggalPeriksa, null)

    const payload: Record<string, unknown> = {
      siswaId: match.siswa.id,
      siswaNama: match.siswa.nama,
      kelas: match.siswa.kelas,
      materi: {
        tipe: materi.tipe,
        label: materi.label || row.materi,
        ...(materi.tipe === 'quran'
          ? {
              surahAwal: materi.surahAwal,
              ayatMulai: materi.ayatMulai,
              surahAkhir: materi.surahAkhir,
              ayatAkhir: materi.ayatAkhir,
              totalAyat: materi.totalAyat,
            }
          : {
              buku: materi.buku,
              halamanMulai: materi.halamanMulai,
              halamanAkhir: materi.halamanAkhir,
            }),
      },
      penilaian: {
        hurufSambungan: row.hurufSambungan,
        harakat: row.harakat,
        keutuhanTeks: row.keutuhanTeks,
        kerapian: row.kerapian,
      },
      catatan: row.catatan || '',
      tanggalPeriksa: row.tanggalPeriksa || (dt ? dt.toISOString().slice(0, 10) : ''),
      createdByNama: row.dicatatOleh || 'Impor v2',
      sumber: 'impor-v2',
      tahunAjaran: periode.tahunAjaran,
      semester: periode.semester,
    }
    if (dt) payload.createdAt = Timestamp.fromDate(dt)

    menulisOut.push({
      baris: row.baris,
      status: 'siap',
      caraMatch: match.cara,
      nisExcel: row.nis,
      namaExcel: row.nama,
      siswaId: match.siswa.id,
      siswaNama: match.siswa.nama,
      materiLabel: (materi.label || row.materi) as string,
      tanggalPeriksa: row.tanggalPeriksa,
      payload,
    })
  }

  return {
    setoran: setoranOut,
    menulis: menulisOut,
    ringkas: {
      setoranSiap: setoranOut.filter((x) => x.status === 'siap').length,
      setoranError: setoranOut.filter((x) => x.status === 'error').length,
      setoranAmbigu: setoranOut.filter((x) => x.status === 'ambigu').length,
      menulisSiap: menulisOut.filter((x) => x.status === 'siap').length,
      menulisError: menulisOut.filter((x) => x.status === 'error').length,
      menulisAmbigu: menulisOut.filter((x) => x.status === 'ambigu').length,
    },
    meta: data.meta,
  }
}

/* -------------------------------------------------------------------------- */
/*  Eksekusi tulis ke Firestore                                               */
/* -------------------------------------------------------------------------- */

export async function jalankanImporV2(pra: HasilPraLihatImpor): Promise<{
  setoranOk: number
  menulisOk: number
  gagal: number
}> {
  let setoranOk = 0
  let menulisOk = 0
  let gagal = 0
  const uid = auth.currentUser?.uid || null

  for (const b of pra.setoran) {
    if (b.status !== 'siap' || !b.payload) continue
    try {
      const { createdAt, ...rest } = b.payload
      await addDoc(collection(db, 'setoran'), {
        ...rest,
        createdBy: uid,
        createdAt: createdAt || serverTimestamp(),
      })
      setoranOk++
    } catch (e) {
      console.error('Gagal impor setoran baris', b.baris, e)
      gagal++
    }
  }

  for (const b of pra.menulis) {
    if (b.status !== 'siap' || !b.payload) continue
    try {
      const { createdAt, ...rest } = b.payload
      await addDoc(collection(db, 'menulis_log'), {
        ...rest,
        createdBy: uid,
        createdAt: createdAt || serverTimestamp(),
      })
      menulisOk++
    } catch (e) {
      console.error('Gagal impor menulis baris', b.baris, e)
      gagal++
    }
  }

  return { setoranOk, menulisOk, gagal }
}

/** Muat semua siswa aktif (untuk matching). Admin boleh semua kelas. */
export async function muatSiswaUntukImpor(): Promise<SiswaTahsin[]> {
  const { getDocs, query, collection: col, where } = await import('firebase/firestore')
  const q = query(col(db, 'siswa'), where('aktif', '==', true))
  const snap = await getDocs(q)
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as SiswaTahsin)
}
