// Form tambah / ubah data C.
// Rute: #/c-baru?nomor=…  |  #/c/<nomor_c>/ubah?id=<id_c>  |  #/c-id/<id_c>/ubah
import { api } from '../api.js';
import { getSesi, punyaPeran } from '../auth.js';
import { muatRef } from '../ref.js';
import { esc, field, nilaiForm, tampilGalatForm, bersihkanGalatForm, konfirmasi, loading, galat, toast } from '../ui.js';

const hrefC = (nomor, id) => nomor ? '#/c/' + encodeURIComponent(nomor) : '#/c-id/' + encodeURIComponent(id);

export async function render(el, { params, query, masihAktif }) {
  const sesi = getSesi();
  const baru = !params.nomor_c && !params.id_c;
  if (baru && !punyaPeran('admin', 'operator')) { galat(el, 'Hanya operator/admin yang bisa menambah data C.'); return; }
  if (!baru && !punyaPeran('admin', 'operator', 'kadus')) { galat(el, 'Peran Anda hanya bisa melihat data.'); return; }

  loading(el);
  let rec = null, jmlPersil = 0, dobel = false;
  const refP = muatRef(); // dimuat bersamaan dengan data
  if (!baru) {
    try {
      const d = await api('detailC', params.nomor_c ? { nomor_c: params.nomor_c } : { id_c: params.id_c });
      const id = query.id || params.id_c;
      rec = id ? d.records.find(r => r.id_c === id) : d.records[0];
      if (!rec) throw new Error('Record ' + id + ' tidak ditemukan');
      jmlPersil = d.persil.length;
      dobel = d.records.length > 1;
    } catch (e) {
      if (masihAktif()) galat(el, e, () => render(el, { params, query, masihAktif }));
      return;
    }
  }
  const ref = await refP;
  if (!masihAktif()) return;

  const kadus = sesi.peran === 'kadus';
  const r = rec || { nomor_c: query.nomor || '', nama: '', nama_asli: '', alamat: '', dusun: '', rt: '', rw: '', file_scan: '', ket_dobel: '', catatan: '' };
  const kembali = baru ? '#/cari' : hrefC(rec.nomor_c, rec.id_c);
  const dusunPilihan = kadus ? [[sesi.dusun, 'Dusun ' + sesi.dusun]] : ref.dusun.map(d => [d, 'Dusun ' + d]);

  el.innerHTML = `
    <div class="kepala-halaman">
      <a href="${kembali}" class="btn btn-tipis">‹ Batal</a>
      <h1>${baru ? 'Tambah data C' : 'Ubah C ' + esc(r.nomor_c || '(kosong)')}</h1>
      ${rec ? `<span class="redup kecil">${esc(rec.id_c)}</span>` : ''}
    </div>
    ${kadus ? '<p class="kartu kecil">Sebagai Kadus, Anda hanya bisa mengisi <strong>dusun</strong> untuk record yang dusunnya belum diketahui atau di wilayah Anda.</p>' : ''}
    <form class="kartu form" id="form-c" novalidate>
      <p class="galat-form" role="alert" hidden></p>
      <div class="grid-form">
        ${field('Nomor C', 'nomor_c', r.nomor_c, { wajib: true, attr: (kadus ? 'readonly' : '') + ' autocomplete="off" spellcheck="false"',
          bantu: 'Boleh berhuruf (3657b) atau gabungan (3252/3227).' })}
        ${field('Nama pemilik', 'nama', r.nama, { wajib: true, attr: kadus ? 'readonly' : '' })}
        ${field('Nama di buku (asli)', 'nama_asli', r.nama_asli, { attr: kadus ? 'readonly' : '', bantu: 'Ejaan persis seperti tertulis di buku C.' })}
        ${field('Alamat', 'alamat', r.alamat, { attr: kadus ? 'readonly' : '' })}
        ${field('Dusun', 'dusun', r.dusun, { pilihan: dusunPilihan, kosong: 'Belum diketahui' })}
        <div class="grid-2">
          ${field('RT', 'rt', r.rt, { attr: (kadus ? 'readonly' : '') + ' inputmode="numeric"' })}
          ${field('RW', 'rw', r.rw, { attr: (kadus ? 'readonly' : '') + ' inputmode="numeric"' })}
        </div>
        ${field('Nama file scan', 'file_scan', r.file_scan, { attr: kadus ? 'readonly' : '', bantu: 'mis. IMG0001.jpg' })}
        ${field('Keterangan dobel', 'ket_dobel', r.ket_dobel, { attr: kadus ? 'readonly' : '' })}
        ${field('Catatan', 'catatan', r.catatan, { tipe: 'textarea', attr: kadus ? 'readonly' : '' })}
      </div>
      <label class="chip-cek" id="baris-pindah" hidden>
        <input type="checkbox" name="ikutkanPersil" ${dobel ? '' : 'checked'}>
        <span>Pindahkan juga ${jmlPersil} persil & mutasinya ke Nomor C baru</span>
      </label>
      <div class="baris-tombol">
        ${!baru && !kadus ? '<button type="button" class="btn btn-bahaya" id="hapus" data-simpan>Hapus record</button>' : '<span></span>'}
        <button type="submit" class="btn btn-utama" data-simpan>Simpan</button>
      </div>
    </form>`;

  const form = el.querySelector('#form-c');
  const nomorAwal = r.nomor_c;
  const barisPindah = el.querySelector('#baris-pindah');
  form.nomor_c.addEventListener('input', () => {
    barisPindah.hidden = baru || !jmlPersil || form.nomor_c.value.trim().toUpperCase() === String(nomorAwal).toUpperCase();
  });

  async function kirim(konfirm) {
    const v = nilaiForm(form);
    const data = kadus ? { id_c: rec.id_c, dusun: v.dusun } : { ...v, ikutkanPersil: !barisPindah.hidden && v.ikutkanPersil };
    if (rec) { data.id_c = rec.id_c; data.diubah_pada_lama = rec.diubah_pada || ''; }
    if (konfirm) data.konfirmasi = true;
    const tombol = form.querySelector('button[type=submit]');
    tombol.disabled = true;
    bersihkanGalatForm(form);
    try {
      const h = await api('simpanC', data);
      if (h.perlu_konfirmasi) {
        const ok = await konfirmasi('Periksa dulu', h.peringatan.map(p => `<p><strong>${esc(p.kode)}</strong> ${esc(p.pesan)}</p>`).join(''),
          { ya: 'Tetap simpan' });
        if (ok) return kirim(true);
        return;
      }
      toast(baru ? 'Data C ditambahkan' : (h.berubah ? 'Perubahan disimpan' : 'Tidak ada perubahan'), 'sukses');
      if (h.persil_dipindah) toast(h.persil_dipindah + ' persil ikut dipindah', 'sukses');
      (h.tanda || []).forEach(t => toast('Ditandai untuk dicek: ' + t, 'info', 5000));
      location.hash = hrefC(h.nomor_c, h.id_c);
    } catch (e) {
      if (e.code === 'CONFLICT') {
        if (await konfirmasi('Data sudah diubah orang lain', '<p>Record ini baru saja diubah pengguna lain. Muat ulang untuk melihat data terbaru? Isian Anda akan hilang.</p>', { ya: 'Muat ulang' })) {
          render(el, { params, query, masihAktif });
        }
      } else {
        tampilGalatForm(form, e);
      }
    } finally {
      tombol.disabled = false;
    }
  }

  form.addEventListener('submit', e => { e.preventDefault(); kirim(false); });

  const hapus = el.querySelector('#hapus');
  if (hapus) hapus.addEventListener('click', async () => {
    const ok = await konfirmasi('Hapus record?', `<p>Record <strong>${esc(rec.id_c)}</strong> (${esc(rec.nama)}) akan ditandai terhapus. Admin masih bisa memulihkannya.</p>`,
      { ya: 'Hapus', bahaya: true });
    if (!ok) return;
    try {
      await api('hapus', { sheet: 'C', id: rec.id_c });
      toast('Record dihapus', 'sukses');
      location.hash = dobel ? hrefC(rec.nomor_c) : '#/cari';
    } catch (e) {
      tampilGalatForm(form, e);
    }
  });
}
