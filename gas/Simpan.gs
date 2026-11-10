/**
 * Simpan.gs — tambah/ubah C, persil, mutasi; hapus (soft delete) & pulihkan; daftar REF.
 * Semua penulisan lewat simpanBaris_() di dalam denganKunci_() dan tercatat di LOG.
 */

const KOLOM_C = ['nomor_c', 'nama_asli', 'nama', 'alamat', 'dusun', 'rt', 'rw', 'file_scan', 'ket_dobel', 'catatan'];
const KOLOM_PERSIL = ['nomor_c', 'no_persil', 'tipe', 'kelas', 'kelas_asli', 'luas_ha', 'luas_m2', 'status', 'sebab_asli', 'catatan'];
const KOLOM_MUTASI = ['tanggal', 'tahun', 'jenis', 'kata', 'nomor_c_lawan', 'nama_disebut', 'luas', 'teks_asli', 'perlu_cek', 'catatan'];

function ambil_(sheet, idKey, id) {
  const r = readSheet_(sheet).find(x => str_(x[idKey]) === str_(id));
  if (!r || isTrue_(r.dihapus)) throw err_('NOT_FOUND', sheet + ' ' + id + ' tidak ditemukan');
  return r;
}

/** Gabungkan nilai lama dengan kiriman (kolom yang tidak dikirim tetap). */
function gabung_(kolom, data, lama) {
  const o = {};
  kolom.forEach(k => { o[k] = data[k] !== undefined ? str_(data[k]) : (lama ? str_(lama[k]) : ''); });
  return o;
}

/* ---------------- C ---------------- */

function aksiSimpanC_(data, sesi) {
  if (sesi.peran === 'pimpinan') throw err_('FORBIDDEN', 'Pimpinan hanya bisa melihat data');
  return denganKunci_(() => {
    const id = str_(data.id_c);
    const lama = id ? ambil_('C', 'id_c', id) : null;
    if (sesi.peran === 'kadus') return simpanDusunKadus_(data, sesi, lama);

    const c = gabung_(KOLOM_C, data, lama);
    if (!lama && !c.nama_asli) c.nama_asli = c.nama;
    if (!lama && !c.nama) c.nama = c.nama_asli;
    const nomorBerubah = !lama || str_(lama.nomor_c).toUpperCase() !== c.nomor_c.toUpperCase();
    const h = validasiC_(c, id, nomorBerubah);
    lemparGalat_(h);
    if (h.peringatan.length && !data.konfirmasi) return { perlu_konfirmasi: true, peringatan: h.peringatan };

    // Nomor C berubah → pindahkan persil & mutasi bila diminta (hanya bila nomor lama tidak dipakai record lain)
    const nomorLama = lama ? str_(lama.nomor_c) : '';
    const pindahkan = !!(lama && nomorLama && nomorLama.toUpperCase() !== c.nomor_c.toUpperCase() && data.ikutkanPersil);
    if (pindahkan && cLainSamaNomor_(nomorLama, id).length) {
      throw err_('VALIDATION', 'Nomor C lama ' + nomorLama + ' masih dipakai record lain (dobel), jadi persil tidak bisa dipindahkan otomatis. Hilangkan centang "pindahkan persil", lalu pindahkan persil satu per satu.');
    }

    const r = simpanBaris_('C', Object.assign({ id_c: id, diubah_pada_lama: data.diubah_pada_lama }, c), { cekKonflik: true });
    const pindah = pindahkan ? pindahkanNomor_(nomorLama, c.nomor_c) : 0;
    catatTanda_(h, 'C', r.id, c.nomor_c, c.nomor_c);
    if (r.baru || r.berubah.length || pindah) bumpVersion_();
    return { id_c: r.id, nomor_c: c.nomor_c, baru: r.baru, berubah: r.berubah.length, persil_dipindah: pindah,
             tanda: h.tanda.map(t => t.masalah) };
  });
}

/** Kadus hanya boleh mengisi dusun (kosong → dusunnya sendiri) pada record di wilayahnya. */
function simpanDusunKadus_(data, sesi, lama) {
  if (!lama) throw err_('FORBIDDEN', 'Kadus tidak bisa menambah data C');
  const lain = Object.keys(data).filter(k => KOLOM_C.indexOf(k) >= 0 && k !== 'dusun' && str_(data[k]) !== str_(lama[k]));
  if (lain.length) throw err_('FORBIDDEN', 'Kadus hanya bisa mengisi dusun');
  if (!bolehDusun_(sesi, lama.dusun)) throw err_('FORBIDDEN', 'Record ini bukan wilayah dusun Anda');
  const d = str_(data.dusun);
  if (d !== '' && d !== str_(sesi.dusun)) throw err_('FORBIDDEN', 'Kadus hanya bisa mengisi dusun ' + sesi.dusun);
  const r = simpanBaris_('C', { id_c: lama.id_c, dusun: d, diubah_pada_lama: data.diubah_pada_lama }, { cekKonflik: true });
  if (r.berubah.length) bumpVersion_();
  return { id_c: r.id, nomor_c: lama.nomor_c, baru: false, berubah: r.berubah.length, persil_dipindah: 0, tanda: [] };
}

