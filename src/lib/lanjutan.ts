import type { SetoranRecord } from '../types/tahsin'
import { surahByNo } from './quranSurah'

export interface RentangAyat {
  surah: number
  mulai: number
  akhir: number
}

/**
 * Usulan rentang untuk setoran berikutnya dari setoran terakhir siswa (hanya materi Al-Qur'an satu surah):
 * - terakhir "Perlu diulang" → ulangi rentang yang sama;
 * - selain itu → mulai dari ayat sesudah ayat akhir, dengan panjang rentang yang sama (1–15 ayat);
 * - surah sudah selesai → null (guru memilih surah berikutnya sendiri; urutan hafalan berbeda per siswa).
 */
export function rentangLanjutan(terakhir: SetoranRecord | null | undefined): RentangAyat | null {
  const m = terakhir?.materi
  if (!terakhir || m?.tipe !== 'quran' || m.surahAwal !== m.surahAkhir) return null
  const total = surahByNo(m.surahAwal)?.ayat
  if (!total) return null
  if (terakhir.statusHafalan === 'ulang') {
    return { surah: m.surahAwal, mulai: m.ayatMulai, akhir: Math.min(m.ayatAkhir, total) }
  }
  if (m.ayatAkhir >= total) return null
  const panjang = Math.min(15, Math.max(1, m.ayatAkhir - m.ayatMulai + 1))
  const mulai = m.ayatAkhir + 1
  return { surah: m.surahAwal, mulai, akhir: Math.min(total, mulai + panjang - 1) }
}
