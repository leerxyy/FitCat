import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const source = (await readFile(new URL('../scripts/sw-template.js', import.meta.url), 'utf8')).replace('__CACHE_VERSION__', 'test').replace('__PRECACHE_FILES__', JSON.stringify(['index.html', 'styles.css', 'app/app.js']));
function setup() {
  const handlers = {}, entries = new Map(), deleted = [], precached = [];
  let mode = 'online', claims = 0, skips = 0, requests = 0;
  const cache = { addAll: async urls => { precached.push(...urls); }, match: async url => entries.get(url), put: async (url, response) => { entries.set(url, response); } };
  const caches = { open: async () => cache, keys: async () => ['ritua:/app/:old', 'ritua:/other/:old', 'unrelated-app'], delete: async key => { deleted.push(key); }, match: async url => entries.get(url) };
  const self = { location: { href: 'https://ritua.test/app/sw.js' }, addEventListener: (name, handler) => { handlers[name] = handler; }, skipWaiting: () => { skips++; }, clients: { claim: () => { claims++; } } };
  const context = { self, caches, URL, Response, fetch: async () => { requests++; if (mode === 'offline') throw new Error('offline'); return new Response('fresh interface', { status: 200 }); } };
  vm.runInNewContext(source, context);
  return { handlers, entries, precached, deleted, setMode(m) { mode = m; }, get requests() { return requests; }, get claims() { return claims; }, get skips() { return skips; } };
}
async function lifecycle(env, name) { let promise; env.handlers[name]({ waitUntil: p => { promise = p; } }); await promise; }
async function fetchEvent(env, request) { let promise; env.handlers.fetch({ request, respondWith: p => { promise = p; } }); return promise ? { handled: true, response: await promise } : { handled: false }; }

test('offline install precaches complete shell under its actual subpath', async () => {
  const env = setup(); await lifecycle(env, 'install'); assert.deepEqual(env.precached, ['https://ritua.test/app/index.html', 'https://ritua.test/app/styles.css', 'https://ritua.test/app/app/app.js']);
});
test('activation removes only old caches for this app scope', async () => {
  const env = setup(); await lifecycle(env, 'activate'); assert.deepEqual(env.deleted, ['ritua:/app/:old']); assert.equal(env.claims, 1);
});
test('worker activation is user-controlled, not forced during a diary session', () => {
  const env = setup(); assert.equal(env.skips, 0); env.handlers.message({ data: { type: 'UNKNOWN' } }); assert.equal(env.skips, 0); env.handlers.message({ data: { type: 'SKIP_WAITING' } }); assert.equal(env.skips, 1);
});
test('navigation refreshes online and falls back to cached app offline', async () => {
  const env = setup(); const request = { method: 'GET', mode: 'navigate', url: 'https://ritua.test/app/' };
  await fetchEvent(env, request); assert.ok(env.entries.has('https://ritua.test/app/index.html'));
  env.setMode('offline'); const result = await fetchEvent(env, request); assert.equal(result.response.status, 200); assert.equal(await result.response.text(), 'fresh interface');
});
test('empty offline cache returns an explicit 503 instead of a broken page', async () => {
  const env = setup(); env.setMode('offline'); const result = await fetchEvent(env, { method: 'GET', mode: 'navigate', url: 'https://ritua.test/app/' }); assert.equal(result.response.status, 503); assert.match(await result.response.text(), /подключением/);
});
test('external API calls, uploads and unrelated paths never enter offline caches', async () => {
  const env = setup();
  for (const request of [{ method: 'GET', url: 'https://world.openfoodfacts.org/cgi/search.pl' }, { method: 'POST', url: 'https://ritua.test/app/' }, { method: 'GET', url: 'https://ritua.test/private-records' }]) assert.equal((await fetchEvent(env, request)).handled, false);
  assert.equal(env.requests, 0);
});
test('cached shell assets stay available offline, including query-string requests', async () => {
  const env = setup(); env.entries.set('https://ritua.test/app/styles.css', new Response('css')); env.setMode('offline');
  const result = await fetchEvent(env, { method: 'GET', url: 'https://ritua.test/app/styles.css?v=1' }); assert.equal(await result.response.text(), 'css'); assert.equal(env.requests, 0);
});
