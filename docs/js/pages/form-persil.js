// Form tambah / ubah persil.  Rute: #/persil/baru?c=<nomor_c>  |  #/persil/<id_persil>/ubah
import { api } from '../api.js';
import { punyaPeran } from '../auth.js';
import { muatRef } from '../ref.js';
import { esc, field, nilaiForm, tampilGalatForm, bersihkanGalatForm, konfirmasi, loading, galat, toast, fmtM2, fmtHa, normKelas } from '../ui.js';

export async function render(el, { params, query, masihAktif }) {
  if (!punyaPeran('admin', 'operator')) { galat(el, 'Hanya operator/admin yang bisa mengubah persil.'); return; }
  const baru = !params.id_persil;
  loading(el);
  const refP = muatRef(); // dimuat bersamaan dengan data
  let p = { nomor_c: query.c || '', no_persil: '', tipe: '', kelas: '', kelas_asli: '', luas_ha: '', luas_m2: '', status: 'Aktif', sebab_asli: '', catatan: '' };
  let mutasi = [];
  if (!baru) {
    try {
      const d = await api('detailPersil', { id_persil: params.id_persil });
      p = d.persil;
      mutasi = d.mutasi;
    } catch (e) {
      if (masihAktif()) galat(el, e, () => render(el, { params, query, masihAktif }));
      return;
    }
  }
  const ref = await refP;
  if (!masihAktif()) return;
  const kembali = p.nomor_c ? '#/c/' + encodeURIComponent(p.nomor_c) : '#/cari';
  const kelasAsliBeda = p.kelas_asli && p.kelas_asli !== p.kelas;

  el.innerHTML = `
    <div class="kepala-halaman">
      <a href="${kembali}" class="btn btn-tipis">‹ Batal</a>
      <h1>${baru ? 'Tambah persil' : 'Ubah persil ' + esc(p.no_persil)}</h1>
      ${baru ? '' : `<span class="redup kecil">${esc(p.id_persil)}</span>`}
    </div>
    <form class="kartu form" id="form-persil" novalidate>
      <p class="galat-form" role="alert" hidden></p>
      <div class="grid-form">
        ${field('Nomor C', 'nomor_c', p.nomor_c, { wajib: true, attr: 'autocomplete="off" spellcheck="false"',
          bantu: baru ? '' : 'Mengganti Nomor C memindahkan persil ini (beserta mutasinya) ke C lain.' })}
        ${field('No persil', 'no_persil', p.no_persil, { wajib: true, attr: 'autocomplete="off"' })}
        ${field('Tipe tanah', 'tipe', p.tipe, { wajib: true, pilihan: ref.tipe })}
        ${field('Kelas', 'kelas', p.kelas, { wajib: true, pilihan: ref.kelas,
          bantu: kelasAsliBeda ? 'Tertulis di buku: <strong>' + esc(p.kelas_asli) + '</strong>' : 'D = tanah kering, S = tanah basah' })}
        <div class="grid-2">
          ${field('Luas (ha)', 'luas_ha', p.luas_ha, { tipe: 'number', attr: 'min="0" step="any" inputmode="decimal"' })}
          ${field('Luas (m²)', 'luas_m2', p.luas_m2, { tipe: 'number', attr: 'min="0" step="any" inputmode="decimal"' })}
        </div>
        <p class="luas-total" aria-live="polite">Luas total: <strong id="luas-total">–</strong></p>
        ${field('Status', 'status', p.status, { wajib: true, pilihan: ref.status, kosong: false })}
        ${field('Sebab & tanggal perubahan (asli)', 'sebab_asli', p.sebab_asli, { tipe: 'textarea', baris: 2 })}
        ${field('Catatan', 'catatan', p.catatan, { tipe: 'textarea', baris: 2 })}
      </div>
      <div class="baris-tombol">
        ${baru ? '<span></span>' : '<button type="button" class="btn btn-bahaya" id="hapus" data-simpan>Hapus persil</button>'}
        <button type="submit" class="btn btn-utama" data-simpan>Simpan</button>
      </div>
    </form>
    ${baru ? '' : `<section class="kartu">
      <div class="kepala-bagian"><h2>Mutasi persil ini (${mutasi.length})</h2>
        <a class="btn btn-tipis" href="#/mutasi/baru?persil=${encodeURIComponent(p.id_persil)}" data-simpan>+ Mutasi</a></div>
      ${mutasi.length ? `<ul class="daftar-mutasi">${mutasi.map(m => `<li><strong>${esc(m.jenis || 'Jenis tak tertulis')}</strong>
        ${esc(m.tanggal || m.tahun || '')} · ${esc(m.arah || m.kata)} ${m.nomor_c_lawan ? 'C ' + esc(m.nomor_c_lawan) : ''}
        <div class="kecil redup mono">${esc(m.teks_asli)}</div></li>`).join('')}</ul>` : '<p class="redup">Belum ada mutasi.</p>'}
    </section>`}`;

  const form = el.querySelector('#form-persil');
  const total = el.querySelector('#luas-total');
  const hitung = () => {
    const m2 = (Number(form.luas_ha.value) || 0) * 10000 + (Number(form.luas_m2.value) || 0);
    total.textContent = m2 > 0 ? `${fmtM2(m2)} (${fmtHa(m2)})` : '–';
  };
  form.luas_ha.addEventListener('input', hitung);
  form.luas_m2.addEventListener('input', hitung);
  hitung();

  // Tipe → saring pilihan kelas yang cocok (D/S)
  const saringKelas = () => {
    const huruf = form.tipe.value.includes('(S)') ? 'S' : form.tipe.value.includes('(D)') ? 'D' : '';
    [...form.kelas.options].forEach(o => { if (o.value) o.hidden = !!huruf && o.value[0] !== huruf; });
    if (huruf && form.kelas.value && form.kelas.value[0] !== huruf) form.kelas.value = '';
  };
  form.tipe.addEventListener('change', saringKelas);
  saringKelas();

  form.addEventListener('submit', async e => {
    e.preventDefault();
    const v = nilaiForm(form);
    v.kelas = normKelas(v.kelas) || v.kelas;
    if (!baru) { v.id_persil = p.id_persil; v.diubah_pada_lama = p.diubah_pada || ''; }
    const tombol = form.querySelector('button[type=submit]');
    tombol.disabled = true;
    bersihkanGalatForm(form);
    try {
      const h = await api('simpanPersil', v);
      toast(baru ? 'Persil ditambahkan' : (h.berubah ? 'Perubahan disimpan' : 'Tidak ada perubahan'), 'sukses');
      location.hash = '#/c/' + encodeURIComponent(h.nomor_c);
    } catch (err) {
      if (err.code === 'CONFLICT') {
        if (await konfirmasi('Data sudah diubah orang lain', '<p>Persil ini baru saja diubah pengguna lain. Muat ulang?</p>', { ya: 'Muat ulang' })) {
          render(el, { params, query, masihAktif });
        }
      } else {
        tampilGalatForm(form, err);
        if (err.detail && err.detail.some(d => d.kode === 'V-05')) {
          const g = form.querySelector('.galat-form');
          g.innerHTML = esc(err.message) + ` <a href="#/c-baru?nomor=${encodeURIComponent(v.nomor_c)}">Buat C ${esc(v.nomor_c)}</a>`;
        }
      }
    } finally {
      tombol.disabled = false;
    }
  });

  const hapus = el.querySelector('#hapus');
  if (hapus) hapus.addEventListener('click', async () => {
    if (!await konfirmasi('Hapus persil?', `<p>Persil <strong>${esc(p.no_persil)}</strong> di C ${esc(p.nomor_c)} akan ditandai terhapus. Admin masih bisa memulihkannya.</p>`, { ya: 'Hapus', bahaya: true })) return;
    try {
      await api('hapus', { sheet: 'PERSIL', id: p.id_persil });
      toast('Persil dihapus', 'sukses');
      location.hash = kembali;
    } catch (err) { tampilGalatForm(form, err); }
  });
}
