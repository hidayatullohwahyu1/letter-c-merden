# LETTER C MERDEN — Spesifikasi Build untuk Claude Code

> Simpan file ini sebagai `CLAUDE.md` di root repo `letter-c-merden`. Claude Code membaca file ini setiap sesi.
> Sumber: PRD Web App Letter C & PTSL Desa Merden (10 November 2026).

---

## 1. Ringkasan proyek

**LETTER C MERDEN** adalah aplikasi web progresif (PWA) untuk mencari, memperbaiki, dan memantau data buku Letter C (buku C tanah) Desa Merden, Kec. Purwanegara, Kab. Banjarnegara.

- **Frontend:** PWA statis (HTML + CSS + vanilla JS ES module, tanpa build step) di **GitHub Pages**, bisa dipasang di HP Android dari Chrome.
- **Backend:** **Google Apps Script** sebagai JSON API, terikat ke satu Google Spreadsheet database.
- **Data awal:** file `MASTER_LETTER_C_MERDEN.xlsx` (3.326 record C, 8.165 persil, 3.986 mutasi, 384 bidang PTSL 2019, 752 masalah koreksi).

### Tujuan
1. Petugas menemukan Nomor C, pemilik, dan persil dalam < 10 detik.
2. Semua masalah koreksi prioritas Tinggi bisa dikerjakan lewat aplikasi, dengan log siapa mengubah apa.
3. Riwayat tanah bisa ditelusuri maju-mundur antar Nomor C.
4. Data siap dipakai verifikasi calon peserta PTSL 2026.
5. Aplikasi terpasang di HP Android seperti aplikasi biasa.

---

## 2. Aturan kerja untuk Claude Code

- **Bahasa UI:** Bahasa Indonesia semua (label, pesan galat, tombol). Komentar kode boleh Bahasa Indonesia.
- **Tanpa build step** di frontend. Pakai ES module native. Library hanya dari CDN dengan versi dikunci (mis. `chart.js@4.4.1`). Jangan pakai React/Vue/npm bundler.
- **Jangan pernah** menaruh data desa, NIK, file Excel, atau kunci rahasia di repo. Repo bersifat publik.
- `docs/js/config.js` hanya boleh berisi `API_URL`, `APP_VERSION`.
- Semua `fetch` ke API lewat **satu** fungsi `api(action, data)` di `docs/js/api.js`.
- Setiap fungsi backend yang dipanggil dari API **wajib** lewat `requireSession_()` dulu (kecuali `login`).
- Setiap perubahan data **wajib** menulis ke sheet `LOG`.
- Tidak ada hard delete. Pakai kolom `dihapus` (TRUE/FALSE).
- Kerjakan per tahap (lihat §12). Selesaikan dan uji satu tahap sebelum lanjut.
- Setelah mengubah file di `docs/`, **naikkan `APP_VERSION`** di `config.js` dan `CACHE_VERSION` di `sw.js`.

---

## 3. Struktur repo

```
letter-c-merden/
├── CLAUDE.md
├── README.md                    # cara deploy, cara pasang di HP
├── docs/                        # ← GitHub Pages: Deploy from branch main, folder /docs
│   ├── index.html
│   ├── manifest.webmanifest
│   ├── sw.js
│   ├── offline.html
│   ├── css/app.css
│   ├── icons/                   # icon-192.png, icon-512.png, maskable-512.png, apple-touch-icon.png
│   └── js/
│       ├── config.js            # API_URL, APP_VERSION
│       ├── app.js               # bootstrap, daftar SW, install prompt, banner offline/update
│       ├── api.js               # api(action, data), tangani sesi habis
│       ├── auth.js              # login email + PIN, logout, simpan sesi
│       ├── db.js                # IndexedDB (data ringkas offline)
│       ├── router.js            # hash router
│       ├── ui.js                # helper: toast, modal, loading, format angka/tanggal, masking NIK
│       └── pages/
│           ├── login.js
│           ├── beranda.js       # dashboard
│           ├── cari.js
│           ├── detail-c.js
│           ├── form-c.js
│           ├── form-persil.js
│           ├── form-mutasi.js
│           ├── riwayat.js
│           ├── koreksi.js
│           ├── ptsl.js
│           ├── ptsl-detail.js
│           └── pengaturan.js
└── gas/                         # ← proyek Apps Script, dikelola dengan clasp
    ├── .clasp.json              # (gitignore scriptId bila perlu)
    ├── appsscript.json
    ├── Api.gs                   # doPost/doGet + router aksi
    ├── Auth.gs
    ├── Data.gs
    ├── Cari.gs
    ├── Detail.gs
    ├── Simpan.gs
    ├── Riwayat.gs
    ├── Koreksi.gs
    ├── Validasi.gs
    ├── Ptsl.gs
    ├── Dashboard.gs
    ├── Ekspor.gs
    ├── Scan.gs
    ├── Sinkron.gs
    ├── Setup.gs                 # impor awal dari file master, buat sheet & header
    └── Backup.gs
```

