import type { Mapel } from '../types/akademik'

const SEMUA = ['1', '2', '3', '4', '5', '6']

/** Daftar mata pelajaran sekolah (penugasan 2026-2027). Dipakai bila koleksi `mapel` masih kosong. */
export const MAPEL_BAWAAN: Mapel[] = [
  { id: 'Pendidikan Pancasila', nama: 'Pendidikan Pancasila', urutan: 1, tingkatanBerlaku: SEMUA },
  { id: 'Bahasa Indonesia', nama: 'Bahasa Indonesia', urutan: 2, tingkatanBerlaku: SEMUA },
  { id: 'Matematika', nama: 'Matematika', urutan: 3, tingkatanBerlaku: SEMUA },
  { id: 'Ilmu Pengetahuan Alam dan Sosial', nama: 'Ilmu Pengetahuan Alam dan Sosial', urutan: 4, tingkatanBerlaku: ['3', '4', '5', '6'] },
  { id: 'Seni Budaya', nama: 'Seni Budaya', urutan: 5, tingkatanBerlaku: SEMUA },
  { id: 'Pendidikan Jasmani, Olahraga, dan Kesehatan', nama: 'Pendidikan Jasmani, Olahraga, dan Kesehatan', urutan: 6, tingkatanBerlaku: SEMUA },
  { id: 'Bahasa Inggris', nama: 'Bahasa Inggris', urutan: 7, tingkatanBerlaku: SEMUA },
  { id: 'Bahasa Sunda', nama: 'Bahasa Sunda', urutan: 8, tingkatanBerlaku: SEMUA },
  { id: 'Informatika', nama: 'Informatika', urutan: 9, tingkatanBerlaku: ['4', '5', '6'] },
  { id: 'Al-Islam', nama: 'Al-Islam', urutan: 10, tingkatanBerlaku: SEMUA },
  { id: 'Bahasa Arab', nama: 'Bahasa Arab', urutan: 11, tingkatanBerlaku: ['3', '4', '5', '6'] },
  { id: 'Kemuhammadiyahan', nama: 'Kemuhammadiyahan', urutan: 12, tingkatanBerlaku: ['3', '4', '5', '6'] },
  { id: 'Tahsin', nama: 'Tahsin', urutan: 13, tingkatanBerlaku: SEMUA },
  { id: 'Tahfizh', nama: 'Tahfizh', urutan: 14, tingkatanBerlaku: ['3', '4', '5', '6'] },
]
