import { api } from '../api.js';
import { getSesi, punyaPeran } from '../auth.js';
import { esc, fmtM2, fmtHa, fmtTanggal, loading, galat, modal, toast, tanya } from '../ui.js';

const linkC = n => n ? `<a href="#/c/${encodeURIComponent(n)}">C ${esc(n)}</a>` : '–';

export async function render(el, { params, masihAktif }) {
  const label = params.nomor_c || params.id_c;
  loading(el, 'Memuat C ' + label + '…');
  let d;
  try {
    d = await api('detailC', params.nomor_c ? { nomor_c: params.nomor_c } : { id_c: params.id_c });
  } catch (e) {
    if (!masihAktif()) return;
    galat(el, e.code === 'NOT_FOUND' ? `Nomor C ${label} tidak ditemukan.` : e, () => render(el, { params, masihAktif }));
    return;
  }
  if (!masihAktif()) return;
  const r = d.ringkas;
  const nomor = r.nomor_c || '(Nomor C kosong)';
  const sesi = getSesi();
  const operator = punyaPeran('admin', 'operator');
  const pimpinan = sesi.peran === 'pimpinan';
  const enc = encodeURIComponent;
  const hrefUbahC = c => c.nomor_c ? `#/c/${enc(c.nomor_c)}/ubah?id=${enc(c.id_c)}` : `#/c-id/${enc(c.id_c)}/ubah`;
  const kadusBoleh = c => sesi.peran === 'kadus' && (!c.dusun || c.dusun === sesi.dusun);

  el.innerHTML = `
    <div class="kepala-halaman">
      <a href="#/cari" class="btn btn-tipis" onclick="if(history.length>1){history.back();return false;}">‹ Kembali</a>
      <h1>C ${esc(nomor)}</h1>
      <span class="lencana ${r.status_c === 'Aktif' ? 'lencana-hijau' : 'lencana-abu'}">${esc(r.status_c)}</span>
      ${r.dobel ? '<span class="lencana lencana-peringatan">Nomor C dobel</span>' : ''}
    </div>
    ${operator && r.nomor_c ? `<div class="baris-tombol kiri aksi-atas">
      <a class="btn btn-utama" href="#/persil/baru?c=${enc(r.nomor_c)}" data-simpan>+ Tambah persil</a>
      <a class="btn" href="#/c-baru?nomor=${enc(r.nomor_c)}" data-simpan>+ Record lain dgn nomor ini</a>
    </div>` : ''}

    <div class="grid-pemilik ${d.records.length > 1 ? 'dobel' : ''}">
      ${d.records.map(c => `
        <section class="kartu">
          <h2 class="nama-pemilik">${esc(c.nama || c.nama_asli)}</h2>
          ${c.ket_dobel ? `<p><span class="lencana lencana-peringatan">${esc(c.ket_dobel)}</span></p>` : ''}
          <dl class="dl">
            ${c.nama_asli && c.nama_asli !== c.nama ? `<dt>Nama (asli)</dt><dd>${esc(c.nama_asli)}</dd>` : ''}
            <dt>Alamat</dt><dd>${esc(c.alamat || '–')}</dd>
            <dt>Dusun</dt><dd>${esc(c.dusun || 'Belum diketahui')}</dd>
            <dt>RT / RW</dt><dd>${esc(c.rt || '–')} / ${esc(c.rw || '–')}</dd>
            <dt>ID</dt><dd class="redup">${esc(c.id_c)}</dd>
            ${c.catatan ? `<dt>Catatan</dt><dd>${esc(c.catatan)}</dd>` : ''}
          </dl>
          <div class="baris-tombol kiri">
            ${c.file_scan ? `<button class="btn" data-scan="${esc(c.file_scan)}">Lihat scan (${esc(c.file_scan)})</button>` : ''}
            ${operator ? `<a class="btn" href="${hrefUbahC(c)}" data-simpan>Ubah</a>` : ''}
            ${kadusBoleh(c) ? `<a class="btn" href="${hrefUbahC(c)}" data-simpan>Isi dusun</a>` : ''}
            ${pimpinan ? '' : `<button class="btn btn-tipis" data-lapor="C" data-id="${esc(c.id_c)}" data-simpan>Laporkan masalah</button>`}
          </div>
        </section>`).join('')}
    </div>

    <section class="kartu ringkas">
      <div><span class="redup kecil">Persil</span><strong>${r.jml_persil}</strong></div>
      <div><span class="redup kecil">Persil aktif</span><strong>${r.jml_aktif}</strong></div>
      <div><span class="redup kecil">Luas aktif</span><strong>${fmtM2(r.luas_aktif)}</strong><span class="redup kecil">${fmtHa(r.luas_aktif)}</span></div>
      <div><span class="redup kecil">Luas semua</span><strong>${fmtM2(r.luas_total)}</strong><span class="redup kecil">${fmtHa(r.luas_total)}</span></div>
    </section>

    <section class="kartu">
      <h2>Persil (${d.persil.length})</h2>
      ${d.persil.length ? `<div class="gulir-x"><table class="tabel">
        <thead><tr><th>No persil</th><th>Tipe</th><th>Kelas</th><th class="angka">Luas</th><th>Status</th><th>Sebab (asli)</th>${pimpinan ? '' : '<th>Aksi</th>'}</tr></thead>
        <tbody>${d.persil.map(p => `
          <tr class="${p.status === 'Aktif' ? 'baris-aktif' : 'baris-nonaktif'}">
            <td>${esc(p.no_persil)}</td>
            <td>${esc(p.tipe)}</td>
            <td>${esc(p.kelas || p.kelas_asli || '–')}</td>
            <td class="angka">${fmtM2(p.luas_total)}<br><span class="kecil redup">${esc(p.luas_ha)} ha + ${esc(p.luas_m2)} m²</span></td>
            <td>${esc(p.status)}</td>
            <td class="kecil">${esc(p.sebab_asli || '')}</td>
            ${pimpinan ? '' : `<td class="aksi-sel">
              ${operator ? `<a href="#/persil/${enc(p.id_persil)}/ubah" data-simpan>Ubah</a>
              <a href="#/mutasi/baru?persil=${enc(p.id_persil)}" data-simpan>Mutasi</a>` : ''}
              <button class="tautan" data-lapor="PERSIL" data-id="${esc(p.id_persil)}" data-simpan>Lapor</button></td>`}
          </tr>`).join('')}</tbody></table></div>` : '<p class="redup">Belum ada persil.</p>'}
    </section>

    ${blokMutasi('Mutasi masuk', d.mutasi_masuk, 'dari')}
    ${blokMutasi('Mutasi keluar', d.mutasi_keluar, 'ke')}
    ${blokMutasi('Mutasi lain (tukar / arah tak tertulis)', d.mutasi_lain, 'lawan')}
    ${blokMutasi('Disebut di C lain', d.mutasi_disebut, 'di', true)}

    ${d.ptsl.length ? `<section class="kartu"><h2>PTSL terkait (${d.ptsl.length})</h2>
      <div class="gulir-x"><table class="tabel"><thead><tr><th>ID</th><th>Tahun</th><th>Pemohon</th><th>NIK</th><th>Persil</th><th class="angka">Luas</th><th>NIB</th></tr></thead>
      <tbody>${d.ptsl.map(p => `<tr><td>${esc(p.id_ptsl)}</td><td>${esc(p.tahun)}</td><td>${esc(p.pemohon)}</td>
        <td class="mono">${esc(p.nik)}</td><td>${esc(p.persil)}</td><td class="angka">${fmtM2(p.luas)}</td><td>${esc(p.nib || '–')}</td></tr>`).join('')}
      </tbody></table></div></section>` : ''}

    ${d.koreksi.length ? `<section class="kartu kartu-peringatan"><h2>Koreksi terbuka (${d.koreksi.length})</h2>
      <ul class="daftar-koreksi">${d.koreksi.map(k => `<li>
        <span class="lencana lencana-${k.prioritas === 'Tinggi' ? 'merah' : k.prioritas === 'Sedang' ? 'peringatan' : 'abu'}">${esc(k.prioritas)}</span>
        <strong>${esc(k.kolom)}</strong> (${esc(k.sheet)} ${esc(k.ref_id)}): ${esc(k.masalah)}
        ${k.saran ? `<div class="kecil redup">Saran: ${esc(k.saran)}</div>` : ''}
        ${k.catatan ? `<div class="kecil catatan-koreksi">📝 ${esc(k.catatan)}</div>` : ''}
        ${operator ? `<button class="btn btn-tipis" data-tandai="${esc(k.id_koreksi)}" data-simpan>Tandai sudah</button>` : ''}
        ${sesi.peran === 'kadus' ? `<button class="btn btn-tipis" data-catat="${esc(k.id_koreksi)}" data-simpan>Catatan</button>` : ''}
        </li>`).join('')}</ul>
      <p class="kecil"><a href="#/koreksi?q=${enc(r.nomor_c || '')}">Buka di antrean koreksi</a></p></section>` : ''}
  `;

  el.querySelectorAll('[data-scan]').forEach(b => b.addEventListener('click', () => lihatScan(b.dataset.scan)));
  const muatUlang = () => render(el, { params, masihAktif });

  el.querySelectorAll('[data-lapor]').forEach(b => b.addEventListener('click', async () => {
    const masalah = await tanya('Laporkan masalah', 'Apa yang salah? (mis. nama salah ketik, luas beda dengan buku)', { ya: 'Kirim laporan', wajib: true });
    if (!masalah) return;
    try {
      await api('laporKoreksi', { sheet: b.dataset.lapor, ref_id: b.dataset.id, masalah });
      toast('Laporan masuk ke antrean koreksi', 'sukses');
      muatUlang();
    } catch (e) { toast(e.message, 'galat'); }
  }));
  el.querySelectorAll('[data-tandai]').forEach(b => b.addEventListener('click', async () => {
    const catatan = await tanya('Tandai sudah', 'Catatan (opsional) — apa yang dicek / diperbaiki?', { ya: 'Tandai sudah' });
    if (catatan === null) return;
    try {
      await api('tandaiKoreksi', { id_koreksi: b.dataset.tandai, status: 'Sudah', catatan });
      toast('Ditandai sudah', 'sukses');
      muatUlang();
    } catch (e) { toast(e.message, 'galat'); }
  }));
  el.querySelectorAll('[data-catat]').forEach(b => b.addEventListener('click', async () => {
    const catatan = await tanya('Catatan koreksi', 'Catatan Anda', {});
    if (catatan === null) return;
    try {
      await api('tandaiKoreksi', { id_koreksi: b.dataset.catat, catatan });
      toast('Catatan disimpan', 'sukses');
      muatUlang();
    } catch (e) { toast(e.message, 'galat'); }
  }));
}

