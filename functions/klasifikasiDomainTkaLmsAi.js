/**
 * Klasifikasi domainTka setiap soal kuis TKA (pengetahuan | keterampilan_proses).
 * Tidak ada opsi campuran — pilih yang lebih dominan.
 *
 * Deploy: firebase deploy --only functions:klasifikasiDomainTkaLmsAi
 */
import { onCall, HttpsError } from 'firebase-functions/v2/https'
import { getFirestore } from 'firebase-admin/firestore'
import { logger } from 'firebase-functions'
import { bolehPemanggilAi, mintaModel } from './generateAi.js'

const MAPEL_TKA = ['TKA Matematika', 'TKA Bahasa Indonesia', 'TKA IPA']

function teksPolos(html) {
  return String(html ?? '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function potong(s, n) {
  const t = String(s ?? '').trim()
  return t.length > n ? t.slice(0, n) : t
}

function normalisasiDomain(v) {
  if (v === 'pengetahuan' || v === 'keterampilan_proses') return v
  return null
}

export const klasifikasiDomainTkaLmsAi = onCall(
  {
    region: 'asia-southeast2',
    maxInstances: 5,
    timeoutSeconds: 120,
    secrets: ['GEMINI_API_KEY'],
  },
  async (request) => {
    if (!bolehPemanggilAi(request.auth)) {
      throw new HttpsError(
        'permission-denied',
        'Klasifikasi domain AI hanya untuk akun yang diizinkan.',
      )
    }

    const kuisId = request.data?.kuisId
    const overwrite = request.data?.overwrite === true
    if (typeof kuisId !== 'string' || !kuisId || kuisId.length > 80) {
      throw new HttpsError('invalid-argument', 'kuisId wajib.')
    }

    const db = getFirestore()
    const kuisSnap = await db.doc(`lms_kuis/${kuisId}`).get()
    if (!kuisSnap.exists) throw new HttpsError('not-found', 'Kuis tidak ditemukan.')
    const kuis = kuisSnap.data()
    const mapel = String(kuis.mapel || '').trim()
    if (!MAPEL_TKA.includes(mapel) && !mapel.startsWith('TKA ')) {
      throw new HttpsError('failed-precondition', 'Klasifikasi domain hanya untuk kuis TKA.')
    }

    const soalList = Array.isArray(kuis.soal) ? kuis.soal : []
    if (soalList.length === 0) {
      return { ok: true, hasil: [], dilewati: 0, diklasifikasi: 0 }
    }

    const kandidat = []
    let dilewati = 0
    for (let i = 0; i < soalList.length; i++) {
      const s = soalList[i]
      const existing = normalisasiDomain(s.domainTka)
      if (existing && !overwrite) {
        dilewati += 1
        continue
      }
      const teks = potong(teksPolos(s.teks || s.pertanyaan || ''), 400)
      const stimulus = potong(teksPolos(s.stimulus || ''), 300)
      kandidat.push({
        no: i + 1,
        soalId: s.id,
        tipe: s.tipe || '',
        materi: s.tipeMateri || s.materi || '',
        kompleksitas: s.kompleksitas || '',
        teks,
        stimulus,
      })
    }

    if (kandidat.length === 0) {
      return { ok: true, hasil: [], dilewati, diklasifikasi: 0 }
    }

    const apiKey = process.env.GEMINI_API_KEY || ''
    if (!apiKey) throw new HttpsError('failed-precondition', 'GEMINI_API_KEY belum diatur.')

    const sistem = `Anda ahli asesmen IPA / sains sekolah dasar (TKA kelas 6 Indonesia).
Tugas: klasifikasikan SETIAP soal ke TEPAT SATU domain:
- "pengetahuan" = Pengetahuan IPA: menuntut penguasaan fakta, konsep, istilah, hukum, atau hubungan ilmiah yang sudah diajarkan.
- "keterampilan_proses" = Keterampilan Proses Sains: menuntut proses sains (mengamati, mengklasifikasi, menafsir data/grafik/tabel, menyimpulkan, merancang percobaan sederhana, memprediksi).

Aturan ketat:
1. TIDAK ADA campuran — pilih yang LEBIH DOMINAN.
2. Soal hitung murni / definisi / mengingat istilah → pengetahuan.
3. Soal baca grafik, tabel, percobaan, penalaran data, langkah ilmiah → keterampilan_proses.
4. Untuk mapel TKA Matematika/Bahasa: terapkan analogi yang sama (fakta/konsep vs proses penalaran/keterampilan).
5. Jawab HANYA JSON valid, tanpa markdown.`

    const user = `Mapel kuis: ${mapel}
Jumlah soal yang diklasifikasi: ${kandidat.length}

Daftar soal (JSON):
${JSON.stringify(kandidat, null, 0)}

Kembalikan JSON berbentuk:
{
  "hasil": [
    { "soalId": "...", "domainTka": "pengetahuan"|"keterampilan_proses", "alasan": "satu kalimat singkat" }
  ]
}
Wajib ada entri untuk SETIAP soalId di input.`

    let json
    try {
      json = await mintaModel('gemini', apiKey, sistem, user)
    } catch (err) {
      logger.error('klasifikasiDomainTkaLmsAi gemini', { message: err?.message })
      throw new HttpsError('internal', err?.message || 'Gagal memanggil model AI.')
    }

    const raw = Array.isArray(json?.hasil) ? json.hasil : Array.isArray(json) ? json : []
    const byId = new Map(kandidat.map((k) => [k.soalId, k]))
    const hasil = []
    for (const row of raw) {
      const soalId = String(row?.soalId || '')
      if (!byId.has(soalId)) continue
      const domainTka = normalisasiDomain(row?.domainTka)
      if (!domainTka) continue
      hasil.push({
        soalId,
        domainTka,
        alasan: potong(String(row?.alasan || ''), 200),
      })
    }

    // Fallback: soal yang AI lewatkan → pengetahuan (aman) + flag
    for (const k of kandidat) {
      if (!hasil.some((h) => h.soalId === k.soalId)) {
        hasil.push({
          soalId: k.soalId,
          domainTka: 'pengetahuan',
          alasan: 'Fallback: model tidak mengembalikan label; default pengetahuan.',
        })
      }
    }

    logger.info('klasifikasiDomainTkaLmsAi', {
      uid: request.auth.uid,
      kuisId,
      diklasifikasi: hasil.length,
      dilewati,
      mapel,
    })

    return {
      ok: true,
      hasil,
      dilewati,
      diklasifikasi: hasil.length,
    }
  },
)
