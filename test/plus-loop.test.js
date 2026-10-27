const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

test('A-B loop jumps back within 25 ms of B on a simulated clock', async () => {
  const store = { moduleLoop: true, loops: {}, loopRemember: false };
  const ready = [];
  const listeners = {};
  let base = 0.5, t0 = performance.now(), playing = true;
  const jumps = [];
  const audio = {
    src: 'x', readyState: 4, seeking: false, paused: false, duration: 10, playbackRate: 1,
    get currentTime() { return playing ? base + (performance.now() - t0) / 1000 : base; },
    set currentTime(v) {
      jumps.push(this.currentTime);
      this.seeking = true; base = v; t0 = performance.now();
      setTimeout(() => { this.seeking = false; t0 = performance.now(); (listeners.seeked || []).forEach((f) => f()); }, 8);
    },
    addEventListener(n, f) { (listeners[n] = listeners[n] || []).push(f); }
  };
  const saved = { window: global.window, document: global.document };
  global.window = { BinoPlus: { get: (k) => store[k], set: (k, v) => { store[k] = v; }, h: () => ({}), toast() {}, onReady: (f) => ready.push(f), modules: {} }, addEventListener() {} };
  global.document = { querySelector: () => null, getElementById: (id) => (id === 'native-audio' ? audio : null), addEventListener() {}, body: {} };
  new Function(fs.readFileSync(path.join(__dirname, '../src/renderer/plus/loop.js'), 'utf8')).call(global);
  ready.forEach((f) => f());
  const L = global.window.BinoPlus.modules.loop;
  L.setA(1.0);
  L.setB(2.0);
  (listeners.play || []).forEach((f) => f());
  await new Promise((r) => setTimeout(r, 4200));
  playing = false; audio.paused = true; (listeners.pause || []).forEach((f) => f());
  L.destroy();
  global.window = saved.window; global.document = saved.document;
  assert.ok(jumps.length >= 3, 'expected repeated jumps, got ' + jumps.length);
  jumps.forEach((t) => assert.ok(Math.abs(t - 2.0) < 0.025, 'jump at ' + t));
  assert.deepStrictEqual(L.parseTime('1:02.5'), 62.5);
});
