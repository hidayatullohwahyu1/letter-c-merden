/**
 * Data.gs — akses spreadsheet DB, cache ringkasan, LOG, versi data.
 */

const HEADER = {
  C: ['id_c', 'nomor_c', 'nama_asli', 'nama', 'alamat', 'dusun', 'rt', 'rw', 'file_scan', 'ket_dobel', 'catatan',
      'dihapus', 'dibuat_oleh', 'dibuat_pada', 'diubah_oleh', 'diubah_pada'],
  PERSIL: ['id_persil', 'nomor_c', 'no_persil', 'tipe', 'kelas', 'kelas_asli', 'luas_ha', 'luas_m2', 'status',
           'sebab_asli', 'catatan', 'dihapus', 'dibuat_oleh', 'dibuat_pada', 'diubah_oleh', 'diubah_pada'],
  MUTASI: ['id_mutasi', 'id_persil', 'nomor_c', 'no_persil', 'tanggal', 'tahun', 'jenis', 'kata', 'nomor_c_lawan',
           'nama_disebut', 'luas', 'teks_asli', 'perlu_cek', 'catatan', 'dihapus', 'dibuat_oleh', 'dibuat_pada'],
  PTSL: ['id_ptsl', 'tahun', 'kadus', 'tgl_pendataan', 'pemohon', 'nik', 'tempat_lahir', 'tgl_lahir', 'pekerjaan',
         'agama', 'alamat', 'rt_rw', 'cara_perolehan', 'tahun_perolehan', 'perolehan_dari', 'batas_utara',
         'batas_timur', 'batas_selatan', 'batas_barat', 'jenis_hak', 'nop', 'letak_tanah', 'rt_rw_tanah', 'blok',
         'penggunaan', 'njop', 'nomor_c', 'persil', 'kelas_asli', 'kelas', 'luas', 'nama_pemilik_c', 'nib', 'berkas',
         'pemanfaatan', 'bangunan', 'status_tanah', 'fasum', 'sengketa', 'saksi2', 'catatan'],
  KOREKSI: ['id_koreksi', 'sheet', 'ref_id', 'nomor_c', 'kolom', 'nilai', 'masalah', 'saran', 'prioritas', 'status',
            'dicek_oleh', 'dicek_pada', 'catatan', 'kode_aturan'],
  LOG: ['id_log', 'waktu', 'email', 'aksi', 'sheet', 'ref_id', 'kolom', 'lama', 'baru'],
  USERS: ['email', 'nama', 'peran', 'dusun', 'aktif', 'pin_hash', 'pin_baru', 'username'],
  REF: ['daftar', 'nilai', 'keterangan'],
  META: ['kunci', 'nilai']
};

// Kolom yang disimpan sebagai angka; selainnya teks (format @)
const KOLOM_ANGKA = ['luas_ha', 'luas_m2', 'tahun', 'luas', 'njop'];

let DB_ = null;
const MEMO_ = {};

function db_() {
  if (!DB_) {
    const id = prop_('DB_ID');
    if (!id) throw err_('ERROR', 'DB_ID belum diisi di Script Properties');
    DB_ = SpreadsheetApp.openById(id);
  }
  return DB_;
}

function str_(v) {
  return v === null || v === undefined ? '' : String(v).trim();
}
function isTrue_(v) {
  return v === true || String(v).toUpperCase() === 'TRUE';
}
function num_(v) {
  if (typeof v === 'number') return v;
  let s = String(v || '').trim();
  if (s.indexOf(',') >= 0) s = s.replace(/\./g, '').replace(',', '.'); // format Indonesia 1.234,5
  const n = Number(s);
  return isNaN(n) ? 0 : n;
}
function isDate_(x) {
  return Object.prototype.toString.call(x) === '[object Date]' && !isNaN(x.getTime());
}
function fmtTgl_(d) {
  return Utilities.formatDate(d, 'Asia/Jakarta', 'yyyy-MM-dd');
}
function sekarang_() {
  return Utilities.formatDate(new Date(), 'Asia/Jakarta', "yyyy-MM-dd'T'HH:mm:ss");
}

