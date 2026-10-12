import type { Mapel } from '../types/akademik'

const SEMUA = ['1', '2', '3', '4', '5', '6']

/**
 * Nama resmi mapel akademik, sama dengan seed penilaian-v2
 * (IPAS dan PJOK, bukan nama panjang). Tahsin dan Tahfizh tidak ada di sini —
 * keduanya milik modul Tahsin-Tahfizh, bukan TP/KKTP.
 */
export const MAPEL_BAWAAN: Mapel[] = [
  { id: 'Al-Islam', nama: 'Al-Islam', urutan: 1, tingkatanBerlaku: SEMUA },
  { id: 'Pendidikan Pancasila', nama: 'Pendidikan Pancasila', urutan: 2, tingkatanBerlaku: SEMUA },
  { id: 'Bahasa Indonesia', nama: 'Bahasa Indonesia', urutan: 3, tingkatanBerlaku: SEMUA },
  { id: 'Matematika', nama: 'Matematika', urutan: 4, tingkatanBerlaku: SEMUA },
  { id: 'IPAS', nama: 'IPAS', urutan: 5, tingkatanBerlaku: ['3', '4', '5', '6'] },
  { id: 'Seni Budaya', nama: 'Seni Budaya', urutan: 6, tingkatanBerlaku: SEMUA },
  { id: 'PJOK', nama: 'PJOK', urutan: 7, tingkatanBerlaku: SEMUA },
  { id: 'Bahasa Inggris', nama: 'Bahasa Inggris', urutan: 8, tingkatanBerlaku: SEMUA },
  { id: 'Informatika', nama: 'Informatika', urutan: 9, tingkatanBerlaku: ['4', '5', '6'] },
  { id: 'Bahasa Sunda', nama: 'Bahasa Sunda', urutan: 10, tingkatanBerlaku: SEMUA },
  { id: 'Bahasa Arab', nama: 'Bahasa Arab', urutan: 11, tingkatanBerlaku: ['3', '4', '5', '6'] },
  { id: 'Kemuhammadiyahan', nama: 'Kemuhammadiyahan', urutan: 12, tingkatanBerlaku: ['3', '4', '5', '6'] },
]
