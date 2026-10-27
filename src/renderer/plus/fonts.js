(function () {
  const RP = window.BinoPlus;
  const h = RP.h;

  const SYSTEM_FONTS = [
    'Segoe UI', 'Segoe UI Variable', 'Arial', 'Helvetica', 'Helvetica Neue', 'Verdana', 'Tahoma', 'Trebuchet MS', 'Calibri', 'Candara', 'Century Gothic',
    'Franklin Gothic Medium', 'Gill Sans', 'Lucida Sans', 'Georgia', 'Times New Roman', 'Palatino Linotype', 'Book Antiqua', 'Cambria', 'Garamond',
    'Consolas', 'Courier New', 'Cascadia Code', 'Cascadia Mono', 'Menlo', 'Monaco', 'SF Pro Text', 'SF Pro Display', 'San Francisco', 'Avenir', 'Optima',
    'Ubuntu', 'Cantarell', 'Noto Sans', 'Noto Serif', 'DejaVu Sans', 'Liberation Sans', 'Comic Sans MS', 'Impact', 'Bahnschrift', 'Sitka Text', 'Ink Free'
  ];

  const GOOGLE_FONTS = [
    ['Inter'], ['Roboto'], ['Poppins'], ['Montserrat'], ['Open Sans'], ['Lato'], ['Nunito'], ['Raleway'], ['Work Sans'], ['DM Sans'], ['Manrope'],
    ['Space Grotesk'], ['Outfit'], ['Sora'], ['Plus Jakarta Sans'], ['Lexend'], ['Urbanist'], ['Figtree'], ['Rubik'], ['Karla'], ['Quicksand'], ['Barlow'],
    ['Mulish'], ['Josefin Sans'], ['Archivo'], ['Oswald'], ['Bebas Neue', true], ['Playfair Display'], ['Merriweather'], ['Lora'], ['Crimson Pro'],
    ['Source Serif 4'], ['Cormorant Garamond'], ['Fraunces'], ['JetBrains Mono'], ['Fira Code'], ['IBM Plex Sans'], ['IBM Plex Mono'], ['Space Mono'],
    ['Caveat'], ['Pacifico', true], ['Lobster', true], ['Righteous', true], ['Bungee', true], ['Orbitron'], ['Press Start 2P', true]
  ];
  const SINGLE = new Set(GOOGLE_FONTS.filter((f) => f[1]).map((f) => f[0]));

  const api = window.electronAPI || {};
  const PREVIEW_MAX_BYTES = 8 * 1024 * 1024;
  const root = document.documentElement;
  const loadedGoogle = new Set();
  const faces = new Map();
  const pending = new Map();
  let customList = [];

  const probe = document.createElement('canvas').getContext('2d');
  const BASES = ['monospace', 'sans-serif', 'serif'];
  const SAMPLE = 'mmmmmmmmmmlliWWWQ@#1234';
  const baseWidth = {};
  function measure(font) { probe.font = '72px ' + font; return probe.measureText(SAMPLE).width; }
  function isInstalled(name) {
    for (const base of BASES) {
      if (baseWidth[base] === undefined) baseWidth[base] = measure(base);
      if (measure('"' + name + '", ' + base) !== baseWidth[base]) return true;
    }
    return false;
  }

  function findCustom(name) { return customList.find((f) => f.name === name) || null; }

  async function refreshList() {
    if (typeof api.plusFontsList !== 'function') return customList;
    try { customList = (await api.plusFontsList()) || []; } catch (e) { customList = []; }
    RP.set('customFonts', customList.map((f) => f.name));
    return customList;
  }

  async function loadCustom(name, force) {
    if (!force && faces.has(name)) return true;
    if (pending.has(name) && !force) return pending.get(name);
    const job = (async () => {
      const entry = findCustom(name);
      if (!entry || typeof api.plusFontsRead !== 'function') return false;
      const bytes = await api.plusFontsRead(entry.file);
      if (!bytes) return false;
      const face = new FontFace(name, bytes, { weight: '100 900' });
      await face.load();
      const old = faces.get(name);
      if (old) { try { document.fonts.delete(old); } catch (e) {} }
      document.fonts.add(face);
      faces.set(name, face);
      return true;
    })();
    pending.set(name, job);
    try { return await job; } finally { pending.delete(name); }
  }

  function dropFace(name) {
    const old = faces.get(name);
    if (old) { try { document.fonts.delete(old); } catch (e) {} }
    faces.delete(name);
  }

  function loadGoogle(name) {
    if (loadedGoogle.has(name)) return;
    loadedGoogle.add(name);
    const family = encodeURIComponent(name).replace(/%20/g, '+');
    const link = h('link', { rel: 'stylesheet', href: 'https://fonts.googleapis.com/css2?family=' + family + (SINGLE.has(name) ? '' : ':wght@400;700') + '&display=swap', dataset: { rpFont: name } });
    link.addEventListener('error', () => { loadedGoogle.delete(name); link.remove(); RP.toast('Could not load ' + name + '. Check your internet connection.', 'error'); });
    document.head.appendChild(link);
  }

  function parse(value) {
    if (!value || typeof value !== 'string' || value.indexOf(':') < 1) return null;
    const i = value.indexOf(':');
    return { kind: value.slice(0, i), name: value.slice(i + 1) };
  }

  function quote(name) { return '"' + String(name).replace(/["\\]/g, '') + '"'; }

  function toBytes(data) { return data instanceof Uint8Array ? data : new Uint8Array(data); }

  // Fonts imported by older builds lived in the browser database "riff_plus_fonts".
  // Move them into the Bino fonts folder once, then delete the old database.
  async function migrateLegacy() {
    if (typeof api.plusFontsSave !== 'function' || !indexedDB || typeof indexedDB.databases !== 'function') return;
    const LEGACY_DB = 'riff_plus_fonts';
    let dbs = [];
    try { dbs = await indexedDB.databases(); } catch (e) { return; }
    if (!dbs.some((d) => d.name === LEGACY_DB)) return;
    const records = await new Promise((resolve) => {
      const req = indexedDB.open(LEGACY_DB);
      req.onerror = () => resolve(null);
      req.onsuccess = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains('fonts')) { db.close(); resolve([]); return; }
        const all = db.transaction('fonts', 'readonly').objectStore('fonts').getAll();
        all.onsuccess = () => { db.close(); resolve(all.result || []); };
        all.onerror = () => { db.close(); resolve(null); };
      };
    });
    if (records === null) return;
    let allSaved = true;
    for (const rec of records) {
      try {
        const res = await api.plusFontsSave({ name: rec.name, data: toBytes(rec.data) });
        if (!res || !res.ok) allSaved = false;
      } catch (e) { allSaved = false; }
    }
    if (allSaved) { try { indexedDB.deleteDatabase(LEGACY_DB); } catch (e) {} }
  }

  const ready = (async () => {
    try { await migrateLegacy(); } catch (e) {}
    await refreshList();
  })();

  async function applyFont() {
    const sel = parse(RP.get('font'));
    if (!sel) {
      root.classList.remove('rp-font');
      root.style.removeProperty('--font-family');
      return;
    }
    const fallback = "'Google Sans', 'Google Sans Text', system-ui, -apple-system, sans-serif";
    root.style.setProperty('--font-family', quote(sel.name) + ', ' + fallback);
    root.classList.add('rp-font');
    if (sel.kind === 'g') loadGoogle(sel.name);
    else if (sel.kind === 'c') {
      try {
        await ready;
        const ok = await loadCustom(sel.name);
        if (!ok) { RP.set('font', ''); RP.toast('That font is no longer in your Bino fonts folder', 'error'); }
      } catch (e) {
        RP.set('font', '');
        RP.toast('That font file could not be read', 'error');
      }
    }
  }

  async function addFromDialog() {
    if (typeof api.plusFontsImport !== 'function') { RP.toast('Importing fonts is not available in this build', 'error'); return null; }
    let res;
    try { res = await api.plusFontsImport(); } catch (e) { RP.toast('Could not open the file picker', 'error'); return null; }
    if (!res || res.canceled) return null;
    (res.skipped || []).forEach((s) => RP.toast(s.file + ' ' + s.reason, 'error'));
    await refreshList();
    let last = null;
    for (const entry of res.added || []) {
      try {
        await loadCustom(entry.name, true);
        last = entry.name;
      } catch (e) {
        RP.toast(entry.file + ' is not a valid font', 'error');
        try { await api.plusFontsRemove(entry.file); } catch (err) {}
        dropFace(entry.name);
      }
    }
    await refreshList();
    if (last) {
      RP.set('font', 'c:' + last);
      RP.toast('Added ' + last, 'info');
    }
    return last;
  }

  async function removeCustom(name) {
    const entry = findCustom(name);
    if (entry) { try { await api.plusFontsRemove(entry.file); } catch (e) {} }
    dropFace(name);
    if (RP.get('font') === 'c:' + name) RP.set('font', '');
    await refreshList();
  }

  function buildControl() {
    const search = h('input', { type: 'text', class: 'rp-kv-filter rp-font-search', placeholder: 'Search fonts', spellcheck: 'false', autocomplete: 'off' });
    const list = h('div', { class: 'rp-font-list', role: 'listbox', 'aria-label': 'Fonts' });
    let installed = null;

    function item(value, label, preview, tag) {
      const active = RP.get('font') === value;
      const b = h('button', { type: 'button', class: 'rp-font-item' + (active ? ' active' : ''), role: 'option', 'aria-selected': active ? 'true' : 'false' },
        h('span', { class: 'rp-font-name', style: preview ? { fontFamily: quote(preview) + ', sans-serif' } : null }, label),
        tag ? h('span', { class: 'rp-font-tag' }, tag) : null
      );
      b.addEventListener('click', () => RP.set('font', value));
      return b;
    }

    function heading(text) { return h('div', { class: 'rp-font-heading' }, text); }

    function paint() {
      if (!installed) installed = SYSTEM_FONTS.filter(isInstalled);
      const q = search.value.trim().toLowerCase();
      const match = (name) => !q || name.toLowerCase().includes(q);
      list.textContent = '';
      if (match('default') || match('google sans')) list.appendChild(item('', 'Default (Google Sans)', null, null));
      const mine = customList.filter((f) => match(f.name));
      if (mine.length) {
        list.appendChild(heading('Your fonts'));
        mine.forEach((f) => {
          if (f.size <= PREVIEW_MAX_BYTES) loadCustom(f.name).catch(() => {});
          const row = h('div', { class: 'rp-font-row' }, item('c:' + f.name, f.name, f.name, null));
          const del = h('button', { type: 'button', class: 'rp-mini-btn rp-danger', title: 'Remove this font', 'aria-label': 'Remove ' + f.name }, 'Remove');
          del.addEventListener('click', () => removeCustom(f.name));
          row.appendChild(del);
          list.appendChild(row);
        });
      } else if (!q && customList.length === 0) {
        list.appendChild(heading('Your fonts'));
        list.appendChild(h('div', { class: 'rp-setting-hint', style: { margin: '0 12px 6px' } }, 'No custom fonts yet. Press “Import font file” below to add one.'));
      }
      const sys = installed.filter(match);
      if (sys.length) {
        list.appendChild(heading('Installed on this computer'));
        sys.forEach((n) => list.appendChild(item('s:' + n, n, n, null)));
      }
      const web = GOOGLE_FONTS.map((f) => f[0]).filter(match);
      if (web.length) {
        list.appendChild(heading('Online (needs internet the first time)'));
        web.forEach((n) => list.appendChild(item('g:' + n, n, loadedGoogle.has(n) ? n : null, 'online')));
      }
      if (list.children.length === 0) list.appendChild(h('div', { class: 'rp-setting-hint' }, 'No fonts match.'));
    }

    let timer = 0;
    search.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(paint, 80); });
    RP.onChange((k) => { if (k === 'font' || k === 'customFonts') paint(); });
    paint();

    return h('div', { class: 'rp-font-box' },
      h('span', { class: 'rp-setting-hint' }, 'Changes the text across the app. Imported fonts (.ttf, .otf, .woff, .woff2) are copied into your Bino fonts folder.'),
      search,
      list,
      h('div', { class: 'rp-btn-row' },
        h('button', { type: 'button', class: 'rp-btn rp-btn-accent', onClick: () => addFromDialog() }, 'Import font file'),
        h('button', { type: 'button', class: 'rp-btn rp-btn-quiet', onClick: () => api.plusFontsOpenFolder && api.plusFontsOpenFolder() }, 'Open fonts folder'),
        h('button', { type: 'button', class: 'rp-btn rp-btn-quiet', onClick: () => RP.set('font', '') }, 'Reset to default')
      )
    );
  }

  RP.onChange((k) => { if (k === 'font') applyFont(); });
  applyFont();

  RP.modules.fonts = { buildControl, addFromDialog, removeCustom, apply: applyFont, refresh: refreshList };
})();
