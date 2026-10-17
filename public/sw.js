const CACHE_NAME = 'royalhouse-shell-v3'
const OFFLINE_URL = '/offline.html'
const START_URL = '/uz'
const SHELL_ASSETS = [OFFLINE_URL, START_URL, '/', '/royalhouse-icon.svg']

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(SHELL_ASSETS))
      .then(() => self.skipWaiting())
  )
})

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys
        .filter(key => key.startsWith('royalhouse-shell-') && key !== CACHE_NAME)
        .map(key => caches.delete(key))
    )).then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', event => {
  const request = event.request
  if (request.method !== 'GET') return

  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return
  if (url.pathname.startsWith('/api/')) return
  if (url.pathname.startsWith('/auth')) return
  if (url.pathname.startsWith('/account')) return
  if (url.pathname.startsWith('/chat')) return
  if (url.pathname.startsWith('/bookings')) return
  if (url.pathname.startsWith('/payments')) return

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then(response => {
          if (response.ok) {
            const copy = response.clone()
            event.waitUntil(
              caches.open(CACHE_NAME).then(cache => cache.put(request, copy))
            )
          }
          return response
        })
        .catch(() =>
          caches.match(request, { ignoreSearch: true })
            .then(cached => cached || caches.match(START_URL, { ignoreSearch: true }))
            .then(cached => cached || caches.match('/', { ignoreSearch: true }))
            .then(cached => cached || caches.match(OFFLINE_URL))
        )
    )
    return
  }

  if (url.pathname.startsWith('/_next/static/') || url.pathname === '/royalhouse-icon.svg') {
    event.respondWith(
      caches.match(request).then(cached => cached || fetch(request).then(response => {
        if (response.ok) {
          const copy = response.clone()
          event.waitUntil(
            caches.open(CACHE_NAME).then(cache => cache.put(request, copy))
          )
        }
        return response
      }))
    )
  }
})

self.addEventListener('push', event => {
  let data = {}
  try { data = event.data ? event.data.json() : {} } catch { data = {} }
  const title = data.title || 'Royalhouse'
  const options = {
    body: data.body || 'Sizga yangi xabar keldi.',
    icon: data.icon || '/royalhouse-icon.svg',
    badge: data.badge || '/royalhouse-icon.svg',
    data: { url: data.url || '/chat' },
  }
  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', event => {
  event.notification.close()
  const url = event.notification.data?.url || '/chat'
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      const existing = list.find(client => 'focus' in client)
      if (existing) return existing.focus().then(() => existing.navigate(url))
      return clients.openWindow(url)
    })
  )
})
