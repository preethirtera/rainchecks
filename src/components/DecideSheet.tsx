import { useState } from 'react'
import { db } from '../db'
import { consecutiveDays, findConflict, isThisWeek, percentSpent, spentHours } from '../lib/budget'
import { DEFLECTIONS, DECLINES, FLAKE_WARNINGS, counterOffer } from '../lib/replies'
import { freeEvenings } from '../lib/stats'
import { ensurePermission } from '../lib/notify'
import { syncReminders } from '../lib/push'
import { fmtWhen, fmtHours, fmtUntil, SIZE_LABELS } from '../lib/format'
import type { Ask, Settings } from '../types'

interface Props {
  ask: Ask
  asks: Ask[]
  settings: Settings
  onClose: () => void
}

async function copy(text: string) {
  try {
    await navigator.clipboard.writeText(text)
  } catch {
    /* clipboard can be unavailable in some webviews; the text is still shown */
  }
}

export function DecideSheet({ ask, asks, settings, onClose }: Props) {
  const [pane, setPane] = useState<'decide' | 'defer' | 'decline' | 'flake'>('decide')
  const [copied, setCopied] = useState<string | null>(null)

  const now = new Date()
  const locked = ask.yesLockedUntil !== null && new Date(ask.yesLockedUntil) > now
  const conflict = findConflict(ask, asks)
  const streak = ask.status === 'pending' || ask.status === 'deferred' ? consecutiveDays(ask, asks) : 0
  const current = percentSpent(asks, settings.weeklyBudgetHours, now)
  const projected = isThisWeek(ask.start, now)
    ? Math.round(((spentHours(asks, now) + ask.durationHours) / settings.weeklyBudgetHours) * 100)
    : current

  async function sayYes() {
    if (locked) return
    await db.asks.update(ask.id!, { status: 'committed', decidedAt: now.toISOString() })
    onClose()
  }

  async function defer(hours: number) {
    const deflection = DEFLECTIONS[settings.tone]
    await copy(deflection)
    await ensurePermission()
    await db.asks.update(ask.id!, {
      status: 'deferred',
      decideBy: new Date(now.getTime() + hours * 3_600_000).toISOString(),
    })
    syncReminders()
    setCopied(deflection)
    setPane('defer')
  }

  async function decline(message: string) {
    await copy(message)
    await db.asks.update(ask.id!, { status: 'declined', decidedAt: now.toISOString() })
    setCopied(message)
  }

  async function remove() {
    await db.asks.delete(ask.id!)
    onClose()
  }

  async function flake() {
    await db.asks.update(ask.id!, { status: 'flaked', decidedAt: now.toISOString() })
    window.dispatchEvent(new CustomEvent('raincheck:strike'))
    onClose()
  }

  const committed = ask.status === 'committed'

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" role="dialog" aria-label={`Decide: ${ask.title}`} onClick={(e) => e.stopPropagation()}>
        <header className="sheet-head">
          <h2 className="sheet-title">{ask.title}</h2>
          <p className="sheet-sub">
            {ask.who && <>w/ {ask.who} · </>}
            {fmtWhen(ask.start)} · {fmtHours(ask.durationHours)} · {SIZE_LABELS[ask.size]}
          </p>
        </header>

        {copied && (
          <div className="copied-note" role="status">
            Copied to clipboard — paste it back into the chat:
            <blockquote>{copied}</blockquote>
            <button className="btn btn-quiet" type="button" onClick={onClose}>
              Done
            </button>
          </div>
        )}

        {!copied && pane === 'flake' && (
          <div className="sheet-actions">
            <div className="conflict" role="alert">
              {FLAKE_WARNINGS[settings.tone]}
            </div>
            <button className="btn btn-flake" type="button" onClick={flake}>
              Flake anyway ({fmtHours(ask.durationHours)} stays spent)
            </button>
            <button className="btn btn-primary" type="button" onClick={() => onClose()}>
              Keep my word
            </button>
          </div>
        )}

        {!copied && pane === 'decide' && committed && (
          <div className="sheet-actions">
            <p className="pane-hint">You said yes to this. It's on your week.</p>
            <button className="btn" type="button" onClick={() => setPane('flake')}>
              I need to back out 🥀
            </button>
            <button className="btn btn-quiet" type="button" onClick={onClose}>
              Close
            </button>
          </div>
        )}

        {!copied && pane === 'decide' && !committed && (
          <>
            <div className={`impact ${projected > 100 ? 'impact-over' : ''}`}>
              Saying yes puts this week at <strong>{projected}%</strong> of your budget
              {projected > 100 && ' — over the line'}
            </div>
            {conflict && (
              <div className="conflict" role="alert">
                ⚠ You already have <strong>{conflict.kind === 'alone' ? 'plans (alone time)' : conflict.title}</strong> at
                that time ({fmtWhen(conflict.start)})
              </div>
            )}
            {streak >= 3 && (
              <div className="conflict">
                ⚠ Saying yes makes it <strong>{streak} days in a row</strong> with plans
              </div>
            )}
            {locked && (
              <div className="lock-note">
                🔒 24-hour rule — this is {SIZE_LABELS[ask.size]}. Yes unlocks {fmtUntil(ask.yesLockedUntil!)}.
                Raincheck or sleep on it anytime.
              </div>
            )}
            <div className="sheet-actions">
              <button className="btn btn-primary" type="button" disabled={locked} onClick={sayYes}>
                {locked ? `✓ Yes 🔒 ${fmtUntil(ask.yesLockedUntil!)}` : '✓ Yes, commit it'}
              </button>
              <button className="btn" type="button" onClick={() => setPane('defer')}>
                ? Let me sleep on it
              </button>
              <button className="btn btn-decline" type="button" onClick={() => setPane('decline')}>
                ✗ Raincheck 🌧
              </button>
              <button className="btn btn-quiet" type="button" onClick={remove}>
                Delete
              </button>
            </div>
          </>
        )}

        {!copied && pane === 'defer' && (
          <div className="sheet-actions">
            <p className="pane-hint">
              Blame the calendar. This copies your deflection reply and reminds you to decide:
            </p>
            <button className="btn" type="button" onClick={() => defer(3)}>
              Remind me in 3 hours
            </button>
            <button className="btn" type="button" onClick={() => defer(hoursUntilTomorrow9(now))}>
              Tomorrow morning
            </button>
            <button className="btn" type="button" onClick={() => defer(24)}>
              Give me 24 hours
            </button>
            <button className="btn btn-quiet" type="button" onClick={() => setPane('decide')}>
              Back
            </button>
          </div>
        )}

        {!copied && pane === 'decline' && (
          <div className="sheet-actions">
            <p className="pane-hint">Pick a no. It copies, you paste, the app takes the blame:</p>
            {freeEvenings(asks, ask.start).map((slot) => {
              const day = slot.toLocaleDateString(undefined, { weekday: 'long' })
              const msg = counterOffer(settings.tone, day)
              return (
                <button key={day} className="btn btn-msg" type="button" onClick={() => decline(msg)}>
                  <span className="msg-badge">counter · {day}</span>
                  {msg}
                </button>
              )
            })}
            {settings.customDeclines.map((msg) => (
              <button key={msg} className="btn btn-msg" type="button" onClick={() => decline(msg)}>
                <span className="msg-badge msg-badge-yours">yours</span>
                {msg}
              </button>
            ))}
            {DECLINES[settings.tone].map((msg, i) => (
              <button key={msg} className="btn btn-msg" type="button" onClick={() => decline(msg)}>
                {i === 0 && settings.customDeclines.length === 0 && (
                  <span className="msg-badge">suggested</span>
                )}
                {msg}
              </button>
            ))}
            <button className="btn btn-quiet" type="button" onClick={() => setPane('decide')}>
              Back
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

function hoursUntilTomorrow9(now: Date): number {
  const t = new Date(now)
  t.setDate(t.getDate() + 1)
  t.setHours(9, 0, 0, 0)
  return (t.getTime() - now.getTime()) / 3_600_000
}
