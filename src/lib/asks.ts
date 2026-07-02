import { db } from '../db'
import { parseAsk } from './parse'
import { findConflict } from './budget'
import { fmtWhen } from './format'
import type { Ask, Settings } from '../types'

/** Turn raw text (typed, pasted, or shared in) into a pending ask.
    Fires the instant conflict heads-up if it collides with a commitment. */
export async function addAskFromText(text: string, settings: Settings): Promise<Ask> {
  const parsed = parseAsk(text)
  const now = new Date()
  const bigAsk = parsed.size === 'fullday' || parsed.size === 'multiday'
  const ask: Ask = {
    kind: 'ask',
    rawText: text.trim(),
    title: parsed.title,
    who: parsed.who,
    start: parsed.start ? parsed.start.toISOString() : null,
    durationHours: parsed.durationHours,
    size: parsed.size,
    status: 'pending',
    createdAt: now.toISOString(),
    decideBy: null,
    yesLockedUntil: bigAsk
      ? new Date(now.getTime() + settings.coolingOffHours * 3_600_000).toISOString()
      : null,
    decidedAt: null,
  }
  ask.id = (await db.asks.add(ask)) as number

  const conflict = findConflict(ask, await db.asks.toArray())
  if (conflict && 'Notification' in window && Notification.permission === 'granted') {
    new Notification('Heads up 🌧', {
      body: `You already have ${conflict.kind === 'alone' ? 'plans (alone time)' : conflict.title} at ${fmtWhen(conflict.start)}.`,
      tag: 'raincheck-conflict',
    })
  }
  return ask
}

/** Text shared into the app via the share sheet (share_target GET) or an
    intake link (#add=...). Returns null when the URL carries no ask. */
export function readSharedText(): string | null {
  const params = new URLSearchParams(window.location.search)
  const shared = [params.get('title'), params.get('text'), params.get('url')]
    .filter(Boolean)
    .join(' ')
    .trim()
  if (shared) return shared
  const hash = window.location.hash
  if (hash.startsWith('#add=')) {
    try {
      return decodeURIComponent(hash.slice(5)).trim() || null
    } catch {
      return null
    }
  }
  return null
}
