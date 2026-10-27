function pickNextTrackIndex(ctx) {
  const queue = ctx && Array.isArray(ctx.queue) ? ctx.queue : [];
  const cur = ctx && Number.isInteger(ctx.queueIndex) ? ctx.queueIndex : -1;
  if (!queue.length || cur < 0 || cur >= queue.length) return -1;
  if (ctx.isRepeat) return -1;
  if (ctx.isShuffle) {
    if (queue.length === 1) return 0;
    const rand = typeof ctx.random === 'function' ? ctx.random : Math.random;
    let idx = Math.floor(rand() * (queue.length - 1));
    if (idx >= cur) idx += 1;
    return Math.min(idx, queue.length - 1);
  }
  if (cur + 1 < queue.length) return cur + 1;
  if (ctx.isRadioQueue || ctx.myWaveActive) return -1;
  return 0;
}

function createNextPlanner(keyOf) {
  let plan = null;

  function stillValid(p, ctx) {
    const queue = ctx.queue;
    return !!p
      && p.from === ctx.queueIndex
      && p.shuffle === !!ctx.isShuffle
      && p.repeat === !!ctx.isRepeat
      && p.len === queue.length
      && !!queue[p.idx]
      && keyOf(queue[p.idx]) === p.key;
  }

  function peek(ctx) {
    if (plan && stillValid(plan, ctx)) return plan.idx;
    plan = null;
    const idx = pickNextTrackIndex(ctx);
    if (idx < 0 || !ctx.queue[idx]) return -1;
    plan = {
      idx,
      key: keyOf(ctx.queue[idx]),
      from: ctx.queueIndex,
      shuffle: !!ctx.isShuffle,
      repeat: !!ctx.isRepeat,
      len: ctx.queue.length
    };
    return idx;
  }

  function take(ctx) {
    const p = plan;
    plan = null;
    return p && stillValid(p, ctx) ? p.idx : -1;
  }

  function reset() { plan = null; }

  return { peek, take, reset };
}

if (typeof module !== 'undefined') module.exports = { pickNextTrackIndex, createNextPlanner };
