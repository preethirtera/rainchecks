/* RainCheck push worker.
   Privacy: stores only an opaque hash → { push subscription, due timestamps }.
   Never sees ask titles or people — pushes are empty; the service worker on
   the device reads its own local data and shows the notification. */

export interface Env {
  REMINDERS: KVNamespace
  VAPID_PUBLIC_KEY: string
  VAPID_PRIVATE_KEY: string
}

interface StoredSub {
  subscription: { endpoint: string }
  dueTimes: string[]
}

const ALLOWED_ORIGINS = ['https://preethirtera.github.io']

function cors(req: Request): Record<string, string> {
  const origin = req.headers.get('Origin') ?? ''
  const ok = ALLOWED_ORIGINS.includes(origin) || origin.startsWith('http://localhost')
  return {
    'Access-Control-Allow-Origin': ok ? origin : ALLOWED_ORIGINS[0],
    'Access-Control-Allow-Methods': 'POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'content-type',
  }
}

function json(req: Request, body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...cors(req) },
  })
}

function b64urlToBytes(s: string): Uint8Array {
  const norm = s.replace(/-/g, '+').replace(/_/g, '/')
  const pad = norm.length % 4 ? '='.repeat(4 - (norm.length % 4)) : ''
  return Uint8Array.from(atob(norm + pad), (c) => c.charCodeAt(0))
}

function bytesToB64url(buf: ArrayBuffer | Uint8Array): string {
  const bytes = new Uint8Array(buf)
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

async function vapidJWT(endpoint: string, env: Env): Promise<string> {
  const aud = new URL(endpoint).origin
  const enc = new TextEncoder()
  const header = bytesToB64url(enc.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })))
  const payload = bytesToB64url(
    enc.encode(
      JSON.stringify({
        aud,
        exp: Math.floor(Date.now() / 1000) + 12 * 3600,
        sub: 'mailto:tera.preethi@gmail.com',
      }),
    ),
  )
  const pub = b64urlToBytes(env.VAPID_PUBLIC_KEY)
  const jwk = {
    kty: 'EC',
    crv: 'P-256',
    d: env.VAPID_PRIVATE_KEY,
    x: bytesToB64url(pub.slice(1, 33)),
    y: bytesToB64url(pub.slice(33, 65)),
  }
  const key = await crypto.subtle.importKey('jwk', jwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign'])
  const sig = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    key,
    enc.encode(`${header}.${payload}`),
  )
  return `${header}.${payload}.${bytesToB64url(sig)}`
}

/** empty push: no payload, so no encryption and no content ever leaves the device */
async function sendPush(sub: StoredSub['subscription'], env: Env): Promise<number> {
  const jwt = await vapidJWT(sub.endpoint, env)
  const res = await fetch(sub.endpoint, {
    method: 'POST',
    headers: {
      TTL: '3600',
      Urgency: 'high',
      Authorization: `vapid t=${jwt}, k=${env.VAPID_PUBLIC_KEY}`,
    },
  })
  return res.status
}

async function keyFor(endpoint: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(endpoint))
  return bytesToB64url(digest).slice(0, 43)
}

function validDueTimes(input: unknown): string[] {
  if (!Array.isArray(input)) return []
  return input
    .filter((t): t is string => typeof t === 'string' && !Number.isNaN(new Date(t).getTime()))
    .slice(0, 100)
}

async function checkDue(env: Env): Promise<{ checked: number; pushed: number }> {
  const now = Date.now()
  const list = await env.REMINDERS.list()
  let pushed = 0
  for (const entry of list.keys) {
    const raw = await env.REMINDERS.get(entry.name)
    if (!raw) continue
    const rec = JSON.parse(raw) as StoredSub
    const due = rec.dueTimes.some((t) => new Date(t).getTime() <= now)
    if (!due) continue
    const status = await sendPush(rec.subscription, env)
    if (status === 404 || status === 410) {
      await env.REMINDERS.delete(entry.name)
      continue
    }
    pushed++
    rec.dueTimes = rec.dueTimes.filter((t) => new Date(t).getTime() > now)
    await env.REMINDERS.put(entry.name, JSON.stringify(rec))
  }
  return { checked: list.keys.length, pushed }
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    if (req.method === 'OPTIONS') return new Response(null, { headers: cors(req) })
    const url = new URL(req.url)

    if (url.pathname === '/health') return json(req, { ok: true })

    if (url.pathname === '/subscribe' && req.method === 'POST') {
      const body = (await req.json().catch(() => null)) as {
        subscription?: { endpoint?: string }
        dueTimes?: unknown
      } | null
      if (!body?.subscription?.endpoint) return json(req, { error: 'subscription required' }, 400)
      const key = await keyFor(body.subscription.endpoint)
      await env.REMINDERS.put(
        key,
        JSON.stringify({ subscription: body.subscription, dueTimes: validDueTimes(body.dueTimes) }),
      )
      return json(req, { ok: true })
    }

    if (url.pathname === '/subscribe' && req.method === 'DELETE') {
      const body = (await req.json().catch(() => null)) as { endpoint?: string } | null
      if (!body?.endpoint) return json(req, { error: 'endpoint required' }, 400)
      await env.REMINDERS.delete(await keyFor(body.endpoint))
      return json(req, { ok: true })
    }

    // manual sweep, same logic the cron runs; useful for testing
    if (url.pathname === '/wake' && req.method === 'POST') {
      return json(req, await checkDue(env))
    }

    return json(req, { error: 'not found' }, 404)
  },

  async scheduled(_event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(checkDue(env))
  },
}
