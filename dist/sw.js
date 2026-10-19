/* RITUA offline shell. Diary data stays in localStorage, never in HTTP caches. */
const BASE = new URL('./', self.location.href);
const PREFIX = `ritua:${BASE.pathname}:`;
const CACHE = `${PREFIX}611c8c04b4d438`;
const FILES = ["app/app.js","app/atelier-views.js","app/atelier.js","app/core.js","app/data.js","app/icons.js","app/theme.js","app/ui.js","app/views.js","assets/atelier-courtyard.webp","assets/favicon.svg","assets/icon-192.png","assets/icon-512.png","assets/icon-maskable-512.png","assets/logo-light.svg","assets/logo.svg","assets/recipe-bowl.webp","assets/recipe-chicken.webp","assets/recipe-lentils.webp","assets/recipe-oats.webp","assets/recipe-toast.webp","assets/recipe-yogurt.webp","assets/ritua-still-life.webp","atelier.css","index.html","manifest.webmanifest","styles.css"];
const URLS = FILES.map(file => new URL(file, BASE).href);
const INDEX = new URL('index.html', BASE).href;

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(URLS)));
});
self.addEventListener('message', event => { if (event.data?.type === 'SKIP_WAITING') self.skipWaiting(); });
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith(PREFIX) && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== BASE.origin) return;
  if (request.mode === 'navigate' && (url.pathname === BASE.pathname || url.pathname === new URL(INDEX).pathname)) {
    event.respondWith((async () => {
      try {
        const response = await fetch(request);
        if (response.ok && !response.redirected) { const cache = await caches.open(CACHE); await cache.put(INDEX, response.clone()); }
        return response;
      } catch { return await caches.match(INDEX) || new Response('RITUA пока недоступна без сети. Откройте приложение с подключением к интернету.', { status: 503, headers: { 'Content-Type': 'text/plain;charset=utf-8' } }); }
    })());
    return;
  }
  url.search = ''; url.hash = '';
  if (!URLS.includes(url.href)) return;
  event.respondWith(caches.open(CACHE).then(async cache => {
    const cached = await cache.match(url.href);
    if (cached) return cached;
    const response = await fetch(request);
    if (response.ok && !response.redirected) await cache.put(url.href, response.clone());
    return response;
  }));
});