function pindahkanNomor_(lama, baru) {
  const U = lama.toUpperCase();
  let n = 0;
  readSheet_('PERSIL').filter(p => !isTrue_(p.dihapus) && str_(p.nomor_c).toUpperCase() === U)
    .forEach(p => { simpanBaris_('PERSIL', { id_persil: p.id_persil, nomor_c: baru }, { aksi: 'pindah_nomor' }); n++; });
  readSheet_('MUTASI').filter(m => !isTrue_(m.dihapus))
    .forEach(m => {
      const o = { id_mutasi: m.id_mutasi };
      if (str_(m.nomor_c).toUpperCase() === U) o.nomor_c = baru;
      if (str_(m.nomor_c_lawan).toUpperCase() === U) o.nomor_c_lawan = baru;
      if (Object.keys(o).length > 1) simpanBaris_('MUTASI', o, { aksi: 'pindah_nomor' });
    });
  return n;
}

/* ---------------- PERSIL ---------------- */

function aksiSimpanPersil_(data, sesi) {
  return denganKunci_(() => {
    const id = str_(data.id_persil);
    const lama = id ? ambil_('PERSIL', 'id_persil', id) : null;
    const p = gabung_(KOLOM_PERSIL, data, lama);
    p.kelas = normKelas_(p.kelas) || p.kelas;
    if (!lama && !p.kelas_asli) p.kelas_asli = p.kelas;
    if (!p.status) p.status = 'Aktif';
    const h = validasiPersil_(p);
    lemparGalat_(h);
    const r = simpanBaris_('PERSIL', Object.assign({ id_persil: id, diubah_pada_lama: data.diubah_pada_lama }, p), { cekKonflik: true });
    // Nomor C persil berubah → mutasi milik persil ini ikut
    if (lama && str_(lama.nomor_c).toUpperCase() !== p.nomor_c.toUpperCase()) {
      readSheet_('MUTASI').filter(m => !isTrue_(m.dihapus) && str_(m.id_persil) === id)
        .forEach(m => simpanBaris_('MUTASI', { id_mutasi: m.id_mutasi, nomor_c: p.nomor_c }, { aksi: 'pindah_nomor' }));
    }
    if (r.baru || r.berubah.length) bumpVersion_();
    return { id_persil: r.id, nomor_c: p.nomor_c, baru: r.baru, berubah: r.berubah.length, peringatan: [] };
  });
}

/* ---------------- MUTASI ---------------- */

function aksiSimpanMutasi_(data, sesi) {
  return denganKunci_(() => {
    const id = str_(data.id_mutasi);
    const lama = id ? ambil_('MUTASI', 'id_mutasi', id) : null;
    const idPersil = lama ? str_(lama.id_persil) : str_(data.id_persil);
    const persil = ambil_('PERSIL', 'id_persil', idPersil);
    const m = gabung_(KOLOM_MUTASI, data, lama);
    m.id_persil = idPersil;
    m.nomor_c = str_(persil.nomor_c);
    m.no_persil = str_(persil.no_persil);
    m.kata = m.kata.toLowerCase();
    if (m.tanggal && !m.tahun) m.tahun = m.tanggal.slice(0, 4);
    const h = validasiMutasi_(m);
    lemparGalat_(h);
    const arah = readRef_().arah[m.kata] || '';
    const buatTujuan = !lama && !!data.buatPersilTujuan;
    if (buatTujuan) {
      if (arah !== 'Keluar') throw err_('VALIDATION', 'Persil tujuan hanya dibuat untuk mutasi berarah Keluar (kata "ke")');
      if (!m.nomor_c_lawan || !adaNomorC_(m.nomor_c_lawan)) {
        const e = err_('VALIDATION', 'C tujuan ' + (m.nomor_c_lawan || '(kosong)') + ' belum ada di Letter C. Buat data C tujuan dulu.');
        e.detail = [{ kode: 'V-05', kolom: 'nomor_c_lawan', pesan: 'C tujuan belum ada' }];
        throw e;
      }
    }

    const r = simpanBaris_('MUTASI', Object.assign({ id_mutasi: id }, m));
    catatTanda_(h, 'MUTASI', r.id, m.nomor_c, m.nomor_c_lawan);

    let idPersilBaru = '';
    if (!lama && data.nonaktifkanAsal && arah === 'Keluar') {
      simpanBaris_('PERSIL', { id_persil: idPersil, status: 'Tidak Aktif' }, { aksi: 'mutasi_keluar' });
    }
    if (buatTujuan) {
      const luasPindah = num_(m.luas) > 0 ? num_(m.luas) : luasTotal_(persil);
      const pb = simpanBaris_('PERSIL', {
        nomor_c: m.nomor_c_lawan, no_persil: persil.no_persil, tipe: persil.tipe, kelas: persil.kelas,
        kelas_asli: persil.kelas_asli, luas_ha: Math.floor(luasPindah / 10000), luas_m2: luasPindah % 10000,
        status: 'Aktif', catatan: 'Dari C ' + m.nomor_c + ' persil ' + persil.no_persil + ' (' + r.id + ')'
      });
      idPersilBaru = pb.id;
      simpanBaris_('MUTASI', {
        id_persil: pb.id, nomor_c: m.nomor_c_lawan, no_persil: persil.no_persil, tanggal: m.tanggal, tahun: m.tahun,
        jenis: m.jenis, kata: 'dr', nomor_c_lawan: m.nomor_c, nama_disebut: m.nama_disebut, luas: m.luas,
        teks_asli: '(otomatis dari ' + r.id + ')', catatan: m.catatan
      });
    }
    bumpVersion_();
    return { id_mutasi: r.id, id_persil_baru: idPersilBaru, nomor_c: m.nomor_c, arah: arah, tanda: h.tanda.map(t => t.masalah) };
  });
}

