const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const Module = require('module');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'bino-fonts-'));
process.env.BINO_DATA_DIR = path.join(tmp, 'data');

const handlers = {};
let nextDialog = { canceled: true, filePaths: [] };
let openedFolder = null;
const electronMock = {
  dialog: { showOpenDialog: async () => nextDialog },
  ipcMain: { handle: (name, fn) => { handlers[name] = fn; } },
  shell: { openPath: async (p) => { openedFolder = p; return ''; } }
};
const origLoad = Module._load;
Module._load = function (request, ...rest) {
  if (request === 'electron') return electronMock;
  return origLoad.call(this, request, ...rest);
};

const fonts = require('../src/main/fonts');

function fontBytes(kind, extra = 64) {
  const head = {
    ttf: Buffer.from([0, 1, 0, 0]),
    otf: Buffer.from('OTTO', 'latin1'),
    woff: Buffer.from('wOFF', 'latin1'),
    woff2: Buffer.from('wOF2', 'latin1')
  }[kind];
  return Buffer.concat([head, Buffer.alloc(extra, 7)]);
}

function srcFile(name, buf) {
  const dir = path.join(tmp, 'src');
  fs.mkdirSync(dir, { recursive: true });
  const p = path.join(dir, name);
  fs.writeFileSync(p, buf);
  return p;
}

test('fonts live inside the Bino data folder', () => {
  assert.strictEqual(fonts.FONTS_DIR, path.join(tmp, 'data', 'fonts'));
});

test('imports ttf, otf, woff and woff2 files and lists them sorted', () => {
  const res = fonts.importPaths([
    srcFile('Zeta_Display-Bold.otf', fontBytes('otf')),
    srcFile('alpha.ttf', fontBytes('ttf')),
    srcFile('Mid Font.woff', fontBytes('woff')),
    srcFile('web.woff2', fontBytes('woff2'))
  ]);
  assert.strictEqual(res.skipped.length, 0);
  assert.deepStrictEqual(res.added.map((f) => f.name).sort(), ['Mid Font', 'Zeta Display Bold', 'alpha', 'web']);
  const names = fonts.list().map((f) => f.name);
  assert.deepStrictEqual(names, ['alpha', 'Mid Font', 'web', 'Zeta Display Bold']);
  assert.ok(fs.existsSync(path.join(fonts.FONTS_DIR, 'Zeta Display Bold.otf')));
});

test('rejects files that are not really fonts, wrong types, empty and oversized files', () => {
  const res = fonts.importPaths([
    srcFile('fake.ttf', Buffer.concat([Buffer.from('MZ'), Buffer.alloc(100)])),
    srcFile('notes.txt', fontBytes('ttf')),
    srcFile('empty.ttf', Buffer.alloc(0)),
    srcFile('huge.ttf', Buffer.concat([fontBytes('ttf'), Buffer.alloc(20 * 1024 * 1024)])),
    path.join(tmp, 'src', 'missing.ttf')
  ]);
  assert.strictEqual(res.added.length, 0);
  assert.strictEqual(res.skipped.length, 5);
  const reasons = Object.fromEntries(res.skipped.map((s) => [s.file, s.reason]));
  assert.match(reasons['fake.ttf'], /not a valid font/);
  assert.match(reasons['notes.txt'], /not a font file/);
  assert.match(reasons['huge.ttf'], /larger than 20 MB/);
  assert.match(reasons['missing.ttf'], /could not be read/);
  assert.ok(!fonts.list().some((f) => /fake|notes|empty|huge|missing/i.test(f.name)));
});

test('importing the same name again replaces it, even when the format changes', () => {
  fonts.importPaths([srcFile('Swap.ttf', fontBytes('ttf', 10))]);
  assert.ok(fs.existsSync(path.join(fonts.FONTS_DIR, 'Swap.ttf')));
  fonts.importPaths([srcFile('Swap.woff2', fontBytes('woff2', 20))]);
  assert.ok(!fs.existsSync(path.join(fonts.FONTS_DIR, 'Swap.ttf')));
  assert.ok(fs.existsSync(path.join(fonts.FONTS_DIR, 'Swap.woff2')));
  assert.strictEqual(fonts.list().filter((f) => f.name === 'Swap').length, 1);
});

test('the stored extension follows the real file contents, not the file name', () => {
  const res = fonts.importPaths([srcFile('Disguised.ttf', fontBytes('woff2'))]);
  assert.strictEqual(res.added[0].file, 'Disguised.woff2');
});

test('Windows reserved device names are made safe', () => {
  const res = fonts.importPaths([srcFile('CON.ttf', fontBytes('ttf'))]);
  assert.strictEqual(res.added[0].file, 'CON font.ttf');
});

test('readFont and removeFont refuse path tricks', () => {
  assert.strictEqual(fonts.readFont('../alpha.ttf'), null);
  assert.strictEqual(fonts.readFont('..\\alpha.ttf'), null);
  assert.strictEqual(fonts.readFont('alpha.exe'), null);
  assert.strictEqual(fonts.readFont(null), null);
  assert.strictEqual(fonts.removeFont('../../etc/passwd.ttf'), false);
  const buf = fonts.readFont('alpha.ttf');
  assert.ok(Buffer.isBuffer(buf) && buf.length > 0);
  assert.strictEqual(fonts.removeFont('alpha.ttf'), true);
  assert.strictEqual(fonts.readFont('alpha.ttf'), null);
});

test('IPC: list, import through the file dialog, save, read, remove and open folder', async () => {
  fonts.register(() => null);
  for (const name of ['plus-fonts-list', 'plus-fonts-import', 'plus-fonts-read', 'plus-fonts-remove', 'plus-fonts-save', 'plus-fonts-open-folder']) {
    assert.strictEqual(typeof handlers[name], 'function', name);
  }

  nextDialog = { canceled: true, filePaths: [] };
  assert.deepStrictEqual(await handlers['plus-fonts-import'](), { canceled: true, added: [], skipped: [] });

  nextDialog = { canceled: false, filePaths: [srcFile('Picked_Font.ttf', fontBytes('ttf')), srcFile('bad.ttf', Buffer.from('nope nope nope nope'))] };
  const res = await handlers['plus-fonts-import']();
  assert.strictEqual(res.canceled, false);
  assert.deepStrictEqual(res.added.map((f) => f.name), ['Picked Font']);
  assert.strictEqual(res.skipped.length, 1);

  const saved = await handlers['plus-fonts-save']({}, { name: 'Migrated', data: new Uint8Array(fontBytes('otf')) });
  assert.strictEqual(saved.ok, true);
  assert.strictEqual(saved.entry.file, 'Migrated.otf');
  assert.deepStrictEqual(await handlers['plus-fonts-save']({}, { name: 'x' }), { ok: false, reason: 'bad request' });

  const bytes = await handlers['plus-fonts-read']({}, 'Migrated.otf');
  assert.ok(bytes && bytes.length > 4);
  assert.ok((await handlers['plus-fonts-list']({})).some((f) => f.name === 'Migrated'));

  assert.strictEqual(await handlers['plus-fonts-remove']({}, 'Migrated.otf'), true);
  assert.strictEqual(await handlers['plus-fonts-open-folder'](), true);
  assert.strictEqual(openedFolder, fonts.FONTS_DIR);
});

test.after(() => {
  Module._load = origLoad;
  fs.rmSync(tmp, { recursive: true, force: true });
});
