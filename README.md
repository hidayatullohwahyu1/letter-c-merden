# Letter C Merden

Aplikasi web (PWA) untuk mencari, memperbaiki, dan memantau data buku Letter C Desa Merden,
Kec. Purwanegara, Kab. Banjarnegara.

- **Aplikasi (PWA):** folder `docs/` → GitHub Pages, bisa dipasang di HP Android dari Chrome.
- **API:** folder `gas/` → Google Apps Script + Google Spreadsheet `DB_LETTER_C_MERDEN`.
- **Login:** email + PIN, diperiksa Apps Script. **Tidak perlu Google Cloud Console.**
- **Biaya:** gratis (GitHub Pages publik + kuota gratis Apps Script/Drive). Jangan aktifkan penagihan apa pun.
- Spesifikasi lengkap: [`CLAUDE.md`](CLAUDE.md).

> ⚠️ Repo ini **publik**. Jangan pernah meng-commit file Excel, data desa, NIK, atau kunci rahasia.
> `.gitignore` sudah menolak `*.xlsx`, `*.xls`, `*.csv`, `gas/Lokal.gs`, `gas/.clasp.json`.

Status: **Tahap 2 (Perbaikan data)** — login, cari, detail C, lihat scan, PWA terpasang;
tambah/ubah/hapus C, persil, mutasi dengan validasi V-01…V-10; antrean koreksi; semua perubahan tercatat di sheet LOG.

## Cara pakai singkat

| Tugas | Di mana |
|---|---|
| Cari Nomor C / nama / persil | menu **Cari** |
| Ubah data pemilik | Detail C → **Ubah** |
| Tambah persil | Detail C → **+ Tambah persil** |
| Ubah persil / catat mutasi | Detail C → tabel persil → **Ubah** / **Mutasi** |
| Mutasi keluar (jual/waris ke C lain) | form Mutasi, arah **ke**: centang *Nonaktifkan persil asal* & *Buat persil di C tujuan* |
| Kerjakan masalah data | menu **Koreksi** → **Kerjakan** → perbaiki → **Tandai sudah** |
| Laporkan data salah | Detail C → **Laporkan masalah** |
| Isi dusun (Kadus) | Detail C → **Isi dusun** |
| Periksa ulang seluruh data (admin) | **Lainnya → Periksa ulang semua data** |
| Pulihkan data terhapus (admin) | sementara lewat sheet: ubah kolom `dihapus` jadi FALSE (layar admin di Tahap 3) |

---

## 1. Siapkan Google Spreadsheet & Apps Script

Semua langkah memakai **akun Google pemilik aplikasi**.

1. **Unggah master**: unggah `MASTER_LETTER_C_MERDEN.xlsx` ke Google Drive → *Buka dengan → Google Spreadsheet*
   → *File → Simpan sebagai Google Spreadsheet*. Catat ID-nya (bagian URL antara `/d/` dan `/edit`).
2. **Buat proyek & kirim kode dengan clasp** (sekali login: `clasp login`):
   ```bash
   cd gas
   ```
   ```bash
   clasp create --type standalone --title "LETTER C MERDEN API" --rootDir .
   ```
   (Perintah `create` menimpa `appsscript.json`; kembalikan file manifes dari repo sebelum push.)
   ```bash
   clasp push --force
   ```
3. **Isi Script Properties** (*Setelan proyek → Properti skrip*), atau buat `gas/Lokal.gs` (tidak masuk repo)
   berisi fungsi `aturProperti()`:

   | Kunci | Isi |
   |---|---|
   | `ADMIN_EMAIL` | email admin pertama |
   | `MASTER_ID` | ID Google Sheet master |
   | `APP_FOLDER_ID` | *opsional* — folder Drive tempat DB & backup dibuat |
   | `DB_ID` | *kosongkan* — dibuat otomatis oleh `setupDatabase()` |
   | `SCAN_FOLDER_ID` | *kosongkan* sampai scan buku C tersedia |
   | `PIN_SALT` | *jangan diisi* — dibuat otomatis saat login pertama |

