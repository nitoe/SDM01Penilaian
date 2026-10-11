import { QARI_BAWAAN } from './quranText'

/** Preferensi tampilan Baca & Tandai, disimpan per browser (localStorage) agar tidak diatur ulang tiap hari. */
export interface PreferensiBaca {
  qari: string
  latin: boolean
  terjemah: boolean
  /** 1 = sedang, 2 = besar, 3 = sangat besar */
  ukuran: 1 | 2 | 3
}

export const PREFERENSI_BAWAAN: PreferensiBaca = {
  qari: QARI_BAWAAN,
  latin: false,
  terjemah: true,
  ukuran: 2,
}

const KUNCI = 'tt_pref_baca_v1'

type Gudang = Pick<Storage, 'getItem' | 'setItem'>

export function muatPreferensi(gudang?: Gudang): PreferensiBaca {
  try {
    const g = gudang ?? localStorage
    const mentah = JSON.parse(g.getItem(KUNCI) ?? 'null') as Partial<PreferensiBaca> | null
    if (!mentah || typeof mentah !== 'object') return PREFERENSI_BAWAAN
    const ukuran = mentah.ukuran === 1 || mentah.ukuran === 2 || mentah.ukuran === 3 ? mentah.ukuran : PREFERENSI_BAWAAN.ukuran
    return {
      qari: typeof mentah.qari === 'string' && /^\d{2}$/.test(mentah.qari) ? mentah.qari : PREFERENSI_BAWAAN.qari,
      latin: typeof mentah.latin === 'boolean' ? mentah.latin : PREFERENSI_BAWAAN.latin,
      terjemah: typeof mentah.terjemah === 'boolean' ? mentah.terjemah : PREFERENSI_BAWAAN.terjemah,
      ukuran,
    }
  } catch {
    return PREFERENSI_BAWAAN
  }
}

export function simpanPreferensi(p: PreferensiBaca, gudang?: Gudang): void {
  try {
    ;(gudang ?? localStorage).setItem(KUNCI, JSON.stringify(p))
  } catch {
    /* penyimpanan tidak tersedia → abaikan */
  }
}
