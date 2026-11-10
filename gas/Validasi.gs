/**
 * Validasi.gs — aturan V-01…V-10 (dipakai saat simpan dan periksaUlang).
 * Hasil: { galat:[{kode, kolom, pesan}], peringatan:[{kode, pesan}], tanda:[{kode, kolom, masalah, prioritas}] }
 *  - galat      → simpan ditolak (VALIDATION, detail per kolom)
 *  - peringatan → perlu konfirmasi (kirim ulang dengan konfirmasi:true)
 *  - tanda      → diizinkan, tetapi dicatat ke antrean KOREKSI
 */

const KELAS_VALID = ['D-I', 'D-II', 'D-III', 'D-IV', 'D-V', 'D-VI', 'D-VII', 'S-I', 'S-II', 'S-III', 'S-IV', 'S-V', 'S-VI', 'S-VII'];
const TIPE_VALID = ['Tanah Kering (D)', 'Tanah Basah(S)'];
const STATUS_VALID = ['Aktif', 'Tidak Aktif'];
const JENIS_VALID = ['Jual', 'Beli', 'Waris', 'Hibah', 'Tukar', 'Pecah', 'Putusan Pengadilan', 'Gadai', 'Lainnya'];
const KATA_VALID = ['ke', 'dr', 'di', 'dg'];
const DUSUN_VALID = ['I', 'II', 'III', 'IV', 'V'];

function hasilBaru_() { return { galat: [], peringatan: [], tanda: [] }; }

function nomorBerhuruf_(n) { return /[^0-9]/.test(str_(n)); }

/** Record C lain (tidak dihapus) dengan nomor_c sama. */
function cLainSamaNomor_(nomor, idSendiri) {
  const U = str_(nomor).toUpperCase();
  return readSheet_('C').filter(r => !isTrue_(r.dihapus) && str_(r.id_c) !== idSendiri && str_(r.nomor_c).toUpperCase() === U);
}

function adaNomorC_(nomor) {
  const U = str_(nomor).toUpperCase();
  return U !== '' && readSheet_('C').some(r => !isTrue_(r.dihapus) && str_(r.nomor_c).toUpperCase() === U);
}

function rapatNama_(s) { return str_(s).toUpperCase().replace(/[.\s,]/g, ''); }

/** cekNomor=false → lewati V-02/V-03/V-04 (nomor tidak berubah saat mengubah record lama). */
function validasiC_(c, idSendiri, cekNomor) {
  const h = hasilBaru_();
  const nomor = str_(c.nomor_c);
  if (!nomor) h.galat.push({ kode: 'V-01', kolom: 'nomor_c', pesan: 'Nomor C wajib diisi' });
  if (!str_(c.nama) && !str_(c.nama_asli)) h.galat.push({ kode: '', kolom: 'nama', pesan: 'Nama pemilik wajib diisi' });
  if (str_(c.dusun) && DUSUN_VALID.indexOf(str_(c.dusun)) < 0) h.galat.push({ kode: '', kolom: 'dusun', pesan: 'Dusun harus I–V' });
  if (nomor && cekNomor !== false) {
    const lain = cLainSamaNomor_(nomor, idSendiri);
    const nama = rapatNama_(c.nama || c.nama_asli);
    const beda = lain.filter(r => rapatNama_(r.nama || r.nama_asli) !== nama);
    const sama = lain.filter(r => rapatNama_(r.nama || r.nama_asli) === nama && str_(r.file_scan) === str_(c.file_scan));
    if (beda.length) h.peringatan.push({ kode: 'V-02', pesan: 'Nomor C ' + nomor + ' sudah dipakai pemilik lain: ' + beda.map(r => (r.nama || r.nama_asli) + ' (' + r.id_c + ')').join(', ') + '. Tetap simpan sebagai nomor dobel?' });
    if (sama.length) h.peringatan.push({ kode: 'V-03', pesan: 'Sudah ada record dengan Nomor C, nama, dan scan yang sama (' + sama.map(r => r.id_c).join(', ') + '). Kemungkinan record ganda. Tetap simpan?' });
    if (nomorBerhuruf_(nomor)) h.tanda.push({ kode: 'V-04', kolom: 'Nomor C', masalah: 'Nomor C berhuruf/gabungan: ' + nomor, saran: 'Cocokkan dengan buku C fisik', prioritas: 'Sedang' });
  }
  return h;
}

