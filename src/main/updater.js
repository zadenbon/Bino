const { app, ipcMain } = require('electron');

function initUpdater() {
  const pkg = require('../../package.json');
  if (pkg.version) app.setVersion(pkg.version);
  try { ipcMain.removeHandler('get-app-version'); } catch (_) {}
  ipcMain.handle('get-app-version', () => app.getVersion());
}

module.exports = { initUpdater };
