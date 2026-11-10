import { getSesi, logout } from '../auth.js';
import { APP_VERSION } from '../config.js';
import { pasang, mintaPasang } from '../app.js';
import { esc, toast } from '../ui.js';

export async function render(el) {
  const s = getSesi();
  el.innerHTML = `
    <h1>Lainnya</h1>
    <section class="kartu">
      <h2>Akun</h2>
      <dl class="dl">
        <dt>Nama</dt><dd>${esc(s.nama)}</dd>
        <dt>Peran</dt><dd>${esc(s.peran)}</dd>
        ${s.dusun ? `<dt>Dusun</dt><dd>${esc(s.dusun)}</dd>` : ''}
        <dt>Sesi berakhir</dt><dd>${new Date(s.exp).toLocaleString('id-ID')}</dd>
      </dl>
      <button class="btn btn-bahaya" id="keluar">Keluar</button>
    </section>
    <section class="kartu">
      <h2>Aplikasi</h2>
      <p id="info-pasang" class="redup"></p>
      <button class="btn btn-utama" id="pasang" hidden>Pasang aplikasi</button>
      <p class="kecil redup">Versi ${esc(APP_VERSION)}</p>
    </section>
    ${s.peran === 'admin' ? `<section class="kartu"><h2>Admin</h2>
      <p class="redup">Kelola pengguna, peta kata mutasi, log, dan cabut sesi tersedia di Tahap 3.
      Sementara ini, kelola pengguna langsung di sheet USERS.</p></section>` : ''}`;

  el.querySelector('#keluar').addEventListener('click', () => logout());

  const tombol = el.querySelector('#pasang');
  const info = el.querySelector('#info-pasang');
  const segarkan = () => {
    tombol.hidden = !pasang.event;
    info.textContent = pasang.terpasang
      ? 'Aplikasi sudah terpasang di perangkat ini.'
      : pasang.event
        ? 'Pasang aplikasi ke layar utama agar terbuka seperti aplikasi biasa.'
        : 'Untuk memasang: buka menu ⋮ Chrome → “Tambahkan ke layar utama” / “Instal aplikasi”.';
  };
  segarkan();
  window.addEventListener('lcm-bisa-pasang', segarkan);
  tombol.addEventListener('click', async () => {
    const ok = await mintaPasang();
    toast(ok ? 'Aplikasi dipasang' : 'Pemasangan dibatalkan');
    segarkan();
  });
}
