/**
 * Cari.gs — pencarian Nomor C / nama / no persil.
 * Urutan: cocok persis Nomor C → awalan Nomor C → nama → no persil.
 */

const PER_HAL = 50;

function normQ_(q) {
  return String(q || '').toUpperCase().replace(/\./g, ' ').replace(/\s+/g, ' ').trim();
}
function rapat_(s) {
  return String(s || '').toUpperCase().replace(/[.\s]/g, '');
}

/** Bandingkan nomor C secara alami: 2 < 10 < 10a */
function bandingNomor_(a, b) {
  const na = parseInt(a, 10), nb = parseInt(b, 10);
  if (!isNaN(na) && !isNaN(nb) && na !== nb) return na - nb;
  if (isNaN(na) !== isNaN(nb)) return isNaN(na) ? 1 : -1;
  return String(a).localeCompare(String(b));
}

function aksiCari_(data, sesi) {
  const idx = ringkasan_();
  const q = normQ_(data.q);
  const f = data.filter || {};
  const hal = Math.max(1, parseInt(data.hal, 10) || 1);
  const angka = /^\d+[A-Z]?$/.test(q);
  const qRapat = rapat_(q);

  const hasil = [];
  for (let i = 0; i < idx.c.length; i++) {
    const row = idx.c[i];
    const id = row[0], nomor = row[1], nama = row[2], dusun = row[3];
    if (!bolehDusun_(sesi, dusun)) continue;
    if (f.dusun && dusun !== f.dusun) continue;

    const u = nomor.toUpperCase();
    const s = u ? idx.p[u] : null; // Nomor C kosong tidak dihubungkan ke persil
    const statusC = statusC_(s);
    const dobel = u !== '' && (idx.hit[u] || 0) > 1;
    if (f.status && statusC !== f.status) continue;
    if (f.dobel && !dobel) continue;
    if (f.tipe && !(s && s.t.indexOf(f.tipe) >= 0)) continue;
    if (f.kelas && !(s && s.k.indexOf(f.kelas) >= 0)) continue;

    let skor = 9;
    if (!q) skor = 5;
    else {
      const bagian = u.split('/');
      if (u === q || bagian.indexOf(q) >= 0) skor = 0;
      else if (angka && (u.indexOf(q) === 0 || bagian.some(b => b.indexOf(q) === 0))) skor = 1;
      else if (!angka && qRapat.length >= 2 && rapat_(nama).indexOf(qRapat) >= 0) skor = 2;
      else if (!angka && u.indexOf(q) >= 0) skor = 2;
      else if (s && s.ps.indexOf(q) >= 0) skor = 3;
    }
    if (skor === 9) continue;

    hasil.push({
      _skor: skor,
      nomor_c: nomor, id_c: id, nama: nama, dusun: dusun,
      jml_persil: s ? s.n : 0,
      luas_aktif: s ? s.la : 0,
      status_c: statusC,
      dobel: dobel
    });
  }

  hasil.sort((a, b) => a._skor - b._skor || bandingNomor_(a.nomor_c, b.nomor_c) || a.id_c.localeCompare(b.id_c));
  const awal = (hal - 1) * PER_HAL;
  const baris = hasil.slice(awal, awal + PER_HAL).map(bersih_);
  return { total: hasil.length, hal: hal, per_hal: PER_HAL, baris: baris };
}