---

## 4. Arsitektur

```
[PWA di HP/laptop]  --fetch POST text/plain {action, token, data}-->  [API Apps Script]
  GitHub Pages (HTTPS)                                                  Auth.gs → cek token sesi & peran
  Service worker + IndexedDB                                            Modul .gs → logika
  Login email + PIN                                                     Data.gs → Cache, Lock, LOG
                                                                           │
                                         ┌─────────────────────────────────┼──────────────────────┐
                                  Spreadsheet DB_LETTER_C_MERDEN    Drive SCAN_LETTER_C     Drive BACKUP_LETTER_C
```

### 4.1 Deploy API
- `appsscript.json`: `"webapp": {"executeAs": "USER_DEPLOYING", "access": "ANYONE_ANONYMOUS"}`, `"timeZone": "Asia/Jakarta"`.
- Karena URL bisa dipanggil siapa saja, **keamanan sepenuhnya di token**.
- Scopes: spreadsheets, drive, script.external_request.
- Advanced service: Drive API v3 (untuk thumbnail scan).

### 4.2 Kontrak request/response
Request (dari `api.js`):
```js
const res = await fetch(API_URL, {
  method: 'POST',
  headers: { 'Content-Type': 'text/plain;charset=utf-8' }, // hindari preflight CORS
  body: JSON.stringify({ action, token, data }),
  redirect: 'follow'
});
const json = await res.json(); // { ok: true, data } | { ok: false, error: { code, message } }
```
Response (dari `Api.gs`):
```js
function doPost(e) {
  let out;
  try {
    const req = JSON.parse(e.postData.contents);
    out = { ok: true, data: route_(req) };
  } catch (err) {
    out = { ok: false, error: { code: err.code || 'ERROR', message: String(err.message || err) } };
  }
  return ContentService.createTextOutput(JSON.stringify(out)).setMimeType(ContentService.MimeType.JSON);
}
function doGet() { return ContentService.createTextOutput(JSON.stringify({ ok: true, data: { app: 'LETTER C MERDEN', status: 'up' } })).setMimeType(ContentService.MimeType.JSON); }
```
Kode galat baku: `NO_SESSION`, `SESSION_EXPIRED`, `FORBIDDEN`, `NOT_FOUND`, `VALIDATION`, `CONFLICT` (data sudah diubah orang lain), `ERROR`.
Frontend: `NO_SESSION`/`SESSION_EXPIRED` → hapus sesi lokal, arahkan ke `#/login`.

### 4.3 Login dan sesi (email + PIN — tanpa Google Cloud Console)
> Keputusan pemilik proyek (10 Nov 2026): tidak memakai Google Cloud Console / OAuth Client ID / Google Identity Services.
1. Halaman login berisi email + PIN; dikirim ke aksi `login` `{email, pin}`.
2. Admin memberi/mereset PIN dengan mengisi kolom `pin_baru` (min. 6 karakter) di sheet USERS.
3. `Auth.gs`:
   - Cocokkan `email` ke sheet `USERS` dengan `aktif = TRUE`.
   - PIN cocok bila `SHA-256(PIN_SALT|email|pin) === pin_hash`, atau sama dengan `pin_baru` (lalu disimpan sebagai `pin_hash`, `pin_baru` dikosongkan).
   - `PIN_SALT` dibuat otomatis di Script Properties. Email tak terdaftar & PIN salah → `FORBIDDEN` dengan pesan yang sama.
   - 5× salah → email dikunci 15 menit (`CacheService` key `gagal_<email>`).
   - Aksi `gantiPin {pin_lama, pin_baru}` untuk pengguna yang sudah masuk.
   - Buat token sesi `Utilities.getUuid()`; simpan di `CacheService.getScriptCache()` key `sess_<token>` = `{email, nama, peran, dusun}`, kedaluwarsa **21600 detik (6 jam, batas maksimum CacheService)**.
   - Tulis LOG aksi `login` (berhasil maupun ditolak).
4. Frontend simpan `{token, nama, peran, dusun, exp}` di `localStorage` (bungkus try/catch).
5. `logout` menghapus key cache dan localStorage.
6. Admin bisa mencabut semua sesi seorang pengguna: simpan `sess_index_<email>` berisi daftar token, hapus semua.
7. `ADMIN_EMAIL`, `PIN_SALT`, dan ID lain disimpan di **Script Properties**, bukan di kode backend.
8. `doGet` tanpa parameter menampilkan halaman berisi tombol menuju PWA; `doGet?status=1` membalas JSON status.

