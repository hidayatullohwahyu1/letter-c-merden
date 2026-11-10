// Daftar baku (tipe, kelas, status, dusun, jenis, peta kata→arah) dari server; disimpan di IndexedDB.
import { api } from './api.js';
import { ambil, simpan } from './db.js';

const CADANGAN = {
  tipe: ['Tanah Kering (D)', 'Tanah Basah(S)'],
  kelas: ['D-I', 'D-II', 'D-III', 'D-IV', 'D-V', 'D-VI', 'D-VII', 'S-I', 'S-II', 'S-III', 'S-IV', 'S-V', 'S-VI', 'S-VII'],
  status: ['Aktif', 'Tidak Aktif'],
  dusun: ['I', 'II', 'III', 'IV', 'V'],
  jenis: ['Jual', 'Beli', 'Waris', 'Hibah', 'Tukar', 'Pecah', 'Putusan Pengadilan', 'Gadai', 'Lainnya'],
  prioritas: ['Tinggi', 'Sedang', 'Rendah'],
  arah: { ke: 'Keluar', dr: 'Masuk', di: 'Masuk', dg: 'Tukar' }
};
const UMUR = 24 * 60 * 60 * 1000; // muat ulang sehari sekali

let memo = null;

export async function muatRef() {
  if (memo) return memo;
  let simpanan = null;
  try { simpanan = await ambil('ref', 'ref'); } catch (e) { /* IndexedDB tidak ada */ }
  if (simpanan && Date.now() - simpanan.waktu < UMUR) return (memo = simpanan.data);
  if (navigator.onLine) {
    try {
      const d = await api('ref');
      memo = d;
      simpan('ref', { kunci: 'ref', data: d, waktu: Date.now() }).catch(() => {});
      return d;
    } catch (e) { /* pakai simpanan/cadangan */ }
  }
  return (memo = simpanan ? simpanan.data : CADANGAN);
}
