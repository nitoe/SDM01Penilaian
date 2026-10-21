import { initializeApp } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore } from 'firebase-admin/firestore'
import { logger } from 'firebase-functions'
import { HttpsError, onCall } from 'firebase-functions/v2/https'
import { periksaPenghapusan } from './aturan.js'
import {
  bolehPemanggilAi,
  bolehPemanggilAiAset,
  mintaModel,
  mintaModelVision,
  normalisasiAset,
  normalisasiEkskul,
  normalisasiKktp,
  normalisasiTp,
  susunPromptAset,
  susunPromptEkskul,
  susunPromptKktp,
  susunPromptTp,
} from './generateAi.js'

initializeApp()

/**
 * Hapus akun staf SEPENUHNYA: user Firebase Authentication + dokumen users/{uid}.
 * Hanya administrator aktif. Wilayah HARUS sama dengan REGION_FUNGSI di src/lib/akunGuruData.ts.
 * Urutan: Auth dulu, profil kemudian. Bila langkah kedua gagal, panggil ulang: user Auth yang sudah
 * tidak ada dianggap berhasil.
 */
export const hapusAkunAuth = onCall({ region: 'asia-southeast2', maxInstances: 3 }, async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Masuk dulu sebagai administrator.')
  }
  const uidTarget = request.data?.uid
  if (typeof uidTarget !== 'string' || uidTarget.length === 0 || uidTarget.length > 128) {
    throw new HttpsError('invalid-argument', 'UID akun tidak valid.')
  }
  const uidPemanggil = request.auth.uid

  const db = getFirestore()
  const [pemanggilSnap, targetSnap, adminSnap] = await Promise.all([
    db.doc(`users/${uidPemanggil}`).get(),
    db.doc(`users/${uidTarget}`).get(),
    db.collection('users').where('role', '==', 'admin').get(),
  ])
  const jumlahAdminAktif = adminSnap.docs.filter((d) => d.data().aktif !== false).length

  const hasil = periksaPenghapusan({
    uidPemanggil,
    uidTarget,
    pemanggil: pemanggilSnap.exists ? pemanggilSnap.data() : null,
    target: targetSnap.exists ? targetSnap.data() : null,
    jumlahAdminAktif,
  })
  if (!hasil.ok) {
    throw new HttpsError(hasil.kode, hasil.pesan)
  }

  let authDihapus = true
  try {
    await getAuth().deleteUser(uidTarget)
  } catch (err) {
    if (err?.code === 'auth/user-not-found') {
      authDihapus = false
    } else {
      logger.error('hapusAkunAuth: gagal menghapus user Auth', { uidTarget, kode: err?.code })
      throw new HttpsError('internal', 'Gagal menghapus user di Firebase Authentication. Coba lagi.')
    }
  }
  await db.doc(`users/${uidTarget}`).delete()

  logger.info('hapusAkunAuth: akun dihapus', { oleh: uidPemanggil, uidTarget, authDihapus })
  return { authDihapus, authSudahTidakAda: !authDihapus }
})

const opsiAi = {
  region: 'asia-southeast2',
  maxInstances: 2,
  timeoutSeconds: 120,
  secrets: ['GEMINI_API_KEY', 'OPENAI_API_KEY'],
}

function kunciProvider(provider) {
  if (provider === 'openai') return process.env.OPENAI_API_KEY || ''
  if (provider === 'gemini') return process.env.GEMINI_API_KEY || ''
  return ''
}

function pastikanAi(request) {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Masuk dulu.')
  if (!bolehPemanggilAi(request.auth)) {
    logger.warn('generateAi ditolak: akun tidak berhak', { uid: request.auth.uid })
    throw new HttpsError('permission-denied', 'Fitur ini tidak tersedia untuk akun Anda.')
  }
  const provider = request.data?.provider
  if (provider !== 'gemini' && provider !== 'openai') {
    throw new HttpsError('invalid-argument', 'Pilih Gemini atau OpenAI.')
  }
  return provider
}

export const generateTpAi = onCall(opsiAi, async (request) => {
  const provider = pastikanAi(request)
  const prompt = susunPromptTp(request.data || {})
  if (!prompt.ok) throw new HttpsError('invalid-argument', prompt.pesan)
  try {
    const json = await mintaModel(provider, kunciProvider(provider), prompt.sistem, prompt.user)
    const tp = normalisasiTp(json)
    logger.info('generateTpAi', { uid: request.auth.uid, provider, jumlah: tp.length })
    return { tp }
  } catch (err) {
    logger.error('generateTpAi gagal', { pesan: err?.message })
    throw new HttpsError('internal', err?.message || 'Gagal menyusun TP.')
  }
})