function blokMutasi(judul, daftar, kataLawan, tampilkanAsal = false) {
  if (!daftar || !daftar.length) return '';
  return `<section class="kartu"><h2>${esc(judul)} (${daftar.length})</h2>
    <ul class="daftar-mutasi">${daftar.map(m => `<li>
      <div><strong>${esc(m.jenis || 'Jenis tak tertulis')}</strong>
        ${m.tanggal ? fmtTanggal(m.tanggal) : esc(m.tahun || '')}
        · persil ${esc(m.no_persil)}
        · ${tampilkanAsal ? 'di ' + linkC(m.nomor_c) : kataLawan + ' ' + linkC(m.nomor_c_lawan)}
        ${m.nama_disebut ? ' · ' + esc(m.nama_disebut) : ''}
        ${m.perlu_cek ? `<span class="lencana lencana-peringatan">${esc(m.perlu_cek)}</span>` : ''}</div>
      <div class="kecil redup mono">${esc(m.teks_asli)}</div></li>`).join('')}</ul></section>`;
}

async function lihatScan(file) {
  const { wadah } = modal('Scan ' + file, '<div class="memuat"><span class="pemutar"></span>Memuat scan…</div>', { lebar: true });
  try {
    const s = await api('scan', { file });
    wadah.innerHTML = `<div class="zoom-wadah"><img alt="Scan ${esc(file)}" src="data:${esc(s.mime)};base64,${s.base64}"></div>
      <div class="zoom-tombol"><button class="btn" data-z="-1">−</button><button class="btn" data-z="0">100%</button><button class="btn" data-z="1">+</button></div>`;
    pasangZoom(wadah);
  } catch (e) {
    wadah.innerHTML = `<p>${e.code === 'NOT_FOUND' ? 'Scan belum tersedia.' : esc(e.message)}</p>`;
    if (e.code !== 'NOT_FOUND') toast(e.message, 'galat');
  }
}

