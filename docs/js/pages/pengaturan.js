import { getSesi, logout } from '../auth.js';
import { api } from '../api.js';
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
      <h2>Ganti PIN</h2>
      <form id="form-pin" class="form-login" novalidate>
        <label for="pin-lama">PIN lama</label>
        <input id="pin-lama" type="password" inputmode="numeric" autocomplete="current-password" required>
        <label for="pin-baru">PIN baru (minimal 6 angka)</label>
        <input id="pin-baru" type="password" inputmode="numeric" autocomplete="new-password" required minlength="6">
        <label for="pin-ulang">Ulangi PIN baru</label>
        <input id="pin-ulang" type="password" inputmode="numeric" autocomplete="new-password" required minlength="6">
        <button class="btn btn-utama" type="submit" data-simpan>Simpan PIN</button>
      </form>
    </section>
    <section class="kartu">
      <h2>Aplikasi</h2>
      <p id="info-pasang" class="redup"></p>
      <button class="btn btn-utama" id="pasang" hidden>Pasang aplikasi</button>
      <p class="kecil redup">Versi ${esc(APP_VERSION)}</p>
    </section>
    ${s.peran === 'admin' ? `<section class="kartu"><h2>Admin</h2>
      <p class="redup">Kelola pengguna, peta kata mutasi, log, dan cabut sesi tersedia di Tahap 3.
      Sementara ini, kelola pengguna langsung di sheet USERS. Untuk memberi atau mereset PIN,
      isi kolom <strong>pin_baru</strong> (minimal 6 karakter); PIN aktif saat pengguna masuk pertama kali.</p></section>` : ''}`;

  el.querySelector('#keluar').addEventListener('click', () => logout());

  const formPin = el.querySelector('#form-pin');
  formPin.addEventListener('submit', async e => {
    e.preventDefault();
    const lama = formPin.querySelector('#pin-lama').value;
    const baru = formPin.querySelector('#pin-baru').value;
    const ulang = formPin.querySelector('#pin-ulang').value;
    if (baru.length < 6) { toast('PIN baru minimal 6 karakter', 'galat'); return; }
    if (baru !== ulang) { toast('Ulangan PIN baru tidak sama', 'galat'); return; }
    const b = formPin.querySelector('button');
    b.disabled = true;
    try {
      await api('gantiPin', { pin_lama: lama, pin_baru: baru });
      formPin.reset();
      toast('PIN berhasil diganti', 'sukses');
    } catch (err) {
      toast(err.message, 'galat');
    } finally {
      b.disabled = false;
    }
  });

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
