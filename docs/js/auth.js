// Login Google Identity Services + penyimpanan sesi lokal.
import { GOOGLE_CLIENT_ID } from './config.js';
import { api } from './api.js';

const KEY = 'lcm_sesi';

export function getSesi() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (s && s.token && s.exp > Date.now()) return s;
  } catch (e) { /* abaikan */ }
  return null;
}

export function simpanSesi(s) {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) { /* abaikan */ }
}

export function hapusSesi() {
  try { localStorage.removeItem(KEY); } catch (e) { /* abaikan */ }
}

/** Cek peran sesi: punyaPeran('admin','operator') */
export function punyaPeran(...daftar) {
  const s = getSesi();
  return !!s && daftar.includes(s.peran);
}

function tungguGis(ms = 10000) {
  return new Promise((resolve, reject) => {
    const mulai = Date.now();
    (function cek() {
      if (window.google && google.accounts && google.accounts.id) return resolve();
      if (Date.now() - mulai > ms) return reject(new Error('Layanan login Google tidak termuat. Periksa koneksi.'));
      setTimeout(cek, 150);
    })();
  });
}

/** Tampilkan tombol "Masuk dengan Google" di elemen el. */
export async function renderTombolGoogle(el, onSukses, onGagal) {
  if (!GOOGLE_CLIENT_ID) throw new Error('GOOGLE_CLIENT_ID belum diisi di js/config.js');
  await tungguGis();
  google.accounts.id.initialize({
    client_id: GOOGLE_CLIENT_ID,
    auto_select: false,
    callback: async (resp) => {
      try {
        const d = await api('login', { idToken: resp.credential });
        simpanSesi(d);
        onSukses(d);
      } catch (e) {
        onGagal(e);
      }
    }
  });
  google.accounts.id.renderButton(el, {
    theme: 'filled_blue', size: 'large', text: 'signin_with', shape: 'pill', locale: 'id', width: 280
  });
}

export async function logout() {
  try { await api('logout'); } catch (e) { /* tetap keluar */ }
  hapusSesi();
  try { google.accounts.id.disableAutoSelect(); } catch (e) { /* abaikan */ }
  location.hash = '#/login';
}