### 4.4 Peran
| Peran | Hak |
|---|---|
| `admin` | semua; kelola USERS; lihat NIK penuh; ekspor; pulihkan data dihapus |
| `operator` | cari, tambah/ubah C/persil/mutasi, kerjakan koreksi |
| `kadus` | lihat data dusunnya saja (`dusun` di USERS: I–V), beri catatan koreksi; NIK tersamar |
| `pimpinan` | lihat semua + dashboard; tidak bisa mengubah |

Masking NIK di **server**: `3304010101900001` → `3304 01•• •••• 0001` untuk selain admin.

---

## 5. Model data (Google Spreadsheet `DB_LETTER_C_MERDEN`)

Baris 1 = header persis seperti di bawah (snake_case). Tanpa merge cell. Kolom kunci & nomor diset format teks `@`.

### C
`id_c, nomor_c, nama_asli, nama, alamat, dusun, rt, rw, file_scan, ket_dobel, catatan, dihapus, dibuat_oleh, dibuat_pada, diubah_oleh, diubah_pada`
- `id_c` = `C00001`… (unik, tidak pernah dipakai ulang).
- `nomor_c` teks; boleh berhuruf (`3657b`) atau gabungan (`3252/3227`); **boleh dobel** (ditandai, bukan ditolak).

### PERSIL
`id_persil, nomor_c, no_persil, tipe, kelas, kelas_asli, luas_ha, luas_m2, status, sebab_asli, catatan, dihapus, dibuat_oleh, dibuat_pada, diubah_oleh, diubah_pada`
- `tipe` ∈ `Tanah Kering (D)`, `Tanah Basah(S)` (ejaan persis template, tanpa spasi sebelum `(S)`).
- `kelas` ∈ `D-I … D-VII`, `S-I … S-VII`.
- `status` ∈ `Aktif`, `Tidak Aktif`.
- **Luas total (m²) = luas_ha × 10.000 + luas_m2** — dihitung, tidak disimpan.

### MUTASI
`id_mutasi, id_persil, nomor_c, no_persil, tanggal, tahun, jenis, kata, nomor_c_lawan, nama_disebut, luas, teks_asli, perlu_cek, catatan, dihapus, dibuat_oleh, dibuat_pada`
- `jenis` ∈ `Jual, Beli, Waris, Hibah, Tukar, Pecah, Putusan Pengadilan, Gadai, Lainnya`.
- `kata` ∈ `ke, dr, di, dg` → **arah** dibaca dari sheet REF (tidak disimpan).

### PTSL
`id_ptsl, tahun, kadus, tgl_pendataan, pemohon, nik, tempat_lahir, tgl_lahir, pekerjaan, agama, alamat, rt_rw, cara_perolehan, tahun_perolehan, perolehan_dari, batas_utara, batas_timur, batas_selatan, batas_barat, jenis_hak, nop, letak_tanah, rt_rw_tanah, blok, penggunaan, njop, nomor_c, persil, kelas_asli, kelas, luas, nama_pemilik_c, nib, berkas, pemanfaatan, bangunan, status_tanah, fasum, sengketa, saksi2, catatan`
- `tahun` = 2019 untuk data awal; disiapkan untuk PTSL 2026.

### KOREKSI
`id_koreksi, sheet, ref_id, nomor_c, kolom, nilai, masalah, saran, prioritas, status, dicek_oleh, dicek_pada, catatan, kode_aturan`
- `prioritas` ∈ `Tinggi, Sedang, Rendah`; `status` ∈ `Belum, Sudah`.

### LOG (hanya append)
`id_log, waktu, email, aksi, sheet, ref_id, kolom, lama, baru`

### USERS
`email, nama, peran, dusun, aktif, pin_hash, pin_baru`

### REF
Blok-blok daftar baku: tipe, kelas, status, dusun (I–V), jenis mutasi, **peta kata → arah**:
| kata | arah |
|---|---|
| ke | Keluar |
| dr | Masuk |
| di | Masuk (disimpulkan: ±90% persil bertulisan "di" berstatus Aktif; bisa diubah Admin) |
| dg | Tukar |

Info desa: Nama Desa MERDEN, Kecamatan PURWANEGARA, Kabupaten BANJARNEGARA, Kode Desa PTSL 11.28.04.02.

### META
`kunci, nilai` — antara lain `data_version` (angka, naik setiap ada simpan; dipakai sinkron offline).