/** Zoom cubit (2 jari) + tombol. */
function pasangZoom(wadah) {
  const box = wadah.querySelector('.zoom-wadah');
  const img = box.querySelector('img');
  let skala = 1;
  const atur = s => { skala = Math.min(5, Math.max(1, s)); img.style.width = (skala * 100) + '%'; };
  wadah.querySelectorAll('[data-z]').forEach(b => b.addEventListener('click', () => {
    const z = Number(b.dataset.z);
    atur(z === 0 ? 1 : skala * (z > 0 ? 1.4 : 1 / 1.4));
  }));
  const jari = new Map();
  let jarakAwal = 0, skalaAwal = 1;
  const jarak = () => { const [a, b] = [...jari.values()]; return Math.hypot(a.x - b.x, a.y - b.y); };
  box.addEventListener('pointerdown', e => { jari.set(e.pointerId, { x: e.clientX, y: e.clientY }); if (jari.size === 2) { jarakAwal = jarak(); skalaAwal = skala; } });
  box.addEventListener('pointermove', e => {
    if (!jari.has(e.pointerId)) return;
    jari.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (jari.size === 2 && jarakAwal) { e.preventDefault(); atur(skalaAwal * jarak() / jarakAwal); }
  });
  const lepas = e => { jari.delete(e.pointerId); if (jari.size < 2) jarakAwal = 0; };
  box.addEventListener('pointerup', lepas);
  box.addEventListener('pointercancel', lepas);
}
