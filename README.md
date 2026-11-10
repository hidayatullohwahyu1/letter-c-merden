# Letter C Merden

Aplikasi web (PWA) untuk mencari, memperbaiki, dan memantau data buku Letter C Desa Merden,
Kec. Purwanegara, Kab. Banjarnegara.

- **Frontend:** folder `docs/` → GitHub Pages (HTML/CSS/JS tanpa build).
- **Backend:** folder `gas/` → Google Apps Script (JSON API) + Google Spreadsheet `DB_LETTER_C_MERDEN`.
- Spesifikasi lengkap: [`CLAUDE.md`](CLAUDE.md).

> ⚠️ Repo ini **publik**. Jangan pernah meng-commit file Excel, data desa, NIK, atau kunci rahasia.
> `.gitignore` sudah menolak `*.xlsx`, `*.xls`, `*.csv`.

Status: **Tahap 1 (Fondasi)** — login, cari, detail C, lihat scan, PWA terpasang.

---

## 1. Siapkan Google Spreadsheet & Apps Script

Semua langkah memakai **akun Google pemilik aplikasi** (yang akan memiliki spreadsheet, API, dan OAuth Client ID).

1. **Unggah master**: unggah `MASTER_LETTER_C_MERDEN.xlsx` ke Google Drive → klik kanan →
   *Buka dengan → Google Spreadsheet*. Lalu *File → Simpan sebagai Google Spreadsheet*.
   Catat ID-nya (bagian URL antara `/d/` dan `/edit`).
2. **Buat proyek Apps Script**: buka <https://script.google.com> → *Proyek baru* → beri nama `LETTER C MERDEN API`.
3. **Salin kode**: salin semua file `gas/*.gs` dan `gas/appsscript.json` ke proyek
   (tampilkan `appsscript.json` lewat *Setelan proyek → Tampilkan file manifes "appsscript.json"*).
   Atau pakai clasp:
   ```bash
   clasp login
   ```
   ```bash
   cd gas
   ```
   salin `.clasp.json.contoh` menjadi `.clasp.json`, isi `scriptId`, lalu:
   ```bash
   clasp push
   ```
4. **Aktifkan layanan Drive API**: di editor → *Layanan (+)* → *Drive API* v3 (sudah tertulis di manifes).
5. **Isi Script Properties** (*Setelan proyek → Properti skrip*):

   | Kunci | Isi |
   |---|---|
   | `ADMIN_EMAIL` | email Google admin pertama |
   | `GOOGLE_CLIENT_ID` | dari langkah 2 di bawah |
   | `MASTER_ID` | ID Google Sheet master (langkah 1) |
   | `DB_ID` | *kosongkan* — dibuat otomatis oleh `setupDatabase()` |
   | `SCAN_FOLDER_ID` | *kosongkan* sampai scan buku C tersedia |
   | `BACKUP_FOLDER_ID` | *boleh kosong* — folder `BACKUP_LETTER_C` dibuat otomatis |

6. Di editor, pilih fungsi **`setupDatabase`** → *Jalankan* → izinkan akses.
   Spreadsheet `DB_LETTER_C_MERDEN` dibuat, `DB_ID` terisi, admin masuk sheet USERS, pemicu backup harian dibuat.
7. Pilih fungsi **`jalankanImpor`** → *Jalankan*. Lihat *Log eksekusi*; harus tertulis:
   ```
   C: 3326 baris (harapan 3326) COCOK
   PERSIL: 8165 baris (harapan 8165) COCOK
   MUTASI: 3986 baris (harapan 3986) COCOK
   PTSL: 384 baris (harapan 384) COCOK
   KOREKSI: 752 baris (harapan 752) COCOK
   ```
8. (Opsional) jalankan `ujiCari` untuk melihat hasil cari "1" di log.

## 2. Buat OAuth Client ID (login Google)