export const generateKktpAi = onCall(opsiAi, async (request) => {
  const provider = pastikanAi(request)
  const prompt = susunPromptKktp(request.data || {})
  if (!prompt.ok) throw new HttpsError('invalid-argument', prompt.pesan)
  try {
    const json = await mintaModel(provider, kunciProvider(provider), prompt.sistem, prompt.user)
    const deskripsi = normalisasiKktp(json)
    logger.info('generateKktpAi', { uid: request.auth.uid, provider })
    return { deskripsi }
  } catch (err) {
    logger.error('generateKktpAi gagal', { pesan: err?.message })
    throw new HttpsError('internal', err?.message || 'Gagal menyusun KKTP.')
  }
})

/** Generate data inventaris aset Sarpras dari foto (vision). Hanya 2 akun pemilik. */
export const generateAsetAi = onCall(opsiAi, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Masuk dulu.')
  if (!bolehPemanggilAiAset(request.auth)) {
    logger.warn('generateAsetAi ditolak: akun tidak berhak', { uid: request.auth.uid })
    throw new HttpsError('permission-denied', 'Fitur ini tidak tersedia untuk akun Anda.')
  }
  const provider = request.data?.provider
  if (provider !== 'gemini' && provider !== 'openai') {
    throw new HttpsError('invalid-argument', 'Pilih Gemini atau OpenAI.')
  }
  const imageBase64 = request.data?.imageBase64
  const mimeType = request.data?.mimeType || 'image/jpeg'
  if (typeof imageBase64 !== 'string' || imageBase64.length < 100) {
    throw new HttpsError('invalid-argument', 'Foto wajib diunggah.')
  }
  const kategori = Array.isArray(request.data?.kategori) ? request.data.kategori : []
  const sumber = Array.isArray(request.data?.sumber) ? request.data.sumber : []
  const ruang = Array.isArray(request.data?.ruang) ? request.data.ruang : []
  const prompt = susunPromptAset({ kategori, sumber, ruang })
  try {
    const json = await mintaModelVision(
      provider,
      kunciProvider(provider),
      prompt.sistem,
      prompt.user,
      imageBase64,
      mimeType,
    )
    const aset = normalisasiAset(json, kategori, sumber)
    logger.info('generateAsetAi', { uid: request.auth.uid, provider, nama: aset.nama })
    return { aset }
  } catch (err) {
    logger.error('generateAsetAi gagal', { pesan: err?.message })
    throw new HttpsError('internal', err?.message || 'Gagal menganalisis foto aset.')
  }
})


/**
 * Generate usulan aktivitas & deskripsi capaian ekstrakurikuler (C/B/A).
 * Hanya administrator aktif (dicek di Firestore users/{uid}.role).
 * CORS otomatis ditangani onCall — function HARUS di-deploy agar preflight lolos.
 */
export const generateEkskulAi = onCall(opsiAi, async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Masuk dulu.')
  }
  const uid = request.auth.uid
  const db = getFirestore()
  const profil = await db.doc(`users/${uid}`).get()
  const data = profil.exists ? profil.data() : null
  if (!data || data.role !== 'admin' || data.aktif === false) {
    logger.warn('generateEkskulAi ditolak: bukan admin', { uid })
    throw new HttpsError('permission-denied', 'Fitur generate AI ekstrakurikuler hanya untuk administrator.')
  }
  const provider = request.data?.provider
  if (provider !== 'gemini' && provider !== 'openai') {
    throw new HttpsError('invalid-argument', 'Pilih Gemini atau OpenAI.')
  }
  const prompt = susunPromptEkskul(request.data || {})
  if (!prompt.ok) throw new HttpsError('invalid-argument', prompt.pesan)
  try {
    const json = await mintaModel(provider, kunciProvider(provider), prompt.sistem, prompt.user)
    const hasil = normalisasiEkskul(json, prompt.mode)
    logger.info('generateEkskulAi', {
      uid,
      provider,
      mode: prompt.mode,
      aktivitas: hasil.aktivitas.length,
      deskripsi: hasil.deskripsi.length,
    })
    return hasil
  } catch (err) {
    logger.error('generateEkskulAi gagal', { pesan: err?.message })
    throw new HttpsError('internal', err?.message || 'Gagal menyusun usulan ekstrakurikuler.')
  }
})
