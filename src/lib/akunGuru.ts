import { SEMUA_KELAS } from '../types/tahsin.ts'
import type { UserRole } from '../types/user'
import { turunkanFieldRules } from './penugasan.ts'

/** Peran yang dikelola di halaman Kelola Akun (orang tua punya halaman sendiri). */
export const ROLE_STAF: readonly UserRole[] = ['admin', 'guru', 'guru_tahsin_tahfizh', 'guru_akademik']

/** Tugas yang boleh digabung. Peran Firestore diturunkan dari kombinasi ini. */
export interface TugasGuru {
  tahsin: boolean
  /** Guru kelas / wali kelas. */
  guruKelas: boolean
  bidangStudi: boolean
}

export function tugasDariAkun(input: {
  role: UserRole
  kelasAmpu?: string[]
  waliKelas?: string[]
  penugasan?: { kelas: string; mapel: string }[]
}): TugasGuru {
  if (input.role === 'admin' || input.role === 'orangtua') {
    return { tahsin: false, guruKelas: false, bidangStudi: false }
  }
  const adaWali = (input.waliKelas?.length ?? 0) > 0
  const tugas = rapikanPenugasan(input.penugasan ?? [])
  const kelasWali = new Set(urutKelas(input.waliKelas ?? []))
  const adaDiLuar = tugas.some((p) => !kelasWali.has(p.kelas))
  const bidangStudi = adaDiLuar || (!adaWali && tugas.length > 0)
  if (input.role === 'guru_tahsin_tahfizh') {
    return { tahsin: true, guruKelas: false, bidangStudi: false }
  }
  if (input.role === 'guru_akademik') {
    if (!adaWali && tugas.length === 0) return { tahsin: false, guruKelas: true, bidangStudi: false }
    return { tahsin: false, guruKelas: adaWali, bidangStudi }
  }
  return { tahsin: true, guruKelas: adaWali, bidangStudi }
}

/** `guru` = Tahsin sekaligus guru kelas dan/atau bidang studi. */
export function roleDariTugas(t: TugasGuru): UserRole {
  const akademik = t.guruKelas || t.bidangStudi
  if (t.tahsin && akademik) return 'guru'
  if (t.tahsin) return 'guru_tahsin_tahfizh'
  return 'guru_akademik'
}

const KELAS_SAH = new Set<string>(SEMUA_KELAS)
const URUTAN: readonly string[] = SEMUA_KELAS

export interface InputAkunGuru {
  email: string
  nama: string
  gelar?: string
  role: UserRole
  kelasAmpu: string[]
  penugasan: { kelas: string; mapel: string }[]
  waliKelas: string[]
  aktif: boolean
  status?: 'pending' | 'approved' | 'rejected'
}

/** Dokumen `users/{uid}` yang ditulis halaman Kelola Akun. */
export interface DokumenAkun {
  email: string
  nama: string
  gelar?: string
  role: UserRole
  kelasAmpu: string[]
  penugasan: { kelas: string; mapel: string }[]
  waliKelas: string[]
  penugasanKelas: string[]
  penugasanKelasMapel: string[]
  aktif: boolean
  status?: 'pending' | 'approved' | 'rejected'
  updatedAt: string
  createdAt?: string
}

export function adalahRole(v: unknown): v is UserRole {
  return (
    v === 'admin' ||
    v === 'guru' ||
    v === 'guru_tahsin_tahfizh' ||
    v === 'guru_akademik' ||
    v === 'orangtua'
  )
}

export function urutKelas(list: string[]): string[] {
  return [...new Set(list.map((k) => k.trim()).filter((k) => KELAS_SAH.has(k)))].sort(
    (a, b) => URUTAN.indexOf(a) - URUTAN.indexOf(b),
  )
}

/** Buang baris kosong, kelas asing, dan pasangan kelas+mapel yang dobel. */
export function rapikanPenugasan(list: { kelas: string; mapel: string }[]): { kelas: string; mapel: string }[] {
  const seen = new Map<string, { kelas: string; mapel: string }>()
  for (const item of list) {
    const kelas = item.kelas.trim()
    const mapel = item.mapel.trim()
    if (!KELAS_SAH.has(kelas) || !mapel) continue
    seen.set(`${kelas}::${mapel}`, { kelas, mapel })
  }
  return [...seen.values()].sort(
    (a, b) => a.mapel.localeCompare(b.mapel, 'id') || URUTAN.indexOf(a.kelas) - URUTAN.indexOf(b.kelas),
  )
}

/** Mapel yang diampu guru kelas di kelas yang diwalikan. */
export function mapelDiampuDiKelasWali(
  penugasan: { kelas: string; mapel: string }[],
  waliKelas: string[],
): string[] {
  const wali = new Set(urutKelas(waliKelas))
  return [...new Set(rapikanPenugasan(penugasan).filter((p) => wali.has(p.kelas)).map((p) => p.mapel))].sort((a, b) =>
    a.localeCompare(b, 'id'),
  )
}

/** Penugasan bidang studi: mapel di kelas yang bukan kelas wali. */
export function penugasanDiLuarKelasWali(
  penugasan: { kelas: string; mapel: string }[],
  waliKelas: string[],
): { kelas: string; mapel: string }[] {
  const wali = new Set(urutKelas(waliKelas))
  return rapikanPenugasan(penugasan).filter((p) => !wali.has(p.kelas))
}

/** Gabungkan mapel guru kelas (berlaku di setiap kelas wali) dengan penugasan bidang studi. */
export function gabungPenugasanGuru(
  waliKelas: string[],
  mapelKelas: string[],
  penugasanLain: { kelas: string; mapel: string }[],
): { kelas: string; mapel: string }[] {
  const mapel = [...new Set(mapelKelas.map((m) => m.trim()).filter(Boolean))]
  const dariKelas = urutKelas(waliKelas).flatMap((kelas) => mapel.map((nama) => ({ kelas, mapel: nama })))
  return rapikanPenugasan([...dariKelas, ...penugasanLain])
}

