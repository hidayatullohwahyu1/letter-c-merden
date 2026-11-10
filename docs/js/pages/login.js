import { login, emailTerakhir } from '../auth.js';
import { esc } from '../ui.js';

export async function render(el) {
  el.innerHTML = `
    <section class="login">
      <img src="icons/icon-192.png" alt="" width="96" height="96" class="login-logo">
      <h1>Letter C Merden</h1>
      <p class="redup">Buku C tanah Desa Merden<br>Kec. Purwanegara, Kab. Banjarnegara</p>
      <form id="form-login" class="form-login" novalidate>
        <label for="email">Username atau email</label>
        <input id="email" name="email" type="text" autocomplete="username" autocapitalize="none"
               spellcheck="false" required value="${esc(emailTerakhir())}" placeholder="mis. admin">
        <label for="pin">PIN</label>
        <input id="pin" name="pin" type="password" inputmode="numeric" autocomplete="current-password"
               required minlength="6" placeholder="Minimal 6 angka">
        <button class="btn btn-utama" type="submit" data-simpan>Masuk</button>
      </form>
      <div id="pesan-login" class="pesan-login" role="alert"></div>
      <p class="kecil redup">Hanya untuk perangkat desa yang terdaftar. Lupa PIN? Hubungi admin desa.</p>
    </section>`;

  const form = el.querySelector('#form-login');
  const pesan = el.querySelector('#pesan-login');
  const tampil = (teks, jenis = 'galat') => { pesan.className = 'pesan-login ' + jenis; pesan.textContent = teks; };
  (form.email.value ? form.pin : form.email).focus();

  form.addEventListener('submit', async e => {
    e.preventDefault();
    const email = form.email.value.trim();
    const pin = form.pin.value;
    if (!email || !pin) { tampil('Isi username/email dan PIN.'); return; }
    if (!navigator.onLine) { tampil('Sedang offline. Sambungkan internet untuk masuk.'); return; }
    const tombol = form.querySelector('button');
    tombol.disabled = true;
    tombol.textContent = 'Memeriksa…';
    try {
      const d = await login(email, pin);
      tampil('Selamat datang, ' + d.nama, 'sukses');
      location.hash = '#/';
    } catch (err) {
      tampil(err.message || String(err));
      form.pin.value = '';
      form.pin.focus();
    } finally {
      tombol.disabled = false;
      tombol.textContent = 'Masuk';
    }
  });
}
