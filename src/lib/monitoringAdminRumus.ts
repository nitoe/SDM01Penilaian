import type { Mapel, TujuanPembelajaran } from '../types/akademik.ts'
import type { AppUser } from '../types/user.ts'
import { SEMUA_KELAS } from '../types/tahsin.ts'
import { bobotTpDiSemester, mapelBerlakuDiTingkatan, tingkatanDariKelas, tpMasukSemester } from './akademikRumus.ts'

// Berkas ini MURNI (tanpa Firebase) supaya bisa diuji: node --experimental-strip-types scripts/cek-monitoring-admin.mjs
// Dipakai dashboard admin (Tahap 2). Admin hanya membaca (ANTIREGRESI §17).

export type StatusTp = 'belum_tp' | 'ada_tp'
export type StatusBobot = 'belum_tp' | 'belum_bobot' | 'tidak_100' | 'ok'
export type StatusNilai = 'tanpa_tp' | 'belum' | 'sebagian' | 'lengkap'

export interface GuruPantau {
  uid: string
  nama: string
  gelar?: string
  role: AppUser['role']
  waliKelas: string[]
  penugasan: { kelas: string; mapel: string }[]
  kelasAmpu: string[]
}

/** Satu pasangan mapel×kelas beserta penanggung jawab input. */
export interface Pasangan {
  mapel: string
  kelas: string
  /** uid penanggung jawab; kosong = belum ada guru yang ditugaskan */
  penanggung: string[]
  /** 'penugasan' = guru bidang studi/penugasan; 'wali' = wali kelas karena tidak ada penugasan */
  sumber: 'penugasan' | 'wali' | 'kosong'
}

export type SamaMapel = (a: string, b: string) => boolean
const samaPersis: SamaMapel = (a, b) => a.trim().toLowerCase() === b.trim().toLowerCase()

/** Akun yang dihitung: aktif dan tidak sedang menunggu/ditolak. Orang tua tidak ikut. */
export function akunDipantau(u: Pick<AppUser, 'role' | 'aktif' | 'status'>): boolean {
  if (u.role === 'orangtua' || u.role === 'admin') return false
  if (u.aktif === false) return false
  return !u.status || u.status === 'approved'
}

export function keGuruPantau(u: AppUser): GuruPantau {
  return {
    uid: u.uid,
    nama: u.nama,
    gelar: u.gelar,
    role: u.role,
    waliKelas: u.waliKelas ?? [],
    penugasan: u.penugasan ?? [],
    kelasAmpu: u.kelasAmpu ?? [],
  }
}

export const adaAkademik = (g: GuruPantau) => g.role === 'guru_akademik' || g.role === 'guru'
export const adaTahsin = (g: GuruPantau) =>
  (g.role === 'guru_tahsin_tahfizh' || g.role === 'guru') && g.kelasAmpu.length > 0

/**
 * Tanggung jawab input per mapel×kelas.
 * Aturan: guru yang punya penugasan pada pasangan itu bertanggung jawab; bila tidak ada, wali kelas.
 * Mencegah guru kelas (yang membuka semua mapel di kelasnya) terhitung ganda untuk mapel bidang studi.
 */
export function hitungPasangan(
  guru: GuruPantau[],
  mapel: Mapel[],
  samaMapel: SamaMapel = samaPersis,
  daftarKelas: readonly string[] = SEMUA_KELAS,
): Pasangan[] {
  const akademik = guru.filter(adaAkademik)
  const hasil: Pasangan[] = []
  for (const kelas of daftarKelas) {
    const tingkatan = tingkatanDariKelas(kelas)
    for (const m of mapel) {
      if (!mapelBerlakuDiTingkatan(m, tingkatan)) continue
      const bidang = akademik.filter((g) =>
        g.penugasan.some((p) => p.kelas === kelas && samaMapel(p.mapel, m.nama)),
      )
      if (bidang.length > 0) {
        hasil.push({ mapel: m.nama, kelas, penanggung: bidang.map((g) => g.uid), sumber: 'penugasan' })
        continue
      }
      const wali = akademik.filter((g) => g.waliKelas.includes(kelas))
      hasil.push({
        mapel: m.nama,
        kelas,
        penanggung: wali.map((g) => g.uid),
        sumber: wali.length ? 'wali' : 'kosong',
      })
    }
  }
  return hasil
}

export interface RingkasTp {
  jumlahTp: number
  /** TP yang sudah dialokasikan ke semester ini secara eksplisit */
  dialokasi: number
  totalBobot: number
  status: StatusBobot
  statusTp: StatusTp
}

const punyaAlokasi = (tp: Pick<TujuanPembelajaran, 'semester' | 'bobotPerSemester'>) =>
  Boolean(tp.semester) || Object.keys(tp.bobotPerSemester ?? {}).length > 0

