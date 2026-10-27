(function () {
  const RP = window.BinoPlus;
  const Fuzzy = window.BinoFuzzy;
  const BIG = 4000;
  const TIMEOUT_MS = 4000;

  let worker = null;
  let workerOk = typeof Worker !== 'undefined';
  let nextListId = 1;
  let nextReqId = 1;
  const entries = new WeakMap();
  const pending = new Map();

  function failWorker() {
    workerOk = false;
    if (worker) { try { worker.terminate(); } catch (e) {} worker = null; }
    const jobs = Array.from(pending.values());
    pending.clear();
    jobs.forEach((job) => {
      job.entry.cache = { q: job.q, result: Fuzzy.filter(job.list, job.q) };
      if (job.rerender) job.rerender();
    });
  }

  function onMessage(event) {
    const m = event.data;
    if (!m) return;
    if (m.type === 'result') {
      const job = pending.get(m.reqId);
      if (!job) return;
      pending.delete(m.reqId);
      clearTimeout(job.timer);
      const entry = job.entry;
      if (entry.latestReq !== m.reqId) return;
      if (entry.size !== job.list.length) return;
      const out = new Array(m.order.length);
      for (let i = 0; i < m.order.length; i++) out[i] = job.list[m.order[i]];
      entry.cache = { q: job.q, result: out };
      entry.queued = '';
      if (job.rerender) job.rerender();
    } else if (m.type === 'miss') {
      const job = pending.get(m.reqId);
      if (!job) return;
      pending.delete(m.reqId);
      clearTimeout(job.timer);
      job.entry.indexed = false;
      job.entry.queued = '';
      if (job.entry.latestReq === m.reqId) dispatch(job.entry, job.list, job.q, job.rerender);
    }
  }

  function getWorker() {
    if (!workerOk) return null;
    if (worker) return worker;
    try {
      worker = new Worker('plus/worker.js');
      worker.onmessage = onMessage;
      worker.onerror = failWorker;
      worker.onmessageerror = failWorker;
    } catch (e) {
      failWorker();
      return null;
    }
    return worker;
  }

  function dispatch(entry, list, q, rerender) {
    const w = getWorker();
    if (!w) {
      entry.cache = { q, result: Fuzzy.filter(list, q) };
      return;
    }
    if (!entry.indexed) {
      entry.version++;
      const slim = new Array(list.length);
      for (let i = 0; i < list.length; i++) {
        const t = list[i] || {};
        slim[i] = { title: t.title || '', artist: t.artist || '', platform: t.platform || '' };
      }
      w.postMessage({ type: 'index', listId: entry.id, version: entry.version, tracks: slim });
      entry.indexed = true;
    }
    const reqId = nextReqId++;
    entry.latestReq = reqId;
    const job = { entry, list, q, rerender, timer: setTimeout(failWorker, TIMEOUT_MS) };
    pending.set(reqId, job);
    w.postMessage({ type: 'query', listId: entry.id, version: entry.version, q, reqId });
  }

  function filter(list, query, rerender) {
    if (!Array.isArray(list)) return [];
    const q = Fuzzy.normalize(query);
    if (!q) return list;
    if (list.length < BIG || !workerOk) return Fuzzy.filter(list, q);
    let entry = entries.get(list);
    if (!entry || entry.size !== list.length || entry.first !== list[0] || entry.lastItem !== list[list.length - 1]) {
      if (entry) { const w = getWorker(); if (w) w.postMessage({ type: 'drop', listId: entry.id }); }
      entry = { id: nextListId++, version: 0, size: list.length, first: list[0], lastItem: list[list.length - 1], indexed: false, cache: null, latestReq: 0 };
      entries.set(list, entry);
    }
    if (entry.cache && entry.cache.q === q) return entry.cache.result;
    if (entry.queued !== q) {
      entry.queued = q;
      dispatch(entry, list, q, rerender);
    }
    if (!workerOk) return Fuzzy.filter(list, q);
    return entry.cache ? entry.cache.result : list;
  }

  const VIEW_BARS = [
    { view: 'queue', id: 'rp-filter-queue', placeholder: 'Filter queue' },
    { view: 'history', id: 'rp-filter-history', placeholder: 'Filter history' }
  ];

  function mountBars() {
    VIEW_BARS.forEach((bar) => {
      const header = document.querySelector('#view-' + bar.view + ' .view-header');
      if (!header || document.getElementById(bar.id)) return;
      const input = document.createElement('input');
      input.type = 'text';
      input.id = bar.id;
      input.className = 'view-search-input rp-filter-input';
      input.placeholder = bar.placeholder;
      input.autocomplete = 'off';
      input.spellcheck = false;
      const clearBtn = header.querySelector('button');
      header.insertBefore(input, clearBtn || null);
      let raf = 0;
      input.addEventListener('input', () => {
        cancelAnimationFrame(raf);
        raf = requestAnimationFrame(() => {
          const rr = window.__bino && window.__bino['render' + bar.view.charAt(0).toUpperCase() + bar.view.slice(1) + 'View'];
          if (typeof rr === 'function') rr();
        });
      });
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') { input.value = ''; input.dispatchEvent(new Event('input')); input.blur(); }
      });
    });
  }

  function filterView(view, list, rerender) {
    const bar = VIEW_BARS.find((b) => b.view === view);
    const input = bar && document.getElementById(bar.id);
    if (!input || !input.value.trim()) return list;
    return filter(list, input.value, rerender);
  }

  const FOCUS_IDS = {
    favorites: 'favorites-search-input', local: 'local-search-input', 'playlist-detail': 'playlist-search-input',
    queue: 'rp-filter-queue', history: 'rp-filter-history'
  };

  function focusCurrentFilter() {
    const view = window.__bino && window.__bino.state && window.__bino.state.currentView;
    const input = document.getElementById(FOCUS_IDS[view] || '');
    if (!input) return false;
    input.focus();
    input.select();
    return true;
  }

  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 'f') {
      if (focusCurrentFilter()) e.preventDefault();
    }
  }, true);

  RP.filter = filter;
  RP.filterView = filterView;
  RP.search = { filter, filterView, focusCurrentFilter, mountBars, isWorkerActive: () => !!worker && workerOk };
  RP.onReady(mountBars);
})();
