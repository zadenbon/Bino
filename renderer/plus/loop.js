(function () {
  const RP = window.RiffPlus;
  if (!RP.get('moduleLoop')) return;
  const h = RP.h;

  const MIN_SPAN = 0.25;
  const MAX_SAVED = 300;
  const SPIN_WINDOW_MS = 140;

  const loop = { a: null, b: null, enabled: true };
  let audio = null;
  let timer = 0;
  let spinning = false;
  let spinStart = 0;
  let lead = 0.012;
  let ownSeek = false;
  let seekIssuedAt = 0;
  let activeKey = '';
  let button = null;
  let chip = null;
  let region = null;
  let popover = null;
  let popoverInputs = null;

  const channel = new MessageChannel();
  channel.port1.onmessage = () => { if (spinning) tick(); };

  function fmt(t) {
    if (t === null || !Number.isFinite(t)) return '--:--.---';
    const total = Math.max(0, t);
    const m = Math.floor(total / 60);
    const s = total - m * 60;
    return m + ':' + (s < 10 ? '0' : '') + s.toFixed(3);
  }

  function fmtShort(t) {
    if (t === null || !Number.isFinite(t)) return '--';
    const m = Math.floor(t / 60);
    const s = Math.floor(t % 60);
    return m + ':' + (s < 10 ? '0' : '') + s;
  }

  function parseTime(text) {
    const raw = String(text || '').trim();
    if (!raw) return null;
    if (/^\d+(\.\d+)?$/.test(raw)) return parseFloat(raw);
    const m = raw.match(/^(\d+):([0-5]?\d(?:\.\d+)?)$/);
    if (m) return parseInt(m[1], 10) * 60 + parseFloat(m[2]);
    const m2 = raw.match(/^(\d+):(\d+):([0-5]?\d(?:\.\d+)?)$/);
    if (m2) return parseInt(m2[1], 10) * 3600 + parseInt(m2[2], 10) * 60 + parseFloat(m2[3]);
    return null;
  }

  function duration() {
    return audio && Number.isFinite(audio.duration) ? audio.duration : 0;
  }

  function isLive() {
    return !!audio && !Number.isFinite(audio.duration);
  }

  function isLooping() {
    return loop.enabled && loop.a !== null && loop.b !== null && loop.b - loop.a >= MIN_SPAN;
  }

  function trackKey() {
    const r = window.__riff;
    const t = r && r.state && r.state.currentTrack;
    if (!t) return '';
    if (r.trackKey) { try { const k = r.trackKey(t); if (k) return String(k); } catch (e) {} }
    return String(t.id || '');
  }

  function loadSaved() {
    const saved = RP.get('loops') || {};
    return saved && typeof saved === 'object' ? saved : {};
  }

  function persist() {
    if (!RP.get('loopRemember') || !activeKey) return;
    const saved = loadSaved();
    if (loop.a !== null && loop.b !== null) saved[activeKey] = { a: loop.a, b: loop.b, t: Date.now() };
    else delete saved[activeKey];
    const keys = Object.keys(saved);
    if (keys.length > MAX_SAVED) {
      keys.sort((x, y) => (saved[x].t || 0) - (saved[y].t || 0)).slice(0, keys.length - MAX_SAVED).forEach((k) => delete saved[k]);
    }
    RP.set('loops', saved);
  }

  function disarm() {
    clearTimeout(timer);
    timer = 0;
    spinning = false;
  }

  function jump() {
    if (!audio || loop.a === null) return;
    disarm();
    ownSeek = true;
    seekIssuedAt = performance.now();
    audio.currentTime = loop.a;
  }

  function tick() {
    if (!spinning) return;
    if (!audio || audio.paused || !isLooping()) { spinning = false; return; }
    if (audio.currentTime >= loop.b - lead) {
      spinning = false;
      jump();
      return;
    }
    if (performance.now() - spinStart > SPIN_WINDOW_MS) {
      spinning = false;
      arm();
      return;
    }
    channel.port2.postMessage(0);
  }

  function arm() {
    disarm();
    if (!audio || audio.paused || audio.seeking || !isLooping()) return;
    const ct = audio.currentTime;
    if (ct > loop.b + 0.35) return;
    if (ct < loop.a - 0.05 && audio.readyState < 2) return;
    const rate = audio.playbackRate || 1;
    const remaining = (loop.b - lead - ct) / rate;
    if (remaining <= 0.001) { jump(); return; }
    if (remaining > 0.08) {
      timer = setTimeout(arm, Math.max(10, (remaining - 0.05) * 1000));
      return;
    }
    spinning = true;
    spinStart = performance.now();
    channel.port2.postMessage(0);
  }

  function render() {
    const total = duration();
    const hasA = loop.a !== null;
    const hasB = loop.b !== null;
    const state = !hasA ? 'idle' : !hasB ? 'a' : (loop.enabled ? 'active' : 'paused');
    if (button) {
      button.dataset.state = state;
      button.setAttribute('aria-pressed', state === 'active' ? 'true' : 'false');
      button.title = state === 'idle' ? 'Set loop start (A)  [ ' : state === 'a' ? 'Set loop end (B)  ] ' : 'Clear loop  \\';
    }
    if (chip) {
      chip.hidden = !hasA;
      chip.textContent = fmtShort(loop.a) + ' – ' + fmtShort(loop.b);
    }
    if (region) {
      const show = total > 0 && hasA;
      region.hidden = !show;
      if (show) {
        const left = Math.max(0, Math.min(100, loop.a / total * 100));
        const right = hasB ? Math.max(left, Math.min(100, loop.b / total * 100)) : left;
        region.style.left = left + '%';
        region.style.width = Math.max(0.2, right - left) + '%';
        region.dataset.open = hasB ? '0' : '1';
        region.dataset.off = loop.enabled ? '0' : '1';
      }
    }
    if (popoverInputs) {
      if (document.activeElement !== popoverInputs.a) popoverInputs.a.value = loop.a === null ? '' : fmt(loop.a);
      if (document.activeElement !== popoverInputs.b) popoverInputs.b.value = loop.b === null ? '' : fmt(loop.b);
      popoverInputs.enabled.checked = loop.enabled;
      popoverInputs.remember.checked = !!RP.get('loopRemember');
    }
  }

  function guardLive() {
    if (isLive()) { RP.toast('Live streams cannot be looped', 'info'); return true; }
    if (!audio || !audio.src) return true;
    return false;
  }

  function setA(t) {
    if (guardLive()) return;
    const total = duration();
    let v = Math.max(0, Math.min(total, t));
    if (loop.b !== null && v > loop.b - MIN_SPAN) loop.b = null;
    loop.a = v;
    loop.enabled = true;
    persist();
    render();
    arm();
  }

  function setB(t) {
    if (guardLive()) return;
    const total = duration();
    const v = Math.max(0, Math.min(total, t));
    const a = loop.a === null ? 0 : loop.a;
    if (v < a + MIN_SPAN) { RP.toast('Loop end must be after the start', 'info'); return; }
    if (loop.a === null) loop.a = 0;
    loop.b = v;
    loop.enabled = true;
    persist();
    render();
    arm();
  }

  function clear() {
    disarm();
    loop.a = null;
    loop.b = null;
    loop.enabled = true;
    persist();
    render();
  }

  function cycle() {
    if (!audio) return;
    if (loop.a === null) setA(audio.currentTime);
    else if (loop.b === null) setB(audio.currentTime);
    else clear();
  }

  function nudge(which, delta) {
    if (which === 'a' && loop.a !== null) setA(loop.a + delta);
    if (which === 'b' && loop.b !== null) setB(loop.b + delta);
  }

  function onSeeked() {
    if (ownSeek) {
      ownSeek = false;
      const latency = performance.now() - seekIssuedAt;
      lead = Math.max(0.004, Math.min(0.03, lead * 0.6 + (latency / 2000) * 0.4));
    }
    arm();
  }

  function onMeta() {
    activeKey = trackKey();
    loop.a = null;
    loop.b = null;
    loop.enabled = true;
    if (RP.get('loopRemember') && activeKey) {
      const entry = loadSaved()[activeKey];
      const total = duration();
      if (entry && total > 0 && entry.a >= 0 && entry.b <= total + 0.05 && entry.b - entry.a >= MIN_SPAN) {
        loop.a = entry.a;
        loop.b = Math.min(entry.b, total);
        RP.toast('Loop restored ' + fmtShort(loop.a) + ' – ' + fmtShort(loop.b), 'info');
      }
    }
    render();
    arm();
  }

  function onLoadStart() {
    disarm();
    loop.a = null;
    loop.b = null;
    loop.enabled = true;
    activeKey = '';
    render();
  }

  function timeField(which) {
    const input = h('input', { type: 'text', class: 'rp-time-input', spellcheck: 'false', autocomplete: 'off', 'aria-label': which === 'a' ? 'Loop start' : 'Loop end', placeholder: 'm:ss.mmm' });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const v = parseTime(input.value);
        if (v === null) { render(); return; }
        if (which === 'a') setA(v); else setB(v);
        input.blur();
      } else if (e.key === 'Escape') {
        input.blur();
        render();
      }
      e.stopPropagation();
    });
    input.addEventListener('blur', render);
    return input;
  }

  function buildPopover() {
    const aInput = timeField('a');
    const bInput = timeField('b');
    const enabled = h('input', { type: 'checkbox', id: 'rp-loop-enabled' });
    const remember = h('input', { type: 'checkbox', id: 'rp-loop-remember' });
    enabled.addEventListener('change', () => { loop.enabled = enabled.checked; if (loop.enabled) arm(); else disarm(); render(); });
    remember.addEventListener('change', () => { RP.set('loopRemember', remember.checked); if (remember.checked) persist(); });
    const step = (label, fn, title) => h('button', { type: 'button', class: 'rp-mini-btn', title, onClick: fn }, label);
    const row = (name, input, which, setNow) => h('div', { class: 'rp-loop-row' },
      h('span', { class: 'rp-loop-name' }, name),
      input,
      h('div', { class: 'rp-loop-steps' },
        step('−', () => nudge(which, -0.05), 'Back 50 ms'),
        step('+', () => nudge(which, 0.05), 'Forward 50 ms'),
        step('Now', setNow, 'Use current position')
      )
    );
    popover = h('div', { class: 'rp-pop rp-loop-pop', role: 'dialog', 'aria-label': 'A-B loop', hidden: true },
      row('A', aInput, 'a', () => audio && setA(audio.currentTime)),
      row('B', bInput, 'b', () => audio && setB(audio.currentTime)),
      h('label', { class: 'rp-check', for: 'rp-loop-enabled' }, enabled, 'Loop on'),
      h('label', { class: 'rp-check', for: 'rp-loop-remember' }, remember, 'Remember for this track'),
      h('div', { class: 'rp-pop-foot' },
        h('span', { class: 'rp-hint' }, 'Keys: [ sets A, ] sets B, \\ clears. Shift-click the progress bar sets A, Alt-click sets B.'),
        h('button', { type: 'button', class: 'rp-btn rp-btn-quiet', onClick: () => { clear(); closePopover(); } }, 'Clear')
      )
    );
    popoverInputs = { a: aInput, b: bInput, enabled, remember };
    document.body.appendChild(popover);
  }

  function openPopover() {
    if (!popover) buildPopover();
    render();
    const rect = (chip && !chip.hidden ? chip : button).getBoundingClientRect();
    popover.hidden = false;
    const w = popover.offsetWidth || 300;
    popover.style.left = Math.max(8, Math.min(window.innerWidth - w - 8, rect.left + rect.width / 2 - w / 2)) + 'px';
    popover.style.bottom = Math.max(8, window.innerHeight - rect.top + 10) + 'px';
  }

  function closePopover() {
    if (popover) popover.hidden = true;
  }

  function mountUi() {
    const right = document.querySelector('.playbar-right');
    const scrub = document.getElementById('scrubber-track');
    if (!right || button) return;
    button = h('button', { type: 'button', id: 'rp-loop-btn', class: 'btn-icon-pill rp-loop-btn', 'data-state': 'idle', 'aria-label': 'A-B loop' },
      h('span', { class: 'rp-loop-glyph', 'aria-hidden': 'true' }, 'A', h('i'), 'B')
    );
    chip = h('button', { type: 'button', class: 'rp-loop-chip', hidden: true, title: 'Edit loop' });
    button.addEventListener('click', cycle);
    chip.addEventListener('click', (e) => { e.stopPropagation(); if (popover && !popover.hidden) closePopover(); else openPopover(); });
    const anchor = document.getElementById('btn-toggle-lyrics-panel');
    right.insertBefore(chip, anchor || right.firstChild);
    right.insertBefore(button, chip);
    if (scrub) {
      region = h('div', { class: 'rp-loop-region', hidden: true, 'aria-hidden': 'true' });
      scrub.appendChild(region);
      scrub.addEventListener('pointerdown', (e) => {
        if (!e.shiftKey && !e.altKey) return;
        const rect = scrub.getBoundingClientRect();
        const total = duration();
        if (!total || !rect.width) return;
        e.preventDefault();
        e.stopImmediatePropagation();
        const t = Math.max(0, Math.min(total, (e.clientX - rect.left) / rect.width * total));
        if (e.shiftKey) setA(t); else setB(t);
      }, true);
    }
    document.addEventListener('pointerdown', (e) => {
      if (popover && !popover.hidden && !popover.contains(e.target) && e.target !== chip && !chip.contains(e.target)) closePopover();
    }, true);
  }

  function isTyping(target) {
    if (!target) return false;
    const tag = target.tagName;
    if (tag === 'TEXTAREA' || target.isContentEditable) return true;
    if (tag === 'INPUT') return !['range', 'button', 'checkbox', 'radio'].includes((target.type || '').toLowerCase());
    return false;
  }

  window.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey || isTyping(e.target) || !audio) return;
    if (e.code === 'BracketLeft') { e.preventDefault(); setA(audio.currentTime); }
    else if (e.code === 'BracketRight') { e.preventDefault(); setB(audio.currentTime); }
    else if (e.code === 'Backslash') { e.preventDefault(); clear(); }
    else if (e.key === 'Escape') closePopover();
  });

  RP.onReady(() => {
    audio = document.getElementById('native-audio');
    if (!audio) return;
    mountUi();
    audio.addEventListener('loadstart', onLoadStart);
    audio.addEventListener('loadedmetadata', onMeta);
    audio.addEventListener('durationchange', render);
    audio.addEventListener('seeked', onSeeked);
    audio.addEventListener('playing', arm);
    audio.addEventListener('play', arm);
    audio.addEventListener('ratechange', arm);
    audio.addEventListener('pause', disarm);
    audio.addEventListener('timeupdate', () => {
      if (isLooping() && !audio.paused && !audio.seeking && audio.currentTime >= loop.b - lead && audio.currentTime <= loop.b + 0.35) jump();
      else if (!timer && !spinning) arm();
    });
    if (audio.readyState >= 1) onMeta();
  });

  RP.modules.loop = {
    setA, setB, clear, cycle,
    get: () => ({ a: loop.a, b: loop.b, enabled: loop.enabled, lead }),
    parseTime, fmt,
    destroy() { disarm(); channel.port1.close(); channel.port2.close(); }
  };
})();