/** Status TP dan bobot untuk satu pasangan pada semester tertentu. */
export function ringkasTp(
  tps: Pick<TujuanPembelajaran, 'semester' | 'bobotMapel' | 'bobotPerSemester'>[],
  semester: string,
): RingkasTp {
  if (tps.length === 0) {
    return { jumlahTp: 0, dialokasi: 0, totalBobot: 0, status: 'belum_tp', statusTp: 'belum_tp' }
  }
  const eksplisit = tps.filter((t) => punyaAlokasi(t) && tpMasukSemester(t, semester))
  const total = eksplisit.reduce((n, t) => n + (bobotTpDiSemester(t, semester) ?? 0), 0)
  const bulat = Math.round(total * 100) / 100
  let status: StatusBobot = 'ok'
  if (eksplisit.length === 0) status = 'belum_bobot'
  else if (Math.abs(bulat - 100) > 0.5) status = 'tidak_100'
  return { jumlahTp: tps.length, dialokasi: eksplisit.length, totalBobot: bulat, status, statusTp: 'ada_tp' }
}

/** Status kelengkapan nilai: jumlah isian vs (TP semester ini × siswa aktif). */
export function statusNilai(tpSemester: number, siswaAktif: number, terisi: number): StatusNilai {
  if (tpSemester <= 0) return 'tanpa_tp'
  if (terisi <= 0) return 'belum'
  return terisi >= tpSemester * Math.max(siswaAktif, 1) ? 'lengkap' : 'sebagian'
}

export interface BarisPasangan extends Pasangan {
  tp: RingkasTp
  nilai: StatusNilai
  terisi: number
  diharapkan: number
}

export interface RingkasGuru {
  guru: GuruPantau
  pasangan: BarisPasangan[]
  jumlah: number
  tpBelum: number
  bobotBelum: number
  bobotTidak100: number
  nilaiBelum: number
  nilaiSebagian: number
  nilaiLengkap: number
}

/** Kelompokkan pasangan per guru penanggung jawab. Pasangan tanpa penanggung jawab dikembalikan terpisah. */
export function ringkasPerGuru(
  guru: GuruPantau[],
  baris: BarisPasangan[],
): { perGuru: RingkasGuru[]; tanpaPenanggung: BarisPasangan[] } {
  const perUid = new Map<string, BarisPasangan[]>()
  const tanpa: BarisPasangan[] = []
  for (const b of baris) {
    if (b.penanggung.length === 0) {
      tanpa.push(b)
      continue
    }
    for (const uid of b.penanggung) perUid.set(uid, [...(perUid.get(uid) ?? []), b])
  }
  const perGuru = guru
    .filter(adaAkademik)
    .map((g) => {
      const p = perUid.get(g.uid) ?? []
      return {
        guru: g,
        pasangan: p,
        jumlah: p.length,
        tpBelum: p.filter((x) => x.tp.statusTp === 'belum_tp').length,
        bobotBelum: p.filter((x) => x.tp.status === 'belum_bobot').length,
        bobotTidak100: p.filter((x) => x.tp.status === 'tidak_100').length,
        nilaiBelum: p.filter((x) => x.nilai === 'belum').length,
        nilaiSebagian: p.filter((x) => x.nilai === 'sebagian').length,
        nilaiLengkap: p.filter((x) => x.nilai === 'lengkap').length,
      }
    })
    .filter((r) => r.jumlah > 0)
    .sort((a, b) => a.guru.nama.localeCompare(b.guru.nama, 'id'))
  return { perGuru, tanpaPenanggung: tanpa }
}

export interface RingkasTahsinGuru {
  guru: GuruPantau
  setoran: number
  status: 'belum' | 'sudah'
}

export function ringkasTahsin(guru: GuruPantau[], setoranPerUid: Record<string, number>): RingkasTahsinGuru[] {
  return guru
    .filter(adaTahsin)
    .map((g) => {
      const n = setoranPerUid[g.uid] ?? 0
      return { guru: g, setoran: n, status: n > 0 ? ('sudah' as const) : ('belum' as const) }
    })
    .sort((a, b) => a.guru.nama.localeCompare(b.guru.nama, 'id'))
}

/** Hitungan untuk kartu ringkasan. Satu guru dihitung "sudah" hanya bila SEMUA pasangannya beres. */
export function hitungSudahBelum(perGuru: RingkasGuru[]) {
  const total = perGuru.length
  const tpSudah = perGuru.filter((r) => r.tpBelum === 0).length
  const bobotSudah = perGuru.filter((r) => r.tpBelum === 0 && r.bobotBelum === 0 && r.bobotTidak100 === 0).length
  const nilaiSudah = perGuru.filter((r) => r.nilaiBelum === 0 && r.nilaiSebagian === 0).length
  return {
    total,
    tp: { sudah: tpSudah, belum: total - tpSudah },
    bobot: { sudah: bobotSudah, belum: total - bobotSudah },
    nilai: { sudah: nilaiSudah, belum: total - nilaiSudah },
  }
}

