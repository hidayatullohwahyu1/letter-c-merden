/**
 * Scan.gs — ambil gambar scan buku C dari folder Drive (Script Property SCAN_FOLDER_ID).
 */

function aksiScan_(data, sesi) {
  const nama = str_(data.file);
  if (!nama) throw err_('VALIDATION', 'Nama file scan kosong');
  if (!/^[\w\-. ]+$/.test(nama)) throw err_('VALIDATION', 'Nama file scan tidak sah');
  const folderId = prop_('SCAN_FOLDER_ID');
  if (!folderId) throw err_('NOT_FOUND', 'Scan belum tersedia');

  const cache = CacheService.getScriptCache();
  const key = 'scan_' + nama;
  let fileId = cache.get(key);
  if (!fileId) {
    const it = DriveApp.getFolderById(folderId).getFilesByName(nama);
    if (!it.hasNext()) throw err_('NOT_FOUND', 'Scan belum tersedia');
    fileId = it.next().getId();
    cache.put(key, fileId, 21600);
  }

  // Coba thumbnail besar (lebih ringan), bila gagal kirim file asli
  try {
    const meta = Drive.Files.get(fileId, { fields: 'thumbnailLink' });
    if (meta && meta.thumbnailLink) {
      const url = meta.thumbnailLink.replace(/=s\d+$/, '=s1600');
      const r = UrlFetchApp.fetch(url, {
        headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() },
        muteHttpExceptions: true
      });
      if (r.getResponseCode() === 200) {
        const b = r.getBlob();
        return { mime: b.getContentType() || 'image/jpeg', base64: Utilities.base64Encode(b.getBytes()) };
      }
    }
  } catch (e) {
    console.warn('Thumbnail gagal: ' + e);
  }
  const blob = DriveApp.getFileById(fileId).getBlob();
  return { mime: blob.getContentType(), base64: Utilities.base64Encode(blob.getBytes()) };
}
