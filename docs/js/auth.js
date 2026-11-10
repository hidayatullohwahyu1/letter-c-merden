// Login email + PIN (diperiksa Apps Script) + penyimpanan sesi lokal.
import { api } from './api.js';

const KEY = 'lcm_sesi';
const KEY_EMAIL = 'lcm_email';

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

/** Username/email terakhir dipakai (agar tidak perlu mengetik ulang). PIN tidak pernah disimpan. */
export function emailTerakhir() {
  try { return localStorage.getItem(KEY_EMAIL) || ''; } catch (e) { return ''; }
}

/** Cek peran sesi: punyaPeran('admin','operator') */
export function punyaPeran(...daftar) {
  const s = getSesi();
  return !!s && daftar.includes(s.peran);
}

export async function login(email, pin) {
  const e = String(email || '').trim().toLowerCase();
  const d = await api('login', { user: e, pin: String(pin || '') });
  simpanSesi(d);
  try { localStorage.setItem(KEY_EMAIL, e); } catch (err) { /* abaikan */ }
  return d;
}

export async function logout() {
  try { await api('logout'); } catch (e) { /* tetap keluar */ }
  hapusSesi();
  location.hash = '#/login';
}
