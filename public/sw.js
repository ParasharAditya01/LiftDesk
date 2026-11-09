/* LiftDesk web push service worker. */
self.addEventListener('install', event => {
  event.waitUntil(self.skipWaiting())
})

self.addEventListener('activate', event => {
  event.waitUntil(self.clients.claim())
})

self.addEventListener('push', event => {
  let payload = {}
  try { payload = event.data ? event.data.json() : {} } catch { payload = {} }
  const title = typeof payload.title === 'string' ? payload.title : 'New gym chat message'
  const body = typeof payload.body === 'string' ? payload.body : 'Open LiftDesk to read the latest message.'
  const tag = typeof payload.tag === 'string' ? payload.tag : undefined
  event.waitUntil(self.registration.showNotification(title, {
    body,
    icon: '/liftdesk-icon-v4.png',
    badge: '/liftdesk-icon-v4.png',
    tag,
    data: { url: '/?open_chat=1' },
  }))
})

self.addEventListener('notificationclick', event => {
  event.notification.close()
  event.waitUntil((async () => {
    const target = new URL('/?open_chat=1', self.location.origin).href
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    for (const client of windows) {
      if (new URL(client.url).origin !== self.location.origin) continue
      client.postMessage({ type: 'LIFTDESK_OPEN_GYM_CHAT' })
      await client.focus()
      return
    }
    await self.clients.openWindow(target)
  })())
})
