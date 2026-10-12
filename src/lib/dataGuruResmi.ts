/** Daftar nama guru resmi (dari penugasan 2026-2027).
 * Guru mendaftar dengan memilih nama dari daftar ini agar konsisten.
 */
export const GURU_RESMI: readonly string[] = [
  'Abdurrahman',
  'Anastasia Yulianasari',
  'Aprilia Nur Hidayati',
  'Arif Azwar Anas',
  'Asuroh Susanti',
  'Azizah Zahro Ibrahim',
  'Darmiati',
  'Elya',
  'Evi Sumyati',
  'Febrian Raka Ramadan',
  'Idatul Fitri',
  'Luzyas Indra Permana',
  'Marnie Septia .K',
  'Muhammad Rizki',
  'Nisya El Salsabila',
  'Rahmah Yuningsih',
  'Ratih Yuniati',
  "Silvia Sa'diah",
  'Suci Lestari',
  'Supitriatna Hindrawan',
  'Syam Apri Wilisseri',
  'Tisandi',
  'Ummu Muwahidah',
  'Yulia',
] as const

export function adalahNamaResmi(nama: string): boolean {
  return GURU_RESMI.includes(nama.trim())
}