function validasiPersil_(p) {
  const h = hasilBaru_();
  const nomor = str_(p.nomor_c);
  if (!nomor) h.galat.push({ kode: 'V-01', kolom: 'nomor_c', pesan: 'Nomor C wajib diisi' });
  else if (!adaNomorC_(nomor)) h.galat.push({ kode: 'V-05', kolom: 'nomor_c', pesan: 'Nomor C ' + nomor + ' belum ada di Letter C. Buat data C-nya dulu.' });
  if (!str_(p.no_persil)) h.galat.push({ kode: '', kolom: 'no_persil', pesan: 'No persil wajib diisi' });
  if (TIPE_VALID.indexOf(str_(p.tipe)) < 0) h.galat.push({ kode: '', kolom: 'tipe', pesan: 'Pilih tipe tanah' });
  const kelas = str_(p.kelas);
  if (KELAS_VALID.indexOf(kelas) < 0) h.galat.push({ kode: 'V-06', kolom: 'kelas', pesan: 'Kelas harus D-I…D-VII atau S-I…S-VII' });
  else if (TIPE_VALID.indexOf(str_(p.tipe)) >= 0) {
    const hurufTipe = str_(p.tipe).indexOf('(S)') >= 0 ? 'S' : 'D';
    if (kelas.charAt(0) !== hurufTipe) h.galat.push({ kode: 'V-07', kolom: 'kelas', pesan: 'Kelas ' + kelas + ' tidak cocok dengan tipe (D = tanah kering, S = tanah basah)' });
  }
  if (luasTotal_(p) <= 0) h.galat.push({ kode: 'V-08', kolom: 'luas_m2', pesan: 'Luas wajib diisi dan lebih dari 0' });
  if (num_(p.luas_ha) < 0 || num_(p.luas_m2) < 0) h.galat.push({ kode: 'V-08', kolom: 'luas_m2', pesan: 'Luas tidak boleh negatif' });
  if (STATUS_VALID.indexOf(str_(p.status)) < 0) h.galat.push({ kode: '', kolom: 'status', pesan: 'Pilih status Aktif / Tidak Aktif' });
  return h;
}

function validasiMutasi_(m) {
  const h = hasilBaru_();
  if (!str_(m.id_persil)) h.galat.push({ kode: '', kolom: 'id_persil', pesan: 'Persil asal wajib dipilih' });
  if (str_(m.jenis) && JENIS_VALID.indexOf(str_(m.jenis)) < 0) h.galat.push({ kode: '', kolom: 'jenis', pesan: 'Jenis mutasi tidak dikenal' });
  if (KATA_VALID.indexOf(str_(m.kata)) < 0) h.galat.push({ kode: '', kolom: 'kata', pesan: 'Pilih arah (ke / dr / di / dg)' });
  if (str_(m.tanggal) && !/^\d{4}-\d{2}-\d{2}$/.test(str_(m.tanggal))) h.galat.push({ kode: '', kolom: 'tanggal', pesan: 'Tanggal tidak sah' });
  if (!str_(m.tanggal) && !str_(m.tahun)) h.galat.push({ kode: '', kolom: 'tahun', pesan: 'Isi tanggal atau tahun' });
  if (str_(m.tahun) && !/^\d{4}$/.test(str_(m.tahun))) h.galat.push({ kode: '', kolom: 'tahun', pesan: 'Tahun harus 4 angka' });
  if (str_(m.nomor_c_lawan) && !adaNomorC_(m.nomor_c_lawan)) {
    h.tanda.push({ kode: 'V-10', kolom: 'Nomor C Lawan', masalah: 'Nomor C lawan ' + str_(m.nomor_c_lawan) + ' tidak ada di Letter C', saran: 'Cek nomor di buku C / tambah data C', prioritas: 'Rendah' });
  }
  return h;
}

