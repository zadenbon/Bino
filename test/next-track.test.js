const test = require('node:test');
const assert = require('node:assert');
const { pickNextTrackIndex, createNextPlanner } = require('../src/renderer/next-track');

const q = (n) => Array.from({ length: n }, (_, i) => ({ id: 't' + i }));
const keyOf = (t) => 'yt:' + t.id;

test('sequential: next entry, wraps to the start at the end of the queue', () => {
  assert.strictEqual(pickNextTrackIndex({ queue: q(4), queueIndex: 0 }), 1);
  assert.strictEqual(pickNextTrackIndex({ queue: q(4), queueIndex: 2 }), 3);
  assert.strictEqual(pickNextTrackIndex({ queue: q(4), queueIndex: 3 }), 0);
});

test('repeat-one has no next track, and neither does an empty or invalid queue', () => {
  assert.strictEqual(pickNextTrackIndex({ queue: q(4), queueIndex: 1, isRepeat: true }), -1);
  assert.strictEqual(pickNextTrackIndex({ queue: [], queueIndex: 0 }), -1);
  assert.strictEqual(pickNextTrackIndex({ queue: q(3), queueIndex: -1 }), -1);
  assert.strictEqual(pickNextTrackIndex({ queue: q(3), queueIndex: 9 }), -1);
  assert.strictEqual(pickNextTrackIndex(null), -1);
});

test('radio and My Wave queues do not guess past the end (the queue is extended later)', () => {
  assert.strictEqual(pickNextTrackIndex({ queue: q(3), queueIndex: 2, isRadioQueue: true }), -1);
  assert.strictEqual(pickNextTrackIndex({ queue: q(3), queueIndex: 2, myWaveActive: true }), -1);
  assert.strictEqual(pickNextTrackIndex({ queue: q(3), queueIndex: 1, isRadioQueue: true }), 2);
});

test('shuffle never picks the current song and can reach every other song', () => {
  const seen = new Set();
  for (let r = 0; r < 1; r += 0.01) {
    const idx = pickNextTrackIndex({ queue: q(5), queueIndex: 2, isShuffle: true, random: () => r });
    assert.notStrictEqual(idx, 2);
    assert.ok(idx >= 0 && idx < 5);
    seen.add(idx);
  }
  assert.deepStrictEqual([...seen].sort(), [0, 1, 3, 4]);
  assert.strictEqual(pickNextTrackIndex({ queue: q(5), queueIndex: 4, isShuffle: true, random: () => 0.999999 }), 3);
  assert.strictEqual(pickNextTrackIndex({ queue: q(1), queueIndex: 0, isShuffle: true }), 0);
});

test('planner keeps a shuffle choice stable until something changes', () => {
  const planner = createNextPlanner(keyOf);
  const queue = q(6);
  const draws = [0.1, 0.9, 0.5];
  let n = 0;
  const ctx = { queue, queueIndex: 1, isShuffle: true, random: () => draws[n++ % draws.length] };
  const first = planner.peek(ctx);
  assert.strictEqual(planner.peek(ctx), first);
  assert.strictEqual(planner.peek(ctx), first);
  assert.strictEqual(n, 1, 'random was only drawn once');
  assert.strictEqual(planner.take(ctx), first);
  assert.strictEqual(planner.take(ctx), -1, 'a plan can only be taken once');
});

test('planner drops its plan when the queue, position or mode changes', () => {
  const planner = createNextPlanner(keyOf);
  const queue = q(6);
  const base = { queue, queueIndex: 1, isShuffle: true, random: () => 0.7 };
  const a = planner.peek(base);
  assert.ok(a >= 0);

  const reordered = queue.slice().reverse();
  assert.strictEqual(planner.take({ ...base, queue: reordered }), -1);

  planner.peek(base);
  assert.strictEqual(planner.take({ ...base, queueIndex: 2 }), -1);

  planner.peek(base);
  assert.strictEqual(planner.take({ ...base, isShuffle: false }), -1);

  planner.peek(base);
  assert.strictEqual(planner.take({ ...base, isRepeat: true }), -1);

  planner.peek(base);
  queue.push({ id: 'added' });
  assert.strictEqual(planner.take(base), -1);
});

test('planner follows a sequential queue and re-plans after the position moves', () => {
  const planner = createNextPlanner(keyOf);
  const queue = q(3);
  assert.strictEqual(planner.peek({ queue, queueIndex: 0 }), 1);
  assert.strictEqual(planner.peek({ queue, queueIndex: 1 }), 2);
  assert.strictEqual(planner.peek({ queue, queueIndex: 2 }), 0);
  assert.strictEqual(planner.peek({ queue, queueIndex: 2, isRepeat: true }), -1);
});
