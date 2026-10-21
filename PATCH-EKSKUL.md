# Patch Ekstrakurikuler (fase 1) — SDM01Penilaian

## Ringkasan

Fitur input nilai ekstrakurikuler oleh **pengampu ekskul** atau **wali kelas**, dengan:

1. **Admin** mengelola master kegiatan, daftar pengampu (multi-guru), daftar aktivitas, dan template deskripsi capaian per predikat **C / B / A**.
2. **Guru** dapat **mengajukan diri** sebagai pengampu → admin setujui/tolak.
3. Setelah disetujui, pengampu menginput: aktivitas + predikat → deskripsi template, **atau tulis manual** (unik per siswa, mis. English Club).
4. **Hanya deskripsi capaian** yang dicetak di rapor; predikat tidak ditampilkan.
5. Generate AI (Gemini/OpenAI) untuk usulan aktivitas dan/atau deskripsi C/B/A — membutuhkan Cloud Function `generateEkskulAi` (opsional; UI tetap jalan tanpa AI).

Predikat dipetakan ke level integer yang sudah ada: C=1 Layak, B=2 Cakap, A=3 Mahir.

## File yang diubah / ditambah

```
src/types/raporData.ts          ← ganti penuh (tambah PredikatEkskul, pengampu, template, EkskulAjukan)
src/lib/ekskul.ts               ← BARU
src/pages/admin/KelolaEkstrakurikuler.tsx  ← ganti penuh
src/pages/akademik/InputEkskul.tsx         ← BARU
src/App.tsx                     ← tambah rute + import
src/pages/AkademikHub.tsx       ← menu Ekstrakurikuler ready: true
src/pages/AdminHub.tsx          ← deskripsi menu diperbarui
firestore.rules                 ← perluasan ekstrakurikuler + koleksi ajukan + tulis pengampu
src/lib/raporData.ts            ← patch simpanEkskulSiswa (aktivitas, diisiOleh) — lihat di bawah
```

## Patch `simpanEkskulSiswa` di `src/lib/raporData.ts`

Ganti signature & body agar menerima field opsional:

```ts
export async function simpanEkskulSiswa(
  kelas: string,
  p: PeriodeScope,
  e: {
    siswaId: string
    ekskulId: string
    nama: string
    level: LevelEkskul
    deskripsi: string
    aktivitas?: string
    diisiOleh?: string
  },
): Promise<void> {
  const payload: Record<string, unknown> = {
    siswaId: e.siswaId,
    kelas,
    semester: p.semester,
    tahunAjaran: p.tahunAjaran,
    ekskulId: e.ekskulId,
    nama: e.nama,
    level: e.level,
    deskripsi: e.deskripsi.trim().slice(0, BATAS_EKSKUL_DESKRIPSI),
    updatedAt: serverTimestamp(),
  }
  if (e.aktivitas?.trim()) payload.aktivitas = e.aktivitas.trim().slice(0, 120)
  if (e.diisiOleh) payload.diisiOleh = e.diisiOleh
  await setDoc(
    doc(db, 'ekstrakurikuler_siswa', idEkskulSiswa(e.siswaId, e.ekskulId, p.tahunAjaran, p.semester)),
    payload,
  )
}
```

## Rute di `src/App.tsx`

Import:

```ts
import InputEkskul from './pages/akademik/InputEkskul'
```

Di dalam RoleGate akademik, tambah:

```tsx
<Route path="/akademik/ekskul" element={profile ? <InputEkskul profile={profile} /> : null} />
```

Ubah rute admin agar meneruskan profile:

```tsx
<Route
  path="/admin/ekstrakurikuler"
  element={profile ? <KelolaEkstrakurikuler profile={profile} /> : <KelolaEkstrakurikuler />}
/>
```

## AkademikHub — ubah item segera

```ts
{
  to: '/akademik/ekskul',
  title: 'Ekstrakurikuler',
  desc: 'Predikat dan deskripsi capaian ekskul (pengampu / wali)',
  icon: 'bars',
  tone: 'green',
  ready: true,
},
```

Pindahkan dari panel "Segera hadir" ke "2 · Input nilai" atau "3 · Laporan & rapor" sesuai selera.