/** Baca sheet → array objek (memo per eksekusi). Properti _row = nomor baris di sheet. */
function readSheet_(name) {
  if (MEMO_[name]) return MEMO_[name];
  const sh = db_().getSheetByName(name);
  if (!sh) throw err_('ERROR', 'Sheet ' + name + ' tidak ada. Jalankan setupDatabase().');
  const v = sh.getDataRange().getValues();
  const h = v[0].map(String);
  const out = [];
  for (let i = 1; i < v.length; i++) {
    const r = v[i];
    let kosong = true;
    for (let j = 0; j < r.length; j++) if (r[j] !== '') { kosong = false; break; }
    if (kosong) continue;
    const o = { _row: i + 1 };
    for (let j = 0; j < h.length; j++) {
      const x = r[j];
      o[h[j]] = isDate_(x) ? fmtTgl_(x) : x;
    }
    out.push(o);
  }
  MEMO_[name] = out;
  return out;
}

/** Hapus properti internal (_row) sebelum dikirim ke klien. */
function bersih_(o) {
  const r = {};
  Object.keys(o).forEach(k => { if (k.charAt(0) !== '_') r[k] = o[k]; });
  return r;
}

/** Daftar REF → {tipe, kelas, status, dusun, jenis, prioritas, arah:{kata:arah}, info:{}} */
function readRef_() {
  if (MEMO_._ref) return MEMO_._ref;
  try {
    const c = CacheService.getScriptCache().get('ref_v1');
    if (c) return (MEMO_._ref = JSON.parse(c));
  } catch (e) { /* baca dari sheet */ }
  const ref = { tipe: [], kelas: [], status: [], dusun: [], jenis: [], prioritas: [], arah: {}, info: {} };
  readSheet_('REF').forEach(r => {
    const d = str_(r.daftar), n = str_(r.nilai);
    if (d === 'kata_arah') ref.arah[n.toLowerCase()] = str_(r.keterangan);
    else if (d === 'info') ref.info[n] = str_(r.keterangan);
    else if (ref[d]) ref[d].push(n);
  });
  MEMO_._ref = ref;
  try { CacheService.getScriptCache().put('ref_v1', JSON.stringify(ref), 21600); } catch (e) { /* abaikan */ }
  return ref;
}

function normKelas_(v) {
  const k = String(v || '').toUpperCase().replace(/[\s.\-]/g, '');
  const m = k.match(/^([DS])(VIII|VII|VI|IV|V|III|II|I|[1-8])$/);
  if (!m) return null;
  const r = { 1: 'I', 2: 'II', 3: 'III', 4: 'IV', 5: 'V', 6: 'VI', 7: 'VII', 8: 'VIII' }[m[2]] || m[2];
  return m[1] + '-' + r;
}

function luasTotal_(p) {
  return num_(p.luas_ha) * 10000 + num_(p.luas_m2);
}

/* ---------- Cache ringkasan (dipotong per ±90 KB) ---------- */

// Batas nilai CacheService 100 KB (byte). Potong per 50.000 karakter agar aman untuk huruf non-ASCII.
const POTONG = 50000;

function putBig_(key, obj, ttl) {
  const s = JSON.stringify(obj);
  const cache = CacheService.getScriptCache();
  const parts = {};
  let n = 0;
  for (let i = 0; i < s.length; i += POTONG) parts[key + '_' + (n++)] = s.substring(i, i + POTONG);
  parts[key + '_n'] = String(n);
  cache.putAll(parts, ttl || 21600);
}

function getBig_(key) {
  const cache = CacheService.getScriptCache();
  const n = Number(cache.get(key + '_n') || 0);
  if (!n) return null;
  const keys = [];
  for (let i = 0; i < n; i++) keys.push(key + '_' + i);
  const got = cache.getAll(keys);
  let s = '';
  for (let i = 0; i < n; i++) {
    if (got[keys[i]] === undefined) return null;
    s += got[keys[i]];
  }
  try { return JSON.parse(s); } catch (e) { return null; }
}

function delBig_(key) {
  const cache = CacheService.getScriptCache();
  const n = Number(cache.get(key + '_n') || 0);
  const keys = [key + '_n'];
  for (let i = 0; i < Math.max(n, 20); i++) keys.push(key + '_' + i);
  cache.removeAll(keys);
}

/**
 * Ringkasan untuk pencarian cepat:
 *  c: [[id_c, nomor_c, nama, dusun, file_scan]]
 *  p: {nomor_c: {n, a, l, la, ps, t, k}}  (jml, jml aktif, luas total, luas aktif, no persil, tipe, kelas)
 *  hit: {NOMOR_C_UPPER: jumlah record} untuk tanda dobel
 */