/**
 * Susun dokumen profil sekaligus field yang dibaca rules.
 * Peran yang tidak memakai sebuah tugas menyimpannya sebagai array kosong,
 * supaya akses lama tidak tertinggal saat peran diganti (ANTIREGRESI §7.4 / §12).
 */
export function susunDokumenAkun(input: InputAkunGuru, sekarang: string, createdAt?: string): DokumenAkun {
  const butuhTahsin = input.role === 'guru' || input.role === 'guru_tahsin_tahfizh'
  const butuhAkademik = input.role === 'guru' || input.role === 'guru_akademik'
  const penugasan = butuhAkademik ? rapikanPenugasan(input.penugasan) : []
  const turunan = turunkanFieldRules(penugasan)
  const dokumen: DokumenAkun = {
    email: input.email.trim().toLowerCase(),
    nama: input.nama.trim(),
    gelar: input.gelar?.trim() || undefined,
    role: input.role,
    kelasAmpu: butuhTahsin ? urutKelas(input.kelasAmpu) : [],
    penugasan,
    waliKelas: butuhAkademik ? urutKelas(input.waliKelas) : [],
    penugasanKelas: turunan.penugasanKelas,
    penugasanKelasMapel: turunan.penugasanKelasMapel,
    aktif: input.aktif !== false,
    status: input.status,
    updatedAt: sekarang,
  }
  if (createdAt) dokumen.createdAt = createdAt
  return dokumen
}

export function validasiAkun(
  input: InputAkunGuru,
  ctx: { baru: boolean; password: string; diriSendiri: boolean; roleLama?: UserRole },
): string | null {
  const email = input.email.trim().toLowerCase()
  const nama = input.nama.trim()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return 'Email tidak valid.'
  if (nama.length < 2) return 'Nama minimal 2 karakter.'
  if (input.role === 'orangtua') return 'Akun orang tua tidak dikelola di halaman ini.'
  if (!ROLE_STAF.includes(input.role)) return 'Peran tidak dikenal.'
  if (ctx.baru && ctx.password.length < 8) return 'Password awal minimal 8 karakter.'
  if (ctx.diriSendiri && input.aktif === false) return 'Anda tidak dapat menonaktifkan akun sendiri.'
  if (ctx.diriSendiri && ctx.roleLama && input.role !== ctx.roleLama) {
    return 'Anda tidak dapat mengubah peran akun sendiri.'
  }
  if (input.role === 'guru_tahsin_tahfizh' && urutKelas(input.kelasAmpu).length === 0) {
    return 'Guru Tahsin-Tahfizh wajib memiliki minimal satu kelas.'
  }
  if (input.role === 'guru' && urutKelas(input.kelasAmpu).length === 0) {
    return 'Kombinasi Tahsin wajib memiliki minimal satu kelas Tahsin-Tahfizh.'
  }
  if (input.role === 'guru_akademik' || input.role === 'guru') {
    const adaKelas = urutKelas(input.waliKelas).length > 0
    const adaMapel = rapikanPenugasan(input.penugasan).length > 0
    if (!adaKelas && !adaMapel) {
      return input.role === 'guru'
        ? 'Tambahkan tugas guru kelas atau guru bidang studi.'
        : 'Guru akademik perlu guru kelas atau penugasan mapel.'
    }
    if (adaKelas && mapelDiampuDiKelasWali(input.penugasan, input.waliKelas ?? []).length === 0) {
      return 'Guru kelas perlu memilih mapel yang diampu di kelasnya, agar bisa menyusun TP dan mengisi nilai.'
    }
    for (const p of input.penugasan) {
      if (!p.kelas.trim() && !p.mapel.trim()) continue
      if (!KELAS_SAH.has(p.kelas.trim())) return `Kelas penugasan tidak dikenal: ${p.kelas || '—'}.`
      if (!p.mapel.trim()) return 'Nama mapel pada penugasan tidak boleh kosong.'
    }
  }
  return null
}

/** Ringkasan satu baris untuk tabel akun. */
export function ringkasTugas(input: {
  role: UserRole
  kelasAmpu?: string[]
  penugasan?: { kelas: string; mapel: string }[]
  waliKelas?: string[]
}): string {
  if (input.role === 'admin') return 'Semua modul'
  const bagian: string[] = []
  const wali = urutKelas(input.waliKelas ?? [])
  if (wali.length) bagian.push(`Guru kelas ${wali.join(', ')}`)
  const tugas = rapikanPenugasan(input.penugasan ?? [])
  if (tugas.length) {
    const mapel = new Set(tugas.map((p) => p.mapel)).size
    bagian.push(`${mapel} mapel · ${tugas.length} kelas`)
  }
  const tahsin = urutKelas(input.kelasAmpu ?? [])
  if ((input.role === 'guru_tahsin_tahfizh' || input.role === 'guru') && tahsin.length) {
    bagian.push(`Tahsin ${tahsin.join(', ')}`)
  }
  return bagian.join(' · ') || 'Belum ada tugas'
}

const NOTICE_KEY = 'sdm-login-notice'

export function simpanNoticeLogin(pesan: string) {
  sessionStorage.setItem(NOTICE_KEY, pesan)
}

/** Ambil lalu hapus pesan sekali-pakai untuk halaman login. */
export function ambilNoticeLogin(): string | null {
  const pesan = sessionStorage.getItem(NOTICE_KEY)
  if (pesan) sessionStorage.removeItem(NOTICE_KEY)
  return pesan
}
