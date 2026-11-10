/**
 * Backup.gs — salinan harian spreadsheet DB, simpan 30 terbaru.
 * Dipicu otomatis (dibuat oleh setupDatabase).
 */

function backupHarian() {
  const props = PropertiesService.getScriptProperties();
  let folderId = prop_('BACKUP_FOLDER_ID');
  let folder;
  if (folderId) folder = DriveApp.getFolderById(folderId);
  else {
    const induk = prop_('APP_FOLDER_ID');
    folder = induk ? DriveApp.getFolderById(induk).createFolder('BACKUP_LETTER_C') : DriveApp.createFolder('BACKUP_LETTER_C');
    props.setProperty('BACKUP_FOLDER_ID', folder.getId());
  }
  const nama = 'DB_LETTER_C_MERDEN_' + Utilities.formatDate(new Date(), 'Asia/Jakarta', 'yyyyMMdd');
  DriveApp.getFileById(prop_('DB_ID')).makeCopy(nama, folder);

  const files = [];
  const it = folder.getFiles();
  while (it.hasNext()) {
    const f = it.next();
    if (f.getName().indexOf('DB_LETTER_C_MERDEN_') === 0) files.push(f);
  }
  files.sort((a, b) => b.getDateCreated() - a.getDateCreated());
  files.slice(30).forEach(f => f.setTrashed(true));
  log_('backup', '', '', '', '', nama, 'sistem');
}
