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

/** Dialog konfirmasi → Promise<boolean>. */
export function konfirmasi(judul, pesanHtml, { ya = 'Ya, lanjutkan', batal = 'Batal', bahaya = false } = {}) {
  return new Promise(resolve => {
    const isi = document.createElement('div');
    isi.innerHTML = `<div class="konfirmasi-isi">${pesanHtml}</div>
      <div class="baris-tombol"><button class="btn" data-b="0">${esc(batal)}</button>
      <button class="btn ${bahaya ? 'btn-bahaya-isi' : 'btn-utama'}" data-b="1">${esc(ya)}</button></div>`;
    let selesai = false;
    const m = modal(judul, isi);
    const akhiri = v => { if (selesai) return; selesai = true; m.tutup(); resolve(v); };
    isi.querySelectorAll('[data-b]').forEach(b => b.addEventListener('click', () => akhiri(b.dataset.b === '1')));
    document.querySelectorAll('#modal [data-tutup]').forEach(b => b.addEventListener('click', () => akhiri(false)));
    isi.querySelector('[data-b="1"]').focus();
  });
}

/** Dialog isian teks → Promise<string|null>. */
export function tanya(judul, label, { nilai = '', ya = 'Simpan', wajib = false, baris = 3 } = {}) {
  return new Promise(resolve => {
    const isi = document.createElement('form');
    isi.className = 'form';
    isi.innerHTML = `<label class="field"><span>${esc(label)}</span>
      <textarea rows="${baris}" name="t">${esc(nilai)}</textarea></label>
      <div class="baris-tombol"><button type="button" class="btn" data-b="0">Batal</button>
      <button type="submit" class="btn btn-utama">${esc(ya)}</button></div>`;
    let selesai = false;
    const m = modal(judul, isi);
    const akhiri = v => { if (selesai) return; selesai = true; m.tutup(); resolve(v); };
    isi.querySelector('[data-b="0"]').addEventListener('click', () => akhiri(null));
    document.querySelectorAll('#modal [data-tutup]').forEach(b => b.addEventListener('click', () => akhiri(null)));
    isi.addEventListener('submit', e => {
      e.preventDefault();
      const v = isi.t.value.trim();
      if (wajib && !v) { isi.t.focus(); return; }
      akhiri(v);
    });
    isi.t.focus();
  });
}

/** Tampilkan galat VALIDATION di bawah field ([name=kolom]) dan ringkasan di atas form. */
export function tampilGalatForm(form, err) {
  bersihkanGalatForm(form);
  const ringkas = form.querySelector('.galat-form');
  const detail = (err && err.detail) || [];
  let tertaut = 0;
  detail.forEach(d => {
    const f = form.querySelector(`[name="${d.kolom}"]`);
    if (!f) return;
    tertaut++;
    f.setAttribute('aria-invalid', 'true');
    const p = document.createElement('p');
    p.className = 'galat-field';
    p.textContent = d.pesan;
    (f.closest('.field') || f.parentElement).appendChild(p);
  });
  if (ringkas) {
    ringkas.hidden = false;
    ringkas.textContent = err.message || String(err);
  }
  const pertama = form.querySelector('[aria-invalid="true"]');
  if (pertama) pertama.focus(); else if (ringkas) ringkas.scrollIntoView({ block: 'center' });
  return tertaut;
}

export function bersihkanGalatForm(form) {
  form.querySelectorAll('.galat-field').forEach(x => x.remove());
  form.querySelectorAll('[aria-invalid]').forEach(x => x.removeAttribute('aria-invalid'));
  const r = form.querySelector('.galat-form');
  if (r) { r.hidden = true; r.textContent = ''; }
}

/** Helper HTML field. opsi: {tipe, wajib, pilihan:[[nilai,label]], bantu, attr, kosong} */
export function field(label, name, nilai = '', o = {}) {
  const id = 'f-' + name;
  const wajib = o.wajib ? ' <span class="wajib" aria-hidden="true">*</span>' : '';
  let input;
  if (o.pilihan) {
    input = `<select id="${id}" name="${name}" ${o.wajib ? 'required' : ''} ${o.attr || ''}>
      ${o.kosong !== false ? `<option value="">${esc(o.kosong || '— pilih —')}</option>` : ''}
      ${o.pilihan.map(p => { const [v, l] = Array.isArray(p) ? p : [p, p];
        return `<option value="${esc(v)}" ${String(v) === String(nilai ?? '') ? 'selected' : ''}>${esc(l)}</option>`; }).join('')}
    </select>`;
  } else if (o.tipe === 'textarea') {
    input = `<textarea id="${id}" name="${name}" rows="${o.baris || 3}" ${o.attr || ''}>${esc(nilai)}</textarea>`;
  } else {
    input = `<input id="${id}" name="${name}" type="${o.tipe || 'text'}" value="${esc(nilai)}" ${o.wajib ? 'required' : ''} ${o.attr || ''}>`;
  }
  return `<div class="field"><label for="${id}">${esc(label)}${wajib}</label>${input}
    ${o.bantu ? `<p class="bantu">${o.bantu}</p>` : ''}</div>`;
}

/** Ambil nilai form sebagai objek (checkbox → boolean). */
export function nilaiForm(form) {
  const o = {};
  form.querySelectorAll('input[name], select[name], textarea[name]').forEach(el => {
    o[el.name] = el.type === 'checkbox' ? el.checked : el.value.trim();
  });
  return o;
}