export type MetrikKelas = 'tp' | 'bobot' | 'nilai'

export interface RingkasKelas {
  kelas: string
  beres: number
  sebagian: number
  belum: number
  /** pasangan yang relevan untuk metrik ini */
  total: number
}

/** Hasil satu pasangan untuk satu metrik; null = tidak relevan (mis. nilai untuk mapel tanpa TP semester ini). */
export function hasilMetrik(m: MetrikKelas, b: BarisPasangan): 'beres' | 'sebagian' | 'belum' | null {
  if (m === 'tp') return b.tp.statusTp === 'ada_tp' ? 'beres' : 'belum'
  if (m === 'bobot') {
    if (b.tp.status === 'belum_tp') return null
    return b.tp.status === 'ok' ? 'beres' : b.tp.status === 'tidak_100' ? 'sebagian' : 'belum'
  }
  if (b.nilai === 'tanpa_tp') return null
  return b.nilai === 'lengkap' ? 'beres' : b.nilai === 'sebagian' ? 'sebagian' : 'belum'
}

/** Kelengkapan per kelas untuk grafik beranda admin. Urutan kelas mengikuti `urutan`. */
export function ringkasPerKelas(
  baris: BarisPasangan[],
  metrik: MetrikKelas,
  urutan: readonly string[] = SEMUA_KELAS,
): RingkasKelas[] {
  return urutan
    .map((kelas) => {
      const r: RingkasKelas = { kelas, beres: 0, sebagian: 0, belum: 0, total: 0 }
      for (const b of baris) {
        if (b.kelas !== kelas) continue
        const h = hasilMetrik(metrik, b)
        if (!h) continue
        r[h]++
        r.total++
      }
      return r
    })
    .filter((r) => r.total > 0)
}

export interface RingkasRaporKelas {
  kelas: string
  siswaAktif: number
  wali: string[]
  /** siswa yang punya catatan absensi tersimpan */
  absensi: number
  catatanWali: number
  /** hanya bermakna di semester 2 */
  keputusan: number
  kokurikuler: number
  /** siswa dengan minimal satu kegiatan ekskul berpredikat 1–3 (informasi; tidak wajib) */
  ekskul: number
  status: 'lengkap' | 'sebagian' | 'belum'
}

interface DokAbsensi { siswaId: string; kelas: string; catatanWali?: string; keputusan?: string }
interface DokKokurikuler { siswaId: string; kelas: string; deskripsi?: string }
interface DokEkskul { siswaId: string; kelas: string; level?: number }

/**
 * Kelengkapan data Rapor SAS per kelas (ANTIREGRESI §23/§24). Wajib: ketidakhadiran dan kokurikuler untuk
 * SEMUA siswa aktif (+ keputusan di semester 2). Catatan wali dan ekskul bersifat informasi, tidak menentukan status.
 * Status: lengkap = semua wajib terisi; belum = tidak ada yang terisi; selainnya sebagian.
 */
export function ringkasRaporPerKelas(
  siswaAktifPerKelas: Record<string, number>,
  guru: GuruPantau[],
  absensi: DokAbsensi[],
  kokurikuler: DokKokurikuler[],
  ekskul: DokEkskul[],
  semester: '1' | '2',
  daftarKelas: readonly string[] = SEMUA_KELAS,
): RingkasRaporKelas[] {
  const unik = <T extends { siswaId: string; kelas: string }>(arr: T[], kelas: string, ok: (x: T) => boolean) =>
    new Set(arr.filter((x) => x.kelas === kelas && ok(x)).map((x) => x.siswaId)).size
  return daftarKelas
    .filter((kelas) => (siswaAktifPerKelas[kelas] ?? 0) > 0)
    .map((kelas) => {
      const n = siswaAktifPerKelas[kelas] ?? 0
      const r: RingkasRaporKelas = {
        kelas,
        siswaAktif: n,
        wali: guru.filter((g) => adaAkademik(g) && g.waliKelas.includes(kelas)).map((g) => g.nama),
        absensi: Math.min(n, unik(absensi, kelas, () => true)),
        catatanWali: Math.min(n, unik(absensi, kelas, (x) => !!x.catatanWali?.trim())),
        keputusan: Math.min(n, unik(absensi, kelas, (x) => !!x.keputusan && x.keputusan !== 'Belum diputuskan')),
        kokurikuler: Math.min(n, unik(kokurikuler, kelas, (x) => !!x.deskripsi?.trim())),
        ekskul: Math.min(n, unik(ekskul, kelas, (x) => (x.level ?? 0) >= 1 && (x.level ?? 0) <= 3)),
        status: 'belum',
      }
      const wajib = [r.absensi, r.kokurikuler, ...(semester === '2' ? [r.keputusan] : [])]
      r.status = wajib.every((v) => v >= n) ? 'lengkap' : wajib.every((v) => v === 0) ? 'belum' : 'sebagian'
      return r
    })
}
