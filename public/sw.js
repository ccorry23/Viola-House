/*
 * Storybook service worker — offline app shell.
 *
 * Strategy: network-first for same-origin GET requests, falling back to the
 * cache when offline. Every successful response is cached, so once a page has
 * been opened online it will re-open with no connection. This keeps HMR and
 * fresh content working while online, and makes writing work with no WiFi.
 */
const CACHE = 'storybook-v1'

self.addEventListener('install', (event) => {
  self.skipWaiting()
  event.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(['/', '/manifest.webmanifest']).catch(() => {}))
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys()
      await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
      await self.clients.claim()
    })()
  )
})

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return

  const url = new URL(req.url)
  if (url.origin !== self.location.origin) return
  // Don't cache dev HMR / websocket / turbopack HMR endpoints.
  if (url.pathname.startsWith('/_next/webpack-hmr') || url.pathname.includes('__nextjs')) return

  event.respondWith(
    (async () => {
      try {
        const res = await fetch(req)
        if (res && res.status === 200 && res.type === 'basic') {
          const clone = res.clone()
          caches.open(CACHE).then((c) => c.put(req, clone))
        }
        return res
      } catch {
        const cached = await caches.match(req)
        if (cached) return cached
        // Navigation with nothing cached → boot the app shell so the
        // client-side app (and local IndexedDB data) can render.
        if (req.mode === 'navigate') {
          const shell = await caches.match('/')
          if (shell) return shell
        }
        return new Response('Offline', { status: 503, statusText: 'Offline' })
      }
    })()
  )
})