/* ---------------- HAPUS / PULIHKAN ---------------- */

const SHEET_HAPUS = { C: 'id_c', PERSIL: 'id_persil', MUTASI: 'id_mutasi' };

function aksiHapus_(data, sesi) {
  const sheet = str_(data.sheet), id = str_(data.id);
  const key = SHEET_HAPUS[sheet];
  if (!key) throw err_('VALIDATION', 'Sheet tidak bisa dihapus: ' + sheet);
  return denganKunci_(() => {
    const row = ambil_(sheet, key, id);
    if (sheet === 'C') {
      const nomor = str_(row.nomor_c);
      const masihDipakai = nomor && cLainSamaNomor_(nomor, id).length > 0;
      const jmlPersil = nomor ? readSheet_('PERSIL').filter(p => !isTrue_(p.dihapus) && str_(p.nomor_c).toUpperCase() === nomor.toUpperCase()).length : 0;
      if (!masihDipakai && jmlPersil) throw err_('VALIDATION', 'C ' + nomor + ' masih punya ' + jmlPersil + ' persil. Hapus atau pindahkan persilnya dulu.');
    }
    simpanBaris_(sheet, { [key]: id, dihapus: true }, { aksi: 'hapus' });
    bumpVersion_();
    return {};
  });
}

function aksiPulihkan_(data, sesi) {
  const sheet = str_(data.sheet), id = str_(data.id);
  const key = SHEET_HAPUS[sheet];
  if (!key) throw err_('VALIDATION', 'Sheet tidak dikenal: ' + sheet);
  return denganKunci_(() => {
    const row = readSheet_(sheet).find(x => str_(x[key]) === id);
    if (!row) throw err_('NOT_FOUND', sheet + ' ' + id + ' tidak ditemukan');
    simpanBaris_(sheet, { [key]: id, dihapus: false }, { aksi: 'pulihkan' });
    bumpVersion_();
    return {};
  });
}

/* ---------------- REF & detail persil ---------------- */

function aksiRef_() {
  const r = readRef_();
  return {
    tipe: r.tipe.length ? r.tipe : TIPE_VALID, kelas: KELAS_VALID, status: STATUS_VALID,
    dusun: DUSUN_VALID, jenis: r.jenis.length ? r.jenis : JENIS_VALID, prioritas: ['Tinggi', 'Sedang', 'Rendah'],
    arah: r.arah, info: r.info
  };
}

function aksiDetailPersil_(data, sesi) {
  const p = cariBaris_('PERSIL', 'id_persil', data.id_persil).filter(x => !isTrue_(x.dihapus))[0];
  if (!p) throw err_('NOT_FOUND', 'Persil ' + data.id_persil + ' tidak ditemukan');
  const [cRaw, mRaw] = ambilBanyak_([{ name: 'C', kolom: 'nomor_c', nilai: p.nomor_c }, { name: 'MUTASI', kolom: 'id_persil', nilai: p.id_persil }]);
  const c = cRaw.filter(x => !isTrue_(x.dihapus));
  if (sesi.peran === 'kadus' && c.length && !c.some(x => bolehDusun_(sesi, x.dusun))) throw err_('FORBIDDEN', 'Persil ini bukan wilayah dusun Anda');
  const arah = readRef_().arah;
  const mutasi = mRaw.filter(m => !isTrue_(m.dihapus))
    .map(m => { const o = bersih_(m); o.arah = arah[str_(m.kata).toLowerCase()] || ''; return o; });
  const o = bersih_(p);
  o.luas_total = luasTotal_(p);
  return { persil: o, pemilik: c.map(x => ({ id_c: x.id_c, nama: x.nama || x.nama_asli })), mutasi: mutasi };
}
