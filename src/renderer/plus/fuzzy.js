(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.BinoFuzzy = api;
})(typeof self !== 'undefined' ? self : this, function () {
  const DIACRITICS = /[\u0300-\u036f]/g;
  const PLATFORM_ALIASES = {
    youtube: 'youtube yt', ytmusic: 'youtube music ytm yt', soundcloud: 'soundcloud sc', local: 'local file files offline'
  };

  function normalize(value) {
    if (typeof value !== 'string' || !value) return '';
    return value.normalize('NFKD').replace(DIACRITICS, '').toLowerCase().replace(/\s+/g, ' ').trim();
  }

  function platformText(track) {
    const p = String((track && track.platform) || '').toLowerCase();
    return PLATFORM_ALIASES[p] ? PLATFORM_ALIASES[p] : p;
  }

  function buildIndex(tracks) {
    const n = tracks.length;
    const title = new Array(n);
    const artist = new Array(n);
    const platform = new Array(n);
    for (let i = 0; i < n; i++) {
      const t = tracks[i] || {};
      title[i] = normalize(t.title);
      artist[i] = normalize(t.artist);
      platform[i] = platformText(t).split(' ');
    }
    return { size: n, title, artist, platform };
  }

  function isBoundary(text, i) {
    if (i === 0) return true;
    const c = text.charCodeAt(i - 1);
    return c === 32 || c === 45 || c === 95 || c === 40 || c === 91 || c === 47 || c === 46 || c === 44;
  }

  function scoreToken(text, token) {
    const tl = token.length;
    const xl = text.length;
    if (!tl) return 0;
    if (!xl || tl > xl) return -1;
    const exact = text.indexOf(token);
    if (exact !== -1) {
      let s = 100 + tl * 8;
      if (exact === 0) s += 60;
      else if (isBoundary(text, exact)) s += 35;
      if (tl === xl) s += 80;
      return s - exact * 0.25;
    }
    let ti = 0;
    let score = 0;
    let streak = 0;
    let gaps = 0;
    let last = -2;
    for (let i = 0; i < xl && ti < tl; i++) {
      if (text.charCodeAt(i) === token.charCodeAt(ti)) {
        let bonus = 10;
        if (last === i - 1) { streak++; bonus += 8 + streak * 4; } else { streak = 0; if (last >= 0) gaps += i - last - 1; }
        if (isBoundary(text, i)) bonus += 22;
        score += bonus;
        last = i;
        ti++;
      }
    }
    if (ti < tl) return -1;
    return score - gaps * 1.5 - (xl - tl) * 0.1;
  }

  function scorePlatform(words, token) {
    if (token.length < 2) return -1;
    for (let w = 0; w < words.length; w++) {
      if (words[w].startsWith(token)) return 90 + token.length * 6 + (words[w].length === token.length ? 40 : 0);
    }
    return -1;
  }

  function scoreTrack(index, i, tokens) {
    let total = 0;
    for (let k = 0; k < tokens.length; k++) {
      const tok = tokens[k];
      let best = -1;
      const a = scoreToken(index.title[i], tok);
      if (a >= 0) best = a * 1.0;
      const b = scoreToken(index.artist[i], tok);
      if (b >= 0 && b * 0.85 > best) best = b * 0.85;
      const c = scorePlatform(index.platform[i], tok);
      if (c >= 0 && c * 0.6 > best) best = c * 0.6;
      if (best < 0) {
        const joined = index.title[i] + ' ' + index.artist[i];
        const d = scoreToken(joined, tok);
        if (d < 0) return -1;
        best = d * 0.7;
      }
      total += best;
    }
    return total;
  }

  function query(index, q, limit) {
    const tokens = normalize(q).split(' ').filter(Boolean);
    const n = index.size;
    if (!tokens.length) {
      const all = new Array(n);
      for (let i = 0; i < n; i++) all[i] = i;
      return all;
    }
    const hits = [];
    for (let i = 0; i < n; i++) {
      const s = scoreTrack(index, i, tokens);
      if (s >= 0) hits.push({ i, s });
    }
    hits.sort((x, y) => (y.s - x.s) || (x.i - y.i));
    const cap = limit > 0 ? Math.min(limit, hits.length) : hits.length;
    const out = new Array(cap);
    for (let k = 0; k < cap; k++) out[k] = hits[k].i;
    return out;
  }

  const cache = typeof WeakMap !== 'undefined' ? new WeakMap() : null;

  function filter(tracks, q, limit) {
    if (!Array.isArray(tracks)) return [];
    if (!normalize(q)) return tracks;
    let entry = cache ? cache.get(tracks) : null;
    if (!entry || entry.size !== tracks.length || entry.first !== tracks[0] || entry.last !== tracks[tracks.length - 1]) {
      entry = { size: tracks.length, first: tracks[0], last: tracks[tracks.length - 1], index: buildIndex(tracks) };
      if (cache) cache.set(tracks, entry);
    }
    const order = query(entry.index, q, limit);
    const out = new Array(order.length);
    for (let k = 0; k < order.length; k++) out[k] = tracks[order[k]];
    return out;
  }

  return { normalize, buildIndex, query, filter, scoreToken };
});
