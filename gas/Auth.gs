/**
 * Auth.gs — login email + PIN (tanpa Google Cloud Console), sesi di CacheService, peran.
 *
 * Cara admin memberi/mereset PIN: isi kolom `pin_baru` di sheet USERS (min. 6 karakter).
 * Saat pengguna masuk pertama kali dengan PIN itu, server menyimpannya sebagai hash di
 * `pin_hash` dan mengosongkan `pin_baru`. Pengguna bisa mengganti PIN di menu Lainnya.
 */

const SESI_TTL = 21600;      // 6 jam, batas maksimum CacheService
const PERAN_VALID = ['admin', 'operator', 'kadus', 'pimpinan'];
const PIN_MIN = 6;
const GAGAL_MAKS = 5;        // percobaan salah sebelum dikunci
const KUNCI_DETIK = 900;     // dikunci 15 menit

// Sesi yang sedang berjalan pada eksekusi ini (dipakai log_)
let SESI_ = null;

function prop_(k) {
  return PropertiesService.getScriptProperties().getProperty(k) || '';
}

/** Garam rahasia untuk hash PIN; dibuat otomatis sekali dan disimpan di Script Properties. */
function garam_() {
  const p = PropertiesService.getScriptProperties();
  let g = p.getProperty('PIN_SALT');
  if (!g) { g = Utilities.getUuid() + Utilities.getUuid(); p.setProperty('PIN_SALT', g); }
  return g;
}

function hashPin_(email, pin) {
  const bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,
    garam_() + '|' + String(email).toLowerCase() + '|' + String(pin), Utilities.Charset.UTF_8);
  return Utilities.base64Encode(bytes);
}

/** Pastikan sheet USERS punya kolom pin_hash & pin_baru (untuk DB yang dibuat sebelum login PIN). */
function pastikanKolomUsers_() {
  const sh = db_().getSheetByName('USERS');
  const h = sh.getRange(1, 1, 1, Math.max(1, sh.getLastColumn())).getValues()[0].map(String);
  const kurang = HEADER.USERS.filter(k => h.indexOf(k) < 0);
  if (kurang.length) {
    sh.getRange(1, h.length + 1, 1, kurang.length).setValues([kurang])
      .setFontWeight('bold').setBackground('#1F4E78').setFontColor('#FFFFFF');
    sh.getRange(2, h.length + 1, sh.getMaxRows() - 1, kurang.length).setNumberFormat('@'); // PIN & username tetap teks (angka 0 di depan aman)
    delete MEMO_.USERS;
  }
  return sh;
}

function aksiLogin_(data) {
  // `user` = username ATAU email (kolom username / email di sheet USERS)
  const ident = str_(data.user || data.email).toLowerCase();
  const pin = String(data.pin || '');
  if (!ident || !pin) throw err_('VALIDATION', 'Username/email dan PIN wajib diisi');

  const cache = CacheService.getScriptCache();
  const kunciGagal = 'gagal_' + ident;
  const jmlGagal = Number(cache.get(kunciGagal) || 0);
  if (jmlGagal >= GAGAL_MAKS) {
    throw err_('FORBIDDEN', 'Terlalu banyak PIN salah. Coba lagi 15 menit lagi.');
  }

  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const sh = pastikanKolomUsers_();
    const users = readSheet_('USERS');
    const user = users.find(u => isTrue_(u.aktif) &&
      (str_(u.email).toLowerCase() === ident || (str_(u.username) !== '' && str_(u.username).toLowerCase() === ident)));
    const peran = user ? str_(user.peran).toLowerCase() : '';
    // Email baris pengguna = kunci sesi & hash PIN (tetap sama walau masuk pakai username)
    const email = user ? str_(user.email).toLowerCase() : ident;

    let cocok = false;
    if (user && PERAN_VALID.indexOf(peran) >= 0) {
      const hash = hashPin_(email, pin);
      if (str_(user.pin_hash) && str_(user.pin_hash) === hash) {
        cocok = true;
      } else if (str_(user.pin_baru) && str_(user.pin_baru) === pin) {
        if (pin.length < PIN_MIN) throw err_('VALIDATION', 'PIN di sheet USERS minimal ' + PIN_MIN + ' karakter. Hubungi admin.');
        // PIN sementara dari admin → simpan sebagai hash, kosongkan teks asli
        const kol = HEADER_USERS_IDX_(sh);
        sh.getRange(user._row, kol.pin_hash).setValue(hash);
        sh.getRange(user._row, kol.pin_baru).setValue('');
        log_('pin_diaktifkan', 'USERS', email, 'pin_hash', '', '(disembunyikan)', email);
        cocok = true;
      }
    }

    if (!cocok) {
      cache.put(kunciGagal, String(jmlGagal + 1), KUNCI_DETIK);
      log_('login_ditolak', 'USERS', email, '', '', user ? 'PIN salah' : 'tidak terdaftar / tidak aktif', email);
      // Pesan sama untuk email tak terdaftar & PIN salah, agar daftar pengguna tidak bisa ditebak
      throw err_('FORBIDDEN', 'Username/email atau PIN salah, atau akun belum didaftarkan — hubungi admin desa');
    }

    cache.remove(kunciGagal);
    const token = Utilities.getUuid();
    const sesi = { email: email, nama: str_(user.nama) || email, peran: peran, dusun: str_(user.dusun) };
    cache.put('sess_' + token, JSON.stringify(sesi), SESI_TTL);
    tambahIndeksSesi_(email, token);
    log_('login', 'USERS', email, '', '', 'berhasil', email);
    return { token: token, nama: sesi.nama, peran: sesi.peran, dusun: sesi.dusun, exp: Date.now() + SESI_TTL * 1000 };
  } finally {
    lock.releaseLock();
  }
}