4. Di editor, jalankan **`setupDatabase`** (izinkan akses), lalu **`jalankanImpor`**.
   Jalankan **`cekJumlah`**; log harus menulis COCOK untuk C 3326, PERSIL 8165, MUTASI 3986, PTSL 384, KOREKSI 752.

## 2. Deploy API

```bash
clasp create-deployment --description "Tahap 1"
```
Atau di editor: *Terapkan → Penerapan baru → Aplikasi web* (Jalankan sebagai **Saya**, akses **Siapa saja**).
Salin URL `/exec` → isi `API_URL` di `docs/js/config.js`.

- Cek: buka `URL?status=1` → `{"ok":true,"data":{"app":"LETTER C MERDEN","status":"up"}}`.
- Membuka URL tanpa `?status=1` menampilkan tombol "Buka aplikasi" menuju PWA.
- Setiap mengubah kode `.gs`, perbarui penerapan yang sama (URL tetap):
  ```bash
  clasp create-deployment -i <DEPLOYMENT_ID> -d "keterangan"
  ```

## 3. Terbitkan ke GitHub Pages

1. Repo publik `hidayatullohwahyu1/letter-c-merden`, *Settings → Pages*: branch `main`, folder **`/docs`**.
2. Aplikasi ada di `https://hidayatullohwahyu1.github.io/letter-c-merden/`.
3. Setiap mengubah file di `docs/`: naikkan `APP_VERSION` di `docs/js/config.js` **dan** `CACHE_VERSION`
   di `docs/sw.js`, agar HP pengguna menerima versi baru (muncul banner "Versi baru tersedia").

## 4. Tambah pengguna & beri PIN

Isi sheet **USERS** di spreadsheet DB:

| email | nama | peran | dusun | aktif | pin_hash | pin_baru |
|---|---|---|---|---|---|---|
| operator@contoh.id | Nama Operator | operator | | TRUE | *(kosong)* | 482915 |
| kadus2@contoh.id | Nama Kadus | kadus | II | TRUE | *(kosong)* | 730164 |

- Peran: `admin`, `operator`, `kadus` (wajib isi dusun I–V), `pimpinan`.
- **PIN sementara** ditulis di `pin_baru` (minimal 6 karakter). Saat pengguna masuk pertama kali dengan PIN itu,
  aplikasi menyimpannya sebagai sandi acak di `pin_hash` dan mengosongkan `pin_baru`.
- Pengguna sebaiknya langsung mengganti PIN di menu **Lainnya → Ganti PIN**.
- **Lupa PIN / reset**: admin mengisi `pin_baru` lagi (PIN lama tetap berlaku sampai PIN baru dipakai).
- **Cabut akses**: ubah `aktif` menjadi FALSE.
- Setelah 5 kali PIN salah, email itu dikunci 15 menit.

## 5. Pasang di HP Android

1. Buka `https://hidayatullohwahyu1.github.io/letter-c-merden/` di **Chrome**.
2. Masuk dengan email + PIN.
3. Menu **Lainnya → Pasang aplikasi**, atau menu ⋮ Chrome → *Instal aplikasi* / *Tambahkan ke layar utama*.
4. Ikon "Letter C" muncul di layar utama dan terbuka layar penuh.

## 6. Uji lokal

```bash
python -m http.server 8080 --directory docs
```
Buka `http://localhost:8080/`.

## Struktur

```
docs/   PWA (GitHub Pages)
gas/    Apps Script: Api, Auth, Data, Cari, Detail, Scan, Simpan, Validasi, Koreksi, Setup, Backup
```

## Catatan keamanan

- Semua aksi selain `login` wajib token sesi (6 jam) dan dicek perannya di server.
- PIN tidak pernah disimpan sebagai teks setelah dipakai; hanya hash SHA-256 bergaram (`PIN_SALT` di Script Properties).
- Email tak terdaftar dan PIN salah memberi pesan yang sama, agar daftar pengguna tidak bisa ditebak.
- NIK disamarkan di server untuk semua peran selain admin; NIK tidak pernah disimpan di cache HP.
- Kadus hanya melihat Nomor C di dusunnya (ditambah record yang dusunnya belum diketahui, agar bisa dilengkapi).
- Spreadsheet DB, folder scan, dan folder backup **jangan dibagikan**.
