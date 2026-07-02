import { db } from '../db'

/* Push-while-closed. The worker stores only { subscription, due timestamps } —
   never titles or people. It sends an empty wake-up push; sw.ts builds the
   notification from local data. */

export const WORKER_URL = 'https://raincheck-push.WORKERS_SUBDOMAIN.workers.dev'
const VAPID_PUBLIC_KEY =
  'BPcNJLr_1csIJ3E5-F8Sr4HxDCup6PVqOhOtfYoxwXZEmgNhh5Cem48gqDpPH-VTZtUGvOpezsFycrb05LHnTFw'

function keyBytes(b64url: string): Uint8Array {
  const norm = b64url.replace(/-/g, '+').replace(/_/g, '/')
  const pad = norm.length % 4 ? '='.repeat(4 - (norm.length % 4)) : ''
  return Uint8Array.from(atob(norm + pad), (c) => c.charCodeAt(0))
}

async function getSubscription(): Promise<PushSubscription | null> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return null
  const reg = await navigator.serviceWorker.ready
  return reg.pushManager.getSubscription()
}

export async function pushEnabled(): Promise<boolean> {
  return (await getSubscription()) !== null
}

export async function enablePush(): Promise<boolean> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return false
  if ((await Notification.requestPermission()) !== 'granted') return false
  const reg = await navigator.serviceWorker.ready
  await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: keyBytes(VAPID_PUBLIC_KEY).buffer as ArrayBuffer,
  })
  await syncReminders()
  return true
}

export async function disablePush(): Promise<void> {
  const sub = await getSubscription()
  if (!sub) return
  await fetch(`${WORKER_URL}/subscribe`, {
    method: 'DELETE',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ endpoint: sub.endpoint }),
  }).catch(() => undefined)
  await sub.unsubscribe()
}

/** push the current deferred decide-by times up to the worker */
export async function syncReminders(): Promise<void> {
  const sub = await getSubscription()
  if (!sub) return
  const deferred = await db.asks.where('status').equals('deferred').toArray()
  const dueTimes = deferred
    .map((a) => a.decideBy)
    .filter((t): t is string => t !== null && new Date(t).getTime() > Date.now())
  await fetch(`${WORKER_URL}/subscribe`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ subscription: sub.toJSON(), dueTimes }),
  }).catch(() => undefined)
}
