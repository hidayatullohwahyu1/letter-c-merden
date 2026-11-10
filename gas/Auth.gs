/**
 * Auth.gs — login Google (ID token), sesi di CacheService, peran.
 */

const SESI_TTL = 21600; // 6 jam, batas maksimum CacheService
const PERAN_VALID = ['admin', 'operator', 'kadus', 'pimpinan'];

// Sesi yang sedang berjalan pada eksekusi ini (dipakai log_)
let SESI_ = null;

function prop_(k) {
  return PropertiesService.getScriptProperties().getProperty(k) || '';
}

function aksiLogin_(data) {
  const idToken = str_(data.idToken);
  if (!idToken) throw err_('VALIDATION', 'ID token Google kosong');
  const clientId = prop_('GOOGLE_CLIENT_ID');
  if (!clientId) throw err_('ERROR', 'GOOGLE_CLIENT_ID belum diisi di Script Properties');

  const r = UrlFetchApp.fetch(
    'https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(idToken),
    { muteHttpExceptions: true }
  );
  if (r.getResponseCode() !== 200) {
    log_('login_ditolak', 'USERS', '', '', '', 'token tidak sah', '');
    throw err_('FORBIDDEN', 'Token Google tidak sah. Coba masuk ulang.');
  }
  const info = JSON.parse(r.getContentText());
  const email = str_(info.email).toLowerCase();
  const kedaluwarsa = Number(info.exp) * 1000 < Date.now();
  if (info.aud !== clientId || String(info.email_verified) !== 'true' || kedaluwarsa) {
    log_('login_ditolak', 'USERS', email, '', '', 'aud/email_verified/exp tidak sah', email);
    throw err_('FORBIDDEN', 'Token Google tidak sah. Coba masuk ulang.');
  }

  const user = readSheet_('USERS').find(u => str_(u.email).toLowerCase() === email && isTrue_(u.aktif));
  const peran = user ? str_(user.peran).toLowerCase() : '';
  if (!user || PERAN_VALID.indexOf(peran) < 0) {
    log_('login_ditolak', 'USERS', email, '', '', 'tidak terdaftar / tidak aktif', email);
    throw err_('FORBIDDEN', 'Akses ditolak — hubungi admin desa');
  }

  const token = Utilities.getUuid();
  const sesi = { email: email, nama: str_(user.nama) || info.name || email, peran: peran, dusun: str_(user.dusun) };
  const cache = CacheService.getScriptCache();
  cache.put('sess_' + token, JSON.stringify(sesi), SESI_TTL);
  tambahIndeksSesi_(email, token);

  log_('login', 'USERS', email, '', '', 'berhasil', email);
  return { token: token, nama: sesi.nama, peran: sesi.peran, dusun: sesi.dusun, exp: Date.now() + SESI_TTL * 1000 };
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
