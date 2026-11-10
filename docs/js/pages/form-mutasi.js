// Form mutasi baru.  Rute: #/mutasi/baru?persil=<id_persil>
import { api } from '../api.js';
import { punyaPeran } from '../auth.js';
import { muatRef } from '../ref.js';
import { esc, field, nilaiForm, tampilGalatForm, bersihkanGalatForm, loading, galat, toast, fmtM2 } from '../ui.js';

const LABEL_KATA = { ke: 'ke — tanah keluar ke C lain', dr: 'dr — tanah masuk dari C lain', di: 'di — tertulis "di" (dianggap masuk)', dg: 'dg — tukar dengan C lain' };

export async function render(el, { query, masihAktif }) {
  if (!punyaPeran('admin', 'operator')) { galat(el, 'Hanya operator/admin yang bisa menambah mutasi.'); return; }
  if (!query.persil) { galat(el, 'Persil asal tidak disebutkan.'); return; }
  loading(el);
  const refP = muatRef(); // dimuat bersamaan dengan data
  let d;
  try {
    d = await api('detailPersil', { id_persil: query.persil });
  } catch (e) {
    if (masihAktif()) galat(el, e, () => render(el, { query, masihAktif }));
    return;
  }
  const ref = await refP;
  if (!masihAktif()) return;
  const p = d.persil;
  const kembali = '#/c/' + encodeURIComponent(p.nomor_c);
  const arahDari = k => (ref.arah || {})[k] || '';

  el.innerHTML = `
    <div class="kepala-halaman">
      <a href="${kembali}" class="btn btn-tipis">‹ Batal</a>
      <h1>Mutasi persil ${esc(p.no_persil)}</h1>
    </div>
    <p class="kartu kecil">C ${esc(p.nomor_c)} · ${esc(p.tipe)} ${esc(p.kelas)} · ${fmtM2(p.luas_total)} · <strong>${esc(p.status)}</strong>
      ${d.pemilik.length ? '<br>Pemilik: ' + d.pemilik.map(x => esc(x.nama)).join(', ') : ''}</p>
    <form class="kartu form" id="form-mutasi" novalidate>
      <p class="galat-form" role="alert" hidden></p>
      <div class="grid-form">
        ${field('Arah', 'kata', 'ke', { wajib: true, kosong: false, pilihan: ['ke', 'dr', 'di', 'dg'].map(k => [k, LABEL_KATA[k]]) })}
        ${field('Jenis mutasi', 'jenis', '', { pilihan: ref.jenis, kosong: '— tidak tertulis —' })}
        <div class="grid-2">
          ${field('Tanggal', 'tanggal', '', { tipe: 'date' })}
          ${field('Tahun', 'tahun', '', { attr: 'inputmode="numeric" maxlength="4" placeholder="mis. 1995"', bantu: 'Isi bila tanggal tidak diketahui.' })}
        </div>
        ${field('Nomor C lawan', 'nomor_c_lawan', '', { attr: 'autocomplete="off" spellcheck="false"', bantu: 'C asal (untuk dr/di) atau C tujuan (untuk ke).' })}
        ${field('Nama disebut', 'nama_disebut', '')}
        ${field('Luas dipindah (m²)', 'luas', '', { tipe: 'number', attr: 'min="0" step="any" inputmode="decimal"', bantu: 'Kosongkan bila seluruh persil.' })}
        ${field('Teks asli di buku', 'teks_asli', '', { tipe: 'textarea', baris: 2 })}
        ${field('Catatan', 'catatan', '', { tipe: 'textarea', baris: 2 })}
      </div>
      <fieldset class="opsi-keluar" id="opsi-keluar">
        <legend>Tindak lanjut mutasi keluar</legend>
        <label class="chip-cek"><input type="checkbox" name="nonaktifkanAsal" checked><span>Nonaktifkan persil asal (status jadi Tidak Aktif)</span></label>
        <label class="chip-cek"><input type="checkbox" name="buatPersilTujuan" checked><span>Buat persil di C tujuan (status Aktif)</span></label>
      </fieldset>
      <div class="baris-tombol"><span></span><button type="submit" class="btn btn-utama" data-simpan>Simpan mutasi</button></div>
    </form>`;

  const form = el.querySelector('#form-mutasi');
  const opsi = el.querySelector('#opsi-keluar');
  const aturOpsi = () => { opsi.hidden = arahDari(form.kata.value) !== 'Keluar'; };
  form.kata.addEventListener('change', aturOpsi);
  aturOpsi();
  form.tanggal.addEventListener('change', () => { if (form.tanggal.value) form.tahun.value = form.tanggal.value.slice(0, 4); });

  form.addEventListener('submit', async e => {
    e.preventDefault();
    const v = nilaiForm(form);
    v.id_persil = p.id_persil;
    if (opsi.hidden) { v.nonaktifkanAsal = false; v.buatPersilTujuan = false; }
    const tombol = form.querySelector('button[type=submit]');
    tombol.disabled = true;
    bersihkanGalatForm(form);
    try {
      const h = await api('simpanMutasi', v);
      toast('Mutasi disimpan' + (h.id_persil_baru ? ' — persil baru dibuat di C ' + v.nomor_c_lawan : ''), 'sukses', 5000);
      (h.tanda || []).forEach(t => toast('Ditandai untuk dicek: ' + t, 'info', 5000));
      location.hash = kembali;
    } catch (err) {
      tampilGalatForm(form, err);
      if (err.detail && err.detail.some(x => x.kode === 'V-05')) {
        form.querySelector('.galat-form').innerHTML = esc(err.message) +
          ` <a href="#/c-baru?nomor=${encodeURIComponent(v.nomor_c_lawan)}">Buat C ${esc(v.nomor_c_lawan)}</a>`;
      }
    } finally {
      tombol.disabled = false;
    }
  });
}
