(function () {
  const RP = window.RiffPlus;
  const h = RP.h;

  const moved = [];
  let moreBtn = null;
  let morePop = null;

  function mountDeclutter() {
    const left = document.querySelector('.playbar-left');
    const right = document.querySelector('.playbar-right');
    if (!left || !right || moreBtn) return;
    const ids = ['btn-edit-current-track', 'btn-playbar-more', 'btn-playbar-share'];
    morePop = h('div', { class: 'rp-pop rp-more-pop', hidden: true, role: 'menu' });
    moreBtn = h('button', { type: 'button', id: 'rp-more-btn', class: 'btn-icon-pill rp-more-btn', title: 'More', 'aria-haspopup': 'true', 'aria-expanded': 'false' });
    moreBtn.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="19" cy="12" r="1.8"/></svg>';
    ids.forEach((id) => {
      const node = document.getElementById(id);
      if (!node) return;
      moved.push({ node, parent: node.parentNode, next: node.nextSibling });
    });
    const volume = right.querySelector('.volume-control-group');
    right.insertBefore(moreBtn, volume || null);
    document.body.appendChild(morePop);
    moreBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (!morePop.hidden) { closeMore(); return; }
      const rect = moreBtn.getBoundingClientRect();
      morePop.hidden = false;
      const w = morePop.offsetWidth || 160;
      morePop.style.left = Math.max(8, Math.min(window.innerWidth - w - 8, rect.right - w)) + 'px';
      morePop.style.bottom = Math.max(8, window.innerHeight - rect.top + 10) + 'px';
      moreBtn.setAttribute('aria-expanded', 'true');
    });
    document.addEventListener('pointerdown', (e) => {
      if (!morePop.hidden && !morePop.contains(e.target) && !moreBtn.contains(e.target)) closeMore();
    }, true);
    morePop.addEventListener('click', (e) => { if (e.target.closest('button')) setTimeout(closeMore, 0); });
    applyDeclutter();
  }

  function closeMore() {
    if (!morePop) return;
    morePop.hidden = true;
    if (moreBtn) moreBtn.setAttribute('aria-expanded', 'false');
  }

  function applyDeclutter() {
    if (!moreBtn) return;
    const on = !!RP.get('declutter');
    moreBtn.hidden = !on;
    moved.forEach((m) => {
      if (on) {
        morePop.appendChild(m.node);
      } else if (m.node.parentNode === morePop) {
        if (m.next && m.next.parentNode === m.parent) m.parent.insertBefore(m.node, m.next);
        else m.parent.appendChild(m.node);
      }
    });
    if (!on) closeMore();
  }

  function click(id) {
    const node = document.getElementById(id);
    if (node) node.click();
  }

  function goView(view) {
    const nav = document.querySelector('.nav-item[data-view="' + view + '"]');
    if (nav) nav.click();
  }

  function openSettingsCat(cat) {
    goView('settings');
    setTimeout(() => { if (typeof window.showSettingsCategory === 'function') window.showSettingsCategory(cat); }, 30);
  }

  function buildCommands() {
    const list = [];
    const add = (title, keywords, run) => list.push({ title, artist: keywords || '', platform: '', run });
    document.querySelectorAll('.nav-item[data-view]').forEach((nav) => {
      const view = nav.getAttribute('data-view');
      const name = nav.getAttribute('title') || view;
      add('Go to ' + name, 'open navigate view', () => nav.click());
    });
    add('Play or pause', 'toggle playback', () => click('btn-play-pause'));
    add('Next track', 'skip forward', () => click('btn-next'));
    add('Previous track', 'back', () => click('btn-prev'));
    add('Toggle shuffle', 'random', () => click('btn-shuffle'));
    add('Toggle repeat', 'loop track', () => click('btn-repeat'));
    add('Mute or unmute', 'volume sound', () => click('btn-volume-mute'));
    add('Toggle favorite for this track', 'like heart save', () => click('btn-toggle-fav'));
    add('Toggle lyrics panel', 'words', () => click('btn-toggle-lyrics-panel'));
    add('Open audio settings', 'equalizer effects speed', () => click('btn-open-settings'));
    add('Toggle mini player', 'compact small window', () => { if (typeof window.toggleMiniWindow === 'function') window.toggleMiniWindow(); });
    if (RP.modules.loop) {
      add('A-B loop: cycle start, end, clear', 'practice repeat section', () => RP.modules.loop.cycle());
      add('A-B loop: clear', 'practice', () => RP.modules.loop.clear());
    }
    add('Toggle glass skin', 'theme appearance', () => RP.set('skin', !RP.get('skin')));
    add('Toggle ambient background', 'shader visual', () => RP.set('ambient', !RP.get('ambient')));
    add('Toggle compact playbar', 'declutter bottom bar', () => RP.set('declutter', !RP.get('declutter')));
    add('Open Riff+ settings', 'skin accent memory headphones', () => openSettingsCat('riffplus'));
    if (RP.get('devMode')) add('Open developer settings', 'debug tools', () => openSettingsCat('riffdev'));
    add('Show keyboard shortcuts', 'help keys', () => showShortcuts());
    return list;
  }

  function collectTracks() {
    const r = window.__riff;
    if (!r || !r.state) return [];
    const seen = new Set();
    const out = [];
    const push = (arr, context) => {
      (arr || []).forEach((t, i) => {
        if (!t) return;
        const key = (t.platform || '') + '|' + (t.id || t.title + t.artist);
        if (seen.has(key)) return;
        seen.add(key);
        out.push({ title: t.title || '', artist: t.artist || '', platform: t.platform || '', track: t, list: arr, index: i, context });
      });
    };
    push(r.state.queue, 'queue');
    push(r.state.favorites, 'favorites');
    push(r.state.localTracks, 'local');
    push(r.state.history, 'history');
    return out;
  }

  let paletteEl = null;
  let paletteState = null;

  function closePalette() {
    if (!paletteEl) return;
    document.removeEventListener('keydown', paletteState.onKey, true);
    paletteEl.remove();
    const prev = paletteState.previous;
    paletteEl = null;
    paletteState = null;
    if (prev && prev.focus) prev.focus();
  }

  function openPalette() {
    if (paletteEl) { closePalette(); return; }
    const commands = buildCommands();
    const tracks = collectTracks();
    const st = { items: [], active: 0, previous: document.activeElement };
    const input = h('input', { type: 'text', class: 'rp-palette-input', placeholder: 'Type a command or a track name', spellcheck: 'false', autocomplete: 'off', role: 'combobox', 'aria-expanded': 'true', 'aria-controls': 'rp-palette-list' });
    const list = h('ul', { class: 'rp-palette-list', id: 'rp-palette-list', role: 'listbox' });
    const box = h('div', { class: 'rp-palette', role: 'dialog', 'aria-label': 'Command palette' }, input, list);
    paletteEl = h('div', { class: 'rp-palette-backdrop' }, box);
    paletteState = st;

    function compute() {
      const q = input.value;
      const cmds = q.trim() ? window.RiffFuzzy.filter(commands, q).slice(0, 7) : commands.slice(0, 9);
      const trs = q.trim() ? window.RiffFuzzy.filter(tracks, q).slice(0, 8) : [];
      st.items = cmds.map((c) => ({ kind: 'command', label: c.title, hint: 'Command', run: c.run }))
        .concat(trs.map((t) => ({ kind: 'track', label: t.title || 'Untitled', hint: [t.artist, t.platform].filter(Boolean).join(' · '), run: () => { const r = window.__riff; if (r && r.playTrack) r.playTrack(t.track, t.list, t.index, t.context); } })));
      if (st.active >= st.items.length) st.active = Math.max(0, st.items.length - 1);
      paint();
    }

    function paint() {
      list.textContent = '';
      if (!st.items.length) {
        list.appendChild(h('li', { class: 'rp-palette-empty' }, 'Nothing matches. Try a shorter word.'));
        return;
      }
      st.items.forEach((item, i) => {
        const li = h('li', { class: 'rp-palette-item' + (i === st.active ? ' active' : ''), role: 'option', 'aria-selected': i === st.active ? 'true' : 'false' },
          h('span', { class: 'rp-palette-label' }, item.label),
          h('span', { class: 'rp-palette-hint' }, item.hint)
        );
        li.addEventListener('mousemove', () => { if (st.active !== i) { st.active = i; paint(); } });
        li.addEventListener('click', () => run(i));
        list.appendChild(li);
      });
      const active = list.querySelector('.active');
      if (active) active.scrollIntoView({ block: 'nearest' });
    }

    function run(i) {
      const item = st.items[i];
      closePalette();
      if (item) setTimeout(() => { try { item.run(); } catch (e) { console.error(e); } }, 0);
    }

    st.onKey = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closePalette(); }
      else if (e.key === 'ArrowDown') { e.preventDefault(); st.active = (st.active + 1) % Math.max(1, st.items.length); paint(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); st.active = (st.active - 1 + Math.max(1, st.items.length)) % Math.max(1, st.items.length); paint(); }
      else if (e.key === 'Enter' && document.activeElement === input) { e.preventDefault(); run(st.active); }
    };
    document.addEventListener('keydown', st.onKey, true);
    input.addEventListener('input', () => { st.active = 0; compute(); });
    paletteEl.addEventListener('mousedown', (e) => { if (e.target === paletteEl) closePalette(); });
    document.body.appendChild(paletteEl);
    compute();
    input.focus();
  }

  const SHORTCUTS = [
    ['Ctrl K', 'Command palette'],
    ['Ctrl F', 'Filter the current list'],
    ['Space', 'Play or pause'],
    ['[', 'Set loop start (A)'],
    [']', 'Set loop end (B)'],
    ['\\', 'Clear loop'],
    ['Shift-click progress bar', 'Set A'],
    ['Alt-click progress bar', 'Set B'],
    ['?', 'This list']
  ];

  function showShortcuts() {
    if (document.getElementById('rp-shortcuts')) return;
    const close = () => { el.remove(); document.removeEventListener('keydown', onKey, true); };
    const onKey = (e) => { if (e.key === 'Escape') { e.preventDefault(); close(); } };
    const el = h('div', { class: 'rp-dialog-backdrop', id: 'rp-shortcuts' },
      h('div', { class: 'rp-dialog', role: 'dialog', 'aria-label': 'Keyboard shortcuts' },
        h('h3', null, 'Keyboard shortcuts'),
        h('dl', { class: 'rp-keys' }, SHORTCUTS.map((s) => [h('dt', null, s[0]), h('dd', null, s[1])])),
        h('div', { class: 'rp-dialog-actions' }, h('button', { type: 'button', class: 'rp-btn rp-btn-accent', onClick: close }, 'Close'))
      )
    );
    el.addEventListener('mousedown', (e) => { if (e.target === el) close(); });
    document.addEventListener('keydown', onKey, true);
    document.body.appendChild(el);
  }

  function isTyping(target) {
    if (!target) return false;
    const tag = target.tagName;
    if (tag === 'TEXTAREA' || target.isContentEditable) return true;
    if (tag === 'INPUT') return !['range', 'button', 'checkbox', 'radio'].includes((target.type || '').toLowerCase());
    return false;
  }

  window.addEventListener('keydown', (e) => {
    if (!RP.get('modulePalette')) return;
    if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      e.stopPropagation();
      openPalette();
    } else if (e.key === '?' && !e.ctrlKey && !e.metaKey && !isTyping(e.target)) {
      e.preventDefault();
      showShortcuts();
    }
  }, true);

  RP.onChange((key) => { if (key === 'declutter') applyDeclutter(); });
  RP.onReady(mountDeclutter);

  RP.modules.shell = { openPalette, closePalette, showShortcuts, openSettingsCat };
})();
