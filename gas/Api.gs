/**
 * Api.gs — pintu masuk JSON API LETTER C MERDEN.
 * Semua request: POST text/plain berisi {action, token, data}.
 * Balasan: {ok:true, data} | {ok:false, error:{code, message}}
 */

// Alamat aplikasi (PWA di GitHub Pages) — ditampilkan saat URL Apps Script dibuka di browser
const APP_URL = 'https://hidayatullohwahyu1.github.io/letter-c-merden/';

// Peran yang boleh untuk tiap tingkat "peran minimal"
const PERAN_BOLEH = {
  semua: ['admin', 'operator', 'kadus', 'pimpinan'],
  operator: ['admin', 'operator'],
  admin: ['admin']
};

// Daftar aksi. publik:true hanya untuk login.
const AKSI = {
  login:    { fn: (d) => aksiLogin_(d), publik: true },
  logout:   { fn: (d, s) => aksiLogout_(d, s), peran: 'semua' },
  me:       { fn: (d, s) => aksiMe_(d, s), peran: 'semua' },
  gantiPin: { fn: (d, s) => aksiGantiPin_(d, s), peran: 'semua' },
  cari:     { fn: (d, s) => aksiCari_(d, s), peran: 'semua' },
  detailC:  { fn: (d, s) => aksiDetailC_(d, s), peran: 'semua' },
  scan:     { fn: (d, s) => aksiScan_(d, s), peran: 'semua' },
  // Tahap 2 — perbaikan data
  ref:           { fn: (d, s) => aksiRef_(d, s), peran: 'semua' },
  detailPersil:  { fn: (d, s) => aksiDetailPersil_(d, s), peran: 'semua' },
  simpanC:       { fn: (d, s) => aksiSimpanC_(d, s), peran: 'semua' },      // kadus: hanya dusun (dicek di dalam)
  simpanPersil:  { fn: (d, s) => aksiSimpanPersil_(d, s), peran: 'operator' },
  simpanMutasi:  { fn: (d, s) => aksiSimpanMutasi_(d, s), peran: 'operator' },
  hapus:         { fn: (d, s) => aksiHapus_(d, s), peran: 'operator' },
  pulihkan:      { fn: (d, s) => aksiPulihkan_(d, s), peran: 'admin' },
  listKoreksi:   { fn: (d, s) => aksiListKoreksi_(d, s), peran: 'semua' },
  tandaiKoreksi: { fn: (d, s) => aksiTandaiKoreksi_(d, s), peran: 'semua' }, // kadus: catatan saja (dicek di dalam)
  laporKoreksi:  { fn: (d, s) => aksiLaporKoreksi_(d, s), peran: 'semua' },
  periksaUlang:  { fn: (d, s) => aksiPeriksaUlang_(d, s), peran: 'admin' }
};

/** Galat dengan kode baku. */
function err_(code, message) {
  const e = new Error(message);
  e.code = code;
  return e;
}

function route_(req) {
  if (!req || typeof req !== 'object') throw err_('VALIDATION', 'Request tidak sah');
  const a = AKSI[req.action];
  if (!a) throw err_('NOT_FOUND', 'Aksi tidak dikenal: ' + req.action);
  const data = req.data || {};
  if (a.publik) return a.fn(data);
  const sesi = requireSession_(req.token);
  if (PERAN_BOLEH[a.peran].indexOf(sesi.peran) < 0) {
    throw err_('FORBIDDEN', 'Peran Anda tidak boleh melakukan aksi ini');
  }
  return a.fn(data, sesi);
}

function doPost(e) {
  let out;
  try {
    const req = JSON.parse(e.postData.contents);
    out = { ok: true, data: route_(req) };
  } catch (err) {
    out = { ok: false, error: { code: err.code || 'ERROR', message: String(err.message || err), detail: err.detail || null } };
  }
  return ContentService.createTextOutput(JSON.stringify(out)).setMimeType(ContentService.MimeType.JSON);
}

/**
 * GET ?status=1 → JSON status (untuk cek API).
 * GET biasa (dibuka di browser) → halaman kecil berisi tombol menuju aplikasi.
 */
function doGet(e) {
  if (e && e.parameter && e.parameter.status) {
    return ContentService
      .createTextOutput(JSON.stringify({ ok: true, data: { app: 'LETTER C MERDEN', status: 'up' } }))
      .setMimeType(ContentService.MimeType.JSON);
  }
  const html = '<!doctype html><html lang="id"><head><meta name="viewport" content="width=device-width, initial-scale=1">' +
    '<style>body{font:16px/1.5 system-ui,sans-serif;text-align:center;padding:48px 16px;color:#1a1d21}' +
    'a{display:inline-block;margin-top:16px;padding:14px 24px;border-radius:10px;background:#1F4E78;color:#fff;text-decoration:none;font-weight:600}</style></head>' +
    '<body><h1>Letter C Merden</h1><p>Buku C tanah Desa Merden</p>' +
    '<a href="' + APP_URL + '" target="_top">Buka aplikasi</a>' +
    '<p style="color:#5b6470;font-size:14px;margin-top:24px">Di HP Android: buka di Chrome lalu pilih “Instal aplikasi”.</p></body></html>';
  return HtmlService.createHtmlOutput(html)
    .setTitle('Letter C Merden')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}