/** Lempar VALIDATION bila ada galat (detail per kolom untuk ditampilkan di bawah field). */
function lemparGalat_(h) {
  if (!h.galat.length) return;
  const e = err_('VALIDATION', h.galat.map(g => g.pesan).join('; '));
  e.detail = h.galat;
  throw e;
}

/** Catat tanda ke KOREKSI (tanpa duplikat). */
function catatTanda_(h, sheet, refId, nomorC, nilai) {
  h.tanda.forEach(t => tambahKoreksi_({
    sheet: sheet, ref_id: refId, nomor_c: nomorC, kolom: t.kolom, nilai: nilai,
    masalah: t.masalah, saran: t.saran || '', prioritas: t.prioritas, kode_aturan: t.kode
  }));
}

/** Tambah masalah ke KOREKSI bila belum ada (kunci: kode_aturan+ref_id, atau ref_id+kolom). */
function tambahKoreksi_(k) {
  const ada = readSheet_('KOREKSI').some(x => str_(x.ref_id) === str_(k.ref_id) &&
    ((k.kode_aturan && str_(x.kode_aturan) === k.kode_aturan) || str_(x.kolom) === str_(k.kolom)));
  if (ada) return null;
  const r = simpanBaris_('KOREKSI', Object.assign({ status: 'Belum' }, k));
  return r.id;
}

/**
 * periksaUlang (admin): jalankan V-01…V-10 pada seluruh data, tambah masalah yang belum ada.
 * Tidak mengubah masalah yang sudah ada / sudah 'Sudah'.
 */
