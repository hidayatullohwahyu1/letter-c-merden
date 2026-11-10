import { getSesi, punyaPeran } from '../auth.js';
import { esc } from '../ui.js';

export async function render(el) {
  const s = getSesi();
  el.innerHTML = `
    <h1>Halo, ${esc(s.nama)}</h1>
    <p class="redup">Peran: ${esc(s.peran)}${s.dusun ? ' · Dusun ' + esc(s.dusun) : ''}</p>
    <form class="cari-besar" id="form-cari" role="search">
      <input type="search" name="q" placeholder="Nomor C, nama pemilik, atau no persil"
             aria-label="Cari Letter C" autocomplete="off" enterkeyhint="search">
      <button class="btn btn-utama" type="submit">Cari</button>
    </form>
    <div class="grid-pintas">
      <a class="kartu pintas" href="#/cari"><strong>Cari Letter C</strong><span class="redup">Nomor C, nama, persil</span></a>
      <a class="kartu pintas" href="#/koreksi"><strong>Antrean koreksi</strong><span class="redup">Masalah data yang perlu dicek</span></a>
      ${punyaPeran('admin', 'operator') ? '<a class="kartu pintas" href="#/c-baru" data-simpan><strong>+ Tambah data C</strong><span class="redup">Nomor C baru dari buku</span></a>' : ''}
      <a class="kartu pintas" href="#/ptsl"><strong>Data PTSL</strong><span class="redup">Tahap 3</span></a>
    </div>
    <p class="kecil redup">Dashboard angka & grafik ditambahkan pada Tahap 3.</p>`;
  el.querySelector('#form-cari').addEventListener('submit', e => {
    e.preventDefault();
    const q = e.target.q.value.trim();
    location.hash = '#/cari' + (q ? '?q=' + encodeURIComponent(q) : '');
  });
}
