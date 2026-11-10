/**
 * Api.gs — pintu masuk JSON API LETTER C MERDEN.
 * Semua request: POST text/plain berisi {action, token, data}.
 * Balasan: {ok:true, data} | {ok:false, error:{code, message}}
 */

// Peran yang boleh untuk tiap tingkat "peran minimal"
const PERAN_BOLEH = {
  semua: ['admin', 'operator', 'kadus', 'pimpinan'],
  operator: ['admin', 'operator'],
  admin: ['admin']
};

// Daftar aksi. publik:true hanya untuk login.
const AKSI = {
  login:   { fn: (d) => aksiLogin_(d), publik: true },
  logout:  { fn: (d, s) => aksiLogout_(d, s), peran: 'semua' },
  me:      { fn: (d, s) => aksiMe_(d, s), peran: 'semua' },
  cari:    { fn: (d, s) => aksiCari_(d, s), peran: 'semua' },
  detailC: { fn: (d, s) => aksiDetailC_(d, s), peran: 'semua' },
  scan:    { fn: (d, s) => aksiScan_(d, s), peran: 'semua' }
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
    out = { ok: false, error: { code: err.code || 'ERROR', message: String(err.message || err) } };
  }
  return ContentService.createTextOutput(JSON.stringify(out)).setMimeType(ContentService.MimeType.JSON);
}

function doGet() {
  return ContentService
    .createTextOutput(JSON.stringify({ ok: true, data: { app: 'LETTER C MERDEN', status: 'up' } }))
    .setMimeType(ContentService.MimeType.JSON);
}
