// Hash router sederhana. Setiap halaman: export async function render(el, {params, query, nav}).
import { getSesi } from './auth.js';
import { parseQuery, esc } from './ui.js';

const RUTE = [
  { pola: /^\/login$/, halaman: 'login', publik: true },
  { pola: /^\/$/, halaman: 'beranda', menu: 'beranda' },
  { pola: /^\/cari$/, halaman: 'cari', menu: 'cari' },
  { pola: /^\/c\/([^/]+)$/, halaman: 'detail-c', menu: 'cari', kunci: ['nomor_c'] },
  { pola: /^\/c-id\/([^/]+)$/, halaman: 'detail-c', menu: 'cari', kunci: ['id_c'] },
  { pola: /^\/c\/([^/]+)\/ubah$/, segera: 'Ubah data C', menu: 'cari' },
  { pola: /^\/persil\/baru$/, segera: 'Tambah persil', menu: 'cari' },
  { pola: /^\/persil\/([^/]+)\/ubah$/, segera: 'Ubah persil', menu: 'cari' },
  { pola: /^\/mutasi\/baru$/, segera: 'Tambah mutasi', menu: 'cari' },
  { pola: /^\/riwayat\/([^/]+)$/, segera: 'Riwayat tanah', menu: 'cari', tahap: 3 },
  { pola: /^\/koreksi$/, segera: 'Antrean koreksi', menu: 'koreksi' },
  { pola: /^\/ptsl$/, segera: 'Data PTSL', menu: 'ptsl', tahap: 3 },
  { pola: /^\/ptsl\/([^/]+)$/, segera: 'Detail PTSL', menu: 'ptsl', tahap: 3 },
  { pola: /^\/pengaturan$/, halaman: 'pengaturan', menu: 'lainnya' }
];

let nomorNavigasi = 0;
let onBerubah = () => {};

export function saatBerubah(fn) { onBerubah = fn; }

export function pergi(hash) {
  if (location.hash === hash) muat(); else location.hash = hash;
}

/** Ganti query di URL tanpa memuat ulang halaman (mis. saat mengetik kata cari). */
export function gantiQuery(path, query) {
  const qs = new URLSearchParams(Object.entries(query).filter(([, v]) => v !== '' && v != null)).toString();
  history.replaceState(null, '', '#' + path + (qs ? '?' + qs : ''));
}

export async function muat() {
  const raw = location.hash.replace(/^#/, '') || '/';
  const [path, qs] = raw.split('?');
  const sesi = getSesi();
  const rute = RUTE.find(r => r.pola.test(path));

  if (!sesi && !(rute && rute.publik)) { location.replace('#/login'); return; }
  if (sesi && rute && rute.publik) { location.replace('#/'); return; }

  const el = document.getElementById('app');
  const saya = ++nomorNavigasi;
  onBerubah({ path, rute, sesi });
  window.scrollTo(0, 0);

  if (!rute) {
    el.innerHTML = `<div class="kartu"><h1>Halaman tidak ditemukan</h1><p><a href="#/">Kembali ke beranda</a></p></div>`;
    return;
  }
  if (rute.segera) {
    el.innerHTML = `<div class="kartu"><h1>${esc(rute.segera)}</h1>
      <p class="redup">Fitur ini dikerjakan pada Tahap ${rute.tahap || 2}. Belum tersedia di versi ini.</p>
      <p><a class="btn" href="#/">Kembali ke beranda</a></p></div>`;
    return;
  }

  const m = path.match(rute.pola);
  const params = {};
  (rute.kunci || []).forEach((k, i) => { params[k] = decodeURIComponent(m[i + 1]); });
  try {
    const mod = await import(`./pages/${rute.halaman}.js`);
    if (saya !== nomorNavigasi) return; // sudah pindah halaman
    await mod.render(el, { params, query: parseQuery(qs), path, masihAktif: () => saya === nomorNavigasi });
  } catch (e) {
    console.error(e);
    el.innerHTML = `<div class="kartu kartu-galat"><p>Halaman gagal dimuat: ${esc(e.message)}</p></div>`;
  }
}

export function mulaiRouter() {
  window.addEventListener('hashchange', muat);
  muat();
}
