/**
 * Setup.gs — buat database & impor awal dari MASTER_LETTER_C_MERDEN (Google Sheets hasil konversi).
 *
 * Urutan untuk Admin (dari editor Apps Script):
 *   1. Isi Script Properties: GOOGLE_CLIENT_ID, ADMIN_EMAIL, MASTER_ID (DB_ID boleh kosong → dibuat otomatis).
 *   2. Jalankan setupDatabase()
 *   3. Jalankan jalankanImpor()
 */

const JUMLAH_HARAPAN = { C: 3326, PERSIL: 8165, MUTASI: 3986, PTSL: 384, KOREKSI: 752 };

const REF_AWAL = [
  ['tipe', 'Tanah Kering (D)', ''], ['tipe', 'Tanah Basah(S)', ''],
  ['kelas', 'D-I', ''], ['kelas', 'D-II', ''], ['kelas', 'D-III', ''], ['kelas', 'D-IV', ''],
  ['kelas', 'D-V', ''], ['kelas', 'D-VI', ''], ['kelas', 'D-VII', ''],
  ['kelas', 'S-I', ''], ['kelas', 'S-II', ''], ['kelas', 'S-III', ''], ['kelas', 'S-IV', ''],
  ['kelas', 'S-V', ''], ['kelas', 'S-VI', ''], ['kelas', 'S-VII', ''],
  ['status', 'Aktif', ''], ['status', 'Tidak Aktif', ''],
  ['dusun', 'I', ''], ['dusun', 'II', ''], ['dusun', 'III', ''], ['dusun', 'IV', ''], ['dusun', 'V', ''],
  ['jenis', 'Jual', ''], ['jenis', 'Beli', ''], ['jenis', 'Waris', ''], ['jenis', 'Hibah', ''],
  ['jenis', 'Tukar', ''], ['jenis', 'Pecah', ''], ['jenis', 'Putusan Pengadilan', ''],
  ['jenis', 'Gadai', ''], ['jenis', 'Lainnya', ''],
  ['prioritas', 'Tinggi', ''], ['prioritas', 'Sedang', ''], ['prioritas', 'Rendah', ''],
  ['kata_arah', 'ke', 'Keluar'], ['kata_arah', 'dr', 'Masuk'],
  ['kata_arah', 'di', 'Masuk'], ['kata_arah', 'dg', 'Tukar'],
  ['info', 'Nama Desa', 'MERDEN'], ['info', 'Kecamatan', 'PURWANEGARA'],
  ['info', 'Kabupaten', 'BANJARNEGARA'], ['info', 'Kode Desa PTSL', '11.28.04.02']
];

function setupDatabase() {
  const props = PropertiesService.getScriptProperties();
  let id = prop_('DB_ID');
  let ss;
  if (!id) {
    ss = SpreadsheetApp.create('DB_LETTER_C_MERDEN');
    props.setProperty('DB_ID', ss.getId());
    // Pindahkan ke folder aplikasi bila ada
    const appFolder = prop_('APP_FOLDER_ID');
    if (appFolder) DriveApp.getFileById(ss.getId()).moveTo(DriveApp.getFolderById(appFolder));
    Logger.log('Spreadsheet DB baru dibuat: ' + ss.getUrl());
  } else {
    ss = SpreadsheetApp.openById(id);
  }
  DB_ = ss;

  Object.keys(HEADER).forEach(name => {
    let sh = ss.getSheetByName(name);
    if (!sh) sh = ss.insertSheet(name);
    const h = HEADER[name];
    if (sh.getLastRow() === 0) {
      sh.getRange(1, 1, 1, h.length).setValues([h]);
    }
    sh.getRange(1, 1, 1, h.length).setFontWeight('bold').setBackground('#1F4E78').setFontColor('#FFFFFF');
    sh.setFrozenRows(1);
    aturFormat_(sh, name, sh.getMaxRows());
  });

  // Hapus sheet bawaan yang kosong
  ss.getSheets().forEach(sh => {
    if (!HEADER[sh.getName()] && sh.getLastRow() === 0 && ss.getSheets().length > 1) ss.deleteSheet(sh);
  });

  // REF
  const ref = ss.getSheetByName('REF');
  if (ref.getLastRow() <= 1) ref.getRange(2, 1, REF_AWAL.length, 3).setValues(REF_AWAL);

  // META
  const meta = ss.getSheetByName('META');
  if (meta.getLastRow() <= 1) meta.getRange(2, 1, 1, 2).setValues([['data_version', 1]]);

  // USERS: admin pertama
  const adminEmail = prop_('ADMIN_EMAIL').toLowerCase();
  if (adminEmail) {
    const users = ss.getSheetByName('USERS');
    const ada = users.getLastRow() > 1 &&
      users.getRange(2, 1, users.getLastRow() - 1, 1).getValues().some(r => String(r[0]).toLowerCase() === adminEmail);
    if (!ada) users.appendRow([adminEmail, 'Admin', 'admin', '', true]);
  } else {
    Logger.log('PERINGATAN: ADMIN_EMAIL belum diisi, USERS masih kosong.');
  }

  aturValidasi_(ss);

  // Pemicu backup harian
  const sudah = ScriptApp.getProjectTriggers().some(t => t.getHandlerFunction() === 'backupHarian');
  if (!sudah) ScriptApp.newTrigger('backupHarian').timeBased().everyDays(1).atHour(1).create();

  Logger.log('setupDatabase selesai: ' + ss.getUrl());
}

