// Aturan murni login siswa LMS (Cloud Function loginSiswaLms). Dipisah dari handler supaya bisa
// diuji tanpa Firebase. Uji: node scripts/cek-login-siswa-lms.mjs (dari root repo)
import { createHash, timingSafeEqual } from 'node:crypto'

/** Salah NISN berturut-turut sebelum siswa dikunci sementara. */
export const MAKS_GAGAL = 5
/** Lama kunci setelah MAKS_GAGAL kali salah (milidetik). */
export const DURASI_KUNCI_MS = 10 * 60 * 1000
/** Pesan seragam untuk siswa tidak ada / nonaktif / NISN salah (tidak membedakan, anti-enumerasi). */
export const PESAN_GAGAL = 'NISN tidak cocok. Periksa kembali.'

const POLA_ID = /^[A-Za-z0-9_.-]{1,100}$/

/**
 * @param {unknown} data request.data dari klien
 * @returns {{ok: true, siswaId: string, nisn: string} | {ok: false, pesan: string}}
 */
export function validasiInputLogin(data) {
  const siswaId = typeof data?.siswaId === 'string' ? data.siswaId.trim() : ''
  const nisn = typeof data?.nisn === 'string' ? data.nisn.trim() : ''
  if (!POLA_ID.test(siswaId) || siswaId === '.' || siswaId === '..') {
    return { ok: false, pesan: 'Pilih nama siswa terlebih dahulu.' }
  }
  if (nisn.length === 0 || nisn.length > 32) {
    return { ok: false, pesan: 'Masukkan NISN.' }
  }
  return { ok: true, siswaId, nisn }
}

/** Bandingkan NISN tanpa bocoran waktu (hash dulu agar panjang sama). */
export function samaNisn(masukan, terdaftar) {
  const a = createHash('sha256').update(String(masukan).trim()).digest()
  const b = createHash('sha256').update(String(terdaftar).trim()).digest()
  return timingSafeEqual(a, b)
}

/**
 * @param {{jumlah?: number, terkunciSampai?: number} | null} catatan dokumen lms_login_gagal/{siswaId}
 * @param {number} sekarang epoch ms
 */
export function statusKunci(catatan, sekarang) {
  const sampai = Number(catatan?.terkunciSampai ?? 0)
  if (sampai > sekarang) {
    return { terkunci: true, sisaMenit: Math.max(1, Math.ceil((sampai - sekarang) / 60000)) }
  }
  return { terkunci: false, sisaMenit: 0 }
}

/** Catatan baru setelah satu percobaan salah. Kunci lama yang sudah lewat tidak ikut dihitung. */
export function catatGagal(catatan, sekarang) {
  const sampai = Number(catatan?.terkunciSampai ?? 0)
  const dasar = sampai > 0 && sampai <= sekarang ? 0 : Number(catatan?.jumlah ?? 0)
  const jumlah = dasar + 1
  if (jumlah >= MAKS_GAGAL) {
    return { jumlah: 0, terkunciSampai: sekarang + DURASI_KUNCI_MS, updatedAt: sekarang }
  }
  return { jumlah, terkunciSampai: 0, updatedAt: sekarang }
}

/**
 * UID Firebase Auth + custom claims untuk siswa. Claims dibaca firestore.rules:
 * lmsSiswa (penanda), siswaId (id dokumen siswa/{id}), kelas (huruf besar, dipakai membatasi baca materi).
 */
export function susunToken(siswaId, siswa) {
  return {
    uid: `lms_siswa_${siswaId}`,
    claims: {
      lmsSiswa: true,
      siswaId,
      kelas: String(siswa.kelas ?? '').trim().toUpperCase(),
      nama: String(siswa.nama ?? '').trim().slice(0, 80),
    },
  }
}
