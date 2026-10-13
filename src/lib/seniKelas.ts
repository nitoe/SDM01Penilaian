import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore'
import { auth, db } from './firebase'

/** Disiplin seni yang boleh dipilih wali kelas (boleh lebih dari satu per semester). */
export const DISIPLIN_SENI = ['Seni Rupa', 'Seni Musik', 'Seni Tari', 'Seni Teater'] as const
export type DisiplinSeni = (typeof DISIPLIN_SENI)[number]

export interface SeniKelasDoc {
  /** Disiplin semester ganjil (1). */
  ganjil: string[]
  /** Disiplin semester genap (2). */
  genap: string[]
}

const KOSONG: SeniKelasDoc = { ganjil: [], genap: [] }

function normalisasi(list: unknown): string[] {
  if (!Array.isArray(list)) return []
  const set = new Set(
    list
      .map((x) => String(x || '').trim())
      .filter((x) => (DISIPLIN_SENI as readonly string[]).includes(x)),
  )
  return DISIPLIN_SENI.filter((d) => set.has(d))
}

/** Baca pilihan seni budaya satu kelas. Dokumen tidak ada → array kosong. */
export async function getSeniKelas(kelas: string): Promise<SeniKelasDoc> {
  const id = String(kelas || '').toUpperCase()
  if (!id) return { ...KOSONG }
  try {
    const snap = await getDoc(doc(db, 'seni_kelas', id))
    if (!snap.exists()) return { ...KOSONG }
    const d = snap.data()
    return {
      ganjil: normalisasi(d.ganjil),
      genap: normalisasi(d.genap),
    }
  } catch {
    return { ...KOSONG }
  }
}

/** Simpan pilihan seni budaya kelas. Hanya wali kelas yang boleh (dijaga rules). */
export async function simpanSeniKelas(kelas: string, data: SeniKelasDoc): Promise<void> {
  const id = String(kelas || '').toUpperCase()
  if (!id) throw new Error('Kelas kosong')
  await setDoc(
    doc(db, 'seni_kelas', id),
    {
      ganjil: normalisasi(data.ganjil),
      genap: normalisasi(data.genap),
      updatedAt: serverTimestamp(),
      updatedBy: auth.currentUser?.uid ?? null,
    },
    { merge: true },
  )
}

/** Label tampil di rapor: "Seni Budaya" atau "Seni Budaya (Seni Rupa, Seni Musik)". */
export function labelSeniBudaya(disiplin: string[]): string {
  const bersih = normalisasi(disiplin)
  if (!bersih.length) return 'Seni Budaya'
  return `Seni Budaya (${bersih.join(', ')})`
}
