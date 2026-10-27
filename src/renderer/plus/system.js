(function () {
  const RP = window.BinoPlus;
  const h = RP.h;

  const HEADPHONE_RE = /head-?(?:phone|set)s?|ear-?(?:phone|bud|pod)s?|airpods?|\bbuds?\b|\bwh-?\d|\bwf-?\d|in-?ear|\biem\b|\bbeats\b|arctis|kraken|barracuda|\bqc\d|freebuds|galaxy buds|pixel buds|jabra elite/i;
  const SPEAKER_RE = /speaker|hdmi|display ?port|\btv\b|soundbar|receiver|line ?out|s\/?pdif|optical|digital output|subwoofer|woofer|\bmonitor\b/i;

  function normalizeLabel(label) {
    return String(label || '').replace(/^(default|communications)\s*[-–—:]\s*/i, '').replace(/\s+/g, ' ').trim().toLowerCase();
  }

  function classify(label) {
    const n = normalizeLabel(label);
    if (!n) return false;
    const marked = RP.get('headphoneLabels') || [];
    if (marked.includes(n)) return true;
    if (!HEADPHONE_RE.test(n)) return false;
    if (SPEAKER_RE.test(n) && !/head-?(?:phone|set)|ear-?(?:phone|bud|pod)|airpods?|buds/i.test(n)) return false;
    return true;
  }

  const devices = {
    current: null,
    labelsAvailable: false,
    supported: !!(navigator.mediaDevices && navigator.mediaDevices.enumerateDevices),
    attached: false,
    queue: Promise.resolve(),
    audio: null
  };

  async function readOutputs() {
    if (!devices.supported) return [];
    const list = await navigator.mediaDevices.enumerateDevices();
    return list.filter((d) => d.kind === 'audiooutput');
  }

  function resolveActive(outputs) {
    devices.labelsAvailable = outputs.some((d) => d.label);
    if (!devices.labelsAvailable || !outputs.length) return null;
    const sinkId = devices.audio && devices.audio.sinkId;
    let entry = null;
    if (sinkId && sinkId !== 'default') entry = outputs.find((d) => d.deviceId === sinkId) || null;
    if (!entry) {
      const def = outputs.find((d) => d.deviceId === 'default') || outputs[0];
      const real = outputs.find((d) => d.deviceId !== 'default' && d.deviceId !== 'communications' && def.groupId && d.groupId === def.groupId);
      if (real) entry = real;
      else {
        const wanted = normalizeLabel(def.label);
        entry = outputs.find((d) => d.deviceId !== 'default' && d.deviceId !== 'communications' && normalizeLabel(d.label) === wanted) || def;
      }
    }
    return { id: entry.deviceId, label: entry.label, isHeadphone: classify(entry.label) };
  }

  async function refreshCurrent() {
    const outputs = await readOutputs();
    devices.current = resolveActive(outputs);
    return outputs;
  }

  function handleDeviceChange() {
    devices.queue = devices.queue.then(async () => {
      if (!RP.get('headphonePause')) return;
      const before = devices.current;
      const outputs = await readOutputs();
      const after = resolveActive(outputs);
      const gone = !!before && before.isHeadphone && !outputs.some((d) => d.deviceId === before.id);
      devices.current = after;
      if (!gone) return;
      const audio = devices.audio;
      if (audio && !audio.paused && !audio.ended) {
        audio.pause();
        RP.toast('Paused: ' + (before.label ? before.label.replace(/^(default|communications)\s*[-–—:]\s*/i, '') : 'headphones') + ' disconnected', 'info');
      }
    }).catch(() => {});
  }

  function attachDevices() {
    if (devices.attached || !devices.supported) return;
    devices.attached = true;
    navigator.mediaDevices.addEventListener('devicechange', handleDeviceChange);
    refreshCurrent().catch(() => {});
  }

  function detachDevices() {
    if (!devices.attached) return;
    devices.attached = false;
    navigator.mediaDevices.removeEventListener('devicechange', handleDeviceChange);
  }

  async function requestDeviceNames() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return false;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((t) => t.stop());
    } catch (e) {
      return false;
    }
    await refreshCurrent();
    return devices.labelsAvailable;
  }

  async function markCurrentAsHeadphones() {
    await refreshCurrent();
    if (!devices.current) return false;
    const n = normalizeLabel(devices.current.label);
    const marked = (RP.get('headphoneLabels') || []).slice();
    if (!marked.includes(n)) marked.push(n);
    RP.set('headphoneLabels', marked);
    await refreshCurrent();
    return true;
  }

  async function status() {
    await refreshCurrent().catch(() => {});
    return {
      supported: devices.supported,
      labelsAvailable: devices.labelsAvailable,
      label: devices.current ? devices.current.label.replace(/^(default|communications)\s*[-–—:]\s*/i, '') : '',
      isHeadphone: !!(devices.current && devices.current.isHeadphone)
    };
  }

  function syncDevices() {
    if (RP.get('headphonePause')) attachDevices();
    else detachDevices();
  }

  const life = { timer: 0, watchdog: 0, unloaded: false, restoreMs: 0 };

  function unloadUi() {
    life.timer = 0;
    if (life.unloaded || !document.hidden || !RP.get('unloadOnMinimize')) return;
    life.unloaded = true;
    document.documentElement.classList.add('rp-unloaded');
    if (RP.modules.ambient) RP.modules.ambient.suspend();
    life.watchdog = setInterval(() => { if (!document.hidden) reloadUi(); }, 400);
  }

  function reloadUi() {
    clearTimeout(life.timer);
    life.timer = 0;
    if (!life.unloaded) return;
    const t0 = performance.now();
    life.unloaded = false;
    clearInterval(life.watchdog);
    life.watchdog = 0;
    document.documentElement.classList.remove('rp-unloaded');
    requestAnimationFrame(() => {
      life.restoreMs = performance.now() - t0;
      if (RP.modules.ambient) RP.modules.ambient.resume();
    });
  }

  function onVisibility(visible) {
    if (visible) { reloadUi(); return; }
    if (!RP.get('unloadOnMinimize')) return;
    clearTimeout(life.timer);
    life.timer = setTimeout(unloadUi, 1200);
  }

  document.addEventListener('visibilitychange', () => onVisibility(!document.hidden));
  ['focus', 'pointerdown', 'pointermove', 'keydown', 'wheel'].forEach((type) => {
    window.addEventListener(type, () => { if (life.unloaded) reloadUi(); }, { capture: true, passive: true });
  });

  const RAM_MODES = ['auto', 'high', 'balanced', 'low', 'minimal'];
  const RAM_LIMIT_MB = { auto: 0, high: 2048, balanced: 1024, low: 512, minimal: 256 };

  function applyRam() {
    const mode = RAM_MODES.includes(RP.get('ramMode')) ? RP.get('ramMode') : 'auto';
    const root = document.documentElement;
    RAM_MODES.forEach((m) => root.classList.toggle('rp-ram-' + m, m === mode));
    const constrained = mode === 'low' || mode === 'minimal';
    const perfBtn = document.getElementById('btn-perf-mode');
    const perfOn = document.body.classList.contains('perf');
    if (constrained && perfBtn && !perfOn) {
      perfBtn.click();
      RP.set('perfAuto', true);
    } else if (!constrained && RP.get('perfAuto') && perfBtn) {
      if (perfOn) perfBtn.click();
      RP.set('perfAuto', false);
    }
  }

  const hud = { el: null, raf: 0, frames: 0, stamp: 0, fps: 0, worst: 0, last: 0, timer: 0, longTasks: 0, nodes: 0, nodesStamp: 0, paused: false, observer: null };

  function hudFrame(now) {
    hud.raf = requestAnimationFrame(hudFrame);
    if (hud.last) hud.worst = Math.max(hud.worst, now - hud.last);
    hud.last = now;
    hud.frames++;
    if (now - hud.stamp >= 500) {
      hud.fps = hud.frames * 1000 / (now - hud.stamp);
      hud.frames = 0;
      hud.stamp = now;
      renderHud(now);
      hud.worst = 0;
    }
  }

  function renderHud(now) {
    if (!hud.el) return;
    if (now - hud.nodesStamp > 2000) {
      hud.nodes = document.getElementsByTagName('*').length;
      hud.nodesStamp = now;
    }
    const mem = performance.memory ? (performance.memory.usedJSHeapSize / 1048576).toFixed(0) + ' MB' : 'n/a';
    const amb = RP.modules.ambient ? RP.modules.ambient.stats() : null;
    const lines = [
      hud.fps.toFixed(0) + ' fps   worst ' + hud.worst.toFixed(0) + ' ms',
      'heap ' + mem + '   nodes ' + hud.nodes,
      'long tasks ' + hud.longTasks + '   last restore ' + Math.round(life.restoreMs) + ' ms',
      amb ? ('ambient ' + (amb.active ? amb.tier + ' ' + amb.resolution + ' @' + amb.fps : 'off')) : 'ambient off'
    ];
    hud.el.textContent = lines.join('\n');
  }

  function startHud() {
    if (hud.el || hud.paused) return;
    hud.el = h('div', { id: 'rp-hud', 'aria-hidden': 'true' });
    document.body.appendChild(hud.el);
    hud.stamp = performance.now();
    hud.last = 0;
    hud.raf = requestAnimationFrame(hudFrame);
    try {
      hud.observer = new PerformanceObserver((list) => { hud.longTasks += list.getEntries().length; });
      hud.observer.observe({ entryTypes: ['longtask'] });
    } catch (e) {}
  }

  function stopHud() {
    cancelAnimationFrame(hud.raf);
    hud.raf = 0;
    if (hud.observer) { hud.observer.disconnect(); hud.observer = null; }
    if (hud.el) { hud.el.remove(); hud.el = null; }
  }

  function syncHud() {
    if (RP.get('hud') && RP.get('devMode')) startHud();
    else stopHud();
  }

  RP.modules.hud = {
    pause() {},
    resume() { syncHud(); }
  };

  RP.modules.devices = { status, requestDeviceNames, markCurrentAsHeadphones, classify };
  RP.modules.system = {
    RAM_MODES,
    RAM_LIMIT_MB,
    applyRam,
    unloadUi,
    reloadUi,
    isUnloaded: () => life.unloaded,
    lastRestoreMs: () => life.restoreMs
  };

  RP.onChange((key) => {
    if (key === 'headphonePause') syncDevices();
    else if (key === 'ramMode') applyRam();
    else if (key === 'hud' || key === 'devMode') syncHud();
  });

  RP.onReady(() => {
    devices.audio = document.getElementById('native-audio');
    if (devices.audio) devices.audio.addEventListener('play', () => { if (RP.get('headphonePause')) refreshCurrent().catch(() => {}); });
    if (window.electronAPI && typeof window.electronAPI.onWindowVisibility === 'function') window.electronAPI.onWindowVisibility(onVisibility);
    syncDevices();
    applyRam();
    syncHud();
  });
})();