---

## 6. Impor awal (`Setup.gs`)

1. Admin mengunggah `MASTER_LETTER_C_MERDEN.xlsx` ke Drive dan membukanya sebagai Google Sheets (konversi).
2. `setupDatabase()` membuat semua sheet DB + header + format teks + validasi dropdown.
3. `imporDariMaster(masterSpreadsheetId)` memetakan:

| Sheet master | → | Sheet DB | Pemetaan |
|---|---|---|---|
| MASTER_C | → | C | ID_C→id_c, Nomor C→nomor_c, Nama Pemilik (asli)→nama_asli, Nama Pemilik (rapi)→nama, Alamat (asli)→alamat, Dusun→dusun, RT, RW, Nama File Scan→file_scan, Keterangan Dobel→ket_dobel, Catatan Pengetik→catatan |
| PERSIL | → | PERSIL | ID_PERSIL, Nomor C, No Persil, Tipe Tanah, Kelas Tanah (baku)→kelas, Kelas (asli), Luas ha (asli), Luas m² (asli), Status, Sebab & Tanggal Perubahan (asli)→sebab_asli |
| MUTASI | → | MUTASI | ID_MUTASI, ID_PERSIL, Nomor C (persil ini), No Persil, Tanggal, Tahun, Jenis Mutasi, Kata di Teks, Nomor C Lawan, Nama Disebut, Luas Disebut, Teks Asli, Perlu Cek |
| PTSL_2019 | → | PTSL | kolom sesuai nama; `tahun` = 2019; abaikan kolom rumus (hijau) |
| PERLU_KOREKSI | → | KOREKSI | Sheet, ID→ref_id, Nomor C, Kolom, Nilai Sekarang, Masalah, Saran Perbaikan, Prioritas, Sudah Dicek?→status |

4. Abaikan kolom hasil rumus (Jml Persil, Luas Aktif, Status C, Arah, dll.) — dihitung ulang di server.
5. Tulis dengan `setValues` per blok 2.000 baris. Cetak jumlah per sheet; **harus sama** dengan angka di atas.
6. `setupDatabase()` juga membuat pemicu harian `backupHarian()`.

---

## 7. Daftar aksi API

Semua: `POST`, body `{action, token, data}`. Kolom "Peran" = peran minimal.

| Aksi | Peran | data masuk | data keluar |
|---|---|---|---|
| `login` | — | `{email, pin}` | `{token, nama, peran, dusun, exp}` |
| `gantiPin` | semua | `{pin_lama, pin_baru}` | `{}` |
| `logout` | semua | — | `{}` |
| `me` | semua | — | profil sesi |
| `cari` | semua | `{q, filter:{dusun,status,tipe,kelas,dobel}, hal}` | `{total, hal, baris:[{nomor_c, id_c, nama, dusun, jml_persil, luas_aktif, status_c, dobel}]}` (50/hal) |
| `detailC` | semua | `{nomor_c}` | `{records:[C…], persil:[…+luas_total], mutasi_keluar, mutasi_masuk, ptsl:[…], koreksi:[…], ringkas:{jml_persil, jml_aktif, luas_total, luas_aktif, status_c}}` |
| `simpanC` | operator | `{…kolom C, diubah_pada_lama?}` | `{id_c, peringatan:[…]}` |
| `simpanPersil` | operator | idem | `{id_persil, peringatan}` |
| `simpanMutasi` | operator | `{…, nonaktifkanAsal?:bool, buatPersilTujuan?:bool}` | `{id_mutasi, id_persil_baru?}` |
| `hapus` | operator | `{sheet, id}` | `{}` (soft delete) |
| `pulihkan` | admin | `{sheet, id}` | `{}` |
| `riwayat` | semua | `{id_persil, langkah:5}` | `{simpul:[{id, nomor_c, no_persil, nama, ada}], garis:[{dari, ke, jenis, tahun, arah}]}` |
| `listKoreksi` | semua | `{filter:{prioritas,sheet,status,dusun,q}, hal}` | `{total, baris}` |
| `tandaiKoreksi` | operator (kadus: catatan saja) | `{id_koreksi, status, catatan}` | `{}` |
| `laporKoreksi` | semua | `{sheet, ref_id, kolom, masalah}` | `{id_koreksi}` |
| `periksaUlang` | admin | — | `{baru, total}` |
| `listPtsl` | semua | `{filter:{kadus,status_cocok,punya_nib,tahun}, hal}` | `{total, baris}` |
| `detailPtsl` | semua | `{id_ptsl}` | bidang + `{status_cocok, nama_pemilik_letter_c, luas_letter_c, selisih}` |
| `buatCdariPtsl` | operator | `{id_ptsl}` | `{id_c}` |
| `dashboard` | semua | — | angka rekap (§9 M7) |
| `sinkronOffline` | semua | `{versi}` | `{versi, penuh:bool, c:[ringkas], persil:[ringkas]}` — **tanpa NIK** |
| `ekspor` | admin | `{jenis:'template'|'koreksi'}` | `{namaFile, mime, base64}` |
| `scan` | semua | `{file}` | `{mime, base64}` |
| `users` / `simpanUser` / `cabutSesi` | admin | — / user / email | daftar / ok |
| `log` | admin | `{filter, hal}` | `{total, baris}` |

