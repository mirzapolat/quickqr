// Service worker template. The build (see vite.config.js) replaces the
// placeholders with a content version and the list of files to precache.

const VERSION = '__VERSION__'
const PRECACHE = [/* __PRECACHE__ */]
const CACHE = `quickqr-${VERSION}`
const NETWORK_TIMEOUT_MS = 3000

self.addEventListener('install', (event) => {
  event.waitUntil(
    // cache: 'reload' bypasses the HTTP cache, which may still hold an older
    // index.html that points at assets from a previous build.
    caches.open(CACHE)
      .then(cache => cache.addAll(PRECACHE.map(url => new Request(url, { cache: 'reload' }))))
      .then(() => self.skipWaiting())
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys
          .filter(key => key.startsWith('quickqr-') && key !== CACHE)
          .map(key => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  )
})

function fetchWithTimeout(request) {
  return Promise.race([
    fetch(request),
    new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), NETWORK_TIMEOUT_MS)),
  ])
}

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return

  // Pages: network first, so an online visit always gets an index.html that
  // matches the assets on the server. (A cached index can't be relied on:
  // Chrome may race asset requests to the network, bypassing this worker.)
  // Offline or on a stalled connection, fall back to the precached shell.
  // Query strings (share target) are handled in-app.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetchWithTimeout(request).catch(() =>
        caches.match('/', { cacheName: CACHE }).then(cached => cached || Response.error())
      )
    )
    return
  }

  // Everything else is precached and content-hashed: cache first.
  event.respondWith(
    caches.match(request, { ignoreSearch: true }).then(cached => cached || fetch(request))
  )
})