/** Format teks (@) untuk kolom teks, angka untuk kolom luas/tahun. */
function aturFormat_(sh, name, rows) {
  const h = HEADER[name];
  if (rows < 2) return;
  h.forEach((k, j) => {
    const fmt = KOLOM_ANGKA.indexOf(k) >= 0 ? '0.####' : '@';
    sh.getRange(2, j + 1, rows - 1, 1).setNumberFormat(fmt);
  });
}

function aturValidasi_(ss) {
  const daftar = {};
  REF_AWAL.forEach(r => { (daftar[r[0]] = daftar[r[0]] || []).push(r[1]); });
  const pasang = (sheet, kolom, nilai) => {
    const sh = ss.getSheetByName(sheet);
    const j = HEADER[sheet].indexOf(kolom) + 1;
    const rule = SpreadsheetApp.newDataValidation().requireValueInList(nilai, true).setAllowInvalid(true).build();
    sh.getRange(2, j, sh.getMaxRows() - 1, 1).setDataValidation(rule);
  };
  pasang('PERSIL', 'tipe', daftar.tipe);
  pasang('PERSIL', 'kelas', daftar.kelas);
  pasang('PERSIL', 'status', daftar.status);
  pasang('C', 'dusun', daftar.dusun);
  pasang('MUTASI', 'jenis', daftar.jenis);
  pasang('MUTASI', 'kata', ['ke', 'dr', 'di', 'dg']);
  pasang('KOREKSI', 'prioritas', daftar.prioritas);
  pasang('KOREKSI', 'status', ['Belum', 'Sudah']);
  pasang('USERS', 'peran', PERAN_VALID);
  pasang('USERS', 'dusun', daftar.dusun);
}

/** Jalankan dari editor: memakai Script Property MASTER_ID. */
function jalankanImpor() {
  const id = prop_('MASTER_ID');
  if (!id) throw new Error('Isi Script Property MASTER_ID dengan ID Google Sheet master');
  return imporDariMaster(id);
}