Kadus: server **selalu** menambahkan filter `dusun = sesi.dusun` pada `cari`, `listKoreksi`, `listPtsl` (PTSL: `kadus = 'Kadus ' + angka`).

---

## 8. Backend: detail implementasi

### Data.gs
- `readSheet_(name)` → array objek (pakai header). Simpan hasil di memori per eksekusi.
- **Cache ringkasan** di `CacheService` (potong per 90 KB, key `idx_c_<n>`, `idx_p_<n>`, TTL 21600). Isi: indeks `nomor_c → [baris]`, ringkasan persil per C.
- `bumpVersion_()` naikkan `META.data_version` dan hapus cache ringkasan setiap simpan.
- `writeRow_(sheet, obj, idKey)` dengan `LockService.getScriptLock().waitLock(20000)`; cari baris lewat indeks; jika `diubah_pada_lama` dikirim dan berbeda dari isi sheet → lempar `CONFLICT`.
- `log_(aksi, sheet, refId, kolom, lama, baru)` → append ke LOG (satu baris per kolom yang berubah).
- ID baru: ambil angka terbesar + 1, dalam lock.

### Cari.gs
- Normalisasi kueri: huruf besar, buang titik/spasi ganda. Jika kueri cocok `^\d+[a-zA-Z]?$` → cari `nomor_c` persis dulu, lalu awalan. Selain itu cari di `nama` (contains, tanpa peduli titik/spasi) dan `no_persil`.
- Urutan hasil: cocok persis Nomor C → awalan → nama.

### Validasi.gs (dipakai saat simpan **dan** `periksaUlang`)
| Kode | Aturan | Saat simpan | Prioritas antrean |
|---|---|---|---|
| V-01 | nomor_c wajib | tolak | Tinggi |
| V-02 | nomor_c sudah ada, nama beda | minta konfirmasi (`peringatan`, kirim ulang dengan `konfirmasi:true`) | Tinggi |
| V-03 | nomor_c sama, nama & scan sama | minta konfirmasi | Sedang |
| V-04 | nomor_c berhuruf/gabungan | izinkan, tandai | Sedang |
| V-05 | persil memakai nomor_c tak ada di C | tolak (tawarkan buat C) | Tinggi |
| V-06 | kelas di luar daftar | tolak | Sedang |
| V-07 | huruf kelas ≠ tipe (D=kering, S=basah) | tolak | Sedang |
| V-08 | luas kosong / 0 | tolak | Sedang |
| V-09 | C tanpa persil | — | Sedang |
| V-10 | nomor_c_lawan mutasi tak ada | izinkan, tandai | Rendah |
| V-11 | NIK bukan 16 angka | tolak | Sedang |
| V-12 | PTSL: nomor_c/persil tak cocok ke Letter C | — | Sedang |

Normalisasi kelas (fungsi bersama backend & frontend):
```js
function normKelas(v) {
  const k = String(v || '').toUpperCase().replace(/[\s.\-]/g, '');
  const m = k.match(/^([DS])(VIII|VII|VI|IV|V|III|II|I|[1-8])$/);
  if (!m) return null;
  const r = {1:'I',2:'II',3:'III',4:'IV',5:'V',6:'VI',7:'VII',8:'VIII'}[m[2]] || m[2];
  return m[1] + '-' + r;
}
```
`periksaUlang` hanya menambah masalah yang belum ada (kunci: `kode_aturan + ref_id`), tidak mengubah yang sudah `Sudah`.

### Turunan yang dihitung server
- `luas_total = luas_ha*10000 + luas_m2`
- per C: `jml_persil`, `jml_aktif`, `luas_total`, `luas_aktif`, `status_c` = `Tanpa persil` | `Aktif` (ada persil aktif) | `Habis/Mutasi`
- `dobel` = nomor_c muncul > 1 di C (tidak dihapus)
- mutasi `arah` dari REF
- PTSL `status_cocok`: `Nomor C kosong` | `C tidak ada di Letter C` | `Persil kosong` | `Persil tidak ada di C ini` | `Cocok`; jika Cocok: `luas_letter_c` = jumlah luas_total persil (nomor_c, no_persil), `selisih = luas - luas_letter_c`.

