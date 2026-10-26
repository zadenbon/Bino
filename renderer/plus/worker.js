importScripts('fuzzy.js');

const indexes = new Map();

self.onmessage = (event) => {
  const m = event.data;
  if (!m) return;
  if (m.type === 'index') {
    indexes.set(m.listId, { version: m.version, index: self.RiffFuzzy.buildIndex(m.tracks) });
    self.postMessage({ type: 'indexed', listId: m.listId, version: m.version });
  } else if (m.type === 'query') {
    const entry = indexes.get(m.listId);
    if (!entry || entry.version !== m.version) {
      self.postMessage({ type: 'miss', reqId: m.reqId, listId: m.listId });
      return;
    }
    const order = Int32Array.from(self.RiffFuzzy.query(entry.index, m.q, 0));
    self.postMessage({ type: 'result', reqId: m.reqId, listId: m.listId, version: m.version, q: m.q, order }, [order.buffer]);
  } else if (m.type === 'drop') {
    indexes.delete(m.listId);
  } else if (m.type === 'ping') {
    self.postMessage({ type: 'pong' });
  }
};
