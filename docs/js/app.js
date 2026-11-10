// Bootstrap: service worker, tombol pasang, banner offline/update, menu, router.
import { APP_VERSION } from './config.js';
import { mulaiRouter, saatBerubah } from './router.js';
import { esc } from './ui.js';

/* ---------- Menu ---------- */

const IKON = {
  beranda: '<path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
  cari: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>',
  koreksi: '<path d="M9 11l3 3 8-8"/><path d="M20 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h11"/>',
  ptsl: '<path d="M3 6l6-3 6 3 6-3v15l-6 3-6-3-6 3z"/><path d="M9 3v15M15 6v15"/>',
  lainnya: '<circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/>'
};
const MENU = [
  ['beranda', 'Beranda', '#/'],
  ['cari', 'Cari', '#/cari'],
  ['koreksi', 'Koreksi', '#/koreksi'],
  ['ptsl', 'PTSL', '#/ptsl'],
  ['lainnya', 'Lainnya', '#/pengaturan']
];

function gambarMenu() {
  const nav = document.getElementById('nav');
  nav.innerHTML = MENU.map(([k, label, href]) => `
    <a href="${href}" data-menu="${k}" class="nav-item">
      <svg viewBox="0 0 24 24" aria-hidden="true">${IKON[k]}</svg><span>${esc(label)}</span>
    </a>`).join('');
}

saatBerubah(({ rute, sesi }) => {
  const login = !sesi || !!(rute && rute.publik); // harus boolean: toggle(x, undefined) membalik kelas
  document.body.classList.toggle('tanpa-menu', login);
  const aktif = rute && rute.menu;
  document.querySelectorAll('#nav [data-menu]').forEach(a => {
    const on = a.dataset.menu === aktif;
    a.classList.toggle('aktif', on);
    if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  });
  const prof = document.getElementById('profil-atas');
  prof.textContent = sesi ? `${sesi.nama} · ${sesi.peran}${sesi.dusun ? ' ' + sesi.dusun : ''}` : '';
});

/* ---------- Offline ---------- */

function aturOffline() {
  const off = !navigator.onLine;
  document.getElementById('pita-offline').hidden = !off;
  document.body.classList.toggle('offline', off);
}
window.addEventListener('online', aturOffline);
window.addEventListener('offline', aturOffline);

/* ---------- Pasang aplikasi ---------- */

export const pasang = { event: null, terpasang: window.matchMedia('(display-mode: standalone)').matches };
window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  pasang.event = e;
  window.dispatchEvent(new Event('lcm-bisa-pasang'));
});
window.addEventListener('appinstalled', () => {
  pasang.event = null;
  pasang.terpasang = true;
  window.dispatchEvent(new Event('lcm-bisa-pasang'));
});
export async function mintaPasang() {
  if (!pasang.event) return false;
  pasang.event.prompt();
  const { outcome } = await pasang.event.userChoice;
  pasang.event = null;
  return outcome === 'accepted';
}

/* ---------- Service worker & update ---------- */

function tampilBannerUpdate(reg) {
  const b = document.getElementById('banner-update');
  b.hidden = false;
  b.querySelector('button').onclick = () => {
    if (reg.waiting) reg.waiting.postMessage({ type: 'SKIP_WAITING' });
  };
}

async function daftarSw() {
  if (!('serviceWorker' in navigator)) return;
  try {
    const reg = await navigator.serviceWorker.register('./sw.js');
    if (reg.waiting && navigator.serviceWorker.controller) tampilBannerUpdate(reg);
    reg.addEventListener('updatefound', () => {
      const baru = reg.installing;
      baru && baru.addEventListener('statechange', () => {
        if (baru.state === 'installed' && navigator.serviceWorker.controller) tampilBannerUpdate(reg);
      });
    });
    navigator.serviceWorker.addEventListener('message', e => {
      if (e.data && e.data.type === 'SW_BARU_MENUNGGU') tampilBannerUpdate(reg);
    });
    // Muat ulang hanya bila SW lama diganti SW baru (bukan saat pemasangan pertama)
    let sudahReload = !navigator.serviceWorker.controller;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (sudahReload) return;
      sudahReload = true;
      location.reload();
    });
    setInterval(() => reg.update().catch(() => {}), 60 * 60 * 1000);
  } catch (e) {
    console.warn('Service worker gagal didaftarkan', e);
  }
}

/* ---------- Mulai ---------- */

document.getElementById('versi').textContent = 'v' + APP_VERSION;
gambarMenu();
aturOffline();
daftarSw();
mulaiRouter();