### Riwayat.gs
Dari persil awal: mundur lewat mutasi berarah Masuk (`nomor_c_lawan` = asal), maju lewat mutasi Keluar. BFS maks 5 langkah, hindari siklus. Simpul yang `nomor_c`-nya tak ada → `ada:false`.

### Scan.gs
- Folder Drive ID di Script Property `SCAN_FOLDER_ID`. Cari file per nama (cache peta nama→fileId).
- Ambil thumbnail besar via Drive API advanced: `Drive.Files.get(id, {fields:'thumbnailLink'})`, ganti `=s220` → `=s1600`, `UrlFetchApp` dengan header `Authorization: Bearer ScriptApp.getOAuthToken()`. Gagal → kirim blob asli. Balas base64.
- File tak ada → `NOT_FOUND` (frontend tampilkan "Scan belum tersedia").

### Ekspor.gs
- Template impor disimpan di Drive sebagai Google Sheet (Script Property `TEMPLATE_ID`) dengan sheet `letter_c` dan `persil` (header asli, termasuk sel A1 `61` di persil — **jangan diubah**).
- Salin template → isi data (C: No, Nomor c, Nama Pemilik, Alamat Pemilik, Nama File, Perlu Koreksi ?, Catatan Pengetik; PERSIL: No, nomor c, nomor persil, tipe tanah, kelas tanah, tanggal perubahan, luas ha, luas m2, ipeda(r)=0, ipeda(s)=0, aktif, sebab, catatan, perlu koreksi) → ekspor `https://docs.google.com/spreadsheets/d/<id>/export?format=xlsx` dengan OAuth token → base64 → hapus salinan → LOG.
- Nomor C/persil yang murni angka ditulis sebagai angka di file ekspor.

### Backup.gs
`backupHarian()`: `DriveApp.getFileById(DB_ID).makeCopy('DB_LETTER_C_MERDEN_' + yyyyMMdd, folderBackup)`; hapus salinan > 30 terbaru.

---

## 9. Frontend: halaman dan perilaku

Router hash: `#/login`, `#/` (beranda), `#/cari?q=`, `#/c/<nomor_c>`, `#/c/<nomor_c>/ubah`, `#/persil/<id>/ubah`, `#/persil/baru?c=`, `#/mutasi/baru?persil=`, `#/riwayat/<id_persil>`, `#/koreksi`, `#/ptsl`, `#/ptsl/<id>`, `#/pengaturan`.

Navigasi: HP = menu bawah 5 ikon (Beranda, Cari, Koreksi, PTSL, Lainnya); laptop ≥ 900 px = menu samping. Tombol yang tidak boleh untuk peran → disembunyikan **dan** tetap ditolak server.

### M1 Login
Logo, nama aplikasi, form email + PIN. Pesan jelas untuk "Akses ditolak — hubungi admin desa".

### M2 Cari & Detail
- Kotak cari besar, debounce 300 ms, filter chip (dusun, status, tipe, kelas, hanya dobel). Kartu hasil di HP, tabel di laptop. Paging 50.
- Online → API; offline → IndexedDB.
- Detail C: kartu pemilik (tampilkan semua record jika nomor_c dobel, berdampingan + label `ket_dobel`), tabel persil (aktif tebal, tidak aktif abu-abu), ringkasan luas, mutasi masuk/keluar (Nomor C lawan bisa diklik), tombol Lihat Scan (modal, zoom cubit), PTSL terkait, koreksi terbuka, tombol Ubah / Tambah Persil / Laporkan Koreksi.

### M3 Form
- Dropdown tipe/kelas/status/jenis/dusun dari REF (dimuat sekali, disimpan di IndexedDB).
- Luas total tampil langsung saat mengetik.
- Galat validasi ditampilkan di bawah field; peringatan V-02/V-03 → dialog konfirmasi.
- Kirim `diubah_pada_lama`; jika `CONFLICT` → dialog "Data sudah diubah orang lain, muat ulang?".
- Form mutasi arah Keluar: centang "Nonaktifkan persil asal" dan "Buat persil di C tujuan".

### M4 Koreksi
Filter prioritas/sheet/status/dusun; kartu masalah dengan tombol **Kerjakan** (buka detail di panel samping laptop / halaman di HP) dan **Tandai Sudah** + catatan. Progres per prioritas di atas.

### M5 Riwayat
Pohon SVG sederhana kiri→kanan (asal → persil ini → tujuan), label jenis + tahun di garis, simpul merah bila C tidak ada. Klik simpul → detail C.

