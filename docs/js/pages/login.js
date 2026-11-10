import { renderTombolGoogle } from '../auth.js';

export async function render(el) {
  el.innerHTML = `
    <section class="login">
      <img src="icons/icon-192.png" alt="" width="96" height="96" class="login-logo">
      <h1>Letter C Merden</h1>
      <p class="redup">Buku C tanah Desa Merden<br>Kec. Purwanegara, Kab. Banjarnegara</p>
      <div id="tombol-google" class="tombol-google"></div>
      <div id="pesan-login" class="pesan-login" role="alert"></div>
      <p class="kecil redup">Hanya untuk perangkat desa yang terdaftar.</p>
    </section>`;
  const pesan = el.querySelector('#pesan-login');
  const tampil = (teks, jenis = 'galat') => { pesan.className = 'pesan-login ' + jenis; pesan.textContent = teks; };

  if (!navigator.onLine) {
    tampil('Sedang offline. Sambungkan internet untuk masuk.');
    return;
  }
  try {
    await renderTombolGoogle(
      el.querySelector('#tombol-google'),
      d => { tampil('Selamat datang, ' + d.nama, 'sukses'); location.hash = '#/'; },
      e => {
        if (e.code === 'FORBIDDEN') tampil(e.message || 'Akses ditolak — hubungi admin desa');
        else tampil('Gagal masuk: ' + (e.message || e));
      }
    );
  } catch (e) {
    tampil(e.message || String(e));
  }
}
