// Logika murni disiplin Seni Budaya (Rupa / Musik / Tari / Teater). Tanpa Firebase/React agar bisa diuji:
//   node --experimental-strip-types scripts/cek-disiplin-seni.mjs
// Daftar nama HARUS sama dengan DISIPLIN_SENI di seniKelas.ts (dijaga oleh skrip uji di atas).

export const DISIPLIN_SENI_NAMA = ['Seni Rupa', 'Seni Musik', 'Seni Tari', 'Seni Teater'] as const
export type DisiplinSeniNama = (typeof DISIPLIN_SENI_NAMA)[number]

const ALIAS: Record<string, DisiplinSeniNama> = {
  'seni rupa': 'Seni Rupa',
  rupa: 'Seni Rupa',
  'seni visual': 'Seni Rupa',
  'seni musik': 'Seni Musik',
  musik: 'Seni Musik',
  music: 'Seni Musik',
  'seni tari': 'Seni Tari',
  tari: 'Seni Tari',
  dance: 'Seni Tari',
  'seni teater': 'Seni Teater',
  teater: 'Seni Teater',
  theater: 'Seni Teater',
  theatre: 'Seni Teater',
  drama: 'Seni Teater',
  'seni drama': 'Seni Teater',
}

export function adalahSeniBudaya(mapel: unknown): boolean {
  return /^seni\s+budaya$/i.test(String(mapel ?? '').trim())
}

