/**
 * Upload & kelola gambar tanda tangan / stempel digital untuk rapor STS (online).
 * Path Storage:
 *   - Kepala sekolah: tanda-tangan/kepsek.png
 *   - Stempel:        tanda-tangan/stempel.png
 *   - Guru/wali:      tanda-tangan/guru/{uid}.png
 */
import { deleteObject, getDownloadURL, ref, uploadBytes } from 'firebase/storage'
import { doc, updateDoc } from 'firebase/firestore'
import { auth, db, storage } from './firebase'

const MAX_PX = 640
/** Stempel & TTD harus tetap PNG agar transparansi tidak jadi hitam. */
const MAX_BYTES_PNG = 900_000

/** Kompres gambar. Selalu PNG (jaga alpha). Jangan fallback JPEG — JPEG mengisi transparan dengan hitam. */
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
    const ctx = canvas.getContext('2d', { alpha: true })
    if (!ctx) throw new Error('Canvas tidak tersedia di peramban ini.')
    // Transparan murni — jangan fill hitam/putih
    ctx.clearRect(0, 0, w, h)
    ctx.drawImage(bitmap, 0, 0, w, h)

    const png = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/png'))
    if (!png) throw new Error('Gagal mengompres gambar.')
    if (png.size > MAX_BYTES_PNG) {
      // Coba lagi lebih kecil, tetap PNG
      const s2 = Math.min(1, 420 / Math.max(bitmap.width, bitmap.height))
      const w2 = Math.max(1, Math.round(bitmap.width * s2))
      const h2 = Math.max(1, Math.round(bitmap.height * s2))
      canvas.width = w2
      canvas.height = h2
      ctx.clearRect(0, 0, w2, h2)
      ctx.drawImage(bitmap, 0, 0, w2, h2)
      const png2 = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/png'))
      if (png2) return png2
    }
    return png
  } finally {
    bitmap.close()
  }
}

function pathKepsek(): string {
  return 'tanda-tangan/kepsek.png'
}

function pathStempel(): string {
  return 'tanda-tangan/stempel.png'
}

function pathGuru(uid: string): string {
  return `tanda-tangan/guru/${uid}.png`
}

async function unggahBlob(path: string, blob: Blob): Promise<string> {
  const storageRef = ref(storage, path)
  await uploadBytes(storageRef, blob, {
    contentType: 'image/png',
    cacheControl: 'public,max-age=86400',
  })
  return getDownloadURL(storageRef)
}

/** Upload TTD kepala sekolah → config/akademik.ttdKepsekUrl. Hanya admin. */
export async function unggahTtdKepsek(file: File): Promise<string> {
  const blob = await kompresTandaTangan(file)
  const url = await unggahBlob(pathKepsek(), blob)
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
    /* ignore */
  }
  await updateDoc(doc(db, 'config', 'akademik'), {
    ttdKepsekUrl: null,
    updatedAt: new Date().toISOString(),
  })
}

/** Upload TTD guru sendiri → users/{uid}.ttdUrl. */
export async function unggahTtdSendiri(file: File): Promise<string> {
  const u = auth.currentUser
  if (!u) throw new Error('Belum masuk.')
  const blob = await kompresTandaTangan(file)
  const url = await unggahBlob(pathGuru(u.uid), blob)
  await updateDoc(doc(db, 'users', u.uid), {
    ttdUrl: url,
    updatedAt: new Date().toISOString(),
  })
  return url
}

/** Hapus TTD guru sendiri. */
export async function hapusTtdSendiri(): Promise<void> {
  const u = auth.currentUser
  if (!u) throw new Error('Belum masuk.')
  try {
    await deleteObject(ref(storage, pathGuru(u.uid)))
  } catch {
    /* ignore */
  }
  await updateDoc(doc(db, 'users', u.uid), {
    ttdUrl: null,
    updatedAt: new Date().toISOString(),
  })
}

/** Upload stempel sekolah → config/akademik.stempelUrl. Hanya admin. */
export async function unggahStempel(file: File): Promise<string> {
  const blob = await kompresTandaTangan(file)
  const url = await unggahBlob(pathStempel(), blob)
  await updateDoc(doc(db, 'config', 'akademik'), {
    stempelUrl: url,
    updatedAt: new Date().toISOString(),
  })
  return url
}

/** Hapus stempel sekolah. */
export async function hapusStempel(): Promise<void> {
  try {
    await deleteObject(ref(storage, pathStempel()))
  } catch {
    /* ignore */
  }
  await updateDoc(doc(db, 'config', 'akademik'), {
    stempelUrl: null,
    updatedAt: new Date().toISOString(),
  })
}