function ringkasan_() {
  if (MEMO_._idx) return MEMO_._idx;
  let idx = getBig_('idx_c');
  if (!idx) {
    const c = [], hit = {}, p = {};
    readSheet_('C').forEach(r => {
      if (isTrue_(r.dihapus)) return;
      const nc = str_(r.nomor_c);
      c.push([str_(r.id_c), nc, str_(r.nama) || str_(r.nama_asli), str_(r.dusun), str_(r.file_scan)]);
      const u = nc.toUpperCase();
      hit[u] = (hit[u] || 0) + 1;
    });
    readSheet_('PERSIL').forEach(r => {
      if (isTrue_(r.dihapus)) return;
      const u = str_(r.nomor_c).toUpperCase();
      const s = p[u] || (p[u] = { n: 0, a: 0, l: 0, la: 0, ps: [], t: '', k: [] });
      const lt = luasTotal_(r);
      const aktif = str_(r.status) === 'Aktif';
      s.n++; s.l += lt;
      if (aktif) { s.a++; s.la += lt; }
      s.ps.push(str_(r.no_persil).toUpperCase());
      const kel = str_(r.kelas);
      const huruf = kel.charAt(0) || (str_(r.tipe).indexOf('(S)') >= 0 ? 'S' : 'D');
      if (s.t.indexOf(huruf) < 0) s.t += huruf;
      if (kel && s.k.indexOf(kel) < 0) s.k.push(kel);
    });
    idx = { c: c, p: p, hit: hit };
    putBig_('idx_c', idx);
  }
  MEMO_._idx = idx;
  return idx;
}

function statusC_(s) {
  if (!s || !s.n) return 'Tanpa persil';
  return s.a > 0 ? 'Aktif' : 'Habis/Mutasi';
}

/* ---------- Versi data & LOG ---------- */

function bumpVersion_() {
  const sh = db_().getSheetByName('META');
  const v = sh.getDataRange().getValues();
  let baris = -1, versi = 0;
  for (let i = 1; i < v.length; i++) if (v[i][0] === 'data_version') { baris = i + 1; versi = Number(v[i][1]) || 0; }
  versi++;
  if (baris > 0) sh.getRange(baris, 2).setValue(versi);
  else sh.appendRow(['data_version', versi]);
  delBig_('idx_c');
  delete MEMO_._idx;
  return versi;
}

/** Tulis satu baris LOG (hanya append). */
function log_(aksi, sheet, refId, kolom, lama, baru, email) {
  try {
    const sh = db_().getSheetByName('LOG');
    if (!sh) return;
    const id = 'L' + Utilities.formatDate(new Date(), 'Asia/Jakarta', 'yyMMddHHmmss') + Math.floor(Math.random() * 1000);
    const em = email || (SESI_ ? SESI_.email : '');
    sh.appendRow([id, sekarang_(), em, aksi, sheet || '', refId || '', kolom || '',
                  lama === undefined ? '' : String(lama), baru === undefined ? '' : String(baru)]);
  } catch (e) {
    console.error('Gagal menulis LOG: ' + e);
  }
}

/** Untuk kadus: apakah record dengan dusun ini boleh dilihat? Dusun kosong boleh (agar bisa dilengkapi). */
function bolehDusun_(sesi, dusun) {
  if (!sesi || sesi.peran !== 'kadus') return true;
  const d = str_(dusun);
  return d === '' || d === str_(sesi.dusun);
}

/* ---------- Penulisan data (Tahap 2) ---------- */

const PREFIX_ID = { C: ['id_c', 'C'], PERSIL: ['id_persil', 'P'], MUTASI: ['id_mutasi', 'M'], KOREKSI: ['id_koreksi', 'K'] };

/** Jalankan fn di dalam LockService (maks. tunggu 20 dtk) agar 5 operator bisa menulis bersamaan. */
function denganKunci_(fn) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) throw err_('ERROR', 'Server sedang sibuk, coba lagi sebentar');
  // Baca ulang data setelah kunci didapat, agar tidak menimpa tulisan operator lain
  Object.keys(MEMO_).forEach(k => { if (k !== 'USERS') delete MEMO_[k]; });
  try { return fn(); } finally { lock.releaseLock(); }
}

