import { db } from '../db'
import { weekStart } from '../lib/budget'
import { reclaimedHours, underBudgetStreak, weekSpent } from '../lib/stats'
import { fmtHours, fmtWhen } from '../lib/format'
import type { Ask, Settings } from '../types'

export function StatsView({ asks, settings }: { asks: Ask[]; settings: Settings }) {
  const now = new Date()
  const thisWeekStart = weekStart(now)
  const lastWeekStart = new Date(thisWeekStart)
  lastWeekStart.setDate(lastWeekStart.getDate() - 7)

  const reclaimedWeek = reclaimedHours(asks, thisWeekStart)
  const reclaimedEver = reclaimedHours(asks)
  const streak = underBudgetStreak(asks, settings.weeklyBudgetHours, now)
  const flakes = asks.filter((a) => a.status === 'flaked').length
  const lastWeekHours = weekSpent(asks, lastWeekStart)
  const lastWeekYeses = asks.filter(
    (a) =>
      (a.status === 'committed' || a.status === 'flaked') &&
      a.start &&
      new Date(a.start) >= lastWeekStart &&
      new Date(a.start) < thisWeekStart,
  )
  const regrets = lastWeekYeses.filter((a) => a.regretted).length
  const overBudget = lastWeekHours > settings.weeklyBudgetHours
  const suggested = Math.max(2, settings.weeklyBudgetHours - 2)

  return (
    <section className="stats" aria-label="Stats">
      <div className="stat-grid">
        <div className="stat-card">
          <span className="stat-num stat-cyan">{fmtHours(reclaimedWeek)}</span>
          <span className="stat-label">reclaimed this week</span>
        </div>
        <div className="stat-card">
          <span className="stat-num stat-cyan">{fmtHours(reclaimedEver)}</span>
          <span className="stat-label">reclaimed all-time</span>
        </div>
        <div className="stat-card">
          <span className="stat-num">{streak}</span>
          <span className="stat-label">week{streak === 1 ? '' : 's'} under budget in a row</span>
        </div>
        <div className="stat-card">
          <span className="stat-num stat-amber">{flakes}</span>
          <span className="stat-label">flake{flakes === 1 ? '' : 's'} on record</span>
        </div>
      </div>
      <p className="stat-note">
        Every raincheck gives you hours back. Every flake stays on the record. The app is keeping
        score so you don't have to.
      </p>

      {lastWeekYeses.length > 0 && (
        <div className="reflect">
          <h2 className="list-title">Last week's yeses — any regrets?</h2>
          {lastWeekYeses.map((a) => (
            <button
              key={a.id}
              className={`ask-card ${a.regretted ? 'ask-regret' : ''}`}
              type="button"
              onClick={() => db.asks.update(a.id!, { regretted: !a.regretted })}
            >
              <span className="ask-main">
                <span className="ask-title">{a.title}</span>
                <span className="ask-meta">
                  {a.who && <>w/ {a.who} · </>}
                  {fmtWhen(a.start)} · {fmtHours(a.durationHours)}
                </span>
              </span>
              <span className="status">{a.regretted ? '💜 noted' : 'regret it?'}</span>
            </button>
          ))}
          {(regrets > 0 || overBudget) && (
            <p className="stat-note stat-suggest">
              {overBudget && `Last week ran ${fmtHours(lastWeekHours)} against a ${settings.weeklyBudgetHours}h budget. `}
              {regrets > 0 && `${regrets} yes${regrets === 1 ? '' : 'es'} you regret. `}
              Consider dropping your budget to {suggested}h — you can raise it back anytime.
            </p>
          )}
        </div>
      )}

    </section>
  )
}