/** Nilai isian (sel Excel / field JSON) → nama disiplin baku. '' bila kosong atau tidak dikenal. */
export function normalisasiDisiplinSeni(raw: unknown): DisiplinSeniNama | '' {
  const k = String(raw ?? '')
    .toLowerCase()
    .replace(/[_\-./]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return ALIAS[k] ?? ''
}

/**
 * Disiplin yang DISEBUT EKSPLISIT dalam teks bebas (mis. kolom element/code/source di file sumber).
 * Hanya mengembalikan hasil bila tepat satu disiplin yang disebut; menyebut dua atau lebih = tidak pasti.
 * Tidak menebak dari makna kalimat (itu tugas `sarankanDisiplinSeni`, yang selalu butuh konfirmasi guru).
 */
export function disiplinDariTeks(...teks: (string | undefined | null)[]): DisiplinSeniNama | '' {
  const ketemu = new Set<DisiplinSeniNama>()
  for (const t of teks) {
    const s = String(t ?? '').toLowerCase()
    for (const m of s.matchAll(/\b(?:seni\s+)?(rupa|musik|tari|teater)\b/g)) {
      const d = normalisasiDisiplinSeni(m[1])
      if (d) ketemu.add(d)
    }
  }
  return ketemu.size === 1 ? [...ketemu][0]! : ''
}

/* ---------- Saran berbasis kata kunci (usulan, bukan keputusan) ---------- */

/** [pola, bobot]. Bobot 3 = kata khas disiplin, 2 = kuat, 1 = lemah/bermakna ganda. Pola memakai batas kata. */
const POLA: Record<DisiplinSeniNama, [RegExp, number][]> = {
  'Seni Rupa': [
    [/\bseni rupa\b/, 5],
    [/\b(?:menggambar|digambar|bergambar|gambar)\b/, 3],
    [/\b(?:melukis|dilukis|lukisan|lukis)\b/, 3],
    [/\b(?:mewarnai|diwarnai|berwarna|warna)\b/, 2],
    [/\bkolase\b/, 3],
    [/\bmenggunting\b/, 1],
    [/\b(?:patung|mematung|memahat|pahatan|pahat)\b/, 3],
    [/\b(?:kriya|kerajinan)\b/, 3],
    [/\bsketsa\b/, 3],
    [/\b(?:mencetak|cetak)\b/, 2],
    [/\bbatik\b/, 3],
    [/\b(?:tekstur|motif|desain|mendesain)\b/, 2],
    [/\bgaris\b/, 1],
    [/\b(?:dua|tiga) dimensi\b|\bdwimatra\b|\btrimatra\b|\bvisual\b/, 2],
  ],
  'Seni Musik': [
    [/\bseni musik\b/, 5],
    [/\bmusik\w*/, 3],
    [/\blagu\b/, 3],
    [/\b(?:menyanyikan|menyanyi|bernyanyi|nyanyian|nyanyi)\b/, 3],
    [/\bnada\b/, 3],
    [/\b(?:irama|ritme|melodi|tempo|harmoni|notasi)\b/, 3],
    [/\b(?:instrumen|vokal|ansambel|paduan suara)\b/, 3],
    [/\balat musik\b/, 3],
    [/\btepuk\b/, 1],
  ],
  'Seni Tari': [
    [/\bseni tari\b/, 5],
    [/\b(?:tari|tarian|menari|penari|bertari)\b/, 3],
    [/\b(?:koreografi|koreografer)\b/, 3],
    [/\bragam gerak\b/, 3],
    [/\bgerak(?:an)?\b/, 1],
  ],
  'Seni Teater': [
    [/\bseni teater\b/, 5],
    [/\bteater\b/, 3],
    [/\bdrama\b/, 3],
    [/\b(?:akting|monolog|lakon)\b/, 3],
    [/\bnaskah\b/, 2],
    [/\b(?:pentas|pementasan|mementaskan|panggung)\b/, 2],
    [/\b(?:bermain peran|memerankan|berperan)\b/, 3],
    [/\bdialog\b/, 2],
    [/\bperan\b/, 1],
  ],
}

export interface SaranDisiplin {
  disiplin: DisiplinSeniNama | ''
  /** Skor per disiplin (untuk transparansi/uji). */
  skor: Record<DisiplinSeniNama, number>
  /** Kata yang membuat saran ini muncul, mis. ['lagu', 'nada']. */
  alasan: string[]
}

/**
 * Usulan disiplin dari rumusan TP (bobot penuh) dan teks CP (setengah bobot).
 * Memilih hanya bila ada pemenang yang jelas: skor ≥ 2 dan lebih dari 1,5 kali skor disiplin kedua.
 * Selain itu '' (guru memilih sendiri). Ini USULAN: UI wajib menampilkannya untuk diperiksa.
 */
export function sarankanDisiplinSeni(namaTp: string, cp?: string): SaranDisiplin {
  const nama = String(namaTp ?? '').toLowerCase()
  const cpTeks = String(cp ?? '').toLowerCase()
  const skor = {} as Record<DisiplinSeniNama, number>
  const kata: Record<DisiplinSeniNama, Set<string>> = {
    'Seni Rupa': new Set(),
    'Seni Musik': new Set(),
    'Seni Tari': new Set(),
    'Seni Teater': new Set(),
  }
  for (const d of DISIPLIN_SENI_NAMA) {
    let total = 0
    for (const [pola, bobot] of POLA[d]) {
      const g = new RegExp(pola.source, 'g')
      for (const [teks, faktor] of [
        [nama, 1],
        [cpTeks, 0.5],
      ] as const) {
        for (const m of teks.matchAll(g)) {
          total += bobot * faktor
          kata[d].add(m[0].trim())
        }
      }
    }
    skor[d] = total
  }
  const urut = [...DISIPLIN_SENI_NAMA].sort((a, b) => skor[b] - skor[a])
  const [pertama, kedua] = urut as [DisiplinSeniNama, DisiplinSeniNama]
  const menang = skor[pertama] >= 2 && skor[pertama] > skor[kedua] * 1.5
  return {
    disiplin: menang ? pertama : '',
    skor,
    alasan: menang ? [...kata[pertama]].slice(0, 4) : [],
  }
}

/** Jumlah TP Seni Budaya yang belum punya disiplin yang sah. */
export function jumlahTanpaDisiplin(list: { disiplinSeni?: string }[] | null | undefined): number {
  return (list ?? []).filter((t) => !normalisasiDisiplinSeni(t.disiplinSeni)).length
}