/** Nomor kolom (1-based) di sheet USERS menurut header. */
function HEADER_USERS_IDX_(sh) {
  const h = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(String);
  const o = {};
  h.forEach((k, i) => { o[k] = i + 1; });
  return o;
}

/** Pengguna mengganti PIN sendiri. */
function aksiGantiPin_(data, sesi) {
  const lama = String(data.pin_lama || ''), baru = String(data.pin_baru || '');
  if (baru.length < PIN_MIN) throw err_('VALIDATION', 'PIN baru minimal ' + PIN_MIN + ' karakter');
  if (baru === lama) throw err_('VALIDATION', 'PIN baru harus berbeda dari PIN lama');
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const sh = pastikanKolomUsers_();
    const user = readSheet_('USERS').find(u => str_(u.email).toLowerCase() === sesi.email && isTrue_(u.aktif));
    if (!user || str_(user.pin_hash) !== hashPin_(sesi.email, lama)) throw err_('VALIDATION', 'PIN lama salah');
    const kol = HEADER_USERS_IDX_(sh);
    sh.getRange(user._row, kol.pin_hash).setValue(hashPin_(sesi.email, baru));
    sh.getRange(user._row, kol.pin_baru).setValue('');
    log_('ganti_pin', 'USERS', sesi.email, 'pin_hash', '(disembunyikan)', '(disembunyikan)');
    return {};
  } finally {
    lock.releaseLock();
  }
}

/** Wajib dipanggil sebelum setiap aksi selain login. */
function requireSession_(token) {
  if (!token) throw err_('NO_SESSION', 'Belum masuk');
  const raw = CacheService.getScriptCache().get('sess_' + token);
  if (!raw) throw err_('SESSION_EXPIRED', 'Sesi habis, silakan masuk lagi');
  SESI_ = JSON.parse(raw);
  SESI_.token = token;
  return SESI_;
}

function aksiLogout_(data, sesi) {
  CacheService.getScriptCache().remove('sess_' + sesi.token);
  log_('logout', 'USERS', sesi.email, '', '', '', '');
  return {};
}

function aksiMe_(data, sesi) {
  return { email: sesi.email, nama: sesi.nama, peran: sesi.peran, dusun: sesi.dusun };
}

/** Simpan daftar token per email agar admin bisa mencabut semua sesi. */
function tambahIndeksSesi_(email, token) {
  const cache = CacheService.getScriptCache();
  const key = 'sess_index_' + email;
  let daftar = [];
  try { daftar = JSON.parse(cache.get(key) || '[]'); } catch (e) { daftar = []; }
  daftar.push(token);
  if (daftar.length > 30) daftar = daftar.slice(-30);
  cache.put(key, JSON.stringify(daftar), SESI_TTL);
}

/** Cabut semua sesi seorang pengguna (dipakai aksi cabutSesi di Tahap 3). */
function cabutSesiEmail_(email) {
  const cache = CacheService.getScriptCache();
  const key = 'sess_index_' + String(email).toLowerCase();
  let daftar = [];
  try { daftar = JSON.parse(cache.get(key) || '[]'); } catch (e) { daftar = []; }
  if (daftar.length) cache.removeAll(daftar.map(t => 'sess_' + t));
  cache.remove(key);
  return daftar.length;
}

/** NIK tersamar untuk selain admin: 3304010101900001 → 3304 01•• •••• 0001 (contoh tiruan) */
function maskNik_(nik, sesi) {
  const s = str_(nik);
  if (!s) return '';
  if (sesi && sesi.peran === 'admin') return s;
  const d = s.replace(/\D/g, '');
  if (d.length !== 16) return '••••';
  return d.slice(0, 4) + ' ' + d.slice(4, 6) + '•• •••• ' + d.slice(12);
}
