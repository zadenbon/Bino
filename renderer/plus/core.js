(function () {
  if (window.RiffPlus) return;

  const PREFIX = 'riff_plus_';
  const DEFAULTS = {
    skin: true,
    accent: 'cover',
    glow: 55,
    ambient: true,
    ambientIntensity: 70,
    ambientQuality: 'auto',
    declutter: true,
    headphonePause: false,
    headphoneLabels: [],
    ramMode: 'auto',
    perfAuto: false,
    devMode: false,
    hud: false,
    loops: {},
    loopRemember: true,
    moduleLoop: true,
    moduleSearch: true,
    modulePalette: true
  };

  const listeners = new Set();
  const readyQueue = [];
  let isReady = false;

  function read(key) {
    try {
      const raw = localStorage.getItem(PREFIX + key);
      return raw === null ? DEFAULTS[key] : JSON.parse(raw);
    } catch (e) {
      return DEFAULTS[key];
    }
  }

  function write(key, value) {
    try { localStorage.setItem(PREFIX + key, JSON.stringify(value)); } catch (e) {}
    listeners.forEach((fn) => { try { fn(key, value); } catch (err) { console.error('[riff+]', err); } });
  }

  function h(tag, attrs, ...kids) {
    const node = document.createElement(tag);
    if (attrs) {
      for (const key of Object.keys(attrs)) {
        const value = attrs[key];
        if (value === null || value === undefined || value === false) continue;
        if (key === 'class') node.className = value;
        else if (key === 'dataset') Object.assign(node.dataset, value);
        else if (key === 'style' && typeof value === 'object') Object.assign(node.style, value);
        else if (key.startsWith('on') && typeof value === 'function') node.addEventListener(key.slice(2).toLowerCase(), value);
        else if (value === true) node.setAttribute(key, '');
        else node.setAttribute(key, String(value));
      }
    }
    kids.flat(Infinity).forEach((kid) => {
      if (kid === null || kid === undefined || kid === false) return;
      node.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
    });
    return node;
  }

  function toast(message, type) {
    if (window.__riff && typeof window.__riff.showToast === 'function') window.__riff.showToast(message, type || 'info');
  }

  function confirmDialog(opts) {
    return new Promise((resolve) => {
      const previous = document.activeElement;
      const cancelBtn = h('button', { type: 'button', class: 'rp-btn rp-btn-quiet' }, opts.cancelLabel || 'Cancel');
      const okBtn = h('button', { type: 'button', class: 'rp-btn ' + (opts.danger ? 'rp-btn-danger' : 'rp-btn-accent') }, opts.confirmLabel || 'Continue');
      const dialog = h('div', { class: 'rp-dialog', role: 'alertdialog', 'aria-modal': 'true', 'aria-labelledby': 'rp-dialog-title' },
        h('h3', { id: 'rp-dialog-title' }, opts.title),
        h('p', null, opts.body),
        h('div', { class: 'rp-dialog-actions' }, cancelBtn, okBtn)
      );
      const backdrop = h('div', { class: 'rp-dialog-backdrop' }, dialog);
      const finish = (result) => {
        document.removeEventListener('keydown', onKey, true);
        backdrop.remove();
        if (previous && previous.focus) previous.focus();
        resolve(result);
      };
      const onKey = (e) => {
        if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); finish(false); }
        else if (e.key === 'Tab') {
          const items = [cancelBtn, okBtn];
          const idx = items.indexOf(document.activeElement);
          e.preventDefault();
          items[(idx + (e.shiftKey ? items.length - 1 : 1)) % items.length].focus();
        }
      };
      cancelBtn.addEventListener('click', () => finish(false));
      okBtn.addEventListener('click', () => finish(true));
      backdrop.addEventListener('mousedown', (e) => { if (e.target === backdrop) finish(false); });
      document.addEventListener('keydown', onKey, true);
      document.body.appendChild(backdrop);
      (opts.danger ? cancelBtn : okBtn).focus();
    });
  }

  const colorProbe = document.createElement('canvas');
  colorProbe.width = colorProbe.height = 1;
  const colorCtx = colorProbe.getContext('2d', { willReadFrequently: true });
  const colorCache = new Map();

  function cssColorToRgb(value) {
    const key = String(value || '').trim();
    if (!key) return [0.55, 0.45, 1];
    if (colorCache.has(key)) return colorCache.get(key);
    let out = [0.55, 0.45, 1];
    try {
      colorCtx.clearRect(0, 0, 1, 1);
      colorCtx.fillStyle = '#000';
      colorCtx.fillStyle = key;
      colorCtx.fillRect(0, 0, 1, 1);
      const d = colorCtx.getImageData(0, 0, 1, 1).data;
      out = [d[0] / 255, d[1] / 255, d[2] / 255];
    } catch (e) {}
    if (colorCache.size > 64) colorCache.clear();
    colorCache.set(key, out);
    return out;
  }

  function mixRgb(a, b, t) {
    return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  }

  function getAccentRgb() {
    const cs = getComputedStyle(document.documentElement);
    const accent = cs.getPropertyValue('--rp-accent').trim() || cs.getPropertyValue('--md-sys-color-primary').trim();
    return cssColorToRgb(accent);
  }

  function getTonalRgb(name) {
    const cs = getComputedStyle(document.documentElement);
    return cssColorToRgb(cs.getPropertyValue(name).trim());
  }

  const ACCENT_PRESETS = {
    cyan: '#2EF2FF',
    magenta: '#FF3DCB',
    lime: '#B6FF3B',
    amber: '#FFB020',
    coral: '#FF5C7A'
  };

  function applyAppearance() {
    const root = document.documentElement;
    root.classList.toggle('rp-skin', !!read('skin'));
    const accent = read('accent');
    if (accent === 'cover') {
      root.classList.add('rp-accent-cover');
      root.style.removeProperty('--rp-accent');
      root.style.removeProperty('--rp-on-accent');
    } else {
      root.classList.remove('rp-accent-cover');
      const hex = ACCENT_PRESETS[accent] || (/^#[0-9a-f]{6}$/i.test(accent) ? accent : ACCENT_PRESETS.cyan);
      root.style.setProperty('--rp-accent', hex);
      const lum = (0.2126 * parseInt(hex.slice(1, 3), 16) + 0.7152 * parseInt(hex.slice(3, 5), 16) + 0.0722 * parseInt(hex.slice(5, 7), 16)) / 255;
      root.style.setProperty('--rp-on-accent', lum > 0.55 ? '#0b0c0f' : '#ffffff');
    }
    root.style.setProperty('--rp-glow-pct', String(Math.max(0, Math.min(100, Number(read('glow')) || 0))));
    root.classList.toggle('rp-declutter', !!read('declutter'));
  }

  function onReady(fn) {
    if (isReady) { try { fn(); } catch (e) { console.error('[riff+]', e); } return; }
    readyQueue.push(fn);
  }

  function markReady() {
    if (isReady) return;
    isReady = true;
    readyQueue.splice(0).forEach((fn) => { try { fn(); } catch (e) { console.error('[riff+]', e); } });
  }

  window.RiffPlus = {
    version: '1.0.0',
    defaults: DEFAULTS,
    accentPresets: ACCENT_PRESETS,
    get: read,
    set: write,
    onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    onReady,
    h,
    toast,
    confirm: confirmDialog,
    cssColorToRgb,
    mixRgb,
    getAccentRgb,
    getTonalRgb,
    applyAppearance,
    modules: {}
  };

  applyAppearance();
  window.RiffPlus.onChange((key) => {
    if (key === 'skin' || key === 'accent' || key === 'glow' || key === 'declutter') applyAppearance();
  });

  if (window.__riff) markReady();
  else window.addEventListener('riff:ready', markReady, { once: true });
  window.addEventListener('load', () => setTimeout(() => { if (window.__riff) markReady(); }, 0));
})();
