const test = require('node:test');
const assert = require('node:assert');
const F = require('../src/renderer/plus/fuzzy.js');

const T = [
  { title: 'Blinding Lights', artist: 'The Weeknd', platform: 'youtube' },
  { title: 'Bohemian Rhapsody', artist: 'Queen', platform: 'local' },
  { title: 'Lose Yourself', artist: 'Eminem', platform: 'soundcloud' },
  { title: 'Café del Mar', artist: 'Energy 52', platform: 'ytmusic' },
  { title: 'Numb', artist: 'Linkin Park', platform: 'youtube' }
];
const titles = (q) => F.filter(T, q).map((x) => x.title);

test('fuzzy subsequence, accents, artist and platform', () => {
  assert.deepStrictEqual(titles('blnd'), ['Blinding Lights']);
  assert.deepStrictEqual(titles('bohem queen'), ['Bohemian Rhapsody']);
  assert.deepStrictEqual(titles('cafe'), ['Café del Mar']);
  assert.deepStrictEqual(titles('local'), ['Bohemian Rhapsody']);
  assert.deepStrictEqual(titles('sc'), ['Lose Yourself']);
  assert.deepStrictEqual(titles('zzzz'), []);
  assert.strictEqual(F.filter(T, '  '), T);
  assert.strictEqual(titles('numb')[0], 'Numb');
});