/** ID baru = angka terbesar + 1 (termasuk yang dihapus; tidak pernah dipakai ulang). */
function nextId_(rows, idKey, prefix) {
  let maks = 0;
  rows.forEach(r => {
    const m = String(r[idKey] || '').match(/(\d+)$/);
    if (m) maks = Math.max(maks, Number(m[1]));
  });
  return prefix + ('00000' + (maks + 1)).slice(-5);
}

function formatBaris_(name) {
  return HEADER[name].map(k => KOLOM_ANGKA.indexOf(k) >= 0 ? '0.####' : '@');
}

function nilaiSel_(name, k, v) {
  if (KOLOM_ANGKA.indexOf(k) >= 0) return v === '' || v === null || v === undefined ? '' : num_(v);
  if (typeof v === 'boolean') return v;
  return v === null || v === undefined ? '' : String(v).trim();
}

/**
 * Tambah/ubah satu baris. data[idKey] kosong → baris baru.
 * opts.cekKonflik: bandingkan data.diubah_pada_lama dengan isi sheet → CONFLICT.
 * Menulis LOG per kolom yang berubah. Harus dipanggil di dalam denganKunci_().
 * @return {{id:string, baru:boolean, berubah:Array, obj:Object}}
 */
function simpanBaris_(name, data, opts) {
  opts = opts || {};
  const idKey = PREFIX_ID[name][0], prefix = PREFIX_ID[name][1];
  const sh = db_().getSheetByName(name);
  const h = HEADER[name];
  const rows = readSheet_(name); // memo per eksekusi; diperbarui di bawah setelah menulis
  const id = str_(data[idKey]);
  const waktu = sekarang_();
  const email = SESI_ ? SESI_.email : 'sistem';

  if (!id) {
    const baruId = nextId_(rows, idKey, prefix);
    const obj = {};
    h.forEach(k => { obj[k] = data[k] !== undefined ? data[k] : ''; });
    obj[idKey] = baruId;
    if (h.indexOf('dihapus') >= 0) obj.dihapus = false;
    if (h.indexOf('dibuat_oleh') >= 0) { obj.dibuat_oleh = email; obj.dibuat_pada = waktu; }
    const r = sh.getLastRow() + 1;
    if (r > sh.getMaxRows()) sh.insertRowsAfter(sh.getMaxRows(), 200);
    sh.getRange(r, 1, 1, h.length).setNumberFormats([formatBaris_(name)])
      .setValues([h.map(k => nilaiSel_(name, k, obj[k]))]);
    log_('tambah', name, baruId, '', '', ringkasObj_(obj, h));
    perbaruiIndeks_(name, r, null, obj);
    rows.push(Object.assign({ _row: r }, obj));
    return { id: baruId, baru: true, berubah: [], obj: obj };
  }

  const row = rows.find(x => str_(x[idKey]) === id);
  if (!row) throw err_('NOT_FOUND', name + ' ' + id + ' tidak ditemukan');
  if (opts.cekKonflik && data.diubah_pada_lama !== undefined && str_(row.diubah_pada) !== str_(data.diubah_pada_lama)) {
    throw err_('CONFLICT', 'Data sudah diubah orang lain. Muat ulang untuk melihat perubahan terbaru.');
  }
  const obj = {};
  h.forEach(k => { obj[k] = row[k]; });
  const berubah = [];
  Object.keys(data).forEach(k => {
    if (h.indexOf(k) < 0 || k === idKey || /^(dibuat_|diubah_)/.test(k)) return;
    const baru = nilaiSel_(name, k, data[k]);
    if (str_(row[k]) !== str_(baru)) { berubah.push([k, row[k], baru]); obj[k] = baru; }
  });
  if (!berubah.length) return { id: id, baru: false, berubah: [], obj: obj };
  if (h.indexOf('diubah_oleh') >= 0) { obj.diubah_oleh = email; obj.diubah_pada = waktu; }
  sh.getRange(row._row, 1, 1, h.length).setNumberFormats([formatBaris_(name)])
    .setValues([h.map(k => nilaiSel_(name, k, obj[k]))]);
  berubah.forEach(b => log_(opts.aksi || 'ubah', name, id, b[0], b[1], b[2]));
  perbaruiIndeks_(name, row._row, row, obj);
  Object.assign(row, obj);
  return { id: id, baru: false, berubah: berubah, obj: obj };
}

