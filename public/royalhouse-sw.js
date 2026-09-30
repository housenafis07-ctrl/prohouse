self.addEventListener('push', (event) => {
  let payload = {}
  try { payload = event.data ? event.data.json() : {} } catch {}
  event.waitUntil(
    self.registration.showNotification(payload.title || 'Royalhouse', {
      body: payload.body || 'Royalhouse’da yangi yangilanish bor.',
      icon: payload.icon || '/royalhouse-icon.svg',
      badge: payload.badge || '/royalhouse-icon.svg',
      data: { url: payload.url || '/account/saved-searches' }
    })
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = event.notification.data?.url || '/account/saved-searches'
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ('focus' in client) {
          client.navigate(url)
          return client.focus()
        }
      }
      return self.clients.openWindow(url)
    })
  )
})
