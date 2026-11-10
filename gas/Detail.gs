/**
 * Detail.gs — detail satu Nomor C beserta persil, mutasi, PTSL, koreksi.
 */

function aksiDetailC_(data, sesi) {
  let nomor = str_(data.nomor_c);
  const idC = str_(data.id_c);
  if (!nomor && !idC) throw err_('VALIDATION', 'Nomor C wajib diisi');
  let records;
  if (!nomor) {
    // Record dengan Nomor C kosong (V-01) dibuka lewat id_c
    records = cariBaris_('C', 'id_c', idC).filter(r => !isTrue_(r.dihapus));
    if (!records.length) throw err_('NOT_FOUND', 'Record ' + idC + ' tidak ditemukan');
    nomor = str_(records[0].nomor_c);
  }
  const U = nomor.toUpperCase();
  // Nomor C kosong tidak dicocokkan ke persil/mutasi lain
  const sama = v => U !== '' && str_(v).toUpperCase() === U;

  // Satu kali baca untuk semua bagian detail
  const [cNomor, persilRaw, milik, lawanRaw, ptslRaw, koreksiRaw] = ambilBanyak_([
    { name: 'C', kolom: 'nomor_c', nilai: nomor }, { name: 'PERSIL', kolom: 'nomor_c', nilai: nomor },
    { name: 'MUTASI', kolom: 'nomor_c', nilai: nomor }, { name: 'MUTASI', kolom: 'nomor_c_lawan', nilai: nomor },
    { name: 'PTSL', kolom: 'nomor_c', nilai: nomor }, { name: 'KOREKSI', kolom: 'nomor_c', nilai: nomor }
  ]);
  if (!records) records = cNomor.filter(r => !isTrue_(r.dihapus) && sama(r.nomor_c));
  if (!records.length) throw err_('NOT_FOUND', 'Nomor C ' + nomor + ' tidak ditemukan');
  if (sesi.peran === 'kadus' && !records.some(r => bolehDusun_(sesi, r.dusun))) {
    throw err_('FORBIDDEN', 'Nomor C ini bukan wilayah dusun Anda');
  }

  const persil = persilRaw
    .filter(p => !isTrue_(p.dihapus) && sama(p.nomor_c))
    .map(p => { const o = bersih_(p); o.luas_total = luasTotal_(p); return o; })
    .sort((a, b) => (a.status === 'Aktif' ? 0 : 1) - (b.status === 'Aktif' ? 0 : 1) ||
                    bandingNomor_(a.no_persil, b.no_persil));

  const arah = readRef_().arah;
  const keluar = [], masuk = [], lain = [], disebut = [];
  const lawan = lawanRaw.filter(m => !milik.some(x => x._row === m._row));
  milik.concat(lawan).forEach(m => {
    if (isTrue_(m.dihapus)) return;
    const o = bersih_(m);
    o.arah = arah[str_(m.kata).toLowerCase()] || '';
    if (sama(m.nomor_c)) {
      if (o.arah === 'Keluar') keluar.push(o);
      else if (o.arah === 'Masuk') masuk.push(o);
      else lain.push(o);
    } else if (sama(m.nomor_c_lawan)) {
      disebut.push(o);
    }
  });
  const urutTgl = (a, b) => String(a.tanggal || a.tahun).localeCompare(String(b.tanggal || b.tahun));
  [keluar, masuk, lain, disebut].forEach(x => x.sort(urutTgl));

  const ptsl = ptslRaw
    .filter(p => sama(p.nomor_c))
    .map(p => ({
      id_ptsl: p.id_ptsl, tahun: p.tahun, kadus: p.kadus, pemohon: p.pemohon, nik: maskNik_(p.nik, sesi),
      persil: p.persil, kelas: p.kelas, luas: p.luas, nib: p.nib, berkas: p.berkas
    }));

  const koreksi = koreksiRaw
    .filter(k => sama(k.nomor_c) && str_(k.status) !== 'Sudah')
    .map(bersih_);

  let luasT = 0, luasA = 0, jmlA = 0;
  persil.forEach(p => { luasT += p.luas_total; if (p.status === 'Aktif') { jmlA++; luasA += p.luas_total; } });

  return {
    records: records.map(bersih_),
    persil: persil,
    mutasi_keluar: keluar,
    mutasi_masuk: masuk,
    mutasi_lain: lain,
    mutasi_disebut: disebut,
    ptsl: ptsl,
    koreksi: koreksi,
    ringkas: {
      jml_persil: persil.length,
      jml_aktif: jmlA,
      luas_total: luasT,
      luas_aktif: luasA,
      status_c: statusC_({ n: persil.length, a: jmlA }),
      dobel: records.length > 1,
      nomor_c: nomor
    }
  };
}