function ringkasObj_(obj, h) {
  return h.filter(k => obj[k] !== '' && obj[k] !== undefined && !/^(dibuat_|diubah_|dihapus)/.test(k))
    .map(k => k + '=' + obj[k]).join('; ').slice(0, 500);
}

/* ---------- Baca cepat per nilai (tanpa membaca seluruh sheet) ---------- */

// Kolom yang diindeks: nilai (huruf besar) → daftar nomor baris. Disimpan di CacheService ('ridx').
const RIDX = {
  C: ['id_c', 'nomor_c'], PERSIL: ['id_persil', 'nomor_c'], MUTASI: ['id_persil', 'nomor_c', 'nomor_c_lawan'],
  PTSL: ['nomor_c'], KOREKSI: ['nomor_c']
};
const RIDX_TTL = 1800; // 30 menit; indeks juga diperbarui setiap simpan

function kolomHuruf_(n) {
  let s = '';
  while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); }
  return s;
}

/**
 * Baca beberapa rentang sekaligus dalam SATU panggilan (Sheets API bawaan Apps Script).
 * daftar: [{a1:"'PERSIL'!A5:P9", baris, kolom}] → array nilai 2D (dipadatkan ke baris × kolom).
 * Bila layanan Sheets tidak tersedia, jatuh ke getValues per rentang.
 */
function bacaRentang_(daftar) {
  if (!daftar.length) return [];
  const pad = (v, d) => {
    const out = [];
    const nb = d.baris || v.length;
    for (let r = 0; r < nb; r++) {
      const row = v[r] || [];
      const o = [];
      for (let c = 0; c < d.kolom; c++) o.push(row[c] === undefined || row[c] === null ? '' : row[c]);
      out.push(o);
    }
    return out;
  };
  try {
    const res = Sheets.Spreadsheets.Values.batchGet(prop_('DB_ID'), {
      ranges: daftar.map(d => d.a1), valueRenderOption: 'UNFORMATTED_VALUE', dateTimeRenderOption: 'FORMATTED_STRING'
    });
    return res.valueRanges.map((vr, i) => pad(vr.values || [], daftar[i]));
  } catch (e) {
    console.warn('batchGet tidak tersedia, pakai getValues: ' + e);
    return daftar.map(d => {
      const m = d.a1.match(/^'(.+)'!([A-Z]+)(\d+):([A-Z]+)(\d*)$/);
      const sh = db_().getSheetByName(m[1]);
      const kol0 = huruf2kolom_(m[2]);
      const a = Number(m[3]);
      const z = m[5] ? Number(m[5]) : sh.getLastRow();
      if (z < a) return [];
      return pad(sh.getRange(a, kol0, z - a + 1, d.kolom).getValues(), d);
    });
  }
}

function huruf2kolom_(s) {
  let n = 0;
  for (let i = 0; i < s.length; i++) n = n * 26 + (s.charCodeAt(i) - 64);
  return n;
}

function indeksBaris_() {
  if (MEMO_._ridx) return MEMO_._ridx;
  let ix = getBig_('ridx');
  if (!ix) {
    const cols = [];
    Object.keys(RIDX).forEach(name => RIDX[name].forEach(kol => cols.push({ name: name, kol: kol })));
    const vals = bacaRentang_(cols.map(c => {
      const L = kolomHuruf_(HEADER[c.name].indexOf(c.kol) + 1);
      return { a1: "'" + c.name + "'!" + L + '2:' + L, kolom: 1 };
    }));
    ix = {};
    cols.forEach((c, i) => {
      const m = {};
      vals[i].forEach((r, j) => {
        const u = str_(r[0]).toUpperCase();
        if (u) (m[u] = m[u] || []).push(j + 2);
      });
      (ix[c.name] = ix[c.name] || {})[c.kol] = m;
    });
    putBig_('ridx', ix, RIDX_TTL);
  }
  MEMO_._ridx = ix;
  return ix;
}

