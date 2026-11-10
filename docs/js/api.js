// Satu-satunya pintu fetch ke API Apps Script.
import { API_URL } from './config.js';
import { getSesi, hapusSesi } from './auth.js';

export class ApiError extends Error {
  constructor(code, message, detail = null) {
    super(message);
    this.code = code;
    this.detail = detail; // galat per kolom dari VALIDATION: [{kode, kolom, pesan}]
  }
}

export async function api(action, data = {}) {
  if (!API_URL) throw new ApiError('ERROR', 'API_URL belum diisi di js/config.js');
  if (!navigator.onLine) throw new ApiError('OFFLINE', 'Sedang offline — tidak bisa menghubungi server');
  const sesi = getSesi();
  let res;
  try {
    res = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' }, // hindari preflight CORS
      body: JSON.stringify({ action, token: sesi ? sesi.token : '', data }),
      redirect: 'follow'
    });
  } catch (e) {
    throw new ApiError('NETWORK', 'Gagal menghubungi server. Periksa koneksi internet.');
  }
  let json;
  try {
    json = await res.json();
  } catch (e) {
    throw new ApiError('ERROR', 'Jawaban server tidak terbaca (HTTP ' + res.status + ')');
  }
  if (!json.ok) {
    const { code = 'ERROR', message = 'Terjadi galat', detail = null } = json.error || {};
    if (code === 'NO_SESSION' || code === 'SESSION_EXPIRED') {
      hapusSesi();
      if (action !== 'login') location.hash = '#/login';
    }
    throw new ApiError(code, message, detail);
  }
  return json.data;
}