function aksiPeriksaUlang_(data, sesi) {
  return denganKunci_(() => {
    const C = readSheet_('C').filter(r => !isTrue_(r.dihapus));
    const P = readSheet_('PERSIL').filter(r => !isTrue_(r.dihapus));
    const M = readSheet_('MUTASI').filter(r => !isTrue_(r.dihapus));
    const K = readSheet_('KOREKSI');
    const kunci = {};
    K.forEach(x => { kunci[str_(x.kode_aturan) + '|' + str_(x.ref_id)] = 1; kunci['kol|' + str_(x.ref_id) + '|' + str_(x.kolom)] = 1; });
    const baru = [];
    const tambah = (kode, sheet, ref, nomor, kolom, nilai, masalah, saran, prio) => {
      if (kunci[kode + '|' + ref] || kunci['kol|' + ref + '|' + kolom]) return;
      kunci[kode + '|' + ref] = 1; kunci['kol|' + ref + '|' + kolom] = 1;
      baru.push({ sheet: sheet, ref_id: ref, nomor_c: nomor, kolom: kolom, nilai: nilai, masalah: masalah, saran: saran,
                  prioritas: prio, status: 'Belum', kode_aturan: kode });
    };

    const perNomor = {};
    C.forEach(c => { const u = str_(c.nomor_c).toUpperCase(); (perNomor[u] = perNomor[u] || []).push(c); });
    const persilPerNomor = {};
    P.forEach(p => { const u = str_(p.nomor_c).toUpperCase(); persilPerNomor[u] = (persilPerNomor[u] || 0) + 1; });

    C.forEach(c => {
      const n = str_(c.nomor_c), u = n.toUpperCase();
      if (!n) { tambah('V-01', 'C', c.id_c, '', 'Nomor C', '', 'Nomor C kosong', 'Isi Nomor C dari buku C fisik', 'Tinggi'); return; }
      const lain = perNomor[u].filter(x => x.id_c !== c.id_c);
      const nm = rapatNama_(c.nama || c.nama_asli);
      if (lain.some(x => rapatNama_(x.nama || x.nama_asli) !== nm)) tambah('V-02', 'C', c.id_c, n, 'Nomor C', n, 'Nomor C sama, nama pemilik beda', 'Cocokkan dengan buku C fisik / scan', 'Tinggi');
      else if (lain.some(x => rapatNama_(x.nama || x.nama_asli) === nm && str_(x.file_scan) === str_(c.file_scan))) tambah('V-03', 'C', c.id_c, n, 'Nomor C', n, 'Record ganda: Nomor C, nama, dan scan sama', 'Hapus salah satu bila memang ganda', 'Sedang');
      if (nomorBerhuruf_(n)) tambah('V-04', 'C', c.id_c, n, 'Nomor C', n, 'Nomor C berhuruf/gabungan', 'Cocokkan dengan buku C fisik', 'Sedang');
      if (!persilPerNomor[u]) tambah('V-09', 'C', c.id_c, n, 'Jml Persil', '0', 'C tanpa persil', 'Tambah persil dari buku C, atau tandai sudah dicek', 'Sedang');
    });
    P.forEach(p => {
      const n = str_(p.nomor_c), u = n.toUpperCase();
      if (!perNomor[u] || !n) tambah('V-05', 'PERSIL', p.id_persil, n, 'Nomor C', n, 'Persil memakai Nomor C yang tidak ada di Letter C', 'Buat data C atau perbaiki nomor', 'Tinggi');
      const kelas = str_(p.kelas);
      if (KELAS_VALID.indexOf(kelas) < 0) tambah('V-06', 'PERSIL', p.id_persil, n, 'Kelas Tanah', kelas || str_(p.kelas_asli), 'Kelas di luar daftar baku', 'Pilih kelas D-I…D-VII / S-I…S-VII', 'Sedang');
      else if (kelas.charAt(0) !== (str_(p.tipe).indexOf('(S)') >= 0 ? 'S' : 'D')) tambah('V-07', 'PERSIL', p.id_persil, n, 'Kelas Tanah', kelas, 'Huruf kelas tidak cocok dengan tipe tanah', 'D = tanah kering, S = tanah basah', 'Sedang');
      if (luasTotal_(p) <= 0) tambah('V-08', 'PERSIL', p.id_persil, n, 'Luas', '0', 'Luas kosong / 0', 'Isi luas dari buku C', 'Sedang');
    });
    M.forEach(m => {
      const l = str_(m.nomor_c_lawan);
      if (l && !perNomor[l.toUpperCase()]) tambah('V-10', 'MUTASI', m.id_mutasi, str_(m.nomor_c), 'Nomor C Lawan', l, 'Nomor C lawan tidak ada di Letter C', 'Cek nomor di buku C / tambah data C', 'Rendah');
    });

    if (baru.length) {
      const sh = db_().getSheetByName('KOREKSI');
      const h = HEADER.KOREKSI;
      let next = Number((nextId_(K, 'id_koreksi', 'K').match(/\d+$/) || ['1'])[0]);
      const rows = baru.map(o => { o.id_koreksi = 'K' + ('00000' + (next++)).slice(-5); return h.map(k => nilaiSel_('KOREKSI', k, o[k])); });
      const r = sh.getLastRow() + 1;
      if (r + rows.length > sh.getMaxRows()) sh.insertRowsAfter(sh.getMaxRows(), rows.length + 100);
      sh.getRange(r, 1, rows.length, h.length).setNumberFormat('@').setValues(rows);
      delete MEMO_.KOREKSI;
      hapusIndeksBaris_();
    }
    log_('periksa_ulang', 'KOREKSI', '', '', '', baru.length + ' masalah baru');
    bumpVersion_();
    const perKode = {};
    baru.forEach(b => { perKode[b.kode_aturan] = (perKode[b.kode_aturan] || 0) + 1; });
    return { baru: baru.length, total: K.length + baru.length, per_kode: perKode };
  });
}