## AdminHub — deskripsi

```ts
desc: 'Master kegiatan, pengampu, template deskripsi capaian',
```

## Firestore rules (tambahan / ganti blok)

```
function isPengampuEkskul(ekskulId) {
  return isGuru()
    && ekskulId is string
    && exists(/databases/$(database)/documents/ekstrakurikuler/$(ekskulId))
    && request.auth.uid in get(/databases/$(database)/documents/ekstrakurikuler/$(ekskulId)).data.get('pengampuUids', []);
}

match /ekstrakurikuler/{id} {
  allow read: if isGuru();
  allow create, delete: if isAdmin();
  allow update: if isAdmin()
    || (isGuru()
        && request.resource.data.diff(resource.data).affectedKeys()
             .hasOnly(['pengampuUids', 'updatedAt'])
        // hanya lewat alur admin setujui; guru tidak menambah sendiri
        && false);
}

match /ekstrakurikuler_ajukan/{id} {
  allow read: if isAdmin()
              || (isGuru() && resource.data.uid == request.auth.uid);
  allow create: if isGuru()
                && request.resource.data.uid == request.auth.uid
                && request.resource.data.status == 'pending'
                && request.resource.data.keys().hasAll(
                     ['ekskulId', 'ekskulNama', 'uid', 'namaGuru', 'status']);
  allow update: if isAdmin()
                && request.resource.data.status in ['pending', 'disetujui', 'ditolak'];
  allow delete: if isAdmin()
                || (isGuru() && resource.data.uid == request.auth.uid && resource.data.status == 'pending');
}

match /ekstrakurikuler_siswa/{id} {
  allow read: if isAdmin()
              || waliKelasSendiri(resource.data.kelas)
              || isPengampuEkskul(resource.data.ekskulId);
  allow create: if (waliKelasSendiri(request.resource.data.kelas)
                    || isPengampuEkskul(request.resource.data.ekskulId))
                && request.resource.data.level in [1, 2, 3, 4]
                && request.resource.data.deskripsi is string
                && request.resource.data.deskripsi.size() <= 500;
  allow update: if (waliKelasSendiri(resource.data.kelas)
                    || isPengampuEkskul(resource.data.ekskulId))
                && request.resource.data.kelas == resource.data.kelas
                && request.resource.data.siswaId == resource.data.siswaId
                && request.resource.data.level in [1, 2, 3, 4]
                && request.resource.data.deskripsi is string
                && request.resource.data.deskripsi.size() <= 500;
  allow delete: if waliKelasSendiri(resource.data.kelas)
                || isPengampuEkskul(resource.data.ekskulId);
}
```

> Catatan: `isPengampuEkskul` memakai `get()` — pastikan pengampu sudah ada di `pengampuUids` sebelum input.

Setelah ubah rules: `npm run deploy:rules`.

## Cloud Function AI (opsional)

Tambah `generateEkskulAi` di `functions/` (pola sama `generateTpAi` / `generateKktpAi`):

- Input: `{ provider, namaEkskul, mode: 'deskripsi'|'aktivitas'|'keduanya', catatan? }`
- Output: `{ aktivitas?: string[], deskripsi?: { predikat: 'C'|'B'|'A', teks: string }[] }`
- Guard: `bolehPemanggilAi` (UID + email yang sama dengan generate TP).

Tanpa function ini, tombol Generate di admin menampilkan error yang jelas; template tetap bisa diisi manual.

## Deploy checklist

1. Merge file di atas ke repo `nitoe/SDM01Penilaian`
2. `npm run deploy:rules`
3. (Opsional) `npm run deploy:functions` jika `generateEkskulAi` sudah ditulis
4. Uji: admin tambah ekskul → tambah pengampu / setujui pengajuan → guru input nilai → cek di Kelengkapan Rapor & cetak SAS

## Kompatibilitas

- Data lama `ekstrakurikuler` tanpa `pengampuUids` / `deskripsiCapaian` tetap valid.
- Tab Ekstrakurikuler di **Kelengkapan Rapor SAS** (wali kelas) tetap berfungsi.
- Level 1–4 dan filter cetak rapor (`ekskulUntukRapor`) tidak diubah.
