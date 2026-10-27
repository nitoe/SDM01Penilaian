/**
 * Upload & kelola gambar tanda tangan digital untuk rapor STS (online).
 * Path Storage:
 *   - Kepala sekolah: tanda-tangan/kepsek.png
 *   - Guru/wali:      tanda-tangan/guru/{uid}.png
 * Disimpan sebagai download URL di config/akademik.ttdKepsekUrl dan users/{uid}.ttdUrl.
 */
import { deleteObject, getDownloadURL, ref, uploadBytes } from 'firebase/storage'
import { doc, updateDoc } from 'firebase/firestore'
import { auth, db, storage } from './firebase'

const MAX_PX = 480
const JPEG_Q = 0.88
const MAX_BYTES = 280_000

/** Kompres gambar ke PNG/JPEG berukuran wajar untuk ruang TTD rapor (~50pt tinggi). */
export async function kompresTandaTangan(file: File): Promise<Blob> {
  if (!file.type.startsWith('image/')) {
    throw new Error('File harus berupa gambar (PNG, JPG, atau WebP).')
  }
  if (file.size > 4_000_000) {
    throw new Error('Ukuran file maksimal 4 MB.')
  }

  const bitmap = await createImageBitmap(file)
  try {
    const scale = Math.min(1, MAX_PX / Math.max(bitmap.width, bitmap.height))
    const w = Math.max(1, Math.round(bitmap.width * scale))
    const h = Math.max(1, Math.round(bitmap.height * scale))
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Canvas tidak tersedia di peramban ini.')
    ctx.clearRect(0, 0, w, h)
    ctx.drawImage(bitmap, 0, 0, w, h)

    // Utamakan PNG (transparansi); fallback JPEG jika masih terlalu besar
    const png = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/png'))
    if (png && png.size <= MAX_BYTES) return png

    const jpg = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/jpeg', JPEG_Q))
    if (jpg) return jpg
    if (png) return png
    throw new Error('Gagal mengompres gambar.')
  } finally {
    bitmap.close()
  }
}

function pathKepsek(): string {
  return 'tanda-tangan/kepsek.png'
}

function pathGuru(uid: string): string {
  return `tanda-tangan/guru/${uid}.png`
}

/** Upload TTD kepala sekolah → simpan URL di config/akademik.ttdKepsekUrl. Hanya admin. */
export async function unggahTtdKepsek(file: File): Promise<string> {
  const blob = await kompresTandaTangan(file)
  const storageRef = ref(storage, pathKepsek())
  await uploadBytes(storageRef, blob, {
    contentType: blob.type || 'image/png',
    cacheControl: 'public,max-age=86400',
  })
  const url = await getDownloadURL(storageRef)
  await updateDoc(doc(db, 'config', 'akademik'), {
    ttdKepsekUrl: url,
    updatedAt: new Date().toISOString(),
  })
  return url
}

/** Hapus TTD kepala sekolah. */
export async function hapusTtdKepsek(): Promise<void> {
  try {
    await deleteObject(ref(storage, pathKepsek()))
  } catch {
    /* file mungkin belum ada */
  }
  await updateDoc(doc(db, 'config', 'akademik'), {
    ttdKepsekUrl: null,
    updatedAt: new Date().toISOString(),
  })
}

/** Upload TTD sendiri (guru/wali) → users/{uid}.ttdUrl. */
export async function unggahTtdSendiri(file: File): Promise<string> {
  const uid = auth.currentUser?.uid
  if (!uid) throw new Error('Anda belum masuk.')
  const blob = await kompresTandaTangan(file)
  const storageRef = ref(storage, pathGuru(uid))
  await uploadBytes(storageRef, blob, {
    contentType: blob.type || 'image/png',
    cacheControl: 'public,max-age=86400',
  })
  const url = await getDownloadURL(storageRef)
  await updateDoc(doc(db, 'users', uid), {
    ttdUrl: url,
    updatedAt: new Date().toISOString(),
  })
  return url
}

/** Hapus TTD sendiri. */
export async function hapusTtdSendiri(): Promise<void> {
  const uid = auth.currentUser?.uid
  if (!uid) throw new Error('Anda belum masuk.')
  try {
    await deleteObject(ref(storage, pathGuru(uid)))
  } catch {
    /* ignore */
  }
  await updateDoc(doc(db, 'users', uid), {
    ttdUrl: null,
    updatedAt: new Date().toISOString(),
  })
}
