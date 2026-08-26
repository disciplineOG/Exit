const CACHE_VERSION = 'v1';
const CACHE_NAME = `jbdd-${CACHE_VERSION}`;

const CORE_ASSETS = [
  './',
  'index.html',
  'assets/app.js',
  'assets/styles.css',
  'manifest.json',
  'data/curriculum.json',
  'assets/favicon-32.png',
  'assets/icon-180.png',
  'assets/icon-192.png',
  'assets/icon-512.png',
];

async function precacheAll() {
  const cache = await caches.open(CACHE_NAME);
  await cache.addAll(CORE_ASSETS);
  try {
    const res = await fetch('data/curriculum.json');
    const data = await res.json();
    const files = [];
    (data.phases || []).forEach((phase) => {
      (phase.dayRanges || []).forEach((dr) => {
        (dr.topics || []).forEach((topic) => {
          if (topic.file) files.push(topic.file);
        });
      });
    });
    await cache.addAll(files);
  } catch (e) {
    // curriculum fetch failed at install time — runtime caching below still covers pages as visited
  }
}

self.addEventListener('install', (event) => {
  event.waitUntil(precacheAll().then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)));
      await self.clients.claim();
    })()
  );
});

// Stale-while-revalidate: serve from cache instantly when offline/cached,
// always refetch in the background so content updates surface next load.
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' || !req.url.startsWith(self.location.origin)) return;

  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      const cached = await cache.match(req);
      const network = fetch(req)
        .then((res) => {
          if (res && res.ok) cache.put(req, res.clone());
          return res;
        })
        .catch(() => null);
      return cached || (await network) || new Response('Offline and not cached yet.', { status: 503 });
    })()
  );
});
