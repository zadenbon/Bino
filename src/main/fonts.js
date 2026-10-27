const { dialog, ipcMain, shell } = require('electron');
const fs = require('fs');
const path = require('path');
const { DATA_DIR } = require('../shared/platform');

const FONTS_DIR = path.join(DATA_DIR, 'fonts');
const MAX_BYTES = 20 * 1024 * 1024;
const EXT_RE = /\.(ttf|otf|woff2?)$/i;
const RESERVED_RE = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i;

function cleanName(fileName) {
  const base = String(fileName || '').replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').replace(/[^\p{L}\p{N} ]/gu, '').replace(/\s+/g, ' ').trim().slice(0, 48).trim();
  return RESERVED_RE.test(base) ? base + ' font' : base;
}

function sniff(buf) {
  if (!Buffer.isBuffer(buf) || buf.length < 12) return null;
  const tag = buf.toString('latin1', 0, 4);
  if (tag === 'wOF2') return 'woff2';
  if (tag === 'wOFF') return 'woff';
  if (tag === 'OTTO') return 'otf';
  if (tag === 'true' || buf.readUInt32BE(0) === 0x00010000) return 'ttf';
  return null;
}

function isSafeFile(file) {
  return typeof file === 'string' && file.length > 0 && path.basename(file) === file && EXT_RE.test(file);
}

function ensureDir() {
  fs.mkdirSync(FONTS_DIR, { recursive: true });
}

function list() {
  let files = [];
  try { files = fs.readdirSync(FONTS_DIR); } catch (e) { return []; }
  const out = [];
  for (const file of files) {
    if (!isSafeFile(file)) continue;
    try {
      const st = fs.statSync(path.join(FONTS_DIR, file));
      if (st.isFile()) out.push({ name: file.replace(/\.[^.]+$/, ''), file, size: st.size });
    } catch (e) {}
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

function addBuffer(rawName, buf) {
  const name = cleanName(rawName);
  if (!name) return { ok: false, reason: 'could not be named' };
  if (!Buffer.isBuffer(buf) || buf.length === 0) return { ok: false, reason: 'is empty' };
  if (buf.length > MAX_BYTES) return { ok: false, reason: 'is larger than 20 MB' };
  const ext = sniff(buf);
  if (!ext) return { ok: false, reason: 'is not a valid font file' };
  ensureDir();
  for (const other of ['ttf', 'otf', 'woff', 'woff2']) {
    if (other !== ext) { try { fs.unlinkSync(path.join(FONTS_DIR, name + '.' + other)); } catch (e) {} }
  }
  const file = name + '.' + ext;
  const target = path.join(FONTS_DIR, file);
  const tmp = target + '.tmp';
  fs.writeFileSync(tmp, buf);
  fs.renameSync(tmp, target);
  return { ok: true, entry: { name, file, size: buf.length } };
}

function importPaths(paths) {
  const added = [];
  const skipped = [];
  for (const p of Array.isArray(paths) ? paths : []) {
    const label = path.basename(String(p));
    try {
      if (!EXT_RE.test(label)) { skipped.push({ file: label, reason: 'is not a font file' }); continue; }
      const st = fs.statSync(p);
      if (!st.isFile()) { skipped.push({ file: label, reason: 'is not a file' }); continue; }
      if (st.size > MAX_BYTES) { skipped.push({ file: label, reason: 'is larger than 20 MB' }); continue; }
      const res = addBuffer(label, fs.readFileSync(p));
      if (res.ok) added.push(res.entry);
      else skipped.push({ file: label, reason: res.reason });
    } catch (e) {
      skipped.push({ file: label, reason: 'could not be read' });
    }
  }
  return { added, skipped };
}

function readFont(file) {
  if (!isSafeFile(file)) return null;
  try { return fs.readFileSync(path.join(FONTS_DIR, file)); } catch (e) { return null; }
}

function removeFont(file) {
  if (!isSafeFile(file)) return false;
  try { fs.unlinkSync(path.join(FONTS_DIR, file)); return true; } catch (e) { return false; }
}

function register(getWindow) {
  ipcMain.handle('plus-fonts-list', () => list());

  ipcMain.handle('plus-fonts-import', async () => {
    const opts = {
      title: 'Add custom font',
      properties: ['openFile', 'multiSelections'],
      filters: [{ name: 'Font files', extensions: ['ttf', 'otf', 'woff', 'woff2'] }]
    };
    const win = typeof getWindow === 'function' ? getWindow() : null;
    const result = win ? await dialog.showOpenDialog(win, opts) : await dialog.showOpenDialog(opts);
    if (result.canceled || !result.filePaths.length) return { canceled: true, added: [], skipped: [] };
    return { canceled: false, ...importPaths(result.filePaths) };
  });

  ipcMain.handle('plus-fonts-read', (e, file) => readFont(file));
  ipcMain.handle('plus-fonts-remove', (e, file) => removeFont(file));

  ipcMain.handle('plus-fonts-save', (e, payload) => {
    if (!payload || typeof payload.name !== 'string' || !payload.data) return { ok: false, reason: 'bad request' };
    const buf = Buffer.from(payload.data);
    return addBuffer(payload.name, buf);
  });

  ipcMain.handle('plus-fonts-open-folder', async () => {
    try { ensureDir(); await shell.openPath(FONTS_DIR); return true; } catch (e) { return false; }
  });
}

module.exports = { register, list, addBuffer, importPaths, readFont, removeFont, sniff, cleanName, FONTS_DIR };
