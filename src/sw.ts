/// <reference lib="webworker" />
import { precacheAndRoute } from 'workbox-precaching'

declare let self: ServiceWorkerGlobalScope

precacheAndRoute(self.__WB_MANIFEST)

/* Pushes arrive empty (privacy: the server knows only timestamps).
   We read our own local data to build the notification. */
self.addEventListener('push', (event) => {
  event.waitUntil(showDueNotifications())
})

interface StoredAsk {
  id: number
  title: string
  who: string | null
  status: string
  decideBy: string | null
}

async function showDueNotifications(): Promise<void> {
  const due = await readDueAsks()
  if (due.length === 0) {
    await self.registration.showNotification('RainCheck 🌧', {
      body: 'Something needs your decision.',
      tag: 'raincheck-due',
      icon: '/raincheck/pwa-192.png',
    })
    return
  }
  for (const ask of due) {
    await self.registration.showNotification('Time to decide 🌧', {
      body: `${ask.title}${ask.who ? ` w/ ${ask.who}` : ''}. Your calendar awaits your verdict.`,
      tag: `raincheck-${ask.id}`,
      icon: '/raincheck/pwa-192.png',
    })
  }
}

function readDueAsks(): Promise<StoredAsk[]> {
  return new Promise((resolve) => {
    const req = indexedDB.open('raincheck')
    req.onerror = () => resolve([])
    req.onsuccess = () => {
      const db = req.result
      try {
        const getAll = db.transaction('asks').objectStore('asks').getAll()
        getAll.onsuccess = () => {
          const soon = Date.now() + 5 * 60_000 // cron granularity
          resolve(
            (getAll.result as StoredAsk[]).filter(
              (a) => a.status === 'deferred' && a.decideBy && new Date(a.decideBy).getTime() <= soon,
            ),
          )
        }
        getAll.onerror = () => resolve([])
      } catch {
        resolve([])
      }
    }
  })
}

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  event.waitUntil(self.clients.openWindow('/raincheck/'))
})
