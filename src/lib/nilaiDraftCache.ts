/**
 * Cache lokal (localStorage) untuk draf input nilai SLM / STS / SAS.
 * Agar jika tab tertutup atau browser crash, isian yang belum disimpan bisa dipulihkan.
 */

export type DrafNilai = Record<string, Record<string, string>>

export type NilaiDraftPayload = {
  /** ISO time saat terakhir ditulis */
  updatedAt: string
  /** mapel|kelas|semester|tahun|jenis */
  kunci: string
  draf: DrafNilai
}

const PREFIX = 'sdm01:nilai-draf:v1:'

export function kunciDraf(opts: {
  jenis: 'slm' | 'sts' | 'sas'
  mapel: string
  kelas: string
  semester: string
  tahunAjaran: string
}): string {
  return [opts.jenis, opts.tahunAjaran, opts.semester, opts.mapel, opts.kelas].join('|')
}

function storageKey(kunci: string): string {
  return PREFIX + kunci
}

export function bacaDrafLokal(kunci: string): NilaiDraftPayload | null {
  try {
    const raw = localStorage.getItem(storageKey(kunci))
    if (!raw) return null
    const parsed = JSON.parse(raw) as NilaiDraftPayload
    if (!parsed || parsed.kunci !== kunci || !parsed.draf || typeof parsed.draf !== 'object') return null
    return parsed
  } catch {
    return null
  }
}

export function tulisDrafLokal(kunci: string, draf: DrafNilai): void {
  try {
    const payload: NilaiDraftPayload = {
      updatedAt: new Date().toISOString(),
      kunci,
      draf,
    }
    localStorage.setItem(storageKey(kunci), JSON.stringify(payload))
  } catch {
    // kuota penuh / mode privat — diamkan
  }
}

export function hapusDrafLokal(kunci: string): void {
  try {
    localStorage.removeItem(storageKey(kunci))
  } catch {
    /* ignore */
  }
}

/** Apakah draf lokal punya sel non-kosong yang beda dari nilai server (untuk SLM: field slm). */
export function drafLokalBerbedaDariServer(
  draf: DrafNilai,
  server: Record<string, Record<string, { nilai?: number | null; slm?: number | null }>>,
  mode: 'slm' | 'asesmen',
): boolean {
  for (const [tpId, perSiswa] of Object.entries(draf)) {
    for (const [siswaId, teks] of Object.entries(perSiswa)) {
      if (teks === undefined || teks.trim() === '') continue
      const n = Number(String(teks).replace(',', '.'))
      if (!Number.isFinite(n)) continue
      const doc = server[tpId]?.[siswaId]
      const lama = mode === 'slm' ? doc?.slm : doc?.nilai
      if (lama !== n) return true
    }
  }
  return false
}

/** Gabungkan draf lokal di atas baseline server (hanya sel non-kosong di lokal). */
export function gabungDrafDenganServer(
  serverBaseline: DrafNilai,
  lokal: DrafNilai,
): DrafNilai {
  const out: DrafNilai = {}
  const tpIds = new Set([...Object.keys(serverBaseline), ...Object.keys(lokal)])
  for (const tpId of tpIds) {
    out[tpId] = { ...(serverBaseline[tpId] ?? {}) }
    const loc = lokal[tpId]
    if (!loc) continue
    for (const [siswaId, teks] of Object.entries(loc)) {
      if (teks !== undefined && teks.trim() !== '') {
        out[tpId][siswaId] = teks
      }
    }
  }
  return out
}

/** Baseline draf dari dokumen server SLM. */
export function baselineDariNilaiSlm(
  nilai: Record<string, Record<string, { slm?: number | null }>>,
): DrafNilai {
  const awal: DrafNilai = {}
  for (const [tpId, perSiswa] of Object.entries(nilai)) {
    awal[tpId] = {}
    for (const [siswaId, doc] of Object.entries(perSiswa)) {
      awal[tpId][siswaId] = doc.slm == null ? '' : String(doc.slm)
    }
  }
  return awal
}

/** Baseline draf dari dokumen asesmen STS/SAS. */
export function baselineDariNilaiAsesmen(
  nilai: Record<string, Record<string, { nilai?: number }>>,
): DrafNilai {
  const awal: DrafNilai = {}
  for (const [tpId, perSiswa] of Object.entries(nilai)) {
    awal[tpId] = {}
    for (const [siswaId, doc] of Object.entries(perSiswa)) {
      awal[tpId][siswaId] = Number.isFinite(doc.nilai) ? String(doc.nilai) : ''
    }
  }
  return awal
}
