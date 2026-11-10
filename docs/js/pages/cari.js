import { api } from '../api.js';
import { getSesi, punyaPeran } from '../auth.js';
import { cariOffline } from '../db.js';
import { gantiQuery } from '../router.js';
import { esc, fmtM2, fmtHa, debounce, loading, galat } from '../ui.js';

const KELAS = ['D-I', 'D-II', 'D-III', 'D-IV', 'D-V', 'D-VI', 'D-VII', 'S-I', 'S-II', 'S-III', 'S-IV', 'S-V', 'S-VI', 'S-VII'];
const opsi = (daftar, pilih, kosong) =>
  `<option value="">${kosong}</option>` + daftar.map(v => {
    const [val, label] = Array.isArray(v) ? v : [v, v];
    return `<option value="${esc(val)}" ${val === pilih ? 'selected' : ''}>${esc(label)}</option>`;
  }).join('');

export async function render(el, { query, masihAktif }) {
  const sesi = getSesi();
  const st = {
    q: query.q || '',
    hal: Math.max(1, parseInt(query.hal, 10) || 1),
    filter: {
      dusun: query.dusun || '', status: query.status || '', tipe: query.tipe || '',
      kelas: query.kelas || '', dobel: query.dobel === '1'
    }
  };

  el.innerHTML = `
    <h1 class="sr-only">Cari Letter C</h1>
    <div class="cari-besar" role="search">
      <input type="search" id="q" value="${esc(st.q)}" placeholder="Nomor C, nama pemilik, atau no persil"
             aria-label="Kata cari" autocomplete="off" enterkeyhint="search" autofocus>
    </div>
    <div class="filter" role="group" aria-label="Saring hasil">
      ${sesi.peran === 'kadus' ? '' : `<select id="f-dusun" aria-label="Dusun">${opsi(['I', 'II', 'III', 'IV', 'V'].map(d => [d, 'Dusun ' + d]), st.filter.dusun, 'Semua dusun')}</select>`}
      <select id="f-status" aria-label="Status C">${opsi(['Aktif', 'Habis/Mutasi', 'Tanpa persil'], st.filter.status, 'Semua status')}</select>
      <select id="f-tipe" aria-label="Tipe tanah">${opsi([['D', 'Tanah Kering (D)'], ['S', 'Tanah Basah (S)']], st.filter.tipe, 'Semua tipe')}</select>
      <select id="f-kelas" aria-label="Kelas">${opsi(KELAS, st.filter.kelas, 'Semua kelas')}</select>
      <label class="chip"><input type="checkbox" id="f-dobel" ${st.filter.dobel ? 'checked' : ''}> Hanya dobel</label>
    </div>
    <div id="hasil" aria-live="polite"></div>`;

  const hasilEl = el.querySelector('#hasil');
  const qEl = el.querySelector('#q');

  const simpanUrl = () => gantiQuery('/cari', {
    q: st.q, hal: st.hal > 1 ? st.hal : '', dusun: st.filter.dusun, status: st.filter.status,
    tipe: st.filter.tipe, kelas: st.filter.kelas, dobel: st.filter.dobel ? '1' : ''
  });

  let nomorPermintaan = 0;
  async function jalankan() {
    simpanUrl();
    const saya = ++nomorPermintaan;
    loading(hasilEl, 'Mencari…');
    try {
      const d = navigator.onLine
        ? await api('cari', { q: st.q, filter: st.filter, hal: st.hal })
        : await cariOffline(st.q, st.hal);
      if (saya !== nomorPermintaan || !masihAktif()) return;
      tampil(d);
    } catch (e) {
      if (saya !== nomorPermintaan || !masihAktif()) return;
      galat(hasilEl, e, jalankan);
    }
  }

  function tampil(d) {
    if (d.offline && d.kosong) {
      hasilEl.innerHTML = `<div class="kartu"><p>Offline, dan data ringkas belum tersimpan di perangkat ini.</p>
        <p class="redup kecil">Penyimpanan data offline aktif mulai Tahap 3.</p></div>`;
      return;
    }
    if (!d.total) {
      const bisaBuat = punyaPeran('admin', 'operator') && /^[0-9][0-9A-Za-z/]*$/.test(st.q);
      hasilEl.innerHTML = `<div class="kartu"><p>Tidak ada hasil${st.q ? ' untuk “' + esc(st.q) + '”' : ''}.</p>
        ${bisaBuat ? `<a class="btn btn-utama" href="#/c-baru?nomor=${encodeURIComponent(st.q)}" data-simpan>+ Buat C ${esc(st.q)}</a>` : ''}</div>`;
      return;
    }
    const perHal = d.per_hal || 50;
    const jmlHal = Math.ceil(d.total / perHal);
    const href = r => r.nomor_c ? '#/c/' + encodeURIComponent(r.nomor_c) : '#/c-id/' + encodeURIComponent(r.id_c);
    const judul = r => r.nomor_c ? esc(r.nomor_c) : '<span class="teks-bahaya">(kosong)</span>';
    const label = r => `${r.dobel ? '<span class="lencana lencana-peringatan">Dobel</span>' : ''}
      <span class="lencana ${r.status_c === 'Aktif' ? 'lencana-hijau' : 'lencana-abu'}">${esc(r.status_c)}</span>`;

    hasilEl.innerHTML = `
      <p class="redup kecil">${d.total.toLocaleString('id-ID')} hasil${d.offline ? ' (data offline)' : ''}</p>
      <ul class="daftar-kartu">
        ${d.baris.map(r => `
          <li><a class="kartu hasil" href="${href(r)}">
            <div class="hasil-atas"><span class="nomor-c">C ${judul(r)}</span>${label(r)}</div>
            <div class="hasil-nama">${esc(r.nama)}</div>
            <div class="redup kecil">${r.dusun ? 'Dusun ' + esc(r.dusun) + ' · ' : ''}${r.jml_persil} persil · aktif ${fmtM2(r.luas_aktif)}</div>
          </a></li>`).join('')}
      </ul>
      <table class="tabel tabel-hasil">
        <thead><tr><th>Nomor C</th><th>Nama pemilik</th><th>Dusun</th><th class="angka">Persil</th>
          <th class="angka">Luas aktif</th><th>Status</th></tr></thead>
        <tbody>${d.baris.map(r => `
          <tr data-href="${href(r)}" tabindex="0">
            <td><a href="${href(r)}"><strong>${judul(r)}</strong></a></td>
            <td>${esc(r.nama)}</td><td>${esc(r.dusun || '–')}</td>
            <td class="angka">${r.jml_persil}</td>
            <td class="angka">${fmtM2(r.luas_aktif)}<br><span class="redup kecil">${fmtHa(r.luas_aktif)}</span></td>
            <td>${label(r)}</td></tr>`).join('')}
        </tbody>
      </table>
      ${jmlHal > 1 ? `<nav class="paging" aria-label="Halaman hasil">
        <button class="btn" data-hal="${st.hal - 1}" ${st.hal <= 1 ? 'disabled' : ''}>‹ Sebelumnya</button>
        <span>Hal ${st.hal} / ${jmlHal}</span>
        <button class="btn" data-hal="${st.hal + 1}" ${st.hal >= jmlHal ? 'disabled' : ''}>Berikutnya ›</button>
      </nav>` : ''}`;

    hasilEl.querySelectorAll('[data-hal]').forEach(b => b.addEventListener('click', () => {
      st.hal = Number(b.dataset.hal);
      window.scrollTo(0, 0);
      jalankan();
    }));
    hasilEl.querySelectorAll('tr[data-href]').forEach(tr => {
      tr.addEventListener('click', () => { location.hash = tr.dataset.href; });
      tr.addEventListener('keydown', e => { if (e.key === 'Enter') location.hash = tr.dataset.href; });
    });
  }

  const ketik = debounce(() => { st.q = qEl.value.trim(); st.hal = 1; jalankan(); }, 300);
  qEl.addEventListener('input', ketik);
  qEl.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); qEl.blur(); } });

  const ikat = (id, kunci, ambil = x => x.value) => {
    const x = el.querySelector(id);
    if (x) x.addEventListener('change', () => { st.filter[kunci] = ambil(x); st.hal = 1; jalankan(); });
  };
  ikat('#f-dusun', 'dusun');
  ikat('#f-status', 'status');
  ikat('#f-tipe', 'tipe');
  ikat('#f-kelas', 'kelas');
  ikat('#f-dobel', 'dobel', x => x.checked);

  jalankan();
}
