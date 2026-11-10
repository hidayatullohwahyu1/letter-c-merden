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
  USERS: ['email', 'nama', 'peran', 'dusun', 'aktif'],
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
  const ref = { tipe: [], kelas: [], status: [], dusun: [], jenis: [], prioritas: [], arah: {}, info: {} };
  readSheet_('REF').forEach(r => {
    const d = str_(r.daftar), n = str_(r.nilai);
    if (d === 'kata_arah') ref.arah[n.toLowerCase()] = str_(r.keterangan);
    else if (d === 'info') ref.info[n] = str_(r.keterangan);
    else if (ref[d]) ref[d].push(n);
  });
  MEMO_._ref = ref;
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

function putBig_(key, obj) {
  const s = JSON.stringify(obj);
  const cache = CacheService.getScriptCache();
  const parts = {};
  let n = 0;
  for (let i = 0; i < s.length; i += POTONG) parts[key + '_' + (n++)] = s.substring(i, i + POTONG);
  parts[key + '_n'] = String(n);
  cache.putAll(parts, 21600);
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
