/**
 * Lapisan data ekstrakurikuler: master (pengampu, aktivitas, template deskripsi),
 * pengajuan pengampu, dan helper akses.
 * Penulisan nilai siswa tetap di raporData.ts (simpanEkskulSiswa).
 */
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  where,
  arrayUnion,
  arrayRemove,
  deleteDoc,
} from 'firebase/firestore'
import { db } from './firebase'
import { slugEkskul } from './raporDataRumus'
import type {
  DeskripsiCapaianTemplate,
  EkskulAjukan,
  Ekstrakurikuler,
  PredikatEkskul,
} from '../types/raporData'
import { BATAS_AKTIVITAS, BATAS_EKSKUL_DESKRIPSI, PREDIKAT_EKSKUL } from '../types/raporData'

function normalisasiTemplate(raw: unknown): DeskripsiCapaianTemplate[] {
  if (!Array.isArray(raw)) return []
  const out: DeskripsiCapaianTemplate[] = []
  for (const x of raw) {
    if (!x || typeof x !== 'object') continue
    const predikat = String((x as DeskripsiCapaianTemplate).predikat || '').toUpperCase() as PredikatEkskul
    if (!PREDIKAT_EKSKUL.includes(predikat)) continue
    const teks = String((x as DeskripsiCapaianTemplate).teks ?? '')
      .trim()
      .slice(0, BATAS_EKSKUL_DESKRIPSI)
    if (!teks) continue
    out.push({ predikat, teks })
  }
  return out
}

function normalisasiAktivitas(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  return raw
    .map((s) => String(s ?? '').trim().slice(0, BATAS_AKTIVITAS))
    .filter(Boolean)
    .slice(0, 40)
}

function dariDoc(id: string, data: Record<string, unknown>): Ekstrakurikuler {
  return {
    id,
    nama: String(data.nama ?? id),
    aktif: data.aktif !== false,
    pengampuUids: Array.isArray(data.pengampuUids)
      ? data.pengampuUids.map((u) => String(u)).filter(Boolean)
      : [],
    aktivitas: normalisasiAktivitas(data.aktivitas),
    deskripsiCapaian: normalisasiTemplate(data.deskripsiCapaian),
  }
}

export async function getEkskulMasterLengkap(): Promise<Ekstrakurikuler[]> {
  const s = await getDocs(collection(db, 'ekstrakurikuler'))
  return s.docs
    .map((d) => dariDoc(d.id, d.data() as Record<string, unknown>))
    .sort((a, b) => a.nama.localeCompare(b.nama, 'id'))
}

export async function getEkskulById(id: string): Promise<Ekstrakurikuler | null> {
  const d = await getDoc(doc(db, 'ekstrakurikuler', id))
  if (!d.exists()) return null
  return dariDoc(d.id, d.data() as Record<string, unknown>)
}

/** Buat/perbarui master (nama + aktif). Field lanjutan diubah lewat fungsi khusus. */
export async function simpanEkskulMaster(nama: string, aktif = true): Promise<string> {
  const bersih = nama.trim().slice(0, 80)
  const id = slugEkskul(bersih)
  if (!id) throw new Error('Nama kegiatan tidak valid.')
  await setDoc(
    doc(db, 'ekstrakurikuler', id),
    { nama: bersih, aktif, updatedAt: serverTimestamp() },
    { merge: true },
  )
  return id
}

export async function setPengampuEkskul(ekskulId: string, uids: string[]): Promise<void> {
  const unik = [...new Set(uids.map((u) => u.trim()).filter(Boolean))]
  await setDoc(
    doc(db, 'ekstrakurikuler', ekskulId),
    { pengampuUids: unik, updatedAt: serverTimestamp() },
    { merge: true },
  )
}

export async function tambahPengampu(ekskulId: string, uid: string): Promise<void> {
  await setDoc(
    doc(db, 'ekstrakurikuler', ekskulId),
    { pengampuUids: arrayUnion(uid), updatedAt: serverTimestamp() },
    { merge: true },
  )
}

