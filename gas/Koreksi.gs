/**
 * Koreksi.gs — antrean masalah data: daftar, tandai sudah, lapor masalah baru.
 * Kadus: server selalu membatasi ke dusunnya (plus record yang dusunnya belum diketahui).
 */

const URUT_PRIORITAS = { Tinggi: 0, Sedang: 1, Rendah: 2 };

/** Peta dusun per id_c dan per nomor_c (untuk memfilter koreksi menurut dusun). */
function petaDusun_() {
  const perId = {}, perNomor = {};
  readSheet_('C').forEach(c => {
    if (isTrue_(c.dihapus)) return;
    const d = str_(c.dusun), u = str_(c.nomor_c).toUpperCase();
    perId[str_(c.id_c)] = d;
    if (u && (perNomor[u] === undefined || (!perNomor[u] && d))) perNomor[u] = d;
  });
  return { perId: perId, perNomor: perNomor };
}

function dusunKoreksi_(k, peta) {
  if (str_(k.sheet) === 'C' && peta.perId[str_(k.ref_id)] !== undefined) return peta.perId[str_(k.ref_id)];
  return peta.perNomor[str_(k.nomor_c).toUpperCase()] || '';
}

function aksiListKoreksi_(data, sesi) {
  const f = data.filter || {};
  const hal = Math.max(1, parseInt(data.hal, 10) || 1);
  const peta = petaDusun_();
  const q = str_(f.q).toUpperCase();

  const semua = readSheet_('KOREKSI').map(k => { const o = bersih_(k); o.dusun = dusunKoreksi_(k, peta); return o; })
    .filter(o => bolehDusun_(sesi, o.dusun));

  const progres = {};
  ['Tinggi', 'Sedang', 'Rendah'].forEach(p => { progres[p] = { total: 0, sudah: 0 }; });
  semua.forEach(o => {
    const p = progres[o.prioritas] || (progres[o.prioritas] = { total: 0, sudah: 0 });
    p.total++;
    if (o.status === 'Sudah') p.sudah++;
  });

  const hasil = semua.filter(o =>
    (!f.prioritas || o.prioritas === f.prioritas) &&
    (!f.sheet || o.sheet === f.sheet) &&
    (!f.status || (o.status || 'Belum') === f.status) &&
    (!f.dusun || (f.dusun === '-' ? o.dusun === '' : o.dusun === f.dusun)) &&
    (!q || [o.nomor_c, o.ref_id, o.masalah, o.kolom, o.catatan].some(x => str_(x).toUpperCase().indexOf(q) >= 0))
  );
  hasil.sort((a, b) =>
    ((a.status === 'Sudah') - (b.status === 'Sudah')) ||
    ((URUT_PRIORITAS[a.prioritas] ?? 9) - (URUT_PRIORITAS[b.prioritas] ?? 9)) ||
    String(a.id_koreksi).localeCompare(String(b.id_koreksi)));

  const awal = (hal - 1) * PER_HAL;
  return { total: hasil.length, hal: hal, per_hal: PER_HAL, baris: hasil.slice(awal, awal + PER_HAL), progres: progres };
}

function aksiTandaiKoreksi_(data, sesi) {
  if (sesi.peran === 'pimpinan') throw err_('FORBIDDEN', 'Pimpinan hanya bisa melihat data');
  return denganKunci_(() => {
    const k = readSheet_('KOREKSI').find(x => str_(x.id_koreksi) === str_(data.id_koreksi));
    if (!k) throw err_('NOT_FOUND', 'Koreksi ' + data.id_koreksi + ' tidak ditemukan');
    if (sesi.peran === 'kadus' && !bolehDusun_(sesi, dusunKoreksi_(k, petaDusun_()))) {
      throw err_('FORBIDDEN', 'Masalah ini bukan wilayah dusun Anda');
    }
    const o = { id_koreksi: k.id_koreksi };
    if (data.catatan !== undefined) o.catatan = str_(data.catatan);
    if (data.status !== undefined && str_(data.status) !== str_(k.status || 'Belum')) {
      if (sesi.peran === 'kadus') throw err_('FORBIDDEN', 'Kadus hanya bisa memberi catatan');
      if (['Belum', 'Sudah'].indexOf(str_(data.status)) < 0) throw err_('VALIDATION', 'Status harus Belum atau Sudah');
      o.status = str_(data.status);
      o.dicek_oleh = sesi.email;
      o.dicek_pada = sekarang_();
    }
    const r = simpanBaris_('KOREKSI', o, { aksi: 'koreksi' });
    return { id_koreksi: r.id, berubah: r.berubah.length };
  });
}

const SHEET_LAPOR = { C: ['id_c', 'nomor_c'], PERSIL: ['id_persil', 'nomor_c'], MUTASI: ['id_mutasi', 'nomor_c'] };

function aksiLaporKoreksi_(data, sesi) {
  const sheet = str_(data.sheet), ref = str_(data.ref_id), masalah = str_(data.masalah);
  const def = SHEET_LAPOR[sheet];
  if (!def) throw err_('VALIDATION', 'Sheet tidak dikenal');
  if (!masalah) throw err_('VALIDATION', 'Tuliskan masalahnya');
  return denganKunci_(() => {
    const row = ambil_(sheet, def[0], ref);
    const nomor = str_(row.nomor_c);
    if (sesi.peran === 'kadus') {
      const peta = petaDusun_();
      const d = sheet === 'C' ? str_(row.dusun) : (peta.perNomor[nomor.toUpperCase()] || '');
      if (!bolehDusun_(sesi, d)) throw err_('FORBIDDEN', 'Record ini bukan wilayah dusun Anda');
    }
    const kolom = str_(data.kolom) || 'Umum';
    const r = simpanBaris_('KOREKSI', {
      sheet: sheet, ref_id: ref, nomor_c: nomor, kolom: kolom,
      nilai: row[kolom] !== undefined ? str_(row[kolom]) : '', masalah: masalah.slice(0, 1000),
      saran: str_(data.saran).slice(0, 500), prioritas: ['Tinggi', 'Sedang', 'Rendah'].indexOf(data.prioritas) >= 0 ? data.prioritas : 'Sedang',
      status: 'Belum', catatan: 'Dilaporkan oleh ' + (sesi.nama || sesi.email), kode_aturan: 'LAPOR'
    });
    return { id_koreksi: r.id };
  });
}