function imporDariMaster(masterSpreadsheetId) {
  const master = SpreadsheetApp.openById(masterSpreadsheetId);
  const ss = db_();
  const waktu = sekarang_();

  const PETA = {
    C: {
      dari: 'MASTER_C',
      kolom: {
        id_c: 'ID_C', nomor_c: 'Nomor C', nama_asli: 'Nama Pemilik (asli)', nama: 'Nama Pemilik (rapi)',
        alamat: 'Alamat (asli)', dusun: 'Dusun / Kebayanan (dibaca dari alamat)', rt: 'RT', rw: 'RW',
        file_scan: 'Nama File Scan', ket_dobel: 'Keterangan Dobel', catatan: 'Catatan Pengetik'
      },
      tetap: { dihapus: false, dibuat_oleh: 'impor', dibuat_pada: waktu }
    },
    PERSIL: {
      dari: 'PERSIL',
      kolom: {
        id_persil: 'ID_PERSIL', nomor_c: 'Nomor C', no_persil: 'No Persil', tipe: 'Tipe Tanah',
        kelas: 'Kelas Tanah (baku)', kelas_asli: 'Kelas (asli)', luas_ha: 'Luas ha (asli)',
        luas_m2: 'Luas m² (asli)', status: 'Status', sebab_asli: 'Sebab & Tanggal Perubahan (asli)',
        catatan: 'Catatan Pengetik'
      },
      tetap: { dihapus: false, dibuat_oleh: 'impor', dibuat_pada: waktu }
    },
    MUTASI: {
      dari: 'MUTASI',
      kolom: {
        id_mutasi: 'ID_MUTASI', id_persil: 'ID_PERSIL', nomor_c: 'Nomor C (persil ini)', no_persil: 'No Persil',
        tanggal: 'Tanggal', tahun: 'Tahun', jenis: 'Jenis Mutasi', kata: 'Kata di Teks',
        nomor_c_lawan: 'Nomor C Lawan', nama_disebut: 'Nama Disebut', luas: 'Luas Disebut (angka di teks)',
        teks_asli: 'Teks Asli', perlu_cek: 'Perlu Cek', catatan: 'Catatan Pengetik'
      },
      tetap: { dihapus: false, dibuat_oleh: 'impor', dibuat_pada: waktu }
    },
    PTSL: {
      dari: 'PTSL_2019',
      kolom: {
        id_ptsl: 'ID', kadus: 'Kadus', tgl_pendataan: 'Tgl Pendataan', pemohon: 'Pemohon', nik: 'NIK',
        tempat_lahir: 'Tempat Lahir', tgl_lahir: 'Tgl Lahir', pekerjaan: 'Pekerjaan', agama: 'Agama',
        alamat: 'Alamat', rt_rw: 'RT/RW', cara_perolehan: 'Cara Perolehan', tahun_perolehan: 'Tahun Perolehan',
        perolehan_dari: 'Perolehan Dari', batas_utara: 'Batas Utara', batas_timur: 'Batas Timur',
        batas_selatan: 'Batas Selatan', batas_barat: 'Batas Barat', jenis_hak: 'Jenis Hak', nop: 'No SPPT / NOP',
        letak_tanah: 'Letak Tanah', rt_rw_tanah: 'RT/RW Tanah', blok: 'Blok', penggunaan: 'Penggunaan',
        njop: 'NJOP per m²', nomor_c: 'Nomor C', persil: 'Persil', kelas_asli: 'Kelas (asli)',
        kelas: 'Kelas (baku)', luas: 'Luas (m²)', nama_pemilik_c: 'Nama Pemilik C (berkas PTSL)', nib: 'NIB',
        berkas: 'No Berkas', pemanfaatan: 'Pemanfaatan', bangunan: 'Bangunan', status_tanah: 'Status Tanah',
        fasum: 'Fasum/Fasos', sengketa: 'Perkara/Sengketa', saksi2: 'Saksi 2', catatan: 'Catatan Pengetik'
      },
      tetap: { tahun: 2019 }
    },
    KOREKSI: {
      dari: 'PERLU_KOREKSI',
      kolom: {
        id_koreksi: r => 'K' + ('00000' + str_(r['no'])).slice(-5),
        sheet: r => ({ MASTER_C: 'C', PTSL_2019: 'PTSL' })[str_(r['sheet'])] || str_(r['sheet']),
        ref_id: 'ID', nomor_c: 'Nomor C', kolom: 'Kolom', nilai: 'Nilai Sekarang', masalah: 'Masalah',
        saran: 'Saran Perbaikan', prioritas: 'Prioritas',
        status: r => str_(r['sudahdicek']) === 'Sudah' ? 'Sudah' : 'Belum',
        catatan: 'Catatan Pengetik'
      },
      tetap: {}
    }
  };

  const laporan = [];
  Object.keys(PETA).forEach(tujuan => {
    const p = PETA[tujuan];
    const src = master.getSheetByName(p.dari);
    if (!src) throw new Error('Sheet master tidak ada: ' + p.dari);
    const sh = ss.getSheetByName(tujuan);
    if (sh.getLastRow() > 1) throw new Error('Sheet ' + tujuan + ' sudah berisi data. Kosongkan dulu bila ingin impor ulang.');

    const v = src.getDataRange().getValues();
    const hk = v[0].map(kunciHeader_);
    const idxDari = nama => {
      const j = hk.indexOf(kunciHeader_(nama));
      if (j < 0) throw new Error('Kolom "' + nama + '" tidak ada di sheet ' + p.dari);
      return j;
    };
    const h = HEADER[tujuan];
    const resep = h.map(k => {
      if (p.kolom[k] === undefined) return { tetap: p.tetap[k] !== undefined ? p.tetap[k] : '' };
      if (typeof p.kolom[k] === 'function') return { fn: p.kolom[k] };
      return { j: idxDari(p.kolom[k]) };
    });

    const out = [];
    for (let i = 1; i < v.length; i++) {
      const r = v[i];
      if (r.every(x => x === '' || x === null)) continue;
      const obj = {};
      hk.forEach((k, j) => { obj[k] = r[j]; });
      out.push(h.map((k, n) => {
        const rc = resep[n];
        let x = rc.fn ? rc.fn(obj) : (rc.j !== undefined ? r[rc.j] : rc.tetap);
        if (isDate_(x)) x = fmtTgl_(x);
        if (KOLOM_ANGKA.indexOf(k) >= 0) return x === '' || x === null ? '' : num_(x);
        if (typeof x === 'boolean') return x;
        return x === null || x === undefined ? '' : String(x).trim();
      }));
    }

    const perlu = out.length + 1;
    if (sh.getMaxRows() < perlu) sh.insertRowsAfter(sh.getMaxRows(), perlu - sh.getMaxRows());
    aturFormat_(sh, tujuan, sh.getMaxRows());
    for (let a = 0; a < out.length; a += 2000) {
      const blok = out.slice(a, a + 2000);
      sh.getRange(2 + a, 1, blok.length, h.length).setValues(blok);
    }
    SpreadsheetApp.flush();
    const cocok = out.length === JUMLAH_HARAPAN[tujuan];
    laporan.push(tujuan + ': ' + out.length + ' baris (harapan ' + JUMLAH_HARAPAN[tujuan] + ') ' + (cocok ? 'COCOK' : 'TIDAK COCOK'));
  });

  aturValidasi_(ss);
  bumpVersion_();
  log_('impor', '', masterSpreadsheetId, '', '', laporan.join('; '), 'sistem');
  const teks = laporan.join('\n');
  Logger.log(teks);
  return teks;
}

/** Kunci header: huruf kecil, hanya a-z0-9 (mis. "Luas m² (asli)" → "luasmasli"). */
function kunciHeader_(s) {
  return String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

/** Uji cepat dari editor: cari "1" memakai sesi admin palsu. */
function ujiCari() {
  Logger.log(JSON.stringify(aksiCari_({ q: '1' }, { peran: 'admin', email: 'uji' })).slice(0, 2000));
}

/** Cek jumlah baris tiap sheet DB dibanding harapan (aman dijalankan berulang). */
function cekJumlah() {
  const ss = db_();
  const out = Object.keys(JUMLAH_HARAPAN).map(n => {
    const sh = ss.getSheetByName(n);
    const jml = sh ? Math.max(0, sh.getLastRow() - 1) : 0;
    return n + ': ' + jml + ' baris (harapan ' + JUMLAH_HARAPAN[n] + ') ' + (jml === JUMLAH_HARAPAN[n] ? 'COCOK' : 'TIDAK COCOK');
  });
  out.push('DB: ' + ss.getUrl());
  Logger.log(out.join('\n'));
  return out.join('\n');
}
