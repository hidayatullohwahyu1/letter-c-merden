// Helper tampilan: escape, toast, modal, loading, format angka/tanggal/luas, NIK, kelas.

export function esc(v) {
  return String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export function fmtAngka(n, desimal = 0) {
  const x = Number(n);
  if (!isFinite(x)) return '';
  return x.toLocaleString('id-ID', { maximumFractionDigits: desimal });
}

/** 1234 → "1.234 m²" */
export function fmtM2(m2) {
  return fmtAngka(m2) + ' m²';
}

/** 1234 (m²) → "0,12 ha" */
export function fmtHa(m2) {
  return (Number(m2) / 10000).toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ha';
}

/** "2019-09-11" → "11/09/2019" */
export function fmtTanggal(s) {
  const m = String(s || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : String(s || '');
}

export function maskNik(nik) {
  const d = String(nik || '').replace(/\D/g, '');
  if (d.length !== 16) return nik ? '••••' : '';
  return d.slice(0, 4) + ' ' + d.slice(4, 6) + '•• •••• ' + d.slice(12);
}

export function normKelas(v) {
  const k = String(v || '').toUpperCase().replace(/[\s.\-]/g, '');
  const m = k.match(/^([DS])(VIII|VII|VI|IV|V|III|II|I|[1-8])$/);
  if (!m) return null;
  const r = { 1: 'I', 2: 'II', 3: 'III', 4: 'IV', 5: 'V', 6: 'VI', 7: 'VII', 8: 'VIII' }[m[2]] || m[2];
  return m[1] + '-' + r;
}

export function debounce(fn, ms = 300) {
  let t;
  return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
}

export function toast(pesan, jenis = 'info', ms = 3500) {
  const box = document.getElementById('toast');
  const el = document.createElement('div');
  el.className = 'toast toast-' + jenis;
  el.setAttribute('role', 'status');
  el.textContent = pesan;
  box.appendChild(el);
  setTimeout(() => el.remove(), ms);
}

/** Buka modal; isi = string HTML atau Node. Mengembalikan fungsi tutup. */
export function modal(judul, isi, { lebar = false } = {}) {
  const root = document.getElementById('modal');
  root.innerHTML = `
    <div class="modal-latar" data-tutup></div>
    <div class="modal-kotak ${lebar ? 'modal-lebar' : ''}" role="dialog" aria-modal="true" aria-label="${esc(judul)}">
      <div class="modal-kepala"><h2>${esc(judul)}</h2>
        <button class="btn-ikon" data-tutup aria-label="Tutup">✕</button></div>
      <div class="modal-isi"></div>
    </div>`;
  const wadah = root.querySelector('.modal-isi');
  if (typeof isi === 'string') wadah.innerHTML = isi; else wadah.appendChild(isi);
  root.hidden = false;
  const tutup = () => { root.hidden = true; root.innerHTML = ''; document.removeEventListener('keydown', esc_); };
  const esc_ = e => { if (e.key === 'Escape') tutup(); };
  document.addEventListener('keydown', esc_);
  root.querySelectorAll('[data-tutup]').forEach(b => b.addEventListener('click', tutup));
  return { tutup, wadah };
}

export function loading(el, teks = 'Memuat…') {
  el.innerHTML = `<div class="memuat"><span class="pemutar" aria-hidden="true"></span>${esc(teks)}</div>`;
}

export function galat(el, e, ulang) {
  el.innerHTML = `<div class="kartu kartu-galat"><p>${esc(e && e.message ? e.message : e)}</p>
    ${ulang ? '<button class="btn" data-ulang>Coba lagi</button>' : ''}</div>`;
  if (ulang) el.querySelector('[data-ulang]').addEventListener('click', ulang);
}

/** Parse query string dari hash: "#/cari?q=12" → {q:'12'} */
export function parseQuery(qs) {
  const o = {};
  new URLSearchParams(qs || '').forEach((v, k) => { o[k] = v; });
  return o;
}