### M6 PTSL
Daftar dengan filter Kadus, status cocok (warna: hijau Cocok, oranye lainnya), punya NIB. Detail: data pemohon (NIK tersamar), batas, NOP, NIB, berkas, perbandingan luas. Tombol "Buat C dari data ini" bila C tidak ada.

### M7 Dashboard (Beranda)
Kartu: record C, Nomor C unik, record dobel, C aktif, persil aktif, luas aktif (ha), masalah Tinggi tersisa. Grafik (Chart.js): luas aktif per kelas (bar), per tipe, per dusun; PTSL per Kadus (bar bertumpuk status cocok); progres koreksi per prioritas.

### M8 PWA
- `manifest.webmanifest`:
  ```json
  {
    "name": "Letter C Merden",
    "short_name": "Letter C",
    "start_url": "/letter-c-merden/",
    "scope": "/letter-c-merden/",
    "display": "standalone",
    "orientation": "portrait",
    "background_color": "#ffffff",
    "theme_color": "#1F4E78",
    "lang": "id",
    "icons": [
      { "src": "icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
      { "src": "icons/icon-512.png", "sizes": "512x512", "type": "image/png" },
      { "src": "icons/maskable-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
    ]
  }
  ```
  (Sesuaikan path jika nama repo berbeda.)
- `sw.js`:
  - `CACHE_VERSION = 'lcm-v1'`; precache app shell (index.html, css, semua js, ikon, offline.html).
  - App shell → cache-first. CDN → stale-while-revalidate. **Request ke `script.google.com` / `googleusercontent.com` → network-only, jangan pernah dicache.**
  - `activate` → hapus cache versi lama. Kirim pesan ke klien bila ada SW baru menunggu.
- `app.js`:
  - Daftarkan SW; tangkap `beforeinstallprompt` → tampilkan tombol "Pasang aplikasi" di menu Lainnya.
  - Banner "Versi baru tersedia — Muat ulang" (postMessage `SKIP_WAITING`).
  - Pita kuning "Offline — data terakhir" saat `navigator.onLine === false`; nonaktifkan semua tombol simpan.