export async function hapusPengampu(ekskulId: string, uid: string): Promise<void> {
  await setDoc(
    doc(db, 'ekstrakurikuler', ekskulId),
    { pengampuUids: arrayRemove(uid), updatedAt: serverTimestamp() },
    { merge: true },
  )
}

export async function simpanAktivitasEkskul(ekskulId: string, aktivitas: string[]): Promise<void> {
  await setDoc(
    doc(db, 'ekstrakurikuler', ekskulId),
    { aktivitas: normalisasiAktivitas(aktivitas), updatedAt: serverTimestamp() },
    { merge: true },
  )
}

export async function simpanDeskripsiCapaian(
  ekskulId: string,
  templates: DeskripsiCapaianTemplate[],
): Promise<void> {
  await setDoc(
    doc(db, 'ekstrakurikuler', ekskulId),
    { deskripsiCapaian: normalisasiTemplate(templates), updatedAt: serverTimestamp() },
    { merge: true },
  )
}

/** Ekskul yang user ini ampu (pengampu disetujui). */
export function ekskulSayaAmpu(daftar: Ekstrakurikuler[], uid: string): Ekstrakurikuler[] {
  return daftar.filter((e) => e.aktif && (e.pengampuUids ?? []).includes(uid))
}

// ── Pengajuan pengampu ──────────────────────────────────────────────────────

function idAjukan(ekskulId: string, uid: string) {
  return `${ekskulId}__${uid}`
}

export async function ajukanPengampu(input: {
  ekskulId: string
  ekskulNama: string
  uid: string
  namaGuru: string
}): Promise<void> {
  const id = idAjukan(input.ekskulId, input.uid)
  const existing = await getDoc(doc(db, 'ekstrakurikuler_ajukan', id))
  if (existing.exists() && existing.data()?.status === 'pending') {
    throw new Error('Pengajuan sudah menunggu persetujuan admin.')
  }
  if (existing.exists() && existing.data()?.status === 'disetujui') {
    throw new Error('Anda sudah terdaftar sebagai pengampu kegiatan ini.')
  }
  await setDoc(doc(db, 'ekstrakurikuler_ajukan', id), {
    ekskulId: input.ekskulId,
    ekskulNama: input.ekskulNama,
    uid: input.uid,
    namaGuru: input.namaGuru,
    status: 'pending',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
}

export async function getPengajuanPending(): Promise<EkskulAjukan[]> {
  const s = await getDocs(
    query(collection(db, 'ekstrakurikuler_ajukan'), where('status', '==', 'pending')),
  )
  return s.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<EkskulAjukan, 'id'>) }))
}

export async function getPengajuanSaya(uid: string): Promise<EkskulAjukan[]> {
  const s = await getDocs(
    query(collection(db, 'ekstrakurikuler_ajukan'), where('uid', '==', uid)),
  )
  return s.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<EkskulAjukan, 'id'>) }))
}

/** Admin menyetujui: update status + tambah ke pengampuUids. */
export async function setujuiPengajuan(ajukan: EkskulAjukan): Promise<void> {
  await setDoc(
    doc(db, 'ekstrakurikuler_ajukan', ajukan.id),
    { status: 'disetujui', updatedAt: serverTimestamp() },
    { merge: true },
  )
  await tambahPengampu(ajukan.ekskulId, ajukan.uid)
}

export async function tolakPengajuan(id: string, catatan?: string): Promise<void> {
  await setDoc(
    doc(db, 'ekstrakurikuler_ajukan', id),
    {
      status: 'ditolak',
      catatan: (catatan ?? '').trim().slice(0, 200),
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  )
}

export async function hapusPengajuan(id: string): Promise<void> {
  await deleteDoc(doc(db, 'ekstrakurikuler_ajukan', id))
}
