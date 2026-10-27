import {
  addDoc,
  collection,
  deleteField,
  doc,
  deleteDoc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore'
import { auth, db } from './firebase'
import { faseDariTingkatan, LEVEL_RANGE_DEFAULT, tingkatanDariKelas } from './akademikRumus'
import { aliasNamaMapel } from './tpImport'
import { adalahSeniBudaya, normalisasiDisiplinSeni } from './disiplinSeniRumus'
import { MAPEL_BAWAAN } from './mapelBawaan'
import type {
  AsesmenCakupan,
  ConfigAkademik,
  JenisAsesmen,
  LevelKktp,
  Mapel,
  NilaiAsesmenDoc,
  NilaiTpDoc,
  Semester,
  TipeTp,
  TujuanPembelajaran,
} from '../types/akademik'

// PLACEHOLDER_WILL_REPLACE - this is incomplete test
export * from './akademikRumus'
