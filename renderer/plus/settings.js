(function () {
  const RP = window.RiffPlus;
  const h = RP.h;
  const api = window.electronAPI || {};

  function toggle(key, after) {
    const btn = h('button', { type: 'button', class: 'effect-switch-btn', role: 'switch' }, h('span', { class: 'thumb' }));
    const paint = () => { const on = !!RP.get(key); btn.classList.toggle('active', on); btn.setAttribute('aria-checked', on ? 'true' : 'false'); };
    btn.addEventListener('click', async () => {
      const next = !RP.get(key);
      if (after) { const ok = await after(next); if (ok === false) return; }
      RP.set(key, next);
      paint();
    });
    RP.onChange((k) => { if (k === key) paint(); });
    paint();
    return btn;
  }

  function slider(key, min, max, step, fmt) {
    const value = h('span', { class: 'setting-value' });
    const input = h('input', { type: 'range', class: 'pill-range', min, max, step });
    const paint = () => { input.value = RP.get(key); value.textContent = fmt(Number(RP.get(key))); };
    input.addEventListener('input', () => { RP.set(key, Number(input.value)); value.textContent = fmt(Number(input.value)); });
    paint();
    return { input, value };
  }

  function row(name, hint, control) {
    return h('div', { class: 'setting-item' },
      h('div', { class: 'setting-item-top', style: { alignItems: 'center' } },
        h('div', { style: { display: 'flex', flexDirection: 'column', gap: '2px' } },
          h('span', { class: 'setting-name' }, name),
          hint ? h('span', { class: 'rp-setting-hint' }, hint) : null
        ),
        control
      )
    );
  }

  function sliderRow(name, hint, s) {
    return h('div', { class: 'setting-item' },
      h('div', { class: 'setting-item-top' }, h('span', { class: 'setting-name' }, name), s.value),
      hint ? h('span', { class: 'rp-setting-hint' }, hint) : null,
      s.input
    );
  }

  function segmented(key, options, onPick) {
    const wrap = h('div', { class: 'rp-seg', role: 'radiogroup' });
    const btns = options.map(([value, label]) => {
      const b = h('button', { type: 'button', class: 'theme-mode-btn', role: 'radio', dataset: { value } }, label);
      b.addEventListener('click', async () => {
        if (onPick) { const ok = await onPick(value); if (ok === false) return; }
        RP.set(key, value);
      });
      wrap.appendChild(b);
      return b;
    });
    const paint = () => btns.forEach((b) => { const on = b.dataset.value === String(RP.get(key)); b.classList.toggle('active', on); b.setAttribute('aria-checked', on ? 'true' : 'false'); });
    RP.onChange((k) => { if (k === key) paint(); });
    paint();
    return wrap;
  }

  function accentControl() {
    const wrap = h('div', { class: 'rp-accent' });
    const presets = [['cover', 'Cover art'], ...Object.keys(RP.accentPresets).map((k) => [k, k.charAt(0).toUpperCase() + k.slice(1)])];
    const swatches = presets.map(([id, label]) => {
      const b = h('button', { type: 'button', class: 'rp-swatch', title: label, 'aria-label': label, dataset: { id } });
      if (id === 'cover') b.classList.add('rp-swatch-cover'); else b.style.setProperty('--sw', RP.accentPresets[id]);
      b.addEventListener('click', () => RP.set('accent', id));
      wrap.appendChild(b);
      return b;
    });
    const picker = h('input', { type: 'color', class: 'rp-color', 'aria-label': 'Custom accent colour', value: '#2ef2ff' });
    picker.addEventListener('input', () => RP.set('accent', picker.value));
    wrap.appendChild(picker);
    const paint = () => {
      const cur = RP.get('accent');
      swatches.forEach((b) => b.classList.toggle('active', b.dataset.id === cur));
      if (/^#[0-9a-f]{6}$/i.test(cur)) picker.value = cur;
      picker.classList.toggle('active', /^#[0-9a-f]{6}$/i.test(cur));
    };
    RP.onChange((k) => { if (k === 'accent') paint(); });
    paint();
    return wrap;
  }

  function group(title, ...rows) {
    return h('div', { class: 'rp-group' }, h('h3', { class: 'rp-group-title' }, title), rows);
  }

  async function setStartup(patch) {
    if (!api.plusSetStartup) return null;
    try { return await api.plusSetStartup(patch); } catch (e) { return null; }
  }

  async function onRamPick(mode) {
    const limit = RP.modules.system.RAM_LIMIT_MB[mode];
    const lowering = mode === 'low' || mode === 'minimal' || mode === 'balanced';
    const body = lowering
      ? 'This caps the memory Bino may use. To stay under the cap Bino will turn off animated backgrounds, blur effects and some visualizers, and some themes and features may look or work worse. Bino will restart to apply it.'
      : 'Bino will restart to apply the new memory setting.';
    const ok = await RP.confirm({ title: 'Change memory limit?', body, confirmLabel: 'Apply and restart', danger: lowering });
    if (!ok) return false;
    RP.set('ramMode', mode);
    await setStartup({ ramLimitMb: limit });
    if (api.restartApp) setTimeout(() => api.restartApp(), 250);
    return true;
  }

  async function onDevToggle(next) {
    if (next) {
      const ok = await RP.confirm({
        title: 'Turn on developer mode?',
        body: 'Developer mode unlocks raw settings editing, a JavaScript console, DevTools and startup flags. Changing the wrong thing can break Bino or erase your settings. Only continue if you know what you are doing.',
        confirmLabel: 'Turn on',
        danger: true
      });
      if (!ok) return false;
    }
    await setStartup({ devMode: next });
    return true;
  }

  function wave() {
    const src = document.querySelector('.effect-switch-btn[data-adv="my_wave"]');
    const btn = h('button', { type: 'button', class: 'effect-switch-btn', role: 'switch' }, h('span', { class: 'thumb' }));
    const paint = () => btn.classList.toggle('active', !!(src && src.classList.contains('active')));
    btn.addEventListener('click', () => { if (src) { src.click(); paint(); } });
    paint();
    return btn;
  }

  function headphoneBlock() {
    const status = h('span', { class: 'rp-setting-hint' }, 'Checking output device');
    const refresh = async () => {
      const s = await RP.modules.devices.status();
      if (!s.supported) status.textContent = 'This system does not report audio devices.';
      else if (!s.labelsAvailable) status.textContent = 'Device names are hidden, so auto-pause stays off. Use “Allow device names”.';
      else status.textContent = s.label ? (s.isHeadphone ? 'Current output: ' + s.label + ' (headphones). Auto-pause is active.' : 'Current output: ' + s.label + ' (speakers). Auto-pause will not trigger.') : 'No output device detected.';
    };
    const allow = h('button', { type: 'button', class: 'rp-btn rp-btn-quiet', onClick: async () => { await RP.modules.devices.requestDeviceNames(); refresh(); } }, 'Allow device names');
    const mark = h('button', { type: 'button', class: 'rp-btn rp-btn-quiet', onClick: async () => { const ok = await RP.modules.devices.markCurrentAsHeadphones(); RP.toast(ok ? 'Current output marked as headphones' : 'No output device to mark', 'info'); refresh(); } }, 'Treat this output as headphones');
    RP.onChange((k) => { if (k === 'headphonePause') refresh(); });
    setTimeout(refresh, 400);
    navigator.mediaDevices && navigator.mediaDevices.addEventListener && navigator.mediaDevices.addEventListener('devicechange', () => setTimeout(refresh, 300));
    return [
      row('Pause when headphones disconnect', 'Only applies when your output is headphones or earbuds. Speakers never trigger it.', toggle('headphonePause')),
      h('div', { class: 'setting-item rp-inline' }, status, h('div', { class: 'rp-btn-row' }, allow, mark))
    ];
  }

  function buildMain() {
    const section = h('div', { class: 'settings-section cat-hidden', id: 'settings-section-riffplus', dataset: { cat: 'riffplus' } },
      h('div', { class: 'settings-section-title' }, 'Bino+'),
      group('Look',
        row('Glass skin', 'Frosted panels, thin borders and a neon accent.', toggle('skin')),
        row('Accent colour', 'Cover art follows the playing track.', accentControl()),
        sliderRow('Accent glow', null, slider('glow', 0, 100, 5, (v) => v + '%')),
        row('Compact playbar', 'Moves edit, download and share into a menu.', toggle('declutter'))
      ),
      group('Ambient background',
        row('Reactive background', 'A WebGL field that moves with bass, mids and treble.', toggle('ambient')),
        sliderRow('Brightness', null, slider('ambientIntensity', 10, 100, 5, (v) => v + '%')),
        row('Quality', 'Auto lowers detail if frames drop.', segmented('ambientQuality', [['auto', 'Auto'], ['high', 'High'], ['balanced', 'Balanced'], ['low', 'Low']]))
      ),
      group('Playback', headphoneBlock()),
      group('Performance',
        h('div', { class: 'setting-item' },
          h('div', { class: 'setting-item-top' }, h('span', { class: 'setting-name' }, 'Memory limit')),
          h('span', { class: 'rp-setting-hint' }, 'Caps the interface memory. Takes effect after a restart. Lower limits turn off effects.'),
          segmented('ramMode', [['auto', 'Auto'], ['high', '2 GB'], ['balanced', '1 GB'], ['low', '512 MB'], ['minimal', '256 MB']], onRamPick)
        )
      ),
      group('Home',
        row('Recommended playlists', 'Shows For you mixes, Trending now and My Wave on Home.', wave())
      ),
      group('Developer', row('Developer mode', 'Unlocks the Developer tab. Read the warning first.', toggle('devMode', onDevToggle)))
    );
    return section;
  }

  function kvRow(key, onChanged) {
    const val = localStorage.getItem(key);
    const input = h('input', { type: 'text', class: 'rp-kv-val', value: val === null ? '' : val, spellcheck: 'false' });
    const save = h('button', { type: 'button', class: 'rp-mini-btn', title: 'Save value' }, 'Save');
    const del = h('button', { type: 'button', class: 'rp-mini-btn rp-danger', title: 'Delete key' }, 'Delete');
    save.addEventListener('click', () => { localStorage.setItem(key, input.value); RP.toast('Saved ' + key, 'info'); });
    del.addEventListener('click', async () => {
      const ok = await RP.confirm({ title: 'Delete this setting?', body: key, confirmLabel: 'Delete', danger: true });
      if (ok) { localStorage.removeItem(key); onChanged(); }
    });
    return h('div', { class: 'rp-kv' }, h('code', { class: 'rp-kv-key' }, key), input, save, del);
  }

  function buildDev() {
    const kvList = h('div', { class: 'rp-kv-list' });
    const filterInput = h('input', { type: 'text', class: 'rp-kv-filter', placeholder: 'Filter keys', spellcheck: 'false' });
    const newKey = h('input', { type: 'text', class: 'rp-kv-filter', placeholder: 'New key' });
    const newVal = h('input', { type: 'text', class: 'rp-kv-filter', placeholder: 'Value' });
    const renderKv = () => {
      kvList.textContent = '';
      const q = filterInput.value.trim().toLowerCase();
      const keys = [];
      for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && (!q || k.toLowerCase().includes(q))) keys.push(k); }
      keys.sort().slice(0, 300).forEach((k) => kvList.appendChild(kvRow(k, renderKv)));
      if (!keys.length) kvList.appendChild(h('div', { class: 'rp-setting-hint' }, 'No keys match.'));
    };
    filterInput.addEventListener('input', renderKv);

    const consoleOut = h('pre', { class: 'rp-console-out' });
    const consoleIn = h('textarea', { class: 'rp-console-in', rows: 3, spellcheck: 'false', placeholder: 'JavaScript. Use __riff for app state and RiffPlus for these tools. Ctrl+Enter runs.' });
    const runConsole = () => {
      const code = consoleIn.value;
      if (!code.trim()) return;
      let out;
      try { out = (0, eval)(code); if (out && typeof out.then === 'function') { out.then((v) => print('> ' + fmt(v)), (e) => print('! ' + e)); return print('(promise pending)'); } print('> ' + fmt(out)); } catch (e) { print('! ' + e); }
    };
    const fmt = (v) => { try { return typeof v === 'string' ? v : JSON.stringify(v, null, 2) || String(v); } catch (e) { return String(v); } };
    const print = (line) => { consoleOut.textContent += line + '\n'; consoleOut.scrollTop = consoleOut.scrollHeight; };
    consoleIn.addEventListener('keydown', (e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); runConsole(); } e.stopPropagation(); });

    const advList = h('div', { class: 'rp-adv-list' });
    const seen = new Set();
    document.querySelectorAll('.effect-switch-btn[data-adv]').forEach((src) => {
      const id = src.dataset.adv;
      if (seen.has(id)) return;
      seen.add(id);
      const b = h('button', { type: 'button', class: 'effect-switch-btn', role: 'switch' }, h('span', { class: 'thumb' }));
      const paint = () => b.classList.toggle('active', src.classList.contains('active'));
      b.addEventListener('click', () => { src.click(); paint(); });
      paint();
      advList.appendChild(h('div', { class: 'rp-adv-item' }, h('span', null, id.replace(/_/g, ' ')), b));
    });

    const flags = h('textarea', { class: 'rp-console-in', rows: 3, spellcheck: 'false', placeholder: 'One Chromium or Electron switch per line, for example: disable-gpu-vsync  or  js-flags=--max-old-space-size=2048' });
    const flagStatus = h('span', { class: 'rp-setting-hint' });
    if (api.plusGetStartup) api.plusGetStartup().then((cfg) => { flags.value = (cfg && cfg.extraSwitches) || ''; flagStatus.textContent = cfg && cfg.appliedFlags && cfg.appliedFlags.length ? 'Active this session: ' + cfg.appliedFlags.join(', ') : 'No extra flags active this session.'; }).catch(() => {});
    const saveFlags = h('button', { type: 'button', class: 'rp-btn rp-btn-quiet', onClick: async () => {
      const ok = await RP.confirm({ title: 'Apply startup flags?', body: 'Bad flags can stop Bino from starting. To recover, delete startup.json in your Bino data folder. Bino restarts now.', confirmLabel: 'Save and restart', danger: true });
      if (!ok) return;
      await setStartup({ extraSwitches: flags.value });
      if (api.restartApp) api.restartApp();
    } }, 'Save and restart');

    const metrics = h('pre', { class: 'rp-console-out rp-metrics' }, 'Press Refresh');
    const refreshMetrics = async () => {
      if (!api.plusMetrics) { metrics.textContent = 'Not available in this build.'; return; }
      try {
        const rows = await api.plusMetrics();
        metrics.textContent = rows.map((r) => (r.type + (r.name ? ' ' + r.name : '')).padEnd(26) + String(r.memMb).padStart(6) + ' MB   cpu ' + r.cpu.toFixed(1) + '%').join('\n');
      } catch (e) { metrics.textContent = String(e); }
    };

    const btn = (label, fn, cls) => h('button', { type: 'button', class: 'rp-btn ' + (cls || 'rp-btn-quiet'), onClick: fn }, label);
    const exportBtn = btn('Export settings', () => {
      const data = {};
      for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); data[k] = localStorage.getItem(k); }
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const a = h('a', { href: URL.createObjectURL(blob), download: 'riff-settings.json' });
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    });
    const importInput = h('input', { type: 'file', accept: 'application/json', hidden: true });
    importInput.addEventListener('change', async () => {
      const file = importInput.files[0];
      if (!file) return;
      try {
        const data = JSON.parse(await file.text());
        const ok = await RP.confirm({ title: 'Import settings?', body: 'This overwrites ' + Object.keys(data).length + ' keys and reloads Bino.', confirmLabel: 'Import', danger: true });
        if (!ok) return;
        Object.keys(data).forEach((k) => localStorage.setItem(k, String(data[k])));
        location.reload();
      } catch (e) { RP.toast('That file is not valid JSON', 'error'); }
    });

    return h('div', { class: 'settings-section cat-hidden', id: 'settings-section-riffdev', dataset: { cat: 'riffdev' } },
      h('div', { class: 'settings-section-title' }, 'Developer'),
      h('div', { class: 'rp-warn' }, 'Developer tools can break Bino. Changes to raw settings apply on the next reload.'),
      group('Tools',
        h('div', { class: 'rp-btn-row' },
          btn('Open DevTools', () => api.plusOpenDevtools && api.plusOpenDevtools()),
          btn('Reload interface', () => location.reload()),
          btn('Run garbage collection', () => { if (typeof window.gc === 'function') { window.gc(); RP.toast('Garbage collection ran', 'info'); } else RP.toast('gc is not exposed in this build', 'info'); }),
          btn('Open logs folder', () => api.openLogsFolder && api.openLogsFolder())
        ),
        row('Performance overlay', 'FPS, worst frame, heap, DOM nodes and ambient stats.', toggle('hud'))
      ),
      group('Feature modules',
        row('A-B loop', 'Applies after reload.', toggle('moduleLoop')),
        row('Fuzzy filter', 'Applies after reload.', toggle('moduleSearch')),
        row('Command palette', null, toggle('modulePalette'))
      ),
      group('App switches', advList),
      group('Processes', btn('Refresh', refreshMetrics), metrics),
      group('Startup flags', flags, h('div', { class: 'rp-btn-row' }, saveFlags), flagStatus),
      group('Settings editor', h('div', { class: 'rp-btn-row' }, exportBtn, btn('Import settings', () => importInput.click()), importInput), filterInput, kvList,
        h('div', { class: 'rp-kv rp-kv-new' }, newKey, newVal, btn('Add', () => { if (!newKey.value.trim()) return; localStorage.setItem(newKey.value.trim(), newVal.value); newKey.value = ''; newVal.value = ''; renderKv(); }))),
      group('JavaScript console', consoleIn, h('div', { class: 'rp-btn-row' }, btn('Run', runConsole, 'rp-btn-accent'), btn('Clear', () => { consoleOut.textContent = ''; })), consoleOut),
      group('Reset', btn('Reset Bino+ settings', async () => {
        const ok = await RP.confirm({ title: 'Reset Bino+ settings?', body: 'Skin, accent, ambient, loops and the other Bino+ options go back to defaults. Bino reloads.', confirmLabel: 'Reset', danger: true });
        if (!ok) return;
        const drop = [];
        for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && k.startsWith('riff_plus_')) drop.push(k); }
        drop.forEach((k) => localStorage.removeItem(k));
        location.reload();
      }, 'rp-btn-danger'))
    , renderKv() || null);
  }

  const NAV_ICON = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z"/><path d="M19 17l.8 2.2L22 20l-2.2.8L19 23l-.8-2.2L16 20l2.2-.8z"/></svg>';
  const DEV_ICON = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>';

  function navButton(cat, label, icon) {
    const b = h('button', { type: 'button', class: 'settings-nav-btn', dataset: { cat } }, h('span', { class: 'rp-nav-icon', html: '' }), h('span', null, label));
    b.firstChild.innerHTML = icon;
    return b;
  }

  function mount() {
    const nav = document.getElementById('settings-nav');
    const anySection = document.querySelector('#view-settings .settings-section');
    if (!nav || !anySection || document.getElementById('settings-section-riffplus')) return;
    const host = anySection.parentNode;
    host.appendChild(buildMain());
    nav.appendChild(navButton('riffplus', 'Bino+', NAV_ICON));
    let devNav = null;
    const syncDev = () => {
      const on = !!RP.get('devMode');
      const existing = document.getElementById('settings-section-riffdev');
      if (on && !existing) {
        host.appendChild(buildDev());
        devNav = navButton('riffdev', 'Developer', DEV_ICON);
        nav.appendChild(devNav);
      } else if (!on && existing) {
        existing.remove();
        if (devNav) devNav.remove();
        devNav = null;
        if (localStorage.getItem('riff_settings_cat') === 'riffdev' && typeof window.showSettingsCategory === 'function') window.showSettingsCategory('riffplus');
      }
    };
    RP.onChange((k) => { if (k === 'devMode') syncDev(); });
    syncDev();
  }

  RP.onReady(mount);
})();
