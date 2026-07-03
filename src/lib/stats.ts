import type { Ask } from '../types'
import { weekStart } from './budget'

function inRange(iso: string | null, from: Date, to: Date): boolean {
  if (!iso) return false
  const t = new Date(iso).getTime()
  return t >= from.getTime() && t < to.getTime()
}

/** hours a given calendar week cost (committed + the flake tax) */
export function weekSpent(asks: Ask[], start: Date): number {
  const end = new Date(start)
  end.setDate(end.getDate() + 7)
  return asks
    .filter((a) => (a.status === 'committed' || a.status === 'flaked') && inRange(a.start, start, end))
    .reduce((s, a) => s + a.durationHours, 0)
}

/** hours saying no gave back — declined asks, by when you declined them */
export function reclaimedHours(asks: Ask[], from?: Date, to?: Date): number {
  return asks
    .filter(
      (a) =>
        a.status === 'declined' &&
        (from === undefined || inRange(a.decidedAt, from, to ?? new Date(8.64e15))),
    )
    .reduce((s, a) => s + a.durationHours, 0)
}

/** consecutive completed weeks at or under budget, counting back from last week */
export function underBudgetStreak(asks: Ask[], budgetHours: number, now: Date = new Date()): number {
  const dated = asks.filter((a) => a.start !== null)
  if (dated.length === 0) return 0
  const earliest = weekStart(new Date(Math.min(...dated.map((a) => new Date(a.start!).getTime()))))
  let streak = 0
  const cursor = weekStart(now)
  cursor.setDate(cursor.getDate() - 7) // last completed week
  while (cursor.getTime() >= earliest.getTime()) {
    if (weekSpent(asks, cursor) > budgetHours) break
    streak++
    cursor.setDate(cursor.getDate() - 7)
  }
  return streak
}

/** next free evenings (7pm, 2h clear) for counter-offers; skips the ask's own day */
export function freeEvenings(asks: Ask[], avoid: string | null, count = 2, now: Date = new Date()): Date[] {
  const busy = asks.filter((a) => a.status === 'committed' && a.start)
  const avoidDay = avoid ? new Date(avoid).toDateString() : null
  const out: Date[] = []
  for (let i = 1; i <= 10 && out.length < count; i++) {
    const slot = new Date(now)
    slot.setDate(slot.getDate() + i)
    slot.setHours(19, 0, 0, 0)
    if (slot.toDateString() === avoidDay) continue
    const slotEnd = slot.getTime() + 2 * 3_600_000
    const clear = !busy.some((a) => {
      const s = new Date(a.start!).getTime()
      const e = s + a.durationHours * 3_600_000
      return slot.getTime() < e && s < slotEnd
    })
    if (clear) out.push(slot)
  }
  return out
}
