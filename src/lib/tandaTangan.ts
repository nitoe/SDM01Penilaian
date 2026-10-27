/**
 * Upload & kelola gambar tanda tangan / stempel digital untuk rapor STS (online).
 * Path Storage:
 *   - Kepala sekolah: tanda-tangan/kepsek.png
 *   - Stempel:        tanda-tangan/stempel.png
 *   - Guru/wali:      tanda-tangan/guru/{uid}.png
 *
 * Stempel selalu dikomposit ke latar PUTIH (bukan transparan) agar mesin cetak
 * tidak menampilkan kotak hitam di area alpha.
 */
import { deleteObject, getDownloadURL, ref, uploadBytes } from 'firebase/storage'
import { doc, updateDoc } from 'firebase/firestore'
import { auth, db, storage } from './firebase'

const MAX_PX = 640
const MAX_BYTES_PNG = 900_000

async function gambarKeCanvas(
  file: File,
  opts: { latarPutih: boolean },
): Promise<HTMLCanvasElement> {
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
    if (opts.latarPutih) {
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, w, h)
    } else {
      ctx.clearRect(0, 0, w, h)
    }
    ctx.drawImage(bitmap, 0, 0, w, h)
    return canvas
  } finally {
    bitmap.close()
  }
}

async function canvasKePng(canvas: HTMLCanvasElement): Promise<Blob> {
  const png = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/png'))
  if (!png) throw new Error('Gagal mengompres gambar.')
  if (png.size <= MAX_BYTES_PNG) return png
  // skala lagi
  const s = 420 / Math.max(canvas.width, canvas.height)
  if (s >= 1) return png
  const c2 = document.createElement('canvas')
  c2.width = Math.max(1, Math.round(canvas.width * s))
  c2.height = Math.max(1, Math.round(canvas.height * s))
  const ctx = c2.getContext('2d')
  if (!ctx) return png
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, c2.width, c2.height)
  ctx.drawImage(canvas, 0, 0, c2.width, c2.height)
  const png2 = await new Promise<Blob | null>((res) => c2.toBlob(res, 'image/png'))
  return png2 || png
}

/** TTD: transparansi dijaga (tinta di atas kertas putih rapor). */
export async function kompresTandaTangan(file: File): Promise<Blob> {
  const canvas = await gambarKeCanvas(file, { latarPutih: false })
  return canvasKePng(canvas)
}

/** Stempel: wajib latar putih agar cetak tidak menghitamkan area transparan. */
export async function kompresStempel(file: File): Promise<Blob> {
  const canvas = await gambarKeCanvas(file, { latarPutih: true })
  return canvasKePng(canvas)
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
    cacheControl: 'public,max-age=3600',
  })
  return getDownloadURL(storageRef)
}

export async function unggahTtdKepsek(file: File): Promise<string> {
  const blob = await kompresTandaTangan(file)
  const url = await unggahBlob(pathKepsek(), blob)
  await updateDoc(doc(db, 'config', 'akademik'), {
    ttdKepsekUrl: url,
    updatedAt: new Date().toISOString(),
  })
  return url
}

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

export async function unggahStempel(file: File): Promise<string> {
  const blob = await kompresStempel(file)
  const url = await unggahBlob(pathStempel(), blob)
  await updateDoc(doc(db, 'config', 'akademik'), {
    stempelUrl: url,
    updatedAt: new Date().toISOString(),
  })
  return url
}

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