1. Buka <https://console.cloud.google.com> dengan akun yang sama → buat proyek `letter-c-merden`.
2. *APIs & Services → OAuth consent screen*: tipe **External**, isi nama aplikasi "Letter C Merden",
   email dukungan. Status *Testing* cukup, tetapi setiap pengguna harus didaftarkan sebagai *Test user* —
   atau klik *Publish app* agar semua akun yang ada di sheet USERS bisa masuk (aplikasi hanya meminta email & profil).
3. *Credentials → Create credentials → OAuth client ID* → tipe **Web application**.
   *Authorized JavaScript origins*:
   - `https://hidayatullohwahyu1.github.io`
   - `http://localhost:8080` (untuk uji lokal)
4. Salin **Client ID** → isi ke Script Property `GOOGLE_CLIENT_ID` **dan** ke `docs/js/config.js`.
   (Client ID bukan rahasia; *client secret* tidak dipakai dan jangan disimpan di mana pun.)

## 3. Deploy API

1. Editor Apps Script → *Terapkan → Penerapan baru* → jenis **Aplikasi web**.
   - Jalankan sebagai: **Saya**
   - Yang memiliki akses: **Siapa saja** (keamanan ada di token sesi, bukan di URL)
2. Salin URL yang berakhiran `/exec` → isi `API_URL` di `docs/js/config.js`.
3. Cek: buka URL itu di browser → harus tampil `{"ok":true,"data":{"app":"LETTER C MERDEN","status":"up"}}`.
4. Setiap mengubah kode `.gs`: *Terapkan → Kelola penerapan → Edit → Versi baru* (URL tetap sama).

## 4. Aktifkan GitHub Pages

1. Repo: `https://github.com/hidayatullohwahyu1/letter-c-merden` (publik).
2. *Settings → Pages → Build and deployment*: **Deploy from a branch**, branch `main`, folder **`/docs`**.
3. Setelah 1–2 menit, aplikasi ada di `https://hidayatullohwahyu1.github.io/letter-c-merden/`.
4. Setiap mengubah file di `docs/`: naikkan `APP_VERSION` di `docs/js/config.js` **dan** `CACHE_VERSION`
   di `docs/sw.js`, agar HP pengguna menerima versi baru (muncul banner "Versi baru tersedia").

## 5. Tambah pengguna

Isi sheet **USERS** di spreadsheet DB:

| email | nama | peran | dusun | aktif |
|---|---|---|---|---|
| operator@contoh.id | Nama Operator | operator | | TRUE |
| kadus2@contoh.id | Nama Kadus | kadus | II | TRUE |

Peran: `admin`, `operator`, `kadus` (wajib isi dusun I–V), `pimpinan`.

## 6. Pasang di HP Android

1. Buka `https://hidayatullohwahyu1.github.io/letter-c-merden/` di **Chrome**.
2. Masuk dengan akun Google yang terdaftar.
3. Menu **Lainnya → Pasang aplikasi**, atau menu ⋮ Chrome → *Instal aplikasi* / *Tambahkan ke layar utama*.
4. Ikon "Letter C" muncul di layar utama dan terbuka layar penuh.

## 7. Uji lokal

```bash
python -m http.server 8080 --directory docs
```
Buka `http://localhost:8080/`.

## Struktur

```
docs/   PWA (GitHub Pages)
gas/    Apps Script: Api, Auth, Data, Cari, Detail, Scan, Setup, Backup
```

## Catatan keamanan

- Semua aksi selain `login` wajib token sesi (6 jam) dan dicek perannya di server.
- Email di luar sheet USERS (atau `aktif` ≠ TRUE) ditolak dengan pesan "Akses ditolak — hubungi admin desa".
- NIK disamarkan di server untuk semua peran selain admin; NIK tidak pernah disimpan di cache HP.
- Kadus hanya melihat Nomor C di dusunnya (ditambah record yang dusunnya belum diketahui, agar bisa dilengkapi).
- Spreadsheet DB, folder scan, dan folder backup **jangan dibagikan**.