/** Perbarui indeks untuk satu baris yang baru ditulis (lama=null untuk baris baru). */
function perbaruiIndeks_(name, rowNum, lama, baru) {
  if (!RIDX[name]) return;
  const ix = MEMO_._ridx || getBig_('ridx');
  if (!ix || !ix[name]) return; // belum ada → dibangun saat dibutuhkan
  let ubah = false;
  RIDX[name].forEach(kol => {
    const m = ix[name][kol] || (ix[name][kol] = {});
    const a = lama ? str_(lama[kol]).toUpperCase() : '';
    const b = str_(baru[kol]).toUpperCase();
    if (lama && a === b) return;
    if (a && m[a]) { m[a] = m[a].filter(n => n !== rowNum); if (!m[a].length) delete m[a]; }
    if (b) { m[b] = (m[b] || []).filter(n => n !== rowNum).concat([rowNum]).sort((x, y) => x - y); }
    ubah = true;
  });
  if (ubah) { putBig_('ridx', ix, RIDX_TTL); MEMO_._ridx = ix; }
}

function hapusIndeksBaris_() {
  delBig_('ridx');
  delete MEMO_._ridx;
}

function keObjek_(name, r, rowNum) {
  const o = { _row: rowNum };
  HEADER[name].forEach((k, x) => { const v = r[x]; o[k] = isDate_(v) ? fmtTgl_(v) : v; });
  return o;
}

/**
 * Ambil baris untuk beberapa permintaan sekaligus: [{name, kolom, nilai}] → [[baris…], …].
 * Pakai memo bila sheet sudah dibaca penuh; selain itu indeks cache + satu batchGet.
 */
function ambilBanyak_(perm) {
  const hasil = perm.map(() => null);
  const butuh = [];
  const pakaiIndeks = perm.some(p => !MEMO_[p.name] && RIDX[p.name] && RIDX[p.name].indexOf(p.kolom) >= 0 && str_(p.nilai));
  const ix = pakaiIndeks ? indeksBaris_() : null;
  perm.forEach((p, i) => {
    const U = str_(p.nilai).toUpperCase();
    if (!U) { hasil[i] = []; return; }
    if (MEMO_[p.name]) { hasil[i] = MEMO_[p.name].filter(r => str_(r[p.kolom]).toUpperCase() === U); return; }
    if (ix && ix[p.name] && ix[p.name][p.kolom]) {
      butuh.push({ i: i, name: p.name, kolom: p.kolom, U: U, rows: (ix[p.name][p.kolom][U] || []).slice().sort((a, b) => a - b) });
      return;
    }
    hasil[i] = cariBarisTF_(p.name, p.kolom, p.nilai);
  });
  const rentang = [];
  butuh.forEach(b => {
    b.blok = [];
    b.rows.forEach(n => {
      const k = b.blok[b.blok.length - 1];
      if (k && n - k[1] < 30) k[1] = n; else b.blok.push([n, n]);
    });
    b.blok.forEach(k => {
      k.idx = rentang.length;
      const lebar = HEADER[b.name].length;
      rentang.push({ a1: "'" + b.name + "'!A" + k[0] + ':' + kolomHuruf_(lebar) + k[1], baris: k[1] - k[0] + 1, kolom: lebar });
    });
  });
  const vals = bacaRentang_(rentang);
  butuh.forEach(b => {
    const out = [];
    b.blok.forEach(k => vals[k.idx].forEach((r, j) => {
      const o = keObjek_(b.name, r, k[0] + j);
      if (str_(o[b.kolom]).toUpperCase() === b.U) out.push(o); // abaikan baris yang indeksnya basi
    }));
    hasil[b.i] = out;
  });
  return hasil;
}

function cariBaris_(name, kolom, nilai) {
  return ambilBanyak_([{ name: name, kolom: kolom, nilai: nilai }])[0];
}

/** Cadangan: cari dengan TextFinder untuk kolom yang tidak diindeks. */
function cariBarisTF_(name, kolom, nilai) {
  const sh = db_().getSheetByName(name);
  const j = HEADER[name].indexOf(kolom) + 1;
  const last = sh.getLastRow();
  if (!j || last < 2) return [];
  const U = str_(nilai).toUpperCase();
  return sh.getRange(2, j, last - 1, 1).createTextFinder(str_(nilai)).matchEntireCell(true).matchCase(false).findAll()
    .map(r => r.getRow())
    .map(n => keObjek_(name, sh.getRange(n, 1, 1, HEADER[name].length).getValues()[0], n))
    .filter(o => str_(o[kolom]).toUpperCase() === U);
}
