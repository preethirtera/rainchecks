import * as chrono from 'chrono-node'
import type { AskSize } from '../types'

export interface ParsedAsk {
  title: string
  who: string | null
  start: Date | null
  durationHours: number
  size: AskSize
}

/** activity keyword → estimated hours */
const DURATION_HINTS: Array<[RegExp, number]> = [
  [/\b(coffee|chai|boba)\b/i, 1],
  [/\b(call|catch ?up call|facetime)\b/i, 0.5],
  [/\b(lunch|brunch)\b/i, 1.5],
  [/\b(dinner|drinks|happy hour)\b/i, 2.5],
  [/\b(movie|show|concert|gig)\b/i, 3],
  [/\b(party|birthday|game night|potluck)\b/i, 3.5],
  [/\b(hike|beach|museum|climbing)\b/i, 4],
  [/\b(wedding|festival|conference)\b/i, 8],
  [/\b(help .{0,20}move|moving day)\b/i, 6],
  [/\b(trip|weekend|camping|getaway|road ?trip)\b/i, 24],
]

const FULLDAY_WORDS = /\b(wedding|festival|conference|all[- ]day|help .{0,20}move|moving day)\b/i
const MULTIDAY_WORDS = /\b(trip|weekend away|camping|getaway|road ?trip|overnight)\b/i
const EVENING_WORDS = /\b(dinner|drinks|party|movie|show|concert|game night|happy hour|gig)\b/i

function estimateDuration(text: string): number {
  for (const [re, hours] of DURATION_HINTS) {
    if (re.test(text)) return hours
  }
  return 2
}

function classifySize(text: string, start: Date | null, durationHours: number): AskSize {
  if (MULTIDAY_WORDS.test(text) || durationHours >= 20) return 'multiday'
  if (FULLDAY_WORDS.test(text) || durationHours >= 5) return 'fullday'
  if (EVENING_WORDS.test(text) || (start !== null && start.getHours() >= 17)) return 'evening'
  return 'small'
}

function extractWho(text: string): { who: string | null; rest: string } {
  const m = text.match(/\b(?:w\/|with)\s+([A-Za-z][\w'-]*(?:\s+(?:and|&)\s+[A-Za-z][\w'-]*)?)/i)
  if (!m) return { who: null, rest: text }
  const who = m[1]
    .split(/\s+/)
    .map((w) => (/^(and|&)$/i.test(w) ? w.toLowerCase() : w[0].toUpperCase() + w.slice(1)))
    .join(' ')
  return { who, rest: text.replace(m[0], ' ') }
}

/** "thurs 7" / "tomorrow 8" — casual bare hours after a day word mean evening.
    Rewrite to "7pm" so chrono picks the hour up instead of dropping it. */
const BARE_HOUR_AFTER_DAY =
  /\b((?:mon|tues?|wed(?:nes)?|thur?s?|fri|sat(?:ur)?|sun)(?:day)?|tomorrow|tonight|today)\s+([1-8])\b(?!\s*(?::|\.|am|pm))/gi

export function parseAsk(rawText: string, now: Date = new Date()): ParsedAsk {
  const { who, rest: restRaw } = extractWho(rawText)
  const rest = restRaw.replace(BARE_HOUR_AFTER_DAY, (_m, day: string, h: string) => `${day} ${h}pm`)

  const results = chrono.parse(rest, now, { forwardDate: true })
  const hit = results[0] ?? null
  let start: Date | null = null
  let rangeHours: number | null = null

  if (hit) {
    start = hit.start.date()
    // Bare small hours in casual asks ("thurs 7") almost always mean evening.
    if (!hit.start.isCertain('meridiem') && hit.start.isCertain('hour')) {
      const h = hit.start.get('hour')
      if (h !== null && h >= 1 && h <= 8) {
        start = new Date(start.getTime() + 12 * 3_600_000)
      }
    }
    if (hit.end) {
      rangeHours = Math.max(0.5, (hit.end.date().getTime() - start.getTime()) / 3_600_000)
    }
  }

  const durationHours = rangeHours ?? estimateDuration(rawText)
  const size = classifySize(rawText, start, durationHours)

  // Title: raw text minus the who-clause and the date words, tidied up.
  let title = rest
  if (hit) title = title.replace(hit.text, ' ')
  title = title.replace(/[\s,;–-]+/g, ' ').replace(/\s+([?!.])/g, '$1').trim()
  if (title.length < 2) title = rawText.trim()
  title = title[0].toUpperCase() + title.slice(1)

  return { title, who, start, durationHours, size }
}
