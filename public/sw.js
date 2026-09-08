self.addEventListener('push', event => {
  let data = {}
  try { data = event.data ? event.data.json() : {} } catch { data = {} }
  const title = data.title || 'Prohouse'
  const options = {
    body: data.body || 'Sizga yangi xabar keldi.',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    data: { url: data.url || '/chat' },
  }
  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', event => {
  event.notification.close()
  const url = event.notification.data?.url || '/chat'
  event.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
    const existing = list.find(client => 'focus' in client)
    if (existing) return existing.focus().then(() => existing.navigate(url))
    return clients.openWindow(url)
  }))
})
