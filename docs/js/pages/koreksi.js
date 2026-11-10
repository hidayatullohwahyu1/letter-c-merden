// Antrean koreksi: progres per prioritas, filter, kartu masalah, Kerjakan / Tandai Sudah / Catatan.
import { api } from '../api.js';
import { getSesi, punyaPeran } from '../auth.js';
import { gantiQuery } from '../router.js';
import { esc, fmtAngka, debounce, loading, galat, toast, tanya } from '../ui.js';

const WARNA = { Tinggi: 'merah', Sedang: 'peringatan', Rendah: 'abu' };
const NAMA_SHEET = { C: 'Data C', PERSIL: 'Persil', MUTASI: 'Mutasi', PTSL: 'PTSL' };

export async function render(el, { query, masihAktif }) {
  const sesi = getSesi();
  const bisaTandai = punyaPeran('admin', 'operator');
  const bisaCatat = bisaTandai || sesi.peran === 'kadus';
  const st = {
    hal: Math.max(1, parseInt(query.hal, 10) || 1),
    filter: {
      prioritas: query.prioritas || '', sheet: query.sheet || '', status: query.status === 'semua' ? '' : (query.status || 'Belum'),
      dusun: query.dusun || '', q: query.q || ''
    }
  };
  const opsi = (daftar, pilih, kosong) => `<option value="">${kosong}</option>` +
    daftar.map(([v, l]) => `<option value="${esc(v)}" ${v === pilih ? 'selected' : ''}>${esc(l)}</option>`).join('');

  el.innerHTML = `
    <h1>Antrean koreksi</h1>
    <div id="progres" class="grid-progres" aria-live="polite"></div>
    <div class="cari-besar" role="search">
      <input type="search" id="q" value="${esc(st.filter.q)}" placeholder="Cari Nomor C, ID, atau isi masalah" aria-label="Cari koreksi" autocomplete="off">
    </div>
    <div class="filter" role="group" aria-label="Saring koreksi">
      <select id="f-status" aria-label="Status">${opsi([['Belum', 'Belum dikerjakan'], ['Sudah', 'Sudah']], st.filter.status, 'Semua status')}</select>
      <select id="f-prioritas" aria-label="Prioritas">${opsi([['Tinggi', 'Tinggi'], ['Sedang', 'Sedang'], ['Rendah', 'Rendah']], st.filter.prioritas, 'Semua prioritas')}</select>
      <select id="f-sheet" aria-label="Jenis data">${opsi(Object.entries(NAMA_SHEET), st.filter.sheet, 'Semua data')}</select>
      ${sesi.peran === 'kadus' ? '' : `<select id="f-dusun" aria-label="Dusun">${opsi([['I', 'Dusun I'], ['II', 'Dusun II'], ['III', 'Dusun III'], ['IV', 'Dusun IV'], ['V', 'Dusun V'], ['-', 'Dusun belum diketahui']], st.filter.dusun, 'Semua dusun')}</select>`}
    </div>
    <div id="daftar" aria-live="polite"></div>`;

  const daftarEl = el.querySelector('#daftar');
  const progresEl = el.querySelector('#progres');
  let nomor = 0;

  async function muat() {
    gantiQuery('/koreksi', { ...st.filter, status: st.filter.status === 'Belum' ? '' : (st.filter.status || 'semua'), hal: st.hal > 1 ? st.hal : '' });
    const saya = ++nomor;
    loading(daftarEl);
    try {
      const f = { ...st.filter };
      const d = await api('listKoreksi', { filter: f, hal: st.hal });
      if (saya !== nomor || !masihAktif()) return;
      tampilProgres(d.progres);
      tampilDaftar(d);
    } catch (e) {
      if (saya === nomor && masihAktif()) galat(daftarEl, e, muat);
    }
  }

  function tampilProgres(pr) {
    progresEl.innerHTML = ['Tinggi', 'Sedang', 'Rendah'].map(p => {
      const x = pr[p] || { total: 0, sudah: 0 };
      const persen = x.total ? Math.round(x.sudah / x.total * 100) : 0;
      return `<button class="kartu progres ${st.filter.prioritas === p ? 'aktif' : ''}" data-prio="${p}" aria-pressed="${st.filter.prioritas === p}">
        <span class="lencana lencana-${WARNA[p]}">${p}</span>
        <strong>${fmtAngka(x.total - x.sudah)}</strong><span class="redup kecil">belum dari ${fmtAngka(x.total)}</span>
        <span class="batang" role="progressbar" aria-valuenow="${persen}" aria-valuemin="0" aria-valuemax="100" aria-label="Progres ${p}"><span style="width:${persen}%"></span></span>
        <span class="kecil">${persen}% selesai</span></button>`;
    }).join('');
    progresEl.querySelectorAll('[data-prio]').forEach(b => b.addEventListener('click', () => {
      st.filter.prioritas = st.filter.prioritas === b.dataset.prio ? '' : b.dataset.prio;
      const sel = el.querySelector('#f-prioritas'); sel.value = st.filter.prioritas;
      st.hal = 1; muat();
    }));
  }

  function hrefKerjakan(k) {
    if (k.sheet === 'C' && !k.nomor_c) return '#/c-id/' + encodeURIComponent(k.ref_id);
    if (k.sheet === 'PERSIL') return '#/persil/' + encodeURIComponent(k.ref_id) + '/ubah';
    if (k.nomor_c) return '#/c/' + encodeURIComponent(k.nomor_c);
    return '';
  }

  function tampilDaftar(d) {
    if (!d.total) {
      daftarEl.innerHTML = `<div class="kartu"><p>Tidak ada masalah dengan saringan ini. 🎉</p></div>`;
      return;
    }
    const jmlHal = Math.ceil(d.total / d.per_hal);
    daftarEl.innerHTML = `<p class="redup kecil">${fmtAngka(d.total)} masalah</p>
      <ul class="daftar-kartu-koreksi">${d.baris.map(k => {
        const href = hrefKerjakan(k);
        const sudah = k.status === 'Sudah';
        return `<li class="kartu koreksi ${sudah ? 'koreksi-sudah' : ''}" data-id="${esc(k.id_koreksi)}">
          <div class="hasil-atas">
            <span class="lencana lencana-${WARNA[k.prioritas] || 'abu'}">${esc(k.prioritas)}</span>
            <span class="nomor-c">${k.nomor_c ? 'C ' + esc(k.nomor_c) : esc(k.ref_id)}</span>
            ${sudah ? '<span class="lencana lencana-hijau">Sudah</span>' : ''}
          </div>
          <p class="koreksi-masalah"><strong>${esc(k.kolom)}</strong>: ${esc(k.masalah)}</p>
          ${k.nilai ? `<p class="kecil">Nilai sekarang: <span class="mono">${esc(k.nilai)}</span></p>` : ''}
          ${k.saran ? `<p class="kecil redup">Saran: ${esc(k.saran)}</p>` : ''}
          ${k.catatan ? `<p class="kecil catatan-koreksi">📝 ${esc(k.catatan)}</p>` : ''}
          <p class="kecil redup">${esc(NAMA_SHEET[k.sheet] || k.sheet)} ${esc(k.ref_id)} · ${k.dusun ? 'Dusun ' + esc(k.dusun) : 'Dusun belum diketahui'}
            ${k.kode_aturan ? ' · ' + esc(k.kode_aturan) : ''} · ${esc(k.id_koreksi)}
            ${sudah && k.dicek_oleh ? ' · dicek ' + esc(k.dicek_oleh) : ''}</p>
          <div class="baris-tombol kiri">
            ${href ? `<a class="btn btn-utama" href="${href}">Kerjakan</a>` : ''}
            ${bisaTandai ? `<button class="btn" data-tandai="${sudah ? 'Belum' : 'Sudah'}" data-simpan>${sudah ? 'Buka lagi' : 'Tandai sudah'}</button>` : ''}
            ${bisaCatat ? '<button class="btn btn-tipis" data-catat data-simpan>Catatan</button>' : ''}
          </div>
        </li>`;
      }).join('')}</ul>
      ${jmlHal > 1 ? `<nav class="paging" aria-label="Halaman koreksi">
        <button class="btn" data-hal="${st.hal - 1}" ${st.hal <= 1 ? 'disabled' : ''}>‹ Sebelumnya</button>
        <span>Hal ${st.hal} / ${jmlHal}</span>
        <button class="btn" data-hal="${st.hal + 1}" ${st.hal >= jmlHal ? 'disabled' : ''}>Berikutnya ›</button></nav>` : ''}`;

    const cari = id => d.baris.find(k => k.id_koreksi === id);
    daftarEl.querySelectorAll('[data-tandai]').forEach(b => b.addEventListener('click', async () => {
      const k = cari(b.closest('[data-id]').dataset.id);
      const status = b.dataset.tandai;
      let catatan;
      if (status === 'Sudah') {
        catatan = await tanya('Tandai sudah', 'Catatan (opsional) — apa yang dicek / diperbaiki?', { nilai: k.catatan || '', ya: 'Tandai sudah' });
        if (catatan === null) return;
      }
      b.disabled = true;
      try {
        await api('tandaiKoreksi', { id_koreksi: k.id_koreksi, status, ...(catatan !== undefined ? { catatan } : {}) });
        toast(status === 'Sudah' ? 'Ditandai sudah' : 'Dibuka lagi', 'sukses');
        muat();
      } catch (e) { toast(e.message, 'galat'); b.disabled = false; }
    }));
    daftarEl.querySelectorAll('[data-catat]').forEach(b => b.addEventListener('click', async () => {
      const k = cari(b.closest('[data-id]').dataset.id);
      const catatan = await tanya('Catatan koreksi', 'Catatan untuk ' + (k.nomor_c ? 'C ' + k.nomor_c : k.ref_id), { nilai: k.catatan || '' });
      if (catatan === null) return;
      try {
        await api('tandaiKoreksi', { id_koreksi: k.id_koreksi, catatan });
        toast('Catatan disimpan', 'sukses');
        muat();
      } catch (e) { toast(e.message, 'galat'); }
    }));
    daftarEl.querySelectorAll('[data-hal]').forEach(b => b.addEventListener('click', () => {
      st.hal = Number(b.dataset.hal); window.scrollTo(0, 0); muat();
    }));
  }

  const ikat = (id, kunci) => {
    const x = el.querySelector(id);
    if (x) x.addEventListener('change', () => { st.filter[kunci] = x.value; st.hal = 1; muat(); });
  };
  ikat('#f-status', 'status');
  ikat('#f-prioritas', 'prioritas');
  ikat('#f-sheet', 'sheet');
  ikat('#f-dusun', 'dusun');
  el.querySelector('#q').addEventListener('input', debounce(e => { st.filter.q = e.target.value.trim(); st.hal = 1; muat(); }, 300));

  muat();
}