- `db.js` (IndexedDB `lcm`): store `c_ringkas`, `persil_ringkas`, `ref`, `meta`. Sinkron saat login dan setiap 30 menit bila online (`sinkronOffline` dengan `versi`). **Tidak menyimpan NIK atau data PTSL.**
- Ikon dibuat sederhana (huruf "C" di atas warna #1F4E78) dalam PNG 192/512 + maskable dengan zona aman 80%.

### Gaya
- Font sistem (`system-ui`), ukuran dasar 16 px, target sentuh ≥ 44 px.
- Warna utama #1F4E78, aksen hijau #548235, peringatan #C00000; dukung mode gelap via `prefers-color-scheme`.
- Angka format Indonesia (`toLocaleString('id-ID')`), tanggal `DD/MM/YYYY`, luas `1.234 m²` dan `0,12 ha`.

---

## 10. Kebutuhan non-fungsional

| Aspek | Target |
|---|---|
| Kecepatan | buka aplikasi terpasang ≤ 2 dtk; cari ≤ 2 dtk (cache) / ≤ 6 dtk (tanpa cache); simpan ≤ 3 dtk |
| Pemasangan | lolos syarat installable Chrome Android; Lighthouse PWA tanpa galat |
| Offline | tampilan + cari data ringkas jalan tanpa internet; simpan nonaktif |
| Kapasitas | 20.000 C dan 50.000 persil tanpa ubah desain |
| Serentak | 5 operator menulis bersamaan tanpa data tertimpa |
| Perangkat | Chrome Android 9+, lebar 360 px; Chrome/Edge laptop 1366 px |
| Keamanan | semua aksi cek token & peran; repo publik tanpa rahasia; NIK penuh hanya untuk admin |
| Privasi | spreadsheet & folder scan tidak dibagikan; NIK tidak masuk cache SW / IndexedDB |
| Audit | tambah, ubah, hapus, koreksi, login, ekspor tercatat di LOG |
| Cadangan | salinan harian, simpan 30 terakhir |

---

## 11. Script Properties (diisi Admin, bukan di kode)

| Kunci | Isi |
|---|---|
| `DB_ID` | ID spreadsheet DB_LETTER_C_MERDEN |
| `MASTER_ID` | ID Google Sheet master (untuk `jalankanImpor`) |
| `APP_FOLDER_ID` | folder Drive aplikasi (DB & backup dibuat di sini) |
| `PIN_SALT` | dibuat otomatis — jangan diubah (mengubahnya membatalkan semua PIN) |
| `SCAN_FOLDER_ID` | folder Drive scan IMGxxxx.jpg |
| `BACKUP_FOLDER_ID` | folder backup |
| `TEMPLATE_ID` | Google Sheet template impor |
| `ADMIN_EMAIL` | email admin pertama (otomatis masuk USERS saat setup) |

---

## 12. Tahapan pengerjaan

### Tahap 1 — Fondasi
- [ ] `gas/`: Api.gs, Auth.gs, Data.gs, Setup.gs; `setupDatabase()` + `imporDariMaster()`
- [ ] Aksi `login`, `logout`, `me`, `cari`, `detailC`, `scan`
- [ ] `docs/`: index.html, router, api.js, auth.js, ui.js, halaman login, cari, detail C
- [ ] PWA: manifest, ikon, sw.js, tombol pasang, banner offline/update
- [ ] README: langkah buat OAuth Client ID, deploy API, aktifkan GitHub Pages, pasang di HP
- **Gerbang:** jumlah data impor cocok; terpasang di HP Android; panggilan tanpa token ditolak.

### Tahap 2 — Perbaikan data
- [ ] Simpan.gs + Validasi.gs; form C, persil, mutasi; soft delete; LOG
- [ ] Koreksi.gs; halaman antrean koreksi; `laporKoreksi`
- [ ] Filter Kadus di server
- **Gerbang:** semua masalah prioritas Tinggi bisa dikerjakan dan ditandai.

### Tahap 3 — Riwayat, PTSL, dashboard, ekspor
- [ ] Riwayat.gs + halaman pohon riwayat
- [ ] Ptsl.gs + halaman PTSL + `buatCdariPtsl`
- [ ] Dashboard.gs + beranda grafik
- [ ] Ekspor.gs (template, koreksi CSV), Sinkron.gs + IndexedDB offline, Backup.gs
- [ ] Halaman pengaturan (users, peta kata mutasi, log, cabut sesi)
- **Gerbang (rilis MVP):** uji coba 1 minggu oleh 2 operator + 1 Kadus tanpa data hilang.

### Tahap 4 — Lanjutan (di luar MVP)
Cetak surat keterangan riwayat tanah (PDF), data PTSL 2026, peta bidang (Leaflet + GeoJSON), simpan offline + sinkron, rilis Play Store (TWA), integrasi portal layanan desa.

---

## 13. Kriteria selesai MVP

- [ ] 3.326 C, 8.165 persil, 3.986 mutasi, 384 PTSL, 752 koreksi terimpor tanpa selisih
- [ ] Angka dashboard sama dengan sheet REKAP file master (mis. persil aktif 5.999; luas aktif 7.613.516 m² ≈ 761,35 ha; Nomor C unik 3.125)
- [ ] Terpasang dari Chrome di ≥ 3 HP Android, terbuka layar penuh dengan ikon sendiri
- [ ] Mode pesawat: aplikasi terbuka dan cari Nomor C tetap memberi hasil
- [ ] Target kecepatan tercapai di HP dan laptop
- [ ] Tanpa token / email di luar USERS ditolak; Kadus hanya lihat dusunnya; NIK tersamar non-admin
- [ ] Repo tidak memuat data desa atau rahasia
- [ ] File ekspor template bisa diimpor ke aplikasi Letter C tanpa galat

---

## 14. Catatan data penting

- 146 record "Nomor C sama, nama pemilik beda" → prioritas Tinggi, wajib cek buku C fisik. Jangan digabung otomatis.
- 331 dari 384 bidang PTSL 2019 memakai Nomor C yang belum ada di Letter C hasil ketik (kebanyakan nomor 4700–6000-an).
- Dusun dibaca otomatis dari alamat ("KEB II" → II, "MERDEN III" → III, "Karang Kajen" → V); 862 record belum diketahui → Kadus melengkapi di Tahap 2.
- Kelas VIII ada di 5 persil walau template hanya sampai VII → ditandai, tidak ditolak saat impor.
- Kolom `ipeda` di data asli semuanya 0.

---

## 15. Jawaban pemilik proyek (10 Nov 2026)

1. Akun Google pribadi pemilik proyek (spreadsheet & Apps Script). Tidak memakai Google Cloud Console; aplikasi harus gratis.
2. GitHub `hidayatullohwahyu1`, repo `letter-c-merden`, alamat `hidayatullohwahyu1.github.io/letter-c-merden`.
3. Scan buku C belum ada (`SCAN_FOLDER_ID` kosong).
4. Belum ada aplikasi Letter C tujuan impor (Ekspor template tidak mendesak).
