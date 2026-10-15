import {
  addDoc,
  collection,
  doc,
  getCountFromServer,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
  type DocumentData,
} from 'firebase/firestore'
import { db } from './firebase'
import { susunDokumen, validasiLaporan, type MasukanLaporan } from './notifikasiRumus'
import type { Notifikasi, StatusNotifikasi } from '../types/notifikasi'

// Lapisan Firestore untuk koleksi `notifikasi` (ANTIREGRESI §19).
// Guru/admin membuat; hanya admin mengubah status dan catatan; tidak ada hapus.

const KOLEKSI = 'notifikasi'
const BATAS_INBOX = 200
const BATAS_SAYA = 50

function dariDok(id: string, d: DocumentData): Notifikasi {
  return {
    id,
    jenis: d.jenis,
    judul: d.judul ?? '',
    isi: d.isi ?? '',
    kelas: d.kelas,
    mutasi: d.mutasi,
    status: d.status ?? 'baru',
    catatanAdmin: d.catatanAdmin,
    dariUid: d.dariUid,
    dariNama: d.dariNama ?? '',
    createdAt: d.createdAt?.toDate?.() ?? null,
    updatedAt: d.updatedAt?.toDate?.() ?? null,
  }
}

export async function kirimLaporan(masukan: MasukanLaporan, dari: { uid: string; nama: string }): Promise<void> {
  const salah = validasiLaporan(masukan)
  if (salah.length) throw new Error(salah[0])
  await addDoc(collection(db, KOLEKSI), { ...susunDokumen(masukan, dari), createdAt: serverTimestamp() })
}

/** Kotak masuk admin: terbaru dulu, dibatasi. Penyaringan jenis/status dilakukan di klien. */
export async function muatInboxAdmin(): Promise<Notifikasi[]> {
  const s = await getDocs(query(collection(db, KOLEKSI), orderBy('createdAt', 'desc'), limit(BATAS_INBOX)))
  return s.docs.map((d) => dariDok(d.id, d.data()))
}

/** Laporan milik guru yang sedang login (butuh indeks dariUid + createdAt). */
export async function muatLaporanSaya(uid: string): Promise<Notifikasi[]> {
  const s = await getDocs(
    query(collection(db, KOLEKSI), where('dariUid', '==', uid), orderBy('createdAt', 'desc'), limit(BATAS_SAYA)),
  )
  return s.docs.map((d) => dariDok(d.id, d.data()))
}

export async function ubahStatus(id: string, status: StatusNotifikasi, catatanAdmin?: string): Promise<void> {
  const data: Record<string, unknown> = { status, updatedAt: serverTimestamp() }
  if (catatanAdmin !== undefined) data.catatanAdmin = catatanAdmin.trim()
  await updateDoc(doc(db, KOLEKSI, id), data)
}

/** Jumlah laporan berstatus baru, untuk lonceng admin. Hanya admin yang boleh memanggil. */
export async function hitungBaru(): Promise<number> {
  const s = await getCountFromServer(query(collection(db, KOLEKSI), where('status', '==', 'baru')))
  return s.data().count
}
