// IndexedDB "lcm": data ringkas untuk cari offline. TIDAK menyimpan NIK atau data PTSL.
// Pengisian data (sinkronOffline) dikerjakan di Tahap 3; modul ini sudah siap dipakai.

const NAMA_DB = 'lcm';
const VERSI_DB = 1;
const STORE = ['c_ringkas', 'persil_ringkas', 'ref', 'meta'];

let dbPromise = null;

export function bukaDb() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) return reject(new Error('IndexedDB tidak didukung'));
    const req = indexedDB.open(NAMA_DB, VERSI_DB);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('c_ringkas')) db.createObjectStore('c_ringkas', { keyPath: 'id_c' });
      if (!db.objectStoreNames.contains('persil_ringkas')) db.createObjectStore('persil_ringkas', { keyPath: 'id_persil' });
      if (!db.objectStoreNames.contains('ref')) db.createObjectStore('ref', { keyPath: 'kunci' });
      if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta', { keyPath: 'kunci' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function tx(store, mode, fn) {
  return bukaDb().then(db => new Promise((resolve, reject) => {
    const t = db.transaction(store, mode);
    const s = t.objectStore(store);
    const hasil = fn(s);
    t.oncomplete = () => resolve(hasil && hasil.result !== undefined ? hasil.result : hasil);
    t.onerror = () => reject(t.error);
  }));
}

export const ambil = (store, kunci) => tx(store, 'readonly', s => s.get(kunci));
export const semua = (store) => tx(store, 'readonly', s => s.getAll());
export const simpan = (store, obj) => tx(store, 'readwrite', s => s.put(obj));
export const kosongkan = (store) => tx(store, 'readwrite', s => s.clear());
export function simpanBanyak(store, daftar) {
  return tx(store, 'readwrite', s => { daftar.forEach(o => s.put(o)); });
}
export async function hapusSemua() {
  for (const s of STORE) await kosongkan(s).catch(() => {});
}

/** Cari offline di c_ringkas. Mengembalikan format yang sama dengan aksi `cari`. */
export async function cariOffline(q, hal = 1) {
  let data = [];
  try { data = await semua('c_ringkas'); } catch (e) { data = []; }
  const Q = String(q || '').toUpperCase().replace(/\./g, ' ').replace(/\s+/g, ' ').trim();
  const rapat = s => String(s || '').toUpperCase().replace(/[.\s]/g, '');
  const hasil = [];
  for (const r of data) {
    const u = String(r.nomor_c).toUpperCase();
    let skor = 9;
    if (!Q) skor = 5;
    else if (u === Q) skor = 0;
    else if (u.startsWith(Q)) skor = 1;
    else if (rapat(r.nama).includes(rapat(Q))) skor = 2;
    if (skor < 9) hasil.push({ ...r, _skor: skor });
  }
  hasil.sort((a, b) => a._skor - b._skor || (parseInt(a.nomor_c, 10) || 0) - (parseInt(b.nomor_c, 10) || 0));
  return { total: hasil.length, hal, per_hal: 50, baris: hasil.slice((hal - 1) * 50, hal * 50), offline: true, kosong: !data.length };
}
